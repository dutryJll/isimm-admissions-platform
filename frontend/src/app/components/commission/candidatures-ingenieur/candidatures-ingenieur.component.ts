import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import {
  CommissionContextService,
  CommissionContextOption,
} from '../../../services/commission-context.service';
import { CandidatureService } from '../../../services/candidature.service';

// ========================================
// INTERFACES
// ========================================
interface PieceJustificative {
  nom: string;
  statut: 'ok' | 'missing';
}

type IngenieurStatut =
  | 'Soumis'
  | 'Sous examen'
  | 'Présélectionné'
  | 'En attente dossier'
  | 'Dossier déposé'
  | 'Sélectionné'
  | 'Inscrit'
  | 'Refusé';

const STATUT_DISPLAY: Record<string, IngenieurStatut> = {
  soumis:              'Soumis',
  sous_examen:         'Sous examen',
  preselectionne:      'Présélectionné',
  en_attente_dossier:  'En attente dossier',
  dossier_depose:      'Dossier déposé',
  selectionne:         'Sélectionné',
  inscrit:             'Inscrit',
  rejete:              'Refusé',
  refuse:              'Refusé',
};

const STATUT_BACKEND_ING: Record<IngenieurStatut, string> = {
  'Soumis':              'soumis',
  'Sous examen':         'sous_examen',
  'Présélectionné':      'preselectionne',
  'En attente dossier':  'en_attente_dossier',
  'Dossier déposé':      'dossier_depose',
  'Sélectionné':         'selectionne',
  'Inscrit':             'inscrit',
  'Refusé':              'rejete',
};

interface Candidat {
  id: number;
  nom: string;
  numeroCandidature: string;
  numeroInscription: string;
  specialite: string;
  score: number;
  etat_dossier: 'Complet' | 'Incomplet';
  statut: IngenieurStatut;
  pieces: PieceJustificative[];
  email?: string;
  cin?: string;
  date_candidature?: string;
  commentaire?: string;
}

interface StatistiqueCard {
  label: string;
  nombre: number;
  theme: 'blue' | 'green' | 'amber' | 'red';
  icon: string;
}

