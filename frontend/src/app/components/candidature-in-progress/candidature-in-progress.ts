import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

interface DiplomeRow {
  intitule: string;
  etablissement: string;
  annee: string;
}

type FormationCode = 'MPGL' | 'MPDS' | 'MP3I' | 'MRGL' | 'MRMI' | 'ING_INFO_GL' | 'ING_EM';

interface SummaryLine {
  label: string;
  value: string;
}

@Component({
  selector: 'app-candidature-in-progress',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './candidature-in-progress.html',
  styleUrl: './candidature-in-progress.css',
})
export class CandidatureInProgressComponent implements OnInit {
  currentStep = 1;
  maxUnlockedStep = 1;

  typeCandidature: 'master' | 'ingenieur' = 'master';
  offreId: number | null = null;
  candidatureId: number | null = null;
  titreOffre = '';

  personal = {
    prenom: '',
    nom: '',
    email: '',
    telephone: '',
    cin: '',
  };

  formationOptions: Array<{ code: FormationCode; label: string }> = [
    { code: 'MPGL', label: 'Mastère Professionnel en Génie logiciel (GL)' },
    { code: 'MPDS', label: 'Mastère Professionnel en sciences de données (DS)' },
    {
      code: 'MP3I',
      label: 'Mastère Professionnel en Ingénieries en Instrumentation industrielle (3I)',
    },
    { code: 'MRGL', label: 'Mastère Recherche en Génie logiciel (MRGL)' },
    { code: 'MRMI', label: 'Mastère Recherche en micro-électronique et instrumentation' },
    {
      code: 'ING_INFO_GL',
      label: 'Ingénieur en sciences Appliquées et Technologie : Informatique, Génie logiciel',
    },
    {
      code: 'ING_EM',
      label: 'Ingénieur en sciences Appliquées et Technologie : Electronique, Microélectronique',
    },
  ];

  diplomeOptions: string[] = [
    'Licence en Informatique',
    "Licence en Sciences de l'Informatique",
    'Licence en Informatique de Gestion',
    'Licence en Data Science',
    'Licence en Electronique',
    'Licence en Electrotechnique',
    'Licence en Instrumentation et Metrologie',
    'Licence TIC : RIoT',
    'Maitrise en Informatique',
    'Premiere annee Ingenieur Electronique/Instrumentation',
    'Deuxieme annee cycle preparatoire integre informatique ISIMM',
    'Troisieme annee licence scientifique/technique (LMD)',
    'Autre diplome',
  ];

  selectedFormation: FormationCode | '' = '';
  selectedDiplome = '';
  natureCandidature: 'Étudiant ISIMM' | 'Étudiant Externe' | '' = '';
  etablissementExterne = '';
  specialiteExterne = '';
  mpGlDs = {
    etablissementOrigine: '',
    diplomeReference: '',
  };
  diplomes: DiplomeRow[] = [{ intitule: '', etablissement: '', annee: '' }];

  mrglParcours: 'licence' | 'maitrise' = 'licence';
  mrmiParcours: 'cas1' | 'cas2' = 'cas1';
  ingParcours: 'cas1' | 'cas2' = 'cas1';

  academic = {
    commun: {
      session: 'principale',
      redoublements: '',
    },
    glDs: {
      moy1: '',
      moy2: '',
      moy3: '',
    },
    i3: {
      moyBac: '',
      moyL1: '',
      moyL2: '',
      moyL3: '',
    },
    mrglLicence: {
      moy1: '',
      moy2: '',
      moy3: '',
      moyBac: '',
      noteMathBac: '',
      bonusLangue: '',
      bonusAnneeDiplome: '',
    },
    mrglMaitrise: {
      moy1: '',
      moy2: '',
      moy3: '',
      moy4: '',
      moyBac: '',
      noteMathBac: '',
      bonusLangue: '',
    },
    mrmiCas1: {
      moyBac: '',
      moyL1: '',
      moyL2: '',
      moyL3: '',
    },
    mrmiCas2: {
      moyIng1: '',
      sMalus: '-1',
      prPenalite: '-2',
      equivalence80: false,
    },
    ingCas1: {
      moy1: '',
      moy2: '',
      sessionAnnee1: 'principale',
      sessionAnnee2: 'principale',
    },
    ingCas2: {
      m1: '',
      m2: '',
      m3: '',
      r1: '',
      r2: '',
    },
  };

