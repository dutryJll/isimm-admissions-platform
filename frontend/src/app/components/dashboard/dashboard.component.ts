import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { environment } from '../../../environments/environment';

interface NotificationItem {
  id: number;
  titre: string;
  message: string;
  date: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  lue: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatProgressBarModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  currentUser: any = null;
  userProfile: any = null;
  errorMessage: string = '';
  currentDate: Date = new Date();
  currentView: 'dashboard' | 'notifications' = 'dashboard';
  notificationsCandidat: NotificationItem[] = [];
  notificationsNonLues = 0;
  filtreNotificationType: '' | 'info' | 'success' | 'warning' | 'danger' = '';
  filtreNotificationTriRapide: 'recent' | 'critique' = 'recent';
  filtreNotificationDateDebut: string = '';
  filtreNotificationDateFin: string = '';
  filtreNotificationRecherche: string = '';
  isDashboardLoading = true;
  isNotificationsLoading = false;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.currentUserValue;
    this.loadUserProfile();
    this.loadNotifications();
  }

  loadUserProfile() {
    const email = this.currentUser?.email;
    if (!email) {
      console.error('âŒ Email non trouvÃ©');
      return;
    }

    this.userService.getProfile(email).subscribe({
      next: (profile) => {
        this.userProfile = profile;
        this.isDashboardLoading = false;
      },
      error: (error) => {
        console.error('âŒ Erreur chargement profil:', error);
        this.isDashboardLoading = false;
      },
    });
  }
  logout() {
    this.authService.logout();
  }

  switchView(view: 'dashboard' | 'notifications'): void {
    this.currentView = view;
    if (view === 'notifications') {
      this.loadNotifications();
    }
  }

  private loadNotifications(): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    this.isNotificationsLoading = true;

    this.http
      .get<NotificationItem[]>(`${environment.candidatureServiceUrl}/mes-notifications/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (data) => {
          this.notificationsCandidat = data || [];
          this.notificationsNonLues = this.notificationsCandidat.filter((item) => !item.lue).length;
          this.isNotificationsLoading = false;
        },
        error: (error) => {
          console.error('âŒ Erreur chargement notifications:', error);
          this.notificationsCandidat = [];
          this.notificationsNonLues = 0;
          this.isNotificationsLoading = false;
        },
      });
  }

  marquerNotificationCommeLue(notificationId: number): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    this.http
      .post(
        `${environment.candidatureServiceUrl}/notifications/${notificationId}/mark-read/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: () => {
          this.notificationsCandidat = this.notificationsCandidat.map((notification) =>
            notification.id === notificationId ? { ...notification, lue: true } : notification,
          );
          this.notificationsNonLues = this.notificationsCandidat.filter((item) => !item.lue).length;
        },
        error: (error) => {
          console.error('âŒ Erreur marquage notification lue:', error);
        },
      });
  }

  marquerToutesNotificationsCommeLues(): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    this.http
      .post(
        `${environment.candidatureServiceUrl}/notifications/mark-all-read/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: () => {
          this.notificationsCandidat = this.notificationsCandidat.map((notification) => ({
            ...notification,
            lue: true,
          }));
          this.notificationsNonLues = 0;
        },
        error: (error) => {
          console.error('âŒ Erreur marquage notifications lues:', error);
        },
      });
  }

  getNotificationsFiltrees(): NotificationItem[] {
    const search = this.filtreNotificationRecherche.trim().toLowerCase();
    const severity = (notification: NotificationItem): number => {
      if (notification.type === 'danger') {
        return 3;
      }
      if (notification.type === 'warning') {
        return 2;
      }
      if (notification.type === 'info') {
        return 1;
      }
      return 0;
    };

    const filtered = this.notificationsCandidat.filter((notification) => {
      if (this.filtreNotificationType && notification.type !== this.filtreNotificationType) {
        return false;
      }

      const notificationDate = new Date(notification.date);

      if (this.filtreNotificationDateDebut) {
        const dateDebut = new Date(`${this.filtreNotificationDateDebut}T00:00:00`);
        if (notificationDate < dateDebut) {
          return false;
        }
      }

      if (this.filtreNotificationDateFin) {
        const dateFin = new Date(`${this.filtreNotificationDateFin}T23:59:59`);
        if (notificationDate > dateFin) {
          return false;
        }
      }

      if (search) {
        const content = `${notification.titre} ${notification.message}`.toLowerCase();
        if (!content.includes(search)) {
          return false;
        }
      }

      return true;
    });

    if (this.filtreNotificationTriRapide === 'critique') {
      return [...filtered].sort((a, b) => {
        const bySeverity = severity(b) - severity(a);
        if (bySeverity !== 0) {
          return bySeverity;
        }

        if (a.lue !== b.lue) {
          return Number(a.lue) - Number(b.lue);
        }

        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    }

    return [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  reinitialiserFiltresNotifications(): void {
    this.filtreNotificationType = '';
    this.filtreNotificationTriRapide = 'recent';
    this.filtreNotificationDateDebut = '';
    this.filtreNotificationDateFin = '';
    this.filtreNotificationRecherche = '';
  }

  get notificationsTotalCount(): number {
    return this.notificationsCandidat.length;
  }

  get notificationsTodayCount(): number {
    const today = new Date();
    return this.notificationsCandidat.filter((notification) => {
      const date = new Date(notification.date);
      return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    }).length;
  }

  get notificationsCriticalCount(): number {
    return this.notificationsCandidat.filter(
      (notification) => notification.type === 'warning' || notification.type === 'danger',
    ).length;
  }

  get notificationsFilteredUnreadCount(): number {
    return this.getNotificationsFiltrees().filter((notification) => !notification.lue).length;
  }

  getNotificationTypeLabel(type: NotificationItem['type']): string {
    if (type === 'success') {
      return 'Succes';
    }
    if (type === 'warning') {
      return 'Avertissement';
    }
    if (type === 'danger') {
      return 'Critique';
    }
    return 'Information';
  }

  getInitials(): string {
    if (this.userProfile?.first_name && this.userProfile?.last_name) {
      return (this.userProfile.first_name[0] + this.userProfile.last_name[0]).toUpperCase();
    }
    if (this.currentUser?.email) {
      return this.currentUser.email.substring(0, 2).toUpperCase();
    }
    return 'JD';
  }
}
