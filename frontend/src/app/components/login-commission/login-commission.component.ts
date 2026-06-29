import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-login-commission',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './login-commission.component.html',
  styleUrl: './login-commission.component.css',
})
export class LoginCommissionComponent {
  username: string = 'responsable@isimm.tn';
  password: string = 'TestPassword123!';
  errorMessage: string = '';
  isLoading: boolean = false;

  // Forgot password
  showForgotModal = false;
  resetEmail = '';
  resetSent = false;
  isResetting = false;
  resetError = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
  ) {}

  onLogin() {
    if (!this.username || !this.password) {
      this.errorMessage = 'login.com.error.fill';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    // Le username peut Ãªtre l'email
    this.authService.login(this.username, this.password).subscribe({
      next: (response) => {
        this.isLoading = false;

        const userRole = response.user.role.toLowerCase();

        if (userRole === 'commission' || userRole === 'responsable_commission') {
          this.router.navigate(['/commission/dashboard']);
        } else {
          this.errorMessage = 'login.com.error.role';
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = 'login.com.error.invalid';
      },
    });
  }

  goBack() {
    this.router.navigate(['/login']);
  }

  openForgot(): void {
    this.resetEmail = '';
    this.resetSent = false;
    this.resetError = '';
    this.showForgotModal = true;
  }

  closeForgot(): void {
    this.showForgotModal = false;
  }

  sendPasswordReset(): void {
    if (!this.resetEmail.trim()) {
      this.resetError = 'Veuillez saisir votre adresse e-mail.';
      return;
    }
    this.isResetting = true;
    this.resetError = '';
    this.http
      .post('http://localhost:8001/api/auth/password-reset/', { email: this.resetEmail.trim() })
      .subscribe({
        next: () => {
          this.isResetting = false;
          this.resetSent = true;
        },
        error: (err) => {
          this.isResetting = false;
          this.resetError = err?.error?.error || 'Erreur lors de l\'envoi. Vérifiez l\'adresse e-mail.';
        },
      });
  }
}
