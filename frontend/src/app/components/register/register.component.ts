import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  userData = {
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    numero_inscription_universitaire: '',
    password: '',
    password2: '',
    role: 'candidat',
  };

  errorMessage: string = '';
  successMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  onRegister() {
    // Validation
    if (
      !this.userData.first_name ||
      !this.userData.last_name ||
      !this.userData.email ||
      !this.userData.username ||
      !this.userData.numero_inscription_universitaire ||
      !this.userData.password ||
      !this.userData.password2
    ) {
      this.errorMessage = 'Veuillez remplir tous les champs, y compris le numéro d’inscription';
      return;
    }

    if (this.userData.password !== this.userData.password2) {
      this.errorMessage = 'Les mots de passe ne correspondent pas';
      return;
    }

    if (this.userData.password.length < 8) {
      this.errorMessage = 'Le mot de passe doit contenir au moins 8 caractères';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.register(this.userData).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.successMessage =
          '✅ Compte créé avec succès ! Vérifiez votre email pour activer votre compte.';

        // Rediriger vers login après 3 secondes
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (error) => {
        console.error('❌ Erreur inscription:', error);
        this.isLoading = false;

        if (error.error?.email) {
          this.errorMessage = 'Cet email est déjà utilisé';
        } else if (error.error?.username) {
          this.errorMessage = "Ce nom d'utilisateur est déjà pris";
        } else if (error.error?.password) {
          this.errorMessage = error.error.password[0];
        } else {
          this.errorMessage = "Une erreur est survenue lors de l'inscription";
        }
      },
    });
  }
}
