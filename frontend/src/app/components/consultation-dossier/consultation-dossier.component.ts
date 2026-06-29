import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CandidatureService } from '../../services/candidature.service';

interface DossierDocument {
  id: string;
  nom: string;
  dateDepot: string;
  taille: string;
  status: 'valid' | 'pending' | 'rejected';
  commentaire?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  url?: string;
  urlSafe?: SafeResourceUrl;
  open?: boolean;
}

interface TimelineItem {
  title: string;
  subtitle: string;
  time: string;
  tone: 'blue' | 'green' | 'gray';
}

interface CursusRow {
  level: 'Bac' | 'L1' | 'L2' | 'L3';
  moyennePrincipale: string;
  moyenneRattrapage: string;
  mention: string;
  session: 'Principale' | 'Rattrapage';
}

@Component({
  selector: 'app-consultation-dossier',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './consultation-dossier.component.html',
  styleUrl: './consultation-dossier.component.css',
})
export class ConsultationDossierComponent implements OnInit {
  candidatureId: number | null = null;
  sourceContext = '';
  sourceLabel = 'Consultation du dossier';
  readOnlyView = false;
  isLoading = true;
  showCustomSnippet = true;
  toastShow = false;
  toastMsg = '';
  toastClass = 't-success';
  globalComment = '';
  decisionNote = 'Validez tous les documents avant de prendre une décision finale.';
  decisionResult = '';
  decisionResultClass = '';
  activeTab: 'general' | 'cursus' | 'documents' | 'history' = 'general';
  consultationBackLabel = 'Retour';
  timelineDraft = '';
  isSavingStatus = false;
  decisionComment = '';
  showDecisionDropdown = false;

  // ── OCR (Relevé de Notes) ────────────────────────────────────────────
  ocrFile: File | null = null;
  ocrFileName = '';
  ocrLoading = false;
  ocrResult: {
    score_extrait: number | null;
    score_declare: number | null;
    delta: number | null;
    flag_fraude: boolean;
    confiance: number;
    moteur: string;
    anomalies: any[];
    texte_preview: string;
    note_extraite_ocr: number;
  } | null = null;
  ocrUpdateScore = false;

  // ── PDF Officiel (avec QR Code) ──────────────────────────────────────
  pdfLoading = false;
  pdfBlobUrl: SafeResourceUrl | null = null;
  pdfError = '';

  cursusRows: CursusRow[] = [
    {
      level: 'Bac',
      moyennePrincipale: '15.20',
      moyenneRattrapage: '-',
      mention: 'Bien',
      session: 'Principale',
    },
    {
      level: 'L1',
      moyennePrincipale: '14.80',
      moyenneRattrapage: '15.10',
      mention: 'Bien',
      session: 'Principale',
    },
    {
      level: 'L2',
      moyennePrincipale: '13.90',
      moyenneRattrapage: '14.40',
      mention: 'Assez Bien',
      session: 'Rattrapage',
    },
    {
      level: 'L3',
      moyennePrincipale: '16.10',
      moyenneRattrapage: '-',
      mention: 'Très Bien',
      session: 'Principale',
    },
  ];

  candidat: any = null;
  documents: DossierDocument[] = [];
  timeline: TimelineItem[] = [
    {
      title: 'Dossier soumis',
      subtitle: 'Le candidat a soumis son dossier complet',
      time: '15/02/2026 — 10:30 · Système',
      tone: 'blue',
    },
  ];

  docStates: Record<string, 'valid' | 'pending' | 'rejected'> = {
    d1: 'valid',
    d2: 'valid',
    d3: 'pending',
    d4: 'pending',
    d5: 'valid',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private candidatureService: CandidatureService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.candidatureId = Number(this.route.snapshot.paramMap.get('id')) || null;
    this.sourceContext = this.route.snapshot.queryParamMap.get('source') || '';
    this.sourceLabel = this.getSourceLabel(this.sourceContext);
    this.readOnlyView = this.sourceContext === 'selection' || this.sourceContext === 'commission';
    this.loadDossier();
  }

