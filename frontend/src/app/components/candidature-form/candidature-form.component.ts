import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';
import { CandidatureService } from '../../services/candidature.service';
import {
  UNIVERSITIES_LIST,
  getEtablissementsForUniversite,
  isISIMMSelection,
} from '../../shared/constants/universities';
import {
  CritereOption,
  CritereInputType,
  PARCOURS_CRITERIA_DEFAULT,
  getCritereByCode,
} from '../../shared/constants/criteria';

interface Specialite {
  id: string;
  nom: string;
}

interface FormationOption {
  code: string;
  label: string;
}

// MOD 2B (v5) — Ligne du tableau dynamique de critères côté candidat.
interface CritereRow {
  code: string;
  label: string;
  inputType: CritereInputType;
  value: string;
  error?: string;
}

@Component({
  selector: 'app-candidature-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
  ],
  templateUrl: './candidature-form.component.html',
  styleUrls: ['./candidature-form.component.css'],
})
export class CandidatureFormComponent implements OnInit {
  typeCandidature: string = 'master';
  masterParcours: '' | 'mrgl' | 'mrmi' | 'mpgl' | 'mpds' | 'mp3i' = '';

  formData = {
    prenom: '',
    nom: '',
    dateNaissance: '',
    cin: '',
    email: '',
    telephone: '',
    specialiteBac: '',
    anneeBac: '',
    moyenneBacSessionPrincipale: null as number | null,
    noteMathBac: null as number | null,
    noteFrancaisBac: null as number | null,
    noteAnglaisBac: null as number | null,
    certificationB2: '',
    etablissementUniversitaireOrigine: '',
    // MOD 1 — Cascade Université / Établissement (remplace les radios ISIMM/Externe)
    universite: '',
    etablissement: '',
    isISIMM: false,
    specialiteDiplomeObtenu: '',
    // MOD v4 §5 — Texte libre si « Autre » est choisi comme spécialité
    specialiteDiplomeAutre: '',
    anneeObtentionDernierDiplome: '',
    natureDiplome: '',
    typeLicence: '',
    moyenne1ereAnnee: null as number | null,
    sessionReussite1ereAnnee: '',
    moyenne2emeAnnee: null as number | null,
    sessionReussite2emeAnnee: '',
    moyenne3emeAnnee: null as number | null,
    sessionReussite3emeAnnee: '',
    moyenne4emeAnnee: null as number | null,
    sessionReussite4emeAnnee: '',
    moyenneSemestre1TroisiemeAnnee: null as number | null,
    natureCandidature: '',
    etablissementExterne: '',
    specialiteExterne: '',
    nombreAnneesRedoublement: '0',
    // MOD 2B — Nombre de sessions de contrôle (critère NSC, sans coefficient côté candidat)
    nombreSessionsControle: '0',
    classement1ereAnnee: '',
    classement2emeAnnee: '',
    moyenneSessionPrincipale1ereAnnee: null as number | null,
    moyenneSessionControle1ereAnnee: null as number | null,
    moyenneSessionPrincipale2emeAnnee: null as number | null,
    moyenneSessionControle2emeAnnee: null as number | null,
    moyenneSessionPrincipale1ereAnneeRedoublement: null as number | null,
    moyenneSessionControle1ereAnneeRedoublement: null as number | null,
    moyenneSessionPrincipale2emeAnneeRedoublement: null as number | null,
    moyenneSessionControle2emeAnneeRedoublement: null as number | null,
    moyenneIng1: null as number | null,
    sessionReussiteIng1: '',
    nombreAnneesRedoublementIng1: '0',
    categorieIngenieur: '',
    specialite: '',
    confirmationDeclaration: '',
    passwordMode: 'auto',
    password: '',
    confirmPassword: '',
  };

  candidatureForm!: FormGroup;

  isLoading = false;
  errorMessage = '';
  successMessage = '';
  generatedPasswordMessage = '';
  copiedPassword = false;
  private copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

  currentFormStep = 1;
  maxUnlockedFormStep = 1;
  readonly totalFormSteps = 4;
  readonly formSteps = [
    { no: 1, label: 'Profil' },
    { no: 2, label: 'Bac et diplôme' },
    { no: 3, label: 'Parcours académique' },
    { no: 4, label: 'Validation' },
  ];

  // Options demandees pour le formulaire master (MRGL)
  specialiteBacOptions: FormationOption[] = [
    { code: 'informatique', label: 'Informatique' },
    { code: 'economique', label: 'Economique' },
    { code: 'mathematique', label: 'Mathematique' },
    { code: 'technique', label: 'Technique' },
    { code: 'science_experimentale', label: 'Science experimentale' },
    { code: 'autre', label: 'Autre' },
  ];

  specialiteDiplomeOptionsMpgl: string[] = [
    "Licence en Sciences de l'Informatique Génie Logiciel",
    'Informatique de Gestion (uniquement)',
    "Génie Logiciel et Systèmes d'Information",
    'Licence Appliquée en Développement des Systèmes Informatiques',
    'Big Data et Analyse de Données',
    'Business Computing',
  ];

  specialiteDiplomeOptionsMrgl: string[] = [
    'Licence en Informatique',
    'Maîtrise en Informatique',
    'Licence en Informatique ou Informatique de Gestion',
    'Maîtrise en Informatique ou Informatique de Gestion',
  ];

  specialiteDiplomeOptionsMpds: string[] = [
    'Licence en Mathématiques Appliquées — spécialité Statistique de l\'Environnement',
    'Mathématiques Appliquées — spécialité Science des Données',
    'Mathématiques et Applications',
    "Licence en Sciences de l'Informatique Génie Logiciel",
    'Informatique de Gestion (uniquement)',
    "Génie Logiciel et Systèmes d'Information",
    'Licence Appliquée en Développement des Systèmes Informatiques',
    'Big Data et Analyse de Données',
    'Business Computing',
  ];

  specialiteDiplomeOptionsMrmi: string[] = [
    'Licence en EEA, MIM (Électronique, Systèmes Embarqués, Métrologie) ou TIC (Réseaux et IoT)',
    'Licence en Électronique, Automatique ou Mesures et Instrumentation',
    "Réussite en 1ère année du cycle ingénieur (Électronique / Instrumentation) ou équivalent",
  ];

  specialiteDiplomeOptionsMp3i: string[] = [
    'Licence en Électronique, Électrotechnique et Automatique (MIM)',
    'Licence en Électronique, Électrotechnique et Automatique (SE)',
    "Licence en Technologies de l'Information et de la Communication (TIC)",
    'Licence en Mesures et Instrumentation',
    'Licence en EEA (Spécialité Automatique et Informatique Industrielle ou Mesures et Métrologie)',
    'Licence en Génie Électrique (Spécialité Automatique et Informatique Industrielle)',
  ];

