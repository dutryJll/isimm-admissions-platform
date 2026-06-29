import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
})
export class ResetPasswordComponent implements OnInit {
  token: string = '';
  password: string = '';
  password2: string = '';
  successMessage: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    this.token =
      this.route.snapshot.paramMap.get('token') ||
      this.route.snapshot.queryParamMap.get('token') ||
      '';
    if (!this.token) {
      this.errorMessage = 'Token invalide ou manquant. Utilisez le lien reçu par email.';
    }
  }

  onSubmit() {
    if (!this.password || !this.password2) {
      this.errorMessage = 'Veuillez remplir tous les champs';
      return;
    }

    if (this.password !== this.password2) {
      this.errorMessage = 'Les mots de passe ne correspondent pas';
      return;
    }

    if (this.password.length < 8) {
      this.errorMessage = 'Le mot de passe doit contenir au moins 8 caractères';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.http
      .post(`${environment.authServiceUrl}/password-reset/confirm/`, {
        token: this.token,
        password: this.password,
      })
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.successMessage = 'Votre mot de passe a été réinitialisé avec succès !';
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = 'Erreur lors de la réinitialisation. Le lien a peut-être expiré.';
          console.error('Erreur:', error);
        },
      });
  }
}
