import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { DialogService } from '../../../services/dialog.service';
import { ToastService } from '../../../services/toast.service';
import { environment } from '../../../environments/environment';

interface MembreCommission {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  specialite: string;
  grade: string;
  role: string;
  statut: string;
  date_creation: string;
}

@Component({
  selector: 'app-gestion-commission',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gestion-commission.component.html',
  styleUrl: './gestion-commission.component.css',
})
export class GestionCommissionComponent implements OnInit {
  membres: MembreCommission[] = [];
  showModal: boolean = false;
  showActionsMenu: number | null = null;
  actionsMenuStyle: { top: string; left: string; right: string; transform: string } = {
    top: '0px',
    left: '0px',
    right: 'auto',
    transform: 'none',
  };
  isUsingFallbackData: boolean = false;

  nouveauMembre = {
    first_name: '',
    last_name: '',
    email: '',
    specialite: '',
    grade: 'Maître de conférences',
    role: 'responsable_commission',
  };

  membreEnEdition: MembreCommission | null = null;
  isEditMode: boolean = false;

  specialites = [
    'Master Professionnel Génie Logiciel (MPGL)',
    'Mastère Professionnel en sciences de données (MPDS)',
    'Mastère Professionnel en Ingénieries en Instrumentation industrielle (MP3I)',
    'Mastère Recherche en Génie logiciel (MRGL)',
    'Mastère Recherche en micro-électronique et instrumentation (MRMI)',
    'Ingénieur en sciences Appliquées et Technologie : Génie Logiciel',
  ];

  grades = ['Professeur', 'Maître de conférences', 'Maître assistant', 'Assistant'];

  constructor(
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
    private dialog: DialogService,
    private toast: ToastService,
  ) {}

  /** Liste des parcours disponibles pour assigner une commission. */
  readonly parcoursOptions = [
    { value: 'MPGL', label: 'MPGL — Master Professionnel Génie Logiciel' },
    { value: 'MPDS', label: 'MPDS — Mastère Professionnel Sciences de Données' },
    { value: 'MP3I', label: 'MP3I — Mastère Professionnel 3I' },
    { value: 'MRGL', label: 'MRGL — Mastère Recherche Génie Logiciel' },
    { value: 'MRMI', label: 'MRMI — Mastère Recherche Micro-électronique' },
  ];

  ngOnInit(): void {
    const token = this.authService.getAccessToken();
    if (!token || !this.authService.getCurrentUser()) {
      alert('Session expirée. Veuillez vous reconnecter.');
      this.router.navigate(['/login-admin']);
      return;
    }

    this.loadMembres();
  }

  private mapUserToMembre(user: any): MembreCommission {
    return {
      id: user.id,
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      email: user.email ?? '',
      specialite: user.specialite ?? 'Tous les masters',
      grade: user.grade ?? 'Maître de conférences',
      role: user.role,
      statut: user.is_active ? 'actif' : 'suspendu',
      date_creation: user.date_inscription ?? '',
    };
  }

