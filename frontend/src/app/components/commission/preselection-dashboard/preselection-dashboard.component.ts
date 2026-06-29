import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CandidatureService } from '../../../services/candidature.service';
import { SpecialitesService } from '../../../services/specialites.service';
import { CommissionStateService } from '../../../services/commission-state.service';

@Component({
  selector: 'app-preselection-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './preselection-dashboard.component.html',
  styleUrls: ['./preselection-dashboard.component.css'],
})
export class PreselectionDashboardComponent implements OnInit {
  candidatures: any[] = [];
  selectedIds: number[] = [];
  validationScoreThreshold = 10;

  // Responsable modal state
  showResponsableModal = false;
  modalCandidature: any = null;
  avisStatsLoading = false;
  avisStats: any = null;
  avisList: any[] = [];
  modalDecision: 'en_attente' | 'valide' | 'rejete' = 'en_attente';

  // Carousel state
  showCarousel = false;
  carIdx = 0;
  carList: any[] = [];

  // Filter state
  filtered: any[] = [];
  nameFilter = '';
  top100Only = false;
  scoreMinFilter = 0;
  scoreMaxFilter = 20;
  statusFilter = 'tous';
  globalAvisLoading = false;
  globalAvisSummary: any = null;
  globalAvisResponses: any[] = [];
  finalDecisionApplying = false;
  finalDecisionModalOpen = false;
  preselectionLocked = false;
  // spécialités
  availableSpecialites: string[] = [];
  selectedSpecialite: string = '';
  private activeCommissionCategory: 'ingenieur' | 'master-ds' | 'master-gl' | null = null;

  constructor(
    private candidatureService: CandidatureService,
    private specialitesService: SpecialitesService,
    private commissionStateService: CommissionStateService,
  ) {}

  ngOnInit(): void {
    this.commissionStateService.activeCommissionId$.subscribe((commissionId) => {
      this.activeCommissionCategory = this.getCommissionCategoryFromId(commissionId);
      this.applyFilter();
    });
    this.candidatures = this.buildMockPreselectionCandidates();
    this.loadPreselectionCandidates();
    this.loadCommissionGlobalAvisSummary();
    this.specialitesService.getSpecialitesData().subscribe(() => {
      this.availableSpecialites = this.specialitesService.getAllSpecialties();
    });
  }

  loadPreselectionCandidates(): void {
    this.candidatureService.getCandidaturesCommissionClassees().subscribe({
      next: (res: any) => {
        this.candidatures =
          Array.isArray(res) && res.length ? res : this.buildMockPreselectionCandidates();
        this.applyFilter();
      },
      error: () => {
        this.candidatures = this.buildMockPreselectionCandidates();
        this.applyFilter();
      },
    });
  }