  get candidatureScore(): string {
    return this.candidat?.score !== undefined && this.candidat?.score !== null
      ? Number(this.candidat.score).toFixed(2)
      : '--';
  }

  get scoreMention(): string {
    const score = Number(this.candidat?.score ?? 0);
    if (score >= 16) return 'Excellent';
    if (score >= 14) return 'Très bon';
    if (score >= 12) return 'Bon niveau';
    return 'À renforcer';
  }

  get completionPercent(): number {
    const total = this.documents.length || 1;
    const validCount = this.documents.filter((item) => item.status === 'valid').length;
    return Math.round((validCount / total) * 100);
  }

  get validCount(): number {
    return this.documents.filter((item) => item.status === 'valid').length;
  }

  get pendingCount(): number {
    return this.documents.filter((item) => item.status === 'pending').length;
  }

  get rejectedCount(): number {
    return this.documents.filter((item) => item.status === 'rejected').length;
  }

  get sourceIsReclamation(): boolean {
    return (
      this.sourceContext === 'reclamations' || this.route.snapshot.queryParamMap.has('reclamation')
    );
  }

  private getSourceLabel(source: string): string {
    if (source === 'liste-generation') return 'Ouvert depuis une liste générée';
    if (source === 'reclamations') return 'Ouvert depuis les réclamations';
    if (source === 'selection') return 'Consultation dossier - phase de sélection';
    if (source === 'candidat') return 'Espace candidat';
    return 'Consultation du dossier';
  }

  private loadDossier(): void {
    const id = this.candidatureId;
    if (!id || Number.isNaN(id)) {
      this.showToast('Identifiant candidature invalide', 't-danger');
      this.isLoading = false;
      return;
    }

    const loader = this.readOnlyView
      ? this.candidatureService.getCommissionDossier(id)
      : this.candidatureService.getMesCandidatures();

    loader.subscribe({
      next: (response: any) => {
        if (this.readOnlyView) {
          const dossier = response?.dossier || response || null;
          const candidature = response?.candidature || null;
          this.candidat = candidature ?? this.buildFallbackCandidate(id);
          this.documents = this.buildDocumentsFromBackend(dossier, this.candidat);
        } else {
          const candidatures = Array.isArray(response)
            ? response
            : (response?.results ?? response?.data ?? []);
          const candidat = candidatures.find((item: any) => Number(item?.id) === id) ?? null;
          if (!candidat) {
            this.showToast('Candidat introuvable pour cet identifiant', 't-danger');
          }
          this.candidat = candidat ?? this.buildFallbackCandidate(id);
          this.documents = this.buildDocuments(this.candidat);
        }
        this.isLoading = false;
      },
      error: () => {
        this.candidat = this.buildFallbackCandidate(id);
        this.documents = this.readOnlyView
          ? this.buildDocuments(this.candidat)
          : this.buildDocuments(this.candidat);
        this.showToast('Chargement local de secours utilisé', 't-warn');
        this.isLoading = false;
      },
    });
  }

  private buildFallbackCandidate(id: number): any {
    return {
      id,
      first_name: 'Ahmed',
      last_name: 'Ben Ali',
      cin: '12345678',
      email: 'ahmed.benali@example.com',
      telephone: '+216 98 765 432',
      date_naissance: '2000-03-15',
      score: 17.5,
      type_candidature: 'master',
      source: this.sourceContext || 'commission-dashboard',
    };
  }

