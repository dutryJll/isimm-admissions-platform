import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { TranslatePipe } from '../../pipes/translate.pipe';

interface ReferentielMasters {
  sections_masters?: Record<string, any>;
  [key: string]: any;
}

@Component({
  selector: 'app-choix-candidature',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  templateUrl: './choix-candidature.html',
  styleUrls: ['./choix-candidature.css'],
})
export class ChoixCandidatureComponent {
  private readonly candidatureApiBase = environment.candidatureServiceUrl;
  referentielMasters: ReferentielMasters | null = null;
  selectedType: 'master' | 'ingenieur' | null = null;
  showValidationMessage: boolean = false;
  validationMessageType: 'success' | 'warning' = 'success';
  validationMessage: string = '';

  constructor(
    private router: Router,
    private http: HttpClient,
  ) {
    this.loadReferentielMasters();
  }

  loadReferentielMasters(): void {
    this.http
      .get<ReferentielMasters>(`${this.candidatureApiBase}/masters/reglement-reference/`)
      .subscribe({
        next: (data) => {
          this.referentielMasters = data;
        },
        error: (err) => {
          console.error('Erreur chargement référentiel dans choix candidature:', err);
        },
      });
  }

  getTotalPlaces(code: string): number | null {
    const total = this.referentielMasters?.sections_masters?.[code]?.capacites?.total;
    return typeof total === 'number' ? total : null;
  }

  selectType(type: 'master' | 'ingenieur'): void {
    this.selectedType = type;
    this.showValidationMessage = false;
  }

  verifierSelection(): void {
    if (!this.selectedType) {
      this.validationMessageType = 'warning';
      this.validationMessage = '⚠️ Veuillez d\'abord sélectionner un type de candidature.';
      this.showValidationMessage = true;
      return;
    }

    this.validationMessageType = 'success';
    this.validationMessage = `✓ Sélection validée : ${this.selectedType === 'master' ? 'Masters' : 'Cycle Ingénieur'}. Vous pouvez procéder à la candidature.`;
    this.showValidationMessage = true;
  }

  confirmerEtProceeder(): void {
    if (!this.selectedType) {
      this.verifierSelection();
      return;
    }

    // Proceed with selected type
    this.choisirType(this.selectedType);
  }

  choisirType(type: string): void {

    // Redirection vers les pages d'exploration des offres disponibles.
    if (type === 'master') {
      this.router.navigate(['/master/disponibles']);
      return;
    }

    if (type === 'ingenieur') {
      this.router.navigate(['/ingenieur/disponibles']);
      return;
    }

    this.router.navigate(['/choisir-candidature']);
  }
}