  specialiteDiplomeOptionsIngenieur: string[] = [
    'Génie Logiciel (Informatique)',
    "Diplôme en Ingénierie Système d'Information",
    'Diplôme en Ingénierie Système Informatique',
  ];

  natureDiplomeOptions: string[] = ['Licence', 'Licence Ancien Régime', 'Maîtrise'];
  natureDiplomeOptionsIngenieur: string[] = ['Licence', 'Licence Ancien Régime', 'Cycle ingénieur'];
  typeLicenceOptions: string[] = ['Licence Nationale', 'Licence Ancien Régime'];
  ouiNonOptions: string[] = ['Oui', 'Non'];
  sessionOptions: string[] = ['Principale', 'Contrôle'];
  natureCandidatureOptions: string[] = ['Étudiant ISIMM', 'Étudiant Externe'];
  categoriesIngenieurOptions: string[] = [
    "Catégorie 1 : Les étudiants ayant réussi la deuxième année du cycle préparatoire intégré en informatique à l'ISIMM lors de l'année 2024-2025.",
    "Catégorie 2 : Les étudiants brillants inscrits en troisième année de Licence (système LMD) dans des spécialités scientifiques et techniques en 2024-2025, et n'ayant jamais redoublé durant leur cursus universitaire.",
  ];

  specialitesIngenieur: Specialite[] = [
    { id: '1', nom: 'Génie Informatique' },
    { id: '2', nom: 'Génie Électrique' },
    { id: '3', nom: 'Génie Mécanique' },
  ];

  constructor(
    private authService: AuthService,
    public router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private candidatureService: CandidatureService,
  ) {}

  ngOnInit(): void {
    // Récupérer le type depuis l'URL
    this.route.queryParams.subscribe((params) => {
      if (params['type']) {
        this.typeCandidature = this.normalizeTypeParam(params['type']);
      }

      this.masterParcours = this.normalizeMasterParcoursParam(params['parcours']);

      const availableDiplomaOptions = this.getSpecialiteDiplomeOptions();
      if (
        this.formData.specialiteDiplomeObtenu &&
        !availableDiplomaOptions.includes(this.formData.specialiteDiplomeObtenu)
      ) {
        this.formData.specialiteDiplomeObtenu = '';
      }

      // MOD 2B — (ré)initialise le tableau dynamique de critères selon le parcours
      this.initCandidatCriteres();
    });

    // Initialiser le formulaire
    this.candidatureForm = this.fb.group({
      prenom: [''],
      nom: [''],
      dateNaissance: [''],
      cin: [''],
      email: [''],
      telephone: [''],
      specialiteBac: [''],
      anneeBac: [''],
      moyenneBacSessionPrincipale: [null],
      noteMathBac: [null],
      noteFrancaisBac: [null],
      noteAnglaisBac: [null],
      certificationB2: [''],
      etablissementUniversitaireOrigine: [''],
      specialiteDiplomeObtenu: [''],
      anneeObtentionDernierDiplome: [''],
      natureDiplome: [''],
      typeLicence: [''],
      moyenne1ereAnnee: [null],
      sessionReussite1ereAnnee: [''],
      moyenne2emeAnnee: [null],
      sessionReussite2emeAnnee: [''],
      moyenne3emeAnnee: [null],
      sessionReussite3emeAnnee: [''],
      moyenne4emeAnnee: [null],
      sessionReussite4emeAnnee: [''],
      moyenneSemestre1TroisiemeAnnee: [null],
      natureCandidature: [''],
      etablissementExterne: [''],
      specialiteExterne: [''],
      nombreAnneesRedoublement: ['0'],
      classement1ereAnnee: [''],
      classement2emeAnnee: [''],
      moyenneSessionPrincipale1ereAnnee: [null],
      moyenneSessionControle1ereAnnee: [null],
      moyenneSessionPrincipale2emeAnnee: [null],
      moyenneSessionControle2emeAnnee: [null],
      moyenneSessionPrincipale1ereAnneeRedoublement: [null],
      moyenneSessionControle1ereAnneeRedoublement: [null],
      moyenneSessionPrincipale2emeAnneeRedoublement: [null],
      moyenneSessionControle2emeAnneeRedoublement: [null],
      moyenneIng1: [null],
      sessionReussiteIng1: [''],
      nombreAnneesRedoublementIng1: ['0'],
      categorieIngenieur: [''],
      specialite: [''],
      confirmationDeclaration: [''],
      type_candidature: [this.typeCandidature, Validators.required],
    });

    this.updateValidations();

    // Charger les spécialités dynamiquement si un parcours est fourni
    if (this.masterParcours) {
      try {
        this.loadSpecialitesForParcours(this.masterParcours);
      } catch (e) {
        console.error('Erreur chargement spécialités:', e);
      }
    }
  }

  loadSpecialitesForParcours(parcoursCode: string): void {
    // Map des codes locaux vers codes du backend
    const codeMap: Record<string, string> = {
      mpds: 'MPDS',
      mpgl: 'MPGL',
      mp3i: 'MP3I',
      mrgl: 'MRGL',
      mrmi: 'MRMI',
      ing_appli: 'ING_APPLI',
    };

    const backendCode = codeMap[parcoursCode.toLowerCase()] || parcoursCode.toUpperCase();

    this.candidatureService.getSpecialitesParParcours(backendCode).subscribe({
      next: (res: any) => {
        const specs = (res?.specialites || []).map((s: any) => (s.nom ? s.nom : s));
        // Répartir selon les tableaux existants si possible
        this.specialiteDiplomeOptionsMrgl = specs;
        this.specialiteDiplomeOptionsMpds = specs;
        this.specialiteDiplomeOptionsMp3i = specs;
        this.specialiteDiplomeOptionsMrmi = specs;
        this.specialiteDiplomeOptionsIngenieur = specs;
        console.log('✅ Spécialités chargées pour', backendCode, specs);
      },
      error: (err) => {
        console.error('❌ Erreur API spécialités:', err);
      },
    });
  }

  private normalizeTypeParam(rawType: string): 'master' | 'ingenieur' {
    const normalized = rawType
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return normalized === 'ingenieur' ? 'ingenieur' : 'master';
  }

  private normalizeMasterParcoursParam(
    rawParcours: string | undefined,
  ): '' | 'mrgl' | 'mrmi' | 'mpgl' | 'mpds' | 'mp3i' {
    if (!rawParcours) return '';

    const normalized = rawParcours
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (
      normalized === 'mrgl' ||
      normalized === 'mrmi' ||
      normalized === 'mpgl' ||
      normalized === 'mpds' ||
      normalized === 'mp3i'
    ) {
      return normalized;
    }

    return '';
  }