  private buildDocuments(candidate: any): DossierDocument[] {
    const prefix = candidate?.first_name?.charAt(0) || 'A';
    const suffix = candidate?.last_name?.charAt(0) || 'B';
    return [
      {
        id: 'd1',
        nom: "Carte d'identité nationale",
        dateDepot: '15/02/2026',
        taille: '1.2 MB',
        status: 'valid' as const,
        commentaire: 'Document conforme — CIN valide et lisible',
        verifiedBy: 'Dr. Ahmed Gharbi',
        verifiedAt: '16/02/2026 — 10:30',
        url: '/assets/docs/sample.pdf',
      },
      {
        id: 'd2',
        nom: 'Relevés de notes (L1, L2, L3)',
        dateDepot: '15/02/2026',
        taille: '3.5 MB',
        status: 'valid' as const,
        verifiedBy: 'Dr. Ahmed Gharbi',
        verifiedAt: '16/02/2026 — 10:35',
        url: '/assets/docs/sample.pdf',
      },
      {
        id: 'd3',
        nom: 'Diplôme de Licence',
        dateDepot: '16/02/2026',
        taille: '2.1 MB',
        status: 'pending' as const,
        url: '/assets/docs/sample.pdf',
      },
      {
        id: 'd4',
        nom: "Photo d'identité",
        dateDepot: '15/02/2026',
        taille: '420 KB',
        status: 'pending' as const,
        url: '/assets/images/photo-sample.jpg',
      },
      {
        id: 'd5',
        nom: 'Document synthèse — liste générée',
        dateDepot: '16/04/2026',
        taille: '180 KB',
        status: 'valid' as const,
        commentaire: 'Généré automatiquement depuis la liste de sélection',
        verifiedBy: 'Système commission',
        verifiedAt: '16/04/2026 — 09:15',
        url: '/assets/docs/sample.pdf',
      },
    ].map((item) => ({
      ...item,
      commentaire: item.commentaire,
      urlSafe: item.url ? this.sanitizer.bypassSecurityTrustResourceUrl(item.url) : undefined,
      nom: item.nom.replace('Ahmed Ben Ali', `${prefix}${suffix}`),
    })) as DossierDocument[];
  }

  private buildDocumentsFromBackend(dossier: any, candidate: any): DossierDocument[] {
    const docs = Array.isArray(dossier?.documents) ? dossier.documents : [];
    if (!docs.length) {
      return this.buildDocuments(candidate);
    }

    return docs.map((doc: any, index: number) => {
      const status = String(doc?.statut || '').toLowerCase();
      const normalizedStatus: DossierDocument['status'] =
        status === 'valide' || status === 'valid'
          ? 'valid'
          : status === 'rejete' || status === 'rejected'
            ? 'rejected'
            : 'pending';
      const url = doc?.fichier_url || doc?.fichier || doc?.url || '';
      const sizeBytes = Number(doc?.taille_bytes || 0);

      return {
        id: String(doc?.id ?? index),
        nom:
          doc?.nom_fichier_original ||
          doc?.type_document_detail?.description ||
          doc?.type_document_detail?.type_document ||
          'Document',
        dateDepot: doc?.date_upload ? new Date(doc.date_upload).toLocaleDateString('fr-FR') : '-',
        taille: sizeBytes > 0 ? this.formatFileSize(sizeBytes) : '-',
        status: normalizedStatus,
        commentaire: doc?.description || doc?.erreur_ocr || '',
        verifiedBy: doc?.verified_by || 'Commission',
        verifiedAt: doc?.date_traitement_ocr
          ? new Date(doc.date_traitement_ocr).toLocaleString('fr-FR')
          : undefined,
        url,
        urlSafe: url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : undefined,
      } as DossierDocument;
    });
  }