  private buildMockPreselectionCandidates(): any[] {
    return [
      {
        id: 101,
        numero: '2603-00011-GL',
        nom_complet: 'Ahmed Ben Ali',
        candidat_nom: 'Ben Ali',
        candidat_prenom: 'Ahmed',
        email: 'ahmed.benali@example.com',
        cin: '12345678',
        specialite: 'Génie Logiciel',
        master_nom: 'Master Recherche Génie Logiciel',
        score: 18.72,
        mention: 'Bien',
        decision_preselection: 'preselectionne',
        decision_finale_responsable: 'Avis favorable',
        candidat_interne: true,
        rang: 1,
        commissionCategory: 'master-gl',
        ocr_note_status: 'Note extraite par OCR : 17.75 | Saisie : 17.75 - Conforme',
        ocr_piece_status: 'Attestation relevé : OCR conforme',
      },
      {
        id: 102,
        numero: '2603-00012-DS',
        nom_complet: 'Yasmine Tounsi',
        candidat_nom: 'Tounsi',
        candidat_prenom: 'Yasmine',
        email: 'yasmine.tounsi@example.com',
        cin: '98765432',
        specialite: 'Data Science',
        master_nom: 'Master Professionnel Data Science',
        score: 17.46,
        mention: 'Bien',
        decision_preselection: 'preselectionne',
        decision_finale_responsable: 'Avis favorable',
        candidat_interne: false,
        rang: 2,
        commissionCategory: 'master-ds',
        ocr_note_status: 'Note extraite par OCR : 16.90 | Saisie : 16.90 - Conforme',
        ocr_piece_status: 'Diplôme : OCR conforme',
      },
      {
        id: 103,
        numero: '2603-00013-ING',
        nom_complet: 'Meriem Jemai',
        candidat_nom: 'Jemai',
        candidat_prenom: 'Meriem',
        email: 'meriem.jemai@example.com',
        cin: '32147896',
        specialite: 'Génie Informatique',
        master_nom: 'Cycle Ingénieur Informatique',
        score: 16.81,
        mention: 'Bien',
        decision_preselection: 'preselectionne',
        decision_finale_responsable: 'Avis favorable',
        candidat_interne: true,
        rang: 3,
        commissionCategory: 'ingenieur',
        ocr_note_status: 'Note extraite par OCR : 16.25 | Saisie : 16.25 - Conforme',
        ocr_piece_status: 'Relevé : conforme',
      },
      {
        id: 104,
        numero: '2603-00014-GL',
        nom_complet: 'Fares Khelifi',
        candidat_nom: 'Khelifi',
        candidat_prenom: 'Fares',
        email: 'fares.khelifi@example.com',
        cin: '45678912',
        specialite: 'Génie Logiciel',
        master_nom: 'Master Recherche Génie Logiciel',
        score: 15.94,
        mention: 'Assez Bien',
        decision_preselection: 'sous_examen',
        decision_finale_responsable: 'En attente de l’avis du jury',
        candidat_interne: false,
        rang: 4,
        commissionCategory: 'master-gl',
        ocr_note_status: 'Note extraite par OCR : 15.50 | Saisie : 15.50 - Conforme',
        ocr_piece_status: 'Pièce identité : OCR conforme',
      },
      {
        id: 105,
        numero: '2603-00015-DS',
        nom_complet: 'Asma Mansouri',
        candidat_nom: 'Mansouri',
        candidat_prenom: 'Asma',
        email: 'asma.mansouri@example.com',
        cin: '74125896',
        specialite: 'Data Science',
        master_nom: 'Master Professionnel Data Science',
        score: 15.28,
        mention: 'Assez Bien',
        decision_preselection: 'preselectionne',
        decision_finale_responsable: 'Avis favorable',
        candidat_interne: true,
        rang: 5,
        commissionCategory: 'master-ds',
        ocr_note_status: 'Note extraite par OCR : 15.25 | Saisie : 15.25 - Conforme',
        ocr_piece_status: 'Dossier complet',
      },
      {
        id: 106,
        numero: '2603-00016-ING',
        nom_complet: 'Oussama Bouzid',
        candidat_nom: 'Bouzid',
        candidat_prenom: 'Oussama',
        email: 'oussama.bouzid@example.com',
        cin: '96325874',
        specialite: 'Réseaux et Systèmes',
        master_nom: 'Cycle Ingénieur Informatique',
        score: 14.62,
        mention: 'Assez Bien',
        decision_preselection: 'sous_examen',
        decision_finale_responsable: 'Compléments demandés',
        candidat_interne: false,
        rang: 6,
        commissionCategory: 'ingenieur',
        ocr_note_status: 'Note extraite par OCR : 14.62 | Saisie : 14.62 - Conforme',
        ocr_piece_status: 'Relevé partiellement lisible',
      },
      {
        id: 107,
        numero: '2603-00017-GL',
        nom_complet: 'Ines Chokri',
        candidat_nom: 'Chokri',
        candidat_prenom: 'Ines',
        email: 'ines.chokri@example.com',
        cin: '85296314',
        specialite: 'Génie Logiciel',
        master_nom: 'Master Recherche Génie Logiciel',
        score: 13.94,
        mention: 'Assez Bien',
        decision_preselection: 'preselectionne',
        decision_finale_responsable: 'Avis favorable',
        candidat_interne: true,
        rang: 7,
        commissionCategory: 'master-gl',
        ocr_note_status: 'Note extraite par OCR : 13.94 | Saisie : 13.94 - Conforme',
        ocr_piece_status: 'Relevé validé',
      },
      {
        id: 108,
        numero: '2603-00018-DS',
        nom_complet: 'Wiem Gharbi',
        candidat_nom: 'Gharbi',
        candidat_prenom: 'Wiem',
        email: 'wiem.gharbi@example.com',
        cin: '14785236',
        specialite: 'Data Science',
        master_nom: 'Master Professionnel Data Science',
        score: 12.88,
        mention: 'Assez Bien',
        decision_preselection: 'sous_examen',
        decision_finale_responsable: 'En attente de confirmation',
        candidat_interne: false,
        rang: 8,
        commissionCategory: 'master-ds',
        ocr_note_status: 'Note extraite par OCR : 12.88 | Saisie : 12.88 - Conforme',
        ocr_piece_status: 'Pièce jointe non lisible',
      },
      {
        id: 109,
        numero: '2603-00019-ING',
        nom_complet: 'Sarra Karray',
        candidat_nom: 'Karray',
        candidat_prenom: 'Sarra',
        email: 'sarra.karray@example.com',
        cin: '36925814',
        specialite: 'Génie Informatique',
        master_nom: 'Cycle Ingénieur Informatique',
        score: 11.94,
        mention: 'Assez Bien',
        decision_preselection: 'non_preselectionne',
        decision_finale_responsable: 'Non retenue',
        candidat_interne: true,
        rang: 9,
        commissionCategory: 'ingenieur',
        ocr_note_status: 'Note extraite par OCR : 11.94 | Saisie : 11.94 - Conforme',
        ocr_piece_status: 'Dossier incomplet',
      },
      {
        id: 110,
        numero: '2603-00020-GL',
        nom_complet: 'Nour Brahmi',
        candidat_nom: 'Brahmi',
        candidat_prenom: 'Nour',
        email: 'nour.brahmi@example.com',
        cin: '25874136',
        specialite: 'Génie Logiciel',
        master_nom: 'Master Recherche Génie Logiciel',
        score: 10.42,
        mention: 'Assez Bien',
        decision_preselection: 'non_preselectionne',
        decision_finale_responsable: 'Sous réserve',
        candidat_interne: false,
        rang: 10,
        commissionCategory: 'master-gl',
        ocr_note_status: 'Note extraite par OCR : 10.42 | Saisie : 10.42 - Conforme',
        ocr_piece_status: 'Score limite vérifié',
      },
    ];
  }

