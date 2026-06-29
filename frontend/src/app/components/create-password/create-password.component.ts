import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-create-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './create-password.component.html',
  styleUrl: './create-password.component.css',
})
export class CreatePasswordComponent implements OnInit {
  token: string = '';
  password: string = '';
  confirmPassword: string = '';
  userFirstName: string = '';

  showPassword: boolean = false;
  showConfirmPassword: boolean = false;

  verification: 'loading' | 'valid' | 'invalid' = 'loading';
  loading: boolean = false;
  errorMessage: string = '';
  verificationErrorMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.params['token'];
    this.verifierToken();
  }

  verifierToken(): void {
    this.http.get(`http://localhost:8001/api/auth/verify-token/${this.token}/`).subscribe({
      next: (response: any) => {
        if (response.valid) {
          this.userFirstName = response.first_name || '';
          this.verification = 'valid';
        } else {
          this.verification = 'invalid';
          this.verificationErrorMessage =
            response?.error ||
            "Ce lien de création de mot de passe n'est plus valide. Utilisez le lien le plus récent reçu par email.";
        }
      },
      error: (error) => {
        this.verification = 'invalid';
        this.verificationErrorMessage =
          error?.error?.error ||
          "Ce lien de création de mot de passe n'est plus valide. Utilisez le lien le plus récent reçu par email.";
      },
    });
  }

  get hasMinLength(): boolean {
    return this.password.length >= 8;
  }

  get hasUpperCase(): boolean {
    return /[A-Z]/.test(this.password);
  }

  get hasLowerCase(): boolean {
    return /[a-z]/.test(this.password);
  }

  get hasNumber(): boolean {
    return /[0-9]/.test(this.password);
  }

  get hasSpecialChar(): boolean {
    return /[@$!%*?&]/.test(this.password);
  }

  isPasswordValid(): boolean {
    return (
      this.hasMinLength &&
      this.hasUpperCase &&
      this.hasLowerCase &&
      this.hasNumber &&
      this.hasSpecialChar &&
      this.password === this.confirmPassword
    );
  }

  onSubmit(): void {
    if (!this.isPasswordValid()) {
      this.errorMessage = 'Veuillez respecter toutes les règles de mot de passe';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.http
      .post(`http://localhost:8001/api/auth/set-password/${this.token}/`, {
        password: this.password,
        confirm_password: this.confirmPassword,
      })
      .subscribe({
        next: () => {
          alert('✅ Mot de passe créé avec succès !');
          this.router.navigate(['/login']);
        },
        error: (error) => {
          console.error('Erreur:', error);
          this.errorMessage = error.error?.error || 'Erreur lors de la création du mot de passe';
          this.loading = false;
        },
      });
  }
}
