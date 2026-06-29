import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

interface MemberForm {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  specialite: string;
  grade: string;
  role: 'commission' | 'responsable_commission';
}

@Component({
  selector: 'app-edit-commission-member',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-commission-member.html',
  styleUrl: './edit-commission-member.css',
})
export class EditCommissionMemberComponent implements OnInit {
  memberId: number | null = null;
  isLoading = false;
  isSaving = false;
  errorMessage = '';
  successMessage = '';

  specialites: string[] = [
    'Master Professionnel Génie Logiciel (MPGL)',
    'Mastère Professionnel en sciences de données (MPDS)',
    'Mastère Professionnel en Ingénieries en Instrumentation industrielle (MP3I)',
    'Mastère Recherche en Génie logiciel (MRGL)',
    'Mastère Recherche en micro-électronique et instrumentation (MRMI)',
    'Ingénieur en sciences Appliquées et Technologie : Génie Logiciel',
  ];

  grades: string[] = ['Professeur', 'Maître de conférences', 'Maître assistant', 'Assistant'];

  memberForm: MemberForm = {
    id: 0,
    first_name: '',
    last_name: '',
    email: '',
    specialite: 'Tous les masters',
    grade: 'Maître de conférences',
    role: 'commission',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id || Number.isNaN(id)) {
      this.errorMessage = 'Identifiant membre invalide.';
      return;
    }

    this.memberId = id;
    this.loadMember();
  }

  goBack(): void {
    this.router.navigate(['/admin/gestion-commission']);
  }

  loadMember(): void {
    if (!this.memberId) {
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      this.errorMessage = 'Session invalide. Veuillez vous reconnecter.';
      return;
    }

    this.isLoading = true;

    this.http
      .get<any[]>('http://localhost:8001/api/auth/commission-members/', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (members) => {
          const member = (members || []).find((m) => Number(m.id) === this.memberId);
          if (!member) {
            this.errorMessage = 'Membre introuvable.';
            this.isLoading = false;
            return;
          }

          this.memberForm = {
            id: Number(member.id),
            first_name: member.first_name || '',
            last_name: member.last_name || '',
            email: member.email || '',
            specialite: member.specialite || 'Tous les masters',
            grade: member.grade || 'Maître de conférences',
            role:
              member.role === 'responsable_commission' ? 'responsable_commission' : 'commission',
          };
          this.isLoading = false;
        },
        error: () => {
          this.errorMessage = 'Erreur lors du chargement du membre.';
          this.isLoading = false;
        },
      });
  }

  saveMember(): void {
    if (!this.memberId || this.isSaving) {
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      this.errorMessage = 'Session invalide. Veuillez vous reconnecter.';
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload = {
      first_name: this.memberForm.first_name,
      last_name: this.memberForm.last_name,
      email: this.memberForm.email,
      role: this.memberForm.role,
    };

    this.http
      .patch(`http://localhost:8001/api/auth/users/${this.memberId}/`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.successMessage = 'Membre modifie avec succes.';
        },
        error: (error) => {
          this.isSaving = false;
          this.errorMessage = error?.error?.error || 'Erreur lors de la modification du membre.';
        },
      });
  }
}
