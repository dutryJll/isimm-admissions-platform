import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="profil-page">
      <div class="profil-container">
        <div class="profil-header">
          <button class="btn-back" (click)="retour()">← Retour</button>
          <h1>Mon Profil</h1>
        </div>

        <!-- INFORMATIONS PERSONNELLES -->
        <div class="profil-section">
          <h2>📋 Informations personnelles</h2>

          <form (ngSubmit)="updateProfile()">
            <div class="form-row">
              <div class="form-group">
                <label>Prénom *</label>
                <input type="text" [(ngModel)]="user.first_name" name="first_name" required />
              </div>

              <div class="form-group">
                <label>Nom *</label>
                <input type="text" [(ngModel)]="user.last_name" name="last_name" required />
              </div>
            </div>

            <div class="form-group">
              <label>Email</label>
              <input type="email" [value]="user.email" readonly class="readonly" />
              <small>L'email ne peut pas être modifié</small>
            </div>

            <div class="form-group">
              <label>Téléphone</label>
              <input type="tel" [(ngModel)]="user.phone" name="phone" />
            </div>

            <div class="form-group">
              <label>Adresse</label>
              <textarea [(ngModel)]="user.address" name="address" rows="3"></textarea>
            </div>

            <button type="submit" class="btn-primary">💾 Enregistrer les modifications</button>
          </form>
        </div>

        <!-- MODIFICATION MOT DE PASSE -->
        <div class="profil-section">
          <h2>🔐 Modifier le mot de passe</h2>

          <form (ngSubmit)="changePassword()">
            <div class="form-group">
              <label>Mot de passe actuel *</label>
              <input
                type="password"
                [(ngModel)]="passwordForm.current_password"
                name="current_password"
                required
              />
            </div>

            <div class="form-group">
              <label>Nouveau mot de passe *</label>
              <input
                type="password"
                [(ngModel)]="passwordForm.new_password"
                name="new_password"
                required
              />
              <small>Au moins 8 caractères</small>
            </div>

            <div class="form-group">
              <label>Confirmer le nouveau mot de passe *</label>
              <input
                type="password"
                [(ngModel)]="passwordForm.confirm_password"
                name="confirm_password"
                required
              />
            </div>

            <button type="submit" class="btn-warning">🔑 Changer le mot de passe</button>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .profil-page {
        min-height: 100vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 2rem;
      }

      .profil-container {
        max-width: 800px;
        margin: 0 auto;
      }

      .profil-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 2rem;
      }

      .profil-header h1 {
        color: white;
        font-size: 2rem;
        margin: 0;
      }

      .btn-back {
        padding: 0.75rem 1.5rem;
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 2px solid white;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.3s;
      }

      .btn-back:hover {
        background: white;
        color: #667eea;
      }

      .profil-section {
        background: white;
        border-radius: 15px;
        padding: 2rem;
        margin-bottom: 1.5rem;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      }

      .profil-section h2 {
        margin: 0 0 1.5rem 0;
        color: #1f2937;
        font-size: 1.3rem;
      }

      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }

      .form-group {
        margin-bottom: 1.5rem;
      }

      .form-group label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 600;
        color: #374151;
      }

      .form-group input,
      .form-group textarea {
        width: 100%;
        padding: 0.75rem;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        font-size: 1rem;
        transition: border 0.3s;
      }

      .form-group input:focus,
      .form-group textarea:focus {
        outline: none;
        border-color: #667eea;
      }

      .form-group input.readonly {
        background: #f3f4f6;
        cursor: not-allowed;
      }

      .form-group small {
        display: block;
        margin-top: 0.25rem;
        color: #6b7280;
        font-size: 0.85rem;
      }

      .btn-primary,
      .btn-warning {
        padding: 0.75rem 2rem;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.3s;
      }

      .btn-primary {
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
      }

      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
      }

      .btn-warning {
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: white;
      }

      .btn-warning:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
      }

      @media (max-width: 768px) {
        .form-row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ProfilComponent implements OnInit {
  user: any = {
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
    role: '',
  };

  passwordForm = {
    current_password: '',
    new_password: '',
    confirm_password: '',
  };

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.user = { ...currentUser };
    }
  }

  updateProfile(): void {
    const token = this.authService.getAccessToken();

    this.http
      .put(
        'http://localhost:8001/api/auth/profile/update/',
        {
          first_name: this.user.first_name,
          last_name: this.user.last_name,
          phone: this.user.phone,
          address: this.user.address,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: (response: any) => {
          alert('✅ Profil mis à jour avec succès !');
          // Mettre à jour le localStorage
          const updatedUser = { ...this.user, ...response };
          localStorage.setItem('current_user', JSON.stringify(updatedUser));
        },
        error: (error) => {
          console.error('Erreur:', error);
          alert('❌ Erreur lors de la mise à jour du profil');
        },
      });
  }

  changePassword(): void {
    if (this.passwordForm.new_password !== this.passwordForm.confirm_password) {
      alert('❌ Les mots de passe ne correspondent pas');
      return;
    }

    if (this.passwordForm.new_password.length < 8) {
      alert('❌ Le mot de passe doit contenir au moins 8 caractères');
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
          alert('✅ Mot de passe modifié avec succès !');
          this.passwordForm = {
            current_password: '',
            new_password: '',
            confirm_password: '',
          };
        },
        error: (error) => {
          console.error('Erreur:', error);
          alert('❌ Mot de passe actuel incorrect');
        },
      });
  }

  retour(): void {
    const role = this.user.role;

    if (role === 'admin') {
      this.router.navigate(['/admin/dashboard']);
    } else if (role === 'candidat') {
      this.router.navigate(['/candidat/dashboard']);
    } else if (role === 'commission' || role === 'responsable_commission') {
      this.router.navigate(['/commission/dashboard']);
    } else {
      this.router.navigate(['/']);
    }
  }
}
