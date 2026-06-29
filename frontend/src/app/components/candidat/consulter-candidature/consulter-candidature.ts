import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CandidatureService } from '../../../services/candidature.service';
import { SpecialitesService } from '../../../services/specialites.service';

interface Candidature {
  id: number;
  first_name?: string;
  last_name?: string;
  cin?: string;
  email?: string;
  numero?: string;
  master_nom?: string;
  type: string;
  type_candidature: string;
  voeux?: string[];
  specialite?: string;
  score?: number;
  statut: string;
  statut_inscription?: string;
  dossier_depose?: boolean;
  motif_rejet?: string;
  date_soumission: string;
  selected?: boolean;
  ocr_analyse?: {
    resultat: 'en_cours' | 'valide' | 'invalide';
    rapport?: {
      documents_valides: number;
      documents_invalides: number;
      anomalies: string[];
      confiance_globale: number;
    };
  };
}

type ProgressStepState = 'done' | 'current' | 'pending' | 'rejected';

interface ProgressStep {
  label: string;
  state: ProgressStepState;
  hint?: string;
}

@Component({
  selector: 'app-consulter-candidatures',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './consulter-candidature.html',
  styleUrl: './consulter-candidature.css',
})
export class ConsulterCandidaturesComponent implements OnInit {
  candidatures: Candidature[] = [];
  candidaturesFiltrees: Candidature[] = [];
  selectedCandidature: Candidature | null = null;
  detailRequested: boolean = false;
  demoMode: boolean = false; // Mode aperçu pour tests

  // ✅ UTILISER UN OBJET filtres AU LIEU DE VARIABLES SÉPARÉES
  filtres = {
    type: '',
    statut: '',
    recherche: '',
  };

  availableSpecialites: string[] = [];
  selectedSpecialite: string = '';

  constructor(
    private candidatureService: CandidatureService,
    private router: Router,
    private route: ActivatedRoute,
    private specialitesService: SpecialitesService,
  ) {}

  ngOnInit(): void {
    this.demoMode = false;
    this.specialitesService.getSpecialitesData().subscribe(() => {
      this.availableSpecialites = this.specialitesService.getAllSpecialties();
    });
    this.route.paramMap.subscribe((params) => {
      const idParam = params.get('id');
      if (!idParam) {
        this.detailRequested = false;
        this.selectedCandidature = null;
        this.loadCandidatures();
        return;
      }

      const id = Number(idParam);
      if (Number.isNaN(id)) {
        this.detailRequested = true;
        this.selectedCandidature = null;
        return;
      }

      this.detailRequested = true;
      this.loadCandidatureDetail(id);
    });
  }

  loadCandidatures(): void {
    this.candidatureService.getMesCandidatures().subscribe({
      next: (data: any[]) => {
        this.candidatures = (data || []).map((item) => this.normalizeCandidature(item));
        this.candidaturesFiltrees = [...this.candidatures];
      },
      error: () => {
        this.candidatures = [];
        this.candidaturesFiltrees = [];
      },
    });
  }

  loadCandidatureDetail(id: number): void {
    this.candidatureService.getCandidature(id).subscribe({
      next: (data: any) => {
        if (Array.isArray(data)) {
          const found = data.find((item: any) => Number(item?.id) === id);
          this.selectedCandidature = found ? this.normalizeCandidature(found) : null;
          return;
        }

        this.selectedCandidature = this.normalizeCandidature(data);
      },
      error: () => {
        this.candidatureService.getMesCandidatures().subscribe({
          next: (items: any[]) => {
            const found = (items || []).find((c: any) => Number(c.id) === id);
            this.selectedCandidature = found ? this.normalizeCandidature(found) : null;
          },
          error: () => {
            this.selectedCandidature = null;
          },
        });
      },
    });
  }

  private normalizeCandidature(item: any): Candidature {
    const fullName = item?.candidat_nom || '';
    const firstName = item?.first_name || fullName.split(' ')[0] || '';
    const lastName = item?.last_name || fullName.split(' ').slice(1).join(' ') || '';
    const masterName = item?.master_nom || item?.master_name || '';
    const cycle = (masterName || '').toLowerCase().includes('ingenieur') ? 'ingenieur' : 'master';

    return {
      id: Number(item?.id),
      first_name: firstName,
      last_name: lastName,
      cin: item?.cin || '',
      email: item?.email || item?.candidat_email || '',
      numero: item?.numero || '',
      master_nom: masterName,
      type: item?.type || cycle,
      type_candidature: item?.type_candidature || cycle,
      voeux: item?.voeux || [],
      specialite: item?.specialite || '',
      score: item?.score,
      statut: item?.statut || 'en_cours',
      statut_inscription: item?.statut_inscription || '',
      dossier_depose: !!item?.dossier_depose,
      motif_rejet: item?.motif_rejet || '',
      date_soumission: item?.date_soumission || '',
    };
  }

