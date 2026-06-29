import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CandidatureService } from '../../../services/candidature.service';
import { ToastService } from '../../../services/toast.service';
import { AuthService } from '../../../services/auth.service';

const SPECS: Record<string, string[]> = {
  'licence-lmd': [
    "Licence en Sciences de l'Informatique — Génie Logiciel",
    'Licence en Mathématiques Appliquées',
    'Informatique de Gestion',
    'Big Data et Analyse de données',
    'Business Computing',
    'Mathématique appliquée — Science de données',
    "Licence appliquée en développement des SI",
  ],
  'licence-ar': ['Licence Informatique (Ancien Régime)', 'Licence Mathématiques (Ancien Régime)'],
  maitrise: ['Maîtrise en Informatique', 'Maîtrise en Mathématiques'],
  ingenieur: ['Génie Logiciel', 'Génie Électrique', 'Génie Industriel'],
};

const PARCOURS_OPTS = [
  { value: 'MPGL', label: 'Master Professionnel Génie Logiciel (MPGL)' },
  { value: 'MPDS', label: 'Master Professionnel Data Science (MPDS)' },
  { value: 'MP3I', label: 'Master Professionnel Instrumentation (MP3I)' },
  { value: 'MRGL', label: 'Master Recherche Génie Logiciel (MRGL)' },
  { value: 'MRMI', label: 'Master Recherche Micro-électronique (MRMI)' },
];

@Component({
  selector: 'app-modifier-candidature',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './modifier-candidature.html',
  styleUrl: './modifier-candidature.css',
})
export class ModifierCandidatureComponent implements OnInit {
  candidature: any = null;
  selectedCandidatureId: number | null = null;
  candidatureAccessInfo: any = null;
  isLoading = true;
  isSaving = false;

  // Step management — Vœux et Documents retirés (demande utilisateur).
  // Le candidat peut soumettre directement après Informations + Diplôme.
  readonly steps = [1, 2];
  readonly stepLabels: Record<number, string> = {
    1: 'Informations personnelles',
    2: 'Diplôme & Formation',
  };
  currentStep = 1;
  stepProgress: Record<number, boolean> = { 1: false, 2: false };

  // Step 1: personal info (read-only, from profile)
  formNom = '';
  formPrenom = '';
  formEmail = '';
  formTelephone = '';
  formAdresse = '';
  formDateNaissance = '';
  formCin = '';
  formNationalite = 'Tunisienne';
  formGenre = 'Masculin';

  // Step 2: diploma
  typeCandidat: 'isimm' | 'externe' = 'externe';
  etablissement = '';
  natureDiplome = 'licence-lmd';
  anneeObtention = '2025';
  specialiteDiplome = '';
  mention = 'Bien';
  moyenneL1 = '';
  moyenneL2 = '';
  moyenneL3 = '';
  moyenneBac = '';
  noteMathBac = '';
  noteFrancaisBac = '';
  nbRedoublements = 0;
  nbSessions = 0;
  certificationLangue = 'none';

  // Step 3: voeux + motivation
  voeu1 = '';
  voeu2 = '';
  voeu3 = '';
  motivation = '';
  parcourOpts = PARCOURS_OPTS;

  // Step 4: documents
  uploadedFiles: Record<string, File | null> = { diplome: null, photo: null };
  uploadedNames: Record<string, string> = {};

  // Score
  computedScore: number | null = null;
  scoreFormula = '';
  scoreMG = 0;
  scoreBNR = 5;
  scoreBSP = 3;
  scoreBL = 0;

  // Specialites
  availableSpecialites: string[] = SPECS['licence-lmd'];

  constructor(
    private candidatureService: CandidatureService,
    private route: ActivatedRoute,
    private router: Router,
    private toastService: ToastService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const candidatureIdParam = this.route.snapshot.queryParamMap.get('candidatureId');
    this.selectedCandidatureId = candidatureIdParam ? Number(candidatureIdParam) : null;
    this.loadCandidature();
  }

  loadCandidature(): void {
    this.isLoading = true;
    this.candidatureService.getMesCandidatures().subscribe({
      next: (data: any) => {
        const candidatures = Array.isArray(data) ? data : [];
        if (this.selectedCandidatureId) {
          this.candidature =
            candidatures.find((c: any) => Number(c?.id) === this.selectedCandidatureId) ?? null;
        }
        if (!this.candidature) {
          this.candidature =
            candidatures.find((c: any) => c.peut_modifier === true) ?? candidatures[0] ?? null;
        }

        if (!this.candidature) {
          this.toastService.show('Aucune candidature trouvée.', 'warning');
          this.isLoading = false;
          return;
        }

        this.prefillForm();
        this.isLoading = false;
        this.stepProgress[1] = true;
        this.stepProgress[2] = true;

        if (!this.candidature?.peut_modifier) {
          this.toastService.show(
            'Cette candidature ne peut plus être modifiée (délai expiré ou statut verrouillé).',
            'warning',
          );
        }
      },
      error: () => {
        this.toastService.show('Impossible de charger votre candidature.', 'error');
        this.isLoading = false;
      },
    });
  }

