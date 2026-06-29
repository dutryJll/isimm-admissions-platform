import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';

interface Responsable {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

@Component({
  selector: 'app-manage-responsables',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './manage-responsables.html',
  styleUrls: ['./manage-responsables.css'],
})
export class ManageResponsablesComponent implements OnInit {
  responsablesList: Responsable[] = [];
  isLoading: boolean = false;
  isSubmitting: boolean = false;
  successMessage: string = '';
  errorMessage: string = '';
  searchTerm: string = '';
  showAddForm: boolean = false;

  addForm!: FormGroup;
  deleteConfirmId: number | null = null;
  deleteConfirmName: string = '';

  apiUrl = environment.userServiceUrl;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadResponsables();
  }

  initForm(): void {
    this.addForm = this.fb.group({
      first_name: ['', [Validators.required, Validators.minLength(2)]],
      last_name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  private getHeaders(): any {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  loadResponsables(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.http.get<any>(`${this.apiUrl}/admin/responsables/list/`, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        this.responsablesList = response.responsables || [];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading responsables:', error);
        this.errorMessage = error?.error?.detail || 'Erreur lors du chargement des responsables.';
        this.isLoading = false;
      },
    });
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.addForm.reset();
      this.errorMessage = '';
      this.successMessage = '';
    }
  }

  onSubmitAdd(): void {
    if (!this.addForm.valid) {
      this.errorMessage = 'Veuillez remplir tous les champs correctement.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const payload = {
      first_name: this.addForm.get('first_name')?.value,
      last_name: this.addForm.get('last_name')?.value,
      email: this.addForm.get('email')?.value,
      password: this.addForm.get('password')?.value,
      role: 'responsable_commission',
    };

    this.http.post<any>(`${this.apiUrl}/admin/responsables/create/`, payload, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.successMessage = 'Responsable créé avec succès!';
        this.addForm.reset();
        this.showAddForm = false;
        this.loadResponsables();
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (error) => {
        this.isSubmitting = false;
        console.error('Error creating responsable:', error);
        this.errorMessage = error?.error?.detail || 'Erreur lors de la création du responsable.';
      },
    });
  }

  openDeleteConfirm(responsable: Responsable): void {
    this.deleteConfirmId = responsable.id;
    this.deleteConfirmName = `${responsable.first_name} ${responsable.last_name}`;
  }

  cancelDelete(): void {
    this.deleteConfirmId = null;
    this.deleteConfirmName = '';
  }

  confirmDelete(): void {
    if (!this.deleteConfirmId) return;

    this.isSubmitting = true;
    this.errorMessage = '';

    this.http.delete<any>(`${this.apiUrl}/admin/responsables/${this.deleteConfirmId}/delete/`, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.successMessage = 'Responsable supprimé avec succès!';
        this.cancelDelete();
        this.loadResponsables();
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (error) => {
        this.isSubmitting = false;
        console.error('Error deleting responsable:', error);
        this.errorMessage = error?.error?.detail || 'Erreur lors de la suppression du responsable.';
      },
    });
  }

  get filteredResponsables(): Responsable[] {
    if (!this.searchTerm) return this.responsablesList;

    const search = this.searchTerm.toLowerCase();
    return this.responsablesList.filter(r =>
      r.first_name.toLowerCase().includes(search) ||
      r.last_name.toLowerCase().includes(search) ||
      r.email.toLowerCase().includes(search),
    );
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.addForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.addForm.get(fieldName);
    if (!field || !field.errors) return '';

    if (field.errors['required']) return 'Ce champ est requis.';
    if (field.errors['minlength']) return `Minimum ${field.errors['minlength'].requiredLength} caractères.`;
    if (field.errors['email']) return 'Email invalide.';

    return 'Erreur de validation.';
  }

  goBack(): void {
    this.router.navigate(['/admin/dashboard']);
  }
}
