import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { SkeletonLoaderComponent } from '../../shared/skeleton-loader/skeleton-loader.component';
import { environment } from '../../../../environments/environment';

interface OCRAnomaly {
  type: string;
  champ?: string;
  message: string;
  saisi?: string;
  officiel?: string;
  manquants?: string[];
  line?: number;
  declared?: string;
  extracted?: string;
}

interface OCRDiagnostic {
  module: string;
  validation_auto: boolean;
  confiance: number;
  anomalies: OCRAnomaly[];
  external_provider: string;
  external_used: boolean;
  decision: string;
}

interface Candidature {
  id: number;
  candidat_nom: string;
  email: string;
  master_nom: string;
  statut: string;
  date_depot_dossier: string;
  score?: number;
}

interface AuditStep {
  title: string;
  description: string;
  state: 'done' | 'current' | 'pending';
}

@Component({
  selector: 'app-dossier-analysis',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule, SkeletonLoaderComponent],
  templateUrl: './dossier-analysis.html',
  styleUrls: ['./dossier-analysis.css'],
})
export class DossierAnalysisComponent implements OnInit {
  private readonly apiBaseUrl = environment.candidatureServiceUrl;
  private preselectedCandidatureId: number | null = null;
  readonly requiredDocuments = [
    { key: 'releve_notes', label: 'Relevés de notes' },
    { key: 'diplome', label: 'Diplôme / Attestation de réussite' },
    { key: 'cin_scan', label: 'Copie CIN / Passeport' },
    { key: 'photo_identite', label: "Photo d'identité" },
  ];

  private buildAuthOptions(): { headers: Record<string, string> } | {} {
    const token = localStorage.getItem('access_token');
    if (!token) {
      return {};
    }
    return { headers: { Authorization: `Bearer ${token}` } };
  }
  /** @description Liste des dossiers déposés (statut dossier_depose) */
  candidaturesList: Candidature[] = [];

  /** @description Candidature sélectionnée pour analyse */
  selectedCandidature: Candidature | null = null;

  /** @description Diagnostic OCR de la candidature sélectionnée */
  ocrDiagnostic: OCRDiagnostic | null = null;

  /** @description État de chargement */
  isLoading = false;
  isAnalyzing = false;

  /** @description Messages d'erreur/succès */
  errorMessage = '';
  successMessage = '';
  analyzedCount = 0;
  requiresLogin = false;

  searchTerm = '';
  selectedMasterFilter = 'all';

