import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CommissionContextOption,
  CommissionContextService,
} from '../../../services/commission-context.service';
import { CandidatureService } from '../../../services/candidature.service';
import { ToastService } from '../../../services/toast.service';

type CandidatStatus = 'Présélectionné' | 'En attente' | 'Refusé';
type AvisStatut = 'favorable' | 'defavorable';
type CandidatureType = 'interne' | 'externe';
type TypeFilter = 'all' | CandidatureType;
type CommissionProfile =
  | 'master-mp-gl'
  | 'master-ds'
  | 'master-3i'
  | 'master-mrgl'
  | 'ingenieur-gl';

interface Candidat {
  id: number;
  numeroCandidature: string;
  firstName: string;
  lastName: string;
  specialiteDemandee: string;
  commissionProfile: CommissionProfile;
  score: number;
  statut: CandidatStatus;
  typeCandidature: CandidatureType;
  commentaire?: string;
}

@Component({
  selector: 'app-liste-preselection',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './liste-preselection.html',
  styleUrl: './liste-preselection.css',
})
export class ListePreselection implements OnInit {
  readonly sessionText = 'Session 2025/2026';

  candidats: Candidat[] = [];
  candidatsFiltres: Candidat[] = [];

  // Filtres
  searchQuery = '';
  selectedSpecialite = '';
  selectedType: TypeFilter = 'all';
  scoreMin: number | null = null;
  scoreMax: number | null = null;

  // Contexte commission
  currentCommissionType = 'Mastère';
  currentCommissionProfile: CommissionProfile = 'master-mp-gl';
  private activeCommissionCategory: CommissionContextOption['category'] | null = null;
  private onDocClickBound: any = null;

  // Pagination
  pageSize = 10;
  currentPage = 1;

  // Selection + actions
  selectedIds: number[] = [];
  actionMenuOpenId: number | null = null;
  dossierModalOpen = false;
  dossierModalCandidate: Candidat | null = null;
  avisModalOpen = false;
  avisCandidate: Candidat | null = null;
  avisStatut: AvisStatut = 'favorable';
  avisCommentaire = '';
  bulkDossierIndex = -1;
  showGlobalAvisModal = false;
  globalAvisStatut: 'favorable' | 'defavorable' = 'favorable';
  globalAvisCommentaire = '';
  globalAvisSummary: { favorables: number; defavorables: number; total: number } | null = null;
  private activeCommissionId: number | null = null;

  readonly specialitesByProfile: Record<CommissionProfile, string[]> = {
    'master-mp-gl': ["Licence en Sciences de l'Informatique", 'Licence en Informatique de Gestion'],
    'master-ds': ['Licence en Mathématiques Appliquées', "Licence en Sciences de l'Informatique"],
    'master-3i': [
      'Licence en Électronique',
      'Licence en TIC',
      'Licence en Mesures et Instrumentation',
      'Licence en Génie Électrique',
    ],
    'master-mrgl': [
      'Licence en Informatique',
      'Maîtrise en Informatique',
      'Licence/Maîtrise en Informatique de Gestion',
    ],
    'ingenieur-gl': ['Génie Logiciel (Informatique)'],
  };

  constructor(
    private commissionContext: CommissionContextService,
    private candidatureService: CandidatureService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.candidats = this.buildMockCandidats();

    this.commissionContext.activeCommissionId$.subscribe((commissionId) => {
      this.activeCommissionId = commissionId;
      this.activeCommissionCategory = this.getCommissionCategoryFromId(commissionId);
      this.syncCommissionProfile(commissionId);
      this.appliquerFiltres();
    });

    this.appliquerFiltres();
  }

  ngAfterViewInit(): void {
    this.onDocClickBound = () => (this.actionMenuOpenId = null);
    document.addEventListener('click', this.onDocClickBound);
  }

  ngOnDestroy(): void {
    if (this.onDocClickBound) document.removeEventListener('click', this.onDocClickBound);
  }

  get availableSpecialites(): string[] {
    return this.specialitesByProfile[this.currentCommissionProfile] || [];
  }

  get paginatedCandidats(): Candidat[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.candidatsFiltres.slice(start, start + this.pageSize);
  }

