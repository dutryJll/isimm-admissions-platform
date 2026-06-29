import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { CandidaturesConsultationModalComponent } from '../candidatures-master/candidatures-consultation-modal.component';
import { AuthService } from '../../../services/auth.service';
import {
  CommissionContextService,
  CommissionContextOption,
} from '../../../services/commission-context.service';
import { PdfExportService } from '../../../services/pdf-export.service';

interface Candidat {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  cin: string;
  type: 'master' | 'ingenieur';
  formation: string;
  voeux?: string[];
  specialite?: string;
  score: number;
  avisFavorables: number; // pour barres dans tableau
  statut: 'principale' | 'attente';
}

type FinalSelectionDecision = '' | 'lp' | 'la' | 'refuse';
type FinalSelectionPresel = 'oui' | 'non';
type FinalSelectionTypeFilter = 'all' | 'interne' | 'externe';

interface FinalSelectionCandidate {
  id: number;
  rang: number;
  num: string;
  prenom: string;
  nom: string;
  spec: string;
  commissionCategory: CommissionContextOption['category'];
  score: number;
  interne: boolean;
  presel: FinalSelectionPresel;
  statut: FinalSelectionDecision;
  auditState: 'en_attente' | 'conforme' | 'non_conforme';
  auditNote: string;
  obs: string;
}

interface DossierDocumentView {
  id: number | string;
  nom: string;
  statut: string;
  commentaire?: string;
  date_upload?: string;
  fichier_url?: string;
  type_document_detail?: {
    type_document?: string;
    description?: string;
  };
}
interface FinalSelectionFilters {
  session: string;
  type: FinalSelectionTypeFilter;
  auditState: 'all' | 'en_attente' | 'conforme' | 'non_conforme';
  statut: string;
  specialite: string;
  scoreMin: number;
  scoreMax: number;
  search: string;
  hideValides: boolean;
  showOnlyPresel: boolean;
}

interface CommissionMemberAvis {
  membre: string;
  email: string;
  statut: 'Favorable' | 'Défavorable' | 'En attente';
  commentaire: string;
  date: string;
}

@Component({
  selector: 'app-liste-selection',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './liste-selection.html',
  styleUrl: './liste-selection.css',
})
export class ListeSelection implements OnInit {
  @Input() spaceMode: 'membre' | 'responsable' = 'responsable';

  listePrincipale: Candidat[] = [];
  listeAttente: Candidat[] = [];
  activeTab: 'principale' | 'attente' | 'toutes' = 'principale';
  recherche: string = '';
  scoreMinimum: number = 14;
  avisFavorables: number = 85;

  showCommentModal: boolean = false;
  candidatSelectionne: Candidat | null = null;
  commentaire: string = '';

  // Final selection state (moved from dashboard)
  finalSelectionQuotaLpTotal: number = 55;
  finalSelectionQuotaLaTotal: number = 20;
  finalSelectionCandidates: FinalSelectionCandidate[] = [];
  finalSelectionFiltered: FinalSelectionCandidate[] = [];
  finalSelectionSelectedIds: Set<number> = new Set();
  finalSelectionTop100On: boolean = false;
  finalSelectionLocked = false;
  finalDecisionModalOpen = false;
  finalSelectionBulkAction: FinalSelectionDecision = '';
  finalSelectionExportOpen: boolean = false;
  finalSelectionConfirmOpen: boolean = false;
  selectionActionMenuOpenId: number | null = null;
  showGlobalAvisModal = false;
  dossierModalOpen: boolean = false;
  dossierModalLoading: boolean = false;
  dossierModalError = '';
  dossierModalCandidate: FinalSelectionCandidate | null = null;
  dossierModalData: any = null;
  dossierModalDocuments: DossierDocumentView[] = [];
  auditModalOpen = false;
  auditModalCandidate: FinalSelectionCandidate | null = null;
  auditModalDocuments: DossierDocumentView[] = [];
  auditRejetMotif = '';
  auditDecision: 'conforme' | 'non_conforme' = 'conforme';
  finalSelectionConsultationCandidates: FinalSelectionCandidate[] = [];
  finalSelectionConsultationIndex = 0;
  commissionMemberAvisRows: CommissionMemberAvis[] = [
    {
      membre: 'Dr. Fatma Ben Ali',
      email: 'fatma.benali@isimm.tn',
      statut: 'Favorable',
      commentaire: 'Avis global favorable sur la cohérence des dossiers audités.',
      date: '2026-05-20T09:30:00',
    },
    {
      membre: 'M. Sami Trabelsi',
      email: 'sami.trabelsi@isimm.tn',
      statut: 'Défavorable',
      commentaire: 'Réserves sur plusieurs dossiers incomplets côté pièces justificatives.',
      date: '2026-05-20T10:12:00',
    },
    {
      membre: 'Mme Ines Karray',
      email: 'ines.karray@isimm.tn',
      statut: 'En attente',
      commentaire: 'Retour en cours de validation.',
      date: '2026-05-20T11:05:00',
    },
  ];
  finalSelectionToast: { message: string; type: string; visible: boolean } = {
    message: '0 candidats mis a jour',
    type: 't-success',
    visible: false,
  };
  private finalSelectionToastTimer: number | null = null;
  finalSelectionFilters: FinalSelectionFilters = {
    session: '2025/2026',
    type: 'all',
    auditState: 'all',
    statut: 'all',
    specialite: 'all',
    scoreMin: 0,
    scoreMax: 20,
    search: '',
    hideValides: false,
    showOnlyPresel: true,
  };

