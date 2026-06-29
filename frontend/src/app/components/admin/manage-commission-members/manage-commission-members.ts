import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommissionService } from '../../../services/commission';
import { UserService } from '../../../services/user.service';
import { ToastService } from '../../../services/toast.service';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';

interface MembreCommission {
  id: number;
  user_id: number;
  user_email: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  commission: number;
  role: string;
  date_nomination: string;
  actif: boolean;
}

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

@Component({
  selector: 'app-manage-commission-members',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manage-commission-members.html',
  styleUrl: './manage-commission-members.css',
})
export class ManageCommissionMembersComponent implements OnInit {
  private authApiUrl = environment.authServiceUrl;

  commissionId: number | null = null;
  commissionName: string = '';
  membres: MembreCommission[] = [];
  availableUsers: User[] = [];

  isLoadingMembers: boolean = false;
  isLoadingUsers: boolean = false;
  isAddingMember: boolean = false;
  isCreatingMember: boolean = false;

  selectedUserId: number | null = null;
  selectedRole: string = 'membre';
  searchUserTerm: string = '';
  filteredUsers: User[] = [];
  memberEnEdition: MembreCommission | null = null;
  showEditModal = false;
  isSavingMember = false;

  nouveauMembre = {
    first_name: '',
    last_name: '',
    email: '',
    specialite: 'Tous les masters',
    grade: 'Maître de conférences',
  };

  errorMessage: string = '';
  successMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private commissionService: CommissionService,
    private userService: UserService,
    private toast: ToastService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    // Get commission ID from route params or query param
    this.route.params.subscribe(params => {
      if (params['commission_id']) {
        this.commissionId = parseInt(params['commission_id']);
        this.loadMembers();
      }
    });

