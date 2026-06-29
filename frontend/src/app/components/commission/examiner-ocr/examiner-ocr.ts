import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SpecialitesService } from '../../../services/specialites.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { OcrService, LotOcrResponse, LotOcrResultat, OcrExtractResult } from '../../../services/ocr';
import { ToastrService } from 'ngx-toastr';

interface Candidat {
  id: number;
  first_name: string;
  last_name: string;
  cin: string;
  email: string;
  master_id: number;
  master_nom: string;
  statut_analyse: string;
  analyse_effectuee: boolean;
}

interface DocumentOCR {
  id: number;
  type: string;
  nom: string;
  icon: string;
  url?: string;
  urlSafe?: SafeResourceUrl;
  analyzing: boolean;
  progress: number;
  verification?: {
    statut: string;
    message?: string;
    confiance: number;
    score_extrait?: number | null;
    score_declare?: number | null;
    ecart?: number | null;
    alerte?: string | null;
    anomalies?: string[];
    moteur?: string;
    texte_extrait?: string;
    detail_notes?: {
      l1: number;
      l2: number;
      l3: number;
      mg: number;
      bnr: number;
      bsp: number;
      redoublements: number;
      sessions: number;
      score_recalcule: number;
    };
  };
}

interface RapportFinal {
  resultat: 'valide' | 'invalide';
  message: string;
  documents_valides: number;
  documents_invalides: number;
  total_anomalies: number;
  confiance_globale: number;
}

@Component({
  selector: 'app-examiner-ocr',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './examiner-ocr.html',
  styleUrl: './examiner-ocr.css',
})
export class ExaminerOcrComponent implements OnInit {
  dossiersAnalyses: number = 847;
  tauxPrecision: number = 96.5;

  recherche: string = '';
  filtreMaster: string = '';
  filtreStatut: string = '';
  selectedSpecialite: string = '';

  masters: any[] = [];
  availableSpecialites: string[] = [];
  candidatsEnAttente: Candidat[] = [];
  candidatsFiltres: Candidat[] = [];
  candidatSelectionne: Candidat | null = null;

  documentsOCR: DocumentOCR[] = [];
  analysisEnCours: boolean = false;
  rapportFinal: RapportFinal | null = null;

  documentViewer: any = null;

  // Sélection multiple pour analyse en lot
  selectedIds: Set<number> = new Set();
  lotEnCours: boolean = false;
  lotResultats: LotOcrResultat[] = [];
  lotResume: LotOcrResponse | null = null;
  lotErreur: string | null = null;

  // MOD v7 §7.1 — OCR : vérification de la correspondance de spécialité (relevé)
  specOcrFile: File | null = null;
  specOcrDeclaree: string = '';
  specOcrLoading: boolean = false;
  specOcrResult: OcrExtractResult | null = null;

  constructor(
    private router: Router,
    private sanitizer: DomSanitizer,
    private specialitesService: SpecialitesService,
    private ocrService: OcrService,
    private toast: ToastrService,
  ) {}

  ngOnInit(): void {
    this.loadMasters();
    this.loadCandidats();
    this.specialitesService.getSpecialitesData().subscribe((data) => {
      this.availableSpecialites = this.specialitesService.getAllSpecialties();
      // prefer using service programs to populate masters list
      const progs = this.specialitesService.getPrograms();
      if (progs && progs.length) {
        this.masters = progs.map((p) => ({ id: p.code, nom: p.name }));
      }
    });
  }

  loadMasters(): void {
    // TODO: Charger depuis l'API
    this.masters = [
      { id: 1, nom: 'Master Recherche Génie Logiciel' },
      { id: 2, nom: 'Master Professionnel Data Science' },
      { id: 3, nom: 'Master Recherche Microélectronique' },
    ];
  }

  loadCandidats(): void {
    this.ocrService.listerDossiersOcr().subscribe({
      next: (data: any) => {
        const results: any[] = data?.results ?? data ?? [];
        this.candidatsEnAttente = results.map((item: any) => ({
          id: item.id ?? item.candidature_id,
          first_name: item.candidat?.first_name ?? item.first_name ?? '',
          last_name: item.candidat?.last_name ?? item.last_name ?? '',
          cin: item.candidat?.cin ?? item.cin ?? '',
          email: item.candidat?.email ?? item.email ?? '',
          master_id: item.master?.id ?? item.master_id ?? 0,
          master_nom: item.master?.nom ?? item.master_nom ?? '',
          statut_analyse: item.dossier_valide ? 'analyse_ok' : 'en_attente',
          analyse_effectuee: Boolean(item.dossier_valide),
        }));
        this.candidatsFiltres = [...this.candidatsEnAttente];
        this.dossiersAnalyses = this.candidatsEnAttente.length;
      },
      error: () => {
        // Fallback sur données mock si l'API est inaccessible
        this.candidatsEnAttente = [];
        this.candidatsFiltres = [];
      },
    });
  }