  // Avis global
  globalOpinion: '' | 'approve' | 'reject' = '';
  globalComment: string = '';

  userRole: string | null = null;
  showDossierButton = false;
  private activeCommissionCategory: CommissionContextOption['category'] | null = null;
  private onDocClickBound: any = null;

  constructor(
    private router: Router,
    private authService: AuthService,
    private dialog: MatDialog,
    private commissionContext: CommissionContextService,
    private pdfExport: PdfExportService,
  ) {}

  ngOnInit(): void {
    const currentUser = this.authService.getCurrentUser();
    this.userRole = currentUser?.role || null;
    this.showDossierButton = true;
    this.commissionContext.activeCommissionId$.subscribe((commissionId) => {
      this.activeCommissionCategory = this.getCommissionCategoryFromId(commissionId);
      this.updateFinalSelectionFiltered();
    });
    this.loadListes();
  }

  ngAfterViewInit(): void {
    this.onDocClickBound = () => (this.selectionActionMenuOpenId = null);
    document.addEventListener('click', this.onDocClickBound);
  }

  ngOnDestroy(): void {
    if (this.onDocClickBound) document.removeEventListener('click', this.onDocClickBound);
  }

  get isResponsableSpace(): boolean {
    return this.spaceMode === 'responsable';
  }

  get currentCommissionDisplay(): string {
    if (this.activeCommissionCategory === 'ingenieur') return 'Cycle Ingénieur';
    if (this.activeCommissionCategory === 'master-ds') return 'Master Data Science';
    if (this.activeCommissionCategory === 'master-gl') return 'Master Génie Logiciel';
    return 'Commission active';
  }

  loadListes(): void {
    this.finalSelectionCandidates = this.buildMockFinalSelectionCandidates();
    this.finalSelectionSelectedIds = new Set(
      this.finalSelectionCandidates.slice(0, 10).map((candidate) => candidate.id),
    );
    this.updateFinalSelectionFiltered();
  }

  private buildMockFinalSelectionCandidates(): FinalSelectionCandidate[] {
    const base = [
      ['Aymen', 'Ben Amor', 'TI', 'ingenieur', 18.7, true, 'oui', 'lp', 'conforme'],
      ['Nour', 'Brahmi', 'DSI', 'master-ds', 17.9, false, 'oui', 'lp', 'conforme'],
      ['Meriem', 'Jemai', 'GL', 'master-gl', 16.8, true, 'oui', 'lp', 'conforme'],
      ['Fares', 'Khelifi', 'RS', 'ingenieur', 15.9, false, 'oui', 'la', 'en_attente'],
      ['Asma', 'Mansouri', 'TI', 'master-gl', 15.1, true, 'oui', 'la', 'en_attente'],
      ['Yassine', 'Riahi', 'DSI', 'master-ds', 14.8, false, 'non', 'la', 'non_conforme'],
      ['Sarra', 'Karray', 'GL', 'master-gl', 14.2, true, 'non', 'refuse', 'non_conforme'],
      ['Oussama', 'Bouzid', 'RS', 'ingenieur', 13.9, false, 'non', 'refuse', 'non_conforme'],
      ['Ines', 'Chokri', 'TI', 'ingenieur', 18.2, true, 'oui', 'lp', 'conforme'],
      ['Wiem', 'Gharbi', 'DSI', 'master-ds', 17.3, false, 'oui', 'lp', 'conforme'],
      ['Houssem', 'Haddad', 'GL', 'master-gl', 16.5, true, 'oui', 'la', 'en_attente'],
      ['Rania', 'Miled', 'RS', 'ingenieur', 15.6, false, 'oui', 'la', 'en_attente'],
      ['Mehdi', 'Sassi', 'TI', 'master-gl', 14.9, true, 'non', 'refuse', 'non_conforme'],
      ['Lina', 'Ben Youssef', 'DSI', 'master-ds', 13.7, false, 'non', 'refuse', 'non_conforme'],
      ['Bassem', 'Ouertani', 'GL', 'master-gl', 17.6, true, 'oui', 'lp', 'conforme'],
      ['Sana', 'Jaziri', 'RS', 'ingenieur', 16.1, false, 'oui', 'lp', 'conforme'],
      ['Amine', 'Trabelsi', 'TI', 'ingenieur', 15.3, true, 'oui', 'la', 'en_attente'],
      ['Farah', 'Masmoudi', 'DSI', 'master-ds', 12.8, false, 'non', 'refuse', 'non_conforme'],
      ['Khalil', 'Zidi', 'GL', 'master-gl', 17.1, true, 'oui', 'lp', 'conforme'],
      ['Nesrine', 'Hamdi', 'RS', 'ingenieur', 14.4, false, 'non', 'la', 'en_attente'],
    ] as Array<
      [
        string,
        string,
        string,
        CommissionContextOption['category'],
        number,
        boolean,
        FinalSelectionPresel,
        FinalSelectionDecision,
        'en_attente' | 'conforme' | 'non_conforme',
      ]
    >;

    return base.map((item, index) => ({
      id: index + 1,
      rang: index + 1,
      num: `2603-${String(index + 1).padStart(5, '0')}-${item[2]}`,
      prenom: item[0],
      nom: item[1],
      spec: item[2],
      commissionCategory: item[3],
      score: item[4],
      interne: item[5],
      presel: item[6],
      statut: item[7],
      auditState: item[8],
      auditNote: '',
      obs: '',
    }));
  }

