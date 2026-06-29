import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';
import {
  PARCOURS_SPECIALITE_CATALOG,
  ParcoursSpecialiteOption,
  ScoreCriterion,
  evaluateScoreFormule,
  getParcoursOptionsForType,
  resolveParcoursByCode,
  resolveParcoursByOffreId,
} from '../../../shared/specialites-demandees-catalog';

interface Quota {
  cat: string;
  etab: string;
  places: number;
  diplome: string;
}

interface Offre {
  id: number;
  titre: string;
  type: string;
  soustype: string;
  spec: string;
  limite: string;
  vis: boolean;
  statut: boolean;
  cap: number;
  candidats: number;
  desc: string;
}

@Component({
  selector: 'app-offre-preinscription-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './offre-preinscription-editor.html',
  styleUrl: './offre-preinscription-editor.css',
})
export class OffrePreinscriptionEditorComponent implements OnInit {
  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  // Form fields
  titre: string = 'Master Professionnel Data Science';
  typeFormation: string = 'master';
  soustype: string = 'professionnel';
  spec: string = 'Informatique';
  description: string =
    'Offre de préinscription pour le Master Professionnel en Data Science. Formation orientée Big Data, IA et traitement de données massives.';
  dateDebut: string = '2026-03-01';
  dateFin: string = '2026-07-22';
  dateLimitePre: string = '2026-07-22';
  dateLimiteDep: string = '2026-08-15';
  selectedPdfFile: File | null = null;
  isSavingOffre: boolean = false;
  errorMessage: string = '';

  // Toggles
  appel: boolean = true;
  visibilite: boolean = true;
  row1Open: boolean = false;

  // Quotas
  quotas: Quota[] = [
    {
      cat: 'ISIMM Internes',
      etab: 'ISIMM',
      places: 15,
      diplome: "Licence en Sciences de l'Informatique",
    },
    {
      cat: 'Autres Externes',
      etab: 'Autres établissements',
      places: 8,
      diplome: 'Licence ou équivalent selon la spécialité',
    },
  ];

  // Offres list
  offres: Offre[] = [
    {
      id: 1,
      titre: 'Master Professionnel Data Science',
      type: 'Master',
      soustype: 'professionnel',
      spec: 'Informatique',
      limite: '15/04/2026',
      vis: true,
      statut: false,
      cap: 25,
      candidats: 2,
      desc: 'Formation orientée Big Data, IA et traitement de données massives.',
    },
    {
      id: 2,
      titre: 'Master Recherche Génie Logiciel',
      type: 'Master',
      soustype: 'recherche',
      spec: 'Informatique',
      limite: '30/03/2026',
      vis: true,
      statut: false,
      cap: 30,
      candidats: 0,
      desc: 'Offre temporaire affichée quand le service candidature est indisponible.',
    },
  ];

  previewOpen: boolean = false;
  currentStep: number = 1;
  capaciteTotal: number = 23;

  parcoursCode: string = 'MPGL';
  specialitesDemandees: string[] = [];
  showSpecialitesEditor: boolean = false;
  nouvelleSpecialiteDemandee: string = '';

  scoreCriteres: ScoreCriterion[] = [];
  scoreFormule: string = '';

  get parcoursOptions(): ParcoursSpecialiteOption[] {
    const type = this.typeFormation === 'ingenieur' ? 'cycle_ingenieur' : 'master';
    return getParcoursOptionsForType(type, this.soustype as any);
  }

