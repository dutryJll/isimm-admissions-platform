import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { CandidatureService } from '../../../services/candidature.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-offer-creation-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './offer-creation-wizard.html',
  styleUrls: ['./offer-creation-wizard.css'],
})
export class OfferCreationWizardComponent implements OnInit {
  currentStep: number = 1;
  totalSteps: number = 3;

  wizardForm!: FormGroup;
  isSubmitting: boolean = false;
  successMessage: string = '';
  errorMessage: string = '';
  masterId: number | null = null;
  isEditing: boolean = false;

  // Form data storage
  formData = {
    master: null as number | null,
    titre: '',
    description: '',
    typeFormation: 'master',
    soustype: 'professionnel',
    specialite: '',

    dateDebut: '',
    dateFin: '',
    dateLimitePre: '',
    dateLimiteDep: '',
    dateLimitePaiement: '',

    capaciteAccueil: 30,
    capaciteListeAttente: 50,
    capaciteInterne: 0,
    capaciteExterne: 0,
  };

  typeFormationOptions = [
    { value: 'master', label: 'Master' },
    { value: 'ingenieur', label: 'Ingénieur' },
  ];

  sousTypeOptions = [
    { value: 'professionnel', label: 'Professionnel' },
    { value: 'recherche', label: 'Recherche' },
  ];

  specialiteOptions = [
    'Informatique',
    'Data Science',
    'Cybersécurité',
    'Ingénierie Logicielle',
    'Systèmes d\'Information',
  ];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private authService: AuthService,
    private candidatureService: CandidatureService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.initForm();

    // Check if editing an existing configuration
    this.route.params.subscribe(params => {
      if (params['master_id']) {
        this.masterId = parseInt(params['master_id']);
        this.isEditing = true;
        this.loadConfiguration();
      }
    });
  }

  initForm(): void {
    this.wizardForm = this.fb.group({
      // Step 1: Info
      master: [null],
      titre: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      typeFormation: ['master', Validators.required],
      soustype: ['professionnel', Validators.required],
      specialite: ['', Validators.required],

      // Step 2: Calendrier
      dateDebut: ['', Validators.required],
      dateFin: ['', Validators.required],
      dateLimitePre: ['', Validators.required],
      dateLimiteDep: [''],
      dateLimitePaiement: [''],

      // Step 3: Quotas
      capaciteAccueil: [30, [Validators.required, Validators.min(1)]],
      capaciteListeAttente: [50, [Validators.required, Validators.min(0)]],
      capaciteInterne: [0, [Validators.required, Validators.min(0)]],
      capaciteExterne: [0, [Validators.required, Validators.min(0)]],
    });
  }

  loadConfiguration(): void {
    if (!this.masterId) return;

    this.candidatureService.getConfiguration(this.masterId).subscribe({
      next: (config: any) => {
        this.wizardForm.patchValue({
          master: config.master,
          titre: config.titre || '',
          description: config.description || '',
          typeFormation: config.typeFormation || 'master',
          soustype: config.soustype || 'professionnel',
          specialite: config.specialite || '',
          dateDebut: config.date_debut_visibilite || '',
          dateFin: config.date_fin_visibilite || '',
          dateLimitePre: config.date_limite_preinscription || '',
          dateLimiteDep: config.date_limite_depot_dossier || '',
          dateLimitePaiement: config.date_limite_paiement || '',
          capaciteAccueil: config.capacite_accueil || 30,
          capaciteListeAttente: config.capacite_liste_attente || 50,
          capaciteInterne: config.capacite_interne || 0,
          capaciteExterne: config.capacite_externe || 0,
        });
      },
      error: (err) => {
        console.error('Error loading configuration:', err);
        this.errorMessage = 'Erreur lors du chargement de la configuration.';
      },
    });
  }

  goToStep(step: number): void {
    if (step < 1 || step > this.totalSteps) return;

    // Validate current step before proceeding
    if (step > this.currentStep && !this.isCurrentStepValid()) {
      this.errorMessage = 'Veuillez compléter les champs requis avant de continuer.';
      return;
    }

    this.currentStep = step;
    this.errorMessage = '';
  }

  isCurrentStepValid(): boolean {
    const controls: { [key: string]: string[] } = {
      1: ['titre', 'description', 'typeFormation', 'soustype', 'specialite'],
      2: ['dateDebut', 'dateFin', 'dateLimitePre'],
      3: ['capaciteAccueil'],
    };

    const fieldsToCheck = controls[this.currentStep] || [];
    return fieldsToCheck.every(field => {
      const control = this.wizardForm.get(field);
      return control && control.valid;
    });
  }

  nextStep(): void {
    if (this.currentStep < this.totalSteps && this.isCurrentStepValid()) {
      this.currentStep++;
      this.errorMessage = '';
    } else if (!this.isCurrentStepValid()) {
      this.errorMessage = 'Veuillez compléter tous les champs requis.';
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.errorMessage = '';
    }
  }

  onSubmit(): void {
    if (!this.wizardForm.valid) {
      this.errorMessage = 'Veuillez compléter tous les champs requis.';
      return;
    }

    if (!this.masterId) {
      this.errorMessage = 'Master ID non trouvé.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload = {
      master: this.masterId,
      titre: this.wizardForm.get('titre')?.value,
      description: this.wizardForm.get('description')?.value,
      typeFormation: this.wizardForm.get('typeFormation')?.value,
      soustype: this.wizardForm.get('soustype')?.value,
      specialite: this.wizardForm.get('specialite')?.value,
      date_debut_visibilite: this.wizardForm.get('dateDebut')?.value,
      date_fin_visibilite: this.wizardForm.get('dateFin')?.value,
      date_limite_preinscription: this.wizardForm.get('dateLimitePre')?.value,
      date_limite_depot_dossier: this.wizardForm.get('dateLimiteDep')?.value || null,
      date_limite_paiement: this.wizardForm.get('dateLimitePaiement')?.value || null,
      capacite_accueil: this.wizardForm.get('capaciteAccueil')?.value,
      capacite_liste_attente: this.wizardForm.get('capaciteListeAttente')?.value,
      capacite_interne: this.wizardForm.get('capaciteInterne')?.value,
      capacite_externe: this.wizardForm.get('capaciteExterne')?.value,
      actif: true,
    };

    const request = this.isEditing
      ? this.candidatureService.updateConfiguration(this.masterId, payload)
      : this.candidatureService.createConfiguration(payload);

    request.subscribe({
      next: (response: any) => {
        this.isSubmitting = false;
        this.successMessage = this.isEditing
          ? 'Configuration mise à jour avec succès!'
          : 'Offre créée avec succès!';
        setTimeout(() => {
          this.router.navigate(['/commission/dashboard']);
        }, 2000);
      },
      error: (error) => {
        this.isSubmitting = false;
        console.error('Error saving configuration:', error);
        this.errorMessage = error?.error?.detail || 'Erreur lors de la sauvegarde de la configuration.';
      },
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.wizardForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.wizardForm.get(fieldName);
    if (!field || !field.errors) return '';

    if (field.errors['required']) return 'Ce champ est requis.';
    if (field.errors['minlength']) return `Minimum ${field.errors['minlength'].requiredLength} caractères.`;
    if (field.errors['min']) return `Minimum ${field.errors['min'].min}.`;

    return 'Erreur de validation.';
  }
}