  confirmation = false;

  isSubmitting = false;

  steps = [
    { no: 1, label: 'Informations personnelles' },
    { no: 2, label: 'Informations Bac' },
    { no: 3, label: 'Informations Licence' },
    { no: 4, label: 'Synthèse et validation' },
  ];

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser() || {};

    this.personal = {
      prenom: user.first_name || '',
      nom: user.last_name || '',
      email: user.email || '',
      telephone: user.phone || '',
      cin: user.cin || '',
    };

    this.route.queryParamMap.subscribe((params) => {
      const type = params.get('type');
      const offerId = params.get('offerId');
      const candidatureId = params.get('candidatureId');
      const title = params.get('title');

      if (type === 'ingenieur' || type === 'master') {
        this.typeCandidature = type;
      }

      this.offreId = offerId ? Number(offerId) : null;
      this.candidatureId = candidatureId ? Number(candidatureId) : null;
      this.titreOffre = title || '';

      const matched = this.formationOptions.find((item) => (title || '').includes(item.label));
      this.selectedFormation = matched?.code || '';
      if (this.selectedFormation) {
        this.syncParcoursByFormation();
      }

      if (this.isStep1AutoValid()) {
        this.maxUnlockedStep = Math.max(this.maxUnlockedStep, 2);
      }
    });
  }

  isStepAccessible(step: number): boolean {
    return step >= 1 && step <= this.maxUnlockedStep;
  }

  goToStep(step: number): void {
    if (this.isStepAccessible(step)) {
      this.currentStep = step;
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep -= 1;
    }
  }

  nextStep(): void {
    if (!this.isCurrentStepValid()) {
      alert('❌ Veuillez compléter les informations requises avant de continuer.');
      return;
    }

    if (this.currentStep < this.steps.length) {
      this.currentStep += 1;
      this.maxUnlockedStep = Math.max(this.maxUnlockedStep, this.currentStep);
    }
  }

  private isCurrentStepValid(): boolean {
    if (this.currentStep === 1) {
      return this.isStep1AutoValid();
    }

    if (this.currentStep === 2) {
      const diplomeOk = this.diplomes.some((d) => !!d.etablissement.trim() && !!d.annee.trim());
      const hasBase =
        !!this.selectedFormation && !!this.selectedDiplome && !!this.natureCandidature && diplomeOk;
      if (!hasBase) {
        return false;
      }

      if (this.selectedFormation === 'MPGL' || this.selectedFormation === 'MPDS') {
        if (!this.mpGlDs.etablissementOrigine.trim() || !this.mpGlDs.diplomeReference.trim()) {
          return false;
        }
      }

      if (this.natureCandidature === 'Étudiant Externe') {
        return !!this.etablissementExterne.trim() && !!this.specialiteExterne.trim();
      }

      return true;
    }

    if (this.currentStep === 3) {
      return this.isStep3Valid();
    }

    if (this.currentStep === 4) {
      return this.confirmation;
    }

    return true;
  }

  private isStep1AutoValid(): boolean {
    return (
      !!this.personal.prenom.trim() && !!this.personal.nom.trim() && !!this.personal.email.trim()
    );
  }

  addDiplomeRow(): void {
    this.diplomes.push({ intitule: this.selectedDiplome || '', etablissement: '', annee: '' });
  }

  removeDiplomeRow(index: number): void {
    if (this.diplomes.length > 1) {
      this.diplomes.splice(index, 1);
    }
  }

  onDiplomeSelectionChange(): void {
    this.diplomes = this.diplomes.map((item) => ({
      ...item,
      intitule: this.selectedDiplome,
    }));
  }

  onFormationSelectionChange(): void {
    this.syncParcoursByFormation();
  }

  getSelectedFormationLabel(): string {
    return this.formationOptions.find((item) => item.code === this.selectedFormation)?.label || '-';
  }

  private syncParcoursByFormation(): void {
    if (this.selectedFormation === 'MRGL') {
      this.mrglParcours = 'licence';
    }

    if (this.selectedFormation === 'MRMI') {
      this.mrmiParcours = 'cas1';
    }

    if (this.selectedFormation === 'ING_INFO_GL' || this.selectedFormation === 'ING_EM') {
      this.ingParcours = 'cas1';
    }
  }

  private hasValues(values: Array<string | number | boolean>): boolean {
    return values.every((value) => {
      if (typeof value === 'boolean') {
        return value;
      }
      return String(value ?? '').trim() !== '';
    });
  }

  private isScoreInRange(value: string): boolean {
    const parsed = Number(
      String(value ?? '')
        .replace(',', '.')
        .trim(),
    );
    if (!Number.isFinite(parsed)) {
      return false;
    }
    return parsed >= 0 && parsed <= 20;
  }

  private areScoresInRange(values: string[]): boolean {
    return values.every((value) => this.isScoreInRange(value));
  }

  private getStep3ScoreValues(): string[] {
    const values: string[] = [];

    if (this.selectedFormation === 'MPGL' || this.selectedFormation === 'MPDS') {
      values.push(this.academic.glDs.moy1, this.academic.glDs.moy2, this.academic.glDs.moy3);
    }

    if (this.selectedFormation === 'MP3I') {
      values.push(
        this.academic.i3.moyBac,
        this.academic.i3.moyL1,
        this.academic.i3.moyL2,
        this.academic.i3.moyL3,
      );
    }

    if (this.selectedFormation === 'MRGL') {
      if (this.mrglParcours === 'licence') {
        values.push(
          this.academic.mrglLicence.moy1,
          this.academic.mrglLicence.moy2,
          this.academic.mrglLicence.moy3,
          this.academic.mrglLicence.moyBac,
          this.academic.mrglLicence.noteMathBac,
          this.academic.mrglLicence.bonusLangue,
          this.academic.mrglLicence.bonusAnneeDiplome,
        );
      } else {
        values.push(
          this.academic.mrglMaitrise.moy1,
          this.academic.mrglMaitrise.moy2,
          this.academic.mrglMaitrise.moy3,
          this.academic.mrglMaitrise.moy4,
          this.academic.mrglMaitrise.moyBac,
          this.academic.mrglMaitrise.noteMathBac,
          this.academic.mrglMaitrise.bonusLangue,
        );
      }
    }

    if (this.selectedFormation === 'MRMI') {
      if (this.mrmiParcours === 'cas1') {
        values.push(
          this.academic.mrmiCas1.moyBac,
          this.academic.mrmiCas1.moyL1,
          this.academic.mrmiCas1.moyL2,
          this.academic.mrmiCas1.moyL3,
        );
      } else {
        values.push(this.academic.mrmiCas2.moyIng1);
      }
    }

    if (this.selectedFormation === 'ING_INFO_GL' || this.selectedFormation === 'ING_EM') {
      if (this.ingParcours === 'cas1') {
        values.push(this.academic.ingCas1.moy1, this.academic.ingCas1.moy2);
      } else {
        values.push(this.academic.ingCas2.m1, this.academic.ingCas2.m2, this.academic.ingCas2.m3);
      }
    }

    return values.filter((value) => String(value ?? '').trim() !== '');
  }

  private isStep3Valid(): boolean {
    const commonValid = this.hasValues([
      this.academic.commun.session,
      this.academic.commun.redoublements,
    ]);

    if (!this.selectedFormation || !commonValid) {
      return false;
    }

    if (this.selectedFormation === 'MPGL' || this.selectedFormation === 'MPDS') {
      return (
        this.hasValues([
          this.academic.glDs.moy1,
          this.academic.glDs.moy2,
          this.academic.glDs.moy3,
        ]) && this.areScoresInRange(this.getStep3ScoreValues())
      );
    }

    if (this.selectedFormation === 'MP3I') {
      return (
        this.hasValues([
          this.academic.i3.moyBac,
          this.academic.i3.moyL1,
          this.academic.i3.moyL2,
          this.academic.i3.moyL3,
        ]) && this.areScoresInRange(this.getStep3ScoreValues())
      );
    }

    if (this.selectedFormation === 'MRGL') {
      if (this.mrglParcours === 'licence') {
        return (
          this.hasValues([
            this.academic.mrglLicence.moy1,
            this.academic.mrglLicence.moy2,
            this.academic.mrglLicence.moy3,
            this.academic.mrglLicence.moyBac,
            this.academic.mrglLicence.noteMathBac,
            this.academic.mrglLicence.bonusLangue,
            this.academic.mrglLicence.bonusAnneeDiplome,
          ]) && this.areScoresInRange(this.getStep3ScoreValues())
        );
      }

      return (
        this.hasValues([
          this.academic.mrglMaitrise.moy1,
          this.academic.mrglMaitrise.moy2,
          this.academic.mrglMaitrise.moy3,
          this.academic.mrglMaitrise.moy4,
          this.academic.mrglMaitrise.moyBac,
          this.academic.mrglMaitrise.noteMathBac,
          this.academic.mrglMaitrise.bonusLangue,
        ]) && this.areScoresInRange(this.getStep3ScoreValues())
      );
    }

    if (this.selectedFormation === 'MRMI') {
      if (this.mrmiParcours === 'cas1') {
        const redoublements = Number(this.academic.commun.redoublements || 0);
        return (
          redoublements <= 1 &&
          this.hasValues([
            this.academic.mrmiCas1.moyBac,
            this.academic.mrmiCas1.moyL1,
            this.academic.mrmiCas1.moyL2,
            this.academic.mrmiCas1.moyL3,
          ]) &&
          this.areScoresInRange(this.getStep3ScoreValues())
        );
      }

      return (
        this.hasValues([
          this.academic.mrmiCas2.moyIng1,
          this.academic.mrmiCas2.sMalus,
          this.academic.mrmiCas2.prPenalite,
          this.academic.mrmiCas2.equivalence80,
        ]) && this.areScoresInRange(this.getStep3ScoreValues())
      );
    }

    if (this.selectedFormation === 'ING_INFO_GL' || this.selectedFormation === 'ING_EM') {
      if (this.ingParcours === 'cas1') {
        return (
          this.hasValues([
            this.academic.ingCas1.moy1,
            this.academic.ingCas1.moy2,
            this.academic.ingCas1.sessionAnnee1,
            this.academic.ingCas1.sessionAnnee2,
          ]) && this.areScoresInRange(this.getStep3ScoreValues())
        );
      }

      return (
        this.hasValues([
          this.academic.ingCas2.m1,
          this.academic.ingCas2.m2,
          this.academic.ingCas2.m3,
          this.academic.ingCas2.r1,
          this.academic.ingCas2.r2,
        ]) && this.areScoresInRange(this.getStep3ScoreValues())
      );
    }

    return false;
  }

  getSyntheseAcademiqueLines(): SummaryLine[] {
    const lines: SummaryLine[] = [
      { label: 'Session de reussite', value: this.academic.commun.session },
      { label: 'Nombre de redoublements', value: this.academic.commun.redoublements || '-' },
    ];

    if (this.selectedFormation === 'MPGL' || this.selectedFormation === 'MPDS') {
      lines.unshift(
        {
          label: "Etablissement d'origine",
          value: this.mpGlDs.etablissementOrigine || '-',
        },
        {
          label: 'Diplome (profil)',
          value: this.mpGlDs.diplomeReference || '-',
        },
      );
    }

    lines.push({ label: 'Nature de candidature', value: this.natureCandidature || '-' });
    if (this.natureCandidature === 'Étudiant Externe') {
      lines.push(
        { label: 'Etablissement externe', value: this.etablissementExterne || '-' },
        { label: 'Spécialité externe', value: this.specialiteExterne || '-' },
      );
    }

    if (this.selectedFormation === 'MPGL' || this.selectedFormation === 'MPDS') {
      lines.push(
        { label: 'Moyenne 1ere annee', value: this.academic.glDs.moy1 },
        { label: 'Moyenne 2eme annee', value: this.academic.glDs.moy2 },
        { label: 'Moyenne 3eme annee', value: this.academic.glDs.moy3 },
      );
    } else if (this.selectedFormation === 'MP3I') {
      lines.push(
        { label: 'Moy Bac', value: this.academic.i3.moyBac },
        { label: 'Moy L1', value: this.academic.i3.moyL1 },
        { label: 'Moy L2', value: this.academic.i3.moyL2 },
        { label: 'Moy L3', value: this.academic.i3.moyL3 },
      );
    } else if (this.selectedFormation === 'MRGL' && this.mrglParcours === 'licence') {
      lines.push(
        { label: 'Parcours', value: 'Licence' },
        { label: 'Moy 1ere annee', value: this.academic.mrglLicence.moy1 },
        { label: 'Moy 2eme annee', value: this.academic.mrglLicence.moy2 },
        { label: 'Moy 3eme annee', value: this.academic.mrglLicence.moy3 },
        { label: 'Moy Bac', value: this.academic.mrglLicence.moyBac },
        { label: 'Note Math Bac', value: this.academic.mrglLicence.noteMathBac },
        { label: 'Bonus Langue', value: this.academic.mrglLicence.bonusLangue },
        { label: 'Bonus Annee Diplome', value: this.academic.mrglLicence.bonusAnneeDiplome },
      );
    } else if (this.selectedFormation === 'MRGL' && this.mrglParcours === 'maitrise') {
      lines.push(
        { label: 'Parcours', value: 'Maitrise' },
        { label: 'Moy 1ere annee', value: this.academic.mrglMaitrise.moy1 },
        { label: 'Moy 2eme annee', value: this.academic.mrglMaitrise.moy2 },
        { label: 'Moy 3eme annee', value: this.academic.mrglMaitrise.moy3 },
        { label: 'Moy 4eme annee', value: this.academic.mrglMaitrise.moy4 },
        { label: 'Moy Bac', value: this.academic.mrglMaitrise.moyBac },
        { label: 'Note Math Bac', value: this.academic.mrglMaitrise.noteMathBac },
        { label: 'Bonus Langue', value: this.academic.mrglMaitrise.bonusLangue },
      );
    } else if (this.selectedFormation === 'MRMI' && this.mrmiParcours === 'cas1') {
      lines.push(
        { label: 'Parcours', value: 'Cas 1 (Licence)' },
        { label: 'Moy Bac', value: this.academic.mrmiCas1.moyBac },
        { label: 'Moy L1', value: this.academic.mrmiCas1.moyL1 },
        { label: 'Moy L2', value: this.academic.mrmiCas1.moyL2 },
        { label: 'Moy L3', value: this.academic.mrmiCas1.moyL3 },
      );
    } else if (this.selectedFormation === 'MRMI' && this.mrmiParcours === 'cas2') {
      lines.push(
        { label: 'Parcours', value: 'Cas 2 (Ingenieur)' },
        { label: 'Moyenne ING1', value: this.academic.mrmiCas2.moyIng1 },
        { label: 'S (malus)', value: this.academic.mrmiCas2.sMalus },
        { label: 'PR (penalite)', value: this.academic.mrmiCas2.prPenalite },
        {
          label: 'Equivalence 80% cursus',
          value: this.academic.mrmiCas2.equivalence80 ? 'Oui' : 'Non',
        },
      );
    } else if (
      (this.selectedFormation === 'ING_INFO_GL' || this.selectedFormation === 'ING_EM') &&
      this.ingParcours === 'cas1'
    ) {
      lines.push(
        { label: 'Parcours', value: 'Cas 1 (Cycle preparatoire integre)' },
        { label: 'Moyenne Annee 1', value: this.academic.ingCas1.moy1 },
        { label: 'Session Annee 1', value: this.academic.ingCas1.sessionAnnee1 },
        { label: 'Moyenne Annee 2', value: this.academic.ingCas1.moy2 },
        { label: 'Session Annee 2', value: this.academic.ingCas1.sessionAnnee2 },
      );
    } else if (
      (this.selectedFormation === 'ING_INFO_GL' || this.selectedFormation === 'ING_EM') &&
      this.ingParcours === 'cas2'
    ) {
      lines.push(
        { label: 'Parcours', value: 'Cas 2 (Licence LMD)' },
        { label: 'M1', value: this.academic.ingCas2.m1 },
        { label: 'M2', value: this.academic.ingCas2.m2 },
        { label: 'M3', value: this.academic.ingCas2.m3 },
        { label: 'R1', value: this.academic.ingCas2.r1 },
        { label: 'R2', value: this.academic.ingCas2.r2 },
      );
    }

    return lines;
  }

  cancel(): void {
    this.router.navigate(['/candidat/dashboard'], { queryParams: { view: 'offres-inscription' } });
  }

  submitFinalCandidature(): void {
    if (!this.isCurrentStepValid()) {
      alert('❌ Veuillez accepter la confirmation avant de soumettre.');
      return;
    }

    if (!this.areScoresInRange(this.getStep3ScoreValues())) {
      alert('❌ Les moyennes et notes doivent être comprises entre 0 et 20.');
      return;
    }

    if (!this.offreId) {
      alert('✅ Formulaire complété (mode démonstration).');
      this.router.navigate(['/candidat/dashboard'], { queryParams: { view: 'candidatures' } });
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      alert('❌ Session expirée. Veuillez vous reconnecter.');
      return;
    }

    this.isSubmitting = true;

    this.http
      .post(
        'http://localhost:8003/api/candidatures/create/',
        {
          master_id: this.offreId,
          formation_code: this.selectedFormation,
          selected_diplome: this.selectedDiplome,
          nature_candidature: this.natureCandidature,
          etablissement_origine: this.mpGlDs.etablissementOrigine,
          etablissement_externe: this.etablissementExterne,
          diplome_reference: this.mpGlDs.diplomeReference,
          specialite_externe: this.specialiteExterne,
          diplomes: this.diplomes,
          academic_data: {
            common: this.academic.commun,
            glDs: this.academic.glDs,
            i3: this.academic.i3,
            mrglParcours: this.mrglParcours,
            mrglLicence: this.academic.mrglLicence,
            mrglMaitrise: this.academic.mrglMaitrise,
            mrmiParcours: this.mrmiParcours,
            mrmiCas1: this.academic.mrmiCas1,
            mrmiCas2: this.academic.mrmiCas2,
            ingParcours: this.ingParcours,
            ingCas1: this.academic.ingCas1,
            ingCas2: this.academic.ingCas2,
          },
        },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: () => {
          alert('✅ Candidature soumise avec succès.');
          this.isSubmitting = false;
          this.router.navigate(['/candidat/dashboard'], { queryParams: { view: 'candidatures' } });
        },
        error: (error) => {
          console.error('Erreur soumission candidature:', error);
          this.isSubmitting = false;
          alert('❌ Erreur lors de la soumission finale.');
        },
      });
  }
}
