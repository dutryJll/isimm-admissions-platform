import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
interface Commission {
  id: number;
  nom: string;
  master_nom: string;
  responsable_nom?: string;
  membres_count: number;
  actif: boolean;
}

interface Master {
  id: number;
  nom: string;
  type: 'recherche' | 'professionnel';
  description: string;
  places: number;
  date_limite: string;
  statut: 'ouvert' | 'ferme';
  specialite: string;
}

interface Utilisateur {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean;
  date_inscription: string;
  suspended_since?: string | null;
  suspension_reason?: string | null;
  suspended_by_email?: string | null;
  reactivated_by_email?: string | null;
}

interface OffreIngenieur {
  id: number;
  titre: string;
  type: string;
  type_display: string;
  specialite: string;
  places: number;
  date_limite: string;
  statut: 'ouvert' | 'ferme';
  description: string;
  backend_id?: number;
}

interface OffreResponsableSync {
  id: number;
  titre: string;
  type: 'master' | 'cycle_ingenieur';
  specialite?: string;
  places: number;
  date_limite: string;
  statut: 'ouvert' | 'ferme';
  est_cache?: boolean;
}

interface ReglementConcoursIngenieur {
  metadata?: any;
  [key: string]: any;
}

interface ReferentielMasters {
  metadata?: any;
  sections_masters?: Record<string, any>;
  documents_requis_pdf_unique?: string[];
  regles_importantes?: string[];
  modele_formulaire_candidature?: {
    champs?: string[];
    choix_possibles?: string[];
  };
  [key: string]: any;
}

interface Candidature {
  id: number;
  numero: string;
  candidat_nom: string;
  candidat_email: string;
  master_nom: string;
  specialite: string;
  score: number;
  statut: string;
  date_soumission: string;
}

interface Role {
  id: number;
  nom: string;
  description: string;
  est_systeme: boolean;
  nb_utilisateurs: number;
  nb_permissions: number;
  permissions?: number[];
}

interface Permission {
  id: number;
  nom: string;
  module: string;
}

interface LogEntry {
  id: number;
  timestamp: string;
  user_name: string;
  action: string;
  module: string;
  description: string;
  ip_address: string;
  succes: boolean;
}

interface ActionMatrixRow {
  action_no: number;
  action_name: string;
  description?: string;
  roles: {
    candidat: boolean;
    commission: boolean;
    responsable_commission: boolean;
    admin: boolean;
  };
}

interface NotificationItem {
  id: number;
  titre: string;
  message: string;
  date: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  lue: boolean;
}

type RoleKey = 'candidat' | 'commission' | 'responsable_commission' | 'admin';
type ExportFormat = 'csv' | 'json' | 'ods' | 'pdf';
type ExportRow = Record<string, string | number | boolean | null | undefined>;