  get currentParcours(): ParcoursSpecialiteOption | undefined {
    return resolveParcoursByCode(this.parcoursCode);
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const idParam = params.get('id');
      const offreId = idParam ? Number(idParam) : NaN;
      const resolved = !isNaN(offreId) ? resolveParcoursByOffreId(offreId) : undefined;
      if (resolved) {
        this.applyParcours(resolved.code, true);
      } else {
        this.applyParcours(this.parcoursCode, true);
      }
      this.updateTotal();
    });
  }

  applyParcours(code: string, resetSpecialites: boolean): void {
    const parcours = resolveParcoursByCode(code);
    if (!parcours) return;
    this.parcoursCode = parcours.code;
    this.spec = parcours.label;
    this.titre = parcours.titre;
    this.typeFormation = parcours.typeFormation === 'cycle_ingenieur' ? 'ingenieur' : 'master';
    if (parcours.sousType) {
      this.soustype = parcours.sousType;
    }
    if (resetSpecialites || this.specialitesDemandees.length === 0) {
      this.specialitesDemandees = [...parcours.defaultSpecialitesDemandees];
    }
    if (resetSpecialites || this.scoreCriteres.length === 0) {
      this.scoreCriteres = parcours.defaultScoreConfig.criteres.map((c) => ({
        ...c,
        paliers: c.paliers ? c.paliers.map((p) => ({ ...p })) : undefined,
      }));
      this.scoreFormule = parcours.defaultScoreConfig.formule;
    }
    this.syncLive();
  }

  ajouterCritereScore(): void {
    this.scoreCriteres = [
      ...this.scoreCriteres,
      { code: '', label: '', description: '', mode: 'fixe', valeurFixe: 0 },
    ];
  }

  supprimerCritereScore(index: number): void {
    this.scoreCriteres = this.scoreCriteres.filter((_, i) => i !== index);
  }

  onCritereModeChange(critere: ScoreCriterion): void {
    if (critere.mode === 'palier') {
      if (!critere.paliers || critere.paliers.length === 0) {
        critere.paliers = [{ condition: '', points: 0 }];
      }
      critere.formuleCalc = undefined;
      critere.valeurFixe = undefined;
    } else if (critere.mode === 'formule') {
      if (!critere.formuleCalc) critere.formuleCalc = '';
      critere.paliers = undefined;
      critere.valeurFixe = undefined;
    } else if (critere.mode === 'fixe') {
      if (critere.valeurFixe === undefined) critere.valeurFixe = 0;
      critere.paliers = undefined;
      critere.formuleCalc = undefined;
    }
  }

  ajouterPalier(critere: ScoreCriterion): void {
    if (!critere.paliers) critere.paliers = [];
    critere.paliers.push({ condition: '', points: 0 });
  }

  supprimerPalier(critere: ScoreCriterion, index: number): void {
    if (!critere.paliers) return;
    critere.paliers.splice(index, 1);
  }

  insererCodeDansFormule(code: string): void {
    const current = this.scoreFormule || '';
    const trimmed = current.trimEnd();
    if (trimmed.length === 0) {
      this.scoreFormule = code;
    } else {
      const lastChar = trimmed.slice(-1);
      const needsOp = !/[+\-*/(]/.test(lastChar);
      this.scoreFormule = trimmed + (needsOp ? ' + ' : ' ') + code;
    }
  }

  evaluerScoreFormule(): { ok: boolean; value: number | null; error: string | null } {
    return evaluateScoreFormule(this.scoreFormule, this.scoreCriteres);
  }

  onParcoursChange(): void {
    this.applyParcours(this.parcoursCode, true);
  }

  toggleSpecialitesEditor(): void {
    this.showSpecialitesEditor = !this.showSpecialitesEditor;
  }

  ajouterSpecialiteDemandee(): void {
    const value = (this.nouvelleSpecialiteDemandee || '').trim();
    if (!value) return;
    if (this.specialitesDemandees.includes(value)) {
      this.nouvelleSpecialiteDemandee = '';
      return;
    }
    this.specialitesDemandees = [...this.specialitesDemandees, value];
    this.nouvelleSpecialiteDemandee = '';
  }

  supprimerSpecialiteDemandee(index: number): void {
    this.specialitesDemandees = this.specialitesDemandees.filter((_, i) => i !== index);
    this.quotas = this.quotas.map((q) => {
      if (!this.specialitesDemandees.includes(q.diplome)) {
        return { ...q, diplome: '' };
      }
      return q;
    });
  }

  // Stepper navigation
  goStep(n: number): void {
    this.currentStep = n;
  }

  // Quota management
  updateTotal(): void {
    this.capaciteTotal = this.quotas.reduce((a, q) => a + (q.places || 0), 0);
  }

  addQuota(): void {
    this.quotas.push({
      cat: 'Nouvelle catégorie',
      etab: '',
      places: 5,
      diplome: '',
    });
    this.updateTotal();
    this.syncLive();
  }

  delQuota(i: number): void {
    this.quotas.splice(i, 1);
    this.updateTotal();
    this.syncLive();
  }

  // Sync live changes
  syncLive(): void {
    this.offres[0].titre = this.titre;
    this.offres[0].soustype = this.soustype;
    this.offres[0].desc = this.description;
    if (this.dateLimitePre) {
      const d = new Date(this.dateLimitePre);
      this.offres[0].limite = d.toLocaleDateString('fr-FR');
    }
    this.offres[0].cap = this.capaciteTotal;
  }

  onPdfSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;

    if (!file) {
      this.selectedPdfFile = null;
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      this.selectedPdfFile = null;
      this.showToast('Veuillez sélectionner un fichier PDF valide', 't-warn');
      return;
    }

    this.selectedPdfFile = file;
    this.showToast('PDF officiel signé sélectionné', 't-info');
  }

  // Toggle functions
  toggleVis(): void {
    this.visibilite = !this.visibilite;
    this.offres[0].vis = this.visibilite;
    this.updateStatusBar();
  }

  toggleAppel(): void {
    this.appel = !this.appel;
    this.updateStatusBar();
  }

  toggleRow1(): void {
    this.row1Open = !this.row1Open;
    this.offres[0].statut = this.row1Open;
    this.updateStatusBar();
  }

  togglePreview(): void {
    this.previewOpen = !this.previewOpen;
  }

  updateStatusBar(): void {
    // Status bar logic handled in template via computed properties
  }

  // Actions
  enregistrer(): void {
    this.isSavingOffre = true;
    this.errorMessage = '';

    const formData = new FormData();
    formData.append('titre', this.titre);
    formData.append('typeFormation', this.typeFormation);
    formData.append('soustype', this.soustype);
    formData.append('spec', this.spec);
    formData.append('description', this.description);
    formData.append('dateDebut', this.dateDebut);
    formData.append('dateFin', this.dateFin);
    formData.append('dateLimitePre', this.dateLimitePre);
    formData.append('dateLimiteDep', this.dateLimiteDep);
    formData.append('appel', this.appel ? '1' : '0');
    formData.append('visibilite', this.visibilite ? '1' : '0');
    formData.append('actif', this.row1Open ? '1' : '0');

    // Add quotas as JSON
    formData.append('quotas', JSON.stringify(this.quotas));

    // Add PDF if selected
    if (this.selectedPdfFile) {
      formData.append('document_officiel_pdf', this.selectedPdfFile, this.selectedPdfFile.name);
    }

    const token = this.authService.getAccessToken();
    const headers: any = {
      Authorization: `Bearer ${token}`,
    };

    // POST to API
    this.http
      .post(`${environment.commissionServiceUrl}/offres-inscription-responsable`, formData, {
        headers,
      })
      .subscribe(
        (response: any) => {
          this.isSavingOffre = false;
          this.selectedPdfFile = null;
          this.showToast('Offre enregistrée et synchronisée', 't-success');
        },
        (error: any) => {
          this.isSavingOffre = false;
          const errorMsg =
            error?.error?.message || error?.message || "Erreur lors de l'enregistrement";
          this.errorMessage = errorMsg;
          this.showToast(errorMsg, 't-warn');
        },
      );
  }

  publierOffre(): void {
    this.isSavingOffre = true;
    this.errorMessage = '';
    this.row1Open = true;

    const formData = new FormData();
    formData.append('titre', this.titre);
    formData.append('typeFormation', this.typeFormation);
    formData.append('soustype', this.soustype);
    formData.append('spec', this.spec);
    formData.append('description', this.description);
    formData.append('dateDebut', this.dateDebut);
    formData.append('dateFin', this.dateFin);
    formData.append('dateLimitePre', this.dateLimitePre);
    formData.append('dateLimiteDep', this.dateLimiteDep);
    formData.append('appel', this.appel ? '1' : '0');
    formData.append('visibilite', '1'); // Force visible when publishing
    formData.append('actif', '1'); // Force active when publishing

    // Add quotas as JSON
    formData.append('quotas', JSON.stringify(this.quotas));

    // Add PDF if selected
    if (this.selectedPdfFile) {
      formData.append('document_officiel_pdf', this.selectedPdfFile, this.selectedPdfFile.name);
    }

    const token = this.authService.getAccessToken();
    const headers: any = {
      Authorization: `Bearer ${token}`,
    };

    // POST to API for publication
    this.http
      .post(
        `${environment.commissionServiceUrl}/offres-inscription-responsable/publish`,
        formData,
        { headers },
      )
      .subscribe(
        (response: any) => {
          this.isSavingOffre = false;
          this.offres[0].statut = true;
          this.updateStatusBar();
          this.selectedPdfFile = null;
          this.showToast('Offre publiée — visible pour les candidats', 't-success');
        },
        (error: any) => {
          this.isSavingOffre = false;
          this.row1Open = false; // Revert on error
          const errorMsg =
            error?.error?.message || error?.message || 'Erreur lors de la publication';
          this.errorMessage = errorMsg;
          this.showToast(errorMsg, 't-warn');
        },
      );
  }

  showToast(msg: string, cls: string): void {
    console.log(`[${cls}] ${msg}`);
  }

  sendPrompt(prompt: string): void {
    console.log('Prompt:', prompt);
  }

  // Helper methods for template
  isStatusOpen(): boolean {
    return this.visibilite && this.appel && this.row1Open;
  }

  getStatusBarClass(): string {
    return this.isStatusOpen() ? 'status-bar green' : 'status-bar';
  }

  getStatusText(): string {
    return this.isStatusOpen()
      ? 'Statut actuel : Ouverte pour les candidats'
      : 'Statut actuel : Fermée / Non visible';
  }

  getRowStatusClass(isOpen: boolean): string {
    return isOpen ? 'badge b-open' : 'badge b-closed';
  }

  getRowStatusText(isOpen: boolean): string {
    return isOpen ? 'Ouverte' : 'Fermée';
  }

  getOffre(index: number): Offre | undefined {
    return this.offres[index];
  }

  getCardBadgeClass(soustype: string): string {
    return soustype === 'recherche' ? 'recherche' : 'professionnel';
  }

  getCardBadgeText(soustype: string): string {
    return soustype === 'recherche' ? 'PARCOURS RECHERCHE' : 'PARCOURS PROFESSIONNEL';
  }

  getHeadBadgeClass(soustype: string): string {
    return soustype === 'recherche' ? 'hb-recherche' : 'hb-professionnel';
  }

  retourOffreList(): void {
    this.router.navigate(['/commission/dashboard'], {
      queryParams: { view: 'configuration-appels' },
    });
  }
}