// ========================================
// COMPOSANT
// ========================================
@Component({
  selector: 'app-candidatures-ingenieur',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './candidatures-ingenieur.component.html',
  styleUrls: ['./candidatures-ingenieur.component.css'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('300ms ease-in', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
})
export class CandidaturesIngenieurComponent implements OnInit {
  availableSpecialites: string[] = [];
  selectedSpecialite: string = '';
  filtreStatut: string = '';
  filtreEtatDossier: string = '';
  recherche = '';
  private readonly activeCommissionCategory: CommissionContextOption['category'] | null = null;
  // ========================================
  // DONNÉES
  // ========================================
  candidatsList: Candidat[] = [];
  isLoading = false;
  loadError: string | null = null;

  // ========================================
  // STATE
  // ========================================
  currentIndex: number = 0;
  candidatsFiltres: Candidat[] = [];
  selectionSet: Set<number> = new Set<number>();
  selectAll: boolean = false;
  viewingSelection: boolean = false;
  viewingList: Candidat[] = [];
  activeKebab: number | null = null;
  avisModalOpen = false;
  avisCandidate: Candidat | null = null;
  avisStatut: IngenieurStatut = 'Présélectionné';
  avisCommentaire = '';
  // consultation UI
  activeConsultationTab: 'details' | 'documents' | 'timeline' = 'details';
  timelineEntries: Array<{ date: string; author: string; note: string }> = [];
  newTimelineNote = '';
  generateListOpen = false;

  // ========================================
  // LIFECYCLE
  // ========================================
  constructor(
    private commissionContext: CommissionContextService,
    private router: Router,
    private candidatureService: CandidatureService,
  ) {}

  ngOnInit(): void {
    this.chargerCandidatures();
  }

  chargerCandidatures(): void {
    this.isLoading = true;
    this.loadError = null;
    this.candidatureService.getCandidaturesIngenieurCommission().subscribe({
      next: (data: any[]) => {
        this.candidatsList = (data || []).map((item, index) => this.mapApiToCandidatIngenieur(item, index));
        this.availableSpecialites = Array.from(
          new Set(this.candidatsList.map((c) => c.specialite).filter(Boolean)),
        ).sort();
        this.isLoading = false;
        this.appliquerFiltres();
      },
      error: () => {
        this.isLoading = false;
        this.loadError = 'Impossible de charger les candidatures.';
        this.candidatsList = [];
        this.appliquerFiltres();
      },
    });
  }

  private mapApiToCandidatIngenieur(item: any, index: number): Candidat {
    const statutRaw: string = (item.statut || '').toLowerCase().replace(/-/g, '_');
    const statut: IngenieurStatut = STATUT_DISPLAY[statutRaw] ?? 'Soumis';
    return {
      id: item.id ?? index + 1,
      nom: item.candidat_nom || '',
      numeroCandidature: item.numero || `CAND-${item.id}`,
      numeroInscription: item.numero || `CAND-${item.id}`,
      specialite: item.specialite || '',
      score: item.score ?? 0,
      etat_dossier: item.dossier_depose ? 'Complet' : 'Incomplet',
      statut,
      email: item.candidat_email || '',
      cin: item.candidat_cin || '',
      date_candidature: item.date_soumission || new Date().toISOString().slice(0, 10),
      commentaire: item.commentaire || '',
      pieces: [],
    };
  }

  // ========================================
  // NAVIGATION CAROUSEL
  // ========================================
  nextCandidat(): void {
    const list = this.viewingSelection ? this.viewingList : this.candidatsFiltres;
    if (list.length > 0) {
      this.currentIndex = (this.currentIndex + 1) % list.length;
    }
  }

  prevCandidat(): void {
    const list = this.viewingSelection ? this.viewingList : this.candidatsFiltres;
    if (list.length > 0) {
      this.currentIndex = (this.currentIndex - 1 + list.length) % list.length;
    }
  }

  // ========================================
  // ACTIONS DE VALIDATION
  // ========================================
  accepterCandidat(): void {
    if (this.candidatActuel) {
      this.candidatActuel.statut = 'Présélectionné';
      this.candidatureService.updateStatus(this.candidatActuel.id, 'preselectionne').subscribe();
      this.nextCandidat();
    }
  }

  refuserCandidat(): void {
    if (this.candidatActuel) {
      this.candidatActuel.statut = 'Refusé';
      this.candidatureService.updateStatus(this.candidatActuel.id, 'rejete').subscribe();
      this.nextCandidat();
    }
  }

  massValider(): void {
    this.candidatsFiltres
      .filter((c) => this.selectionSet.has(c.id))
      .forEach((c) => {
        c.statut = 'Présélectionné';
        this.candidatureService.updateStatus(c.id, 'preselectionne').subscribe();
      });
    this.clearSelection();
    this.appliquerFiltres();
  }

  openAvis(candidate: Candidat): void {
    this.avisCandidate = candidate;
    this.avisStatut = candidate.statut;
    this.avisCommentaire = candidate.commentaire || '';
    this.avisModalOpen = true;
    this.activeKebab = null;
  }

  closeAvisModal(): void {
    this.avisModalOpen = false;
    this.avisCandidate = null;
    this.avisCommentaire = '';
    this.avisStatut = 'Présélectionné';
  }

  saveAvis(): void {
    if (!this.avisCandidate) return;
    const backendStatut = STATUT_BACKEND_ING[this.avisStatut] ?? 'preselectionne';
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

  clearSelection(): void {
    this.selectionSet.clear();
    this.selectAll = false;
  }

  // ========================================
  // FILTRES
  // ========================================
  appliquerFiltres(): void {
    let resultats = [...this.candidatsList];

    // Filtre par statut
    if (this.filtreStatut) {
      resultats = resultats.filter((c) => c.statut === this.filtreStatut);
    }

    // Filtre par état dossier
    if (this.filtreEtatDossier) {
      resultats = resultats.filter((c) => c.etat_dossier === this.filtreEtatDossier);
    }

    // Filtre par recherche (nom, email, cin)
    if (this.recherche.trim()) {
      const terme = this.recherche.toLowerCase();
      resultats = resultats.filter(
        (c) =>
          c.nom.toLowerCase().includes(terme) ||
          c.email?.toLowerCase().includes(terme) ||
          c.cin?.includes(terme) ||
          c.numeroCandidature?.toLowerCase().includes(terme) ||
          c.numeroInscription?.toLowerCase().includes(terme) ||
          c.specialite?.toLowerCase().includes(terme) ||
          c.etat_dossier?.toLowerCase().includes(terme),
      );
    }

    // Filtre par spécialité
    if (this.selectedSpecialite) {
      resultats = resultats.filter((c) => c.specialite === this.selectedSpecialite);
    }

    this.candidatsFiltres = resultats;

    // Réinitialiser l'index si nécessaire
    if (this.currentIndex >= this.candidatsFiltres.length && this.candidatsFiltres.length > 0) {
      this.currentIndex = 0;
    }

    this.selectAll =
      this.selectionSet.size === this.candidatsFiltres.length && this.candidatsFiltres.length > 0;
  }

  toggleSelect(c: Candidat): void {
    if (this.selectionSet.has(c.id)) {
      this.selectionSet.delete(c.id);
    } else {
      this.selectionSet.add(c.id);
    }
    this.selectAll =
      this.selectionSet.size === this.candidatsFiltres.length && this.candidatsFiltres.length > 0;
  }

  isSelected(id: number): boolean {
    return this.selectionSet.has(id);
  }

  isAllVisibleSelected(): boolean {
    return (
      this.candidatsFiltres.length > 0 && this.selectionSet.size === this.candidatsFiltres.length
    );
  }

  toggleGenerateListMenu(): void {
    this.generateListOpen = !this.generateListOpen;
  }

  genererListe(mode: 'all' | 'selection'): void {
    const count =
      mode === 'all'
        ? this.candidatsFiltres.length
        : this.viewingSelection
          ? this.viewingList.length
          : this.candidatsFiltres.filter((c) => this.selectionSet.has(c.id)).length;
    window.alert(`Génération de la liste (${mode}) — ${count} éléments`);
    this.generateListOpen = false;
  }

  telechargerZIP(): void {
    const count = this.selectionSet.size || this.candidatsFiltres.length;
    window.alert(`Téléchargement ZIP lancé pour ${count} candidature(s)`);
  }

  // showToast utility
  showToast(message: string): void {
    window.alert(message);
  }

  // Export helpers
  genererExcel(): void {
    const data = this.candidatsFiltres.map((c) => ({
      numeroCandidature: c.numeroCandidature,
      nom: c.nom,
      specialite: c.specialite,
      score: c.score,
      statut: c.statut,
      etatDossier: c.etat_dossier,
      email: c.email,
      cin: c.cin,
      dateCandidature: c.date_candidature,
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
    const headers = Object.keys(data[0] || {});
    const csvRows = [headers.join(',')];
    for (const row of data) {
      const vals = headers.map(
        (h) => '"' + String((row as any)[h] ?? '').replace(/"/g, '""') + '"',
      );
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

  genererPDF(): void {
    const jsPDF = (window as any).jsPDF;
    const html2canvas = (window as any).html2canvas || (window as any).html2canvas;
    const table = document.querySelector('.selection-table');
    if (!table) {
      this.showToast('Aucun tableau trouvé pour exporter en PDF.');
      return;
    }
    if (html2canvas && jsPDF) {
      html2canvas(table as HTMLElement, { scale: 2 }).then((canvas: HTMLCanvasElement) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = (pdf as any).getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save('candidatures.pdf');
      });
      return;
    }
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write('<html><head><title>Export PDF</title>');
    w.document.write(
      '<style>table{width:100%;border-collapse:collapse;}td,th{border:1px solid #ddd;padding:8px;}</style>',
    );
    w.document.write('</head><body>');
    w.document.write((table as HTMLElement).outerHTML);
    w.document.write('</body></html>');
    w.document.close();
    w.focus();
    w.print();
  }

  toggleSelectAll(): void {
    if (this.selectAll) {
      this.selectionSet.clear();
      this.selectAll = false;
      return;
    }

    this.candidatsFiltres.forEach((c) => this.selectionSet.add(c.id));
    this.selectAll = true;
  }

  consulterSelection(): void {
    const list = this.selectionSet.size
      ? this.candidatsFiltres.filter((c) => this.selectionSet.has(c.id))
      : [...this.candidatsFiltres];
    if (list.length === 0) return;
    this.viewingSelection = true;
    this.viewingList = list;
    this.currentIndex = 0;
  }

  consulterUn(c: Candidat): void {
    this.viewingSelection = true;
    this.viewingList = [c];
    this.currentIndex = 0;
    this.activeKebab = null;
  }

  fermerConsultation(): void {
    this.viewingSelection = false;
    this.viewingList = [];
    this.currentIndex = 0;
  }

  openConsultation(c: Candidat): void {
    this.activeKebab = null;
    this.router.navigate(['/commission/dossier', c.id], {
      queryParams: { source: 'commission', type: 'ingenieur' },
    });
  }

  telechargerAttestation(c: Candidat): void {
    this.activeKebab = null;
    this.candidatureService.genererAttestation(c.id, true).subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ISIMM_Attestation_${c.nom.replace(/ /g, '_')}_${c.numeroCandidature}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => window.alert('Erreur lors de la génération de l\'attestation PDF.'),
    });
  }

  closeConsultation(): void {
    this.fermerConsultation();
  }

  toggleActionMenu(candidatId: number, event: MouseEvent): void {
    event.stopPropagation();
    this.activeKebab = this.activeKebab === candidatId ? null : candidatId;
  }

  onPageClick(): void {
    this.activeKebab = null;
  }

  get canOpenMassConsultation(): boolean {
    return this.selectionSet.size > 0;
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
    this.filtreStatut = '';
    this.filtreEtatDossier = '';
    this.recherche = '';
    this.currentIndex = 0;
    this.appliquerFiltres();
  }

  // ========================================
  // STATISTIQUES DYNAMIQUES
  // ========================================
  get statistiques(): StatistiqueCard[] {
    const base = this.candidatsList;
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
        nombre: base.filter((c) => c.etat_dossier === 'Complet').length,
        theme: 'amber',
        icon: 'fas fa-folder-check',
      },
    ];
  }

  // ========================================
  // GETTERS
  // ========================================
  get candidatActuel(): Candidat | undefined {
    const list = this.viewingSelection ? this.viewingList : this.candidatsFiltres;
    return list[this.currentIndex];
  }

  get totalCandidatures(): number {
    return this.viewingSelection ? this.viewingList.length : this.candidatsFiltres.length;
  }

  get filteredCount(): number {
    return this.candidatsFiltres.length;
  }

  get numeroActuel(): number {
    return this.currentIndex + 1;
  }

  get piecesOk(): number {
    return this.candidatActuel?.pieces.filter((p) => p.statut === 'ok').length || 0;
  }

  get piecesTotales(): number {
    return this.candidatActuel?.pieces.length || 0;
  }

  get scorePercentage(): number {
    return ((this.candidatActuel?.score || 0) / 20) * 100;
  }

  // ========================================
  // STYLE DYNAMIQUE
  // ========================================
  getEtatBadgeClass(etat: string): string {
    return etat === 'Complet' ? 'badge-complet' : 'badge-incomplet';
  }

  getStatutBadgeClass(statut: string): string {
    switch (statut) {
      case 'Présélectionné':     return 'status-pill status-pill--ok';
      case 'Sélectionné':        return 'status-pill status-pill--sel';
      case 'Inscrit':            return 'status-pill status-pill--inscrit';
      case 'Refusé':             return 'status-pill status-pill--danger';
      case 'Sous examen':        return 'status-pill status-pill--examen';
      case 'En attente dossier': return 'status-pill status-pill--attente';
      case 'Dossier déposé':     return 'status-pill status-pill--depose';
      default:                   return 'status-pill status-pill--info';
    }
  }

  getScoreClass(score: number): string {
    if (score >= 16) return 's-good';
    if (score >= 13) return 's-mid';
    return 's-low';
  }

  getStatusPercent(score: number): number {
    return Math.max(0, Math.min(100, (score / 20) * 100));
  }

  getSpecialiteBadgeLabel(specialite: string): string {
    return specialite;
  }

  getScoreColor(): string {
    const score = this.candidatActuel?.score || 0;
    if (score >= 16) return '#22C55E';
    if (score >= 13) return '#F59E0B';
    return '#EF4444';
  }

  getStatutBoutons(): { accepter: boolean; refuser: boolean } {
    return { accepter: true, refuser: true };
  }

  // Consultation helpers
  toggleDoc(docName: string): void {
    this.showToast(`Basculer document: ${docName}`);
  }

  validateDocument(docName: string): void {
    this.showToast(`Validation du document: ${docName}`);
  }

  addTimelineNote(): void {
    if (!this.newTimelineNote || !this.newTimelineNote.trim()) return;
    this.timelineEntries.unshift({
      date: new Date().toISOString(),
      author: 'Vous',
      note: this.newTimelineNote.trim(),
    });
    this.newTimelineNote = '';
    this.showToast('Entrée ajoutée à la timeline');
  }
}