  get totalItems(): number {
    return this.candidatsFiltres.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get preselectionCount(): number {
    return this.candidatsFiltres.filter((c) => c.statut === 'Présélectionné').length;
  }

  get averageScore(): number {
    if (!this.candidatsFiltres.length) {
      return 0;
    }
    const sum = this.candidatsFiltres.reduce((acc, candidat) => acc + candidat.score, 0);
    return Math.round((sum / this.candidatsFiltres.length) * 100) / 100;
  }

  get paginationInfoText(): string {
    if (!this.totalItems) {
      return 'Affichage 0-0 sur 0';
    }
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(start + this.pageSize - 1, this.totalItems);
    return `Affichage ${start}-${end} sur ${this.totalItems}`;
  }

  appliquerFiltres(): void {
    const q = this.searchQuery.trim().toLowerCase();

    const rows = this.candidats.filter((candidat) => {
      const matchesCommission = this.matchCommissionScope(candidat);
      const fullName = `${candidat.firstName} ${candidat.lastName}`.toLowerCase();

      const matchSearch =
        !q || fullName.includes(q) || candidat.numeroCandidature.toLowerCase().includes(q);

      const matchSpecialite =
        !this.selectedSpecialite || candidat.specialiteDemandee === this.selectedSpecialite;

      const matchType =
        this.selectedType === 'all' || candidat.typeCandidature === this.selectedType;

      const min = this.scoreMin === null || this.scoreMin === undefined ? -Infinity : this.scoreMin;
      const max = this.scoreMax === null || this.scoreMax === undefined ? Infinity : this.scoreMax;
      const matchScore = candidat.score >= min && candidat.score <= max;

      return matchesCommission && matchSearch && matchSpecialite && matchType && matchScore;
    });

    this.candidatsFiltres = rows;
    this.selectedIds = this.selectedIds.filter((id) => rows.some((row) => row.id === id));

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
  }

  changePage(delta: number): void {
    const nextPage = this.currentPage + delta;
    if (nextPage < 1 || nextPage > this.totalPages) {
      return;
    }
    this.currentPage = nextPage;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }
    this.currentPage = page;
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.appliquerFiltres();
  }

  reinitialiserFiltres(): void {
    this.searchQuery = '';
    this.selectedSpecialite = '';
    this.selectedType = 'all';
    this.scoreMin = null;
    this.scoreMax = null;
    this.currentPage = 1;
    this.appliquerFiltres();
  }

  toggleAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedIds = this.paginatedCandidats.map((c) => c.id);
      return;
    }
    this.selectedIds = [];
  }

  toggleSelect(id: number, event?: Event): void {
    event?.stopPropagation();
    if (this.selectedIds.includes(id)) {
      this.selectedIds = this.selectedIds.filter((candidateId) => candidateId !== id);
      return;
    }
    this.selectedIds = [...this.selectedIds, id];
  }

  isSelected(id: number): boolean {
    return this.selectedIds.includes(id);
  }

  isAllPageSelected(): boolean {
    return (
      this.paginatedCandidats.length > 0 &&
      this.paginatedCandidats.every((candidate) => this.selectedIds.includes(candidate.id))
    );
  }

  getStatusClass(statut: CandidatStatus): string {
    if (statut === 'Présélectionné') return 'status-preselectionne';
    if (statut === 'Refusé') return 'status-refuse';
    return 'status-attente';
  }

  voirDossier(candidate: Candidat): void {
    this.dossierModalCandidate = candidate;
    this.dossierModalOpen = true;
    this.bulkDossierIndex = this.selectedIds.indexOf(candidate.id);
    this.closeActionMenu();
  }

  closeDossierModal(): void {
    this.dossierModalOpen = false;
    this.dossierModalCandidate = null;
    this.bulkDossierIndex = -1;
  }

  prevBulkDossier(): void {
    if (this.bulkDossierIndex <= 0) {
      return;
    }
    this.bulkDossierIndex -= 1;
    const targetId = this.selectedIds[this.bulkDossierIndex];
    const target = this.candidats.find((c) => c.id === targetId) || null;
    this.dossierModalCandidate = target;
  }

  nextBulkDossier(): void {
    if (this.bulkDossierIndex < 0 || this.bulkDossierIndex >= this.selectedIds.length - 1) {
      return;
    }
    this.bulkDossierIndex += 1;
    const targetId = this.selectedIds[this.bulkDossierIndex];
    const target = this.candidats.find((c) => c.id === targetId) || null;
    this.dossierModalCandidate = target;
  }

  ouvrirAvisCandidat(candidate: Candidat): void {
    this.avisCandidate = candidate;
    this.avisStatut = candidate.statut === 'Refusé' ? 'defavorable' : 'favorable';
    this.avisCommentaire = candidate.commentaire || '';
    this.avisModalOpen = true;
    this.closeActionMenu();
  }

  closeAvisModal(): void {
    this.avisModalOpen = false;
    this.avisCandidate = null;
    this.avisCommentaire = '';
  }

  saveAvis(): void {
    if (!this.avisCandidate) {
      return;
    }

    const commissionIdRaw = localStorage.getItem('active_commission_id');
    const commissionId = commissionIdRaw ? Number(commissionIdRaw) : undefined;

    this.candidatureService
      .submitAvis(this.avisCandidate.id, {
        avis: this.avisStatut === 'favorable',
        argument: this.avisCommentaire.trim(),
        commission_id: commissionId,
      })
      .subscribe({
        next: (response) => {
          this.avisCandidate!.statut =
            this.avisStatut === 'favorable' ? 'Présélectionné' : 'Refusé';
          this.avisCandidate!.commentaire = this.avisCommentaire;
          this.toastService.show(response?.message || 'Avis enregistré avec succès.', 'success');
          this.closeAvisModal();
          this.appliquerFiltres();
        },
        error: (error) => {
          const message = error?.error?.error || 'Erreur lors de l’enregistrement de l’avis.';
          this.toastService.show(message, 'error');
        },
      });
  }

  toggleActionMenu(candidateId: number, event?: Event): void {
    event?.stopPropagation();
    this.actionMenuOpenId = this.actionMenuOpenId === candidateId ? null : candidateId;
  }

  closeActionMenu(): void {
    this.actionMenuOpenId = null;
  }

  onPageClick(): void {
    this.closeActionMenu();
  }

  exporterExcel(): void {
    this.toastService.show('Export Excel généré (démo).', 'info');
  }

  imprimerListe(): void {
    window.print();
  }

  openGlobalAvisModal(): void {
    this.globalAvisSummary = {
      favorables: this.candidatsFiltres.filter((candidat) => candidat.statut === 'Présélectionné')
        .length,
      defavorables: this.candidatsFiltres.filter((candidat) => candidat.statut === 'Refusé').length,
      total: this.candidatsFiltres.length,
    };
    this.globalAvisStatut = 'favorable';
    this.globalAvisCommentaire = '';
    this.showGlobalAvisModal = true;
  }

  closeGlobalAvisModal(): void {
    this.showGlobalAvisModal = false;
    this.globalAvisCommentaire = '';
  }

  submitGlobalAvis(): void {
    if (this.globalAvisStatut === 'defavorable' && !this.globalAvisCommentaire.trim()) {
      this.toastService.show('Le commentaire est obligatoire pour un avis défavorable.', 'error');
      return;
    }

    const commissionId = this.activeCommissionId;
    if (commissionId === null) {
      this.toastService.show('Aucune commission active sélectionnée.', 'error');
      return;
    }

    this.candidatureService
      .submitGlobalAvis(commissionId, {
        statut: this.globalAvisStatut,
        commentaire: this.globalAvisCommentaire.trim(),
        is_global: true,
      })
      .subscribe({
        next: (response) => {
          this.toastService.show(response?.message || 'Avis global soumis avec succès.', 'success');
          this.closeGlobalAvisModal();
        },
        error: (error) => {
          const message = error?.error?.error || 'Erreur lors de la soumission de l’avis global.';
          this.toastService.show(message, 'error');
        },
      });
  }

  private matchCommissionScope(candidat: Candidat): boolean {
    return candidat.commissionProfile === this.currentCommissionProfile;
  }

  private syncCommissionProfile(commissionId: number | null): void {
    const active = this.commissionContext.commissions.find(
      (commission) => commission.id === commissionId,
    );
    const label = (active?.nom || '').toLowerCase();

    if (this.activeCommissionCategory === 'ingenieur') {
      this.currentCommissionProfile = 'ingenieur-gl';
      this.currentCommissionType = 'Cycle Ingénieur';
    } else {
      this.currentCommissionType = 'Mastère';
      if (label.includes('data') || label.includes('ds')) {
        this.currentCommissionProfile = 'master-ds';
      } else if (label.includes('3i')) {
        this.currentCommissionProfile = 'master-3i';
      } else if (label.includes('mrgl') || label.includes('recherche')) {
        this.currentCommissionProfile = 'master-mrgl';
      } else {
        this.currentCommissionProfile = 'master-mp-gl';
      }
    }

    if (
      this.selectedSpecialite &&
      !this.specialitesByProfile[this.currentCommissionProfile].includes(this.selectedSpecialite)
    ) {
      this.selectedSpecialite = '';
    }
  }

  private getCommissionCategoryFromId(
    commissionId: number | null,
  ): CommissionContextOption['category'] | null {
    if (commissionId === null) return null;
    const commission = this.commissionContext.commissions.find((item) => item.id === commissionId);
    if (commission?.category) return commission.category;
    if (commissionId === 1) return 'ingenieur';
    if (commissionId === 2) return 'master-ds';
    if (commissionId === 3) return 'master-gl';
    return null;
  }

  private buildMockCandidats(): Candidat[] {
    const base: Array<
      [string, string, string, number, CandidatStatus, CandidatureType, CommissionProfile]
    > = [
      [
        'Amina',
        'Ben Salah',
        "Licence en Sciences de l'Informatique",
        14.52,
        'Présélectionné',
        'interne',
        'master-mp-gl',
      ],
      [
        'Yassine',
        'Trabelsi',
        'Licence en Informatique de Gestion',
        13.42,
        'En attente',
        'externe',
        'master-mp-gl',
      ],
      [
        'Meriem',
        'Khaldi',
        'Licence en Mathématiques Appliquées',
        16.18,
        'Présélectionné',
        'interne',
        'master-ds',
      ],
      [
        'Omar',
        'Jaziri',
        "Licence en Sciences de l'Informatique",
        12.76,
        'Refusé',
        'externe',
        'master-ds',
      ],
      [
        'Nour',
        'Cherif',
        'Licence en Électronique',
        15.88,
        'Présélectionné',
        'interne',
        'master-3i',
      ],
      ['Mahdi', 'Bouzid', 'Licence en TIC', 11.94, 'En attente', 'externe', 'master-3i'],
      [
        'Salma',
        'Haddad',
        'Licence en Mesures et Instrumentation',
        10.73,
        'Refusé',
        'externe',
        'master-3i',
      ],
      [
        'Anis',
        'Gharbi',
        'Licence en Génie Électrique',
        14.02,
        'En attente',
        'interne',
        'master-3i',
      ],
      [
        'Asma',
        'Masmoudi',
        'Licence en Informatique',
        17.04,
        'Présélectionné',
        'interne',
        'master-mrgl',
      ],
      ['Riadh', 'Hamdi', 'Maîtrise en Informatique', 13.67, 'En attente', 'externe', 'master-mrgl'],
      [
        'Wiem',
        'Sassi',
        'Licence/Maîtrise en Informatique de Gestion',
        12.03,
        'Refusé',
        'externe',
        'master-mrgl',
      ],
      [
        'Hassen',
        'Mnif',
        'Génie Logiciel (Informatique)',
        15.36,
        'Présélectionné',
        'interne',
        'ingenieur-gl',
      ],
      [
        'Nesrine',
        'Brahmi',
        'Génie Logiciel (Informatique)',
        14.01,
        'En attente',
        'interne',
        'ingenieur-gl',
      ],
      [
        'Sami',
        'Ammar',
        "Licence en Sciences de l'Informatique",
        15.76,
        'Présélectionné',
        'interne',
        'master-ds',
      ],
      [
        'Imen',
        'Ben Youssef',
        'Licence en Informatique de Gestion',
        12.55,
        'Refusé',
        'externe',
        'master-mp-gl',
      ],
      [
        'Fares',
        'Ouertani',
        'Licence en Mathématiques Appliquées',
        13.98,
        'En attente',
        'externe',
        'master-ds',
      ],
      [
        'Rania',
        'Sfar',
        'Licence en Informatique',
        16.42,
        'Présélectionné',
        'interne',
        'master-mrgl',
      ],
      [
        'Mehdi',
        'Zidi',
        'Génie Logiciel (Informatique)',
        11.22,
        'Refusé',
        'externe',
        'ingenieur-gl',
      ],
      ['Ines', 'Karray', 'Licence en TIC', 15.44, 'Présélectionné', 'interne', 'master-3i'],
      [
        'Bassem',
        'Mansouri',
        'Licence en Électronique',
        13.05,
        'En attente',
        'externe',
        'master-3i',
      ],
    ];

    return base.map((row, index) => ({
      id: index + 1,
      numeroCandidature: `2026-ING-GL-${String(index + 42).padStart(3, '0')}`,
      firstName: row[0],
      lastName: row[1],
      specialiteDemandee: row[2],
      commissionProfile: row[6],
      score: row[3],
      statut: row[4],
      typeCandidature: row[5],
      commentaire: '',
    }));
  }
}