  private getActiveCommissionId(): number | null {
    return this.commissionStateService.activeCommissionId;
  }

  loadCommissionGlobalAvisSummary(): void {
    const commissionId = this.getActiveCommissionId();
    if (!commissionId) {
      this.globalAvisSummary = null;
      this.globalAvisResponses = [];
      return;
    }

    this.globalAvisLoading = true;
    this.candidatureService.getCommissionGlobalAvisSummary(commissionId).subscribe({
      next: (res: any) => {
        this.globalAvisSummary = res?.summary || null;
        this.globalAvisResponses = Array.isArray(res?.responses) ? res.responses : [];
        this.globalAvisLoading = false;
      },
      error: () => {
        this.globalAvisSummary = null;
        this.globalAvisResponses = [];
        this.globalAvisLoading = false;
      },
    });
  }

  canShowDecisionFinalButton(): boolean {
    return true;
  }

  openFinalDecisionModal(): void {
    if (!this.canShowDecisionFinalButton()) {
      alert('La décision finale est disponible après tous les avis ou expiration du délai.');
      return;
    }
    if (this.preselectionLocked) {
      alert('La session est déjà clôturée par une décision finale.');
      return;
    }
    if (!this.candidatures.length) {
      alert('Aucune candidature à traiter.');
      return;
    }

    this.finalDecisionModalOpen = true;
  }

