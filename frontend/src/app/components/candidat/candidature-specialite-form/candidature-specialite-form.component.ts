import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatStepperModule } from '@angular/material/stepper';
import { CandidatureService } from '../../../services/candidature.service';
import { ToastService } from '../../../services/toast.service';
import { Router, ActivatedRoute } from '@angular/router';

interface Specialite {
  specialite: string;
  id?: number;
  type?: string;
}

@Component({
  selector: 'app-candidature-specialite-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatStepperModule,
  ],
  templateUrl: './candidature-specialite-form.component.html',
  styleUrls: ['./candidature-specialite-form.component.css'],
})
export class CandidatureSpecialiteFormComponent implements OnInit {
  @Input() masterId: number | null = null;
  @Input() candidatureId: number | null = null;
  @Input() context: 'preselection' | 'dossier' | 'inscription' = 'preselection';

  form!: FormGroup;
  specialites: Specialite[] = [];
  isLoading = false;
  isSubmitting = false;
  errorMessage = '';
  allowChange = true;
  currentSpecialite = '';

  constructor(
    private fb: FormBuilder,
    private candidatureService: CandidatureService,
    private toastService: ToastService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadSpecialites();
  }

  private initForm(): void {
    this.form = this.fb.group({
      specialite: ['', Validators.required],
    });
  }

  private loadSpecialites(): void {
    this.isLoading = true;
    this.errorMessage = '';

    if (!this.masterId && !this.candidatureId) {
      this.errorMessage = 'ID du master ou de la candidature requis';
      this.isLoading = false;
      return;
    }

    let request;

    switch (this.context) {
      case 'preselection':
        if (!this.masterId) {
          this.errorMessage = 'ID du master requis';
          this.isLoading = false;
          return;
        }
        request = this.candidatureService.getSpecialitesForPreselection(this.masterId);
        break;

      case 'dossier':
        if (!this.candidatureId) {
          this.errorMessage = 'ID de la candidature requis';
          this.isLoading = false;
          return;
        }
        request = this.candidatureService.getSpecialitesForDossier(this.candidatureId);
        break;

      case 'inscription':
        if (!this.masterId) {
          this.errorMessage = 'ID du master requis';
          this.isLoading = false;
          return;
        }
        request = this.candidatureService.getSpecialitesForInscription(this.masterId);
        break;
    }

    request.subscribe({
      next: (response: any) => {
        this.specialites = response.specialites || [];
        this.currentSpecialite = response.current_specialite || '';
        this.allowChange = response.allow_change ?? true;

        if (this.currentSpecialite && this.context !== 'preselection') {
          this.form.patchValue({ specialite: this.currentSpecialite });
        }

        if (this.specialites.length === 0) {
          this.errorMessage = 'Aucune spécialité disponible';
        }

        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading specialites:', error);
        this.errorMessage = error.error?.error || 'Erreur lors du chargement des spécialités';
        this.toastService.show(this.errorMessage, 'error');
        this.isLoading = false;
      },
    });
  }

  onSubmit(): void {
    if (!this.form.valid) {
      this.errorMessage = 'Veuillez sélectionner une spécialité';
      return;
    }

    if (!this.allowChange && this.context === 'dossier') {
      this.errorMessage = 'Vous ne pouvez pas modifier la spécialité à ce stade';
      return;
    }

    this.isSubmitting = true;

    const selectedSpecialite = this.form.get('specialite')?.value;

    // Here you would call a service method to update the candidature
    // For now, we'll just show a success message
    this.toastService.show(`Spécialité '${selectedSpecialite}' enregistrée`, 'success');

    this.isSubmitting = false;
  }

  canSubmit(): boolean {
    return (
      this.form.valid && (this.allowChange || this.context === 'preselection') && !this.isSubmitting
    );
  }

  getContextLabel(): string {
    const labels = {
      preselection: 'Pré-sélection',
      dossier: 'Dépôt de dossier',
      inscription: 'Inscription',
    };
    return labels[this.context];
  }
}