  getMasterFormTitle(): string {
    if (this.masterParcours === 'mrmi') return 'Candidature — Mastère Recherche en Micro-électronique et Instrumentation (MRMI)';
    if (this.masterParcours === 'mrgl') return 'Candidature — Mastère Recherche en Génie Logiciel (MRGL)';
    if (this.masterParcours === 'mpgl') return 'Candidature — Mastère Professionnel en Génie Logiciel (MPGL)';
    if (this.masterParcours === 'mpds') return 'Candidature — Mastère Professionnel en Science des Données (MPDS)';
    if (this.masterParcours === 'mp3i') return 'Candidature — Mastère Professionnel en Génie des Instruments Industriels (MP3I)';
    return 'Candidature à un Master';
  }

  getSpecialiteDiplomeOptions(): string[] {
    if (this.typeCandidature === 'ingenieur') {
      return this.specialiteDiplomeOptionsIngenieur;
    }

    if (this.masterParcours === 'mpgl') {
      return this.specialiteDiplomeOptionsMpgl;
    }

    if (this.masterParcours === 'mrmi') {
      return this.specialiteDiplomeOptionsMrmi;
    }

    if (this.masterParcours === 'mpds') {
      return this.specialiteDiplomeOptionsMpds;
    }

    if (this.masterParcours === 'mp3i') {
      return this.specialiteDiplomeOptionsMp3i;
    }

    return this.specialiteDiplomeOptionsMrgl;
  }

  // MOD 1 — Liste des universités exposée au template (cascade)
  readonly UNIVERSITIES_LIST: string[] = UNIVERSITIES_LIST;

  /** MOD 1 — Établissements disponibles pour l'université sélectionnée. */
  getEtablissementsForUniversite(): string[] {
    return getEtablissementsForUniversite(this.formData.universite || '');
  }

  /**
   * MOD 1 — Changement d'université : on réinitialise l'établissement et le
   * flag isISIMM (la nouvelle université peut ne pas proposer ISIMM).
   */
  onUniversiteChange(): void {
    this.formData.etablissement = '';
    this.formData.isISIMM = false;
    this.syncEtablissementOrigine();
  }

  /**
   * MOD 1 — Sélection de l'établissement : on calcule isISIMM puis on
   * synchronise les anciens champs (natureCandidature, etablissement*) pour
   * préserver le reste du formulaire et le payload envoyé à l'API.
   */
  onEtablissementChange(): void {
    this.formData.isISIMM = isISIMMSelection(
      this.formData.universite || '',
      this.formData.etablissement || '',
    );
    this.syncEtablissementOrigine();
  }

