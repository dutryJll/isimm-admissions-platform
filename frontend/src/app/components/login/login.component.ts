import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LanguageSelectorComponent } from '../language-selector/language-selector';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, LanguageSelectorComponent, TranslatePipe],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly isimmLogoCandidates: string[] = [
    '/images/logo-isimm.png',
    '/assets/images/logo-isimm.png',
    '/ISIMM_LOGO.png',
  ];

  private readonly universiteLogoCandidates: string[] = [
    '/images/logo-universite.png',
    '/assets/images/logo-universite.png',
    '/ISIMM_LOGO.png',
  ];

  isimmLogoSrc: string = this.isimmLogoCandidates[0];
  universiteLogoSrc: string = this.universiteLogoCandidates[0];

  private isimmLogoIndex: number = 0;
  private universiteLogoIndex: number = 0;

  constructor(private router: Router) {}

  goToEspace(type: string): void {
    switch (type) {
      case 'candidat':
        this.router.navigate(['/login-candidat']);
        break;
      case 'commission':
        this.router.navigate(['/login-commission']);
        break;
      case 'admin':
        this.router.navigate(['/login-admin']);
        break;
    }
  }

  retourAccueil(): void {
    this.router.navigate(['/']);
  }

  onIsimmLogoError(): void {
    if (this.isimmLogoIndex < this.isimmLogoCandidates.length - 1) {
      this.isimmLogoIndex += 1;
      this.isimmLogoSrc = this.isimmLogoCandidates[this.isimmLogoIndex];
    }
  }

  onUniversiteLogoError(): void {
    if (this.universiteLogoIndex < this.universiteLogoCandidates.length - 1) {
      this.universiteLogoIndex += 1;
      this.universiteLogoSrc = this.universiteLogoCandidates[this.universiteLogoIndex];
    }
  }
}