  filtrer(): void {
    // TODO: Filtrer les listes selon la recherche
  }

  finalSelectionConsult(candidate: FinalSelectionCandidate | null): void {
    // Open the built-in XL dossier modal (in-template) for demo consistency
    if (!candidate) return;
    this.closeSelectionActionMenu();
    this.finalSelectionConsultationCandidates = [candidate];
    this.finalSelectionConsultationIndex = 0;
    this.voirDossierSelection(candidate);
  }

  get canOpenFinalSelectionMassConsultation(): boolean {
    return this.finalSelectionSelectedIds.size > 0;
  }

  openFinalSelectionMassConsultation(): void {
    const list = this.finalSelectionFiltered.filter((candidate) =>
      this.finalSelectionSelectedIds.has(candidate.id),
    );
    if (!list.length) {
      return;
    }

    this.finalSelectionConsultationCandidates = list;
    this.finalSelectionConsultationIndex = 0;
    this.voirDossierSelection(list[0]);
  }

  toggleSelectionActionMenu(candidateId: number, event: MouseEvent): void {
    event.stopPropagation();
    this.selectionActionMenuOpenId =
      this.selectionActionMenuOpenId === candidateId ? null : candidateId;
  }

  closeSelectionActionMenu(): void {
    this.selectionActionMenuOpenId = null;
  }

  prevFinalSelectionConsultation(): void {
    if (this.finalSelectionConsultationIndex <= 0) {
      return;
    }

    this.finalSelectionConsultationIndex -= 1;
    const candidate =
      this.finalSelectionConsultationCandidates[this.finalSelectionConsultationIndex];
    if (candidate) {
      this.voirDossierSelection(candidate);
    }
  }

  nextFinalSelectionConsultation(): void {
    if (
      this.finalSelectionConsultationIndex >=
      this.finalSelectionConsultationCandidates.length - 1
    ) {
      return;
    }

    this.finalSelectionConsultationIndex += 1;
    const candidate =
      this.finalSelectionConsultationCandidates[this.finalSelectionConsultationIndex];
    if (candidate) {
      this.voirDossierSelection(candidate);
    }
  }

  submitGlobalOpinion(): void {
    if (this.globalOpinion === 'reject' && !this.globalComment.trim()) {
      this.finalSelectionToast = {
        message: 'Commentaire obligatoire pour un avis défavorable',
        type: 't-error',
        visible: true,
      };
      setTimeout(() => (this.finalSelectionToast.visible = false), 3000);
      return;
    }

    const targetIds = this.finalSelectionSelectedIds.size
      ? Array.from(this.finalSelectionSelectedIds)
      : this.finalSelectionFiltered.slice(0, 1).map((candidate) => candidate.id);
    const newStatus: FinalSelectionDecision = this.globalOpinion === 'approve' ? 'lp' : 'refuse';

    targetIds.forEach((id) => {
      const candidate = this.finalSelectionCandidates.find((row) => row.id === id);
      if (candidate) {
        candidate.statut = newStatus;
        candidate.obs = this.globalComment.trim();
      }
    });

    this.finalSelectionSelectedIds.clear();
    this.updateFinalSelectionFiltered();
    this.finalSelectionToast = {
      message: 'Avis global appliqué aux candidats de test',
      type: 't-success',
      visible: true,
    };
    setTimeout(() => (this.finalSelectionToast.visible = false), 2500);
  }

