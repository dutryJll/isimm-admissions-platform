import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  CommissionContextService,
  CommissionContextOption,
} from '../../../services/commission-context.service';
import { PdfExportService } from '../../../services/pdf-export.service';
import { CandidatureService } from '../../../services/candidature.service';

interface PieceJustificative {
  nom: string;
  statut: 'ok' | 'missing';
}

type MasterStatus = 'Présélectionné' | 'Sélectionné' | 'Refusé';
type CandidatStatut = MasterStatus | 'sous_examen' | 'dossier_depose';

const STATUT_BACKEND: Record<MasterStatus, string> = {
  'Présélectionné': 'preselectionne',
  'Sélectionné':    'selectionne',
  'Refusé':         'rejete',
};

interface Candidat {
  id: number;
  numeroCandidature: string;
  nom: string;
  master: string;
  master_id?: number;       // ID Django du master (pour l'appel PDF)
  specialiteDiplome: string; // Diplôme d'origine du candidat (depuis DonneesAcademiques)
  score: number;
  etatDossier: 'Complet' | 'Incomplet';
  statut: CandidatStatut;
  pieces: PieceJustificative[];
  email: string;
  cin: string;
  dateCandidature: string;
  commentaire?: string;
}

interface StatistiqueCard {
  label: string;
  nombre: number;
  theme: 'blue' | 'green' | 'amber' | 'red';
  icon: string;
}

@Component({
  selector: 'app-candidatures-master',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './candidatures-master.component.html',
  styleUrls: ['./candidatures-master.component.css'],
})
export class CandidaturesMasterComponent implements OnInit, OnChanges {
  @Input() availableCommissions: { id: number; nom: string }[] = [];
  @Input() activeCommissionId: number | null = null;

  candidatsList: Candidat[] = [];
  candidatsFiltres: Candidat[] = [];
  selectedIds: number[] = [];
  activeKebab: number | null = null;
  isLoading = false;
  loadError: string | null = null;
  isGenerating = false;          // verrou pendant la génération PDF
  currentMasterId: number | null = null;  // master_id extrait du premier résultat API

  selectedCommissionId: number | null = null;
  private activeCommissionCategory: CommissionContextOption['category'] | null = null;
  selectedYear = '';
  selectedSpecialite = '';
  selectedSpecialiteDiplome = '';        // filtre par diplôme d'origine
  filtreStatut = '';
  recherche = '';
  distinctYears: string[] = [];
  availableSpecialites: string[] = [];
  specialitesDiplome: { nom: string; abreviation: string }[] = []; // chargé depuis l'API

  consultationModalOpen = false;
  consultationCandidates: Candidat[] = [];
  consultationIndex = 0;
  // consultation UI state
  activeConsultationTab: 'details' | 'documents' | 'timeline' = 'details';
  timelineEntries: Array<{ date: string; author: string; note: string }> = [];
  newTimelineNote = '';

  avisModalOpen = false;
  avisCandidate: Candidat | null = null;
  avisStatut: MasterStatus = 'Présélectionné';
  avisCommentaire = '';

  constructor(
    private commissionContext: CommissionContextService,
    private router: Router,
    private pdfExport: PdfExportService,
    private candidatureService: CandidatureService,
  ) {}

  private onDocumentClickBound: any = null;

  ngOnInit(): void {
    this.selectedCommissionId = this.activeCommissionId;
    this.chargerCandidatures();
  }

  chargerCandidatures(): void {
    this.isLoading = true;
    this.loadError = null;
    this.candidatureService.getCandidaturesCommissionClassees().subscribe({
      next: (data: any[]) => {
        this.candidatsList = (data || []).map((item, index) =>
          this.mapApiToCandidatMaster(item, index),
        );

        if (data && data.length > 0) {
          this.currentMasterId = data[0].master ?? data[0].master_id ?? null;

          if (this.currentMasterId) {
            this.chargerSpecialitesDiplome(this.currentMasterId);
          }
        }

        this.isLoading = false;
        this.rebuildDerivedLists();
      },
      error: () => {
        this.isLoading = false;
        this.loadError = 'Impossible de charger les candidatures.';
        this.candidatsList = [];
        this.rebuildDerivedLists();
      },
    });
  }