  get progressSteps(): ProgressStep[] {
    // MODE DÉMO: Afficher aperçu avec Préinscription et Présélection terminées
    if (this.demoMode) {
      return [
        { label: 'Préinscription', state: 'done' },
        { label: 'Présélection', state: 'done' },
        { label: 'Dépôt de dossier', state: 'current', hint: 'En attente de dépôt' },
        { label: 'Sélection de candidature', state: 'pending' },
        { label: 'Confirmation inscription en ligne', state: 'pending' },
      ];
    }
    return this.buildProgressSteps(this.selectedCandidature);
  }

  private buildProgressSteps(candidature: Candidature | null): ProgressStep[] {
    if (!candidature) {
      return [];
    }

    const statut = (candidature.statut || '').toLowerCase();
    const statutInscription = (candidature.statut_inscription || '').toLowerCase();
    const motifRejet = (candidature.motif_rejet || '').toLowerCase();

    const hasDossierDepose =
      !!candidature.dossier_depose ||
      ['dossier_depose', 'en_attente', 'selectionne', 'inscrit'].includes(statut);

    const reachedPreselection =
      [
        'preselectionne',
        'en_attente_dossier',
        'dossier_non_depose',
        'dossier_depose',
        'en_attente',
        'selectionne',
        'inscrit',
      ].includes(statut) || hasDossierDepose;

    const isRejected = statut === 'rejete';
    const mentionsDossierIssue =
      motifRejet.includes('dossier') ||
      motifRejet.includes('piece') ||
      motifRejet.includes('pièce');
    const mentionsNonAdmis = motifRejet.includes('non admis') || motifRejet.includes('non_admis');

    const rejectedBeforePreselection = isRejected && !reachedPreselection && !hasDossierDepose;
    if (rejectedBeforePreselection) {
      return [
        { label: 'Préinscription', state: 'done' },
        { label: 'Non présélectionné', state: 'rejected' },
      ];
    }

    const dossierMissingPath =
      statut === 'dossier_non_depose' || (isRejected && !hasDossierDepose && mentionsDossierIssue);
    if (dossierMissingPath) {
      return [
        { label: 'Préinscription', state: 'done' },
        { label: 'Présélection', state: 'done' },
        { label: 'Dépôt de dossier', state: 'rejected', hint: 'Dossier non déposé' },
        {
          label: 'Candidature rejetée',
          state: isRejected ? 'rejected' : 'pending',
        },
      ];
    }

    if (statut === 'soumis') {
      return [
        { label: 'Préinscription', state: 'done' },
        { label: 'Présélection', state: 'pending' },
      ];
    }

    if (statut === 'sous_examen') {
      return [
        { label: 'Préinscription', state: 'done' },
        { label: 'Présélection', state: 'current', hint: 'En cours de traitement' },
      ];
    }

    const preselectedDone =
      [
        'preselectionne',
        'en_attente_dossier',
        'dossier_depose',
        'en_attente',
        'selectionne',
        'inscrit',
      ].includes(statut) || hasDossierDepose;
    const dossierDone =
      ['dossier_depose', 'en_attente', 'selectionne', 'inscrit'].includes(statut) ||
      hasDossierDepose;
    const selectedDone = ['selectionne', 'inscrit'].includes(statut);
    const selectedWaiting = [
      'dossier_depose',
      'en_attente',
      'preselectionne',
      'en_attente_dossier',
    ].includes(statut);
    const inscriptionConfirmed = statut === 'inscrit' || statutInscription === 'valide';
    const inscriptionKnownButNotConfirmed =
      !!statutInscription &&
      ['en_attente', 'paiement_soumis', 'refuse'].includes(statutInscription);

    const steps: ProgressStep[] = [
      { label: 'Préinscription', state: 'done' },
      { label: 'Présélection', state: preselectedDone ? 'done' : 'pending' },
      {
        label: 'Dépôt de dossier',
        state: dossierDone ? 'done' : preselectedDone ? 'current' : 'pending',
      },
      {
        label: 'Sélection de candidature',
        state: selectedDone ? 'done' : selectedWaiting ? 'current' : 'pending',
        hint: selectedDone
          ? undefined
          : selectedWaiting
            ? 'En attente de décision finale'
            : undefined,
      },
    ];

    if (inscriptionConfirmed) {
      steps.push({ label: 'Confirmation inscription en ligne', state: 'done' });
      return steps;
    }

    if (isRejected) {
      const rejectionLabel = mentionsNonAdmis ? 'Non admis' : 'Candidature rejetée';
      if (selectedDone || inscriptionKnownButNotConfirmed || mentionsNonAdmis) {
        steps.push({ label: 'Confirmation inscription en ligne', state: 'rejected' });
        steps.push({ label: rejectionLabel, state: 'rejected' });
      } else {
        steps.push({ label: rejectionLabel, state: 'rejected' });
      }
      return steps;
    }

    if (selectedDone || selectedWaiting || inscriptionKnownButNotConfirmed) {
      steps.push({
        label: 'Confirmation inscription en ligne',
        state: selectedDone || inscriptionKnownButNotConfirmed ? 'current' : 'pending',
        hint: 'En attente de paiement/validation',
      });
    }

    return steps;
  }