  closeFinalDecisionModal(): void {
    this.finalDecisionModalOpen = false;
  }

  private isResponsableScopeAllowed(): boolean {
    const role = (localStorage.getItem('user_role') || '').toLowerCase();
    return role === 'responsable_commission' || role === 'responsable';
  }

  applyFinalDecisionTop100(): void {
    this.closeFinalDecisionModal();

    const majority = this.globalAvisSummary?.majority_recommendation;
    const finalDecision: 'valide' | 'rejete' = majority === 'defavorable' ? 'rejete' : 'valide';
    const topCandidates = [...this.candidatures]
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      .slice(0, 100);

    if (!topCandidates.length) {
      alert('Aucun candidat à traiter dans le Top 100.');
      return;
    }

    this.finalDecisionApplying = true;
    const requests = topCandidates.map((c) =>
      this.candidatureService.setDecisionResponsable(c.id, finalDecision),
    );

    forkJoin(requests).subscribe({
      next: () => {
        this.finalDecisionApplying = false;
        this.preselectionLocked = true;
        this.showToast(
          `Décision finale appliquée sur ${topCandidates.length} candidats. Session clôturée et modifications verrouillées.`,
          't-success',
        );
        this.loadPreselectionCandidates();
      },
      error: (error) => {
        this.finalDecisionApplying = false;
        const message =
          error?.error?.error || "Erreur lors de l'application de la décision finale.";
        alert(message);
      },
    });
  }

  // ═══════════════════════════════════════
  // Statistics Helpers
  // ═══════════════════════════════════════

  getInternalCount(): number {
    return this.candidatures.filter((c) => c.candidat_interne === true).length;
  }

  getAverageScore(): number {
    if (this.candidatures.length === 0) return 0;
    const sum = this.candidatures.reduce((acc, c) => acc + (c.score || 0), 0);
    return sum / this.candidatures.length;
  }

  getPreselectedCount(): number {
    return this.candidatures.filter(
      (c) => c.decision_preselection === 'preselectionne' || c.decision_preselection === 'valide',
    ).length;
  }

  // ═══════════════════════════════════════
  // Selection Helpers
  // ═══════════════════════════════════════

  toggleRow(id: number, event: any): void {
    event.stopPropagation();
    const i = this.selectedIds.indexOf(id);
    if (i >= 0) {
      this.selectedIds.splice(i, 1);
    } else {
      this.selectedIds.push(id);
    }
  }

  toggleAll(event: any): void {
    const allIds = this.candidatures.map((c) => c.id);
    if (event.target.checked) {
      this.selectedIds = [...new Set([...this.selectedIds, ...allIds])];
    } else {
      this.selectedIds = [];
    }
  }

  isSelected(id: number): boolean {
    return this.selectedIds.includes(id);
  }

  // ═══════════════════════════════════════
  // Filter Helpers
  // ═══════════════════════════════════════

  filterByName(event: any): void {
    this.nameFilter = event.target.value.toLowerCase();
    this.applyFilter();
  }

  applyFilter(): void {
    this.filtered = this.candidatures.filter((c) => {
      const commissionScopeMatch = this.matchesCommissionScope(c);
      const matchName =
        !this.nameFilter ||
        [c.nom_complet, c.candidat_nom, c.email, c.cin, c.specialite, c.master_nom, c.numero]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(this.nameFilter);
      const matchScore =
        (c.score || 0) >= this.scoreMinFilter && (c.score || 0) <= this.scoreMaxFilter;
      const matchStatus =
        this.statusFilter === 'tous' ||
        (this.statusFilter === 'preselectionne' &&
          (c.decision_preselection === 'preselectionne' || c.decision_preselection === 'valide')) ||
        (this.statusFilter === 'exam' && c.decision_preselection === 'sous_examen');
      const matchTop100 = !this.top100Only || (c.rang && c.rang <= 100);
      const matchSpecialite =
        !this.selectedSpecialite ||
        (c.specialite || c.master_nom || '') === this.selectedSpecialite;

      return (
        commissionScopeMatch &&
        matchName &&
        matchScore &&
        matchStatus &&
        matchTop100 &&
        matchSpecialite
      );
    });
  }