  private mapApiToCandidatMaster(item: any, index: number): Candidat {
    const statutRaw: string = (item.statut || '').toLowerCase();
    let statut: CandidatStatut = 'Présélectionné';
    if (statutRaw === 'selectionne' || statutRaw === 'inscrit') {
      statut = 'Sélectionné';
    } else if (statutRaw.includes('refus') || statutRaw === 'rejete') {
      statut = 'Refusé';
    } else if (statutRaw === 'dossier_depose') {
      statut = 'dossier_depose';
    } else if (statutRaw === 'sous_examen' || statutRaw === 'soumis') {
      statut = 'sous_examen';
    }
    return {
      id: item.id ?? index + 1,
      numeroCandidature: item.numero || `CAND-${item.id}`,
      nom: item.candidat_nom || '',
      master: item.master_nom || item.specialite || '',
      master_id: item.master ?? item.master_id,
      specialiteDiplome: item.specialite_diplome || '',
      score: item.score ?? 0,
      etatDossier: item.dossier_depose ? 'Complet' : 'Incomplet',
      statut,
      email: item.candidat_email || '',
      cin: item.candidat_cin || '',
      dateCandidature: item.date_soumission || new Date().toISOString().slice(0, 10),
      commentaire: '',
      pieces: [],
    };
  }

  chargerSpecialitesDiplome(masterId: number): void {
    if (!masterId) {
      this.specialitesDiplome = [];
      return;
    }

    this.candidatureService.getSpecialitesAdmissibles(masterId).subscribe({
      next: (res: any) => {
        if (res && res.specialites && Array.isArray(res.specialites)) {
          this.specialitesDiplome = res.specialites;
        } else if (Array.isArray(res)) {
          this.specialitesDiplome = res;
        } else {
          this.specialitesDiplome = [];
        }
        this.appliquerFiltres();
      },
      error: (err: any) => {
        console.error('Erreur lors du chargement des spécialités admissibles', err);
        this.specialitesDiplome = [];
      },
    });
  }

  ngAfterViewInit(): void {
    this.onDocumentClickBound = () => (this.activeKebab = null);
    document.addEventListener('click', this.onDocumentClickBound);
  }

  ngOnDestroy(): void {
    if (this.onDocumentClickBound) {
      document.removeEventListener('click', this.onDocumentClickBound);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeCommissionId'] && !changes['activeCommissionId'].firstChange) {
      this.selectedCommissionId = this.activeCommissionId;
      this.appliquerFiltres();
    }
    if (changes['availableCommissions'] && !changes['availableCommissions'].firstChange) {
      this.appliquerFiltres();
    }
  }

  private rebuildDerivedLists(): void {
    this.distinctYears = Array.from(
      new Set(this.candidatsList.map((c) => new Date(c.dateCandidature).getFullYear())),
    )
      .map(String)
      .sort((a, b) => Number(b) - Number(a));

    // availableSpecialites supprimé — chargerSpecialitesDiplome() pilote tout
    this.appliquerFiltres();
  }

  appliquerFiltres(): void {
    const search = this.recherche.trim().toLowerCase();

    this.candidatsFiltres = this.candidatsList.filter((c) => {
      const scope = this.activeCommissionCategory;
      const matchesCommission =
        !scope ||
        (scope === 'master-ds' && c.master.includes('DSI')) ||
        (scope === 'master-gl' && c.master.includes('GL'));

      const matchesYear =
        !this.selectedYear ||
        String(new Date(c.dateCandidature).getFullYear()) === String(this.selectedYear);

      const matchesSpecialite =
        !this.selectedSpecialiteDiplome ||
        c.specialiteDiplome === this.selectedSpecialiteDiplome;

      const matchesStatus = !this.filtreStatut || c.statut === this.filtreStatut;

      const matchesSearch =
        !search ||
        c.numeroCandidature.toLowerCase().includes(search) ||
        c.nom.toLowerCase().includes(search) ||
        c.email.toLowerCase().includes(search) ||
        c.cin.toLowerCase().includes(search) ||
        (c.specialiteDiplome && c.specialiteDiplome.toLowerCase().includes(search)) ||
        c.statut.toLowerCase().includes(search);

      return matchesCommission && matchesYear && matchesSpecialite && matchesStatus && matchesSearch;
    });

    this.selectedIds = this.selectedIds.filter((id) =>
      this.candidatsFiltres.some((c) => c.id === id),
    );
  }

