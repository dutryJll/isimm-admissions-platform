import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

interface EditableUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean;
  phone?: string;
  address?: string;
}

@Component({
  selector: 'app-edit-user',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-user.html',
  styleUrl: './edit-user.css',
})
export class EditUserComponent implements OnInit {
  userId: number | null = null;
  isLoading = false;
  isSaving = false;
  errorMessage = '';
  successMessage = '';

  userForm: EditableUser = {
    id: 0,
    first_name: '',
    last_name: '',
    email: '',
    role: 'candidat',
    is_active: true,
    phone: '',
    address: '',
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
      this.errorMessage = 'Identifiant utilisateur invalide.';
      return;
    }

    this.userId = id;
    this.loadUser();
  }

  goBack(): void {
    this.router.navigate(['/admin/dashboard'], { queryParams: { view: 'utilisateurs' } });
  }

  loadUser(): void {
    if (!this.userId) {
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      this.errorMessage = 'Session invalide. Veuillez vous reconnecter.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.http
      .get<EditableUser>(`http://localhost:8001/api/auth/users/${this.userId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (user) => {
          this.userForm = {
            id: user.id,
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            email: user.email || '',
            role: user.role || 'candidat',
            is_active: !!user.is_active,
            phone: user.phone || '',
            address: user.address || '',
          };
          this.isLoading = false;
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = error?.error?.error || 'Erreur lors du chargement utilisateur.';
        },
      });
  }

  saveUser(): void {
    if (!this.userId || this.isSaving) {
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
      first_name: this.userForm.first_name,
      last_name: this.userForm.last_name,
      email: this.userForm.email,
      role: this.userForm.role,
      is_active: this.userForm.is_active,
      phone: this.userForm.phone,
      address: this.userForm.address,
    };

    this.http
      .patch<EditableUser>(`http://localhost:8001/api/auth/users/${this.userId}/`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.successMessage = 'Utilisateur mis a jour avec succes.';
        },
        error: (error) => {
          this.isSaving = false;
          this.errorMessage = error?.error?.error || 'Erreur lors de la mise a jour.';
        },
      });
  }
}