  private matchesCommissionScope(candidate: any): boolean {
    const scope = this.activeCommissionCategory;
    if (!scope) {
      return true;
    }

    if (candidate?.commissionCategory) {
      return candidate.commissionCategory === scope;
    }

    const text = [
      candidate?.master_nom,
      candidate?.specialite,
      candidate?.specialite_demandee,
      candidate?.type_candidature,
      candidate?.parcours,
      candidate?.formation,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (scope === 'ingenieur') {
      return text.includes('ingenieur') || text.includes('ingénieur') || text.includes('génie');
    }

    if (scope === 'master-ds') {
      return text.includes('data') || text.includes('science') || text.includes('ds');
    }

    return text.includes('logiciel') || text.includes('gl') || text.includes('génie logiciel');
  }

  private getCommissionCategoryFromId(
    commissionId: number | null,
  ): 'ingenieur' | 'master-ds' | 'master-gl' | null {
    if (commissionId === 1) return 'ingenieur';
    if (commissionId === 2) return 'master-ds';
    if (commissionId === 3) return 'master-gl';
    return null;
  }

  resetAll(): void {
    this.nameFilter = '';
    this.scoreMinFilter = 0;
    this.scoreMaxFilter = 20;
    this.statusFilter = 'tous';
    this.top100Only = false;
    this.selectedIds = [];
    this.applyFilter();
  }

  toggleTop100(): void {
    this.top100Only = !this.top100Only;
    this.applyFilter();
  }

  // ═══════════════════════════════════════
  // Scoring Display Helpers
  // ═══════════════════════════════════════

  getScoreClass(score: number): string {
    if (score >= 16) return 'sf-g'; // Green
    if (score >= 12) return 'sf-a'; // Amber
    return 'sf-r'; // Red
  }

  getScorePct(score: number): number {
    // Normalize score to 0-100 (assuming max score is 20)
    return Math.max(0, Math.min(100, (score / 20) * 100));
  }

  getBadgeClass(status: string): string {
    if (status === 'preselectionne' || status === 'valide') return 'b-admis';
    if (status === 'sous_examen') return 'b-exam';
    return 'b-nonlu';
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      preselectionne: 'Présélectionné',
      valide: 'Admis',
      sous_examen: 'Sous examen',
      rejete: 'Rejeté',
    };
    return labels[status] || status;
  }

  // ═══════════════════════════════════════
  // Export Functions
  // ═══════════════════════════════════════

  telechargerZIP(): void {
    if (this.selectedIds.length === 0) {
      alert('Veuillez sélectionner au moins un candidat');
      return;
    }
    // TODO: Implement ZIP download (would need backend support)
    alert(`ZIP download pour ${this.selectedIds.length} candidat(s) - À implémenter`);
    this.closeExp(null);
  }

  exportExcel(): void {
    if (this.selectedIds.length === 0) {
      alert('Veuillez sélectionner au least un candidat');
      return;
    }
    // TODO: Implement Excel export (would need backend support)
    alert(`Export Excel pour ${this.selectedIds.length} candidat(s) - À implémenter`);
    this.closeExp(null);
  }

  toggleExp(event: any): void {
    if (event) event.stopPropagation();
    const menu = document.getElementById('exp-menu');
    if (menu) {
      menu.classList.toggle('open');
    }
  }

  closeExp(event: any): void {
    if (event) {
      event.stopPropagation();
    }
    const menu = document.getElementById('exp-menu');
    if (menu) {
      menu.classList.remove('open');
    }
  }