  private prefillForm(): void {
    const c = this.candidature;
    const user = this.authService.getCurrentUser();

    this.formNom = user?.last_name || c?.candidat_nom?.split(' ').slice(1).join(' ') || '';
    this.formPrenom = user?.first_name || c?.candidat_nom?.split(' ')[0] || '';
    this.formEmail = user?.email || c?.candidat_email || '';
    this.formTelephone = user?.telephone || '';
    this.formAdresse = user?.adresse || '';

    // Pre-fill voeux from master nom
    this.voeu1 = c?.master_nom || '';

    // Score display
    if (c?.score != null) {
      this.computedScore = Number(c.score);
      this.scoreFormula = `Score calculé par le système : ${this.computedScore}`;
    }

    this.recalcScore();
  }

  goStep(n: number): void {
    if (n < 1 || n > 4) return;
    this.currentStep = n;
    this.stepProgress[n] = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  nextStep(): void {
    this.goStep(this.currentStep + 1);
  }

  prevStep(): void {
    this.goStep(this.currentStep - 1);
  }

  get formProgress(): number {
    const done = Object.values(this.stepProgress).filter(Boolean).length;
    return Math.round((done / 4) * 100);
  }

  get candidatureMasterNom(): string {
    return this.candidature?.master_nom || 'Master';
  }

  get candidatureRef(): string {
    return this.candidature?.numero || this.candidature?.numero_candidature || '—';
  }

  get candidatureAnnee(): string {
    return this.candidature?.annee_universitaire || '2025/2026';
  }

  get candidatureStatut(): string {
    return this.candidature?.statut || 'soumis';
  }

  get dateLimit(): string {
    const d = this.candidature?.date_limite_modification;
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR');
  }

  onNatureDiplomeChange(): void {
    this.availableSpecialites = SPECS[this.natureDiplome] || SPECS['licence-lmd'];
    this.specialiteDiplome = '';
  }

  selectEtab(type: 'isimm' | 'externe'): void {
    this.typeCandidat = type;
    if (type === 'isimm') {
      this.etablissement =
        "ISIMM — Institut Supérieur d'Informatique et des Mathématiques de Monastir";
    } else {
      this.etablissement = '';
    }
  }

  changeNum(field: 'nbRedoublements' | 'nbSessions', delta: number): void {
    const cur = this[field];
    const next = Math.max(0, Math.min(10, cur + delta));
    this[field] = next;
    this.recalcScore();
  }

  recalcScore(): void {
    const L1 = parseFloat(this.moyenneL1) || 0;
    const L2 = parseFloat(this.moyenneL2) || 0;
    const L3 = parseFloat(this.moyenneL3) || 0;
    const NFr = parseFloat(this.noteFrancaisBac) || 0;

    this.scoreMG = (L1 + L2 + L3) / 3;
    this.scoreBNR =
      this.nbRedoublements === 0 ? 5 : this.nbRedoublements === 1 ? 3 : 0;
    this.scoreBSP =
      this.nbSessions === 0 ? 3 : this.nbSessions === 1 ? 2 : 0;
    this.scoreBL = this.certificationLangue === 'b2' ? 2 : NFr >= 12 ? 1 : 0;

    const score = this.scoreMG + this.scoreBNR + this.scoreBSP + this.scoreBL;
    this.computedScore = parseFloat(score.toFixed(2));

    this.scoreFormula = `M.G + B.N.R + B.S.P + B.L = ${this.scoreMG.toFixed(2)} + ${this.scoreBNR} + ${this.scoreBSP} + ${this.scoreBL} = ${this.computedScore}`;
  }

  handleUpload(event: Event, docKey: string): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    this.uploadedFiles[docKey] = file;
    this.uploadedNames[docKey] = file.name;
    this.toastService.show(`${docKey === 'diplome' ? 'Diplôme' : 'Photo'} déposé avec succès`, 'success');
  }

  saveDraft(): void {
    this.toastService.show('Brouillon sauvegardé', 'success');
  }

  sauvegarder(): void {
    if (!this.candidature?.id) {
      this.toastService.show('Aucune candidature trouvée.', 'warning');
      return;
    }
    if (!this.candidature?.peut_modifier) {
      this.toastService.show(
        'Cette candidature ne peut plus être modifiée (délai expiré ou statut verrouillé).',
        'warning',
      );
      return;
    }

    this.isSaving = true;
    const voeux = [this.voeu1, this.voeu2, this.voeu3].filter((v) => !!v.trim());
    const firstNonEmpty = voeux.findIndex((v) => !!v) + 1;

    this.candidatureService
      .updateCandidature(this.candidature.id, {
        choix_priorite: firstNonEmpty || 1,
      })
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.toastService.show('Candidature mise à jour avec succès !', 'success');
          this.router.navigate(['/candidat/dashboard']);
        },
        error: (error: any) => {
          this.isSaving = false;
          const msg = error?.error?.error || 'Erreur lors de la sauvegarde.';
          this.toastService.show(msg, 'error');
        },
      });
  }

  showConfirmModal = false;
  openConfirm(): void {
    this.showConfirmModal = true;
  }
  closeConfirm(): void {
    this.showConfirmModal = false;
  }
  confirmSubmit(): void {
    this.closeConfirm();
    this.sauvegarder();
  }
}