  private getCommissionCategoryFromId(
    commissionId: number | null,
  ): CommissionContextOption['category'] | null {
    if (commissionId === null) return null;
    if (commissionId === 1) return 'ingenieur';
    if (commissionId === 2) return 'master-ds';
    if (commissionId === 3) return 'master-gl';
    return null;
  }

  reinitialiserFiltres(): void {
    this.selectedCommissionId = this.activeCommissionId;
    this.selectedYear = '';
    this.selectedSpecialiteDiplome = '';
    this.filtreStatut = '';
    this.recherche = '';
    this.appliquerFiltres();
  }

  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedIds = this.candidatsFiltres.map((candidat) => candidat.id);
    } else {
      this.selectedIds = [];
    }
  }

  toggleSelect(id: number): void {
    if (this.selectedIds.includes(id)) {
      this.selectedIds = this.selectedIds.filter((selectedId) => selectedId !== id);
      return;
    }
    this.selectedIds = [...this.selectedIds, id];
  }

  isSelected(id: number): boolean {
    return this.selectedIds.includes(id);
  }

  isAllVisibleSelected(): boolean {
    return (
      this.candidatsFiltres.length > 0 &&
      this.candidatsFiltres.every((candidat) => this.isSelected(candidat.id))
    );
  }

  /**
   * Génère le PDF officiel ISIMM (LISTE PRINCIPALE + LISTE D'ATTENTE)
   * pour TOUTE la promotion du parcours actuel.
   * Indépendant des checkboxes — accessible en un seul clic.
   */
  genererListeOfficielle(): void {
    const masterId = this.currentMasterId
      ?? this.candidatsFiltres[0]?.master_id
      ?? null;

    if (!masterId) {
      window.alert(
        'Impossible de déterminer le master. Assurez-vous que des candidatures sont chargées.',
      );
      return;
    }

    if (this.candidatsFiltres.length === 0) {
      window.alert('Aucune candidature à exporter.');
      return;
    }

    this.isGenerating = true;

    this.candidatureService.genererListeOfficielle(masterId, 'SELECTION').subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const masterLabel = this.getSpecialiteBadgeLabel(
          this.candidatsFiltres[0]?.master || 'Master',
        );
        a.download = `ISIMM_Liste_Selection_${masterLabel}_${new Date().toISOString().slice(0, 10)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.isGenerating = false;
      },
      error: (err: any) => {
        console.error('Erreur génération PDF liste officielle :', err);
        window.alert(
          'Erreur lors de la génération du PDF. Vérifiez que le service candidature est démarré.',
        );
        this.isGenerating = false;
      },
    });
  }

  telechargerZIP(): void {
    const count = this.selectedCandidates.length || this.candidatsFiltres.length;
    window.alert(`Téléchargement ZIP lancé pour ${count} candidature(s)`);
  }

  get selectedCandidates(): Candidat[] {
    return this.candidatsFiltres.filter((candidat) => this.isSelected(candidat.id));
  }

  get canOpenMassConsultation(): boolean {
    return this.selectedIds.length > 0;
  }

  openMassConsultation(): void {
    const list = this.selectedCandidates;
    if (list.length === 0) {
      return;
    }
    this.consultationCandidates = list;
    this.consultationIndex = 0;
    this.consultationModalOpen = true;
    this.closeActionMenu();
  }

  openConsultation(candidate: Candidat): void {
    this.closeActionMenu();
    this.router.navigate(['/commission/dossier', candidate.id], {
      queryParams: { source: 'commission', type: 'master' },
    });
  }

  telechargerAttestation(candidate: Candidat): void {
    this.closeActionMenu();
    this.candidatureService.genererAttestation(candidate.id, true).subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ISIMM_Attestation_${candidate.nom.replace(/ /g, '_')}_${candidate.numeroCandidature}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => window.alert('Erreur lors de la génération de l\'attestation PDF.'),
    });
  }

  openAvis(candidate: Candidat): void {
    this.avisCandidate = candidate;
    const settable: MasterStatus[] = ['Présélectionné', 'Sélectionné', 'Refusé'];
    this.avisStatut = settable.includes(candidate.statut as MasterStatus)
      ? (candidate.statut as MasterStatus)
      : 'Présélectionné';
    this.avisCommentaire = candidate.commentaire || '';
    this.avisModalOpen = true;
    this.closeActionMenu();
  }

  closeConsultation(): void {
    this.consultationModalOpen = false;
    this.consultationCandidates = [];
    this.consultationIndex = 0;
  }

  prevConsultation(): void {
    if (this.consultationIndex > 0) {
      this.consultationIndex -= 1;
    }
  }

  nextConsultation(): void {
    if (this.consultationIndex < this.consultationCandidates.length - 1) {
      this.consultationIndex += 1;
    }
  }

  get consultationCurrent(): Candidat | undefined {
    return this.consultationCandidates[this.consultationIndex];
  }

  saveAvis(): void {
    if (!this.avisCandidate) return;

    const backendStatut = STATUT_BACKEND[this.avisStatut] ?? 'preselectionne';
    const candidat = this.avisCandidate;

    this.candidatureService.updateStatus(candidat.id, backendStatut, this.avisCommentaire.trim())
      .subscribe({
        next: () => {
          candidat.statut = this.avisStatut;
          candidat.commentaire = this.avisCommentaire.trim();
          this.avisModalOpen = false;
          this.avisCandidate = null;
          this.appliquerFiltres();
        },
        error: (err: any) => {
          console.error('saveAvis error:', err);
          window.alert(
            'Erreur lors de la mise à jour du statut.\n' +
            (err?.error?.error || err?.message || 'Vérifiez vos permissions.')
          );
        },
      });
  }

  closeAvisModal(): void {
    this.avisModalOpen = false;
    this.avisCandidate = null;
    this.avisCommentaire = '';
    this.avisStatut = 'Présélectionné';
  }

  massValider(): void {
    this.selectedCandidates.forEach((c) => {
      c.statut = 'Présélectionné';
    });
    this.clearSelection();
    this.appliquerFiltres();
  }

  clearSelection(): void {
    this.selectedIds = [];
  }

  // Consultation UI helpers
  switchConsultationTab(tab: 'details' | 'documents' | 'timeline'): void {
    this.activeConsultationTab = tab;
  }

  validateDocument(pieceName: string): void {
    this.showToast(`Validation du document: ${pieceName}`);
  }

  addTimelineNote(): void {
    if (!this.newTimelineNote.trim()) return;
    this.timelineEntries.unshift({
      date: new Date().toISOString(),
      author: 'Vous',
      note: this.newTimelineNote.trim(),
    });
    this.newTimelineNote = '';
    this.showToast('Entrée ajoutée à la timeline');
  }

  toggleActionMenu(candidateId: number, event?: Event): void {
    event?.stopPropagation();
    this.activeKebab = this.activeKebab === candidateId ? null : candidateId;
  }

  closeActionMenu(): void {
    this.activeKebab = null;
  }

  onTableClick(): void {
    this.closeActionMenu();
  }

  onPageClick(): void {
    this.closeActionMenu();
  }

  get statistiques(): StatistiqueCard[] {
    const base = this.candidatsFiltres.length ? this.candidatsFiltres : this.candidatsList;
    return [
      {
        label: 'Total candidatures',
        nombre: base.length,
        theme: 'blue',
        icon: 'fas fa-folder-open',
      },
      {
        label: 'Présélectionnés',
        nombre: base.filter((c) => c.statut === 'Présélectionné').length,
        theme: 'green',
        icon: 'fas fa-circle-check',
      },
      {
        label: 'Refusés',
        nombre: base.filter((c) => c.statut === 'Refusé').length,
        theme: 'red',
        icon: 'fas fa-xmark',
      },
      {
        label: 'Dossiers complets',
        nombre: base.filter((c) => c.etatDossier === 'Complet').length,
        theme: 'amber',
        icon: 'fas fa-folder-check',
      },
    ];
  }

  getStatutBadgeClass(statut: MasterStatus): string {
    const s = (statut || '').toString().toLowerCase();
    // normalize and map to visual classes
    if (
      [
        'validé',
        'validé',
        'admis',
        'preselectionne',
        'pre-sélectionné',
        'pre-selectionne',
        'preselectionné',
        'preselectionné',
        'préselectionné',
        'préselectionne',
        'preselectionne',
      ].includes(s) ||
      s.includes('valid')
    ) {
      return 'status-pill status-pill--ok';
    }
    if (['rejeté', 'rejete', 'rejete', 'rejet', 'rejeté'].includes(s) || s.includes('rej')) {
      return 'status-pill status-pill--danger';
    }
    if (
      ['en attente', 'sous_examen', 'sous-examen', 'en_attente', 'en_attente_dossier'].includes(
        s,
      ) ||
      s.includes('attente') ||
      s.includes('examen')
    ) {
      return 'status-pill status-pill--warn';
    }
    if (['soumis', 'dossier_depose', 'dossier déposé', 'dossier_deposé'].includes(s)) {
      return 'status-pill status-pill--info';
    }
    if (['inscrit', 'inscription'].includes(s)) {
      return 'status-pill status-pill--ok';
    }
    // fallback
    return 'status-pill status-pill--info';
  }

  // -------------------------
  // Dossier consultation helpers (skeletons)
  // -------------------------
  toggleDoc(docName: string): void {
    this.showToast(`Basculer document: ${docName}`);
  }

  validerDoc(docName: string): void {
    this.showToast(`Valider le document: ${docName}`);
  }

  updateProgress(percent: number): void {
    this.showToast(`Progression mise à jour: ${percent}%`);
  }

  addToTimeline(entry: string): void {
    this.showToast(`Ajout timeline: ${entry}`);
  }

  priseDecision(decision: string): void {
    this.showToast(`Décision prise: ${decision}`);
  }

  switchTab(tab: string): void {
    this.showToast(`Onglet: ${tab}`);
  }

  showToast(message: string): void {
    // simple UI feedback for now
    window.alert(message);
  }

  // Export helpers
  genererExcel(): void {
    // Try to use global XLSX if available (lib present in app), otherwise fallback to CSV
    const data = this.candidatsFiltres.map((c) => ({
      numeroCandidature: c.numeroCandidature,
      nom: c.nom,
      master: c.master,
      score: c.score,
      statut: c.statut,
      etatDossier: c.etatDossier,
      email: c.email,
      cin: c.cin,
      dateCandidature: c.dateCandidature,
    }));

    const XLSX = (window as any).XLSX;
    if (XLSX && typeof XLSX.utils !== 'undefined') {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Candidatures');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'candidatures.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // Fallback CSV
    const headers = Object.keys(data[0] || {});
    const csvRows = [headers.join(',')];
    for (const row of data) {
      const vals = headers.map((h) => {
        const v = (row as any)[h] ?? '';
        return '"' + String(v).replace(/"/g, '""') + '"';
      });
      csvRows.push(vals.join(','));
    }
    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidatures.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // genererPDF() remplacé par genererListeOfficielle() — appel backend ReportLab

  getScoreClass(score: number): string {
    if (score >= 16) return 'score-pill score-pill--green';
    if (score >= 13) return 'score-pill score-pill--amber';
    return 'score-pill score-pill--red';
  }

  getStatusPercent(score: number): number {
    return Math.min(100, Math.max(0, (score / 20) * 100));
  }

  getSpecialiteBadgeLabel(master: string): string {
    if (master.includes('GL')) return 'GL';
    if (master.includes('DSI')) return 'DSI';
    if (master.includes('TI')) return 'TI';
    return master.replace('Master ', '').toUpperCase();
  }
}
