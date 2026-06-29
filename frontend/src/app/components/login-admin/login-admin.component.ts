import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-login-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './login-admin.component.html',
  styleUrl: './login-admin.component.css',
})
export class LoginAdminComponent {
  email: string = '';
  password: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  onLogin() {
    if (!this.email || !this.password) {
      this.errorMessage = 'login.admin.error.fill';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.email, this.password).subscribe({
      next: (response) => {
        this.isLoading = false;

        const userRole = response.user.role.toLowerCase();

        if (userRole === 'admin') {
          this.router.navigate(['/admin/dashboard']);
        } else {
          this.errorMessage = 'login.admin.error.role';
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = 'login.admin.error.invalid';
      },
    });
  }

  goBack() {
    this.router.navigate(['/login']);
  }
}
