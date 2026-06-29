import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CandidatureService } from '../../../services/candidature.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-inscription-online',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './inscription-online.html',
  styleUrls: ['./inscription-online.css'],
})
export class InscriptionOnlineComponent implements OnInit {
  candidatureId: number | null = null;
  candidature: any = null;
  loading = false;
  submitting = false;
  numeroInscription = '';
  errorMessage = '';
  successMessage = '';

  steps = [
    { id: 1, label: 'Sélectionné', status: 'selectionne' },
    { id: 2, label: 'Inscription en ligne', status: 'inscription_saisie' },
    { id: 3, label: 'En attente', status: 'en_attente_verification' },
    { id: 4, label: 'Inscrit confirmé', status: 'inscrit' },
  ];

  currentStep = 1;

  // ── PARTIE C : menu kebab ──────────────────────────────────────────────
  kebabOuvert: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private candidatureService: CandidatureService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((params: any) => {
      this.candidatureId = params['id'];
      if (this.candidatureId) {
        this.loadCandidature();
      }
    });
  }

  loadCandidature(): void {
    if (!this.candidatureId) return;

    this.loading = true;
    this.candidatureService.getCandidature(this.candidatureId!).subscribe({
      next: (data: any) => {
        this.candidature = data;
        this.updateCurrentStep();
        this.loading = false;
      },
      error: (err: any) => {
        this.errorMessage = 'Erreur lors du chargement de la candidature';
        this.toastService.show(this.errorMessage, 'error');
        this.loading = false;
      },
    });
  }

  updateCurrentStep(): void {
    const statut = this.candidature?.statut_inscription;
    const step = this.steps.find((s) => s.status === statut);
    this.currentStep = step ? step.id : 1;
  }

  getStepClass(stepId: number): string {
    if (stepId < this.currentStep) return 'completed';
    if (stepId === this.currentStep) return 'active';
    return 'pending';
  }

  saisirNumero(): void {
    if (!this.numeroInscription.trim()) {
      this.errorMessage = 'Veuillez entrer votre numéro d\'inscription';
      return;
    }

    if (!this.candidatureId) return;

    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.candidatureService.saisirNumeroInscription(this.candidatureId, this.numeroInscription).subscribe({
      next: (response: any) => {
        this.successMessage = response.message;
        this.toastService.show('Numéro d\'inscription enregistré', 'success');
        this.loadCandidature();
        this.submitting = false;
      },
      error: (err: any) => {
        this.errorMessage = err.error?.error || 'Erreur lors de l\'enregistrement';
        this.toastService.show(this.errorMessage, 'error');
        this.submitting = false;
      },
    });
  }

  getStepDescription(stepId: number): string {
    const descriptions: any = {
      1: 'Vous avez été sélectionné(e) par la commission',
      2: 'Saisissez votre numéro d\'inscription universitaire',
      3: 'Votre inscription est en attente de vérification',
      4: 'Votre inscription a été confirmée',
    };
    return descriptions[stepId] || '';
  }

  // ── PARTIE C : menu kebab ──────────────────────────────────────────────
  toggleKebab(id: number, event?: Event): void {
    event?.stopPropagation();
    this.kebabOuvert = this.kebabOuvert === id ? null : id;
  }

  @HostListener('document:click')
  fermerKebab(): void {
    this.kebabOuvert = null;
  }

  consulterDossier(candidature: any): void {
    this.kebabOuvert = null;
    if (!candidature?.id) return;
    this.router.navigate(['/candidat/dossier/deposer'], {
      queryParams: { candidature: candidature.id },
    });
  }

  telechargerRecu(candidature: any): void {
    this.kebabOuvert = null;
    if (!candidature?.id) {
      this.toastService.show('Candidature introuvable', 'error');
      return;
    }
    this.candidatureService.genererAttestation(candidature.id, true).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recu_inscription_${candidature.numero || candidature.id}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.toastService.show('Reçu téléchargé', 'success');
      },
      error: () => {
        this.toastService.show('Impossible de générer le reçu pour le moment', 'error');
      },
    });
  }
}
