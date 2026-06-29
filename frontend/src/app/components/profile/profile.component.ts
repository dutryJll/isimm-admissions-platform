import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="profil-container">
      <h2>Mon Profil</h2>

      <form (ngSubmit)="onSave()">
        <div class="form-group">
          <label>Email</label>
          <input type="email" [(ngModel)]="user.email" name="email" readonly />
        </div>

        <div class="form-group">
          <label>Prénom</label>
          <input type="text" [(ngModel)]="user.first_name" name="first_name" />
        </div>

        <div class="form-group">
          <label>Nom</label>
          <input type="text" [(ngModel)]="user.last_name" name="last_name" />
        </div>

        <div class="form-group">
          <label>Téléphone</label>
          <input type="tel" [(ngModel)]="user.phone" name="phone" />
        </div>

        <div class="form-group">
          <label>Adresse</label>
          <textarea [(ngModel)]="user.address" name="address"></textarea>
        </div>

        <button type="submit" [disabled]="isLoading">
          {{ isLoading ? 'Enregistrement...' : 'Enregistrer' }}
        </button>

        <p *ngIf="successMessage" class="success">{{ successMessage }}</p>
        <p *ngIf="errorMessage" class="error">{{ errorMessage }}</p>
      </form>
    </div>
  `,
  styles: [
    `
      .profil-container {
        max-width: 600px;
        margin: 2rem auto;
        padding: 2rem;
        background: white;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      }
      .form-group {
        margin-bottom: 1rem;
      }
      label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: bold;
      }
      input,
      textarea {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 5px;
      }
      button {
        padding: 0.75rem 2rem;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
      }
      button:disabled {
        background: #ccc;
      }
      .success {
        color: green;
      }
      .error {
        color: red;
      }
    `,
  ],
})
export class ProfilComponent implements OnInit {
  user: any = {};
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    this.user = this.authService.getCurrentUser();
  }

  onSave() {
    this.isLoading = true;
    this.successMessage = '';
    this.errorMessage = '';

    const token = this.authService.getAccessToken();

    this.http
      .put('http://localhost:8001/api/auth/profile/update/', this.user, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (response: any) => {
          this.isLoading = false;
          this.successMessage = 'Profil mis à jour !';
          localStorage.setItem('current_user', JSON.stringify(response.user));
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = 'Erreur lors de la mise à jour';
        },
      });
  }
}