  /**
   * MOD 1 — Synchronise les champs hérités à partir de la cascade
   * Université / Établissement (compatibilité ascendante).
   */
  private syncEtablissementOrigine(): void {
    const etab = this.formData.etablissement || '';
    if (this.formData.isISIMM) {
      this.formData.natureCandidature = 'Étudiant ISIMM';
      this.formData.etablissementUniversitaireOrigine = 'ISIMM';
      this.formData.etablissementExterne = '';
    } else if (etab) {
      this.formData.natureCandidature = 'Étudiant Externe';
      this.formData.etablissementUniversitaireOrigine = etab;
      this.formData.etablissementExterne = etab;
    } else {
      this.formData.natureCandidature = '';
      this.formData.etablissementUniversitaireOrigine = '';
      this.formData.etablissementExterne = '';
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  MOD 2B — Tableau de saisie candidat (SANS coefficient)
  //  Le candidat remplit uniquement la VALEUR de chaque critère.
  //  Le coefficient reste côté Responsable / serveur.
  // ─────────────────────────────────────────────────────────────

  // ── État du tableau dynamique (v5) ──
  /** Critères déjà ajoutés par le candidat (lignes du tableau). */
  criteresAjoutes: CritereRow[] = [];
  /** Critères encore disponibles dans le dropdown « + Ajouter ». */
  criteresDisponibles: CritereOption[] = [];
  /** Tous les critères configurés pour ce parcours. */
  allCriteres: CritereOption[] = [];
  totalCriteres = 0;

  /** Ligne d'ajout en cours (affichée après clic sur « + Ajouter un critère »). */
  showNewRow = false;
  newCritCode = '';
  newCritValue = '';
  newCritPlaceholder = '';
  validationError = '';

  /** Mapping code parcours du formulaire → clé de la config critères. */
  private readonly PARCOURS_CRITERIA_KEY: Record<string, string> = {
    mrgl: 'mrgl',
    mrmi: 'micro',
    mpgl: 'gl',
    mpds: 'ds',
    mp3i: '3i',
  };

  /** Liste des critères à saisir pour le parcours master courant. */
  getCandidatCriteres(): CritereOption[] {
    if (this.typeCandidature !== 'master') return [];
    const key = this.PARCOURS_CRITERIA_KEY[this.masterParcours] || '';
    const codes = PARCOURS_CRITERIA_DEFAULT[key] || [];
    return codes
      .map((code) => getCritereByCode(code))
      .filter((c): c is CritereOption => !!c);
  }

  /** true si on est en mode « tableau de critères » (master avec parcours connu). */
  isMasterCriteriaMode(): boolean {
    return this.typeCandidature === 'master' && this.getCandidatCriteres().length > 0;
  }

  /**
   * MOD 2B (v5) — Initialise le tableau DYNAMIQUE : il démarre vide, tous les
   * critères du parcours sont placés dans le dropdown « + Ajouter un critère ».
   */
  private initCandidatCriteres(): void {
    this.criteresAjoutes = [];
    this.showNewRow = false;
    this.newCritCode = '';
    this.newCritValue = '';
    this.validationError = '';
    this.allCriteres = this.getCandidatCriteres();
    this.criteresDisponibles = [...this.allCriteres];
    this.totalCriteres = this.allCriteres.length;
  }

  /** Clic « + Ajouter un critère » → ouvre la ligne de sélection. */
  addRow(): void {
    if (!this.criteresDisponibles.length) {
      this.validationError = 'Tous les critères disponibles ont déjà été ajoutés.';
      return;
    }
    this.showNewRow = true;
    this.newCritCode = '';
    this.newCritValue = '';
    this.newCritPlaceholder = '';
    this.validationError = '';
  }

  /** Met à jour le placeholder selon le type du critère choisi. */
  onNewCritChange(): void {
    const crit = this.allCriteres.find((c) => c.code === this.newCritCode);
    this.newCritPlaceholder = crit
      ? crit.inputType === 'number'
        ? '0.00 – 20.00'
        : crit.inputType === 'count'
          ? '0, 1, 2…'
          : 'Oui / Non'
      : '';
  }

  /** Valide la ligne d'ajout : crée la ligne et retire le critère du dropdown. */
  confirmNewRow(): void {
    if (!this.newCritCode) return;
    if (String(this.newCritValue).trim() === '') return;
    const crit = this.allCriteres.find((c) => c.code === this.newCritCode);
    if (!crit) return;
    this.criteresAjoutes.push({
      code: crit.code,
      label: crit.label,
      inputType: crit.inputType,
      value: String(this.newCritValue),
    });
    this.syncRowToFormData(crit.code, this.newCritValue);
    this.criteresDisponibles = this.criteresDisponibles.filter((c) => c.code !== crit.code);
    this.showNewRow = false;
    this.newCritCode = '';
    this.newCritValue = '';
    this.validationError = '';
  }

  /** Annule la ligne d'ajout en cours. */
  cancelNewRow(): void {
    this.showNewRow = false;
    this.newCritCode = '';
    this.newCritValue = '';
  }

  /** 🗑 — supprime une ligne et remet le critère dans le dropdown. */
  removeRow(index: number): void {
    const removed = this.criteresAjoutes.splice(index, 1)[0];
    if (!removed) return;
    this.syncRowToFormData(removed.code, ''); // efface la valeur dans formData
    const original = this.allCriteres.find((c) => c.code === removed.code);
    if (original) {
      this.criteresDisponibles.push(original);
      this.criteresDisponibles.sort(
        (a, b) =>
          this.allCriteres.findIndex((c) => c.code === a.code) -
          this.allCriteres.findIndex((c) => c.code === b.code),
      );
    }
  }

  /** Édition inline de la valeur d'une ligne déjà ajoutée. */
  onRowValueChange(row: CritereRow): void {
    this.validateRow(row);
    this.syncRowToFormData(row.code, row.value);
  }

  /** Validation locale d'une ligne (plage 0–20 / 0–10). */
  validateRow(row: CritereRow): void {
    const v = String(row.value ?? '').trim();
    if (v === '') {
      row.error = 'Champ obligatoire';
      return;
    }
    if (row.inputType === 'number') {
      const n = parseFloat(v);
      if (Number.isNaN(n) || n < 0 || n > 20) {
        row.error = 'Valeur entre 0 et 20';
        return;
      }
    }
    if (row.inputType === 'count') {
      const n = parseInt(v, 10);
      if (Number.isNaN(n) || n < 0 || n > 10) {
        row.error = 'Valeur entre 0 et 10';
        return;
      }
    }
    row.error = '';
  }

  private toNote(raw: any): number | null {
    if (raw === '' || raw === null || raw === undefined) return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }

  private toStr(raw: any): string {
    return raw === null || raw === undefined ? '' : String(raw);
  }

  /** Mappe un code critère vers le champ formData attendu par l'API / le score. */
  private syncRowToFormData(code: string, raw: any): void {
    switch (code) {
      case 'M_BAC':
        this.formData.moyenneBacSessionPrincipale = this.toNote(raw);
        break;
      case 'N_MATH':
        this.formData.noteMathBac = this.toNote(raw);
        break;
      case 'N_FR':
        this.formData.noteFrancaisBac = this.toNote(raw);
        break;
      case 'N_ANG':
        this.formData.noteAnglaisBac = this.toNote(raw);
        break;
      case 'CERT_B2':
        this.formData.certificationB2 = this.toStr(raw);
        break;
      case 'M1':
        this.formData.moyenne1ereAnnee = this.toNote(raw);
        break;
      case 'M2':
        this.formData.moyenne2emeAnnee = this.toNote(raw);
        break;
      case 'M3':
        this.formData.moyenne3emeAnnee = this.toNote(raw);
        break;
      case 'NR':
        this.formData.nombreAnneesRedoublement = this.toStr(raw);
        break;
      case 'NSC':
        this.formData.nombreSessionsControle = this.toStr(raw);
        break;
      default:
        break;
    }
  }

  /**
   * Validation MOD 2B : tous les critères requis du parcours doivent avoir été
   * ajoutés, et chaque valeur saisie doit être non vide et valide.
   */
  validateCriteriaTable(): boolean {
    this.validationError = '';
    const missing = this.allCriteres.filter(
      (c) => !this.criteresAjoutes.find((r) => r.code === c.code),
    );
    if (missing.length > 0) {
      this.validationError =
        'Critères manquants : ' +
        missing.map((c) => c.label).join(', ') +
        '. Veuillez les ajouter avant de continuer.';
      return false;
    }
    for (const row of this.criteresAjoutes) {
      this.validateRow(row);
      if (row.error) {
        this.validationError = 'Certaines valeurs sont invalides ou vides.';
        return false;
      }
    }
    return true;
  }

  getNatureDiplomeOptions(): string[] {
    return this.typeCandidature === 'ingenieur'
      ? this.natureDiplomeOptionsIngenieur
      : this.natureDiplomeOptions;
  }

  // MOD v4 §5 — Option « Autre » dans la spécialité du diplôme.
  readonly SPECIALITE_AUTRE = 'Autre — préciser ci-dessous';

  isSpecialiteAutre(): boolean {
    return this.formData.specialiteDiplomeObtenu === this.SPECIALITE_AUTRE;
  }

  onSpecialiteDiplomeChange(): void {
    if (!this.isSpecialiteAutre()) {
      this.formData.specialiteDiplomeAutre = '';
    }
  }

  isIngenieurCategorie2Selected(): boolean {
    return this.formData.categorieIngenieur.startsWith('Catégorie 2');
  }

  isIngenieurCategoriePrepaSelected(): boolean {
    return this.formData.categorieIngenieur.startsWith('Catégorie 1');
  }

  isIngenieurCategorieLicenceSelected(): boolean {
    return this.formData.categorieIngenieur.startsWith('Catégorie 2');
  }

  shouldShowTroisiemeAnneeFields(): boolean {
    return !(this.typeCandidature === 'ingenieur' && this.isIngenieurCategoriePrepaSelected());
  }

  isIng1EquivalentProfileSelected(): boolean {
    return (
      this.formData.specialiteDiplomeObtenu ===
      'Reussite en 1ere annee du cycle ingenieur (Electronique/Instrumentation) ou equivalent'
    );
  }

  shouldShowIngenieurSessionAverages(): boolean {
    if (this.typeCandidature !== 'ingenieur') {
      return false;
    }

    const isCycleIngenieur = this.formData.natureDiplome === 'Cycle ingénieur';

    return isCycleIngenieur;
  }

  hasRedoublement(): boolean {
    return Number(this.formData.nombreAnneesRedoublement || '0') > 0;
  }

  isProfessionalMasterSelected(): boolean {
    return (
      this.masterParcours === 'mpgl' ||
      this.masterParcours === 'mpds' ||
      this.masterParcours === 'mp3i'
    );
  }

  isEtudiantExterneSelected(): boolean {
    return this.formData.natureCandidature === 'Étudiant Externe';
  }

  shouldShowMrglFourthYearFields(): boolean {
    return this.masterParcours === 'mrgl' && this.isMaitriseSelected();
  }

  /**
   * MOD v4 §6 — Seul MRGL accepte une Maîtrise. Pour GL/DS/3I/MRMI, sélectionner
   * « Maîtrise » affiche une alerte d'incompatibilité et bloque « Suivant ».
   */
  showMaitriseIncompatibility(): boolean {
    return (
      this.typeCandidature === 'master' &&
      this.isMaitriseSelected() &&
      this.masterParcours !== '' &&
      this.masterParcours !== 'mrgl'
    );
  }

  /** Libellé du parcours courant (pour le message d'incompatibilité). */
  getParcoursLabel(): string {
    const map: Record<string, string> = {
      mrgl: 'MRGL',
      mrmi: 'MRMI',
      mpgl: 'GL',
      mpds: 'DS',
      mp3i: '3I',
    };
    return map[this.masterParcours] || this.masterParcours.toUpperCase();
  }

  // ─────────────────────────────────────────────────────────────
  //  MOD v4 §4 — Validations étendues (CIN, téléphone, âge, années)
  // ─────────────────────────────────────────────────────────────
  isCinValid(): boolean {
    return /^\d{8}$/.test((this.formData.cin || '').trim());
  }

  isTelephoneValid(): boolean {
    return /^[2-9]\d{7}$/.test((this.formData.telephone || '').replace(/\s/g, ''));
  }

  isEmailValid(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((this.formData.email || '').trim());
  }

  /** Âge entre 16 et 60 ans à partir de la date de naissance. */
  isAgeValid(): boolean {
    if (!this.formData.dateNaissance) return false;
    const dob = new Date(this.formData.dateNaissance);
    if (Number.isNaN(dob.getTime())) return false;
    const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
    return age >= 16 && age <= 60;
  }

  isAnneeBacValid(): boolean {
    const an = this.num(this.formData.anneeBac);
    const cur = new Date().getFullYear();
    return an >= 1980 && an <= cur;
  }

  isAnneeDiplomeValid(): boolean {
    const an = this.num(this.formData.anneeObtentionDernierDiplome);
    const anBac = this.num(this.formData.anneeBac) || 1980;
    const cur = new Date().getFullYear();
    return an >= anBac + 2 && an <= cur + 1;
  }

  private isValidNote(value: number | null): boolean {
    return value === null || (value >= 0 && value <= 20);
  }

  private hasValue(value: unknown): boolean {
    return String(value ?? '') !== '';
  }

  isFormStepAccessible(step: number): boolean {
    return step >= 1 && step <= this.maxUnlockedFormStep;
  }

  goToFormStep(step: number): void {
    if (!this.isFormStepAccessible(step)) {
      return;
    }

    this.currentFormStep = step;
    this.errorMessage = '';
  }

  previousFormStep(): void {
    if (this.currentFormStep > 1) {
      this.currentFormStep -= 1;
      this.errorMessage = '';
    }
  }

  nextFormStep(): void {
    if (!this.isFormStepValid(this.currentFormStep)) {
      this.errorMessage = this.getFormStepValidationMessage(this.currentFormStep);
      return;
    }

    if (this.currentFormStep < this.totalFormSteps) {
      this.currentFormStep += 1;
      this.maxUnlockedFormStep = Math.max(this.maxUnlockedFormStep, this.currentFormStep);
      this.errorMessage = '';
    }
  }

  private isFormStepValid(step: number): boolean {
    if (step === 1) {
      return (
        this.formData.prenom.trim() !== '' &&
        this.formData.nom.trim() !== '' &&
        this.isAgeValid() &&
        this.isCinValid() &&
        this.isEmailValid() &&
        this.isTelephoneValid()
      );
    }

    if (step === 2) {
      // MOD 2B — Pour un master, la moyenne du bac et les notes du bac sont
      // saisies dans le tableau de critères (étape 3). On ne les exige plus ici.
      const moyenneBacOk =
        this.typeCandidature === 'master'
          ? true
          : this.formData.moyenneBacSessionPrincipale !== null;

      // MOD v4 §6 — Maîtrise incompatible avec GL/DS/3I/MRMI → blocage.
      if (this.showMaitriseIncompatibility()) {
        return false;
      }

      const baseValid =
        this.formData.specialiteBac.trim() !== '' &&
        this.isAnneeBacValid() &&
        moyenneBacOk &&
        this.formData.universite.trim() !== '' &&
        this.formData.etablissement.trim() !== '' &&
        this.formData.specialiteDiplomeObtenu.trim() !== '' &&
        this.isAnneeDiplomeValid() &&
        this.formData.natureDiplome.trim() !== '';

      if (!baseValid) {
        return false;
      }

      // MOD v4 §5 — Si « Autre » est choisi, la précision est obligatoire.
      if (this.isSpecialiteAutre() && this.formData.specialiteDiplomeAutre.trim() === '') {
        return false;
      }

      if (this.isProfessionalMasterSelected()) {
        return this.formData.typeLicence.trim() !== '';
      }

      return true;
    }

    if (step === 3) {
      // MOD 2B — Mode master : les moyennes/notes proviennent du tableau de
      // critères. On valide que toutes les valeurs sont remplies, les sessions
      // de réussite restant des champs distincts à conserver.
      if (this.isMasterCriteriaMode()) {
        if (!this.validateCriteriaTable() || !this.validateScoresRange()) {
          return false;
        }
        if (
          this.formData.sessionReussite1ereAnnee.trim() === '' ||
          this.formData.sessionReussite2emeAnnee.trim() === ''
        ) {
          return false;
        }
        if (
          this.shouldShowTroisiemeAnneeFields() &&
          this.formData.sessionReussite3emeAnnee.trim() === ''
        ) {
          return false;
        }
        if (this.shouldShowMrglFourthYearFields()) {
          if (
            this.formData.moyenne4emeAnnee === null ||
            this.formData.sessionReussite4emeAnnee.trim() === ''
          ) {
            return false;
          }
        }
        if (this.isEtudiantExterneSelected()) {
          return this.formData.etablissementExterne.trim() !== '';
        }
        return true;
      }

      const requiredAcademicFields =
        this.formData.moyenne1ereAnnee !== null &&
        this.formData.sessionReussite1ereAnnee.trim() !== '' &&
        this.formData.moyenne2emeAnnee !== null &&
        this.formData.sessionReussite2emeAnnee.trim() !== '' &&
        this.hasValue(this.formData.nombreAnneesRedoublement);

      if (!requiredAcademicFields || !this.validateScoresRange()) {
        return false;
      }

      if (this.shouldShowTroisiemeAnneeFields()) {
        if (
          this.formData.moyenne3emeAnnee === null ||
          this.formData.sessionReussite3emeAnnee.trim() === ''
        ) {
          return false;
        }
      }

      if (this.shouldShowMrglFourthYearFields()) {
        if (
          this.formData.moyenne4emeAnnee === null ||
          this.formData.sessionReussite4emeAnnee.trim() === ''
        ) {
          return false;
        }
      }

      if (this.isEtudiantExterneSelected()) {
        return this.formData.etablissementExterne.trim() !== '';
      }

      return true;
    }

    return true;
  }

  private getFormStepValidationMessage(step: number): string {
    if (step === 1) {
      return 'Complétez les informations personnelles obligatoires avant de continuer.';
    }

    if (step === 2) {
      return 'Complétez les champs obligatoires du bac et du diplôme avant de continuer.';
    }

    if (step === 3) {
      return 'Complétez les informations académiques obligatoires avant de continuer.';
    }

    return 'Veuillez compléter les champs requis avant de continuer.';
  }

  private getScoreValues(): number[] {
    const values: Array<number | null> = [
      this.formData.moyenne1ereAnnee,
      this.formData.moyenne2emeAnnee,
      this.formData.moyenne3emeAnnee,
      this.formData.moyenne4emeAnnee,
      this.formData.moyenneIng1,
    ];

    return values.filter((value): value is number => value !== null);
  }

  getAcademicAveragePreview(): number | null {
    const scores = this.getScoreValues();
    if (scores.length === 0) {
      return null;
    }

    const total = scores.reduce((sum, value) => sum + value, 0);
    return Number((total / scores.length).toFixed(2));
  }

  // ─────────────────────────────────────────────────────────────
  //  MOD v4 §2 — Formules de score vérifiées (source PDF) par parcours.
  //  Le score n'est PAS sur 20 (peut dépasser 100 pts).
  // ─────────────────────────────────────────────────────────────

  /** Mapping code parcours du formulaire → clé de formule de score. */
  private readonly SCORE_PARCOURS_KEY: Record<string, 'gl' | 'ds' | '3i' | 'mrgl' | 'mrmi'> = {
    mrgl: 'mrgl',
    mrmi: 'mrmi',
    mpgl: 'gl',
    mpds: 'ds',
    mp3i: '3i',
  };

  private num(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  /** true si la nature du diplôme sélectionnée est une Maîtrise (accents tolérés). */
  isMaitriseSelected(): boolean {
    return (this.formData.natureDiplome || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .includes('maitrise');
  }

  /** Nombre de sessions de contrôle (réussite en contrôle) par année L1/L2/L3. */
  private controleParAnnee(): { l1: number; l2: number; l3: number } {
    const isCtrl = (s: string) =>
      (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() === 'controle' ? 1 : 0;
    return {
      l1: isCtrl(this.formData.sessionReussite1ereAnnee),
      l2: isCtrl(this.formData.sessionReussite2emeAnnee),
      l3: isCtrl(this.formData.sessionReussite3emeAnnee),
    };
  }

  /** Score estimatif brut selon la formule vérifiée du parcours (ou null si incomplet). */
  getEstimatedScorePreview(): number | null {
    const key = this.SCORE_PARCOURS_KEY[this.masterParcours];
    if (!key) return null;

    const l1 = this.formData.moyenne1ereAnnee;
    const l2 = this.formData.moyenne2emeAnnee;
    const l3 = this.formData.moyenne3emeAnnee;
    const bac = this.formData.moyenneBacSessionPrincipale;
    const nbRedoub = this.num(this.formData.nombreAnneesRedoublement);
    const nbSess = this.num(this.formData.nombreSessionsControle);

    if (key === 'gl' || key === 'ds') {
      if (l1 === null || l2 === null || l3 === null) return null;
      const mg = (l1 + l2 + l3) / 3;
      const bnr = nbRedoub === 0 ? 5 : nbRedoub === 1 ? 3 : 0;
      const bsp = nbSess === 0 ? 3 : nbSess === 1 ? 2 : 0;
      return this.round2(mg + bnr + bsp);
    }

    if (key === '3i') {
      if (l1 === null || l2 === null || l3 === null || bac === null) return null;
      const mp = 2 * bac + 1.5 * l1 + 1 * l2 + 0.5 * l3;
      const mr = -1 * nbRedoub;
      const c = this.controleParAnnee();
      const mc = -1 * (c.l1 + c.l2 + c.l3);
      return this.round2(mp + mr + mc);
    }

    if (key === 'mrgl') {
      if (l1 === null || l2 === null || l3 === null || bac === null) return null;
      const bnr = nbRedoub === 0 ? 5 : nbRedoub === 1 ? 1.5 : 0;
      const bsp = nbSess === 0 ? 3 : nbSess === 1 ? 1 : 0;
      const bl =
        this.num(this.formData.noteFrancaisBac) >= 12 ||
        this.num(this.formData.noteAnglaisBac) >= 12 ||
        this.formData.certificationB2 === 'oui'
          ? 1
          : 0;
      const bacBonus = (bac + this.num(this.formData.noteMathBac) - 20) / 2;
      if (this.isMaitriseSelected()) {
        const l4 = this.num(this.formData.moyenne4emeAnnee);
        return this.round2(1.5 * l1 + 2 * l2 + 2 * l3 + l4 + bnr + bsp + bacBonus + bl);
      }
      const an = this.num(this.formData.anneeObtentionDernierDiplome);
      const bad = an === 2025 || an === 2023 ? 4 : an >= 2020 && an <= 2022 ? 2 : 0;
      return this.round2(1.5 * l1 + 2 * l2 + l3 + bnr + bsp + bacBonus + bl + bad);
    }

    // mrmi
    if (l1 === null || l2 === null || l3 === null || bac === null) return null;
    const mp = 0.5 * bac + 1 * l1 + 1.5 * l2 + 2 * l3;
    const mr = -4 * nbRedoub;
    const c = this.controleParAnnee();
    const mc = -1 * c.l1 + -1.5 * c.l2 + -2 * c.l3;
    return this.round2(mp + mr + mc);
  }

  private round2(v: number): number {
    return Math.round(Math.max(0, v) * 100) / 100;
  }

  /** MOD v4 §1 — Affichage du score SANS « / 20 ». */
  getEstimatedScoreDisplay(): string {
    const score = this.getEstimatedScorePreview();
    return score === null ? 'En attente des notes' : `${score.toFixed(2)} pts`;
  }

  /** MOD v4 §1 — Détail de la formule appliquée (tooltip au survol du score). */
  getScoreFormulaLabel(): string {
    const key = this.SCORE_PARCOURS_KEY[this.masterParcours];
    switch (key) {
      case 'gl':
      case 'ds':
        return 'Score = M.G + B.N.R + B.S.P  (M.G = (L1+L2+L3)/3)';
      case '3i':
        return 'Score = (2×Bac + 1.5×L1 + L2 + 0.5×L3) − redoublements − contrôles';
      case 'mrgl':
        return this.isMaitriseSelected()
          ? 'Score (Maîtrise) = 1.5×M1 + 2×M2 + 2×M3 + M4 + B_NR + B_SP + BacBonus + B_L'
          : 'Score (Licence) = 1.5×M1 + 2×M2 + M3 + B_NR + B_SP + BacBonus + B_L + B_AD';
      case 'mrmi':
        return 'Score = 0.5×Bac + L1 + 1.5×L2 + 2×L3(S5) − 4×redoublements − malus contrôles';
      default:
        return 'Formule de score appliquée par le système.';
    }
  }

  copyGeneratedPassword(): void {
    if (!this.generatedPasswordMessage) {
      return;
    }

    navigator.clipboard
      .writeText(this.generatedPasswordMessage)
      .then(() => {
        this.copiedPassword = true;
        if (this.copyFeedbackTimer) {
          clearTimeout(this.copyFeedbackTimer);
        }
        this.copyFeedbackTimer = setTimeout(() => {
          this.copiedPassword = false;
        }, 1400);
      })
      .catch(() => {
        this.copiedPassword = false;
      });
  }

  private validateScoresRange(): boolean {
    const scoreFields: Array<number | null> = [
      this.formData.moyenneBacSessionPrincipale,
      this.formData.noteMathBac,
      this.formData.noteFrancaisBac,
      this.formData.noteAnglaisBac,
      this.formData.moyenne1ereAnnee,
      this.formData.moyenne2emeAnnee,
      this.formData.moyenne3emeAnnee,
      this.formData.moyenne4emeAnnee,
      this.formData.moyenneSemestre1TroisiemeAnnee,
      this.formData.moyenneSessionPrincipale1ereAnnee,
      this.formData.moyenneSessionControle1ereAnnee,
      this.formData.moyenneSessionPrincipale2emeAnnee,
      this.formData.moyenneSessionControle2emeAnnee,
      this.formData.moyenneSessionPrincipale1ereAnneeRedoublement,
      this.formData.moyenneSessionControle1ereAnneeRedoublement,
      this.formData.moyenneSessionPrincipale2emeAnneeRedoublement,
      this.formData.moyenneSessionControle2emeAnneeRedoublement,
      this.formData.moyenneIng1,
    ];

    return scoreFields.every((value) => this.isValidNote(value));
  }

  // Mettre à jour les validations selon le type de candidature
  updateValidations(): void {
    if (!this.candidatureForm) return;
  }

  // Soumission du formulaire
  onSubmit(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.generatedPasswordMessage = '';

    // Validation de base
    if (!this.formData.prenom || !this.formData.nom || !this.formData.email || !this.formData.cin) {
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires';
      return;
    }

    // MOD 2B — En mode master, les notes/moyennes proviennent du tableau de critères.
    if (this.isMasterCriteriaMode() && !this.validateCriteriaTable()) {
      this.errorMessage = 'Veuillez remplir tous les critères demandés dans le tableau.';
      return;
    }

    if (
      !this.formData.specialiteBac ||
      !this.formData.anneeBac ||
      (this.typeCandidature !== 'master' && this.formData.moyenneBacSessionPrincipale === null) ||
      !this.formData.etablissementUniversitaireOrigine ||
      !this.formData.specialiteDiplomeObtenu ||
      !this.formData.anneeObtentionDernierDiplome ||
      !this.formData.natureDiplome ||
      this.formData.moyenne1ereAnnee === null ||
      !this.formData.sessionReussite1ereAnnee ||
      this.formData.moyenne2emeAnnee === null ||
      !this.formData.sessionReussite2emeAnnee ||
      !this.formData.natureCandidature ||
      this.formData.nombreAnneesRedoublement === ''
    ) {
      this.errorMessage = 'Veuillez renseigner tous les champs obligatoires du Bac et du diplôme.';
      return;
    }

    if (!this.validateScoresRange()) {
      this.errorMessage = 'Les moyennes et notes doivent etre comprises entre 0 et 20.';
      return;
    }

    if (this.isEtudiantExterneSelected()) {
      if (!this.formData.etablissementExterne.trim()) {
        this.errorMessage = "Veuillez renseigner l'établissement d'origine.";
        return;
      }
    }

    if (this.shouldShowTroisiemeAnneeFields()) {
      const isIngenieur = this.typeCandidature === 'ingenieur';
      const missingTroisiemeAnneeFields =
        this.formData.moyenne3emeAnnee === null || !this.formData.sessionReussite3emeAnnee;
      const missingIngenieurSemestre1 =
        isIngenieur && this.formData.moyenneSemestre1TroisiemeAnnee === null;

      if (missingTroisiemeAnneeFields || missingIngenieurSemestre1) {
        this.errorMessage = isIngenieur
          ? 'Veuillez renseigner tous les champs obligatoires de la 3ème année.'
          : 'Veuillez renseigner la moyenne et la session de réussite de la 3ème année.';
        return;
      }
    }

    if (this.masterParcours === 'mrgl') {
      if (
        this.formData.noteMathBac === null ||
        this.formData.noteFrancaisBac === null ||
        this.formData.noteAnglaisBac === null ||
        !this.formData.certificationB2 ||
        (this.shouldShowMrglFourthYearFields() &&
          (this.formData.moyenne4emeAnnee === null || !this.formData.sessionReussite4emeAnnee))
      ) {
        this.errorMessage =
          'Veuillez renseigner les notes du bac, la certification B2, et les champs de 4ème année si vous avez choisi la Maîtrise pour MRGL.';
        return;
      }
    }

    if (this.typeCandidature === 'ingenieur' && this.isIngenieurCategorieLicenceSelected()) {
      if (this.formData.classement1ereAnnee === '' || this.formData.classement2emeAnnee === '') {
        this.errorMessage =
          'Veuillez renseigner le classement de la 1ère année et de la 2ème année.';
        return;
      }
    }

    if (this.typeCandidature === 'ingenieur' && !this.formData.categorieIngenieur) {
      this.errorMessage = 'Veuillez sélectionner une catégorie pour la candidature ingénieur.';
      return;
    }

    if (this.shouldShowIngenieurSessionAverages()) {
      if (
        this.formData.moyenneSessionPrincipale1ereAnnee === null ||
        this.formData.moyenneSessionControle1ereAnnee === null ||
        this.formData.moyenneSessionPrincipale2emeAnnee === null ||
        this.formData.moyenneSessionControle2emeAnnee === null
      ) {
        this.errorMessage =
          'Veuillez renseigner les moyennes de réussite (session principale et contrôle) pour la 1ère et la 2ème année.';
        return;
      }

      if (this.hasRedoublement()) {
        if (
          this.formData.moyenneSessionPrincipale1ereAnneeRedoublement === null ||
          this.formData.moyenneSessionControle1ereAnneeRedoublement === null ||
          this.formData.moyenneSessionPrincipale2emeAnneeRedoublement === null ||
          this.formData.moyenneSessionControle2emeAnneeRedoublement === null
        ) {
          this.errorMessage =
            'Veuillez renseigner les moyennes de réussite (session principale et contrôle) pour le cas de redoublement.';
          return;
        }
      }
    }

    if (this.isProfessionalMasterSelected() && !this.formData.typeLicence) {
      this.errorMessage = 'Veuillez sélectionner le type de licence pour MPGL/MPDS/MP3I.';
      return;
    }

    if (this.isIng1EquivalentProfileSelected()) {
      if (
        this.formData.moyenneIng1 === null ||
        !this.formData.sessionReussiteIng1 ||
        this.formData.nombreAnneesRedoublementIng1 === ''
      ) {
        this.errorMessage =
          'Veuillez renseigner les champs ING1 (moyenne, session et redoublement).';
        return;
      }
    }

    // Validation du mot de passe si mode manuel
    if (this.formData.passwordMode === 'manual') {
      if (!this.formData.password || !this.formData.confirmPassword) {
        this.errorMessage = 'Veuillez entrer et confirmer votre mot de passe';
        return;
      }
      if (this.formData.password.length < 8) {
        this.errorMessage = 'Le mot de passe doit contenir au moins 8 caractères';
        return;
      }
      if (this.formData.password !== this.formData.confirmPassword) {
        this.errorMessage = 'Les mots de passe ne correspondent pas';
        return;
      }
    }

    if (this.formData.confirmationDeclaration.trim().toLowerCase() !== 'je confirme') {
      this.errorMessage = 'Veuillez saisir exactement "je confirme" pour valider la declaration.';
      return;
    }

    this.isLoading = true;

    const generatedPassword =
      this.formData.passwordMode === 'manual' ? this.formData.password : this.generatePassword();

    // Préparer les données
    const candidatureData = {
      first_name: this.formData.prenom,
      last_name: this.formData.nom,
      cin: this.formData.cin,
      date_naissance: this.formData.dateNaissance,
      email: this.formData.email,
      telephone: this.formData.telephone,
      type_candidature: this.typeCandidature,
      etablissement_origine: this.formData.etablissementUniversitaireOrigine,
      diplome_obtenu: this.formData.natureDiplome,
      etablissement_externe: this.formData.etablissementExterne,
      specialite_externe: this.formData.specialiteExterne,
      annees_rattrapage: Number(this.formData.nombreAnneesRedoublement || '0'),
      bsp: 0,
      notes_academiques: {
        specialite_baccalaureat: this.formData.specialiteBac,
        annee_baccalaureat: this.formData.anneeBac,
        moyenne_bac_session_principale: this.formData.moyenneBacSessionPrincipale,
        note_mathematiques_bac: this.formData.noteMathBac,
        note_francais_bac: this.formData.noteFrancaisBac,
        note_anglais_bac: this.formData.noteAnglaisBac,
        certification_niveau_b2: this.formData.certificationB2,
        specialite_diplome_obtenu: this.formData.specialiteDiplomeObtenu,
        annee_obtention_dernier_diplome: this.formData.anneeObtentionDernierDiplome,
        nature_diplome: this.formData.natureDiplome,
        type_licence: this.formData.typeLicence,
        moyenne_1ere_annee: this.formData.moyenne1ereAnnee,
        session_reussite_1ere_annee: this.formData.sessionReussite1ereAnnee,
        moyenne_2eme_annee: this.formData.moyenne2emeAnnee,
        session_reussite_2eme_annee: this.formData.sessionReussite2emeAnnee,
        moyenne_3eme_annee: this.formData.moyenne3emeAnnee,
        session_reussite_3eme_annee: this.formData.sessionReussite3emeAnnee,
        moyenne_semestre1_3eme_annee: this.formData.moyenneSemestre1TroisiemeAnnee,
        classement_1ere_annee: this.formData.classement1ereAnnee,
        classement_2eme_annee: this.formData.classement2emeAnnee,
        nature_candidature: this.formData.natureCandidature,
        nombre_annees_redoublement: Number(this.formData.nombreAnneesRedoublement || '0'),
        nombre_sessions_controle: Number(this.formData.nombreSessionsControle || '0'),
        moyenne_session_principale_1ere_annee: this.formData.moyenneSessionPrincipale1ereAnnee,
        moyenne_session_controle_1ere_annee: this.formData.moyenneSessionControle1ereAnnee,
        moyenne_session_principale_2eme_annee: this.formData.moyenneSessionPrincipale2emeAnnee,
        moyenne_session_controle_2eme_annee: this.formData.moyenneSessionControle2emeAnnee,
        moyenne_session_principale_1ere_annee_redoublement:
          this.formData.moyenneSessionPrincipale1ereAnneeRedoublement,
        moyenne_session_controle_1ere_annee_redoublement:
          this.formData.moyenneSessionControle1ereAnneeRedoublement,
        moyenne_session_principale_2eme_annee_redoublement:
          this.formData.moyenneSessionPrincipale2emeAnneeRedoublement,
        moyenne_session_controle_2eme_annee_redoublement:
          this.formData.moyenneSessionControle2emeAnneeRedoublement,
        moyenne_ing1: this.formData.moyenneIng1,
        session_reussite_ing1: this.formData.sessionReussiteIng1,
        nombre_annees_redoublement_ing1: Number(this.formData.nombreAnneesRedoublementIng1 || '0'),
        categorie_ingenieur: this.formData.categorieIngenieur,
      },
      documents_declares: {},

      // Plus de vÅ“ux dans le formulaire master
      voeux: [],

      specialite: null,

      // Mot de passe
      password: generatedPassword,
    };

    // Le endpoint auth/register attend un payload strict (password2 obligatoire).
    const registerPayload = {
      first_name: candidatureData.first_name,
      last_name: candidatureData.last_name,
      email: candidatureData.email,
      role: 'candidat',
      password: generatedPassword,
      password2: generatedPassword,
    };

    this.authService.register(registerPayload).subscribe({
      next: (response: any) => {
        this.successMessage =
          'Compte créé avec succès. Conservez ce mot de passe puis connectez-vous.';
        this.generatedPasswordMessage = generatedPassword;
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('âŒ Erreur inscription:', error);
        this.isLoading = false;

        let errorMessage = 'Erreur lors de la candidature.';
        if (error?.error) {
          if (typeof error.error === 'string') {
            errorMessage += `\n${error.error}`;
          } else {
            const details = Object.entries(error.error)
              .map(
                ([field, messages]) =>
                  `${field}: ${Array.isArray(messages) ? messages.join(', ') : String(messages)}`,
              )
              .join('\n');
            if (details) {
              errorMessage += `\n\n${details}`;
            }
          }
        }

        this.errorMessage = errorMessage;
      },
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  onCancel(): void {
    if (this.typeCandidature === 'ingenieur') {
      this.router.navigate(['/masters/ingenieur/exploration']);
      return;
    }

    if (
      this.masterParcours === 'mpgl' ||
      this.masterParcours === 'mpds' ||
      this.masterParcours === 'mp3i'
    ) {
      this.router.navigate(['/masters/professionnel/exploration']);
      return;
    }

    this.router.navigate(['/masters/recherche/exploration']);
  }

  // Générer un mot de passe aléatoire
  generatePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}
