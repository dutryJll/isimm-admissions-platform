import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.css',
})
export class VerifyEmailComponent implements OnInit {
  token = '';
  state: 'loading' | 'success' | 'error' = 'loading';
  message = 'Verification de votre email en cours...';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.params['token'] || '';
    if (!this.token) {
      this.state = 'error';
      this.message = 'Lien invalide: token manquant.';
      return;
    }

    this.http.get(`http://localhost:8001/api/auth/verify-email/${this.token}/`).subscribe({
      next: (response: any) => {
        this.state = 'success';
        this.message = response?.message || 'Email verifie avec succes.';
      },
      error: (error: any) => {
        this.state = 'error';
        this.message = error?.error?.error || 'Lien invalide ou expire.';
      },
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
