import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
})
export class ForgotPasswordComponent {
  email: string = '';
  successMessage: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;

  constructor(private http: HttpClient) {}

  onSubmit() {
    if (!this.email) {
      this.errorMessage = 'Veuillez entrer votre adresse email';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.http
      .post(`${environment.authServiceUrl}/password-reset/`, { email: this.email })
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.successMessage = 'Un email de réinitialisation a été envoyé à ' + this.email;
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = "Email non trouvé ou erreur lors de l'envoi";
          console.error('Erreur:', error);
        },
      });
  }
}
