import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CandidatureService } from '../../../services/candidature.service';

interface AvisItem {
  id: number;
  candidature_id: number;
  candidature_numero?: string;
  candidat_name?: string;
  membre_name?: string;
  member_name?: string;
  commission_name?: string;
  commission?: number;
  avis: boolean;
  avis_type?: 'favorable' | 'defavorable';
  argument?: string;
  date_avis?: string;
  date?: string;
}

@Component({
  selector: 'app-avis-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './avis-management.component.html',
  styleUrls: ['./avis-management.component.css'],
})
export class AvisManagementComponent implements OnInit {
  masterId: number | null = null;
  selectedMaster: any = null;
  avis: AvisItem[] = [];
  commissionMembers: any[] = [];
  statistics: any = null;
  loading = false;
  errorMessage = '';
  successMessage = '';

  // Filter criteria
  selectedCommissionId: number | null = null;
  selectedMemberId: number | null = null;
  selectedAvisType: string = '';
  dateFromFilter: string = '';
  dateToFilter: string = '';

  // Available commission members for this master
  availableMembers: any[] = [];
  availableCommissions: any[] = [];

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;

  constructor(private candidatureService: CandidatureService) {}

  ngOnInit(): void {
    const storedCommissionId = localStorage.getItem('active_commission_id');
    this.selectedCommissionId = storedCommissionId ? Number(storedCommissionId) : null;
    this.loadInitialData();
  }

  loadInitialData(): void {
    // This would typically come from route params or a master selector
    // For now, we'll assume master_id needs to be provided
    // In real scenario, add a master selector
    this.loadCommissionMembers();
  }

  setMaster(masterId: number): void {
    this.masterId = masterId;
    this.selectedMaster = { id: masterId };
    this.resetFilters();
    const storedCommissionId = localStorage.getItem('active_commission_id');
    this.selectedCommissionId = storedCommissionId ? Number(storedCommissionId) : null;
    this.loadCommissionMembers();
  }

  loadCommissionMembers(): void {
    if (!this.masterId) return;

    this.loading = true;
    this.candidatureService.getCommissionMembers(this.masterId).subscribe({
      next: (res: any) => {
        this.commissionMembers = res.members || [];
        this.availableMembers = res.members || [];
        // Extract unique commissions
        const commissionsMap = new Map();
        res.members.forEach((member: any) => {
          commissionsMap.set(member.commission_id, {
            id: member.commission_id,
            name: member.commission_name,
          });
        });
        this.availableCommissions = Array.from(commissionsMap.values());
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors du chargement des membres';
        this.loading = false;
      },
    });
  }

  filterAvis(): void {
    if (!this.masterId) {
      this.errorMessage = 'Veuillez sélectionner un master';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const filters: any = {};
    if (this.selectedCommissionId) {
      filters.commission_id = this.selectedCommissionId;
    }
    if (this.selectedMemberId) {
      filters.member_id = this.selectedMemberId;
    }
    if (this.selectedAvisType) {
      filters.avis_type = this.selectedAvisType;
    }
    if (this.dateFromFilter) {
      filters.date_from = this.dateFromFilter;
    }
    if (this.dateToFilter) {
      filters.date_to = this.dateToFilter;
    }

    this.candidatureService.filterAvisByCommission(this.masterId, filters).subscribe({
      next: (res: any) => {
        this.avis = (res.avis || []).map((item: any) => this.normalizeAvis(item));
        this.statistics = res.statistics || {};
        this.successMessage = `${this.avis.length} avis trouvés`;
        this.currentPage = 1;
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.error || 'Erreur lors de la récupération des avis';
        this.avis = [];
        this.statistics = null;
        this.loading = false;
      },
    });
  }

  resetFilters(): void {
    this.selectedCommissionId = null;
    this.selectedMemberId = null;
    this.selectedAvisType = '';
    this.dateFromFilter = '';
    this.dateToFilter = '';
    this.avis = [];
    this.statistics = null;
    this.currentPage = 1;
    this.errorMessage = '';
    this.successMessage = '';
  }

  deleteAvis(candidatureId: number, avisId: number): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet avis ?')) {
      this.loading = true;
      this.candidatureService.deleteAvis(candidatureId, avisId).subscribe({
        next: () => {
          this.successMessage = 'Avis supprimé avec succès';
          this.avis = this.avis.filter((a) => a.id !== avisId);
          this.filterAvis(); // Refresh statistics
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage = err.error?.error || 'Erreur lors de la suppression';
          this.loading = false;
        },
      });
    }
  }

  viewAvisDetails(candidatureId: number, avisId: number): void {
    this.loading = true;
    this.candidatureService.getAvisDetail(candidatureId, avisId).subscribe({
      next: (res: any) => {
        alert(
          `Avis Détails:\n\nCandidature: #${res.candidature_numero || res.candidature_id}\nMembre: ${res.membre_name || res.member_name || res.membre_user || 'N/A'}\nCommission: ${res.commission_name || 'N/A'}\nAvis: ${res.avis ? 'Favorable' : 'Défavorable'}\nArgument: ${res.argument || 'N/A'}\nDate: ${res.date || res.date_avis}`,
        );
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors de la récupération des détails';
        this.loading = false;
      },
    });
  }

  get paginatedAvis(): any[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.avis.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.avis.length / this.itemsPerPage);
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  exportAvisToCsv(): void {
    if (this.avis.length === 0) {
      alert('Aucun avis à exporter');
      return;
    }

    const headers = ['ID', 'Candidat', 'Membre', 'Commission', 'Avis', 'Date'];
    const rows = this.avis.map((a) => [
      a.id,
      a.candidat_name || a.candidature_numero || `#${a.candidature_id}`,
      a.membre_name || a.member_name || '',
      a.commission_name || '',
      a.avis_type || (a.avis ? 'favorable' : 'defavorable'),
      a.date || a.date_avis || '',
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');

    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    link.download = `avis_${this.masterId}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  private normalizeAvis(item: any): AvisItem {
    return {
      id: item.id,
      candidature_id: item.candidature_id ?? item.candidature,
      candidature_numero: item.candidature_numero,
      candidat_name: item.candidat_name,
      membre_name: item.membre_name || item.member_name,
      member_name: item.member_name || item.membre_name,
      commission_name: item.commission_name,
      commission: item.commission_id ?? item.commission,
      avis: !!item.avis,
      avis_type: item.avis_type,
      argument: item.argument,
      date_avis: item.date_avis,
      date: item.date,
    };
  }
}