    // Fallback: check query params
    if (!this.commissionId) {
      this.route.queryParams.subscribe(params => {
        if (params['commission_id']) {
          this.commissionId = parseInt(params['commission_id']);
          this.loadMembers();
        }
      });
    }
  }

  loadMembers(): void {
    if (!this.commissionId) return;

    this.isLoadingMembers = true;
    this.errorMessage = '';

    this.commissionService.listCommissionMembers(this.commissionId).subscribe(
      (data) => {
        this.membres = data;
        this.isLoadingMembers = false;
      },
      (error) => {
        console.error('Erreur chargement membres:', error);
        this.errorMessage = 'Impossible de charger les membres de la commission.';
        this.isLoadingMembers = false;
      }
    );
  }

  loadAvailableUsers(): void {
    this.isLoadingUsers = true;
    this.userService.getUsers().subscribe(
      (data) => {
        this.availableUsers = data;
        this.filteredUsers = data;
        this.isLoadingUsers = false;
      },
      (error) => {
        console.error('Erreur chargement utilisateurs:', error);
        this.errorMessage = 'Impossible de charger la liste des utilisateurs.';
        this.isLoadingUsers = false;
      }
    );
  }

  filterUsers(): void {
    const term = this.searchUserTerm.toLowerCase().trim();
    if (!term) {
      this.filteredUsers = this.availableUsers;
      return;
    }

    this.filteredUsers = this.availableUsers.filter(
      u =>
        u.email.toLowerCase().includes(term) ||
        u.first_name.toLowerCase().includes(term) ||
        u.last_name.toLowerCase().includes(term) ||
        u.username.toLowerCase().includes(term)
    );
  }

  onSearchChange(): void {
    this.filterUsers();
  }

  selectUser(userId: number): void {
    this.selectedUserId = userId;
  }

  addMember(): void {
    if (!this.commissionId || !this.selectedUserId) {
      this.errorMessage = 'Veuillez sélectionner un utilisateur.';
      return;
    }

    this.isAddingMember = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.commissionService
      .addCommissionMember(this.commissionId, this.selectedUserId, 'membre')
      .subscribe(
        (data) => {
          this.successMessage = 'Membre ajouté avec succès.';
          this.toast.show('Membre ajouté avec succès', 'success');
          this.loadMembers();
          this.selectedUserId = null;
          this.selectedRole = 'membre';
          this.searchUserTerm = '';
          this.filteredUsers = [];
          this.isAddingMember = false;
        },
        (error) => {
          console.error('Erreur ajout membre:', error);
          this.errorMessage =
            error.error?.detail || 'Impossible d\'ajouter le membre à la commission.';
          this.isAddingMember = false;
        }
      );
  }

  createAndAddMember(): void {
    if (!this.commissionId) {
      this.errorMessage = 'Commission introuvable.';
      return;
    }

    const firstName = (this.nouveauMembre.first_name || '').trim();
    const lastName = (this.nouveauMembre.last_name || '').trim();
    const email = (this.nouveauMembre.email || '').trim().toLowerCase();

    if (!firstName || !lastName || !email) {
      this.errorMessage = 'Prénom, nom et email sont obligatoires.';
      return;
    }

    this.isCreatingMember = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload = {
      email,
      first_name: firstName,
      last_name: lastName,
      specialite: this.nouveauMembre.specialite || 'Tous les masters',
      grade: this.nouveauMembre.grade || 'Maître de conférences',
      role: 'commission',
    };

    this.http.post<any>(`${this.authApiUrl}/create-commission-member/`, payload).subscribe({
      next: (response) => {
        const userId = Number(response?.user_id);

        if (!Number.isFinite(userId) || userId <= 0) {
          this.isCreatingMember = false;
          this.errorMessage = 'Utilisateur créé, mais identifiant invalide pour la commission.';
          return;
        }

        this.commissionService.addCommissionMember(this.commissionId!, userId, 'membre').subscribe({
          next: () => {
            this.successMessage = 'Membre créé, ajouté à la commission et email envoyé.';
            this.toast.show('Membre créé et affecté avec succès', 'success');
            this.loadMembers();
            this.nouveauMembre = {
              first_name: '',
              last_name: '',
              email: '',
              specialite: 'Tous les masters',
              grade: 'Maître de conférences',
            };
            this.isCreatingMember = false;
          },
          error: (error) => {
            console.error('Erreur affectation commission:', error);
            this.errorMessage =
              error?.error?.detail ||
              'Membre créé, mais impossible de l\'affecter à la commission automatiquement.';
            this.isCreatingMember = false;
          },
        });
      },
      error: (error) => {
        console.error('Erreur création membre:', error);
        this.errorMessage =
          error?.error?.error || error?.error?.message || 'Impossible de créer le membre.';
        this.isCreatingMember = false;
      },
    });
  }

  ouvrirEditionMembre(membre: MembreCommission): void {
    this.memberEnEdition = membre;
    this.showEditModal = true;
  }

  fermerEditionMembre(): void {
    this.memberEnEdition = null;
    this.showEditModal = false;
    this.isSavingMember = false;
  }

  sauvegarderMembre(): void {
    if (!this.memberEnEdition) {
      return;
    }

    const firstName = (this.memberEnEdition.first_name || '').trim();
    const lastName = (this.memberEnEdition.last_name || '').trim();
    const email = (this.memberEnEdition.email || '').trim().toLowerCase();

    if (!firstName || !lastName || !email) {
      this.errorMessage = 'Prénom, nom et email sont obligatoires.';
      return;
    }

    this.isSavingMember = true;
    this.errorMessage = '';
    this.successMessage = '';

    const token = this.authService.getAccessToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    this.http
      .patch<any>(
        `${this.authApiUrl}/users/${this.memberEnEdition.id}/`,
        {
          first_name: firstName,
          last_name: lastName,
          email,
          username: email,
          role: 'commission',
        },
        { headers },
      )
      .subscribe({
        next: () => {
          this.successMessage = 'Membre modifié avec succès.';
          this.toast.show('Membre modifié avec succès', 'success');
          this.fermerEditionMembre();
          this.loadMembers();
        },
        error: (error) => {
          console.error('Erreur modification membre:', error);
          this.errorMessage = error?.error?.error || 'Impossible de modifier le membre.';
          this.isSavingMember = false;
        },
      });
  }

  removeMember(membreId: number): void {
    if (!this.commissionId) return;

    if (!confirm('Êtes-vous sûr de vouloir supprimer ce membre ?')) {
      return;
    }

    this.commissionService.removeCommissionMember(this.commissionId, membreId).subscribe(
      () => {
        this.successMessage = 'Membre supprimé avec succès.';
        this.toast.show('Membre supprimé avec succès', 'success');
        this.loadMembers();
      },
      (error) => {
        console.error('Erreur suppression membre:', error);
        this.errorMessage = 'Impossible de supprimer le membre.';
      }
    );
  }

  estMembreCommission(membre: MembreCommission): boolean {
    return membre.role === 'commission' || membre.role === 'responsable_commission';
  }

  goBack(): void {
    const role = this.authService.getCurrentUser()?.role;
    if (role === 'responsable_commission') {
      this.router.navigate(['/commission/dashboard']);
      return;
    }

    this.router.navigate(['/admin/gestion-commission']);
  }
}