  filtrerCandidats(): void {
    this.candidatsFiltres = this.candidatsEnAttente.filter((c) => {
      const matchRecherche =
        !this.recherche ||
        c.first_name.toLowerCase().includes(this.recherche.toLowerCase()) ||
        c.last_name.toLowerCase().includes(this.recherche.toLowerCase()) ||
        c.cin.includes(this.recherche) ||
        c.email.toLowerCase().includes(this.recherche.toLowerCase());

      const matchMaster = !this.filtreMaster || c.master_id.toString() === this.filtreMaster;
      const matchSpecialite = !this.selectedSpecialite || c.master_nom === this.selectedSpecialite;
      const matchStatut = !this.filtreStatut || c.statut_analyse === this.filtreStatut;

      return matchRecherche && matchMaster && matchStatut && matchSpecialite;
    });
  }

  // ── Sélection multiple ──────────────────────────────────────────────────────

  toggleSelection(id: number): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  isSelected(id: number): boolean {
    return this.selectedIds.has(id);
  }

  toutSelectionner(): void {
    if (this.selectedIds.size === this.candidatsFiltres.length) {
      this.selectedIds.clear();
    } else {
      this.candidatsFiltres.forEach((c) => this.selectedIds.add(c.id));
    }
  }

  // ── MOD v7 §7.1 — OCR correspondance de spécialité ──────────────────────────
  onSpecOcrFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.specOcrFile = input.files && input.files.length ? input.files[0] : null;
    this.specOcrResult = null;
  }

  analyserSpecialiteOcr(): void {
    if (!this.specOcrFile) {
      this.toast.warning('Veuillez choisir un relevé de notes (PDF ou image).');
      return;
    }
    const declaree = (this.specOcrDeclaree || this.candidatSelectionne?.master_nom || '').trim();
    this.specOcrLoading = true;
    this.specOcrResult = null;
    this.ocrService.extraireReleve(this.specOcrFile, declaree, '').subscribe({
      next: (res) => {
        this.specOcrResult = res;
        this.specOcrLoading = false;
        if (res.alerte) {
          this.toast.warning('Spécialité détectée ne correspond pas à la déclaration.');
        } else {
          this.toast.success('Spécialité détectée : correspond à la déclaration.');
        }
      },
      error: () => {
        this.specOcrLoading = false;
        this.toast.error("Erreur lors de l'analyse OCR du relevé.");
      },
    });
  }

  get toutSelectionneLabel(): string {
    return this.selectedIds.size === this.candidatsFiltres.length &&
      this.candidatsFiltres.length > 0
      ? 'Tout désélectionner'
      : 'Tout sélectionner';
  }

  // ── Analyse en lot ──────────────────────────────────────────────────────────

  lancerAnalyseLot(): void {
    if (this.selectedIds.size === 0) return;

    this.lotEnCours = true;
    this.lotResultats = [];
    this.lotResume = null;
    this.lotErreur = null;

    const ids = Array.from(this.selectedIds);
    this.ocrService.analyserLot(ids).subscribe({
      next: (response: LotOcrResponse) => {
        this.lotEnCours = false;
        this.lotResultats = response.resultats || [];
        this.lotResume = response;
        // Met à jour le statut local des candidats analysés
        this.lotResultats.forEach((r) => {
          const candidat = this.candidatsEnAttente.find((c) => c.id === r.candidature_id);
          if (candidat) {
            candidat.statut_analyse = r.statut === 'ok' ? 'analyse_ok' : 'probleme';
            candidat.analyse_effectuee = true;
          }
        });
        this.selectedIds.clear();
        this.filtrerCandidats();
      },
      error: (err: any) => {
        this.lotEnCours = false;
        this.lotErreur =
          err?.error?.error ?? "Erreur lors de l'analyse OCR en lot. Veuillez réessayer.";
      },
    });
  }

  // ────────────────────────────────────────────────────────────────────────────

  selectionnerCandidat(candidat: Candidat): void {
    console.log('👤 Candidat sélectionné:', candidat);
    this.candidatSelectionne = candidat;
    this.rapportFinal = null;
    this.loadDocuments();
  }

  loadDocuments(): void {
    // TODO: Charger depuis l'API
    this.documentsOCR = [
      {
        id: 1,
        type: 'cin',
        nom: "Carte d'identité nationale",
        icon: 'fa-id-card',
        url: '/assets/docs/sample.pdf',
        analyzing: false,
        progress: 0,
      },
      {
        id: 2,
        type: 'releves',
        nom: 'Relevés de notes',
        icon: 'fa-chart-line',
        url: '/assets/docs/sample.pdf',
        analyzing: false,
        progress: 0,
      },
      {
        id: 3,
        type: 'diplome',
        nom: 'Diplôme de Licence',
        icon: 'fa-graduation-cap',
        url: '/assets/docs/sample.pdf',
        analyzing: false,
        progress: 0,
      },
      {
        id: 4,
        type: 'photo',
        nom: "Photo d'identité",
        icon: 'fa-camera',
        url: '/assets/images/photo.jpg',
        analyzing: false,
        progress: 0,
      },
    ];
  }

  analyserDocument(doc: DocumentOCR): void {
    if (!doc.url) {
      this.toast.error('Aucun fichier à analyser');
      return;
    }

    console.log('🤖 Analyse OCR réelle:', doc.nom);
    doc.analyzing = true;
    doc.progress = 0;

    const progressInterval = setInterval(() => {
      if (doc.progress < 90) {
        doc.progress += Math.random() * 25;
      }
    }, 200);

    // ✅ Appel avec un seul argument (documentId)
    this.ocrService.analyserDocument(doc.id).subscribe({
      next: (result: any) => {
        clearInterval(progressInterval);
        doc.progress = 100;
        doc.analyzing = false;

        const statut = result?.statut === 'conforme' ? 'valide' : 'invalide';
        const confiance = Number(result?.confiance ?? 0);

        doc.verification = {
          statut,
          message:
            result?.message ||
            result?.alerte ||
            (statut === 'valide' ? 'Moyenne extraite avec succès' : 'OCR à vérifier'),
          confiance: Math.round(confiance),
          score_extrait: result?.score_extrait ?? null,
          score_declare: result?.score_declare ?? null,
          ecart: result?.ecart ?? null,
          alerte: result?.alerte ?? null,
          anomalies: this.normalizeAnomalies(result?.anomalies),
          moteur: result?.moteur || 'pdfplumber',
          texte_extrait: result?.texte_extrait || '',
          // ✅ Détail des notes extraites (L1/L2/L3 + M.G/B.N.R/B.S.P)
          detail_notes: result?.detail_notes ?? undefined,
        };

        this.toast.success('Analyse OCR terminée avec succès');
        console.log('✅ Résultats OCR:', doc.verification);
      },
      error: (err: any) => {
        clearInterval(progressInterval);
        doc.analyzing = false;
        doc.progress = 0;

        const errorMsg = err?.error?.message || "Erreur lors de l'analyse OCR";
        this.toast.error(errorMsg);

        doc.verification = {
          statut: 'invalide',
          message: errorMsg,
          confiance: 0,
          anomalies: [errorMsg],
          moteur: 'pdfplumber',
          texte_extrait: '',
        };

        console.error('❌ Erreur OCR:', err);
      },
    });
  }

  analyserTousDocuments(): void {
    console.log('🤖 Analyse de tous les documents...');
    this.analysisEnCours = true;

    // Analyser chaque document séquentiellement
    let index = 0;
    const analyserProchain = () => {
      if (index < this.documentsOCR.length) {
        const doc = this.documentsOCR[index];
        if (!doc.verification) {
          this.analyserDocument(doc);

          // Attendre la fin de l'analyse avant de passer au suivant
          setTimeout(() => {
            index++;
            analyserProchain();
          }, 3500);
        } else {
          index++;
          analyserProchain();
        }
      } else {
        // Tous les documents sont analysés
        this.analysisEnCours = false;
        this.genererRapportFinal();
      }
    };

    analyserProchain();
  }

  reanalyserDocument(doc: DocumentOCR): void {
    console.log('🔄 Réanalyse du document:', doc.nom);
    doc.verification = undefined;
    this.analyserDocument(doc);
  }

  genererRapportFinal(): void {
    const documentsValides = this.documentsOCR.filter(
      (d) => d.verification?.statut === 'valide',
    ).length;
    const documentsInvalides = this.documentsOCR.filter(
      (d) => d.verification?.statut === 'invalide',
    ).length;
    const totalAnomalies = this.documentsOCR.reduce(
      (sum, d) => sum + (d.verification?.anomalies?.length || 0),
      0,
    );

    const confianceGlobale = Math.round(
      this.documentsOCR.reduce((sum, d) => sum + (d.verification?.confiance || 0), 0) /
        this.documentsOCR.length,
    );

    const resultat = documentsInvalides === 0 && totalAnomalies === 0 ? 'valide' : 'invalide';

    this.rapportFinal = {
      resultat,
      message:
        resultat === 'valide'
          ? 'Tous les documents sont conformes et valides. Le dossier peut être validé.'
          : `${documentsInvalides} document(s) invalide(s) détecté(s). Le dossier nécessite une vérification manuelle.`,
      documents_valides: documentsValides,
      documents_invalides: documentsInvalides,
      total_anomalies: totalAnomalies,
      confiance_globale: confianceGlobale,
    };

    console.log('📊 Rapport final généré:', this.rapportFinal);
  }

  validerDossier(): void {
    if (confirm('Êtes-vous sûr de vouloir valider ce dossier ?')) {
      console.log('✅ Dossier validé');
      // TODO: Appeler l'API
      alert('Dossier validé avec succès !');
      this.candidatSelectionne!.statut_analyse = 'analyse_ok';
      this.candidatSelectionne = null;
    }
  }

  rejeterDossier(): void {
    const motif = prompt('Motif du rejet :');
    if (!motif) return;

    console.log('❌ Dossier rejeté:', motif);
    // TODO: Appeler l'API
    alert('Dossier rejeté');
    this.candidatSelectionne!.statut_analyse = 'probleme';
    this.candidatSelectionne = null;
  }

  envoyerReclamation(): void {
    if (confirm('Envoyer une réclamation au candidat pour corriger les anomalies ?')) {
      console.log('📧 Réclamation envoyée');
      // TODO: Appeler l'API
      alert('Réclamation envoyée au candidat par email');
    }
  }

  exporterRapport(): void {
    console.log('📥 Export du rapport PDF');
    // TODO: Générer et télécharger le PDF
    alert('Rapport PDF téléchargé !');
  }

  // MOD v7 §7.4 — Export du rapport de conformité OCR (Excel/PDF) depuis le lot.
  exporterRapportConformite(format: 'excel' | 'pdf'): void {
    if (!this.lotResultats.length) {
      this.toast.warning("Lancez d'abord une analyse par lot.");
      return;
    }
    this.ocrService.exporterRapportLot(this.lotResultats, format).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapport_conformite_ocr.${format === 'excel' ? 'xlsx' : 'pdf'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        this.toast.success('Rapport de conformité exporté.');
      },
      error: () => this.toast.error("Erreur lors de l'export du rapport."),
    });
  }

  voirDocument(doc: DocumentOCR): void {
    this.documentViewer = {
      ...doc,
      urlSafe: this.sanitizer.bypassSecurityTrustResourceUrl(doc.url || ''),
    };
  }

  fermerViewer(): void {
    this.documentViewer = null;
  }

  getStatutAnalyseLabel(statut: string): string {
    const labels: any = {
      en_attente: 'En attente',
      analyse_ok: 'Analyse OK',
      probleme: 'Problèmes détectés',
    };
    return labels[statut] || statut;
  }

  formatLabel(key: string | number | symbol): string {
    const keyStr = String(key);
    return keyStr.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  getNbIncoherences(comparaison: { coherent: boolean }[] | undefined): number {
    if (!comparaison) return 0;
    return comparaison.filter((r) => !r.coherent).length;
  }

  normalizeAnomalies(anomalies: any): string[] {
    if (!anomalies) return [];

    if (Array.isArray(anomalies)) {
      return anomalies
        .map((item) => {
          if (typeof item === 'string') {
            return item;
          }

          if (item && typeof item === 'object') {
            return item.message || item.type || JSON.stringify(item);
          }

          return '';
        })
        .filter((item) => item.trim().length > 0);
    }

    return [String(anomalies)];
  }
}