  openGlobalAvisModal(): void {
    this.globalOpinion = '';
    this.globalComment = '';
    this.showGlobalAvisModal = true;
  }

  closeGlobalAvisModal(): void {
    this.showGlobalAvisModal = false;
    this.globalOpinion = '';
    this.globalComment = '';
  }

  submitMemberGlobalOpinion(): void {
    if (!this.globalOpinion) {
      this.showFinalSelectionToast('Veuillez choisir un avis global', 't-error');
      return;
    }

    if (!this.globalComment.trim()) {
      this.showFinalSelectionToast('Le commentaire est obligatoire', 't-error');
      return;
    }

    this.showFinalSelectionToast('Avis global de la commission soumis', 't-success');
    this.closeGlobalAvisModal();
  }

  getMemberAvisBadgeClass(statut: CommissionMemberAvis['statut']): string {
    switch (statut) {
      case 'Favorable':
        return 'member-avis-favorable';
      case 'Défavorable':
        return 'member-avis-defavorable';
      default:
        return 'member-avis-en-attente';
    }
  }

  refreshCommissionMemberAvis(): void {
    this.showFinalSelectionToast('Tableau des avis actualisé', 't-success');
  }

  openFinalDecisionModal(): void {
    if (!this.isResponsableSpace) {
      return;
    }

    this.finalDecisionModalOpen = true;
  }

  closeFinalDecisionModal(): void {
    this.finalDecisionModalOpen = false;
  }

  confirmFinalDecisionWorkflow(): void {
    const scope = this.activeCommissionCategory;
    const targetCandidates = this.finalSelectionCandidates
      .filter((candidate) => !scope || candidate.commissionCategory === scope)
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

    const lpCount = this.finalSelectionQuotaLpTotal;
    const laCount = this.finalSelectionQuotaLaTotal;
    targetCandidates.forEach((candidate, index) => {
      if (index < lpCount) {
        candidate.statut = 'lp';
        return;
      }

      if (index < lpCount + laCount) {
        candidate.statut = 'la';
        return;
      }

      candidate.statut = 'refuse';
    });

    this.finalSelectionLocked = true;
    this.finalSelectionSelectedIds.clear();
    this.updateFinalSelectionFiltered();
    this.closeFinalDecisionModal();
    this.showFinalSelectionToast(
      'Décision finale appliquée: LP/LA clôturées, session verrouillée et export prêt.',
      't-success',
    );
  }