  showToast(msg: string, cls: string = 't-success'): void {
    const toast = document.getElementById('toast');
    const txt = document.getElementById('toast-txt');
    if (toast && txt) {
      txt.textContent = msg;
      toast.className = `toast show ${cls}`;
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
  }

  // ═══════════════════════════════════════
  // Carousel Functions
  // ═══════════════════════════════════════

  openCarousel(): void {
    if (this.selectedIds.length === 0) {
      alert('Veuillez sélectionner au moins un candidat');
      return;
    }
    this.carList = this.selectedIds
      .map((id) => this.candidatures.find((c) => c.id === id))
      .filter((c) => c);
    this.carIdx = 0;
    this.showCarousel = true;
    this.refreshCarNav();
  }

  closeCarousel(): void {
    this.showCarousel = false;
    this.carIdx = 0;
    this.carList = [];
  }

  carPrev(): void {
    if (this.carIdx > 0) {
      this.carIdx--;
      this.refreshCarNav();
    }
  }

  carNext(): void {
    if (this.carIdx < this.carList.length - 1) {
      this.carIdx++;
      this.refreshCarNav();
    }
  }

  setCarIdx(idx: number): void {
    if (idx >= 0 && idx < this.carList.length) {
      this.carIdx = idx;
      this.refreshCarNav();
    }
  }

  refreshCarNav(): void {
    const posElem = document.getElementById('car-pos');
    if (posElem) {
      posElem.textContent = `Position ${this.carIdx + 1} / ${this.carList.length}`;
    }
    this.renderCarContent();
  }

  renderCarContent(): void {
    // This method updates the carousel content based on current index
    // The HTML binding will automatically update via Angular change detection
    const carMain = document.querySelector('.car-main');
    if (carMain && this.carList[this.carIdx]) {
      const c = this.carList[this.carIdx];
      // Content will be rendered via Angular binding in the template
    }
  }

  // ═══════════════════════════════════════
  // Misc Functions
  // ═══════════════════════════════════════

  marquerLus(): void {
    if (this.selectedIds.length === 0) {
      alert('Veuillez sélectionner au moins un candidat');
      return;
    }
    // Mark selected candidates as "lu" (read)
    // This would require a backend endpoint
    alert(`Marquer ${this.selectedIds.length} candidat(s) comme lus - À implémenter`);
  }

  // ═══════════════════════════════════════
  // Original Methods (Existing)
  // ═══════════════════════════════════════

  toggleSelect(id: number): void {
    const i = this.selectedIds.indexOf(id);
    if (i >= 0) this.selectedIds.splice(i, 1);
    else this.selectedIds.push(id);
  }

  validateSelection(): void {
    if (this.preselectionLocked) {
      alert('Session clôturée: les modifications sont verrouillées.');
      return;
    }

    if (this.selectedIds.length === 0) {
      alert('Veuillez sélectionner au moins un candidat');
      return;
    }

    const confirmMsg = `Êtes-vous sûr de vouloir marquer ${this.selectedIds.length} candidat(s) comme présélectionné(s) avec un seuil de ${this.validationScoreThreshold}/20 ?`;
    if (!confirm(confirmMsg)) {
      return;
    }

    const reason = `Présélectionné avec seuil de ${this.validationScoreThreshold}`;
    this.candidatureService
      .bulkUpdateCandidatureStatus(this.selectedIds, 'preselectionne', reason)
      .subscribe({
        next: (response) => {
          console.log('✅ Validation réussie:', response);
          alert(`✅ ${response.updated_count} candidat(s) présélectionné(s) avec succès`);
          this.selectedIds = [];
          this.loadPreselectionCandidates();
        },
        error: (error) => {
          console.error('❌ Erreur validation:', error);
          const message =
            error?.error?.error || error?.error?.message || 'Erreur lors de la validation';
          alert(`❌ Erreur: ${message}`);
        },
      });
  }

  fullAutoValidate(): void {
    if (this.preselectionLocked) {
      alert('Session clôturée: les modifications sont verrouillées.');
      return;
    }

    if (this.candidatures.length === 0) {
      alert('Aucun candidat à valider');
      return;
    }

    const allIds = this.candidatures.map((c) => c.id);
    const confirmMsg = `Êtes-vous sûr de vouloir marquer ${allIds.length} candidat(s) comme présélectionné(s) automatiquement avec un seuil de ${this.validationScoreThreshold}/20 ?`;
    if (!confirm(confirmMsg)) {
      return;
    }

    const reason = `Présélectionné automatiquement avec seuil de ${this.validationScoreThreshold}`;
    this.candidatureService
      .bulkUpdateCandidatureStatus(allIds, 'preselectionne', reason)
      .subscribe({
        next: (response) => {
          console.log('✅ Validation auto réussie:', response);
          alert(`✅ ${response.updated_count} candidat(s) présélectionné(s) automatiquement`);
          this.selectedIds = [];
          this.loadPreselectionCandidates();
        },
        error: (error) => {
          console.error('❌ Erreur validation auto:', error);
          const message =
            error?.error?.error ||
            error?.error?.message ||
            'Erreur lors de la validation automatique';
          alert(`❌ Erreur: ${message}`);
        },
      });
  }

  quickValidate(c: any): void {
    if (this.preselectionLocked) {
      alert('Session clôturée: les modifications sont verrouillées.');
      return;
    }

    if (!c || !c.id) {
      alert('Candidat invalide');
      return;
    }

    const confirmMsg = `Êtes-vous sûr de vouloir marquer ${c.nom_complet || c.candidat_nom} comme présélectionné ?`;
    if (!confirm(confirmMsg)) {
      return;
    }

    this.candidatureService
      .bulkUpdateCandidatureStatus([c.id], 'preselectionne', 'Présélectionné manuellement')
      .subscribe({
        next: (response) => {
          console.log('✅ Validation rapide réussie:', response);
          alert(`✅ Candidat présélectionné avec succès`);
          this.loadPreselectionCandidates();
        },
        error: (error) => {
          console.error('❌ Erreur validation rapide:', error);
          const message =
            error?.error?.error || error?.error?.message || 'Erreur lors de la validation';
          alert(`❌ Erreur: ${message}`);
        },
      });
  }

  openAvisModal(candidature: any): void {
    this.modalCandidature = candidature;
    this.modalDecision = candidature.decision_finale_responsable || 'en_attente';
    this.showResponsableModal = true;
    this.loadAvisStats(candidature.id);
  }

  closeResponsableModal(): void {
    this.showResponsableModal = false;
    this.modalCandidature = null;
    this.avisStats = null;
    this.avisList = [];
  }

  loadAvisStats(candidatureId: number): void {
    this.avisStatsLoading = true;
    this.candidatureService.getAvisStats(candidatureId).subscribe({
      next: (res: any) => {
        this.avisStats = res || {};
        this.avisList = res?.avis || [];
        this.avisStatsLoading = false;
      },
      error: () => {
        this.avisStatsLoading = false;
        this.avisStats = { total: 0, favorables: 0, defavorables: 0, pourcentage_favorable: 0 };
        this.avisList = [];
      },
    });
  }

  saveDecision(): void {
    if (!this.modalCandidature) return;
    this.candidatureService
      .setDecisionResponsable(this.modalCandidature.id, this.modalDecision)
      .subscribe({
        next: () => {
          alert('Décision enregistrée');
          this.loadPreselectionCandidates();
        },
        error: (err) => {
          alert('Erreur enregistrement décision: ' + (err?.error?.error || ''));
        },
      });
  }

  sendReminder(): void {
    if (!this.modalCandidature) return;
    const activeCommission = localStorage.getItem('active_commission_id');
    const commissionId = activeCommission ? Number(activeCommission) : null;
    if (!commissionId) {
      alert('Aucune commission active sélectionnée');
      return;
    }
    if (!confirm('Envoyer un rappel aux membres de la commission ?')) return;
    this.candidatureService
      .sendAppelAvis(commissionId, `Demande d'avis pour le parcours actif.`)
      .subscribe({
        next: (res) => {
          alert(`Rappel envoyé (${res.sent} envoyés, ${res.failed} échoués)`);
          this.loadCommissionGlobalAvisSummary();
        },
        error: (err) => alert('Erreur envoi rappel: ' + (err?.error?.error || '')),
      });
  }
}