  statusLabel(statut: string): string {
    const labels: Record<string, string> = {
      soumis: 'Soumis',
      annule: 'Annulé',
      sous_examen: 'Sous examen',
      rejete: 'Rejeté',
      preselectionne: 'Présélectionné',
      en_attente_dossier: 'En attente de dossier',
      dossier_non_depose: 'Dossier non déposé',
      dossier_depose: 'Dossier déposé',
      en_attente: 'En attente',
      selectionne: 'Sélectionné',
      inscrit: 'Inscription confirmée',
    };

    const key = (statut || '').toLowerCase();
    return labels[key] || statut || '-';
  }

  appliquerFiltres(): void {
    this.candidaturesFiltrees = this.candidatures.filter((c) => {
      const matchType = !this.filtres.type || c.type === this.filtres.type;
      const matchStatut = !this.filtres.statut || c.statut === this.filtres.statut;
      const firstName = (c.first_name || '').toLowerCase();
      const lastName = (c.last_name || '').toLowerCase();
      const cin = c.cin || '';
      const email = (c.email || '').toLowerCase();
      const search = (this.filtres.recherche || '').toLowerCase();
      const matchRecherche =
        !this.filtres.recherche ||
        firstName.includes(search) ||
        lastName.includes(search) ||
        cin.includes(this.filtres.recherche) ||
        email.includes(search);

      const matchSpecialite =
        !this.selectedSpecialite ||
        (c.specialite || c.master_nom || '') === this.selectedSpecialite;

      return matchType && matchStatut && matchRecherche && matchSpecialite;
    });
  }

  resetFiltres(): void {
    this.filtres = {
      type: '',
      statut: '',
      recherche: '',
    };
    this.candidaturesFiltrees = [...this.candidatures];
  }

  countByType(type: string): number {
    return this.candidaturesFiltrees.filter((c) => c.type === type).length;
  }

  countByStatut(statut: string): number {
    return this.candidaturesFiltrees.filter((c) => c.statut === statut).length;
  }

  toggleSelectAll(event: any): void {
    const checked = event.target.checked;
    this.candidaturesFiltrees.forEach((c) => (c.selected = checked));
  }

  hasSelection(): boolean {
    return this.candidaturesFiltrees.some((c) => c.selected);
  }

  countSelected(): number {
    return this.candidaturesFiltrees.filter((c) => c.selected).length;
  }

  analyserDossier(candidature: Candidature): void {
    candidature.ocr_analyse = {
      resultat: 'en_cours',
      rapport: undefined,
    };

    setTimeout(() => {
      const problemes = Math.random() > 0.7;

      candidature.ocr_analyse = {
        resultat: problemes ? 'invalide' : 'valide',
        rapport: {
          documents_valides: problemes ? 3 : 4,
          documents_invalides: problemes ? 1 : 0,
          anomalies: problemes ? ['Tampon manquant'] : [],
          confiance_globale: problemes ? 75 : 98,
        },
      };

      if (problemes) {
        if (confirm('Anomalies détectées. Envoyer réclamation ?')) {
          this.envoyerReclamation(candidature);
        }
      } else {
        alert('✅ Dossier valide !');
        candidature.statut = 'validee';
      }
    }, 3000);
  }

  voirRapportOCR(candidature: Candidature): void {
    if (!candidature.ocr_analyse?.rapport) {
      alert('Aucun rapport disponible');
      return;
    }

    const r = candidature.ocr_analyse.rapport;
    alert(`
📊 RAPPORT OCR
━━━━━━━━━━━━━━
✅ Valides: ${r.documents_valides}
❌ Invalides: ${r.documents_invalides}
🎯 Confiance: ${r.confiance_globale}%
${r.anomalies.length > 0 ? '\n⚠️ ' + r.anomalies.join('\n⚠️ ') : '✅ Aucune anomalie'}
    `);
  }

  envoyerReclamation(candidature: Candidature): void {
    alert(`📧 Réclamation envoyée à ${candidature.first_name} ${candidature.last_name}`);
  }

  voirDetails(candidature: Candidature): void {
    this.router.navigate(['/consultation-dossier', candidature.id]);
  }

  retourDashboard(): void {
    this.router.navigate(['/candidat/dashboard']);
  }

  voirDossier(candidature: Candidature): void {
    this.router.navigate(['/consultation-dossier', candidature.id], {
      queryParams: { candidatureId: candidature.id },
    });
  }

  statusClass(statut: string): string {
    const value = (statut || '').toLowerCase();
    if (value.includes('rej') || value.includes('annul')) {
      return 'status-rejected';
    }
    if (
      value.includes('inscrit') ||
      value.includes('valid') ||
      value.includes('accept') ||
      value.includes('select')
    ) {
      return 'status-approved';
    }
    return 'status-pending';
  }

  exporterExcel(): void {
    const selected = this.candidaturesFiltrees.filter((c) => c.selected);
    alert(`Export Excel de ${selected.length} candidature(s)`);
  }

  imprimer(): void {
    window.print();
  }
}