function normalizeActionLabel(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

@Component({
  selector: 'app-dashboard-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard-admin.html',
  styleUrl: './dashboard-admin.css',
})
export class DashboardAdminComponent implements OnInit {
  adminLogoSrc: string = '/images/logo-universite.png';
  private readonly userSuspensionStorageKey = 'admin-user-suspension-dates';
  currentUser: any = null;
  currentView: string = 'dashboard';
  currentDate: Date = new Date();
  selectedCustomActionName: string = '';

  // Données statistiques
  statsData = {
    totalUsers: 0,
    totalCandidatures: 0,
    admis: 0,
    membresCommission: 0,
  };

  notificationsCandidat: NotificationItem[] = [];
  notificationsNonLues: number = 0;
  filtreNotificationType: '' | 'info' | 'success' | 'warning' | 'danger' = '';
  filtreNotificationTriRapide: 'recent' | 'critique' = 'recent';
  filtreNotificationDateDebut: string = '';
  filtreNotificationDateFin: string = '';
  filtreNotificationRecherche: string = '';

  // Listes
  utilisateursList: Utilisateur[] = [];
  utilisateurRecherche: string = '';
  utilisateurStatusFilter: 'all' | 'active' | 'suspended' = 'all';
  selectedUserIds: number[] = [];
  openUserMenuId: number | null = null;
  exportFormat: ExportFormat = 'csv';
  mastersExportFormat: ExportFormat = 'csv';
  candidaturesExportFormat: ExportFormat = 'csv';
  offresExportFormat: ExportFormat = 'csv';
  mastersList: Master[] = [
    { id: 1, nom: 'Master Professionnel Genie Logiciel (MPGL)',                                  type: 'professionnel', description: '', places: 35,  date_limite: '2026-07-22', statut: 'ouvert', specialite: 'MPGL' },
    { id: 2, nom: 'Mastere Professionnel en sciences de donnees (MPDS)',                         type: 'professionnel', description: '', places: 35,  date_limite: '2026-07-22', statut: 'ouvert', specialite: 'MPDS' },
    { id: 3, nom: 'Mastere Professionnel en Ingenieries en Instrumentation industrielle (MP3I)', type: 'professionnel', description: '', places: 25,  date_limite: '2026-07-20', statut: 'ouvert', specialite: 'MP3I' },
    { id: 4, nom: 'Mastere Recherche en Genie logiciel (MRGL)',                                  type: 'recherche',     description: '', places: 111, date_limite: '2026-07-22', statut: 'ouvert', specialite: 'MRGL' },
    { id: 5, nom: 'Mastere Recherche en micro-electronique et instrumentation (MRMI)',           type: 'recherche',     description: '', places: 29,  date_limite: '2026-07-20', statut: 'ouvert', specialite: 'MRMI' },
  ];
  offresIngenieurList: OffreIngenieur[] = [];
  offresResponsableSync: OffreResponsableSync[] = [];
  isLoadingOffresResponsableSync: boolean = false;
  offresResponsableSyncMessage: string = '';
  private offresResponsableSyncFromApi: boolean = false;
  reglementReference: ReglementConcoursIngenieur | null = null;
  chapitresReglement: Array<{ key: string; label: string; value: any }> = [];
  referentielMasters: ReferentielMasters | null = null;
  isLoadingReferentielMasters: boolean = false;
  referentielMastersMessage: string = '';
  point13Message: string = '';
  isLoadingReglement: boolean = false;
  isApplyingReglement: boolean = false;
  concoursIngenieurApiAvailable: boolean = true;
  selectedConcoursIdForReglement: number | null = null;
  reglementApplyMessage: string = '';
  candidaturesList: Candidature[] = [];
  candidatureSearchTerm: string = '';
  candidatureSpecialiteFilter: string = '';
  candidatureStatutFilter: string = '';
  reportPeriod: '7j' | '30j' | 'semestre' | 'annee' = '30j';
  commissions: any[] = [];

  // Administration Système
  roles: Role[] = [
    {
      id: 1,
      nom: 'Administrateur',
      description: 'Accès complet au système',
      est_systeme: true,
      nb_utilisateurs: 3,
      nb_permissions: 50,
      permissions: [1, 2, 3, 4, 5],
    },
    {
      id: 2,
      nom: 'Responsable Commission',
      description: 'Gestion complète de sa commission',
      est_systeme: true,
      nb_utilisateurs: 5,
      nb_permissions: 35,
      permissions: [1, 2, 3],
    },
    {
      id: 3,
      nom: 'Membre Commission',
      description: 'Évaluation des candidatures',
      est_systeme: true,
      nb_utilisateurs: 25,
      nb_permissions: 15,
      permissions: [1],
    },
  ];

  permissions: Permission[] = [
    { id: 1, nom: 'Voir candidatures', module: 'Candidatures' },
    { id: 2, nom: 'Modifier candidatures', module: 'Candidatures' },
    { id: 3, nom: 'Gérer listes', module: 'Listes' },
    { id: 4, nom: 'Gérer utilisateurs', module: 'Utilisateurs' },
    { id: 5, nom: 'Configuration système', module: 'Système' },
  ];

  logs: LogEntry[] = [];

  roleColumns: Array<{ key: RoleKey; label: string }> = [
    { key: 'candidat', label: 'Candidat' },
    { key: 'commission', label: 'Commission' },
    { key: 'responsable_commission', label: 'Responsable commission' },
    { key: 'admin', label: 'Admin' },
  ];

  actionRoleMatrix: ActionMatrixRow[] = [];
  newActionName: string = '';
  newActionDescription: string = '';
  newActionRoles: Record<RoleKey, boolean> = {
    candidat: false,
    commission: false,
    responsable_commission: false,
    admin: false,
  };
  customRoleActions: string[] = [];
  private readonly knownActionNameSet = new Set<string>([
    normalizeActionLabel('Gestion des utilisateurs'),
    normalizeActionLabel('Parcours Master'),
    normalizeActionLabel("Gestion concours d'ingénieur"),
    normalizeActionLabel('Parcours Ingénieur'),
    normalizeActionLabel('Administration du site'),
    normalizeActionLabel('Rapports'),
    normalizeActionLabel('Statistique'),
  ]);

  filtresLogs: any = {
    module: '',
    action: '',
    utilisateur: '',
  };

  // Profil
  profileData: any = {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  };

  passwordForm: any = {
    current_password: '',
    new_password: '',
    confirm_password: '',
  };

  // Formulaire Master
  nouveauMaster: Master = {
    id: 0,
    nom: '',
    type: 'recherche',
    description: '',
    places: 0,
    date_limite: '',
    statut: 'ouvert',
    specialite: '',
  };

  showModalMaster: boolean = false;
  showCandidatureDetailModal: boolean = false;
  selectedCandidature: Candidature | null = null;
  showSuspendModal: boolean = false;
  suspendTargetUser: Utilisateur | null = null;
  suspensionReason: string = '';
  // kebab action menus state per master id
  private actionMenuOpen: { [id: number]: boolean } = {};

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private authService: AuthService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    const token = this.authService.getAccessToken();

    if (!token || !this.currentUser) {
      this.showAlertMessage('Session expirée. Veuillez vous reconnecter.');
      this.router.navigate(['/login-admin']);
      return;
    }

    const requestedView = this.route.snapshot.queryParamMap.get('view');
    if (requestedView) {
      this.currentView = this.resolveViewAlias(requestedView);
    }

    this.profileData = { ...this.currentUser };
    this.loadStats();
    this.loadUtilisateurs();
    this.loadMasters();
    this.loadCandidatures();
    this.loadOffresIngenieur();
    this.loadOffresResponsableSync();
    this.loadActionRoleMatrix();
    this.loadActionPermissions();
    this.loadNotifications();
  }

  toggleActionMenu(id: number): void {
    this.actionMenuOpen[id] = !this.actionMenuOpen[id];
  }

  isActionMenuOpen(id: number): boolean {
    return !!this.actionMenuOpen[id];
  }

  private loadNotifications(): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    this.http
      .get<NotificationItem[]>('http://localhost:8003/api/candidatures/mes-notifications/', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (data) => {
          this.notificationsCandidat = data || [];
          this.notificationsNonLues = this.notificationsCandidat.filter((n) => !n.lue).length;
        },
        error: (error) => {
          console.error('Erreur chargement notifications admin:', error);
          this.notificationsCandidat = [];
          this.notificationsNonLues = 0;
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
        `http://localhost:8003/api/candidatures/notifications/${notificationId}/mark-read/`,
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
          console.error('Erreur marquage notification admin:', error);
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
        'http://localhost:8003/api/candidatures/notifications/mark-all-read/',
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: (response: any) => {
          this.notificationsCandidat = this.notificationsCandidat.map((notification) => ({
            ...notification,
            lue: true,
          }));
          this.notificationsNonLues = 0;
        },
        error: (error) => {
          console.error('Erreur marquage notifications lues:', error);
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

  private loadActionPermissions(): void {
    this.authService.getMyEnabledActions().subscribe({
      next: (actions: string[]) => {
        this.customRoleActions = this.extractCustomRoleActions(actions || []);
      },
      error: () => {
        this.customRoleActions = [];
      },
    });
  }

  private extractCustomRoleActions(actions: string[]): string[] {
    const unique = new Set<string>();
    const custom: string[] = [];

    (actions || []).forEach((name) => {
      const cleaned = (name || '').trim();
      if (!cleaned) {
        return;
      }

      const normalized = normalizeActionLabel(cleaned);
      if (this.knownActionNameSet.has(normalized) || unique.has(normalized)) {
        return;
      }

      unique.add(normalized);
      custom.push(cleaned);
    });

    return custom;
  }

  // ========================================
  // NAVIGATION
  // ========================================
  switchView(view: string): void {
    this.currentView = view;
    const alias = this.buildViewQueryAlias(view);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: alias },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    if (view === 'logs') {
      this.loadLogs();
    } else if (view === 'commissions') {
      this.loadCommissions();
    } else if (view === 'notifications') {
      this.loadNotifications();
    }
  }

  openCustomRoleAction(actionName: string): void {
    this.selectedCustomActionName = actionName;
    const target = this.resolveActionTargetView(actionName);
    this.switchView(target || 'actions-personnalisees');
  }

  private resolveActionTargetView(actionName: string): string | null {
    const normalized = normalizeActionLabel(actionName);

    if (normalized.includes('utilisateur')) {
      return 'utilisateurs';
    }

    if (normalized.includes('master')) {
      return 'masters';
    }

    if (normalized.includes('concours')) {
      return 'concours-ingenieur';
    }

    if (normalized.includes('candidature')) {
      return 'candidatures';
    }

    if (
      normalized.includes('administration') ||
      normalized.includes('parametre') ||
      normalized.includes('matrice')
    ) {
      return 'parametres';
    }

    if (normalized.includes('rapport') || normalized.includes('statistique')) {
      return 'rapports';
    }

    if (normalized.includes('journal') || normalized.includes('log')) {
      return 'logs';
    }

    if (normalized.includes('profil')) {
      return 'profil';
    }

    return null;
  }

  loadCommissions(): void {
    const token = this.authService.getAccessToken();

    this.http
      .get('http://localhost:8003/api/commissions/list/', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (data: any) => {
          this.commissions = data;
        },
        error: (error) => {
          console.error('Erreur chargement commissions:', error);
        },
      });
  }

  getViewTitle(): string {
    const titles: any = {
      dashboard: 'Tableau de bord',
      analytics: 'Analytiques avancées',
      utilisateurs: 'Gestion des utilisateurs',
      masters: 'Parcours Master',
      'concours-ingenieur': 'Parcours Ingénieur',
      candidatures: 'Gestion de candidature',
      administration: 'Administration système',
      logs: "Journaux d'activité",
      parametres: 'Administration du site',
      rapports: 'Statistique',
      profil: 'Mon Profil',
      notifications: 'Notifications',
      'actions-personnalisees': 'Action personnalisée',
    };
    return titles[this.currentView] || 'Tableau de bord';
  }

  private showAlertMessage(message: string): void {
    const normalized = String(message ?? '').trim();
    const cleanMessage = normalized.replace(/[✅❌⚠️ℹ️]/g, '').trim();
    let type: 'success' | 'info' | 'warning' | 'error' = 'info';

    if (normalized.includes('✅')) {
      type = 'success';
    } else if (normalized.includes('❌')) {
      type = 'error';
    } else if (/erreur|impossible|introuvable|expir/i.test(normalized)) {
      type = 'error';
    } else if (
      /obligatoire|veuillez|aucun|aucune|invalide|fermee|fermé|attention/i.test(normalized)
    ) {
      type = 'warning';
    } else if (
      /succes|succès|enregistr|soumis|publie|publié|modifie|modifié|supprim/i.test(normalized)
    ) {
      type = 'success';
    }

    this.toastService.show(cleanMessage || 'Notification', type);
  }

  onAdminLogoError(): void {
    if (this.adminLogoSrc === '/images/logo-universite.png') {
      this.adminLogoSrc = '/images/logo-isimm.png';
      return;
    }

    if (this.adminLogoSrc === '/images/logo-isimm.png') {
      this.adminLogoSrc = '/ISIMM_LOGO.png';
    }
  }

  // ========================================
  // CHARGEMENT DONNÉES
  // ========================================
  loadStats(): void {
    const token = this.authService.getAccessToken();

    this.http
      .get('http://localhost:8001/api/auth/users/', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (users: any) => {
          this.statsData.totalUsers = users.length;
          this.statsData.membresCommission = users.filter(
            (u: any) => u.role === 'commission' || u.role === 'responsable_commission',
          ).length;
        },
        error: (error) => {
          console.error('Erreur chargement stats utilisateurs:', error);
          this.statsData.totalUsers = 1245;
          this.statsData.membresCommission = 45;
        },
      });

    this.statsData.totalCandidatures = 856;
    this.statsData.admis = 234;
  }

  loadUtilisateurs(): void {
    const token = this.authService.getAccessToken();
    const storedSuspensions = this.readStoredSuspensionDates();

    this.http
      .get('http://localhost:8001/api/auth/users/', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (users: any) => {
          this.utilisateursList = (users || []).map((user: any) => ({
            id: Number(user.id),
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            email: user.email || '',
            role: user.role || 'candidat',
            is_active: !!user.is_active,
            date_inscription: user.date_inscription || user.date_joined || new Date().toISOString(),
            suspended_since:
              user.suspended_since ||
              user.suspended_at ||
              user.date_suspension ||
              (!user.is_active ? storedSuspensions[String(user.id)] || null : null),
            suspension_reason: user.suspension_reason || null,
            suspended_by_email: user.suspended_by_email || null,
            reactivated_by_email: user.reactivated_by_email || null,
          }));
        },
        error: (error) => {
          console.error('Erreur chargement utilisateurs:', error);
          this.utilisateursList = [
            {
              id: 1,
              first_name: 'Ahmed',
              last_name: 'Ben Ali',
              email: 'ahmed@example.com',
              role: 'candidat',
              is_active: true,
              date_inscription: '2026-02-15',
              suspended_since: null,
              suspension_reason: null,
            },
            {
              id: 2,
              first_name: 'Fatma',
              last_name: 'Gharbi',
              email: 'fatma@example.com',
              role: 'commission',
              is_active: false,
              date_inscription: '2026-01-10',
              suspended_since: '2026-03-20T09:30:00',
              suspension_reason: 'Non respect du règlement administratif.',
            },
          ];
        },
      });
  }

  loadMasters(): void {
    // mastersList is already initialised as a class property with the 5 official parcours.
    // Just trigger the sync rebuild so dependent views stay consistent.
    if (!this.offresResponsableSyncFromApi) {
      this.rebuildOffresResponsableSyncFromAdminLists();
    }
  }

  loadOffresResponsableSync(): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    this.isLoadingOffresResponsableSync = true;
    this.offresResponsableSyncMessage = '';

    this.http
      .get<any[]>('http://localhost:8003/api/candidatures/offres-inscription-responsable/', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (offres) => {
          this.offresResponsableSyncFromApi = true;
          this.offresResponsableSync = (offres || []).map((offre: any) => ({
            id: Number(offre.id),
            titre: offre.titre || '',
            type: offre.type === 'cycle_ingenieur' ? 'cycle_ingenieur' : 'master',
            places: Number(offre.places ?? 0),
            date_limite: offre.date_limite || '',
            statut: offre.statut === 'ferme' ? 'ferme' : 'ouvert',
            est_cache: !!offre.est_cache,
          }));
          this.isLoadingOffresResponsableSync = false;
        },
        error: (error) => {
          console.error('Erreur chargement offres responsable sync:', error);
          this.offresResponsableSyncFromApi = false;
          this.offresResponsableSyncMessage =
            'API responsable indisponible: aperçu généré depuis les tableaux admin.';
          this.rebuildOffresResponsableSyncFromAdminLists();
          this.isLoadingOffresResponsableSync = false;
        },
      });
  }

  private rebuildOffresResponsableSyncFromAdminLists(): void {
    const mastersRows: OffreResponsableSync[] = this.mastersList.map((master) => ({
      id: Number(master.id),
      titre: master.nom,
      type: 'master',
      places: Number(master.places ?? 0),
      date_limite: master.date_limite || '',
      statut: master.statut === 'ferme' ? 'ferme' : 'ouvert',
      est_cache: false,
    }));

    const ingenieurRows: OffreResponsableSync[] = this.offresIngenieurList.map((offre) => ({
      id: Number(offre.id),
      titre: offre.titre,
      type: 'cycle_ingenieur',
      places: Number(offre.places ?? 0),
      date_limite: offre.date_limite || '',
      statut: offre.statut === 'ferme' ? 'ferme' : 'ouvert',
      est_cache: false,
    }));

    this.offresResponsableSync = [...mastersRows, ...ingenieurRows];
  }

  getOffresResponsableSyncByType(type: 'master' | 'cycle_ingenieur'): OffreResponsableSync[] {
    return this.offresResponsableSync.filter((offre) => offre.type === type);
  }

  voirMaster(master: Master): void {
    this.point13Message =
      `ℹ️ Master: ${master.nom} | Type: ${master.type} | ` +
      `Places: ${master.places} | Date limite: ${master.date_limite}`;
  }

  executerSelectionMaster(master: Master): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      this.point13Message = 'Session expirée. Veuillez vous reconnecter.';
      return;
    }

    this.http
      .post(
        `http://localhost:8003/api/candidatures/master/${master.id}/generer-listes/`,
        { iteration: 1 },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: (res: any) => {
          this.point13Message = `✅ Sélection lancée pour ${master.nom}. ${res?.message || ''}`;
        },
        error: (err) => {
          const msg = err?.error?.error || err?.error?.message || 'Erreur de sélection.';
          this.point13Message = `❌ ${msg}`;
        },
      });
  }

  verifierClotureOuRelance(master: Master): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      this.point13Message = 'Session expirée. Veuillez vous reconnecter.';
      return;
    }

    this.http
      .post(
        `http://localhost:8003/api/candidatures/master/${master.id}/cloture-ou-relance/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: (res: any) => {
          this.point13Message =
            `ℹ️ ${res?.message || 'Cloture/relance executée.'}` +
            ` (inscrits: ${res?.nb_inscrits ?? '-'}, capacité: ${res?.capacite_accueil ?? '-'})`;
        },
        error: (err) => {
          const msg = err?.error?.error || err?.error?.message || 'Erreur cloture/relance.';
          this.point13Message = `❌ ${msg}`;
        },
      });
  }

  loadReferentielMasters(): void {
    this.isLoadingReferentielMasters = true;
    this.referentielMastersMessage = '';

    this.http
      .get<ReferentielMasters>(
        'http://localhost:8003/api/candidatures/masters/reglement-reference/',
      )
      .subscribe({
        next: (data) => {
          this.referentielMasters = data;
          this.isLoadingReferentielMasters = false;
        },
        error: (err) => {
          console.error('Erreur chargement referentiel masters:', err);
          this.isLoadingReferentielMasters = false;
          this.referentielMastersMessage =
            'Impossible de charger le referentiel masters 2025/2026.';
        },
      });
  }

  getMastersReferenceCards(): Array<{ code: string; data: any }> {
    const sections = this.referentielMasters?.sections_masters || {};
    const orderedCodes = ['mpgl', 'mrgl', 'mpds'];

    return orderedCodes
      .filter((code) => !!sections[code])
      .map((code) => ({ code: code.toUpperCase(), data: sections[code] }));
  }

  formatMasterFieldLabel(key: string): string {
    return key.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  normalizeKey(key: string | number | symbol): string {
    return String(key);
  }

  joinMasterChoices(values?: string[]): string {
    return (values || []).join(', ');
  }

  loadCandidatures(): void {
    this.candidaturesList = [
      {
        id: 1,
        numero: '2603-00001-GL',
        candidat_nom: 'Ahmed Ben Ali',
        candidat_email: 'ahmed@example.com',
        master_nom: 'Master Génie Logiciel',
        specialite: 'Informatique',
        score: 16.5,
        statut: 'selectionne',
        date_soumission: '2026-02-15',
      },
      {
        id: 2,
        numero: '2603-00002-DS',
        candidat_nom: 'Fatma Gharbi',
        candidat_email: 'fatma@example.com',
        master_nom: 'Master Data Science',
        specialite: 'Informatique',
        score: 17.2,
        statut: 'en_attente',
        date_soumission: '2026-02-16',
      },
    ];
  }

  get specialitesCandidatures(): string[] {
    return Array.from(
      new Set((this.candidaturesList || []).map((c) => c.specialite || '').filter((s) => !!s)),
    ).sort((a, b) => a.localeCompare(b));
  }

  get candidaturesFiltrees(): Candidature[] {
    const search = this.candidatureSearchTerm.trim().toLowerCase();

    return (this.candidaturesList || []).filter((c) => {
      if (this.candidatureSpecialiteFilter && c.specialite !== this.candidatureSpecialiteFilter) {
        return false;
      }

      if (this.candidatureStatutFilter && c.statut !== this.candidatureStatutFilter) {
        return false;
      }

      if (!search) {
        return true;
      }

      return (
        c.numero.toLowerCase().includes(search) ||
        c.candidat_nom.toLowerCase().includes(search) ||
        c.master_nom.toLowerCase().includes(search)
      );
    });
  }

  get candidaturesSelectionneesCount(): number {
    return this.candidaturesFiltrees.filter((c) => c.statut === 'selectionne').length;
  }

  get candidaturesEnAttenteCount(): number {
    return this.candidaturesFiltrees.filter((c) => c.statut === 'en_attente').length;
  }

  get candidaturesRejeteesCount(): number {
    return this.candidaturesFiltrees.filter((c) => c.statut === 'rejete').length;
  }

  get reportStatusBreakdown(): Array<{ key: string; count: number }> {
    const counters: Record<string, number> = {
      selectionne: 0,
      en_attente: 0,
      rejete: 0,
      soumis: 0,
    };

    for (const candidature of this.candidaturesList) {
      if (typeof counters[candidature.statut] === 'number') {
        counters[candidature.statut] += 1;
      }
    }

    return Object.entries(counters).map(([key, count]) => ({ key, count }));
  }

  get reportTopMasters(): Array<{ master: string; count: number }> {
    const byMaster = new Map<string, number>();
    for (const candidature of this.candidaturesList) {
      byMaster.set(candidature.master_nom, (byMaster.get(candidature.master_nom) || 0) + 1);
    }

    return Array.from(byMaster.entries())
      .map(([master, count]) => ({ master, count }))
      .sort((a, b) => b.count - a.count);
  }

  loadLogs(): void {
    const token = this.authService.getAccessToken();

    const params: any = {};
    if (this.filtresLogs.module) params.module = this.filtresLogs.module;
    if (this.filtresLogs.action) params.action = this.filtresLogs.action;
    if (this.filtresLogs.utilisateur) params.search = this.filtresLogs.utilisateur;

    this.http
      .get('http://localhost:8001/api/admin/logs/', {
        headers: { Authorization: `Bearer ${token}` },
        params: params,
      })
      .subscribe({
        next: (data: any) => {
          this.logs = data.results || data;
        },
        error: (error) => {
          console.error('Erreur:', error);
          // Données fictives si erreur
          this.logs = [
            {
              id: 1,
              timestamp: '2026-03-22T14:30:00',
              user_name: 'Ahmed Ben Ali',
              action: 'create',
              module: 'candidatures',
              description: 'Nouvelle candidature créée',
              ip_address: '192.168.1.10',
              succes: true,
            },
            {
              id: 2,
              timestamp: '2026-03-22T14:25:00',
              user_name: 'Admin ISIMM',
              action: 'update',
              module: 'users',
              description: 'Utilisateur modifié',
              ip_address: '192.168.1.1',
              succes: true,
            },
          ];
        },
      });
  }

  // ========================================
  // GESTION UTILISATEURS
  // ========================================
  get utilisateursFiltres(): Utilisateur[] {
    const q = this.utilisateurRecherche.trim().toLowerCase();
    return this.utilisateursList.filter((user) => {
      if (this.utilisateurStatusFilter === 'active' && !user.is_active) {
        return false;
      }

      if (this.utilisateurStatusFilter === 'suspended' && user.is_active) {
        return false;
      }

      if (!q) {
        return true;
      }

      const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
      return fullName.includes(q) || user.email.toLowerCase().includes(q);
    });
  }

  get allUsersSelected(): boolean {
    const ids = this.utilisateursFiltres.map((u) => u.id);
    return ids.length > 0 && ids.every((id) => this.selectedUserIds.includes(id));
  }

  toggleAllUsers(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.checked) {
      this.selectedUserIds = this.utilisateursFiltres.map((u) => u.id);
    } else {
      this.selectedUserIds = [];
    }
  }

  toggleUserSelection(userId: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.checked) {
      if (!this.selectedUserIds.includes(userId)) {
        this.selectedUserIds.push(userId);
      }
      return;
    }

    this.selectedUserIds = this.selectedUserIds.filter((id) => id !== userId);
  }

  isUserSelected(userId: number): boolean {
    return this.selectedUserIds.includes(userId);
  }

  toggleUserMenu(userId: number): void {
    this.openUserMenuId = this.openUserMenuId === userId ? null : userId;
  }

  closeUserMenu(): void {
    this.openUserMenuId = null;
  }

  getUserInitials(user: Utilisateur): string {
    const first = (user.first_name || '').charAt(0).toUpperCase();
    const last = (user.last_name || '').charAt(0).toUpperCase();
    return `${first}${last}` || 'US';
  }

  suspendreUtilisateur(user: Utilisateur): void {
    this.suspendTargetUser = user;
    this.suspensionReason = '';
    this.showSuspendModal = true;
    this.closeUserMenu();
  }

  activerCompteUtilisateur(user: Utilisateur): void {
    this.updateUserActiveState(user, true, 'Réactivation manuelle par administrateur');
  }

  getUserStatusLabel(user: Utilisateur): string {
    return user.is_active ? 'Actif' : 'Suspendu';
  }

  confirmerSuspensionUtilisateur(): void {
    if (!this.suspendTargetUser) {
      return;
    }

    const reason = this.suspensionReason.trim();
    if (!reason) {
      this.showAlertMessage('❌ La raison de suspension est obligatoire.');
      return;
    }

    this.updateUserActiveState(this.suspendTargetUser, false, reason);
    this.fermerModalSuspend();
  }

  fermerModalSuspend(): void {
    this.showSuspendModal = false;
    this.suspendTargetUser = null;
    this.suspensionReason = '';
  }

  private updateUserActiveState(user: Utilisateur, isActive: boolean, reason: string): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      this.showAlertMessage('❌ Session expirée. Veuillez vous reconnecter.');
      return;
    }

    this.http
      .post(
        `http://localhost:8001/api/auth/users/${user.id}/account-status/`,
        { action: isActive ? 'activate' : 'suspend', reason },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: (response: any) => {
          const updatedUser = response?.user || null;
          user.is_active = isActive;
          if (isActive) {
            user.suspended_since = null;
            user.suspension_reason = null;
            user.suspended_by_email = null;
            user.reactivated_by_email =
              updatedUser?.reactivated_by_email || this.currentUser?.email || null;
            this.clearStoredSuspensionDate(user.id);
          } else {
            const now = updatedUser?.suspended_since || new Date().toISOString();
            user.suspended_since = now;
            user.suspension_reason = reason;
            user.suspended_by_email =
              updatedUser?.suspended_by_email || this.currentUser?.email || null;
            this.storeSuspensionDate(user.id, now);
          }

          this.closeUserMenu();
          this.showAlertMessage(
            isActive
              ? `✅ Compte activé pour ${user.first_name} ${user.last_name}`
              : `⛔ Compte suspendu pour ${user.first_name} ${user.last_name}`,
          );
        },
        error: (error) => {
          console.error('Erreur mise à jour statut utilisateur:', error);
          this.showAlertMessage('❌ Erreur lors de la mise à jour du compte utilisateur.');
        },
      });
  }

  private readStoredSuspensionDates(): Record<string, string> {
    try {
      const raw = localStorage.getItem(this.userSuspensionStorageKey);
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  private storeSuspensionDate(userId: number, dateIso: string): void {
    const data = this.readStoredSuspensionDates();
    data[String(userId)] = dateIso;
    localStorage.setItem(this.userSuspensionStorageKey, JSON.stringify(data));
  }

  private clearStoredSuspensionDate(userId: number): void {
    const data = this.readStoredSuspensionDates();
    delete data[String(userId)];
    localStorage.setItem(this.userSuspensionStorageKey, JSON.stringify(data));
  }

  private resolveViewAlias(requestedView: string): string {
    const aliases: Record<string, string> = {
      'parcours-master': 'masters',
      'parcours-ingenieurs': 'concours-ingenieur',
      statistique: 'rapports',
      rapports: 'rapports',
      masters: 'masters',
      'concours-ingenieur': 'concours-ingenieur',
    };

    return aliases[requestedView] || requestedView;
  }

  private buildViewQueryAlias(view: string): string {
    const map: Record<string, string> = {
      masters: 'parcours-master',
      'concours-ingenieur': 'parcours-ingenieurs',
      rapports: 'statistique',
    };

    return map[view] || view;
  }

  downloadUsersFile(): void {
    const rows: ExportRow[] = this.utilisateursFiltres.map((u) => ({
      id: u.id,
      nom: `${u.first_name} ${u.last_name}`,
      email: u.email,
      role: this.getRoleLabel(u.role),
      statut: u.is_active ? 'Actif' : 'Suspendu',
      date_inscription: u.date_inscription,
    }));

    void this.exportRows(rows, this.exportFormat, 'users-export', 'Export utilisateurs');
  }

  downloadMastersFile(): void {
    const rows: ExportRow[] = this.mastersList.map((m) => ({
      id: m.id,
      nom: m.nom,
      type: m.type,
      specialite: m.specialite,
      places: m.places,
      date_limite: m.date_limite,
      statut: m.statut,
    }));

    void this.exportRows(rows, this.mastersExportFormat, 'masters-export', 'Export masters');
  }

  downloadCandidaturesFile(): void {
    const rows: ExportRow[] = this.candidaturesFiltrees.map((c) => ({
      numero: c.numero,
      candidat: c.candidat_nom,
      email: c.candidat_email,
      master: c.master_nom,
      specialite: c.specialite,
      score: c.score,
      statut: this.getStatutLabel(c.statut),
      date_soumission: c.date_soumission,
    }));

    void this.exportRows(
      rows,
      this.candidaturesExportFormat,
      'candidatures-export',
      'Export candidatures',
    );
  }

  downloadOffresIngenieurFile(): void {
    const rows: ExportRow[] = this.offresIngenieurList.map((o) => ({
      id: o.id,
      titre: o.titre,
      type: o.type_display,
      specialite: o.specialite,
      places: o.places,
      date_limite: o.date_limite,
      statut: o.statut === 'ouvert' ? 'Ouvert' : 'Ferme',
      description: o.description,
    }));

    void this.exportRows(
      rows,
      this.offresExportFormat,
      'offres-ingenieur-export',
      'Export offres concours ingenieur',
    );
  }

  private async exportRows(
    rows: ExportRow[],
    format: ExportFormat,
    baseFileName: string,
    pdfTitle: string,
  ): Promise<void> {
    if (!rows.length) {
      this.showAlertMessage('Aucune donnée à exporter');
      return;
    }

    const headers = Object.keys(rows[0]);

    if (format === 'json') {
      const json = JSON.stringify(rows, null, 2);
      this.downloadBlob(
        json,
        this.buildExportFileName(baseFileName, 'json'),
        'application/json;charset=utf-8;',
      );
      return;
    }

    if (format === 'ods') {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');
      XLSX.writeFile(workbook, this.buildExportFileName(baseFileName, 'ods'), { bookType: 'ods' });
      return;
    }

    if (format === 'pdf') {
      await this.exportRowsToPdf(
        rows,
        headers,
        pdfTitle,
        this.buildExportFileName(baseFileName, 'pdf'),
      );
      return;
    }

    const csvRows = rows.map((row) =>
      headers.map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(','),
    );
    const csv = [headers.join(','), ...csvRows].join('\n');
    this.downloadBlob(
      csv,
      this.buildExportFileName(baseFileName, 'csv'),
      'text/csv;charset=utf-8;',
    );
  }

  private async exportRowsToPdf(
    rows: ExportRow[],
    headers: string[],
    title: string,
    fileName: string,
  ): Promise<void> {
    const doc = new jsPDF({ orientation: 'landscape' });
    const logoDataUrl = await this.loadImageAsDataUrl('/assets/images/logo-isimm.png');

    let startY = 24;
    let textX = 14;

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', 14, 8, 18, 18);
      textX = 36;
      startY = 34;
    }

    doc.setFontSize(14);
    doc.text('ISIMM', textX, 14);
    doc.setFontSize(11);
    doc.text(title, textX, 20);
    doc.setFontSize(9);
    doc.text(`Genere le ${this.getHumanReadableTimestamp()}`, 14, startY - 4);

    autoTable(doc, {
      startY,
      head: [headers.map((h) => h.replace(/_/g, ' '))],
      body: rows.map((row) => headers.map((header) => String(row[header] ?? ''))),
      styles: { fontSize: 8 },
    });

    doc.save(fileName);
  }

  private loadImageAsDataUrl(src: string): Promise<string | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  private buildExportFileName(baseFileName: string, extension: string): string {
    const now = new Date();
    const stamp = `${now.getFullYear()}-${this.pad2(now.getMonth() + 1)}-${this.pad2(now.getDate())}_${this.pad2(now.getHours())}-${this.pad2(now.getMinutes())}`;
    return `${baseFileName}-${stamp}.${extension}`;
  }

  private getHumanReadableTimestamp(): string {
    const now = new Date();
    return `${this.pad2(now.getDate())}/${this.pad2(now.getMonth() + 1)}/${now.getFullYear()} ${this.pad2(now.getHours())}:${this.pad2(now.getMinutes())}`;
  }

  private pad2(value: number): string {
    return String(value).padStart(2, '0');
  }

  private downloadBlob(content: string, fileName: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  nouvelUtilisateur(): void {
    this.showAlertMessage('Créer un nouvel utilisateur');
  }

  voirUtilisateur(user: Utilisateur): void {
    this.showAlertMessage(`Voir détails de ${user.first_name} ${user.last_name}`);
  }

  modifierUtilisateur(user: Utilisateur): void {
    this.closeUserMenu();
    this.router.navigate(['/admin/users', user.id, 'edit']);
  }

  supprimerUtilisateur(user: Utilisateur): void {
    if (confirm(`Supprimer l'utilisateur ${user.first_name} ${user.last_name} ?`)) {
      const token = this.authService.getAccessToken();

      this.http
        .delete(`http://localhost:8001/api/auth/users/${user.id}/delete/`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .subscribe({
          next: () => {
            this.showAlertMessage('✅ Utilisateur supprimé avec succès');
            this.closeUserMenu();
            this.loadUtilisateurs();
          },
          error: (error) => {
            console.error('Erreur:', error);
            this.showAlertMessage('❌ Erreur lors de la suppression');
          },
        });
    }
  }

  getRoleLabel(role: string): string {
    const labels: any = {
      admin: 'Administrateur',
      candidat: 'Candidat',
      commission: 'Membre Commission',
      responsable_commission: 'Responsable Commission',
    };
    return labels[role] || role;
  }

  // ========================================
  // GESTION OFFRES CONCOURS INGÉNIEUR
  // ========================================
  loadOffresIngenieur(): void {
    this.loadReglementReference();

    const token = this.authService.getAccessToken();
    this.http
      .get<any[]>('http://localhost:8003/api/candidatures/concours/?type_concours=ingenieur', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (items: any[]) => {
          this.concoursIngenieurApiAvailable = true;
          this.offresIngenieurList = (items || []).map((c: any) => ({
            id: c.id,
            backend_id: c.id,
            titre: c.nom,
            type: c.type_concours || c.type_cycle || c.type || 'cycle_ingenieur',
            type_display:
              c.type_concours_display ||
              c.type_cycle_display ||
              c.type_display ||
              'Cycle Ingénieur',
            specialite: c.conditions_admission?.specialite || c.description || 'Cycle Ingénieur',
            places: c.places_disponibles,
            date_limite: c.date_cloture,
            statut: c.actif ? 'ouvert' : 'ferme',
            description: c.description || '',
          }));

          if (!this.offresResponsableSyncFromApi) {
            this.rebuildOffresResponsableSyncFromAdminLists();
          }

          if (this.offresIngenieurList.length > 0 && !this.selectedConcoursIdForReglement) {
            this.selectedConcoursIdForReglement =
              this.offresIngenieurList[0].backend_id || this.offresIngenieurList[0].id;
          }
        },
        error: () => {
          this.concoursIngenieurApiAvailable = false;
          // fallback mock si l'API concours n'est pas disponible
          this.offresIngenieurList = [
            {
              id: 1,
              titre: 'Cycle Ingénieur - Informatique / Génie Logiciel',
              type: 'cycle_ingenieur',
              type_display: 'Cycle Ingénieur',
              specialite: 'Génie Logiciel',
              places: 60,
              date_limite: '2026-06-15',
              statut: 'ouvert',
              description:
                'Préinscription ouverte pour les profils Informatique et Génie Logiciel.',
            },
            {
              id: 2,
              titre: 'Cycle Ingénieur - Data Science / IA',
              type: 'cycle_ingenieur',
              type_display: 'Cycle Ingénieur',
              specialite: 'Data Science',
              places: 45,
              date_limite: '2026-06-18',
              statut: 'ouvert',
              description: 'Parcours orienté intelligence artificielle, données et analytique.',
            },
            {
              id: 3,
              titre: 'Cycle Ingénieur - Réseaux & Sécurité',
              type: 'cycle_ingenieur',
              type_display: 'Cycle Ingénieur',
              specialite: 'Réseaux et Sécurité',
              places: 40,
              date_limite: '2026-06-22',
              statut: 'ferme',
              description:
                'Admission sur dossier pour les profils réseaux, cybersécurité et systèmes.',
            },
            {
              id: 4,
              titre: 'Cycle Ingénieur - Systèmes Embarqués & IoT',
              type: 'cycle_ingenieur',
              type_display: 'Cycle Ingénieur',
              specialite: 'Systèmes embarqués',
              places: 35,
              date_limite: '2026-06-25',
              statut: 'ouvert',
              description:
                'Préinscription pour les candidats orientés électronique, IoT et embarqué.',
            },
          ];

          if (!this.offresResponsableSyncFromApi) {
            this.rebuildOffresResponsableSyncFromAdminLists();
          }
          if (!this.selectedConcoursIdForReglement) {
            this.selectedConcoursIdForReglement = this.offresIngenieurList[0].id;
          }
        },
      });

    return;

    this.offresIngenieurList = [
      {
        id: 1,
        titre: 'Cycle Ingénieur - Informatique / Génie Logiciel',
        type: 'cycle_ingenieur',
        type_display: 'Cycle Ingénieur',
        specialite: 'Génie Logiciel',
        places: 60,
        date_limite: '2026-06-15',
        statut: 'ouvert',
        description: 'Préinscription ouverte pour les profils Informatique et Génie Logiciel.',
      },
      {
        id: 2,
        titre: 'Cycle Ingénieur - Data Science / IA',
        type: 'cycle_ingenieur',
        type_display: 'Cycle Ingénieur',
        specialite: 'Data Science',
        places: 45,
        date_limite: '2026-06-18',
        statut: 'ouvert',
        description: 'Parcours orienté intelligence artificielle, données et analytique.',
      },
      {
        id: 3,
        titre: 'Cycle Ingénieur - Réseaux & Sécurité',
        type: 'cycle_ingenieur',
        type_display: 'Cycle Ingénieur',
        specialite: 'Réseaux et Sécurité',
        places: 40,
        date_limite: '2026-06-22',
        statut: 'ferme',
        description: 'Admission sur dossier pour les profils réseaux, cybersécurité et systèmes.',
      },
      {
        id: 4,
        titre: 'Cycle Ingénieur - Systèmes Embarqués & IoT',
        type: 'cycle_ingenieur',
        type_display: 'Cycle Ingénieur',
        specialite: 'Systèmes embarqués',
        places: 35,
        date_limite: '2026-06-25',
        statut: 'ouvert',
        description: 'Préinscription pour les candidats orientés électronique, IoT et embarqué.',
      },
    ];
  }

  loadReglementReference(): void {
    this.isLoadingReglement = true;
    this.reglementApplyMessage = '';

    this.http
      .get<ReglementConcoursIngenieur>(
        'http://localhost:8003/api/candidatures/concours/reglement-reference/',
      )
      .subscribe({
        next: (data) => {
          this.hydrateReglementDisplay(data);
          this.isLoadingReglement = false;
        },
        error: (err) => {
          console.error('Erreur chargement règlement:', err);
          this.isLoadingReglement = false;
          this.reglementApplyMessage = 'Impossible de charger le règlement de référence.';
        },
      });
  }

  applyReglementOfficiel(): void {
    if (!this.concoursIngenieurApiAvailable) {
      this.reglementApplyMessage =
        '❌ API concours indisponible: impossible d’appliquer le règlement sur une offre fictive.';
      this.showAlertMessage(
        '❌ API concours indisponible. Vérifiez le backend concours puis réessayez.',
      );
      return;
    }

    if (!this.selectedConcoursIdForReglement) {
      this.showAlertMessage('Veuillez sélectionner un concours ingénieur à mettre à jour.');
      return;
    }

    this.isApplyingReglement = true;
    this.reglementApplyMessage = '';

    const token = this.authService.getAccessToken();
    const payload = {
      sections_personnalisees: {},
    };

    this.http
      .put(
        `http://localhost:8003/api/candidatures/concours/${this.selectedConcoursIdForReglement}/appliquer-reglement-reference/`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: (response: any) => {
          this.hydrateReglementDisplay(response);
          this.isApplyingReglement = false;
          this.reglementApplyMessage = `✅ Règlement officiel appliqué avec succès (${this.chapitresReglement.length} chapitres affichés).`;
          this.showAlertMessage('✅ Règlement officiel appliqué au concours.');
        },
        error: (err) => {
          console.error('Erreur application règlement:', err);
          this.isApplyingReglement = false;
          const message = this.extractApiErrorMessage(err);
          this.reglementApplyMessage = `❌ ${message}`;
          this.showAlertMessage(`❌ Échec application du règlement: ${message}`);
        },
      });
  }

  private extractApiErrorMessage(err: any): string {
    const statusCode = err?.status ? `HTTP ${err.status}` : 'Erreur reseau';

    const apiMessage =
      err?.error?.error ||
      err?.error?.detail ||
      err?.error?.message ||
      (typeof err?.error === 'string' ? err.error : '');

    if (apiMessage) {
      return `${statusCode}: ${apiMessage}`;
    }

    if (statusCode === 'HTTP 401') {
      return 'HTTP 401: session expirée ou token invalide.';
    }
    if (statusCode === 'HTTP 403') {
      return 'HTTP 403: permission refusée pour ce rôle.';
    }
    if (statusCode === 'HTTP 404') {
      return 'HTTP 404: concours introuvable dans le backend.';
    }

    return `${statusCode}: erreur inconnue côté backend.`;
  }

  private buildChapitresFromReglement(
    data: ReglementConcoursIngenieur | null,
  ): Array<{ key: string; label: string; value: any }> {
    if (!data) return [];

    const rootEntries = Object.entries(data)
      .filter(([k]) => k.startsWith('chapitre_'))
      .sort((a, b) => a[0].localeCompare(b[0]));

    if (rootEntries.length > 0) {
      return rootEntries.map(([key, value]) => ({
        key,
        label: this.prettyChapitreLabel(key),
        value,
      }));
    }

    const nested = data['chapitres'];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return Object.entries(nested).map(([key, value]) => ({
        key,
        label: this.prettyChapitreLabel(key),
        value,
      }));
    }

    return [];
  }

  private prettyChapitreLabel(key: string): string {
    return key
      .replaceAll('_', ' ')
      .replace('chapitre', 'Chapitre')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private prettyFieldLabel(key: string): string {
    return key.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private stringifyInline(value: any): string {
    if (value === null || value === undefined) {
      return '-';
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => this.stringifyInline(item))
        .filter((item) => !!item)
        .join(', ');
    }

    if (typeof value === 'object') {
      return Object.entries(value)
        .map(([k, v]) => `${this.prettyFieldLabel(k)}: ${this.stringifyInline(v)}`)
        .join(' ; ');
    }

    return String(value);
  }

  formatChapitreContent(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value.map((item, index) => `${index + 1}. ${this.stringifyInline(item)}`).join('\n');
    }

    if (typeof value === 'object') {
      return Object.entries(value)
        .map(([k, v]) => `${this.prettyFieldLabel(k)}: ${this.stringifyInline(v)}`)
        .join('\n');
    }

    return String(value);
  }

  private hydrateReglementDisplay(payload: any): void {
    const source = payload?.conditions_admission ?? payload;
    this.reglementReference = source;
    this.chapitresReglement = this.buildChapitresFromReglement(source);
  }

  ajouterOffreIngenieur(): void {
    this.router.navigate(['/admin/offres-ingenieur/new']);
  }

  modifierOffreIngenieur(offre: OffreIngenieur): void {
    const targetId = offre.backend_id || offre.id;
    if (!targetId) {
      this.showAlertMessage('❌ Offre invalide');
      return;
    }
    this.router.navigate(['/admin/offres-ingenieur', targetId, 'edit']);
  }

  toggleStatutOffreIngenieur(offre: OffreIngenieur): void {
    const nextStatut = offre.statut === 'ouvert' ? 'ferme' : 'ouvert';
    const backendId = offre.backend_id || offre.id;

    if (!backendId || !this.concoursIngenieurApiAvailable) {
      offre.statut = nextStatut;
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      this.showAlertMessage('❌ Session expirée. Veuillez vous reconnecter.');
      return;
    }

    this.http
      .patch(
        `http://localhost:8003/api/candidatures/concours/${backendId}/admin/`,
        { actif: nextStatut === 'ouvert' },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: () => {
          offre.statut = nextStatut;
        },
        error: (error) => {
          console.error('Erreur changement statut offre:', error);
          this.showAlertMessage('❌ Impossible de modifier le statut de cette offre.');
        },
      });
  }

  supprimerOffreIngenieur(offre: OffreIngenieur): void {
    if (!confirm(`Supprimer l'offre "${offre.titre}" ?`)) {
      return;
    }

    const backendId = offre.backend_id || offre.id;

    if (!backendId || !this.concoursIngenieurApiAvailable) {
      this.offresIngenieurList = this.offresIngenieurList.filter((o) => o.id !== offre.id);
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      this.showAlertMessage('❌ Session expirée. Veuillez vous reconnecter.');
      return;
    }

    this.http
      .delete(`http://localhost:8003/api/candidatures/concours/${backendId}/admin/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: () => {
          this.offresIngenieurList = this.offresIngenieurList.filter(
            (o) => (o.backend_id || o.id) !== backendId,
          );
        },
        error: (error) => {
          console.error('Erreur suppression offre:', error);
          this.showAlertMessage('❌ Erreur lors de la suppression de cette offre.');
        },
      });
  }

  // ========================================
  // GESTION MASTERS
  // ========================================
  ajouterMaster(): void {
    this.router.navigate(['/admin/masters/new']);
  }

  enregistrerMaster(): void {
    if (!this.nouveauMaster.nom || !this.nouveauMaster.places || !this.nouveauMaster.date_limite) {
      this.showAlertMessage('❌ Veuillez remplir tous les champs obligatoires');
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      this.showAlertMessage('❌ Session expirée. Veuillez vous reconnecter.');
      return;
    }

    const payload = {
      nom: this.nouveauMaster.nom,
      type_master: this.nouveauMaster.type,
      description: this.nouveauMaster.description,
      specialite: this.nouveauMaster.specialite,
      places_disponibles: this.nouveauMaster.places,
      date_limite_candidature: this.nouveauMaster.date_limite,
      actif: this.nouveauMaster.statut === 'ouvert',
      annee_universitaire: '2025/2026',
    };

    if (this.nouveauMaster.id) {
      this.http
        .patch(
          `http://localhost:8003/api/candidatures/masters/${this.nouveauMaster.id}/`,
          payload,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        )
        .subscribe({
          next: () => {
            this.showAlertMessage('✅ Master modifié avec succès');
            this.showModalMaster = false;
            this.loadMasters();
          },
          error: (error) => {
            console.error('Erreur modification master:', error);
            this.showAlertMessage('❌ Erreur lors de la modification du master');
          },
        });
      return;
    }

    this.http
      .post('http://localhost:8003/api/candidatures/masters/admin/', payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: () => {
          this.showAlertMessage('✅ Master ajouté avec succès');
          this.showModalMaster = false;
          this.loadMasters();
        },
        error: (error) => {
          console.error('Erreur création master:', error);
          this.showAlertMessage('❌ Erreur lors de la création du master');
        },
      });
  }

  fermerModalMaster(): void {
    this.showModalMaster = false;
  }

  modifierMaster(master: Master): void {
    this.router.navigate(['/admin/masters', master.id, 'edit']);
  }

  supprimerMaster(master: Master): void {
    if (confirm(`Supprimer le master "${master.nom}" ?`)) {
      const token = this.authService.getAccessToken();
      if (!token) {
        this.showAlertMessage('❌ Session expirée. Veuillez vous reconnecter.');
        return;
      }

      this.http
        .delete(`http://localhost:8003/api/candidatures/masters/${master.id}/`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .subscribe({
          next: () => {
            this.showAlertMessage('✅ Master supprimé');
            this.loadMasters();
          },
          error: (error) => {
            console.error('Erreur suppression master:', error);
            this.showAlertMessage('❌ Erreur lors de la suppression du master');
          },
        });
    }
  }

  toggleStatutMaster(master: Master): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      this.showAlertMessage('❌ Session expirée. Veuillez vous reconnecter.');
      return;
    }

    const nextStatut = master.statut === 'ouvert' ? 'ferme' : 'ouvert';
    const payload = {
      nom: master.nom,
      type_master: master.type,
      description: master.description,
      specialite: master.specialite,
      places_disponibles: master.places,
      date_limite_candidature: master.date_limite,
      actif: nextStatut === 'ouvert',
      annee_universitaire: '2025/2026',
    };

    this.http
      .patch(`http://localhost:8003/api/candidatures/masters/${master.id}/`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: () => {
          // Mise à jour locale puis resynchronisation côté serveur
          master.statut = nextStatut;
          this.showAlertMessage(nextStatut === 'ouvert' ? '✅ Master ouvert' : '✅ Master fermé');
          // Recharger depuis l'API pour s'assurer que l'état est bien persistant
          this.loadMasters();
        },
        error: (error) => {
          console.error('Erreur changement statut master:', error);
          this.showAlertMessage('❌ Impossible de modifier le statut du master');
        },
      });
  }

  // ========================================
  // ADMINISTRATION SYSTÈME
  // ========================================
  creerRole(): void {
    this.showAlertMessage('Créer un nouveau rôle');
  }

  voirPermissions(role: Role): void {
    this.showAlertMessage(`Voir permissions de ${role.nom}`);
  }

  modifierRole(role: Role): void {
    this.showAlertMessage(`Modifier ${role.nom}`);
  }

  aPermission(role: Role, permission: Permission): boolean {
    return role.permissions?.includes(permission.id) || false;
  }

  togglePermission(role: Role, permission: Permission): void {
    if (role.est_systeme) {
      this.showAlertMessage('❌ Impossible de modifier un rôle système');
      return;
    }

    const token = this.authService.getAccessToken();

    this.http
      .post(
        `http://localhost:8001/api/admin/roles/${role.id}/toggle-permission/`,
        { permission_id: permission.id },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: () => {
          if (this.aPermission(role, permission)) {
            role.permissions = role.permissions!.filter((p) => p !== permission.id);
          } else {
            role.permissions!.push(permission.id);
          }
        },
        error: (error) => {
          console.error('Erreur:', error);
          this.showAlertMessage('❌ Erreur lors de la modification');
        },
      });
  }

  chargerLogs(): void {
    this.loadLogs();
  }

  // ========================================
  // CANDIDATURES
  // ========================================
  voirCandidature(candidature: Candidature): void {
    this.selectedCandidature = candidature;
    this.showCandidatureDetailModal = true;
  }

  fermerModalCandidature(): void {
    this.showCandidatureDetailModal = false;
    this.selectedCandidature = null;
  }

  getStatutLabel(statut: string): string {
    const labels: any = {
      selectionne: 'Sélectionné',
      en_attente: 'En attente',
      rejete: 'Rejeté',
      soumis: 'Soumis',
    };
    return labels[statut] || statut;
  }

  // ========================================
  // NAVIGATION PAGES DÉDIÉES
  // ========================================
  allerGestionCommission(): void {
    this.router.navigate(['/admin/gestion-commission']);
  }

  allerGestionResponsables(): void {
    this.router.navigate(['/admin/gestion-responsables']);
  }

  allerGestionConcoursIngenieur(): void {
    this.switchView('concours-ingenieur');
    this.loadReglementReference();
  }

  allerListesSelection(): void {
    this.router.navigate(['/admin/listes-selection']);
  }

  // ========================================
  // PROFIL
  // ========================================
  updateProfile(): void {
    const token = this.authService.getAccessToken();

    this.http
      .put('http://localhost:8001/api/auth/profile/update/', this.profileData, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: () => {
          this.showAlertMessage('✅ Profil mis à jour avec succès !');
          this.currentUser = { ...this.currentUser, ...this.profileData };
        },
        error: (error) => {
          console.error('Erreur:', error);
          this.showAlertMessage('❌ Erreur lors de la mise à jour du profil');
        },
      });
  }

  changePassword(): void {
    if (this.passwordForm.new_password !== this.passwordForm.confirm_password) {
      this.showAlertMessage('❌ Les mots de passe ne correspondent pas');
      return;
    }

    if (this.passwordForm.new_password.length < 8) {
      this.showAlertMessage('❌ Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    const token = this.authService.getAccessToken();

    this.http
      .post(
        'http://localhost:8001/api/auth/change-password/',
        {
          current_password: this.passwordForm.current_password,
          new_password: this.passwordForm.new_password,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: () => {
          this.showAlertMessage('✅ Mot de passe modifié avec succès !');
          this.passwordForm = {
            current_password: '',
            new_password: '',
            confirm_password: '',
          };
        },
        error: (error) => {
          console.error('Erreur:', error);
          this.showAlertMessage('❌ Erreur lors du changement de mot de passe');
        },
      });
  }

  // ========================================
  // ADMINISTRATION DU SITE (MATRICE ACTION/RÔLE)
  // ========================================
  loadActionRoleMatrix(): void {
    const token = this.authService.getAccessToken();

    this.http
      .get('http://localhost:8001/api/auth/admin/action-roles/matrix/', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (response: any) => {
          this.actionRoleMatrix = (response.actions || []).map((row: any) => ({
            action_no: row.action_no,
            action_name: row.action_name,
            description: row.description || '',
            roles: {
              candidat: !!row.roles?.candidat,
              commission: !!row.roles?.commission,
              responsable_commission: !!row.roles?.responsable_commission,
              admin: !!row.roles?.admin,
            },
          }));
        },
        error: () => {
          this.actionRoleMatrix = this.buildFallbackActionMatrix();
        },
      });
  }

  buildFallbackActionMatrix(): ActionMatrixRow[] {
    return [
      this.makeActionRow(1, 'Préinscription', { candidat: true }),
      this.makeActionRow(2, 'Dépôt de dossier', { candidat: true }),
      this.makeActionRow(3, 'Consultation de dossier', { candidat: true, commission: true }),
      this.makeActionRow(4, 'Consultation de candidature', { candidat: true, commission: true }),
      this.makeActionRow(5, 'Suivi de candidature', { candidat: true }),
      this.makeActionRow(6, 'Préselection', { commission: true, responsable_commission: true }),
      this.makeActionRow(7, 'Sélection finale', { responsable_commission: true }),
      this.makeActionRow(8, 'Gestion des utilisateurs', { admin: true }),
      this.makeActionRow(9, 'Parcours Master', { admin: true }),
      this.makeActionRow(10, 'Parcours Ingénieur', { admin: true }),
    ];
  }

  makeActionRow(
    no: number,
    name: string,
    enabled: Partial<Record<RoleKey, boolean>>,
    description: string = '',
  ): ActionMatrixRow {
    return {
      action_no: no,
      action_name: name,
      description,
      roles: {
        candidat: !!enabled.candidat,
        commission: !!enabled.commission,
        responsable_commission: !!enabled.responsable_commission,
        admin: !!enabled.admin,
      },
    };
  }

  addAction(): void {
    const actionName = this.newActionName.trim();
    if (!actionName) {
      this.showAlertMessage("Le nom d'action est obligatoire");
      return;
    }

    const nextNo = this.actionRoleMatrix.length
      ? Math.max(...this.actionRoleMatrix.map((a) => a.action_no)) + 1
      : 1;

    this.actionRoleMatrix.push({
      action_no: nextNo,
      action_name: actionName,
      description: this.newActionDescription.trim(),
      roles: {
        candidat: !!this.newActionRoles.candidat,
        commission: !!this.newActionRoles.commission,
        responsable_commission: !!this.newActionRoles.responsable_commission,
        admin: !!this.newActionRoles.admin,
      },
    });

    this.persistActionRoleMatrix();

    this.newActionName = '';
    this.newActionDescription = '';
    this.newActionRoles = {
      candidat: false,
      commission: false,
      responsable_commission: false,
      admin: false,
    };
  }

  removeAction(actionNo: number): void {
    if (!confirm('Supprimer cette action ?')) {
      return;
    }

    this.actionRoleMatrix = this.actionRoleMatrix.filter((a) => a.action_no !== actionNo);
    this.persistActionRoleMatrix();
  }

  toggleRoleForAction(action: ActionMatrixRow, role: RoleKey, event: Event): void {
    const input = event.target as HTMLInputElement;
    action.roles[role] = input.checked;
    this.persistActionRoleMatrix();
  }

  toggleNewActionRole(role: RoleKey, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.newActionRoles[role] = input.checked;
  }

  saveActionRoleMatrix(): void {
    this.persistActionRoleMatrix(true);
  }

  private persistActionRoleMatrix(showSuccessMessage: boolean = false): void {
    if (!this.actionRoleMatrix.length) {
      if (showSuccessMessage) {
        this.showAlertMessage('Ajoutez au moins une action avant de sauvegarder');
      }
      return;
    }

    const token = this.authService.getAccessToken();
    const payload = {
      actions: this.actionRoleMatrix.map((row) => ({
        action_no: row.action_no,
        action_name: row.action_name,
        description: row.description || '',
        roles: row.roles,
      })),
    };

    this.http
      .put('http://localhost:8001/api/auth/admin/action-roles/matrix/update/', payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (response: any) => {
          if (showSuccessMessage) {
            this.showAlertMessage('✅ Matrice des actions enregistrée avec succès');
          }
          this.actionRoleMatrix = (response.actions || this.actionRoleMatrix).map((row: any) => ({
            action_no: row.action_no,
            action_name: row.action_name,
            description: row.description || '',
            roles: {
              candidat: !!row.roles?.candidat,
              commission: !!row.roles?.commission,
              responsable_commission: !!row.roles?.responsable_commission,
              admin: !!row.roles?.admin,
            },
          }));
        },
        error: (error) => {
          console.error('Erreur sauvegarde matrice:', error);
          if (showSuccessMessage) {
            this.showAlertMessage("❌ Erreur lors de l'enregistrement de la matrice");
          }
        },
      });
  }

  getEnabledRoleLabels(action: ActionMatrixRow): string[] {
    return this.roleColumns.filter((r) => action.roles[r.key]).map((r) => r.label);
  }

  getRoleActions(role: RoleKey): string[] {
    return this.actionRoleMatrix.filter((a) => a.roles[role]).map((a) => a.action_name);
  }

  // ========================================
  // PARAMÈTRES & RAPPORTS
  // ========================================

  genererRapport(): void {
    const rows: ExportRow[] = this.candidaturesList.map((c) => ({
      numero: c.numero,
      candidat: c.candidat_nom,
      master: c.master_nom,
      score: c.score,
      statut: this.getStatutLabel(c.statut),
      date_soumission: c.date_soumission,
      periode: this.reportPeriod,
    }));

    void this.exportRows(
      rows,
      'pdf',
      `rapport-candidatures-${this.reportPeriod}`,
      'Rapport candidatures',
    );
  }

  exporterDonnees(): void {
    const rows: ExportRow[] = this.candidaturesList.map((c) => ({
      numero: c.numero,
      candidat: c.candidat_nom,
      email: c.candidat_email,
      master: c.master_nom,
      specialite: c.specialite,
      score: c.score,
      statut: this.getStatutLabel(c.statut),
      date_soumission: c.date_soumission,
    }));

    void this.exportRows(
      rows,
      'ods',
      `candidatures-donnees-${this.reportPeriod}`,
      'Export candidatures',
    );
  }

  exporterMetricsTxt(): void {
    const lines: string[] = [];
    const now = new Date();
    lines.push('Rapport de métriques - ISIMM');
    lines.push(`Période: ${this.reportPeriod}`);
    lines.push(`Généré le: ${now.toLocaleString()}`);
    lines.push('');

    lines.push(`Total candidatures: ${this.candidaturesList.length}`);
    lines.push(`Sélectionnées: ${this.candidaturesSelectionneesCount}`);
    lines.push(`En attente: ${this.candidaturesEnAttenteCount}`);
    lines.push(`Rejetées: ${this.candidaturesRejeteesCount}`);
    lines.push(`Score moyen: ${this.reportAverageScore.toFixed(2)}`);
    lines.push('');

    lines.push('Répartition par statut:');
    for (const item of this.reportStatusBreakdown) {
      lines.push(`- ${this.getStatutLabel(item.key)}: ${item.count}`);
    }
    lines.push('');

    lines.push('Top masters (par volume):');
    const top = this.reportTopMasters.slice(0, 10);
    for (const t of top) {
      lines.push(`- ${t.master}: ${t.count}`);
    }
    lines.push('');

    lines.push(`Utilisateurs actifs: ${this.activeUsersCount}`);
    lines.push(`Comptes suspendus: ${this.suspendedUsersCount}`);

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const filename = `isimm-metrics-${this.reportPeriod}-${now.toISOString().slice(0, 10)}.txt`;

    // Trigger download
    if (window.navigator && (window.navigator as any).msSaveOrOpenBlob) {
      // IE/Edge
      (window.navigator as any).msSaveOrOpenBlob(blob, filename);
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  getReportStatusClass(statut: string): string {
    const map: Record<string, string> = {
      selectionne: 'status-selectionne',
      en_attente: 'status-en-attente',
      rejete: 'status-rejete',
      soumis: 'status-soumis',
    };

    return map[statut] || '';
  }

  get reportAverageScore(): number {
    if (!this.candidaturesList.length) {
      return 0;
    }

    const total = this.candidaturesList.reduce(
      (sum, candidature) => sum + (candidature.score || 0),
      0,
    );
    return total / this.candidaturesList.length;
  }

  get activeUsersCount(): number {
    return this.utilisateursList.filter((user) => user.is_active).length;
  }

  get suspendedUsersCount(): number {
    return this.utilisateursList.filter((user) => !user.is_active).length;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