  /** @description Formulaire de simulation pour test OCR */
  formulaireSimulation = {
    cin: '',
    moyenne_generale: '',
    documents: [] as string[],
    declared_lines: [] as string[],
    extracted_lines: [] as string[],
  };

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const rawId = this.route.snapshot.queryParamMap.get('candidatureId');
    const parsedId = Number(rawId);
    this.preselectedCandidatureId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;
    this.loadCandidatures();
  }

  goToDashboard(): void {
    this.router.navigate(['/commission/dashboard']);
  }

  reconnect(): void {
    this.authService.logout();
  }

  get totalDossiers(): number {
    return this.candidaturesList.length;
  }

  get hasDirectAccess(): boolean {
    return this.preselectedCandidatureId !== null;
  }

  get directAccessLabel(): string {
    return this.preselectedCandidatureId
      ? `Accès direct au dossier #${this.preselectedCandidatureId}`
      : '';
  }

  get filteredCandidatures(): Candidature[] {
    const search = this.searchTerm.trim().toLowerCase();
    return this.candidaturesList.filter((c) => {
      const masterName = (c.master_nom || '').toLowerCase();
      const isIngenieur =
        masterName.includes('ingenieur') ||
        masterName.includes('ingénieur') ||
        masterName.includes('genie logiciel') ||
        masterName.includes('génie logiciel');

      const matchMaster =
        this.selectedMasterFilter === 'all' ||
        (this.selectedMasterFilter === 'ingenieur'
          ? isIngenieur
          : c.master_nom === this.selectedMasterFilter);
      if (!matchMaster) {
        return false;
      }

      if (!search) {
        return true;
      }

      return [c.candidat_nom, c.email, c.master_nom, String(c.id)]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search));
    });
  }

  get uniqueMasters(): string[] {
    return Array.from(
      new Set(this.candidaturesList.map((c) => c.master_nom).filter(Boolean)),
    ).sort();
  }

  get lastAnomalyCount(): number {
    return this.ocrDiagnostic?.anomalies?.length || 0;
  }

  get selectedDocumentsCount(): number {
    return this.selectedDocumentKeys.length;
  }

  get documentCompletionRate(): number {
    if (this.requiredDocuments.length === 0) {
      return 0;
    }

    return Math.round((this.selectedDocumentsCount / this.requiredDocuments.length) * 100);
  }

  get documentStatusLabel(): string {
    if (this.missingDocumentsFromDiagnostic.length > 0) {
      return 'Pièces manquantes détectées';
    }

    if (this.documentCompletionRate >= 100) {
      return 'Dossier documentaire complet';
    }

    if (this.selectedDocumentsCount > 0) {
      return 'Dossier documentaire en complétion';
    }

    return 'En attente de pièces';
  }

  get documentStatusTone(): 'good' | 'warning' | 'danger' {
    if (this.missingDocumentsFromDiagnostic.length > 0) {
      return 'danger';
    }

    if (this.documentCompletionRate >= 100) {
      return 'good';
    }

    return 'warning';
  }

  get globalComplianceScore(): number {
    const documentScore = this.documentCompletionRate;
    const ocrScore = this.ocrDiagnostic?.confiance ?? documentScore;
    const anomalyPenalty = Math.min(24, this.lastAnomalyCount * 4);
    const validationBonus = this.ocrDiagnostic?.validation_auto ? 6 : 0;

    return Math.max(
      0,
      Math.min(
        100,
        Math.round(documentScore * 0.45 + ocrScore * 0.45 + validationBonus - anomalyPenalty),
      ),
    );
  }

  get globalComplianceLabel(): string {
    if (this.globalComplianceScore >= 85) {
      return 'Conformité excellente';
    }

    if (this.globalComplianceScore >= 70) {
      return 'Conformité solide';
    }

    if (this.globalComplianceScore >= 50) {
      return 'Conformité sous surveillance';
    }

    return 'Conformité fragile';
  }

  get globalComplianceTone(): 'good' | 'warning' | 'danger' {
    if (this.globalComplianceScore >= 85) {
      return 'good';
    }

    if (this.globalComplianceScore >= 50) {
      return 'warning';
    }

    return 'danger';
  }

  get auditTimeline(): AuditStep[] {
    const hasSelection = !!this.selectedCandidature;
    const hasDiagnostic = !!this.ocrDiagnostic;

    return [
      {
        title: 'Dossier reçu',
        description: 'Entrée en file de contrôle de la commission.',
        state: hasSelection ? 'done' : 'pending',
      },
      {
        title: 'Contrôle documentaire',
        description:
          this.selectedDocumentsCount > 0
            ? `${this.selectedDocumentsCount}/${this.requiredDocuments.length} pièces indexées.`
            : 'Aucune pièce encore pointée.',
        state: hasSelection ? (this.documentCompletionRate >= 100 ? 'done' : 'current') : 'pending',
      },
      {
        title: 'Audit OCR / IA',
        description: hasDiagnostic
          ? `Confiance ${this.ocrDiagnostic?.confiance ?? 0} % sur la cohérence des pièces.`
          : 'En attente du lancement de l analyse OCR.',
        state: hasDiagnostic ? 'done' : hasSelection ? 'current' : 'pending',
      },
      {
        title: 'Décision commission',
        description: hasDiagnostic
          ? this.ocrDiagnostic?.validation_auto
            ? 'Validation automatique possible.'
            : 'Révision manuelle recommandée.'
          : 'Attente du diagnostic complet.',
        state: hasDiagnostic
          ? this.ocrDiagnostic?.validation_auto
            ? 'done'
            : 'current'
          : 'pending',
      },
    ];
  }

  get selectedDocumentKeys(): string[] {
    return (this.formulaireSimulation.documents || []).map((doc) => doc.toLowerCase());
  }

  get missingDocumentsFromDiagnostic(): string[] {
    if (!this.ocrDiagnostic?.anomalies?.length) {
      return [];
    }

    const missingDocs = this.ocrDiagnostic.anomalies
      .filter((anomaly) => anomaly.type === 'documents_manquants' && anomaly.manquants)
      .flatMap((anomaly) => anomaly.manquants || [])
      .map((doc) => String(doc || '').toLowerCase())
      .filter(Boolean);

    return Array.from(new Set(missingDocs));
  }

  isDocumentChecked(documentKey: string): boolean {
    return this.selectedDocumentKeys.includes(documentKey.toLowerCase());
  }

  isDocumentMissing(documentKey: string): boolean {
    return this.missingDocumentsFromDiagnostic.includes(documentKey.toLowerCase());
  }

  toggleDocument(documentKey: string, checked: boolean): void {
    const current = new Set(this.formulaireSimulation.documents || []);
    if (checked) {
      current.add(documentKey);
    } else {
      current.delete(documentKey);
    }
    this.formulaireSimulation.documents = Array.from(current);
  }

  /**
   * Charge la liste des candidatures avec statut 'dossier_depose'
   * @description Récupère les dossiers en attente d'analyse OCR
   */
  loadCandidatures(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.requiresLogin = false;

    this.http
      .get<Candidature[] | { results: Candidature[] }>(`${this.apiBaseUrl}/dossiers-ocr/`)
      .subscribe({
        next: (data) => {
          const list = Array.isArray(data)
            ? data
            : Array.isArray(data?.results)
              ? data.results
              : [];
          this.candidaturesList = list.filter((c: Candidature) => c.statut === 'dossier_depose');
          this.isLoading = false;

          if (this.preselectedCandidatureId) {
            const preselected = this.candidaturesList.find(
              (c) => c.id === this.preselectedCandidatureId,
            );
            if (preselected) {
              this.selectCandidature(preselected);
              this.successMessage = "Candidature présélectionnée: prête pour l'analyse OCR.";
            } else {
              this.selectFallbackCandidature(this.preselectedCandidatureId);
              this.successMessage = `Candidature #${this.preselectedCandidatureId} ouverte en mode analyse visuelle.`;
            }
          }

          if (this.selectedCandidature) {
            const stillExists = this.candidaturesList.find(
              (c) => c.id === this.selectedCandidature?.id,
            );
            if (!stillExists) {
              this.selectedCandidature = null;
              this.ocrDiagnostic = null;
            }
          }

          if (this.candidaturesList.length === 0) {
            this.errorMessage = "Aucun dossier en attente d'analyse OCR pour le moment.";
          }
        },
        error: (err) => {
          this.isLoading = false;
          if (err?.status === 401) {
            this.requiresLogin = true;
            this.errorMessage =
              'Session expirée ou invalide (401). Reconnectez-vous puis rechargez la page.';
          } else if (err?.status === 403) {
            this.errorMessage =
              'Accès refusé (403). Vérifiez votre session et reconnectez-vous avec un compte commission.';
          } else {
            this.errorMessage = 'Erreur lors du chargement des dossiers: ' + err.message;
          }
          console.error('Erreur API:', err);
        },
      });
  }

  /**
   * Sélectionne une candidature et réinitialise le diagnostic
   * @param candidature Candidature à analyser
   */
  selectCandidature(candidature: Candidature): void {
    this.selectedCandidature = candidature;
    this.ocrDiagnostic = null;
    this.errorMessage = '';
    this.successMessage = '';
    this.initFormulaireSynthese();
  }

  /**
   * Initialise le formulaire de synthèse avec les données de la candidature
   * @description Prépare les données de test pour l'analyse OCR
   */
  initFormulaireSynthese(): void {
    this.formulaireSimulation = {
      cin: this.selectedCandidature?.id.toString() || '',
      moyenne_generale: '',
      documents: ['releve_notes', 'diplome', 'cin_scan', 'photo_identite'],
      declared_lines: [],
      extracted_lines: [],
    };
  }

  selectFallbackCandidature(candidatureId: number): void {
    this.selectedCandidature = {
      id: candidatureId,
      candidat_nom: `Candidature #${candidatureId}`,
      email: 'Données non encore chargées',
      master_nom: 'Dossier commission',
      statut: 'consultation_directe',
      date_depot_dossier: new Date().toISOString(),
      score: 0,
    };
    this.ocrDiagnostic = null;
    this.errorMessage = '';
    this.initFormulaireSynthese();
  }

  /**
   * Lance l'analyse OCR pour la candidature sélectionnée
   * @description Appelle /api/candidatures/ocr/test/ avec le diagnostic
   */
  lancerAnalyseOCR(): void {
    if (!this.selectedCandidature) {
      this.errorMessage = 'Veuillez sélectionner une candidature.';
      return;
    }

    this.isAnalyzing = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload = {
      candidature_id: this.selectedCandidature.id,
      formulaire: this.formulaireSimulation,
    };

    this.http
      .post<{
        success: boolean;
        ocr_diagnostic: OCRDiagnostic;
      }>(`${this.apiBaseUrl}/ocr/test/`, payload, this.buildAuthOptions())
      .subscribe({
        next: (response) => {
          this.isAnalyzing = false;
          if (response.ocr_diagnostic) {
            this.ocrDiagnostic = response.ocr_diagnostic;
            this.analyzedCount += 1;
            this.successMessage =
              'Analyse OCR complétée: ' +
              (response.ocr_diagnostic.decision === 'auto_valide'
                ? 'Dossier auto-validé.'
                : 'Révision manuelle requise.');
          }
        },
        error: (err) => {
          this.isAnalyzing = false;
          if (err?.status === 401) {
            this.requiresLogin = true;
            this.errorMessage =
              "Session expirée pendant l'analyse OCR. Reconnectez-vous puis relancez.";
          } else {
            this.errorMessage = "Erreur lors de l'analyse OCR: " + err.message;
          }
          console.error('Erreur analyse OCR:', err);
        },
      });
  }

  /**
   * Retourne le style CSS pour afficher la confiance OCR
   * @param confiance Score de confiance (0-100)
   * @returns Classe CSS appropriée (good, warning, danger)
   */
  getConfianceClass(confiance: number): string {
    if (confiance >= 80) {
      return 'confiance-good';
    } else if (confiance >= 50) {
      return 'confiance-warning';
    } else {
      return 'confiance-danger';
    }
  }

  /**
   * Formate le type d'anomalie en texte lisible
   * @param type Type d'anomalie détecté par OCR
   * @returns Description lisible du type
   */
  formatAnomalyType(type: string): string {
    const typeMap: Record<string, string> = {
      cin_mismatch: 'Incohérence CIN',
      moyenne_mismatch: 'Incohérence de moyenne',
      moyenne_format: 'Format de moyenne incorrect',
      documents_manquants: 'Documents manquants',
      line_mismatch: 'Divergence de ligne',
    };
    return typeMap[type] || type;
  }

  /**
   * Valide le diagnostic et met à jour le statut de la candidature
   * @description Marque comme validée pour l'étape suivante (admission)
   */
  validerDossier(): void {
    if (!this.selectedCandidature || !this.ocrDiagnostic?.validation_auto) {
      this.errorMessage = 'Impossible de valider: anomalies détectées.';
      return;
    }

    // Appelle un endpoint pour mettre à jour le statut
    this.http
      .patch(
        `${this.apiBaseUrl}/${this.selectedCandidature.id}/changer-statut/`,
        {
          nouveau_statut: 'en_attente',
        },
        this.buildAuthOptions(),
      )
      .subscribe({
        next: () => {
          this.successMessage = 'Dossier marqué comme validé.';
          setTimeout(() => this.loadCandidatures(), 1500);
        },
        error: (err) => {
          if (err?.status === 401) {
            this.requiresLogin = true;
            this.errorMessage =
              'Session expirée pendant la validation. Reconnectez-vous puis réessayez.';
          } else {
            this.errorMessage = 'Erreur validation dossier: ' + err.message;
          }
        },
      });
  }

  /**
   * Demande une révision manuelle du dossier
   * @description Change le statut pour demander examen commission
   */
  demanderRevisionManuelle(): void {
    if (!this.selectedCandidature) {
      this.errorMessage = 'Veuillez sélectionner une candidature.';
      return;
    }

    this.http
      .patch(
        `${this.apiBaseUrl}/${this.selectedCandidature.id}/changer-statut/`,
        {
          nouveau_statut: 'rejete',
        },
        this.buildAuthOptions(),
      )
      .subscribe({
        next: () => {
          this.successMessage = 'Dossier marqué pour examen par la commission.';
          setTimeout(() => this.loadCandidatures(), 1500);
        },
        error: (err) => {
          if (err?.status === 401) {
            this.requiresLogin = true;
            this.errorMessage =
              'Session expirée pendant la révision. Reconnectez-vous puis réessayez.';
          } else {
            this.errorMessage = 'Erreur de révision du dossier: ' + err.message;
          }
        },
      });
  }

  /**
   * Ajoute une ligne de données déclarée pour comparaison
   */
  ajouterLigneDeclaree(): void {
    this.formulaireSimulation.declared_lines.push('');
  }

  /**
   * Ajoute une ligne de données extraites pour comparaison
   */
  ajouterLigneExtractee(): void {
    this.formulaireSimulation.extracted_lines.push('');
  }

  /**
   * Supprime une ligne déclarée
   * @param index Index de la ligne à supprimer
   */
  supprimerLigneDeclaree(index: number): void {
    this.formulaireSimulation.declared_lines.splice(index, 1);
  }

  /**
   * Supprime une ligne extraite
   * @param index Index de la ligne à supprimer
   */
  supprimerLigneExtractee(index: number): void {
    this.formulaireSimulation.extracted_lines.splice(index, 1);
  }

  preloadConsistentData(): void {
    const safeCin = this.formulaireSimulation.cin || '12345678';
    this.formulaireSimulation = {
      cin: safeCin,
      moyenne_generale: '15.20',
      documents: ['releve_notes', 'diplome', 'cin_scan', 'photo_identite'],
      declared_lines: ['Algo: 15', 'BD: 14', 'Moyenne S5: 15.2'],
      extracted_lines: ['Algo: 15', 'BD: 14', 'Moyenne S5: 15.2'],
    };
  }

  preloadAnomalyData(): void {
    const safeCin = this.formulaireSimulation.cin || '12345678';
    this.formulaireSimulation = {
      cin: safeCin,
      moyenne_generale: '11.00',
      documents: ['diplome', 'cin_scan'],
      declared_lines: ['Algo: 15', 'BD: 14', 'Moyenne S5: 15.2'],
      extracted_lines: ['Algo: 10', 'BD: 8', 'Moyenne S5: 11.0'],
    };
  }

  resetSimulation(): void {
    this.initFormulaireSynthese();
  }
}