  private formatFileSize(sizeBytes: number): string {
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = sizeBytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  retour(): void {
    this.location.back();
  }

  ouvrirFichier(): void {
    this.showToast('Aperçu document demandé', 't-success');
  }

  sendPrompt(message: string): void {
    this.showToast(message, 't-info');
  }

  switchTab(tab: 'general' | 'cursus' | 'documents' | 'history'): void {
    this.activeTab = tab;
  }

  getDocumentChipClass(status: DossierDocument['status']): string {
    return status === 'valid'
      ? 'chip-valid'
      : status === 'rejected'
        ? 'chip-rejected'
        : 'chip-pending';
  }

  getDocumentStatusLabel(status: DossierDocument['status']): string {
    return status === 'valid' ? 'Conforme' : status === 'rejected' ? 'Rejeté' : 'En attente';
  }

  addTimelineComment(): void {
    if (!this.timelineDraft.trim()) return;
    this.timeline = [
      {
        title: 'Commentaire ajouté',
        subtitle: this.timelineDraft.trim(),
        time:
          new Date().toLocaleDateString('fr-FR') +
          ' — ' +
          new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        tone: 'gray',
      },
      ...this.timeline,
    ];
    this.timelineDraft = '';
  }

  toggleDoc(docId: string): void {
    const documentItem = this.documents.find((item) => item.id === docId);
    if (documentItem) {
      documentItem.open = !documentItem.open;
    }
  }

  validerDoc(docId: string, valid: boolean): void {
    const documentItem = this.documents.find((item) => item.id === docId);
    if (!documentItem) return;

    documentItem.status = valid ? 'valid' : 'rejected';
    this.docStates[docId] = valid ? 'valid' : 'rejected';
    this.updateProgress();
    this.addToTimeline(docId, valid);
    this.showToast(valid ? 'Document validé' : 'Document rejeté', valid ? 't-success' : 't-danger');
  }

  priseDecision(type: 'approve' | 'reject' | 'hold'): void {
    if (type === 'approve') {
      this.decisionResult = 'Dossier validé — décision finale enregistrée';
      this.decisionResultClass = 'dr-success';
      this.addToTimeline('final-approve', true);
      this.showToast(this.decisionResult, 't-success');
      return;
    }

    if (type === 'reject') {
      this.decisionResult = 'Dossier rejeté — notification envoyée au candidat';
      this.decisionResultClass = 'dr-danger';
      this.addToTimeline('final-reject', false);
      this.showToast(this.decisionResult, 't-danger');
      return;
    }

    this.decisionResult = 'Dossier mis en attente';
    this.decisionResultClass = 'dr-warn';
    this.addToTimeline('final-hold', false);
    this.showToast(this.decisionResult, 't-warn');
  }

  // ────────────────────────────────────────────────────────────────────
  // Actions Commission : changement de statut API-backed
  // ────────────────────────────────────────────────────────────────────

  get isCommissionView(): boolean {
    return this.sourceContext === 'commission';
  }

  get currentStatutBackend(): string {
    return String(this.candidat?.statut || '').toLowerCase();
  }

  get isAlreadyPreselectionne(): boolean {
    return this.currentStatutBackend === 'preselectionne';
  }

  get isAlreadyRefuse(): boolean {
    const s = this.currentStatutBackend;
    return s === 'rejete' || s === 'refuse';
  }

  get isAlreadySelectionne(): boolean {
    return this.currentStatutBackend === 'selectionne';
  }

  validerPreselection(): void {
    this.changerStatutCandidature('preselectionne', 'Validation présélection par la commission');
  }

  refuserCandidature(): void {
    const raison = (this.decisionComment || '').trim();
    if (!raison) {
      this.showToast('Veuillez saisir un motif de refus.', 't-warn');
      return;
    }
    this.changerStatutCandidature('rejete', raison);
  }

  selectionnerCandidat(): void {
    this.changerStatutCandidature('selectionne', 'Sélection finale par la commission');
  }

  private changerStatutCandidature(nouveauStatut: string, raison: string): void {
    if (!this.candidatureId || this.isSavingStatus) return;
    this.isSavingStatus = true;
    this.showDecisionDropdown = false;

    this.candidatureService.updateStatus(this.candidatureId, nouveauStatut, raison).subscribe({
      next: () => {
        if (this.candidat) {
          this.candidat.statut = nouveauStatut;
        }
        const label = this.statutLabel(nouveauStatut);
        this.decisionResult = `Statut mis à jour : ${label}`;
        this.decisionResultClass =
          nouveauStatut === 'rejete' ? 'dr-danger'
          : nouveauStatut === 'selectionne' ? 'dr-success'
          : 'dr-success';
        this.addToTimeline(
          nouveauStatut === 'rejete' ? 'status-rejet'
          : nouveauStatut === 'selectionne' ? 'status-selectionne'
          : 'status-preselectionne',
          nouveauStatut !== 'rejete',
        );
        this.showToast(`Candidature ${label.toLowerCase()} — notification envoyée.`, 't-success');
        this.decisionComment = '';
        this.isSavingStatus = false;
      },
      error: (err) => {
        const msg = err?.error?.error || err?.message || 'Erreur lors du changement de statut.';
        this.showToast(msg, 't-danger');
        this.isSavingStatus = false;
      },
    });
  }

  statutLabel(statut: string): string {
    switch ((statut || '').toLowerCase()) {
      case 'preselectionne':   return 'Présélectionné';
      case 'selectionne':      return 'Sélectionné';
      case 'rejete':
      case 'refuse':           return 'Refusé';
      case 'sous_examen':      return 'Sous examen';
      case 'dossier_depose':   return 'Dossier déposé';
      case 'soumis':           return 'Soumis';
      case 'inscrit':          return 'Inscrit';
      default:                 return statut || '—';
    }
  }

  toggleDecisionDropdown(): void {
    this.showDecisionDropdown = !this.showDecisionDropdown;
  }

  // ────────────────────────────────────────────────────────────────────
  // OCR — Upload PDF Relevé de Notes + extraction score
  // ────────────────────────────────────────────────────────────────────

  onOcrFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.ocrFile = input.files[0];
      this.ocrFileName = this.ocrFile.name;
      this.ocrResult = null;
    }
  }

  lancerOcrReleveNotes(): void {
    if (!this.candidatureId || !this.ocrFile || this.ocrLoading) return;
    this.ocrLoading = true;
    this.ocrResult = null;

    this.candidatureService
      .analyserOcrCandidature(this.candidatureId, this.ocrFile, this.ocrUpdateScore)
      .subscribe({
        next: (res: any) => {
          this.ocrResult = {
            score_extrait:     res.score_extrait,
            score_declare:     res.score_declare,
            delta:             res.delta,
            flag_fraude:       !!res.flag_fraude,
            confiance:         Number(res.confiance ?? 0),
            moteur:            res.moteur || '—',
            anomalies:         res.anomalies || [],
            texte_preview:     res.texte_preview || '',
            note_extraite_ocr: Number(res.note_extraite_ocr ?? 0),
          };
          if (this.candidat && this.ocrResult.score_extrait != null && this.ocrUpdateScore) {
            this.candidat.score = this.ocrResult.score_extrait;
          }
          this.showToast(
            `OCR terminé (${this.ocrResult.moteur}) — score extrait : ${this.ocrResult.score_extrait ?? '—'}`,
            this.ocrResult.flag_fraude ? 't-warn' : 't-success',
          );
          this.ocrLoading = false;
        },
        error: (err) => {
          const msg = err?.error?.error || err?.message || 'Erreur OCR';
          this.showToast(msg, 't-danger');
          this.ocrLoading = false;
        },
      });
  }

  resetOcr(): void {
    this.ocrFile = null;
    this.ocrFileName = '';
    this.ocrResult = null;
    this.ocrUpdateScore = false;
  }

  get ocrConfianceClass(): string {
    if (!this.ocrResult) return '';
    const c = this.ocrResult.confiance;
    if (this.ocrResult.flag_fraude) return 'ocr-conf-bad';
    if (c >= 0.8) return 'ocr-conf-good';
    if (c >= 0.5) return 'ocr-conf-medium';
    return 'ocr-conf-low';
  }

  // ────────────────────────────────────────────────────────────────────
  // PDF Officiel + QR Code de vérification
  // ────────────────────────────────────────────────────────────────────

  get canGenererPdfOfficiel(): boolean {
    const s = this.currentStatutBackend;
    return ['preselectionne', 'selectionne', 'admis', 'inscrit', 'dossier_depose'].includes(s);
  }

  genererDocumentOfficiel(): void {
    if (!this.candidatureId || this.pdfLoading) return;
    this.pdfLoading = true;
    this.pdfError = '';
    this.pdfBlobUrl = null;

    this.candidatureService.genererAttestation(this.candidatureId, true).subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        this.pdfBlobUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.pdfLoading = false;
        this.showToast('Document officiel généré avec QR code de sécurité.', 't-success');
      },
      error: (err) => {
        const msg = err?.error?.error || err?.message || 'Erreur génération PDF';
        this.pdfError = msg;
        this.pdfLoading = false;
        this.showToast(msg, 't-danger');
      },
    });
  }

  telechargerPdfOfficiel(): void {
    if (!this.candidatureId) return;
    this.candidatureService.genererAttestation(this.candidatureId, true).subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const nom = (this.candidat?.last_name || 'candidat').replace(/ /g, '_');
        const num = (this.candidat?.numero || this.candidatureId).toString();
        const a = document.createElement('a');
        a.href = url;
        a.download = `ISIMM_Attestation_${nom}_${num}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.showToast('Erreur téléchargement PDF', 't-danger'),
    });
  }

  fermerPdfPreview(): void {
    this.pdfBlobUrl = null;
  }

  updateProgress(): void {
    const validCount = this.validCount;
    const rejectedCount = this.rejectedCount;
    const pendingCount = this.pendingCount;
    this.decisionNote =
      pendingCount > 0
        ? rejectedCount > 0
          ? 'Certains documents ont été rejetés. La décision finale est disponible.'
          : 'Des documents manquent, décision en attente.'
        : rejectedCount > 0
          ? 'Certains documents ont été rejetés. La décision finale est disponible.'
          : 'Tous les documents sont validés. Vous pouvez prendre une décision.';
    this.timeline = [
      {
        title: 'Dossier soumis',
        subtitle: 'Le candidat a soumis son dossier complet',
        time: '15/02/2026 — 10:30 · Système',
        tone: 'blue',
      },
      ...this.timeline.filter((item) => item.title !== 'Dossier soumis').slice(0, 50),
    ];
  }

  addToTimeline(docId: string, valid: boolean): void {
    const labelMap: Record<string, string> = {
      d1: 'CIN',
      d2: 'Relevés de notes',
      d3: 'Diplôme Licence',
      d4: 'Photo identité',
      d5: 'Document synthèse',
      'final-approve': 'Décision finale',
      'final-reject': 'Décision finale',
      'final-hold': 'Décision finale',
    };

    const tone: TimelineItem['tone'] = valid
      ? 'green'
      : docId.startsWith('final-')
        ? 'gray'
        : 'gray';
    const statusLabel = valid
      ? 'validé'
      : docId.startsWith('final-')
        ? 'mis en attente / rejeté'
        : 'rejeté';

    this.timeline = [
      {
        title: `${labelMap[docId] || docId} ${statusLabel}`,
        subtitle: valid ? 'Document conforme' : 'Rejeté par la commission',
        time:
          new Date().toLocaleDateString('fr-FR') +
          ' — ' +
          new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) +
          ' · Vous',
        tone,
      },
      ...this.timeline,
    ];
  }

  showToast(message: string, cls: string): void {
    this.toastMsg = message;
    this.toastClass = cls;
    this.toastShow = true;
    window.setTimeout(() => {
      this.toastShow = false;
    }, 2800);
  }
}