  loadMembres(): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      alert('Session expirée. Veuillez vous reconnecter.');
      this.router.navigate(['/login-admin']);
      return;
    }

    // ✅ CHARGER les membres depuis Django
    this.http
      .get<
        MembreCommission[]
      >('http://localhost:8001/api/auth/commission-members/', { headers: { Authorization: `Bearer ${token}` } })
      .subscribe({
        next: (response) => {
          this.isUsingFallbackData = false;
          this.membres = (response || []).filter(
            (membre) => membre.role === 'responsable_commission',
          );
          console.log('✅ Membres chargés depuis la base:', this.membres);
        },
        error: (error) => {
          console.error('❌ Erreur chargement membres:', error);

          if (error?.status === 401) {
            alert('Votre session admin a expiré. Merci de vous reconnecter.');
            this.authService.logout();
            this.router.navigate(['/login-admin']);
            return;
          }

          // Fallback réel: récupérer tous les utilisateurs puis filtrer les rôles commission.
          this.http
            .get<any[]>('http://localhost:8001/api/auth/users/', {
              headers: { Authorization: `Bearer ${token}` },
            })
            .subscribe({
              next: (users) => {
                const membres = (users ?? [])
                  .filter((u) => u?.role === 'responsable_commission')
                  .map((u) => this.mapUserToMembre(u));

                this.isUsingFallbackData = false;
                this.membres = membres;
                console.log('✅ Membres chargés via fallback users:', this.membres);
              },
              error: (usersError) => {
                console.error('❌ Erreur fallback users:', usersError);
                if (usersError?.status === 401) {
                  alert('Votre session admin a expiré. Merci de vous reconnecter.');
                  this.authService.logout();
                  this.router.navigate(['/login-admin']);
                  return;
                }
                this.isUsingFallbackData = true;
                this.membres = [];
              },
            });
        },
      });
  }

  ouvrirModal(): void {
    this.showModal = true;
    this.isEditMode = false;
    this.nouveauMembre = {
      first_name: '',
      last_name: '',
      email: '',
      specialite: '',
      grade: 'Maître de conférences',
      role: 'responsable_commission',
    };
  }

  fermerModal(): void {
    this.showModal = false;
    this.membreEnEdition = null;
    this.isEditMode = false;
  }

  ajouterMembre(): void {
    if (
      !this.nouveauMembre.first_name ||
      !this.nouveauMembre.last_name ||
      !this.nouveauMembre.email ||
      !this.nouveauMembre.specialite
    ) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const normalizedEmail = (this.nouveauMembre.email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      alert('Email invalide');
      return;
    }

    this.nouveauMembre.email = normalizedEmail;
    this.nouveauMembre.role = 'responsable_commission';

    const dejaMembre = this.membres.some(
      (m) => (m.email || '').trim().toLowerCase() === normalizedEmail,
    );
    if (dejaMembre) {
      alert('Cet email est déjà utilisé par un membre de commission.');
      return;
    }

    const membre: MembreCommission = {
      id: this.membres.length + 1,
      ...this.nouveauMembre,
      statut: 'actif',
      date_creation: new Date().toISOString().split('T')[0],
    };

    // ✅ ENVOYER à Django pour sauvegarde en base
    this.envoyerEmailActivation(membre);
  }

  envoyerEmailActivation(membre: MembreCommission): void {
    console.log('📧 Envoi email activation à:', membre.email);

    const token = this.authService.getAccessToken();
    if (!token) {
      alert('Session expirée. Veuillez vous reconnecter.');
      this.router.navigate(['/login-admin']);
      return;
    }

    this.http
      .get<any[]>('http://localhost:8001/api/auth/users/', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (users) => {
          const normalizedEmail = (membre.email || '').trim().toLowerCase();
          const existingUser = (users || []).find(
            (u) => ((u?.email || '') as string).trim().toLowerCase() === normalizedEmail,
          );

          if (existingUser?.role === 'admin') {
            alert(
              "Impossible d'ajouter cet email: il appartient déjà à un compte administrateur. Utilisez un autre email.",
            );
            return;
          }

          this.http
            .post(
              'http://localhost:8001/api/auth/create-commission-member/',
              {
                email: membre.email,
                first_name: membre.first_name,
                last_name: membre.last_name,
                specialite: membre.specialite,
                grade: membre.grade,
                role: 'responsable_commission',
              },
              { headers: { Authorization: `Bearer ${token}` } },
            )
            .subscribe({
              next: (response: any) => {
                console.log('✅ Membre créé en base de données:', response);
                const serverMessage = response?.message ?? '';
                alert(
                  `✅ Membre ajouté avec succès !\n\n📧 ${serverMessage || `Email d'activation envoyé à ${membre.email}`}`,
                );

                this.fermerModal();
                this.loadMembres();
              },
              error: (error) => {
                console.error('❌ Erreur:', error);

                if (error.status === 0) {
                  alert('⚠️ Backend non accessible. Vérifiez que Django tourne sur le port 8001.');
                  return;
                }

                const backendError =
                  error?.error?.error ||
                  error?.error?.message ||
                  (typeof error?.error === 'string' ? error.error : '');

                const detail =
                  backendError || error?.message || `HTTP ${error?.status || 'inconnu'}`;
                alert(`⚠️ Création du membre échouée.\n${detail}`);
              },
            });
        },
        error: (error) => {
          console.error('❌ Erreur chargement users avant création:', error);
          if (error?.status === 401) {
            alert('Votre session admin a expiré. Merci de vous reconnecter.');
            this.authService.logout();
            this.router.navigate(['/login-admin']);
            return;
          }

          alert('⚠️ Impossible de valider cet email avant création. Réessayez.');
        },
      });
  }

  toggleActionsMenu(membreId: number, event?: MouseEvent): void {
    if (this.showActionsMenu === membreId) {
      this.showActionsMenu = null;
      return;
    }

    this.showActionsMenu = membreId;

    const target = event?.currentTarget as HTMLElement | null;
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const menuWidth = 230;
    const menuHeight = 290;
    const spacing = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = rect.right - menuWidth;
    if (left + menuWidth > viewportWidth - 12) {
      left = viewportWidth - menuWidth - 12;
    }
    if (left < 12) {
      left = 12;
    }

    const openUp = rect.bottom + menuHeight + spacing > viewportHeight;
    const top = openUp ? rect.top - menuHeight - spacing : rect.bottom + spacing;

    this.actionsMenuStyle = {
      top: `${Math.max(12, top)}px`,
      left: `${left}px`,
      right: 'auto',
      transform: 'none',
    };
  }

  editerMembre(membre: MembreCommission): void {
    this.showActionsMenu = null;
    this.router.navigate(['/admin/gestion-commission', membre.id, 'edit']);
  }

  sauvegarderModification(): void {
    if (!this.membreEnEdition) return;

    const index = this.membres.findIndex((m) => m.id === this.membreEnEdition!.id);
    if (index !== -1) {
      this.membres[index] = {
        ...this.membreEnEdition,
        ...this.nouveauMembre,
      };
    }

    alert('✅ Membre modifié avec succès !');
    this.fermerModal();
  }

  suspendreMembre(membre: MembreCommission): void {
    const action = membre.statut === 'actif' ? 'suspendre' : 'activer';
    if (confirm(`Voulez-vous ${action} ${membre.first_name} ${membre.last_name} ?`)) {
      membre.statut = membre.statut === 'actif' ? 'suspendu' : 'actif';
      alert(`✅ Membre ${action === 'suspendre' ? 'suspendu' : 'activé'} avec succès`);
    }
    this.showActionsMenu = null;
  }

  async designerResponsable(membre: MembreCommission): Promise<void> {
    this.showActionsMenu = null;
    const parcoursCode = await this.dialog.prompt(
      `Assigner une commission à ${membre.first_name} ${membre.last_name}`,
      "Choisissez le parcours pour lequel cette personne sera responsable de commission.",
      {
        selectOptions: this.parcoursOptions,
        okLabel: 'Confirmer',
        variant: 'info',
      },
    );
    if (!parcoursCode) return;

    const token = this.authService.getAccessToken();
    this.http
      .patch(
        `${environment.userServiceUrl}/responsables/${membre.id}/assigner-commission/`,
        { commission: parcoursCode },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: () => {
          this.toast.show(
            `Commission ${parcoursCode} assignée à ${membre.first_name} ${membre.last_name}`,
            'success',
          );
          this.loadMembres();
        },
        error: (err) => {
          this.toast.show(
            err?.error?.error || `Échec de l'assignation de la commission ${parcoursCode}`,
            'error',
          );
        },
      });
  }

  async cloturerMandat(membre: MembreCommission): Promise<void> {
    this.showActionsMenu = null;
    const ok = await this.dialog.confirm(
      `Clôturer le mandat de ${membre.first_name} ${membre.last_name} ?`,
      "Cette action marquera son mandat comme clos. L'utilisateur conserve son accès mais ne peut plus modifier les commissions.",
      { variant: 'warning', okLabel: 'Clôturer' },
    );
    if (ok) {
      this.toast.show(
        `Le mandat de ${membre.first_name} ${membre.last_name} a été clôturé.`,
        'success',
      );
      // TODO: appel backend pour persister l'état 'mandat_clos'
    }
  }

  async supprimerMembre(membre: MembreCommission): Promise<void> {
    const ok = await this.dialog.confirm(
      `Supprimer définitivement ${membre.first_name} ${membre.last_name} ?`,
      'Cette action est irréversible.',
      { variant: 'danger', okLabel: 'Supprimer' },
    );
    if (ok) {
      // En mode fallback (backend indisponible), supprimer localement pour éviter un faux blocage UI.
      if (this.isUsingFallbackData) {
        const index = this.membres.indexOf(membre);
        if (index > -1) {
          this.membres.splice(index, 1);
        }
        this.showActionsMenu = null;
        alert('⚠️ Suppression locale uniquement (backend auth indisponible).');
        return;
      }

      const token = this.authService.getAccessToken();

      // ✅ SUPPRIMER EN BASE DE DONNÉES
      this.http
        .delete(
          `http://localhost:8001/api/auth/commission-members/${membre.id}/delete/?email=${encodeURIComponent(membre.email)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        )
        .subscribe({
          next: (response: any) => {
            console.log('✅ Membre supprimé de la base:', response);

            // ✅ Retirer du tableau local
            const index = this.membres.indexOf(membre);
            this.membres.splice(index, 1);

            alert('✅ Membre supprimé avec succès');
            this.showActionsMenu = null;
          },
          error: (error) => {
            console.error('❌ Erreur suppression:', error);
            if (error.status === 0) {
              alert('⚠️ Backend auth inaccessible. Vérifiez le service sur le port 8001.');
            } else if (error.status === 403) {
              alert('⚠️ Accès refusé: vous devez être connecté avec un compte admin.');
            } else if (error.status === 404) {
              alert('⚠️ Membre introuvable ou déjà supprimé.');
            } else if (error.error?.error) {
              alert(`⚠️ ${error.error.error}`);
            } else {
              alert('⚠️ Erreur lors de la suppression du membre');
            }
            this.showActionsMenu = null;
          },
        });
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.actions-cell')) {
      this.showActionsMenu = null;
    }
  }

  retourDashboard(): void {
    this.router.navigate(['/admin/dashboard']);
  }
}