  scrollToGlobalAvis(): void {
    const section = document.getElementById('avis-global-section');
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  imprimerListe(): void {
    window.print();
  }

  voirDossier(id: number): void {
    this.router.navigate(['/commission/dossier', id], {
      queryParams: { source: 'selection' },
    });
  }

  voirDossierSelection(candidate: FinalSelectionCandidate): void {
    if (!candidate) return;
    this.dossierModalCandidate = candidate;
    this.dossierModalLoading = true;
    this.dossierModalError = '';
    this.dossierModalOpen = true;
    this.dossierModalData = {
      score_completude: candidate.score,
      statut: candidate.statut || 'lp',
      master_nom: candidate.spec,
      candidature_numero: candidate.num,
      documents: [
        {
          id: 1,
          nom: 'Diplôme',
          statut: 'valide',
          commentaire: 'Pièce conforme',
          date_upload: new Date().toISOString(),
          fichier_url: 'https://example.com/dossier.pdf',
          type_document_detail: { type_document: 'pdf', description: 'Diplôme de test' },
        },
        {
          id: 2,
          nom: 'Relevé de notes',
          statut: 'en attente',
          commentaire: 'Document fictif',
          date_upload: new Date().toISOString(),
          fichier_url: 'https://example.com/releve.pdf',
          type_document_detail: { type_document: 'pdf', description: 'Relevé de notes de test' },
        },
      ],
    };
    this.dossierModalDocuments = this.dossierModalData.documents;
    this.dossierModalLoading = false;
  }

  closeDossierModal(): void {
    this.dossierModalOpen = false;
    this.dossierModalCandidate = null;
    this.dossierModalData = null;
    this.dossierModalDocuments = [];
    this.dossierModalError = '';
    this.dossierModalLoading = false;
    this.finalSelectionConsultationCandidates = [];
    this.finalSelectionConsultationIndex = 0;
  }

  focusConsultationCandidate(index: number): void {
    if (index < 0 || index >= this.finalSelectionConsultationCandidates.length) {
      return;
    }

    const candidate = this.finalSelectionConsultationCandidates[index];
    if (candidate) {
      this.finalSelectionConsultationIndex = index;
      this.voirDossierSelection(candidate);
    }
  }

  openAuditModal(candidate: FinalSelectionCandidate): void {
    this.closeSelectionActionMenu();
    this.auditModalCandidate = candidate;
    this.auditDecision = candidate.auditState === 'non_conforme' ? 'non_conforme' : 'conforme';
    this.auditRejetMotif = candidate.auditNote || '';
    this.auditModalDocuments = [
      {
        id: 1,
        nom: 'Diplôme',
        statut: 'valide',
        commentaire: 'Pièce conforme',
        date_upload: new Date().toISOString(),
        fichier_url: 'https://example.com/dossier.pdf',
        type_document_detail: { type_document: 'pdf', description: 'Diplôme de test' },
      },
      {
        id: 2,
        nom: 'Relevé de notes',
        statut: 'en attente',
        commentaire: 'Document fictif',
        date_upload: new Date().toISOString(),
        fichier_url: 'https://example.com/releve.pdf',
        type_document_detail: { type_document: 'pdf', description: 'Relevé de notes de test' },
      },
    ];
    this.auditModalOpen = true;
  }

  closeAuditModal(): void {
    this.auditModalOpen = false;
    this.auditModalCandidate = null;
    this.auditModalDocuments = [];
    this.auditRejetMotif = '';
    this.auditDecision = 'conforme';
  }

  validateAuditDecision(): void {
    if (!this.auditModalCandidate) {
      return;
    }

    if (this.auditDecision === 'non_conforme' && !this.auditRejetMotif.trim()) {
      this.showFinalSelectionToast('Le motif de rejet est obligatoire', 't-error');
      return;
    }

    this.auditModalCandidate.auditState = this.auditDecision;
    this.auditModalCandidate.auditNote =
      this.auditDecision === 'non_conforme' ? this.auditRejetMotif.trim() : '';
    this.updateFinalSelectionFiltered();
    this.showFinalSelectionToast('Contrôle du dossier enregistré', 't-success');
    this.closeAuditModal();
  }

  launchAutomaticReepchage(): void {
    const candidate = this.finalSelectionCandidates.find((row) => row.statut === 'la');
    if (!candidate) {
      this.showFinalSelectionToast('Aucun candidat éligible au repêchage', 't-info');
      return;
    }

    candidate.statut = 'lp';
    candidate.obs = 'Repêché automatiquement';
    this.updateFinalSelectionFiltered();
    this.showFinalSelectionToast(
      `Repêchage automatique lancé pour ${candidate.prenom} ${candidate.nom}`,
      't-success',
    );
  }

  async generateFinalPv(): Promise<void> {
    this.finalSelectionExportOpen = false;

    const pvId = this.buildFinalSelectionPvId();
    const rows = this.getFinalSelectionExportRows();
    const exportHost = this.createFinalSelectionExportHost(rows, pvId);

    try {
      await this.pdfExport.generatePdfFromElement(exportHost, {
        filename: this.buildFinalSelectionFilename(),
        embedQr: true,
        verificationBaseUrl: `${window.location.origin}/api/public/verifier-pv`,
        verificationId: pvId,
      });
      this.showFinalSelectionToast('PV final généré avec QR de vérification', 't-success');
    } catch (error) {
      console.error('Erreur génération PV final', error);
      this.showFinalSelectionToast('Impossible de générer le PV final', 't-error');
    } finally {
      exportHost.remove();
    }
  }

  notifyAndPublish(): void {
    this.openFinalSelectionConfirm();
  }

  getDossierTitle(candidate: FinalSelectionCandidate | null): string {
    if (!candidate) return 'Détail dossier';
    return `Détail dossier - ${candidate.nom}`;
  }

  isPdf(url?: string): boolean {
    return !!url && /\.pdf($|\?)/i.test(url);
  }

  ajouterCommentaire(candidat: Candidat): void {
    this.candidatSelectionne = candidat;
    this.showCommentModal = true;
  }

  fermerModal(): void {
    this.showCommentModal = false;
    this.candidatSelectionne = null;
    this.commentaire = '';
  }

  sauvegarderCommentaire(): void {
    if (this.candidatSelectionne) this.fermerModal();
  }

  /********* Final selection helpers (moved) *********/
  get finalSelectionSpecialiteOptions(): string[] {
    const uniques = new Set(this.finalSelectionCandidates.map((c) => c.spec));
    return Array.from(uniques).sort();
  }

  updateFinalSelectionFiltered(): void {
    const scoreMin = Number(this.finalSelectionFilters.scoreMin) || 0;
    const scoreMax = Number(this.finalSelectionFilters.scoreMax) || 20;
    const search = (this.finalSelectionFilters.search || '').toLowerCase();
    const type = this.finalSelectionFilters.type;
    const auditState = this.finalSelectionFilters.auditState;
    const specialite = this.finalSelectionFilters.specialite;
    const hideValides = this.finalSelectionFilters.hideValides;
    const scope = this.isResponsableSpace ? null : this.activeCommissionCategory;
    let rows = this.finalSelectionCandidates.slice();
    rows = rows.filter((candidate) => !scope || candidate.commissionCategory === scope);
    if (this.finalSelectionFilters.showOnlyPresel) rows = rows.filter((c) => c.presel === 'oui');
    rows = rows.filter((c) => c.score >= scoreMin && c.score <= scoreMax);
    if (search)
      rows = rows.filter(
        (c) =>
          `${c.prenom || ''} ${c.nom || ''}`.toLowerCase().includes(search) ||
          (c.nom || '').toLowerCase().includes(search) ||
          (c.prenom || '').toLowerCase().includes(search) ||
          (c.num || '').toLowerCase().includes(search),
      );
    if (type === 'interne') rows = rows.filter((c) => c.interne);
    else if (type === 'externe') rows = rows.filter((c) => !c.interne);
    if (specialite && specialite !== 'all') rows = rows.filter((c) => c.spec === specialite);
    if (auditState && auditState !== 'all') rows = rows.filter((c) => c.auditState === auditState);
    // Filtre par statut selection
    const statutFilter = this.finalSelectionFilters.statut;
    if (statutFilter && statutFilter !== 'all')
      rows = rows.filter((c) => c.statut === statutFilter);
    if (hideValides) rows = rows.filter((c) => !c.statut);
    if (this.finalSelectionTop100On)
      rows = rows
        .slice()
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
        .slice(0, 100);
    this.finalSelectionFiltered = rows;
  }

  private getCommissionCategoryFromId(
    commissionId: number | null,
  ): CommissionContextOption['category'] | null {
    if (commissionId === null) {
      return null;
    }

    if (commissionId === 1) {
      return 'ingenieur';
    }

    if (commissionId === 2) {
      return 'master-ds';
    }

    if (commissionId === 3) {
      return 'master-gl';
    }

    return null;
  }

  isFinalSelectionRowSelected(id: number): boolean {
    return this.finalSelectionSelectedIds.has(id);
  }
  areAllFinalSelectionRowsSelected(): boolean {
    const rows = this.finalSelectionFiltered;
    return rows.length > 0 && rows.every((row) => this.finalSelectionSelectedIds.has(row.id));
  }
  toggleFinalSelectionRow(id: number, checked: boolean): void {
    if (checked) this.finalSelectionSelectedIds.add(id);
    else this.finalSelectionSelectedIds.delete(id);
  }
  toggleFinalSelectionAll(checked: boolean): void {
    this.finalSelectionFiltered.forEach((row) => {
      if (checked) this.finalSelectionSelectedIds.add(row.id);
      else this.finalSelectionSelectedIds.delete(row.id);
    });
  }
  getFinalSelectionSelectedCountLabel(): string {
    const count = this.finalSelectionSelectedIds.size;
    const plural = count > 1 ? 's' : '';
    return `${count} candidat${plural} selectionne${plural}`;
  }

  getFinalSelectionScoreClass(score: number): string {
    if (score > 15) return 'sf-green';
    if (score >= 10) return 'sf-amber';
    return 'sf-red';
  }
  getFinalSelectionScorePercent(score: number): number {
    return Math.min(100, Math.round((Number(score) / 20) * 100));
  }
  getFinalSelectionStatusClass(status: FinalSelectionDecision): string {
    if (status === 'lp') return 's-lp';
    if (status === 'la') return 's-la';
    if (status === 'refuse') return 's-refuse';
    return 's-empty';
  }
  onFinalSelectionStatusChange(): void {
    this.updateFinalSelectionFiltered();
  }
  onFinalSelectionObservationChange(): void {
    this.updateFinalSelectionFiltered();
  }

  getFinalSelectionLpCount(): number {
    return this.finalSelectionCandidates.filter((c) => c.statut === 'lp').length;
  }
  getFinalSelectionLaCount(): number {
    return this.finalSelectionCandidates.filter((c) => c.statut === 'la').length;
  }
  getFinalSelectionRefuseCount(): number {
    return this.finalSelectionCandidates.filter((c) => c.statut === 'refuse').length;
  }
  getFinalSelectionValidatedCount(): number {
    return this.getFinalSelectionLpCount() + this.getFinalSelectionLaCount();
  }

  getFinalSelectionAverageScore(): number {
    if (!this.finalSelectionCandidates.length) return 0;
    const total = this.finalSelectionCandidates.reduce((sum, c) => sum + Number(c.score || 0), 0);
    return total / this.finalSelectionCandidates.length;
  }

  getFinalSelectionLpPercent(): number {
    if (!this.finalSelectionQuotaLpTotal) return 0;
    return Math.min(
      100,
      Math.round((this.getFinalSelectionLpCount() / this.finalSelectionQuotaLpTotal) * 100),
    );
  }
  getFinalSelectionLaPercent(): number {
    if (!this.finalSelectionQuotaLaTotal) return 0;
    return Math.min(
      100,
      Math.round((this.getFinalSelectionLaCount() / this.finalSelectionQuotaLaTotal) * 100),
    );
  }

  getFinalSelectionQuotaFillClass(kind: 'lp' | 'la'): string {
    const count = kind === 'lp' ? this.getFinalSelectionLpCount() : this.getFinalSelectionLaCount();
    const total = kind === 'lp' ? this.finalSelectionQuotaLpTotal : this.finalSelectionQuotaLaTotal;
    const warnThreshold = kind === 'lp' ? 50 : 18;
    if (count > total) return 'qf-full';
    if (count >= warnThreshold) return 'qf-warn';
    return kind === 'lp' ? 'qf-lp' : 'qf-la';
  }

  getFinalSelectionQuotaHint(kind: 'lp' | 'la'): string {
    const count = kind === 'lp' ? this.getFinalSelectionLpCount() : this.getFinalSelectionLaCount();
    const total = kind === 'lp' ? this.finalSelectionQuotaLpTotal : this.finalSelectionQuotaLaTotal;
    if (count > total) return 'Quota depasse !';
    const remaining = total - count;
    return `${remaining} place(s) restante(s) - ${kind.toUpperCase()}`;
  }

  getFinalSelectionQuotaHintClass(kind: 'lp' | 'la'): string {
    const count = kind === 'lp' ? this.getFinalSelectionLpCount() : this.getFinalSelectionLaCount();
    const total = kind === 'lp' ? this.finalSelectionQuotaLpTotal : this.finalSelectionQuotaLaTotal;
    const warnThreshold = kind === 'lp' ? 50 : 18;
    if (count > total) return 'qh-full';
    if (count >= warnThreshold) return 'qh-warn';
    return 'qh-ok';
  }

  toggleFinalSelectionTop100(): void {
    this.finalSelectionTop100On = !this.finalSelectionTop100On;
    this.updateFinalSelectionFiltered();
  }
  resetFinalSelectionFilters(): void {
    this.finalSelectionFilters = {
      session: '2025/2026',
      type: 'all',
      auditState: 'all',
      statut: 'all',
      specialite: 'all',
      scoreMin: 0,
      scoreMax: 20,
      search: '',
      hideValides: false,
      showOnlyPresel: true,
    };
    this.finalSelectionTop100On = false;
    this.updateFinalSelectionFiltered();
  }

  applyFinalSelectionBulkAction(): void {
    if (this.finalSelectionLocked) {
      this.showFinalSelectionToast('Session verrouillée après décision finale.', 't-info');
      return;
    }

    if (!this.finalSelectionBulkAction) return;
    const selectedIds = Array.from(this.finalSelectionSelectedIds);
    selectedIds.forEach((id) => {
      const candidate = this.finalSelectionCandidates.find((c) => c.id === id);
      if (candidate) candidate.statut = this.finalSelectionBulkAction;
    });
    this.finalSelectionSelectedIds.clear();
    this.finalSelectionBulkAction = '';
    this.updateFinalSelectionFiltered();
    this.showFinalSelectionToast(`${selectedIds.length} candidat(s) mis a jour`, 't-success');
  }

  // finalSelectionConsult handled above (opens consultation modal)

  toggleFinalSelectionExportMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.finalSelectionExportOpen = !this.finalSelectionExportOpen;
  }
  onFinalSelectionPageClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.export-wrap')) this.finalSelectionExportOpen = false;
    if (!target?.closest('.action-menu-container')) this.closeSelectionActionMenu();
  }
  openFinalSelectionConfirm(): void {
    this.finalSelectionConfirmOpen = true;
    this.finalSelectionExportOpen = false;
  }
  hideFinalSelectionConfirm(): void {
    this.finalSelectionConfirmOpen = false;
  }
  confirmFinalSelectionNotify(): void {
    this.hideFinalSelectionConfirm();
    this.showFinalSelectionToast(
      'Resultats publies - notifications envoyees aux candidats',
      't-success',
    );
  }
  async finalSelectionExportPdf(): Promise<void> {
    await this.generateFinalPv();
  }
  finalSelectionExportExcel(): void {
    this.finalSelectionExportOpen = false;
    this.showFinalSelectionToast('Export Excel (demo)', 't-info');
  }

  private buildFinalSelectionPvId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return `pv-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }

  private buildFinalSelectionFilename(): string {
    const commissionLabel = (this.currentCommissionDisplay || 'commission').replace(/\s+/g, '-');
    return `pv-final-${commissionLabel.toLowerCase()}.pdf`;
  }

  private getFinalSelectionExportRows(): FinalSelectionCandidate[] {
    // MOD v6 §6 — La liste / PV officiel doit contenir TOUS les candidats admis
    // (Liste Principale 'lp' + Liste d'Attente 'la'), pas uniquement les lignes
    // cochées (sinon le PDF ne contenait qu'un seul candidat).
    const admitted = this.finalSelectionFiltered.filter(
      (candidate) => candidate.statut === 'lp' || candidate.statut === 'la',
    );
    if (admitted.length > 0) {
      return admitted;
    }

    // Repli : lignes explicitement sélectionnées, sinon toute la liste filtrée.
    const selectedRows = this.finalSelectionFiltered.filter((candidate) =>
      this.finalSelectionSelectedIds.has(candidate.id),
    );
    return selectedRows.length > 0 ? selectedRows : this.finalSelectionFiltered.slice(0, 50);
  }

  private createFinalSelectionExportHost(
    rows: FinalSelectionCandidate[],
    pvId: string,
  ): HTMLElement {
    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-10000px';
    host.style.top = '0';
    host.style.width = '1180px';
    host.style.background = '#ffffff';
    host.style.padding = '28px';
    host.style.color = '#0f172a';
    host.style.fontFamily = 'Arial, sans-serif';

    const verificationUrl = `${window.location.origin}/api/public/verifier-pv?id=${encodeURIComponent(pvId)}`;
    host.innerHTML = `
      <section style="border:1px solid #dbe3ee;border-radius:18px;padding:24px;background:#fff;">
        <div style="display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:20px;">
          <div>
            <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">PV officiel de sélection</div>
            <h1 style="margin:6px 0 8px;font-size:24px;line-height:1.2;color:#0f172a;">${this.currentCommissionDisplay}</h1>
            <div style="color:#475569;font-size:14px;">Sélection finale publiée le ${new Date().toLocaleString('fr-FR')}</div>
          </div>
          <div style="text-align:right;max-width:260px;">
            <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;">Référence PV</div>
            <div style="margin-top:6px;padding:10px 12px;border-radius:12px;background:#f8fafc;border:1px solid #dbe3ee;font-weight:700;word-break:break-all;">${pvId}</div>
            <div style="margin-top:8px;font-size:11px;color:#64748b;word-break:break-all;">${verificationUrl}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
          <div style="border:1px solid #dbe3ee;border-radius:14px;padding:14px;background:#f8fbff;">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700;">Total candidats</div>
            <div style="margin-top:6px;font-size:22px;font-weight:800;">${this.finalSelectionCandidates.length}</div>
          </div>
          <div style="border:1px solid #dbe3ee;border-radius:14px;padding:14px;background:#f8fbff;">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700;">LP</div>
            <div style="margin-top:6px;font-size:22px;font-weight:800;">${this.getFinalSelectionLpCount()}</div>
          </div>
          <div style="border:1px solid #dbe3ee;border-radius:14px;padding:14px;background:#f8fbff;">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700;">LA</div>
            <div style="margin-top:6px;font-size:22px;font-weight:800;">${this.getFinalSelectionLaCount()}</div>
          </div>
          <div style="border:1px solid #dbe3ee;border-radius:14px;padding:14px;background:#f8fbff;">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700;">Refusés</div>
            <div style="margin-top:6px;font-size:22px;font-weight:800;">${this.getFinalSelectionRefuseCount()}</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
          <thead>
            <tr style="background:#0f172a;color:#fff;">
              <th style="padding:10px;text-align:left;width:8%;">Rang</th>
              <th style="padding:10px;text-align:left;width:18%;">N°</th>
              <th style="padding:10px;text-align:left;width:26%;">Candidat</th>
              <th style="padding:10px;text-align:left;width:14%;">Spécialité</th>
              <th style="padding:10px;text-align:center;width:12%;">Score</th>
              <th style="padding:10px;text-align:center;width:11%;">Présel.</th>
              <th style="padding:10px;text-align:center;width:11%;">Statut</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (candidate, index) => `
              <tr style="border-bottom:1px solid #e2e8f0;background:${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="padding:10px;">${candidate.rang}</td>
                <td style="padding:10px;word-break:break-all;">${candidate.num}</td>
                <td style="padding:10px;">${candidate.prenom} ${candidate.nom}</td>
                <td style="padding:10px;">${candidate.spec}</td>
                <td style="padding:10px;text-align:center;font-weight:700;">${candidate.score.toFixed(2)}</td>
                <td style="padding:10px;text-align:center;">${candidate.presel.toUpperCase()}</td>
                <td style="padding:10px;text-align:center;">${candidate.statut.toUpperCase()}</td>
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </section>
    `;

    document.body.appendChild(host);
    return host;
  }

  private showFinalSelectionToast(message: string, type: string): void {
    this.finalSelectionToast = { message, type, visible: true };
    if (this.finalSelectionToastTimer) window.clearTimeout(this.finalSelectionToastTimer);
    this.finalSelectionToastTimer = window.setTimeout(() => {
      this.finalSelectionToast.visible = false;
    }, 3500);
  }
}
