import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ReclamationDetailDialogComponent } from './reclamation-detail-dialog.component';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { CandidatureService, MasterScoreCoefficients } from '../../../services/candidature.service';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { WebSocketService, ConnectionStatus } from '../../../services/websocket.service';
import { isPublicOffer } from '../../../shared/public-offer';
import {
  PARCOURS_SPECIALITE_CATALOG,
  resolveParcoursByCode,
  resolveParcoursByOffreId,
  ScoreCriterion,
} from '../../../shared/specialites-demandees-catalog';
import { ScoreService, FormDataCandidat, ScoreDetailItem } from '../../../services/score.service';
import { environment } from '../../../../environments/environment';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  UNIVERSITIES_DATA,
  UNIVERSITIES_LIST,
  isISIMMSelection,
  getEtablissementsForUniversite,
} from '../../../shared/constants/universities';

interface Candidature {
  id: number;
  numero: string;
  prenom?: string;
  nom?: string;
  master_nom: string;
  master?: number;
  master_id?: number;
  statut: string;
  motif_rejet?: string;
  date_soumission: string;
  date_mise_a_jour?: string;
  etat_candidature?: string;
  dossier_valide: boolean;
  date_depot_dossier?: string;
  dossier_depose: boolean;
  score?: number;
  classement?: string | number;
  total_candidats?: number;
  statut_inscription?: string;
  numero_inscription_universitaire?: string;
  numero_inscription?: string;
  attestation_paiement_url?: string;
  annee_universitaire?: string;
  choix_priorite?: number;
  date_limite_modification?: string;
  peut_modifier?: boolean;
  jours_restants?: number;
  historique_statut?: HistoriqueStatutItem[];
  historiqueStatut?: HistoriqueStatutItem[];
}

type WorkflowStageState = 'done' | 'current' | 'pending' | 'rejected';

interface WorkflowStage {
  label: string;
  state: WorkflowStageState;
  hint?: string;
}

interface HistoriqueStatutItem {
  statut?: string;
  etat?: string;
  state?: string;
  libelle?: string;
  label?: string;
  date?: string;
  created_at?: string;
  updated_at?: string;
  commentaire?: string;
  motif?: string;
}

interface Master {
  id: number;
  nom: string;
  type: string;
  description: string;
  date_limite: string;
  places: number;
  statut?: 'ouvert' | 'ferme';
  specialite?: string;
}

interface Offre {
  id: number;
  master_id?: number;
  titre: string;
  type: 'master' | 'cycle_ingenieur';
  sous_type?: string;
  specialite?: string;
  code?: string;
  description: string;
  date_limite: string;
  places?: number;
  statut: 'ouvert' | 'ferme';
  document_officiel_pdf_url?: string | null;
  est_cache?: boolean;
  est_visible?: boolean;
  publie_par_responsable?: boolean;
  nombre_candidats_inscrits?: number;
}

interface DossierCandidature {
  id: number;
  numero_dossier: string;
  candidature_id: number;
  numero_candidature: string;
  master_nom: string;
  statut: string;
  dossier_depose?: boolean;
  dossier_valide?: boolean;
  date_soumission?: string;
}

interface DossierPreferenceForm {
  nom_prenom: string;
  etablissement_origine: string;
  diplome: string;
  choix_1: string;
  choix_2: string;
  choix_3: string;
  numero_dossier_reserve_administration: string;
}

interface Document {
  id: number;
  nom: string;
  icon: string;
  depose: boolean;
  date_mise_a_jour?: string;
  date_depot?: string;
  obligatoire?: boolean;
  fichier_url?: string;
}

interface Reclamation {
  id: number;
  identifiant: string;
  objet: string;
  master_nom: string;
  master_id: number;
  motif: string;
  date: string;
  statut: string;
  reponse?: string | null;
}

interface NotificationItem {
  id: number;
  titre: string;
  message: string;
  date: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  lue: boolean;
}

interface FichierHistorique {
  nom: string;
  date: string;
  id: number;
}

interface OffreDetailRow {
  capaciteAccueilleTotale: string;
  etablissementOrigine: string;
  capaciteAccueille: string;
  typeDiplome: string;
  coefficients?: string;
  datesImportantes: string;
}

interface SummaryCard {
  title: string;
  value: number | string;
  subtitle: string;
  icon: string;
  tone: 'indigo' | 'blue' | 'green' | 'orange';
  progress: number;
}

interface DeadlineCountdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

interface QuickActionCard {
  key: 'modifier' | 'notifications';
  title: string;
  description: string;
  icon: string;
  badge?: number;
}

interface DashboardTimelineItem {
  title: string;
  subtitle: string;
  statusLabel: string;
  tone: 'success' | 'warning' | 'info';
  icon: string;
}

interface HistoriqueItem {
  id?: number;
  titre?: string;
  description?: string;
  date?: string;
  color?: string;
  annee_universitaire?: string;
  numero?: string;
  master_nom?: string;
  score?: number;
  classement?: string;
  statut_final?: string;
  date_soumission?: string;
  historique_statut?: HistoriqueStatutItem[];
}

type ExportFormat = 'csv' | 'json' | 'pdf' | 'xlsx';
type ExportRow = Record<string, string | number | boolean | null | undefined>;

type CandidatView =
  | 'dashboard'
  | 'profil'
  | 'offres-inscription'
  | 'candidatures'
  | 'mon-dossier'
  | 'inscription'
  | 'suivi'
  | 'historique'
  | 'reclamations'
  | 'notifications'
  | 'importer';

type ProfileTab = 'personnel' | 'academique' | 'documents' | 'securite';

interface CandidatActionPermissions {
  preinscription: boolean;
  consultationCandidature: boolean;
  consultationDossier: boolean;
  depotDossier: boolean;
  suiviCandidature: boolean;
  deposerReclamation: boolean;
}

function normalizeActionLabel(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

@Component({
  selector: 'app-dashboard-candidat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatDialogModule,
    MatProgressBarModule,
    MatTabsModule,
    MatStepperModule,
    MatTooltipModule,
    DragDropModule,
  ],
  templateUrl: './dashboard-candidat.html',
  styleUrls: ['./dashboard-candidat.css', './dashboard-candidat-wizard.css', './dashboard-candidat-sections.css'],
})
export class DashboardCandidatComponent implements OnInit, OnDestroy {
  private readonly candidatureApiBase = environment.candidatureServiceUrl;
  private readonly serviceApiBase = this.candidatureApiBase.replace(/\/candidatures$/, '');
  currentUser: any = null;
  currentView: CandidatView = 'dashboard';
  currentDate: Date = new Date();
  candidatureTabIndex: number = 0;
  candidatureViewMode: 'cards' | 'table' = 'cards';

  /** The next upcoming candidature with a future date_limite_modification. Drives the countdown. */
  get nextDeadlineCandidature(): Candidature | null {
    const now = Date.now();
    const upcoming = (this.mesCandidatures || [])
      .filter((c) => c.date_limite_modification && new Date(c.date_limite_modification).getTime() > now)
      .sort((a, b) => new Date(a.date_limite_modification!).getTime() - new Date(b.date_limite_modification!).getTime());
    return upcoming[0] ?? null;
  }

  private get deadlineDate(): Date {
    const next = this.nextDeadlineCandidature;
    if (next?.date_limite_modification) {
      return new Date(next.date_limite_modification);
    }
    return new Date(Date.now() - 1000);
  }

  // ── Nouvelles propriétés ──
  dragOverDocId: number | null = null;
  uploadProgress: { [docId: string]: number } = {};
  uploadErrors: { [docId: string]: string } = {};
  apercuDoc: any = null;
  finalisationLoading = false;

  // Explore Section Properties
  rechercheOffre: string = '';
  rechercheDateOffre: string = '';
  displayedDetailColumns: string[] = [
    'etablissementOrigine',
    'capaciteAccueille',
    'typeDiplome',
    'coefficients',
    'datesImportantes',
  ];

  get userDisplayName(): string {
    return this.currentUser
      ? `${this.currentUser.first_name} ${this.currentUser.last_name}`
      : 'Candidat';
  }

  get profileCompletionPercent(): number {
    const checks = [
      !!(this.profileData?.first_name || this.currentUser?.first_name),
      !!(this.profileData?.last_name || this.currentUser?.last_name),
      !!(this.profileData?.email || this.currentUser?.email),
      !!(this.profileData?.phone || this.currentUser?.phone),
      !!(this.profileData?.address || this.currentUser?.address),
      !!(this.profileData?.etablissement_origine || this.currentUser?.etablissement_origine),
      !!(this.profileData?.diplome || this.currentUser?.diplome),
      this.documentsRequis.length > 0 && this.documentsDeposes / this.documentsRequis.length >= 0.5,
    ];

    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  }

  // ── Calculs complétude dossier ──
  get documentsTotaux(): number {
    return this.documentsRequis.filter((d) => d.obligatoire !== false).length;
  }

  get documentsValides(): number {
    return this.documentsRequis.filter((d) => d.obligatoire !== false && d.depose === true).length;
  }

  get completionPercent(): number {
    if (this.documentsTotaux === 0) return 0;
    return Math.round((this.documentsValides / this.documentsTotaux) * 100);
  }

  // Req-2 — Limite des vœux (Cas A Masters)
  readonly LIMITE_VOEUX_MASTERS = 3;

  /** Compte les candidatures Masters actives (non rejetées/annulées). */
  get nbVoeuxMastersActifs(): number {
    return this.mesCandidatures.filter((c) => {
      const statut = (c.statut || '').toLowerCase();
      if (['rejete', 'annulee', 'non_admis'].includes(statut)) return false;
      const spec = String((c as any).master_specialite || '').toUpperCase();
      return !spec.startsWith('ING');
    }).length;
  }

  /** Vrai si la limite de 3 vœux Masters est atteinte. */
  get limiteVoeuxAtteinte(): boolean {
    return this.nbVoeuxMastersActifs >= this.LIMITE_VOEUX_MASTERS;
  }

  /** Label dynamique pour le bouton Postuler. */
  getLibellePostuler(offre: Offre): string {
    if (offre?.statut === 'ferme') return 'Fermée';
    if (this.dejaCandidature(offre.id)) return 'Déjà candidaté';
    const spec = String((offre as any).specialite || '').toUpperCase();
    const isIngenieur = spec.startsWith('ING');
    if (isIngenieur) return 'Postuler au concours';
    const prochainVoeu = this.nbVoeuxMastersActifs + 1;
    if (prochainVoeu > this.LIMITE_VOEUX_MASTERS) return 'Limite 3 vœux atteinte';
    return `Postuler — Vœu ${prochainVoeu}/${this.LIMITE_VOEUX_MASTERS}`;
  }

  /** Vrai si le bouton doit être bloqué. */
  isPostulerBloque(offre: Offre): boolean {
    if (offre?.statut === 'ferme') return true;
    if (this.dejaCandidature(offre.id)) return true;
    const spec = String((offre as any).specialite || '').toUpperCase();
    const isIngenieur = spec.startsWith('ING');
    if (!isIngenieur && this.limiteVoeuxAtteinte) return true;
    return false;
  }

  /** Badge médaille selon priorité du vœu. */
  getMedailleVoeu(priorite: number | undefined): string {
    if (priorite === 1) return '🥇';
    if (priorite === 2) return '🥈';
    if (priorite === 3) return '🥉';
    return '🎯';
  }

  /** Vœux Masters actifs triés par priorité (pour drag & drop). */
  get voeuxMastersOrdonnes(): Candidature[] {
    return this.mesCandidatures
      .filter((c) => {
        const statut = (c.statut || '').toLowerCase();
        if (['rejete', 'annulee', 'non_admis'].includes(statut)) return false;
        const spec = String((c as any).master_specialite || '').toUpperCase();
        return !spec.startsWith('ING');
      })
      .sort((a, b) => (a.choix_priorite || 99) - (b.choix_priorite || 99));
  }

  /** Drag & drop — réordonner les vœux Masters. */
  onVoeuDrop(event: CdkDragDrop<Candidature[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const liste = [...this.voeuxMastersOrdonnes];
    moveItemInArray(liste, event.previousIndex, event.currentIndex);
    // Mise à jour locale immédiate (optimiste)
    liste.forEach((c, i) => {
      const cand = this.mesCandidatures.find((x) => x.id === c.id);
      if (cand) (cand as any).choix_priorite = i + 1;
    });
    // Appel backend
    const ordre = liste.map((c) => c.id);
    const token = this.authService.getAccessToken();
    this.http
      .post(
        `${environment.candidatureServiceUrl}/mes-candidatures/reclasser-voeux/`,
        { ordre },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: () => {
          this.toastService.show('Vœux reclassés avec succès', 'success');
        },
        error: (err) => {
          this.toastService.show(
            err?.error?.error || 'Échec du reclassement, état restauré',
            'warning',
          );
          this.loadMesCandidatures();
        },
      });
  }

  // Req — Statuts qui autorisent le dépôt de dossier
  readonly STATUTS_DEPOT_AUTORISE = ['preselectionne', 'dossier_depose', 'en_attente_dossier'];

  get canDeposerDossier(): boolean {
    return this.mesCandidatures.some((c) =>
      this.STATUTS_DEPOT_AUTORISE.includes((c.statut || '').toLowerCase()),
    );
  }

  /** Liste des candidatures éligibles au dépôt (triées par priorité de vœu). */
  get candidaturesEligiblesDepot(): Candidature[] {
    return this.mesCandidatures
      .filter((c) => this.STATUTS_DEPOT_AUTORISE.includes((c.statut || '').toLowerCase()))
      .sort((a, b) => (a.choix_priorite || 99) - (b.choix_priorite || 99));
  }

  /** Mode d'affichage de la page Dossiers de candidature (Req-Dépôt). */
  get modeAffichageDossiers(): 'aucune' | 'bloquee' | 'unique' | 'selecteur' {
    const eligibles = this.candidaturesEligiblesDepot.length;
    if (eligibles === 0) {
      const enAttente = this.mesCandidatures.some((c) =>
        ['soumise', 'soumis', 'sous_examen'].includes((c.statut || '').toLowerCase()),
      );
      return enAttente ? 'bloquee' : 'aucune';
    }
    return eligibles === 1 ? 'unique' : 'selecteur';
  }

  /** Candidature actuellement sélectionnée pour dépôt (multi-vœux). */
  candidatureDepotActive: Candidature | null = null;

  choisirVoeuPourDepot(c: Candidature): void {
    this.candidatureDepotActive = c;
  }

  retourSelecteurVoeux(): void {
    this.candidatureDepotActive = null;
  }

  get isSelectionne(): boolean {
    return this.mesCandidatures.some(c =>
      ['selectionne', 'inscrit'].includes((c.statut || '').toLowerCase())
    );
  }

  isSidebarOpen: boolean = false;
  activeProfileTab: ProfileTab = 'personnel';
  isProfileEditMode: boolean = false;

  showAlert: boolean = true;

  filtreAnnee: string = '';
  selectedDossierNumber: string | null = null;
  dossierPreferenceForm: DossierPreferenceForm = {
    nom_prenom: '',
    etablissement_origine: 'ISIMM',
    diplome: '',
    choix_1: '',
    choix_2: '',
    choix_3: '',
    numero_dossier_reserve_administration: '',
  };
  selectedCandidatureForInscription: Candidature | null = null;
  openActionMenuId: number | null = null;
  openInscriptionActionMenuId: number | null = null;
  openHistoriqueMenuId: number | null = null;
  showRecapModal: boolean = false;
  savingInscriptionNumberId: number | null = null;
  inscriptionExportFormat: ExportFormat = 'pdf';
  notificationsNonLues = 0;
  isDashboardLoading = true;
  isHistoriqueLoading = false;
  isWorkflowMockMode = false;
  isPreferenceFormDemoMode = false;
  showEditCandidatureModal: boolean = false;
  selectedCandidatureForEdit: Candidature | null = null;
  editChoixPriorite: number = 1;
  showSubmissionWizardModal: boolean = false;
  isOffresInscriptionFallback: boolean = false;
  // Keep step navigation constrained to completed steps.
  wizardAllowFreeNavigation: boolean = false;
  wizardCurrentStep: number = 1;
  wizardMaxAllowedStep: number = 1;
  readonly wizardTotalSteps: number = 3;
  readonly wizardStepsMeta: Array<{ label: string }> = [
    { label: 'Informations Personnelles' },
    { label: 'Diplôme et Formation' },
    { label: 'Validation et Synthèse' },
  ];
  wizardOffre: Offre | null = null;
  selectedOffreDetail: Offre | null = null;
  showOffreDetailModal = false;
  currentOffreDetailCode: string | null = null;

  // Real-time score calculation from backend
  wizardComputedScoreBackend: number | null = null;
  wizardComputedScoreInstantane: number | null = null;
  wizardComputedScoreLoading: boolean = false;
  wizardComputedScoreError: string | null = null;
  wizardMasterCoefficients: MasterScoreCoefficients | null = null;
  private wizardScoreCalculationTimer: ReturnType<typeof setTimeout> | null = null;

  wizardTouched: {
    nom: boolean;
    prenom: boolean;
    cinPasseport: boolean;
    dateNaissance: boolean;
    email: boolean;
    telephone: boolean;
    etablissementOrigine: boolean;
    anneeBac: boolean;
    anneeObtentionDiplome: boolean;
    confirmationText: boolean;
    moyenneBacPrincipale: boolean;
    noteMathBac: boolean;
    noteFrancaisBac: boolean;
    noteAnglaisBac: boolean;
    moyenne1Annee: boolean;
    moyenne2Annee: boolean;
    moyenne3Annee: boolean;
    moyenne4Annee: boolean;
    moyenneIng1: boolean;
  } = {
    nom: false,
    prenom: false,
    cinPasseport: false,
    dateNaissance: false,
    email: false,
    telephone: false,
    etablissementOrigine: false,
    anneeBac: false,
    anneeObtentionDiplome: false,
    confirmationText: false,
    moyenneBacPrincipale: false,
    noteMathBac: false,
    noteFrancaisBac: false,
    noteAnglaisBac: false,
    moyenne1Annee: false,
    moyenne2Annee: false,
    moyenne3Annee: false,
    moyenne4Annee: false,
    moyenneIng1: false,
  };
  readonly wizardRequiredDocs: Array<{ label: string; icon: string; hint: string }> = [
    {
      label: 'Copie du CIN / Passeport',
      icon: 'fa-id-card',
      hint: 'PDF/JPG/PNG - max 5 Mo',
    },
    {
      label: 'Diplôme ou attestation',
      icon: 'fa-graduation-cap',
      hint: 'Document lisible et complet',
    },
    {
      label: 'Relevés de notes',
      icon: 'fa-table',
      hint: 'Toutes les années demandées',
    },
    {
      label: 'CV',
      icon: 'fa-file-alt',
      hint: 'Format PDF recommandé',
    },
  ];
  wizardUploadedFiles: Array<File | null> = [];
  wizardDragOverIndex: number | null = null;
  wizardSubmitting: boolean = false;
  // MOD 1 — Données cascade Université / Établissement (exposées au template)
  readonly UNIVERSITIES_LIST: string[] = UNIVERSITIES_LIST;

  getWizardEtablissements(): string[] {
    return getEtablissementsForUniversite(this.wizardData.universite || '');
  }

  /**
   * MOD 1 — Quand l'utilisateur change d'université, on réinitialise
   * l'établissement et le flag isISIMM (la nouvelle université peut ne pas
   * proposer le même établissement).
   */
  onWizardUniversiteChange(): void {
    this.wizardData.etablissement = '';
    this.wizardData.isISIMM = false;
    // Compat ascendante avec l'ancien champ natureCandidature
    this.wizardData.natureCandidature = '';
  }

  /**
   * MOD 1 — Quand l'utilisateur sélectionne un établissement, on calcule
   * le flag isISIMM et on synchronise les anciens champs (etablissementOrigine,
   * natureCandidature, etablissementExterne) pour rester compatible avec le
   * reste du wizard et le payload envoyé à l'API.
   */
  onWizardEtablissementChange(): void {
    const uni = this.wizardData.universite || '';
    const etab = this.wizardData.etablissement || '';
    this.wizardData.isISIMM = isISIMMSelection(uni, etab);

    // Synchronisation avec les anciens champs (préserve le calcul de score
    // et les vues qui se basent sur etablissementOrigine / natureCandidature).
    if (this.wizardData.isISIMM) {
      this.wizardData.etablissementOrigine = 'ISIMM';
      this.wizardData.etablissementOrigineType = 'ISIMM';
      this.wizardData.natureCandidature = 'Étudiant ISIMM';
      this.wizardData.etablissementExterne = '';
    } else if (etab) {
      this.wizardData.etablissementOrigine = etab;
      this.wizardData.etablissementOrigineType = 'Externe';
      this.wizardData.natureCandidature = 'Étudiant Externe';
      this.wizardData.etablissementExterne = etab;
    }

    // Recalculer le score live si la fonction existe
    if (typeof this.triggerWizardScoreCalculation === 'function') {
      this.triggerWizardScoreCalculation();
    }
  }

  wizardData: {
    nom: string;
    prenom: string;
    cinPasseport: string;
    dateNaissance: string;
    email: string;
    telephone: string;
    etablissementOrigine: string;
    etablissementOrigineType: 'ISIMM' | 'Externe' | '';
    etablissementExterneNom: string;
    specialiteBac: string;
    anneeBac: string;
    moyenneBacPrincipale: string;
    noteMathBac: string;
    noteFrancaisBac: string;
    noteAnglaisBac: string;
    certificationB2: 'non' | 'oui' | '';
    specialiteDiplome: string;
    anneeObtentionDiplome: string;
    natureDiplome: 'Licence' | 'Maitrise' | '';
    moyenne1Annee: string;
    session1Annee: 'Principale' | 'control' | '';
    moyenne2Annee: string;
    session2Annee: 'Principale' | 'control' | '';
    moyenne3Annee: string;
    session3Annee: 'Principale' | 'control' | '';
    natureCandidature: 'Étudiant ISIMM' | 'Étudiant Externe' | '';
    etablissementExterne: string;
    specialiteExterne: string;
    // MOD 1 — Cascade Université / Établissement
    universite: string;
    etablissement: string;
    isISIMM: boolean;
    moyenne4Annee: string;
    session4Annee: 'Principale' | 'control' | '';
    nombreRedoublement: string;
    moyenneIng1: string;
    sessionReussiteIng1: 'Principale' | 'control' | '';
    nombreRedoublementIng1: string;
    confirmationDeclaration: boolean;
    confirmationText: string;
  } = {
    nom: '',
    prenom: '',
    cinPasseport: '',
    dateNaissance: '',
    email: '',
    telephone: '',
    etablissementOrigine: 'ISIMM',
    etablissementOrigineType: 'ISIMM',
    etablissementExterneNom: '',
    specialiteBac: '',
    anneeBac: '',
    moyenneBacPrincipale: '',
    noteMathBac: '',
    noteFrancaisBac: '',
    noteAnglaisBac: '',
    certificationB2: '',
    specialiteDiplome: '',
    anneeObtentionDiplome: '',
    natureDiplome: '',
    moyenne1Annee: '',
    session1Annee: '',
    moyenne2Annee: '',
    session2Annee: '',
    moyenne3Annee: '',
    session3Annee: '',
    natureCandidature: '',
    etablissementExterne: '',
    specialiteExterne: '',
    universite: '',
    etablissement: '',
    isISIMM: false,
    moyenne4Annee: '',
    session4Annee: '',
    nombreRedoublement: '',
    moyenneIng1: '',
    sessionReussiteIng1: '',
    nombreRedoublementIng1: '',
    confirmationDeclaration: false,
    confirmationText: '',
  };

  private countdownNow: number = Date.now();
  private countdownTimerId: ReturnType<typeof setInterval> | null = null;
  private ws: WebSocket | null = null;
  private reconnectTimerId: ReturnType<typeof setTimeout> | null = null;
  private wsReconnectAttempts: number = 0;
  private readonly wsReconnectMaxAttempts: number = 3;
  private queryParamsSub: Subscription | null = null;
  private readonly wsReconnectDelayMs = 3000;
  public ConnectionStatus = ConnectionStatus;
  public socketConnectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private socketStatusSub: Subscription | null = null;

  mesCandidatures: Candidature[] = [
    {
      id: 1,
      numero: '2603-00001-GL',
      master_nom: 'Master Recherche Génie Logiciel',
      master_id: 1,
      statut: 'selectionne',
      date_soumission: '2026-02-15',
      etat_candidature: 'Sélectionné',
      dossier_valide: true,
      date_depot_dossier: '2026-02-20',
      dossier_depose: true,
      score: 16.5,
      classement: '3',
      total_candidats: 45,
      statut_inscription: 'en_attente',
      numero_inscription_universitaire: '26-999-ABC',
    },
    {
      id: 2,
      numero: '2603-00002-DS',
      master_nom: 'Master Professionnel Data Science',
      master_id: 2,
      statut: 'en_attente',
      date_soumission: '2026-02-15',
      etat_candidature: 'En attente',
      dossier_valide: true,
      date_depot_dossier: '2026-02-20',
      dossier_depose: true,
      score: 15.2,
      classement: '12',
      total_candidats: 50,
    },
    {
      id: 3,
      numero: '2603-00003-ING',
      master_nom: 'Cycle Ingénieur Informatique',
      master_id: 3,
      statut: 'soumis',
      date_soumission: '2026-02-16',
      etat_candidature: 'En cours',
      dossier_valide: false,
      date_depot_dossier: '',
      dossier_depose: false,
    },
  ];

  offresInscription: Offre[] = [
    {
      id: 1,
      titre: 'Mastere Professionnel Genie Logiciel (MPGL)',
      type: 'master',
      sous_type: 'professionnel',
      code: 'MPGL',
      description: '',
      date_limite: '2026-07-22',
      places: 35,
      statut: 'ouvert',
    },
    {
      id: 2,
      titre: 'Mastere Professionnel en sciences de donnees (MPDS)',
      type: 'master',
      sous_type: 'professionnel',
      code: 'MPDS',
      description: '',
      date_limite: '2026-07-22',
      places: 35,
      statut: 'ouvert',
    },
    {
      id: 3,
      titre: 'Mastere Professionnel en Ingenieries en Instrumentation industrielle (MP3I)',
      type: 'master',
      sous_type: 'professionnel',
      code: 'MP3I',
      description: '',
      date_limite: '2026-07-20',
      places: 25,
      statut: 'ouvert',
    },
    {
      id: 4,
      titre: 'Mastere Recherche en Genie logiciel (MRGL)',
      type: 'master',
      sous_type: 'recherche',
      code: 'MRGL',
      description: '',
      date_limite: '2026-07-22',
      places: 111,
      statut: 'ouvert',
    },
    {
      id: 5,
      titre: 'Mastere Recherche en micro-electronique et instrumentation (MRMI)',
      type: 'master',
      sous_type: 'recherche',
      code: 'MRMI',
      description: '',
      date_limite: '2026-07-20',
      places: 29,
      statut: 'ouvert',
    },
    {
      id: 6,
      titre: 'Ingenieur en sciences Appliquees et Technologie - Genie Logiciel (ING-GL)',
      type: 'cycle_ingenieur',
      code: 'ING_GL',
      specialite: 'Genie Logiciel',
      description: '',
      date_limite: '2026-08-08',
      places: 65,
      statut: 'ouvert',
    },
  ];

  dossiersCandidature: DossierCandidature[] = [
    {
      id: 1,
      numero_dossier: '2603-00001',
      candidature_id: 1,
      numero_candidature: '2603-00001-GL',
      master_nom: 'Master Génie Logiciel',
      statut: 'accepte',
      date_soumission: '2026-02-10',
    },
    {
      id: 2,
      numero_dossier: '2603-00002',
      candidature_id: 2,
      numero_candidature: '2603-00002-GL',
      master_nom: 'Mastère Recherche en Génie Logiciel (MRGL)',
      statut: 'en_attente',
      date_soumission: '2026-02-12',
    },
  ];

  notificationsCandidat: NotificationItem[] = [];
  notificationsErreur: string = '';
  filtreNotificationType: '' | 'info' | 'success' | 'warning' | 'danger' = '';
  filtreNotificationTriRapide: 'recent' | 'critique' = 'recent';
  filtreNotificationDateDebut: string = '';
  filtreNotificationDateFin: string = '';
  filtreNotificationRecherche: string = '';

  documentsRequis: Document[] = [
    {
      id: 1,
      nom: 'Formulaire de candidature au Mastère en Informatique (joint à cet avis)',
      icon: 'fa-file-signature',
      depose: false,
      obligatoire: true,
    },
    {
      id: 2,
      nom: 'Fiche de candidature imprimée depuis le site web et dûment signée',
      icon: 'fa-clipboard-check',
      depose: false,
      obligatoire: true,
    },
    {
      id: 3,
      nom: "Curriculum Vitae (CV) d'une page avec adresse postale, téléphone et e-mail",
      icon: 'fa-user-tie',
      depose: false,
      obligatoire: true,
    },
    {
      id: 4,
      nom: 'Copie certifiée conforme de tous les diplômes obtenus, y compris le Baccalauréat',
      icon: 'fa-graduation-cap',
      depose: false,
      obligatoire: true,
    },
    {
      id: 5,
      nom: 'Copie certifiée conforme des relevés de notes de toutes les années et du Baccalauréat',
      icon: 'fa-file-alt',
      depose: false,
      obligatoire: true,
    },
    {
      id: 6,
      nom: "Document justifiant un report d'inscription ou une réorientation (si applicable)",
      icon: 'fa-file-medical',
      depose: false,
      obligatoire: false,
    },
  ];

  reclamations: Reclamation[] = [
    {
      id: 1,
      identifiant: 'RECL-2026-00001',
      objet: 'score',
      master_nom: 'Master Génie Logiciel',
      master_id: 1,
      motif: 'Mon score affiché ne correspond pas à mes notes',
      date: '2026-03-15T10:30:00',
      statut: 'en_cours',
      reponse: null,
    },
  ];

  profileData: any = {
    first_name: '',
    last_name: '',
    email: '',
    avatar_url: '',
    phone: '',
    address: '',
    diplome_last: '',
    etablissement: '',
    annee_bac: '',
    moyenne_generale: '',
    two_factor_enabled: false,
  };

  twoFactorEnabled: boolean = false;
  avatarFile: File | null = null;
  avatarPreview: string | null = null;

  passwordForm: any = {
    current_password: '',
    new_password: '',
    confirm_password: '',
  };

  fichierInscription: File | null = null;
  selectedDocumentFiles: Record<number, File | null> = {};
  fichiersHistorique: FichierHistorique[] = [
    { id: 1, nom: 'fiche_inscription_2026.pdf', date: '15/02/2026' },
    { id: 2, nom: 'releve_notes.pdf', date: '16/02/2026' },
  ];

  historique: HistoriqueItem[] = [
    {
      id: 1,
      titre: 'Candidature acceptée',
      description: 'Votre candidature pour Master GL a été acceptée',
      date: '20/02/2026',
      color: '#10b981',
      annee_universitaire: '2025-2026',
      numero: '2603-00001-GL',
      master_nom: 'Master Génie Logiciel',
      score: 16.5,
      classement: '3',
      statut_final: 'selectionne',
      date_soumission: '2026-02-15',
    },
    {
      id: 2,
      titre: 'Dossier déposé',
      description: 'Vous avez déposé votre dossier complet',
      date: '18/02/2026',
      color: '#3b82f6',
      annee_universitaire: '2025-2026',
      numero: '2603-00002-DS',
      master_nom: 'Master Data Science',
      score: 15.2,
      classement: '12',
      statut_final: 'en_attente',
      date_soumission: '2026-02-15',
    },
    {
      id: 3,
      titre: 'Candidature soumise',
      description: 'Candidature Master GL soumise avec succès',
      date: '15/02/2026',
      color: '#8b5cf6',
      annee_universitaire: '2024-2025',
      numero: '2502-00123-GL',
      master_nom: 'Master Génie Logiciel',
      score: 14.8,
      classement: '25',
      statut_final: 'rejete',
      date_soumission: '2025-02-10',
    },
  ];

  // Historique UI helpers
  historiqueFilterYear: string = '';
  historiqueFilterResult: '' | 'success' | 'waiting' | 'rejected' | '' = '';
  selectedAcademicYear: string = '';

  get filteredHistorique(): HistoriqueItem[] {
    return (this.historique || []).filter((item) => {
      if (
        this.historiqueFilterYear &&
        String(item.annee_universitaire || '') !== this.historiqueFilterYear
      ) {
        return false;
      }
      if (this.historiqueFilterResult) {
        const normalized = (item.statut_final || '').toLowerCase();
        if (
          this.historiqueFilterResult === 'success' &&
          !['selectionne', 'inscrit', 'valide'].includes(normalized)
        )
          return false;
        if (
          this.historiqueFilterResult === 'waiting' &&
          ['en_attente', 'sous_examen', 'soumis', 'preselectionne'].indexOf(normalized) === -1
        )
          return false;
        if (
          this.historiqueFilterResult === 'rejected' &&
          ['rejete', 'non_admis', 'non_preselectionne'].indexOf(normalized) === -1
        )
          return false;
      }
      return true;
    });
  }

  get candidaturesYears(): string[] {
    const years = (this.mesCandidatures || [])
      .map((c) => String(c.annee_universitaire || '').trim())
      .filter((year) => year.length > 0);

    return Array.from(new Set(years)).sort((left, right) => right.localeCompare(left));
  }

  private matchesSelectedAcademicYear(candidature: Candidature): boolean {
    if (!this.selectedAcademicYear) {
      return true;
    }

    return String(candidature.annee_universitaire || '').trim() === this.selectedAcademicYear;
  }

  get historiqueTotalCount(): number {
    return (this.historique || []).length;
  }

  get historiqueYears(): string[] {
    return Array.from(
      new Set(
        (this.historique || [])
          .map((item) => String(item.annee_universitaire || '').trim())
          .filter((annee) => annee.length > 0),
      ),
    ).sort((left, right) => right.localeCompare(left));
  }

  get historiqueBestScore(): number | null {
    const scores = (this.historique || [])
      .map((h) => Number(h.score || 0))
      .filter((s) => !Number.isNaN(s));
    if (!scores.length) return null;
    return Math.max(...scores);
  }

  get historiqueAdmissionsCount(): number {
    return (this.historique || []).filter((h) =>
      ['selectionne', 'inscrit', 'valide'].includes(
        ((h.statut_final || '') as string).toLowerCase(),
      ),
    ).length;
  }

  downloadHistoriquePdf(item: HistoriqueItem): void {
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const title = `Dossier - ${item.numero || ''}`;
      doc.setFontSize(14);
      doc.text(title, 40, 60);
      const rows = [
        ['Année', item.annee_universitaire || '-'],
        ['N° Candidature', item.numero || '-'],
        ['Master', item.master_nom || '-'],
        ['Score', String(item.score ?? '-')],
        ['Classement', String(item.classement ?? '-')],
        ['Résultat', this.getStatutLabel(item.statut_final || '')],
      ];
      // simple table
      // @ts-ignore
      autoTable(doc, {
        startY: 90,
        head: [['Champ', 'Valeur']],
        body: rows,
        styles: { fontSize: 11 },
      });
      doc.save(`${item.numero || 'historique'}.pdf`);
    } catch (e) {
      console.error('Erreur génération PDF historique:', e);
      this.toastService.show('Impossible de générer le PDF.', 'error');
    }
  }

  showModalReclamation: boolean = false;
  nouvelleReclamation: any = {
    master_id: '',
    objet: '',
    motif: '',
  };

  actionPermissions: CandidatActionPermissions = {
    preinscription: true,
    consultationCandidature: true,
    consultationDossier: true,
    depotDossier: true,
    suiviCandidature: true,
    deposerReclamation: true,
  };
  customRoleActions: string[] = [];
  readonly quickActionCards: QuickActionCard[] = [
    {
      key: 'modifier',
      title: 'Modifier Candidature',
      description: 'Mettre à jour vos informations et continuer le stepper de soumission.',
      icon: 'edit',
    },
    {
      key: 'notifications',
      title: 'Mes Notifications',
      description: 'Consulter vos alertes et messages non lus en un clic.',
      icon: 'notifications',
    },
  ];
  private readonly customActionViewMap: Record<string, CandidatView> = {
    [normalizeActionLabel('Préinscription')]: 'offres-inscription',
    [normalizeActionLabel('Consultation de candidature')]: 'candidatures',
    [normalizeActionLabel('Dépôt de dossier')]: 'mon-dossier',
    [normalizeActionLabel('Consultation de dossier')]: 'mon-dossier',
    [normalizeActionLabel('Suivi de candidature')]: 'suivi',
    [normalizeActionLabel('Déposer réclamation')]: 'reclamations',
    [normalizeActionLabel('Historique des candidatures')]: 'historique',
    [normalizeActionLabel('Inscription en ligne')]: 'inscription',
    [normalizeActionLabel('Mon profil')]: 'profil',
  };
  private readonly knownActionNameSet = new Set<string>([
    normalizeActionLabel('Préinscription'),
    normalizeActionLabel('Consultation de candidature'),
    normalizeActionLabel('Consultation de dossier'),
    normalizeActionLabel('Dépôt de dossier'),
    normalizeActionLabel('Suivi de candidature'),
    normalizeActionLabel('Déposer réclamation'),
  ]);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
    private toastService: ToastService,
    private candidatureService: CandidatureService,
    private dialog: MatDialog,
    private sanitizer: DomSanitizer,
    private webSocketService: WebSocketService,
    private scoreService: ScoreService,
  ) {}

  // ── Score live (Sprint 4) ───────────────────────────────────────────
  scoreLiveDetail: ScoreDetailItem[] = [];
  scoreLiveTotal: number | null = null;

  private buildFormDataCandidat(): FormDataCandidat {
    const sessionToInt = (val: string | undefined, controle: boolean): boolean => {
      if (controle) return true;
      return val === 'control';
    };
    const sessions = [
      this.wizardData?.session1Annee,
      this.wizardData?.session2Annee,
      this.wizardData?.session3Annee,
    ];
    const nbSessionsControle = sessions.filter((s) => s === 'control').length;

    return {
      moyenne_l1: parseFloat(String(this.wizardData?.moyenne1Annee || 0)) || 0,
      moyenne_l2: parseFloat(String(this.wizardData?.moyenne2Annee || 0)) || 0,
      moyenne_l3: parseFloat(String(this.wizardData?.moyenne3Annee || 0)) || 0,
      moyenne_bac: parseFloat(String(this.wizardData?.moyenneBacPrincipale || 0)) || 0,
      note_maths_bac: parseFloat(String(this.wizardData?.noteMathBac || 0)) || 0,
      note_francais_bac: parseFloat(String(this.wizardData?.noteFrancaisBac || 0)) || 0,
      note_anglais_bac: parseFloat(String(this.wizardData?.noteAnglaisBac || 0)) || 0,
      nb_redoublements: parseInt(String(this.wizardData?.nombreRedoublement || 0), 10) || 0,
      nb_sessions_controle: nbSessionsControle,
      annee_diplome: parseInt(String(this.wizardData?.anneeObtentionDiplome || 0), 10) || 0,
      session_l1_controle: sessionToInt(this.wizardData?.session1Annee, false),
      session_l2_controle: sessionToInt(this.wizardData?.session2Annee, false),
      session_l3_controle: sessionToInt(this.wizardData?.session3Annee, false),
      certif_b2: this.wizardData?.certificationB2 === 'oui',
    };
  }

  private getCurrentOffreCriteres(): ScoreCriterion[] {
    const code = String(this.wizardOffre?.code || '').toUpperCase();
    const parcours = code ? resolveParcoursByCode(code) : undefined;
    return parcours?.defaultScoreConfig.criteres ?? [];
  }

  private getCurrentOffreFormuleScore(): string {
    const code = String(this.wizardOffre?.code || '').toUpperCase();
    const parcours = code ? resolveParcoursByCode(code) : undefined;
    return parcours?.defaultScoreConfig.formule ?? '';
  }

  recalculerScoreLive(): void {
    const criteres = this.getCurrentOffreCriteres();
    const formule = this.getCurrentOffreFormuleScore();
    if (!criteres.length || !formule) {
      this.scoreLiveDetail = [];
      this.scoreLiveTotal = null;
      return;
    }
    const formData = this.buildFormDataCandidat();

    // ★ Garde : ne calculer le score QUE si au moins une moyenne est saisie.
    // Évite d'afficher un score négatif par défaut pour MRGL/MRMI à cause des
    // termes (M.Bac + N.Math − 20)/2 ou des malus.
    const aucuneSaisie =
      formData.moyenne_l1 <= 0 &&
      formData.moyenne_l2 <= 0 &&
      formData.moyenne_l3 <= 0 &&
      formData.moyenne_bac <= 0 &&
      formData.note_maths_bac <= 0;
    if (aucuneSaisie) {
      this.scoreLiveDetail = [];
      this.scoreLiveTotal = null;
      return;
    }

    const result = this.scoreService.calculerScoreTotal(criteres, formule, formData);
    this.scoreLiveDetail = result.detail;
    this.scoreLiveTotal = result.total;
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.profileData = { ...this.currentUser };
    this.avatarPreview = this.currentUser?.avatar_url || null;
    this.twoFactorEnabled = !!this.currentUser?.two_factor_enabled;
    this.profileData.two_factor_enabled = this.twoFactorEnabled;
    this.initializeDossierPreferenceForm();

    // Restauration immédiate depuis localStorage pour éviter le clignotement au refresh
    if (this.authService.hasCandidatureValue) {
      this.actionPermissions.consultationCandidature = true;
      this.actionPermissions.suiviCandidature = true;
    }

    const requestedView = this.route.snapshot.queryParamMap.get('view') as CandidatView | null;
    const workflowMockMode = this.route.snapshot.queryParamMap.get('workflowMock') === '1';
    const requestedWizardStep = Number(this.route.snapshot.queryParamMap.get('wizardStep') || '0');
    if (requestedView && this.canAccessView(requestedView)) {
      this.currentView = requestedView;
    }
    if (requestedWizardStep >= 1) {
      this.openWizardFromUrl(requestedWizardStep);
    }

    this.queryParamsSub = this.route.queryParamMap.subscribe((params) => {
      const isMock = params.get('workflowMock') === '1';
      const isPreferenceFormDemo = params.get('preferenceFormDemo') === '1';
      const viewParam = params.get('view') as CandidatView | null;
      const wizardStepParam = Number(params.get('wizardStep') || '0');

      this.isPreferenceFormDemoMode = isPreferenceFormDemo;
      if (this.isPreferenceFormDemoMode) {
        this.prefillPreferenceFormDemoValues();
      }

      if (isMock) {
        this.isWorkflowMockMode = true;
        this.mesCandidatures = this.buildWorkflowMockCandidatures();
        this.currentView = 'suivi';
        return;
      }

      if (this.isWorkflowMockMode) {
        this.isWorkflowMockMode = false;
        this.loadMesCandidatures();
        this.loadMesDossiers();
        this.loadNotifications();
      }

      if (viewParam && this.canAccessView(viewParam)) {
        this.currentView = viewParam;
      }

      if (wizardStepParam >= 1) {
        this.openWizardFromUrl(wizardStepParam);
      }
    });

    if (workflowMockMode) {
      this.isWorkflowMockMode = true;
      this.mesCandidatures = this.buildWorkflowMockCandidatures();
      this.currentView = 'suivi';
      this.loadActionPermissions();
      this.startCountdownClock();
      return;
    }

    this.loadActionPermissions();
    this.loadMesCandidatures();
    this.loadOffresInscription();
    this.loadMesDossiers();
    this.loadNotifications();
    if (this.currentView === 'historique') {
      this.chargerHistorique();
    }
    this.startCountdownClock();
    // Start WebSocket via centralized service (handles reconnection/backoff/heartbeat)
    const wsUrl = this.buildWebSocketUrl();
    this.webSocketService.connect(wsUrl).subscribe({
      next: () => {},
      error: (err) => console.warn('WebSocket service connection error:', err),
    });

    // Subscribe to incoming candidature status messages
    this.webSocketService.getMessagesByType('candidature_status_changed').subscribe((msg) => {
      const userId = this.currentUser?.id;
      if (!userId || msg['candidate_user_id'] !== userId) {
        return;
      }
      this.loadMesCandidatures();
      this.loadMesDossiers();
      this.loadNotifications();
    });

    // Subscribe to connection status for UI indicator
    this.socketStatusSub = this.webSocketService.connectionStatus$.subscribe((status) => {
      this.socketConnectionStatus = status;
    });
  }

  ngOnDestroy(): void {
    if (this.queryParamsSub) {
      this.queryParamsSub.unsubscribe();
      this.queryParamsSub = null;
    }
    this.stopCountdownClock();
    this.disconnectStatusWebSocket();
    if (this.socketStatusSub) {
      this.socketStatusSub.unsubscribe();
      this.socketStatusSub = null;
    }
    // Cleanup wizard score calculation timer
    if (this.wizardScoreCalculationTimer) {
      clearTimeout(this.wizardScoreCalculationTimer);
      this.wizardScoreCalculationTimer = null;
    }
  }

  private startCountdownClock(): void {
    this.stopCountdownClock();
    this.countdownTimerId = setInterval(() => {
      this.countdownNow = Date.now();
    }, 1000);
  }

  get countdown(): DeadlineCountdown {
    const now = this.countdownNow || Date.now();
    const target = this.deadlineDate.getTime();
    let diff = Math.max(0, target - now);

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    diff -= days * 24 * 60 * 60 * 1000;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    diff -= hours * 60 * 60 * 1000;
    const minutes = Math.floor(diff / (1000 * 60));
    diff -= minutes * 60 * 1000;
    const seconds = Math.floor(diff / 1000);

    return {
      days,
      hours,
      minutes,
      seconds,
      expired: target <= now,
    };
  }

  formatNumber(n: number): string {
    const v = Math.max(0, Math.floor(n || 0));
    return v < 10 ? `0${v}` : String(v);
  }

  getUpcomingDeadlines(): Array<{ label: string; date: Date; daysLeft: number; color: string }> {
    const now = Date.now();
    const COLORS = ['#e24b4a', '#ba7517', '#1d9e75', '#3b82f6', '#8b5cf6'];
    const results: Array<{ label: string; date: Date; daysLeft: number; color: string }> = [];

    (this.mesCandidatures || []).forEach((c) => {
      if (c.date_limite_modification) {
        const d = new Date(c.date_limite_modification);
        const daysLeft = Math.max(0, Math.floor((d.getTime() - now) / 86400000));
        if (d.getTime() > now) {
          results.push({ label: 'Dépôt dossier — ' + c.master_nom, date: d, daysLeft, color: COLORS[0] });
        }
      }
    });

    return results.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 4);
  }

  private stopCountdownClock(): void {
    if (this.countdownTimerId) {
      clearInterval(this.countdownTimerId);
      this.countdownTimerId = null;
    }
  }

  private buildWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/candidatures/`;
  }

  private connectStatusWebSocket(): void {
    this.disconnectStatusWebSocket();

    try {
      this.ws = new WebSocket(this.buildWebSocketUrl());
    } catch (error) {
      console.warn('WebSocket indisponible:', error);
      this.scheduleWebSocketReconnect();
      return;
    }

    this.ws.onopen = () => {
      if (this.reconnectTimerId) {
        clearTimeout(this.reconnectTimerId);
        this.reconnectTimerId = null;
      }
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type !== 'candidature_status_changed') {
          return;
        }

        const userId = this.currentUser?.id;
        if (!userId || payload['candidate_user_id'] !== userId) {
          return;
        }

        this.loadMesCandidatures();
        this.loadMesDossiers();
        this.loadNotifications();
      } catch (error) {
        console.warn('Message WebSocket invalide:', error);
      }
    };

    this.ws.onclose = () => {
      this.scheduleWebSocketReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleWebSocketReconnect(): void {
    if (this.reconnectTimerId) {
      return;
    }

    this.wsReconnectAttempts++;
    if (this.wsReconnectAttempts >= this.wsReconnectMaxAttempts) {
      console.warn(
        `WebSocket reconnection attempts (${this.wsReconnectAttempts}) exceeded max (${this.wsReconnectMaxAttempts}). Disabling WebSocket. App will use HTTP polling.`,
      );
      return;
    }

    this.reconnectTimerId = setTimeout(() => {
      this.reconnectTimerId = null;
      this.connectStatusWebSocket();
    }, this.wsReconnectDelayMs);
  }

  private disconnectStatusWebSocket(): void {
    if (this.reconnectTimerId) {
      clearTimeout(this.reconnectTimerId);
      this.reconnectTimerId = null;
    }

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
  }

  ouvrirFormulaireReclamation(): void {
    // MOD v5 §C — Ouvre la réclamation dans un dialog inline (même page) au lieu
    // de rediriger vers /candidat/reclamations/nouvelle.
    this.ouvrirModalReclamation();
  }

  switchView(view: CandidatView, options?: { preserveDossierSelection?: boolean }): void {
    if (!this.canAccessView(view)) {
      this.notifyActionBlocked("Cette section n'est pas active pour votre rôle.");
      return;
    }
    this.closeActionMenu();
    if (view === 'mon-dossier' && !options?.preserveDossierSelection) {
      this.resetSelectionDossier();
    }
    this.currentView = view;
    if (view === 'historique') {
      this.chargerHistorique();
    }
    if (window.innerWidth <= 768) {
      this.closeSidebar();
    }
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
  }

  validateMenuSection(view: CandidatView, event: Event): void {
    event.stopPropagation();

    if (!this.canAccessView(view)) {
      this.notifyActionBlocked("Cette section n'est pas active pour votre rôle.");
      return;
    }

    switch (view) {
      case 'profil':
        this.switchView('profil');
        this.updateProfile();
        break;

      case 'offres-inscription':
        this.switchView('offres-inscription');
        this.toastService.show(
          'Validation preinscription: cliquez sur Postuler puis Soumettre candidature.',
          'info',
        );
        break;

      case 'mon-dossier':
        this.switchView('mon-dossier');
        if (!this.selectedDossierNumber) {
          this.toastService.show(
            'Selectionnez un dossier puis validez via la section Importer un fichier.',
            'warning',
          );
          return;
        }

        this.switchView('importer');
        if (this.shouldShowPreferenceForm()) {
          this.submitDossierPreferenceForm();
        } else if (this.selectedDocumentsCount > 0) {
          this.uploadAllSelectedDocuments();
        } else {
          this.toastService.show(
            'Aucun document selectionne. Ajoutez un document avant validation.',
            'warning',
          );
        }
        break;

      case 'inscription':
        this.switchView('inscription');
        this.toastService.show(
          'Validation inscription: deposez le justificatif de paiement pour chaque candidature.',
          'info',
        );
        break;

      default:
        this.switchView(view);
        this.toastService.show('Validation non requise dans cette section.', 'info');
        break;
    }
  }

  openCustomRoleAction(actionName: string): void {
    const normalized = normalizeActionLabel(actionName);
    const target = this.customActionViewMap[normalized];

    if (!target) {
      this.notifyActionBlocked(`Action non mappée: ${actionName}`);
      return;
    }

    this.switchView(target);
  }

  private loadActionPermissions(): void {
    this.authService.getMyEnabledActions().subscribe({
      next: (actions: string[]) => {
        this.customRoleActions = this.extractCustomRoleActions(actions || []);

        if (!actions || actions.length === 0) {
          console.warn('Aucune action distante chargee, conservation des permissions locales.');
          return;
        }

        const hasCandidature = this.authService.hasCandidatureValue;
        this.actionPermissions = {
          preinscription: this.authService.hasMyAction('Préinscription'),
          // Si le candidat a déjà une candidature, toujours afficher le menu même si
          // l'action n'est pas explicitement dans la matrice backend
          consultationCandidature:
            hasCandidature || this.authService.hasMyAction('Consultation de candidature'),
          consultationDossier: this.authService.hasMyAction('Consultation de dossier'),
          depotDossier: this.authService.hasMyAction('Dépôt de dossier'),
          suiviCandidature:
            hasCandidature || this.authService.hasMyAction('Suivi de candidature'),
          deposerReclamation: this.authService.hasMyAction('Déposer réclamation'),
        };

        if (!this.canAccessView(this.currentView)) {
          this.currentView = 'dashboard';
        }
      },
      error: () => {
        this.customRoleActions = [];
        console.warn('Permissions indisponibles, maintien du mode permissif local.');
      },
    });
  }

  private extractCustomRoleActions(actions: string[]): string[] {
    const unique = new Set<string>();
    const custom: string[] = [];

    (actions || []).forEach((name) => {
      const cleaned = (name || '').trim();
      if (!cleaned) {
        return;
      }

      const normalized = normalizeActionLabel(cleaned);
      if (this.knownActionNameSet.has(normalized) || unique.has(normalized)) {
        return;
      }

      unique.add(normalized);
      custom.push(cleaned);
    });

    return custom;
  }

  canAccessView(view: CandidatView): boolean {
    if (view === 'dashboard' || view === 'profil') {
      return true;
    }

    if (view === 'notifications') {
      return true;
    }

    if (view === 'offres-inscription') {
      return this.actionPermissions.preinscription;
    }

    if (view === 'candidatures' || view === 'inscription') {
      return this.actionPermissions.consultationCandidature;
    }

    if (view === 'mon-dossier' || view === 'importer') {
      return this.actionPermissions.consultationDossier || this.actionPermissions.depotDossier;
    }

    if (view === 'suivi' || view === 'historique') {
      return this.actionPermissions.suiviCandidature;
    }

    if (view === 'reclamations') {
      return this.actionPermissions.deposerReclamation;
    }

    return true;
  }

  // Exposed for the inline onclick handlers in the stat-grid
  public sendPrompt(text: string): void {
    try {
      this.toastService.show(text, 'info');
      console.log('sendPrompt:', text);
    } catch (e) {
      console.log('sendPrompt fallback:', text);
    }
  }

  private notifyActionBlocked(message: string): void {
    this.toastService.show(message, 'warning');
  }

  private showAlertMessage(message: string): void {
    const normalized = String(message ?? '').trim();
    const cleanMessage = normalized.replace(/[✅❌⚠️ℹ️]/g, '').trim();
    let type: 'success' | 'info' | 'warning' | 'error' = 'info';

    if (normalized.includes('✅')) {
      type = 'success';
    } else if (normalized.includes('❌')) {
      type = 'error';
    } else if (/erreur|impossible|introuvable|expir/i.test(normalized)) {
      type = 'error';
    } else if (
      /obligatoire|veuillez|aucun|aucune|invalide|fermee|fermé|attention/i.test(normalized)
    ) {
      type = 'warning';
    } else if (
      /succes|succès|enregistr|soumis|publie|publié|modifie|modifié|supprim/i.test(normalized)
    ) {
      type = 'success';
    }

    this.toastService.show(cleanMessage || 'Notification', type);
  }

  getViewTitle(): string {
    const titles: any = {
      dashboard: 'Tableau de bord',
      profil: 'Mon Profil',
      'offres-inscription': 'Préinscription',
      candidatures: 'Candidatures',
      'mon-dossier': 'Dossiers de candidature',
      reclamations: 'Réclamation',
      notifications: 'Notifications',
      importer: 'Importer un fichier',
      inscription: 'Inscription en ligne',
      suivi: 'Suivi de candidature',
      historique: 'Historique des candidatures',
    };
    return titles[this.currentView] || 'Tableau de bord';
  }

  closeAlert(): void {
    this.showAlert = false;
  }

  get dashboardSummaryCards(): SummaryCard[] {
    const total = Math.max(this.mesCandidatures.length, 1);
    return [
      {
        title: 'Candidatures déposées',
        value: this.mesCandidatures.length,
        subtitle: 'Total de vos candidatures soumises',
        icon: 'fa-file-alt',
        tone: 'indigo',
        progress: 100,
      },
      {
        title: 'Sous examen',
        value: this.countByStatut('sous_examen'),
        subtitle: "Dossiers en cours d'évaluation",
        icon: 'fa-hourglass-half',
        tone: 'blue',
        progress: Math.min(100, Math.round((this.countByStatut('sous_examen') / total) * 100)),
      },
      {
        title: 'Présélectionnées',
        value: this.countByStatut('preselectionne') + this.countByStatut('selectionne'),
        subtitle: 'Candidatures à statut favorable',
        icon: 'fa-check-circle',
        tone: 'green',
        progress: Math.min(
          100,
          Math.round(
            ((this.countByStatut('preselectionne') + this.countByStatut('selectionne')) / total) *
              100,
          ),
        ),
      },
      {
        title: 'Rejetées',
        value: this.countByStatut('rejete'),
        subtitle: 'Candidatures non retenues',
        icon: 'fa-times-circle',
        tone: 'orange',
        progress: Math.min(100, Math.round((this.countByStatut('rejete') / total) * 100)),
      },
    ];
  }

  get deadlineCountdown(): DeadlineCountdown {
    const diff = this.deadlineDate.getTime() - this.countdownNow;
    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return { days, hours, minutes, seconds, expired: false };
  }

  get dashboardTimeline(): DashboardTimelineItem[] {
    return [...this.mesCandidatures]
      .sort(
        (a, b) =>
          new Date(b.date_soumission || '').getTime() - new Date(a.date_soumission || '').getTime(),
      )
      .slice(0, 4)
      .map((candidature) => ({
        title: candidature.master_nom || 'Candidature',
        subtitle: candidature.date_soumission
          ? `Soumise le ${new Date(candidature.date_soumission).toLocaleDateString('fr-FR')}`
          : 'Soumise récemment',
        statusLabel: this.getStatutLabel(candidature.statut),
        tone: this.getTimelineTone(candidature.statut),
        icon: this.getStatutFaIcon(candidature.statut),
      }));
  }

  private getTimelineTone(statut?: string): 'success' | 'warning' | 'info' {
    const value = (statut || '').toLowerCase();
    if (['selectionne', 'inscrit', 'valide', 'traitee'].includes(value)) {
      return 'success';
    }
    if (['rejete', 'non_admis', 'non_preselectionne'].includes(value)) {
      return 'warning';
    }
    return 'info';
  }

  openQuickAction(actionKey: QuickActionCard['key']): void {
    if (actionKey === 'notifications') {
      this.switchView('notifications');
      return;
    }

    const offer =
      this.getOffresFiltrees().find((item) => item.statut === 'ouvert') ||
      this.offresInscription[0];
    if (!offer) {
      this.toastService.show('Aucune offre disponible pour ouvrir le stepper.', 'warning');
      return;
    }

    this.startSubmissionWizard(offer);
  }

  countByStatut(statut: string): number {
    return this.mesCandidatures.filter((c) => c.statut === statut).length;
  }

  getStatusChipClass(statut?: string): string {
    const value = (statut || 'en_attente').toLowerCase();

    if (['selectionne', 'inscrit', 'valide', 'traitee'].includes(value)) {
      return 'status-chip--success';
    }

    if (['rejete', 'non_admis', 'non_preselectionne', 'dossier_non_depose'].includes(value)) {
      return 'status-chip--danger';
    }

    if (
      ['sous_examen', 'soumis', 'preselectionne', 'dossier_depose', 'paiement_soumis'].includes(
        value,
      )
    ) {
      return 'status-chip--info';
    }

    return 'status-chip--warning';
  }

  get documentsDeposes(): number {
    return this.documentsRequis.filter((d) => d.depose).length;
  }

  getStatutLabel(statut?: string): string {
    const labels: any = {
      selectionne: 'Sélectionné',
      en_attente: 'En attente',
      soumis: 'Soumis',
      rejete: 'Rejeté',
      preselectionne: 'Présélectionné',
      sous_examen: 'Sous examen',
      dossier_depose: 'Dossier déposé',
      inscrit: 'Inscrit',
      paiement_soumis: 'Paiement soumis',
      valide: 'Validé',
      traitee: 'Traitée',
    };
    if (!statut) {
      return '-';
    }
    return labels[statut] || statut;
  }

  getStatutIcon(statut?: string): string {
    const icons: Record<string, string> = {
      selectionne: 'check_circle',
      en_attente: 'schedule',
      soumis: 'send',
      rejete: 'cancel',
      preselectionne: 'verified',
      sous_examen: 'manage_search',
      dossier_depose: 'folder_open',
      inscrit: 'person_check',
      paiement_soumis: 'payments',
      valide: 'task_alt',
      traitee: 'done_all',
      confirme: 'done',
      propose: 'thumb_up',
    };

    return icons[statut || ''] || 'info';
  }

  getStatutFaIcon(statut?: string): string {
    const icons: Record<string, string> = {
      selectionne: 'fa-circle-check',
      en_attente: 'fa-clock',
      soumis: 'fa-paper-plane',
      rejete: 'fa-circle-xmark',
      preselectionne: 'fa-badge-check',
      sous_examen: 'fa-magnifying-glass',
      dossier_depose: 'fa-folder-open',
      inscrit: 'fa-user-check',
      paiement_soumis: 'fa-money-check-dollar',
      valide: 'fa-square-check',
      traitee: 'fa-check-double',
      confirme: 'fa-check',
      propose: 'fa-thumbs-up',
    };

    return icons[statut || ''] || 'fa-circle-info';
  }

  getOffresFiltrees(): Offre[] {
    const q = this.rechercheOffre.toLowerCase().trim();
    const dateFilter = (this.rechercheDateOffre || '').trim();

    return this.offresInscription.filter((o) => {
      const matchesText =
        !q ||
        o.titre.toLowerCase().includes(q) ||
        (o.description && o.description.toLowerCase().includes(q)) ||
        (o.specialite && o.specialite.toLowerCase().includes(q));

      const matchesDate = !dateFilter || String(o.date_limite || '') === dateFilter;

      return matchesText && matchesDate;
    });
  }

  reinitialiserRechercheOffres(): void {
    this.rechercheOffre = '';
    this.rechercheDateOffre = '';
  }

  private getOffresFiltreesParType(type: Offre['type'], sousType?: string): Offre[] {
    return this.getOffresFiltrees().filter(
      (o) => o.type === type && (!sousType || o.sous_type === sousType),
    );
  }

  voirRecapitulatif(candidature: Candidature): void {
    this.closeActionMenu();
    this.openHistoriqueMenuId = null;
    this.selectedCandidatureForEdit = candidature;
    this.showRecapModal = true;
  }

  fermerRecapModal(): void {
    this.showRecapModal = false;
    this.selectedCandidatureForEdit = null;
  }

  toggleHistoriqueMenu(id: number): void {
    this.openHistoriqueMenuId = this.openHistoriqueMenuId === id ? null : id;
  }

  suivreCandidature(candidature: Candidature): void {
    this.closeActionMenu();
    this.selectedDossierNumber = this.getDossierNumber(candidature);
    this.switchView('suivi');
    this.toastService.show(`Ouverture du suivi pour la candidature ${candidature.numero}`, 'info');
  }

  loadMesCandidatures(): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    this.http
      .get<Candidature[]>(`${this.candidatureApiBase}/mes-candidatures/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (data) => {
          this.mesCandidatures = (data || []).map((item) => ({
            ...item,
            master_id: item.master_id ?? item.master,
            etat_candidature: item.etat_candidature ?? this.getStatutLabel(item.statut),
            date_depot_dossier: item.date_depot_dossier ?? '',
            annee_universitaire: item.annee_universitaire ?? this.currentAcademicYear(),
            jours_restants: item.jours_restants ?? 0,
            peut_modifier: item.peut_modifier ?? false,
            statut_inscription: item.statut_inscription ?? '',
            numero_inscription_universitaire:
              item.numero_inscription_universitaire ?? item.numero_inscription ?? '',
            attestation_paiement_url: item.attestation_paiement_url ?? '',
            motif_rejet: item.motif_rejet ?? '',
            historique_statut: Array.isArray(item.historique_statut)
              ? item.historique_statut
              : Array.isArray(item.historiqueStatut)
                ? item.historiqueStatut
                : [],
          }));

          // Persiste l'existence de candidatures dans localStorage pour le refresh
          const hasCandidature = this.mesCandidatures.length > 0;
          this.authService.setHasCandidature(hasCandidature);
          if (hasCandidature) {
            this.actionPermissions.consultationCandidature = true;
            this.actionPermissions.suiviCandidature = true;
          }

          this.isDashboardLoading = false;
          this.loadNotifications();
          // Point 4: Load live metrics after loading candidatures
          this.loadCandidateLiveMetrics();
        },
        error: (error) => {
          console.error('Erreur chargement candidatures:', error);
          this.isDashboardLoading = false;
        },
      });
  }

  loadCandidateLiveMetrics(): void {
    /**
     * Point 4: Fetch real-time score, classement, and total candidats for each candidature.
     * Called periodically and on WebSocket updates.
     */
    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    this.candidatureService.getCandidateLiveMetrics().subscribe({
      next: (response: any) => {
        if (response?.data && Array.isArray(response.data)) {
          // Update each candidature with live metrics
          response.data.forEach((metric: any) => {
            const candidature = this.mesCandidatures.find((c) => c.id === metric.id);
            if (candidature) {
              candidature.score = metric.score;
              candidature.classement = metric.classement;
              candidature.total_candidats = metric.total_candidats;
              candidature.date_mise_a_jour = metric.date_mise_a_jour;
            }
          });
        }
      },
      error: (error: any) => {
        console.warn('Erreur chargement métriques en direct:', error);
        // Silent fail; metrics are optional
      },
    });
  }

  loadOffresInscription(): void {
    const token = this.authService.getAccessToken();

    // Allow loading public offers even when user is not authenticated.
    const httpOptions = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

    this.http
      .get<Offre[]>(`${this.candidatureApiBase}/offres-inscription/`, httpOptions)
      .subscribe({
        next: (data) => {
          const mappedOffres = (data || [])
            .filter((offre: any) => isPublicOffer(offre) && offre.statut === 'ouvert')
            .map((offre: any) => ({
              id: Number(offre.id),
              titre: offre.titre,
              type: offre.type,
              sous_type: offre.sous_type,
              code: offre.code_parcours || offre.specialite || offre.code || '',
              specialite: offre.specialite,
              description: offre.description,
              date_limite: offre.date_limite,
              places: offre.places,
              statut: offre.statut,
              document_officiel_pdf_url: offre.document_officiel_pdf_url || null,
              est_cache: !!offre.est_cache,
              est_visible: offre.est_visible,
              publie_par_responsable: offre.publie_par_responsable,
              nombre_candidats_inscrits: Number(offre.nombre_candidats_inscrits || 0),
            }));
          // debugger: log raw response when no offers found to help identify backend mismatch
          if (!Array.isArray(data) || (Array.isArray(mappedOffres) && mappedOffres.length === 0)) {
            console.warn("Aucune offre publique/ouverte retournée par l'API offres-inscription.", {
              raw: data,
            });
          }

          this.isOffresInscriptionFallback = false;
          // Only use API data when it covers all 6 canonical ISIMM parcours.
          // If fewer than 6 are returned (incomplete DB) show the canonical fallback.
          if (Array.isArray(mappedOffres) && mappedOffres.length >= 6) {
            this.offresInscription = mappedOffres;
          } else {
            this.offresInscription = this.getFallbackOffresInscription();
            this.isOffresInscriptionFallback = true;
          }
          this.loadNotifications();
        },
        error: (error) => {
          console.error('Erreur chargement offres:', error);
          // Use fallback offers when API unreachable
          this.isOffresInscriptionFallback = true;
          this.offresInscription = this.getFallbackOffresInscription();
          this.toastService.show(
            "Impossible de charger les offres de préinscription pour le moment. Affichage d'offres de secours.",
            'warning',
          );
        },
      });
  }

  private getFallbackOffresInscription(): Offre[] {
    return [
      { id: 1, titre: 'Mastere Professionnel Genie Logiciel (MPGL)', type: 'master', sous_type: 'professionnel', code: 'MPGL', description: '', date_limite: '2026-07-22', places: 35, statut: 'ouvert' },
      { id: 2, titre: 'Mastere Professionnel en sciences de donnees (MPDS)', type: 'master', sous_type: 'professionnel', code: 'MPDS', description: '', date_limite: '2026-07-22', places: 35, statut: 'ouvert' },
      { id: 3, titre: 'Mastere Professionnel en Ingenieries en Instrumentation industrielle (MP3I)', type: 'master', sous_type: 'professionnel', code: 'MP3I', description: '', date_limite: '2026-07-20', places: 25, statut: 'ouvert' },
      { id: 4, titre: 'Mastere Recherche en Genie logiciel (MRGL)', type: 'master', sous_type: 'recherche', code: 'MRGL', description: '', date_limite: '2026-07-22', places: 111, statut: 'ouvert' },
      { id: 5, titre: 'Mastere Recherche en micro-electronique et instrumentation (MRMI)', type: 'master', sous_type: 'recherche', code: 'MRMI', description: '', date_limite: '2026-07-20', places: 29, statut: 'ouvert' },
      { id: 6, titre: 'Ingenieur en sciences Appliquees et Technologie - Genie Logiciel (ING-GL)', type: 'cycle_ingenieur', code: 'ING_GL', specialite: 'Genie Logiciel', description: '', date_limite: '2026-08-08', places: 65, statut: 'ouvert' },
    ];
  }

  loadMesDossiers(): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    this.http
      .get<DossierCandidature[]>(`${this.candidatureApiBase}/mes-dossiers/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (data) => {
          this.dossiersCandidature = data || [];
        },
        error: (error) => {
          console.error('Erreur chargement dossiers:', error);
        },
      });
  }

  private loadNotifications(): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      this.notificationsErreur = 'Session expirée. Veuillez vous reconnecter.';
      return;
    }

    this.http
      .get<NotificationItem[]>(`${this.candidatureApiBase}/mes-notifications/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (data) => {
          this.notificationsErreur = '';
          this.notificationsCandidat = data || [];
          this.notificationsNonLues = this.notificationsCandidat.filter((item) => !item.lue).length;
        },
        error: (error) => {
          console.error('Erreur chargement notifications:', error);
          this.notificationsErreur =
            error?.status === 401
              ? 'Authentification invalide entre services. Reconnectez-vous après redémarrage.'
              : 'Impossible de charger les notifications pour le moment.';
          this.notificationsCandidat = [];
          this.notificationsNonLues = 0;
        },
      });
  }

  marquerNotificationCommeLue(notificationId: number): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    this.http
      .post(
        `${this.candidatureApiBase}/notifications/${notificationId}/mark-read/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: () => {
          this.notificationsCandidat = this.notificationsCandidat.map((notification) =>
            notification.id === notificationId ? { ...notification, lue: true } : notification,
          );
          this.notificationsNonLues = this.notificationsCandidat.filter((item) => !item.lue).length;
        },
        error: (error) => {
          console.error('Erreur marquage notification lue:', error);
        },
      });
  }

  marquerToutesNotificationsCommeLues(): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    this.http
      .post(
        `${this.candidatureApiBase}/notifications/mark-all-read/`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      .subscribe({
        next: (response: any) => {
          this.notificationsCandidat = this.notificationsCandidat.map((notification) => ({
            ...notification,
            lue: true,
          }));
          this.notificationsNonLues = 0;
        },
        error: (error) => {
          console.error('Erreur marquage notifications lues:', error);
        },
      });
  }

  getNotificationsFiltrees(): NotificationItem[] {
    const search = this.filtreNotificationRecherche.trim().toLowerCase();
    const severity = (notification: NotificationItem): number => {
      if (notification.type === 'danger') {
        return 3;
      }
      if (notification.type === 'warning') {
        return 2;
      }
      if (notification.type === 'info') {
        return 1;
      }
      return 0;
    };

    const filtered = this.notificationsCandidat.filter((notification) => {
      if (this.filtreNotificationType && notification.type !== this.filtreNotificationType) {
        return false;
      }

      const notificationDate = new Date(notification.date);

      if (this.filtreNotificationDateDebut) {
        const dateDebut = new Date(`${this.filtreNotificationDateDebut}T00:00:00`);
        if (notificationDate < dateDebut) {
          return false;
        }
      }

      if (this.filtreNotificationDateFin) {
        const dateFin = new Date(`${this.filtreNotificationDateFin}T23:59:59`);
        if (notificationDate > dateFin) {
          return false;
        }
      }

      if (search) {
        const content = `${notification.titre} ${notification.message}`.toLowerCase();
        if (!content.includes(search)) {
          return false;
        }
      }

      return true;
    });

    if (this.filtreNotificationTriRapide === 'critique') {
      return [...filtered].sort((a, b) => {
        const bySeverity = severity(b) - severity(a);
        if (bySeverity !== 0) {
          return bySeverity;
        }

        if (a.lue !== b.lue) {
          return Number(a.lue) - Number(b.lue);
        }

        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    }

    return [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  reinitialiserFiltresNotifications(): void {
    this.filtreNotificationType = '';
    this.filtreNotificationTriRapide = 'recent';
    this.filtreNotificationDateDebut = '';
    this.filtreNotificationDateFin = '';
    this.filtreNotificationRecherche = '';
  }

  get notificationsTotalCount(): number {
    return this.notificationsCandidat.length;
  }

  get notificationsTodayCount(): number {
    const today = new Date();
    return this.notificationsCandidat.filter((notification) => {
      const date = new Date(notification.date);
      return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    }).length;
  }

  get notificationsCriticalCount(): number {
    return this.notificationsCandidat.filter(
      (notification) => notification.type === 'warning' || notification.type === 'danger',
    ).length;
  }

  get notificationsFilteredUnreadCount(): number {
    return this.getNotificationsFiltrees().filter((notification) => !notification.lue).length;
  }

  getNotificationTypeLabel(type: NotificationItem['type']): string {
    if (type === 'success') {
      return 'Succes';
    }
    if (type === 'warning') {
      return 'Avertissement';
    }
    if (type === 'danger') {
      return 'Critique';
    }
    return 'Information';
  }

  chargerHistorique(): void {
    const token = this.authService.getAccessToken();

    const params: any = {};
    if (this.filtreAnnee) {
      params.annee = this.filtreAnnee;
    }

    this.isHistoriqueLoading = true;

    this.http
      .get(`${this.candidatureApiBase}/historique/`, {
        headers: { Authorization: `Bearer ${token}` },
        params: params,
      })
      .subscribe({
        next: (data: any) => {
          this.historique = Array.isArray(data) ? data : [];
          this.isHistoriqueLoading = false;
        },
        error: (error) => {
          console.error('Erreur chargement historique:', error);
          this.isHistoriqueLoading = false;
        },
      });
  }

  getTimelineFromHistorique(candidature: Candidature): WorkflowStage[] {
    const history = candidature.historique_statut || candidature.historiqueStatut || [];
    if (!Array.isArray(history) || history.length === 0) {
      return this.workflowTimeline(candidature);
    }

    const sortedHistory = [...history].sort((a, b) => {
      const rawA = String(a?.date || a?.updated_at || a?.created_at || '');
      const rawB = String(b?.date || b?.updated_at || b?.created_at || '');
      const dateA = new Date(rawA).getTime();
      const dateB = new Date(rawB).getTime();

      if (Number.isNaN(dateA) && Number.isNaN(dateB)) {
        return 0;
      }
      if (Number.isNaN(dateA)) {
        return 1;
      }
      if (Number.isNaN(dateB)) {
        return -1;
      }

      return dateA - dateB;
    });

    const timeline = sortedHistory.map((step) => {
      const rawStatus = String(step?.statut || step?.etat || step?.state || '').trim();
      const label =
        String(step?.libelle || step?.label || '').trim() ||
        this.formatHistoriqueStatusLabel(rawStatus);
      const hint =
        String(step?.commentaire || step?.motif || '').trim() ||
        String(step?.date || step?.updated_at || step?.created_at || '').trim();

      return {
        label,
        state: this.mapHistoriqueStatusState(rawStatus),
        hint: hint || undefined,
      };
    });

    return timeline.filter((step, index) => {
      if (index === 0) {
        return true;
      }

      const previousStep = timeline[index - 1];
      return !(previousStep.label === step.label && previousStep.state === step.state);
    });
  }

  getCurrentTimelineStatusLabel(candidature: Candidature): string {
    const timeline = this.getTimelineFromHistorique(candidature);
    for (let index = timeline.length - 1; index >= 0; index -= 1) {
      if (timeline[index].state === 'rejected') {
        return timeline[index].label;
      }
    }

    for (let index = timeline.length - 1; index >= 0; index -= 1) {
      if (timeline[index].state === 'current') {
        return timeline[index].label;
      }
    }

    for (let index = timeline.length - 1; index >= 0; index -= 1) {
      if (timeline[index].state === 'done') {
        return timeline[index].label;
      }
    }

    return 'En attente';
  }

  getTimelineActiveIndex(candidature: Candidature): number {
    const timeline = this.getTimelineFromHistorique(candidature);
    if (!timeline.length) {
      return 0;
    }

    const rejectedIndex = timeline.findIndex((step) => step.state === 'rejected');
    if (rejectedIndex >= 0) {
      return rejectedIndex;
    }

    const currentIndex = timeline.findIndex((step) => step.state === 'current');
    if (currentIndex >= 0) {
      return currentIndex;
    }

    const doneIndexes = timeline
      .map((step, index) => ({ step, index }))
      .filter((entry) => entry.step.state === 'done')
      .map((entry) => entry.index);

    return doneIndexes.length ? doneIndexes[doneIndexes.length - 1] : 0;
  }

  private mapHistoriqueStatusState(status: string): WorkflowStageState {
    const normalized = (status || '').toLowerCase();

    if (
      [
        'rejete',
        'rejetee',
        'non_admis',
        'non_admise',
        'non_preselectionne',
        'dossier_non_depose',
        'echec',
      ].includes(normalized)
    ) {
      return 'rejected';
    }

    if (
      ['selectionne', 'inscrit', 'dossier_depose', 'preselectionne', 'valide', 'soumis'].includes(
        normalized,
      )
    ) {
      return 'done';
    }

    if (['en_attente', 'sous_examen', 'en_cours', 'pending'].includes(normalized)) {
      return 'current';
    }

    return 'pending';
  }

  private formatHistoriqueStatusLabel(status: string): string {
    const raw = (status || '').trim();
    if (!raw) {
      return 'Mise a jour du dossier';
    }

    return this.getStatutLabel(raw).replaceAll('_', ' ');
  }

  mastersRecherche(): Offre[] {
    return this.getOffresFiltreesParType('master', 'recherche');
  }

  mastersProfessionnels(): Offre[] {
    return this.getOffresFiltreesParType('master', 'professionnel');
  }

  cyclesIngenieur(): Offre[] {
    return this.getOffresFiltreesParType('cycle_ingenieur');
  }

  dejaCandidature(masterId: number): boolean {
    const offre = this.offresInscription.find((o) => o.id === masterId);
    if (!offre) return false;
    return this.mesCandidatures.some((c) => c.master_id === offre.id);
  }

  postuler(offre: Offre, payload: Record<string, unknown> = {}): void {
    if (!this.actionPermissions.preinscription) {
      this.notifyActionBlocked("Action préinscription désactivée par l'administration.");
      return;
    }

    if (this.dejaCandidature(offre.id)) {
      this.toastService.show('Vous avez déjà postulé à cette offre.', 'warning');
      return;
    }

    if (offre.statut === 'ferme') {
      this.toastService.show('Cette offre est fermée aux candidatures.', 'warning');
      return;
    }

    const requestPayload: Record<string, unknown> = {
      master_id: offre.id,
      ...payload,
    };

    console.log('📦 Payload create candidature:', JSON.stringify(requestPayload, null, 2));

    this.candidatureService.createCandidature(requestPayload).subscribe({
      next: (response: any) => {
        this.toastService.show('Candidature soumise avec succès !', 'success');
        this.mesCandidatures.push({
          id: response.id,
          numero: response.numero,
          master_nom: offre.titre,
          master: response.master,
          master_id: offre.id,
          statut: 'soumis',
          date_soumission: new Date().toISOString(),
          etat_candidature: 'En cours',
          dossier_valide: false,
          date_depot_dossier: '',
          dossier_depose: false,
        });
        this.loadMesCandidatures();
        this.loadMesDossiers();
        this.switchView('candidatures');
      },
      error: (error) => {
        console.error('Erreur soumission candidature:', error);
        this.wizardSubmitting = false;

        // Extract the exact backend error message for display
        const backendMsg: string =
          error?.error?.error ||
          error?.error?.detail ||
          error?.error?.message ||
          (typeof error?.error === 'string' ? error.error : '') ||
          `Erreur ${error?.status || ''} lors de la soumission.`;

        this.toastService.show(backendMsg, 'error');
      },
    });
  }

  postulerOffre(offre: Offre): void {
    this.startSubmissionWizard(offre);
  }

  startSubmissionWizard(offre: Offre): void {
    if (!this.actionPermissions.preinscription) {
      this.notifyActionBlocked("Action préinscription désactivée par l'administration.");
      return;
    }

    if (this.dejaCandidature(offre.id)) {
      this.toastService.show('Vous avez déjà postulé à cette offre.', 'warning');
      return;
    }

    if (offre.statut === 'ferme') {
      this.toastService.show('Cette offre est fermée.', 'warning');
      return;
    }

    this.wizardOffre = offre;
    this.wizardCurrentStep = 1;
    this.wizardMaxAllowedStep = 1;
    this.wizardComputedScoreBackend = null;
    this.wizardComputedScoreInstantane = null;
    this.wizardComputedScoreLoading = false;
    this.wizardComputedScoreError = null;
    this.wizardMasterCoefficients = null;
    this.wizardTouched = {
      nom: false,
      prenom: false,
      cinPasseport: false,
      dateNaissance: false,
      email: false,
      telephone: false,
      etablissementOrigine: false,
      anneeBac: false,
      anneeObtentionDiplome: false,
      confirmationText: false,
      moyenneBacPrincipale: false,
      noteMathBac: false,
      noteFrancaisBac: false,
      noteAnglaisBac: false,
      moyenne1Annee: false,
      moyenne2Annee: false,
      moyenne3Annee: false,
      moyenne4Annee: false,
      moyenneIng1: false,
    };
    this.wizardUploadedFiles = Array.from({ length: this.wizardRequiredDocs.length }, () => null);
    this.wizardDragOverIndex = null;
    const firstName = this.profileData?.first_name || this.currentUser?.first_name || '';
    const lastName = this.profileData?.last_name || this.currentUser?.last_name || '';
    const phone = this.profileData?.phone || this.currentUser?.phone || '';
    const email = this.profileData?.email || this.currentUser?.email || '';

    this.wizardData = {
      nom: lastName,
      prenom: firstName,
      cinPasseport: '',
      dateNaissance: '',
      email,
      telephone: phone,
      etablissementOrigine: this.profileData?.etablissement_origine || 'ISIMM',
      etablissementOrigineType: (this.profileData?.etablissement_origine && this.profileData.etablissement_origine !== 'ISIMM' ? 'Externe' : 'ISIMM'),
      etablissementExterneNom: (this.profileData?.etablissement_origine && this.profileData.etablissement_origine !== 'ISIMM' ? this.profileData.etablissement_origine : ''),
      specialiteBac: '',
      anneeBac: '',
      moyenneBacPrincipale: '',
      noteMathBac: '',
      noteFrancaisBac: '',
      noteAnglaisBac: '',
      certificationB2: '',
      specialiteDiplome: '',
      anneeObtentionDiplome: '',
      natureDiplome: '',
      moyenne1Annee: '',
      session1Annee: '',
      moyenne2Annee: '',
      session2Annee: '',
      moyenne3Annee: '',
      session3Annee: '',
      natureCandidature: '',
      etablissementExterne: '',
      specialiteExterne: '',
      universite: '',
      etablissement: '',
      isISIMM: false,
      moyenne4Annee: '',
      session4Annee: '',
      nombreRedoublement: '',
      moyenneIng1: '',
      sessionReussiteIng1: '',
      nombreRedoublementIng1: '',
      confirmationDeclaration: false,
      confirmationText: '',
    };

    this.loadWizardMasterCoefficients(offre);
    this.showSubmissionWizardModal = true;
  }

  private getDefaultWizardMasterCoefficients(masterId: number): MasterScoreCoefficients {
    return {
      master_id: masterId,
      master_nom: this.wizardOffre?.titre || 'Master',
      coeff_bac: 0.5,
      coeff_licence: 0.5,
      coeff_examen: 0,
      bonus_mention: 0,
    };
  }

  private loadWizardMasterCoefficients(offre: Offre): void {
    const masterId = Number(offre.master_id ?? offre.id);
    if (!Number.isFinite(masterId) || masterId <= 0) {
      this.wizardMasterCoefficients = this.getDefaultWizardMasterCoefficients(0);
      return;
    }

    this.candidatureService.getMasterCoefficients(masterId).subscribe({
      next: (coeffs) => {
        this.wizardMasterCoefficients = coeffs;
        this.calculerScoreInstantane();
      },
      error: () => {
        this.wizardMasterCoefficients = this.getDefaultWizardMasterCoefficients(masterId);
        this.calculerScoreInstantane();
      },
    });
  }

  closeSubmissionWizard(): void {
    this.showSubmissionWizardModal = false;
    this.wizardOffre = null;
    this.wizardSubmitting = false;
  }

  private openWizardFromUrl(step: number): void {
    const boundedStep = Math.min(this.wizardTotalSteps, Math.max(1, step));
    const defaultOffer =
      this.getOffresFiltrees().find((item) => item.statut === 'ouvert') ||
      this.offresInscription[0];

    if (!defaultOffer) {
      this.toastService.show('Aucune offre disponible pour ouvrir le parcours.', 'warning');
      return;
    }

    this.startSubmissionWizard(defaultOffer);
    this.wizardCurrentStep = boundedStep;
    this.wizardMaxAllowedStep = Math.max(this.wizardMaxAllowedStep, boundedStep);
  }

  canGoToWizardStep(step: number): boolean {
    if (this.wizardAllowFreeNavigation) return true;
    return step >= 1 && step <= this.wizardMaxAllowedStep;
  }

  goToWizardStep(step: number): void {
    if (this.canGoToWizardStep(step)) {
      this.wizardCurrentStep = step;
    }
  }

  previousWizardStep(): void {
    if (this.wizardCurrentStep > 1) {
      this.wizardCurrentStep -= 1;
    }
  }

  nextWizardStep(): void {
    if (!this.isWizardStepValid(this.wizardCurrentStep)) {
      this.toastService.show('Veuillez compléter les champs requis avant de continuer.', 'warning');
      return;
    }

    if (this.wizardCurrentStep < this.wizardTotalSteps) {
      this.wizardCurrentStep += 1;
      this.wizardMaxAllowedStep = Math.max(this.wizardMaxAllowedStep, this.wizardCurrentStep);

      // Force an official backend score refresh when entering the recap step.
      if (this.wizardCurrentStep === 3) {
        this.triggerWizardScoreCalculation();
      }
    }
  }

  private parseWizardNumeric(value: string): number | null {
    const parsed = Number(
      String(value ?? '')
        .replace(',', '.')
        .trim(),
    );
    return Number.isFinite(parsed) ? parsed : null;
  }

  sanitizeWizardDigits(value: string, maxLength: number): string {
    return String(value ?? '')
      .replace(/\D/g, '')
      .slice(0, maxLength);
  }

  sanitizeWizardEmailInput(value: string): string {
    return String(value ?? '')
      .trim()
      .toLowerCase();
  }

  sanitizeWizardDecimalInput(value: string): string {
    const raw = String(value ?? '')
      .replace(/\s+/g, '')
      .replace(/\./g, ',');
    const parts = raw.split(',');
    const integerPart = parts[0].replace(/\D/g, '');
    const decimalPart = (parts.slice(1).join('') || '').replace(/\D/g, '').slice(0, 2);

    if (!integerPart && !decimalPart) {
      return '';
    }

    const normalizedInteger = integerPart || '0';
    const integerValue = Number(normalizedInteger);

    if (!Number.isFinite(integerValue)) {
      return '';
    }

    if (integerValue >= 20) {
      return '20';
    }

    if (decimalPart) {
      return `${normalizedInteger},${decimalPart}`;
    }

    return normalizedInteger;
  }

  sanitizeWizardPhoneInput(value: string): string {
    const raw = String(value ?? '').replace(/[^\d+]/g, '');
    const normalized = raw.startsWith('+')
      ? `+${raw.slice(1).replace(/\+/g, '')}`
      : `+${raw.replace(/\+/g, '')}`;

    return normalized.slice(0, 12);
  }

  private isScoreRangeValid(value: string): boolean {
    const parsed = this.parseWizardNumeric(value);
    return parsed !== null && parsed >= 0 && parsed <= 20;
  }

  isWizardYearValid(value: string): boolean {
    return /^\d{4}$/.test(String(value || '').trim());
  }

  // ────────────────────────────────────────────────────────────────
  // Validateurs date_naissance + annee_bac (Sprint contrôle de saisie)
  // ────────────────────────────────────────────────────────────────

  /**
   * Renvoie le code d'erreur applicable à la date de naissance, ou null si OK.
   * Codes : 'required' | 'invalide' | 'futur' | 'tropJeune' | 'tropEleve'
   */
  validerDateNaissance(value: string | undefined | null): string | null {
    if (!value) return 'required';
    const dateNaissance = new Date(value);
    if (isNaN(dateNaissance.getTime())) return 'invalide';

    const aujourdHui = new Date();
    aujourdHui.setHours(0, 0, 0, 0);
    if (dateNaissance >= aujourdHui) return 'futur';

    let age = aujourdHui.getFullYear() - dateNaissance.getFullYear();
    const moisDiff = aujourdHui.getMonth() - dateNaissance.getMonth();
    if (
      moisDiff < 0 ||
      (moisDiff === 0 && aujourdHui.getDate() < dateNaissance.getDate())
    ) {
      age--;
    }
    if (age < 17) return 'tropJeune';
    if (age > 60) return 'tropEleve';
    return null;
  }

  /**
   * Renvoie le code d'erreur applicable à l'année du Bac, ou null si OK.
   * Codes : 'required' | 'format' | 'tropAncien' | 'futur' | 'incoherent'
   */
  validerAnneeBac(
    value: string | undefined | null,
    dateNaissance?: string | undefined | null,
  ): string | null {
    if (value === null || value === undefined || String(value).trim() === '') return 'required';
    const raw = String(value).trim();
    if (!/^\d{4}$/.test(raw)) return 'format';
    const annee = parseInt(raw, 10);
    const anneeActuelle = new Date().getFullYear();
    if (annee < 1990) return 'tropAncien';
    if (annee > anneeActuelle) return 'futur';

    if (dateNaissance) {
      const dn = new Date(dateNaissance);
      if (!isNaN(dn.getTime())) {
        const anneeMin = dn.getFullYear() + 17;
        if (annee < anneeMin) return 'incoherent';
      }
    }
    return null;
  }

  /** Année minimum cohérente avec la date de naissance (pour message d'erreur). */
  getAnneeBacMinCoherente(): number | null {
    const dn = this.wizardData?.dateNaissance;
    if (!dn) return null;
    const d = new Date(dn);
    if (isNaN(d.getTime())) return null;
    return d.getFullYear() + 17;
  }

  /** Date max HTML5 pour le champ date_naissance (= aujourd'hui). */
  get maxDateNaissanceHTML(): string {
    return new Date().toISOString().split('T')[0];
  }

  /** Année max pour le champ annee_bac. */
  get anneeActuelle(): number {
    return new Date().getFullYear();
  }

  isWizardSubmissionAllowed(): boolean {
    return this.isWizardStepValid(1) && this.isWizardStepValid(2) && this.isWizardStepValid(3);
  }

  isWizardScoreInvalid(value: string): boolean {
    return !!String(value || '').trim() && !this.isScoreRangeValid(value);
  }

  isValidEmail(value: string): boolean {
    const email = String(value || '').trim();
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private areWizardScoresInRange(values: string[]): boolean {
    return values.every((value) => this.isScoreRangeValid(value));
  }

  hasWizardScoreInputs(): boolean {
    return [
      this.wizardData.moyenneBacPrincipale,
      this.wizardData.noteMathBac,
      this.wizardData.noteFrancaisBac,
      this.wizardData.noteAnglaisBac,
      this.wizardData.moyenne1Annee,
      this.wizardData.moyenne2Annee,
      this.wizardData.moyenne3Annee,
      this.wizardData.moyenne4Annee,
      this.wizardData.moyenneIng1,
    ].some((value) => this.parseWizardNumeric(String(value || '')) !== null);
  }

  // Trigger backend score calculation with debounce to avoid excessive API calls
  triggerWizardScoreCalculation(): void {
    this.calculerScoreInstantane();
    this.recalculerScoreLive();

    if (!this.wizardOffre || !this.isWizardStepValid(2)) {
      this.wizardComputedScoreLoading = false;
      return;
    }

    if (this.wizardScoreCalculationTimer) {
      clearTimeout(this.wizardScoreCalculationTimer);
    }
    this.wizardComputedScoreLoading = true;
    this.wizardComputedScoreError = null;

    this.wizardScoreCalculationTimer = setTimeout(() => {
      this.calculateWizardScoreFromBackend();
    }, 800); // 800ms debounce
  }

  calculerScoreInstantane(): number | null {
    const n = (value: string): number | null => this.parseWizardNumeric(value);
    const formationCode = this.getWizardFormationCode(this.wizardOffre);

    const m1 = n(this.wizardData.moyenne1Annee);
    const m2 = n(this.wizardData.moyenne2Annee);
    const m3 = n(this.wizardData.moyenne3Annee);
    const moyenneBac = n(this.wizardData.moyenneBacPrincipale) ?? 0;
    const noteMathBac = n(this.wizardData.noteMathBac) ?? 0;
    const noteFrancaisBac = n(this.wizardData.noteFrancaisBac) ?? 0;
    const noteAnglaisBac = n(this.wizardData.noteAnglaisBac) ?? 0;
    const nbRedoublements = Number(this.wizardData.nombreRedoublement || '0');

    const sessionValues = [
      String(this.wizardData.session1Annee || ''),
      String(this.wizardData.session2Annee || ''),
      String(this.wizardData.session3Annee || ''),
    ].map((value) => value.trim().toLowerCase());

    const nbRattrapages = sessionValues.filter((value) =>
      [
        'rattrapage',
        'controle',
        'contrôle',
        'control',
        'session controle',
        'session rattrapage',
      ].includes(value),
    ).length;

    const bonusNr = nbRedoublements <= 0 ? 5 : nbRedoublements === 1 ? 3 : 0;
    const bonusSp = nbRattrapages <= 0 ? 3 : nbRattrapages === 1 ? 2 : 0;

    let score: number | null = null;

    if (formationCode === 'MPGL' || formationCode === 'MPDS') {
      if (m1 === null && m2 === null && m3 === null) {
        score = null;
      } else {
        const avg = ((m1 ?? 0) + (m2 ?? 0) + (m3 ?? 0)) / 3;
        score = avg + bonusNr + bonusSp;
      }
    } else if (formationCode === 'MRGL') {
      if (m1 === null && m2 === null && m3 === null) {
        score = null;
      } else {
        const bonusLangue = noteFrancaisBac >= 12 || noteAnglaisBac >= 12 ? 1 : 0;
        const anneeDiplome = Number(this.wizardData.anneeObtentionDiplome || '0');
        const bonusDiplome = [2025, 2023].includes(anneeDiplome)
          ? 4
          : [2022, 2021, 2020].includes(anneeDiplome)
            ? 2
            : 0;

        score =
          1.5 * (m1 ?? 0) +
          2 * (m2 ?? 0) +
          (m3 ?? 0) +
          bonusNr +
          bonusSp +
          (moyenneBac + noteMathBac - 20) / 2 +
          bonusLangue +
          bonusDiplome;
      }
    } else if (formationCode === 'MP3I') {
      if (m1 === null && m2 === null && m3 === null) {
        score = null;
      } else {
        const nonNull = [m1, m2, m3].filter((v) => v !== null) as number[];
        const moyAcad = nonNull.reduce((a, b) => a + b, 0) / nonNull.length;
        const penalty = Math.min(nbRedoublements, 3) * 0.25;
        score = moyenneBac * 0.4 + moyAcad * 0.6 - penalty;
      }
    } else if (formationCode === 'ING_INFO_GL' || formationCode === 'ING_EM') {
      const isInterne =
        String(this.wizardData.natureCandidature || '').toLowerCase() !== 'étudiant externe';

      if (isInterne) {
        if (m2 === null) {
          score = null;
        } else {
          const aRedouble = nbRedoublements > 0;
          const b1 = this.get_bonus(this.wizardData.session1Annee, aRedouble);
          const b2 = this.get_bonus(this.wizardData.session2Annee, aRedouble);
          score = m2 + b1 + b2;
        }
      } else {
        const r1 = n((this.wizardData as any).rang1) ?? 0;
        const r2 = n((this.wizardData as any).rang2) ?? 0;
        score = 0.5 * (2 * (m1 ?? 0) + 2 * (m2 ?? 0) + (m3 ?? 0)) + 50 * (1 - r1) + 50 * (1 - r2);
      }
    }

    if (score === null) {
      this.wizardComputedScoreInstantane = null;
      return null;
    }

    const normalizedScore = Number(score.toFixed(2));
    this.wizardComputedScoreInstantane = normalizedScore;
    return normalizedScore;
  }

  private get_bonus(session: string, aRedouble: boolean): number {
    const normalized = String(session || '')
      .trim()
      .toLowerCase();
    const isPrincipale = ['principale', 'principal', 'main'].includes(normalized);
    if (!aRedouble) {
      return isPrincipale ? 2 : 1.5;
    }
    return isPrincipale ? 1 : 0;
  }

  // Call backend to compute score using proper formula (e.g., MRGL)
  private calculateWizardScoreFromBackend(): void {
    // Only calculate if step 2 is valid (has all required academic data)
    if (!this.isWizardStepValid(2)) {
      this.wizardComputedScoreLoading = false;
      return;
    }

    // Skip backend call when the offer has no real master_id (canonical fallback offers).
    // The backend requires a valid Master with a formule_score; fallback offers use fake IDs.
    const masterId = this.wizardOffre?.master_id;
    if (!masterId) {
      this.wizardComputedScoreLoading = false;
      return;
    }

    this.wizardComputedScoreLoading = true;
    this.wizardComputedScoreError = null;

    const academicData = this.buildWizardAcademicDataPayload();
    const formationCode = this.getWizardFormationCode(this.wizardOffre);
    const payload = {
      master_id: masterId,
      formation_code: formationCode,
      academic_data: academicData,
      payload: academicData,
      moyenneBac: this.parseWizardNumeric(this.wizardData.moyenneBacPrincipale),
      noteMathBac: this.parseWizardNumeric(this.wizardData.noteMathBac),
      noteFrancaisBac: this.parseWizardNumeric(this.wizardData.noteFrancaisBac),
      noteAnglaisBac: this.parseWizardNumeric(this.wizardData.noteAnglaisBac),
      certificationB2: this.wizardData.certificationB2 === 'oui',
      moyenne1: this.parseWizardNumeric(this.wizardData.moyenne1Annee),
      moyenne2: this.parseWizardNumeric(this.wizardData.moyenne2Annee),
      moyenne3: this.parseWizardNumeric(this.wizardData.moyenne3Annee),
      moyenne4: this.parseWizardNumeric(this.wizardData.moyenne4Annee),
      moyenneIng1: this.parseWizardNumeric(this.wizardData.moyenneIng1),
      nombreRedoublement: this.parseWizardNumeric(this.wizardData.nombreRedoublement) || 0,
      nombreRedoublementIng1: this.parseWizardNumeric(this.wizardData.nombreRedoublementIng1) || 0,
      session1: this.wizardData.session1Annee,
      session2: this.wizardData.session2Annee,
      session3: this.wizardData.session3Annee,
      session4: this.wizardData.session4Annee,
      sessionReussiteIng1: this.wizardData.sessionReussiteIng1,
    };

    this.candidatureService.calculateWizardScore(payload).subscribe({
      next: (response: any) => {
        // Guard: modal may have been closed before the response arrived
        if (!this.showSubmissionWizardModal) return;
        this.wizardComputedScoreBackend = response?.score ?? null;
        this.wizardComputedScoreLoading = false;
      },
      error: () => {
        // Guard: modal may have been closed before the response arrived
        if (!this.showSubmissionWizardModal) return;
        this.wizardComputedScoreError = 'Erreur lors du calcul du score';
        this.wizardComputedScoreLoading = false;
      },
    });
  }

  getWizardComputedScore(): number {
    // ★ Sprint 4 — prioriser le score live (ScoreService), conserve la valeur
    // entre étape 2 et étape 3.
    if (this.scoreLiveTotal !== null && this.scoreLiveTotal !== undefined) {
      return this.scoreLiveTotal;
    }
    if (this.wizardComputedScoreBackend !== null) {
      return this.wizardComputedScoreBackend;
    }
    if (this.wizardComputedScoreInstantane !== null) {
      return this.wizardComputedScoreInstantane;
    }
    return 0;
  }

  getWizardComputedScoreDisplay(): string {
    // ★ Sprint 4 — utiliser le score live calculé en temps réel par ScoreService
    if (this.scoreLiveTotal !== null && this.scoreLiveTotal !== undefined) {
      return this.scoreLiveTotal.toFixed(2);
    }
    if (this.wizardComputedScoreBackend !== null) {
      return this.wizardComputedScoreBackend.toFixed(2);
    }
    if (this.wizardComputedScoreInstantane !== null) {
      return this.wizardComputedScoreInstantane.toFixed(2);
    }
    return '—';
  }

  isWizardCINValid(value: string): boolean {
    const cin = String(value || '').trim();
    return /^\d{8}$/.test(cin);
  }

  isWizardPhoneValid(value: string): boolean {
    const phone = String(value || '').trim();
    return phone.startsWith('+216');
  }

  isWizardMrglOffer(): boolean {
    return String(this.wizardOffre?.code || '').toUpperCase() === 'MRGL';
  }

  isWizardMrmiOffer(): boolean {
    return String(this.wizardOffre?.code || '').toUpperCase() === 'MRMI';
  }

  isWizardMp3iOffer(): boolean {
    return String(this.wizardOffre?.code || '').toUpperCase() === 'MP3I';
  }

  isWizardIngenieurOffer(): boolean {
    return this.wizardOffre?.type === 'cycle_ingenieur';
  }

  isWizardMrmiIng1EquivalentSelected(): boolean {
    return (
      this.isWizardMrmiOffer() &&
      this.wizardData.specialiteDiplome ===
        'Reussite en 1ere annee du cycle ingenieur (Electronique/Instrumentation) ou equivalent'
    );
  }

  getSpecialitesDemandeesForOffre(offre: Offre | null | undefined): string[] {
    if (!offre) return [];
    const code = String(offre.code || '').toUpperCase();
    const byCode = code ? resolveParcoursByCode(code) : undefined;
    if (byCode) return byCode.defaultSpecialitesDemandees;
    const byId = resolveParcoursByOffreId(offre.id);
    return byId ? byId.defaultSpecialitesDemandees : [];
  }

  getWizardSpecialitesDemandees(): string[] {
    return this.getSpecialitesDemandeesForOffre(this.wizardOffre);
  }

  onWizardEtablissementTypeChange(): void {
    if (this.wizardData.etablissementOrigineType === 'ISIMM') {
      this.wizardData.etablissementOrigine = 'ISIMM';
      this.wizardData.etablissementExterneNom = '';
    } else {
      this.wizardData.etablissementOrigine = this.wizardData.etablissementExterneNom || '';
    }
  }

  onWizardEtablissementExterneNomChange(): void {
    if (this.wizardData.etablissementOrigineType === 'Externe') {
      this.wizardData.etablissementOrigine = this.wizardData.etablissementExterneNom || '';
    }
  }

  shouldShowWizardMrglFourthYearFields(): boolean {
    return this.isWizardMrglOffer() && this.wizardData.natureDiplome === 'Maitrise';
  }

  isWizardStepValid(step: number): boolean {
    if (step === 1) {
      const baseRequired = [
        this.wizardData.nom,
        this.wizardData.prenom,
        this.wizardData.cinPasseport,
        this.wizardData.dateNaissance,
        this.wizardData.email,
        this.wizardData.telephone,
        this.wizardData.etablissementOrigine,
      ].every((value) => !!String(value || '').trim());

      if (
        !baseRequired ||
        !this.isValidEmail(this.wizardData.email) ||
        !this.isWizardCINValid(this.wizardData.cinPasseport) ||
        !this.isWizardPhoneValid(this.wizardData.telephone) ||
        this.validerDateNaissance(this.wizardData.dateNaissance) !== null
      ) {
        return false;
      }

      return true;
    }

    if (step === 2) {
      const baseBacFieldsValid = [
        this.wizardData.specialiteBac,
        this.wizardData.anneeBac,
        this.wizardData.moyenneBacPrincipale,
      ].every((value) => !!String(value || '').trim());

      if (
        this.validerAnneeBac(this.wizardData.anneeBac, this.wizardData.dateNaissance) !== null
      ) {
        return false;
      }

      if (
        !baseBacFieldsValid ||
        !this.isWizardYearValid(this.wizardData.anneeBac) ||
        !this.isScoreRangeValid(this.wizardData.moyenneBacPrincipale)
      ) {
        return false;
      }

      if (!this.isWizardYearValid(this.wizardData.anneeObtentionDiplome)) {
        return false;
      }

      const licenceFields = [
        this.wizardData.specialiteDiplome,
        this.wizardData.anneeObtentionDiplome,
        this.wizardData.natureDiplome,
        this.wizardData.moyenne1Annee,
        this.wizardData.session1Annee,
        this.wizardData.moyenne2Annee,
        this.wizardData.session2Annee,
        this.wizardData.moyenne3Annee,
        this.wizardData.session3Annee,
      ].every((value) => !!String(value || '').trim());

      if (!licenceFields) {
        return false;
      }

      const licenceScores = [
        this.wizardData.moyenne1Annee,
        this.wizardData.moyenne2Annee,
        this.wizardData.moyenne3Annee,
      ];
      if (!this.areWizardScoresInRange(licenceScores)) {
        return false;
      }

      if (this.isWizardMrglOffer() || this.isWizardMrmiOffer()) {
        // Allow 0 as a valid value for `nombreRedoublement` (0 is falsy in JS).
        const nbRedouble = this.wizardData.nombreRedoublement;
        if (
          !this.wizardData.natureCandidature ||
          nbRedouble === null ||
          nbRedouble === undefined ||
          nbRedouble === ''
        ) {
          return false;
        }
      }

      if (this.wizardData.natureCandidature === 'Étudiant Externe') {
        if (!this.wizardData.etablissementExterne || !this.wizardData.specialiteExterne) {
          return false;
        }
      }

      if (this.isWizardMrglOffer() && this.shouldShowWizardMrglFourthYearFields()) {
        if (
          !this.wizardData.moyenne4Annee ||
          !this.isScoreRangeValid(this.wizardData.moyenne4Annee)
        ) {
          return false;
        }
      }

      if (this.isWizardMrmiIng1EquivalentSelected()) {
        if (!this.wizardData.moyenneIng1 || !this.isScoreRangeValid(this.wizardData.moyenneIng1)) {
          return false;
        }
      }

      if (this.isWizardMrglOffer()) {
        const mrglBacFieldsValid = [
          this.wizardData.noteMathBac,
          this.wizardData.noteFrancaisBac,
          this.wizardData.noteAnglaisBac,
          this.wizardData.certificationB2,
        ].every((value) => !!String(value || '').trim());

        if (!mrglBacFieldsValid) {
          return false;
        }

        return this.areWizardScoresInRange([
          this.wizardData.noteMathBac,
          this.wizardData.noteFrancaisBac,
          this.wizardData.noteAnglaisBac,
        ]);
      }

      return true;
    }

    if (step === 3) {
      if (!this.wizardOffre) {
        return false;
      }

      return (
        this.wizardData.confirmationDeclaration === true &&
        String(this.wizardData.confirmationText || '')
          .trim()
          .toLowerCase() === 'je confirme'
      );
    }

    return true;
  }

  get wizardUploadedCount(): number {
    return this.wizardUploadedFiles.filter((file) => !!file).length;
  }

  get wizardUploadCompletion(): number {
    if (!this.wizardRequiredDocs.length) {
      return 0;
    }
    return Math.round((this.wizardUploadedCount / this.wizardRequiredDocs.length) * 100);
  }

  onWizardDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.wizardDragOverIndex = index;
  }

  onWizardDrop(event: DragEvent, index: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.wizardDragOverIndex = null;

    const file = event.dataTransfer?.files?.[0] || null;
    if (file) {
      this.setWizardFile(index, file);
    }
  }

  onWizardFileSelected(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    if (file) {
      this.setWizardFile(index, file);
    }
    input.value = '';
  }

  getWizardUploadedFileName(index: number): string {
    return this.wizardUploadedFiles[index]?.name || '';
  }

  hasWizardUploadedFile(index: number): boolean {
    return !!this.wizardUploadedFiles[index];
  }

  getWizardDocHint(index: number, fallbackHint: string): string {
    const file = this.wizardUploadedFiles[index];
    return file ? `✅ ${file.name}` : fallbackHint;
  }

  removeWizardFile(index: number): void {
    if (index < 0 || index >= this.wizardUploadedFiles.length) {
      return;
    }
    this.wizardUploadedFiles[index] = null;
  }

  private setWizardFile(index: number, file: File): void {
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      this.toastService.show('Format invalide. Utilisez PDF, JPG ou PNG.', 'warning');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.toastService.show('Fichier trop volumineux (max 5 Mo).', 'warning');
      return;
    }

    this.wizardUploadedFiles[index] = file;
  }

  submitWizardCandidature(): void {
    if (!this.wizardOffre) {
      return;
    }

    if (!this.isWizardSubmissionAllowed()) {
      this.toastService.show(
        'Veuillez remplir correctement tous les champs requis avant la soumission.',
        'warning',
      );
      return;
    }

    const offre = this.wizardOffre;
    const formationCode = this.getWizardFormationCode(offre);
    const academicData = this.buildWizardAcademicDataPayload();

    // Submit immediately with backend score if available, otherwise local instant score.
    const instantScore = this.calculerScoreInstantane();

    // Refresh backend score in background without blocking submission.
    if (
      this.wizardComputedScoreBackend === null &&
      this.isWizardStepValid(2) &&
      !this.wizardComputedScoreLoading
    ) {
      this.triggerWizardScoreCalculation();
    }

    const scoreToSubmit = this.wizardComputedScoreBackend ?? instantScore;
    this.proceedWithSubmission(offre, formationCode, academicData, scoreToSubmit);
  }

  private proceedWithSubmission(
    offre: Offre,
    formationCode: string,
    academicData: Record<string, unknown>,
    scorePrevisualisation: number | null,
  ): void {
    console.log('📤 proceedWithSubmission() called', {
      score_backend: this.wizardComputedScoreBackend,
      score_instantane: this.wizardComputedScoreInstantane,
      score_submit: scorePrevisualisation,
      formation_code: formationCode,
    });

    const wizardPayload: Record<string, unknown> = {
      nature_candidature: this.wizardData.natureCandidature,
      etablissement_externe: this.wizardData.etablissementExterne,
      specialite_externe: this.wizardData.specialiteExterne,
      etablissement_origine: this.wizardData.etablissementOrigine,
      selected_diplome: this.wizardData.specialiteDiplome,
      diplome_reference: this.wizardData.natureDiplome,
      formation_code: formationCode,
      score_previsualisation: scorePrevisualisation,
      // ★ Sprint 4 — score live recalculé en temps réel (vérification anti-fraude côté Django)
      score_declare: this.scoreLiveTotal ?? scorePrevisualisation ?? 0,
      academic_data: academicData,
    };

    console.log('  Payload keys:', Object.keys(wizardPayload));
    this.wizardSubmitting = true;
    this.postuler(offre, wizardPayload);
    setTimeout(() => {
      this.closeSubmissionWizard();
    }, 450);
  }

  private getWizardFormationCode(offre: Offre | null): string {
    const rawCode = String(offre?.code || '')
      .trim()
      .toLowerCase();
    const detailCode = offre ? this.getPreinscriptionDetailCode(offre) : null;
    const code = rawCode || detailCode || '';
    const map: Record<string, string> = {
      mpgl: 'MPGL',
      mpds: 'MPDS',
      mp3i: 'MP3I',
      mrgl: 'MRGL',
      mrmi: 'MRMI',
      ing_info_gl: 'ING_INFO_GL',
      ing_em: 'ING_EM',
      'ing-info-gl': 'ING_INFO_GL',
      inginfo: 'ING_INFO_GL',
      inginfo_gl: 'ING_INFO_GL',
      ingem: 'ING_EM',
    };

    return code ? map[code] || code.toUpperCase() : 'MASTER_GENERIC';
  }

  private buildWizardAcademicDataPayload(): Record<string, unknown> {
    const n = (value: string): number | null => this.parseWizardNumeric(value);

    const common = {
      session: this.wizardData.session3Annee || this.wizardData.session2Annee || 'Principale',
      redoublements: Number(this.wizardData.nombreRedoublement || '0'),
    };

    // ★ Sprint 4 — clés à plat pour le ScoreService backend (anti-fraude)
    const nbSessionsControle = [
      this.wizardData.session1Annee,
      this.wizardData.session2Annee,
      this.wizardData.session3Annee,
    ].filter((s) => s === 'control').length;

    return {
      // ── Clés à plat lues par le backend (Sprint 4 anti-fraude) ──
      moyenne_l1: n(this.wizardData.moyenne1Annee) || 0,
      moyenne_l2: n(this.wizardData.moyenne2Annee) || 0,
      moyenne_l3: n(this.wizardData.moyenne3Annee) || 0,
      moyenne_bac: n(this.wizardData.moyenneBacPrincipale) || 0,
      note_maths_bac: n(this.wizardData.noteMathBac) || 0,
      note_francais_bac: n(this.wizardData.noteFrancaisBac) || 0,
      note_anglais_bac: n(this.wizardData.noteAnglaisBac) || 0,
      nb_redoublements: Number(this.wizardData.nombreRedoublement || '0'),
      nb_sessions_controle: nbSessionsControle,
      annee_diplome: Number(this.wizardData.anneeObtentionDiplome || 0),
      session_l1_controle: this.wizardData.session1Annee === 'control',
      session_l2_controle: this.wizardData.session2Annee === 'control',
      session_l3_controle: this.wizardData.session3Annee === 'control',
      certif_b2: this.wizardData.certificationB2 === 'oui',
      common,
      glDs: {
        moy1: n(this.wizardData.moyenne1Annee),
        moy2: n(this.wizardData.moyenne2Annee),
        moy3: n(this.wizardData.moyenne3Annee),
      },
      i3: {
        moyBac: n(this.wizardData.moyenneBacPrincipale),
        moyL1: n(this.wizardData.moyenne1Annee),
        moyL2: n(this.wizardData.moyenne2Annee),
        moyL3: n(this.wizardData.moyenne3Annee),
        session1Annee: this.wizardData.session1Annee,
        session2Annee: this.wizardData.session2Annee,
        session3Annee: this.wizardData.session3Annee,
        nombreRedoublement: Number(this.wizardData.nombreRedoublement || '0'),
      },
      mrglParcours: this.wizardData.natureDiplome === 'Maitrise' ? 'maitrise' : 'licence',
      mrglLicence: {
        moyBac: n(this.wizardData.moyenneBacPrincipale),
        note_math_bac: n(this.wizardData.noteMathBac),
        note_francais_bac: n(this.wizardData.noteFrancaisBac),
        note_anglais_bac: n(this.wizardData.noteAnglaisBac),
        certification_b2: this.wizardData.certificationB2 === 'oui',
        annee_obtention_diplome: this.wizardData.anneeObtentionDiplome,
        moy1: n(this.wizardData.moyenne1Annee),
        moy2: n(this.wizardData.moyenne2Annee),
        moy3: n(this.wizardData.moyenne3Annee),
        session1Annee: this.wizardData.session1Annee,
        session2Annee: this.wizardData.session2Annee,
        session3Annee: this.wizardData.session3Annee,
        nombreRedoublement: Number(this.wizardData.nombreRedoublement || '0'),
      },
      mrglMaitrise: {
        moyBac: n(this.wizardData.moyenneBacPrincipale),
        note_math_bac: n(this.wizardData.noteMathBac),
        note_francais_bac: n(this.wizardData.noteFrancaisBac),
        note_anglais_bac: n(this.wizardData.noteAnglaisBac),
        certification_b2: this.wizardData.certificationB2 === 'oui',
        moy1: n(this.wizardData.moyenne1Annee),
        moy2: n(this.wizardData.moyenne2Annee),
        moy3: n(this.wizardData.moyenne3Annee),
        moy4: n(this.wizardData.moyenne4Annee),
        session1Annee: this.wizardData.session1Annee,
        session2Annee: this.wizardData.session2Annee,
        session3Annee: this.wizardData.session3Annee,
        session4Annee: this.wizardData.session4Annee,
        nombreRedoublement: Number(this.wizardData.nombreRedoublement || '0'),
      },
      mrmiParcours: this.isWizardMrmiIng1EquivalentSelected() ? 'cas2' : 'cas1',
      mrmiCas1: {
        moyBac: n(this.wizardData.moyenneBacPrincipale),
        moyL1: n(this.wizardData.moyenne1Annee),
        moyL2: n(this.wizardData.moyenne2Annee),
        moyL3: n(this.wizardData.moyenne3Annee),
        session1Annee: this.wizardData.session1Annee,
        session2Annee: this.wizardData.session2Annee,
        session3Annee: this.wizardData.session3Annee,
        nombreRedoublement: Number(this.wizardData.nombreRedoublement || '0'),
      },
      mrmiCas2: {
        moyIng1: n(this.wizardData.moyenneIng1),
        sessionReussiteIng1: this.wizardData.sessionReussiteIng1,
        nombreRedoublementIng1: Number(this.wizardData.nombreRedoublementIng1 || '0'),
      },
      ingParcours: 'cas1',
      ingCas1: {
        moy1: n(this.wizardData.moyenne1Annee),
        moy2: n(this.wizardData.moyenne2Annee),
        session1Annee: this.wizardData.session1Annee,
        session2Annee: this.wizardData.session2Annee,
        nombreRedoublement: Number(this.wizardData.nombreRedoublement || '0'),
      },
      ingCas2: {
        m1: n(this.wizardData.moyenne1Annee),
        m2: n(this.wizardData.moyenne2Annee),
        m3: n(this.wizardData.moyenne3Annee),
      },
    };
  }

  accederAuDossier(candidature: Candidature): void {
    if (!this.actionPermissions.consultationDossier && !this.actionPermissions.depotDossier) {
      this.notifyActionBlocked("Accès dossier désactivé par l'administration.");
      return;
    }

    const dossier = this.dossiersCandidature.find(
      (d) => d.numero_candidature === candidature.numero,
    );
    if (dossier) {
      this.selectedDossierNumber = dossier.numero_dossier;
      this.switchView('mon-dossier');
    } else {
      this.showAlertMessage('Dossier non trouvé');
    }
  }

  getDossierNumber(candidatureOrNumero: string | Candidature): string | null {
    const numeroCandidature =
      typeof candidatureOrNumero === 'string' ? candidatureOrNumero : candidatureOrNumero.numero;
    const dossier = this.dossiersCandidature.find(
      (d) => d.numero_candidature === numeroCandidature,
    );

    if (dossier) {
      return dossier.numero_dossier;
    }

    if (typeof candidatureOrNumero !== 'string') {
      const tokens = (candidatureOrNumero.numero || '').split('-').filter(Boolean);
      return tokens.length >= 2 ? tokens.slice(0, 2).join('-') : candidatureOrNumero.numero || null;
    }

    return null;
  }

  dossiersAffiches(): DossierCandidature[] {
    if (!this.selectedDossierNumber) {
      return this.dossiersCandidature;
    }
    return this.dossiersCandidature.filter((d) => d.numero_dossier === this.selectedDossierNumber);
  }

  currentAcademicYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const start = now.getMonth() >= 8 ? year : year - 1;
    return `${start}/${start + 1}`;
  }

  private buildWorkflowMockCandidatures(): Candidature[] {
    const today = new Date().toISOString();
    return [
      {
        id: 9001,
        numero: 'SIM-001',
        master_nom: 'Scenario 1 - Paiement non confirme puis rejet',
        master_id: 1,
        statut: 'rejete',
        date_soumission: today,
        etat_candidature: 'Rejeté',
        dossier_valide: true,
        date_depot_dossier: today,
        dossier_depose: true,
        statut_inscription: 'non_confirme',
        numero_inscription_universitaire: '26-111-AAA',
        motif_rejet: 'Paiement non valide sur inscription en ligne',
      },
      {
        id: 9002,
        numero: 'SIM-002',
        master_nom: 'Scenario 2 - Non presélectionné',
        master_id: 2,
        statut: 'non_preselectionne',
        date_soumission: today,
        etat_candidature: 'Non présélectionné',
        dossier_valide: false,
        dossier_depose: false,
        date_depot_dossier: '',
      },
      {
        id: 9003,
        numero: 'SIM-003',
        master_nom: 'Scenario 3 - Dossier non depose',
        master_id: 3,
        statut: 'dossier_non_depose',
        date_soumission: today,
        etat_candidature: 'Rejeté',
        dossier_valide: false,
        dossier_depose: false,
        date_depot_dossier: '',
        motif_rejet: 'Dossier de candidature non depose avant delai',
      },
      {
        id: 9004,
        numero: 'SIM-004',
        master_nom: 'Scenario 4 - Sélectionnée (en attente) / Non admis',
        master_id: 4,
        statut: 'non_admis',
        date_soumission: today,
        etat_candidature: 'Non admis',
        dossier_valide: true,
        dossier_depose: true,
        date_depot_dossier: today,
        statut_inscription: 'en_attente',
        numero_inscription_universitaire: '26-222-BBB',
        motif_rejet: 'non admis',
      },
    ];
  }

  candidaturesMaster(): Candidature[] {
    return this.mesCandidatures.filter(
      (c) => !this.isCycleIngenieur(c) && this.matchesSelectedAcademicYear(c),
    );
  }

  candidaturesIngenieur(): Candidature[] {
    return this.mesCandidatures.filter(
      (c) => this.isCycleIngenieur(c) && this.matchesSelectedAcademicYear(c),
    );
  }

  get candidatureTotalCount(): number {
    return this.mesCandidatures.filter((c) => this.matchesSelectedAcademicYear(c)).length;
  }

  get candidaturePendingCount(): number {
    return this.mesCandidatures.filter((candidature) => this.isPendingCandidature(candidature))
      .length;
  }

  get candidatureValidatedCount(): number {
    return this.mesCandidatures.filter((candidature) => this.isValidatedCandidature(candidature))
      .length;
  }

  hasMissingPieces(candidature: Candidature): boolean {
    return candidature.dossier_depose !== true || candidature.dossier_valide !== true;
  }

  private normalizeStatus(value: string | undefined | null): string {
    return (value || '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_');
  }

  isAdmitted(candidature: Candidature): boolean {
    const etat = this.normalizeStatus(candidature.etat_candidature);
    const statut = this.normalizeStatus(candidature.statut);
    return (
      etat.includes('admis') ||
      etat.includes('selectionne') ||
      ['selectionne', 'admis', 'inscrit'].includes(statut)
    );
  }

  isFicheInscriptionDeposee(candidature: Candidature): boolean {
    const statutInscription = this.normalizeStatus(candidature.statut_inscription);
    return ['paiement_soumis', 'valide', 'confirme'].includes(statutInscription);
  }

  getNomPrenomInscription(candidature: Candidature): string {
    const firstName = this.profileData?.first_name || this.currentUser?.first_name || '';
    const lastName = this.profileData?.last_name || this.currentUser?.last_name || '';
    return `${candidature.prenom || firstName} ${candidature.nom || lastName}`.trim() || '-';
  }

  getNumeroInscriptionUniversitaire(candidature: Candidature): string {
    return candidature.numero_inscription_universitaire || candidature.numero || '-';
  }

  syncNumeroInscriptionUniversitaire(candidature: Candidature): void {
    const numero = (candidature.numero_inscription_universitaire || '').trim();
    if (!numero) {
      this.toastService.show('Le numéro d’inscription universitaire est requis.', 'error');
      return;
    }

    this.savingInscriptionNumberId = candidature.id;
    // Endpoint dédié : enregistre le N° + passe le statut à 'en_attente_verification'
    this.candidatureService.saisirNumeroInscription(candidature.id, numero).subscribe({
      next: (response: any) => {
        candidature.numero_inscription_universitaire = numero;
        candidature.statut_inscription =
          response?.statut_inscription || 'en_attente_verification';
        this.mesCandidatures = this.mesCandidatures.map((item) =>
          item.id === candidature.id
            ? {
                ...item,
                numero_inscription_universitaire: numero,
                statut_inscription: candidature.statut_inscription,
              }
            : item,
        );
        this.toastService.show(
          response?.message || 'Numéro enregistré. En attente de vérification.',
          'success',
        );
        this.savingInscriptionNumberId = null;
      },
      error: (error) => {
        console.error('Erreur saisie numéro inscription:', error);
        this.toastService.show(
          error?.error?.error || 'Erreur lors de l’enregistrement du numéro.',
          'error',
        );
        this.savingInscriptionNumberId = null;
      },
    });
  }

  getStatutFinalInscription(candidature: Candidature): string {
    const status = this.normalizeStatus(candidature.statut_inscription || candidature.statut);

    if (['inscrit', 'valide', 'confirme'].includes(status)) {
      return 'Inscrit';
    }

    if (['en_attente_verification', 'paiement_soumis', 'soumis'].includes(status)) {
      return 'En attente de vérification';
    }

    if (['inscription_saisie'].includes(status)) {
      return 'Inscription saisie';
    }

    if (['rejete', 'rejetee', 'non_admis'].includes(status)) {
      return 'Rejetée (Délai dépassé)';
    }

    return 'Sélectionné';
  }

  getStatutFinalInscriptionClass(candidature: Candidature): string {
    const label = this.getStatutFinalInscription(candidature);
    if (label === 'Inscrit') return 'badge-success';
    if (label.startsWith('Rejetée')) return 'badge-danger';
    if (label === 'En attente de vérification') return 'badge-warning';
    return 'badge-info';
  }

  // ── Stepper d'inscription dynamique (reflète statut_inscription) ──────────
  /** Étape courante (1..4) d'après le statut d'inscription représentatif. */
  get inscriptionStepIndex(): number {
    const repr =
      this.selectedCandidatureForInscription ||
      this.admittedCandidatures.find((c) =>
        ['inscrit', 'en_attente_verification', 'inscription_saisie'].includes(
          this.normalizeStatus(c.statut_inscription || ''),
        ),
      ) ||
      this.admittedCandidatures[0];

    const statut = this.normalizeStatus(repr?.statut_inscription || '');
    switch (statut) {
      case 'inscrit':
        return 4;
      case 'en_attente_verification':
        return 3;
      case 'inscription_saisie':
        return 2;
      default:
        return 1; // selectionne / défaut
    }
  }

  /** Classe d'une étape du stepper : 'insc-step--done' | 'insc-step--active' | ''. */
  getInscriptionStepClass(step: number): string {
    const current = this.inscriptionStepIndex;
    if (step < current) return 'insc-step--done';
    if (step === current) return 'insc-step--active';
    return '';
  }

  /** Classe d'un connecteur (entre l'étape `step` et la suivante). */
  getInscriptionConnectorClass(step: number): string {
    return step < this.inscriptionStepIndex ? 'insc-step-connector--done' : '';
  }

  hasAttestationPaiement(candidature: Candidature): boolean {
    return !!candidature.attestation_paiement_url || this.isFicheInscriptionDeposee(candidature);
  }

  openAttestationPaiement(candidature: Candidature): void {
    const url = candidature.attestation_paiement_url || '/assets/docs/sample.pdf';
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  toggleInscriptionActionMenu(candidatureId: number): void {
    this.openInscriptionActionMenuId =
      this.openInscriptionActionMenuId === candidatureId ? null : candidatureId;
  }

  closeInscriptionActionMenu(): void {
    this.openInscriptionActionMenuId = null;
  }

  voirDossierCompletInscription(candidature: Candidature): void {
    this.closeInscriptionActionMenu();
    this.accederAuDossier(candidature);
  }

  isInscriptionResponsableSpace(): boolean {
    return String(this.currentUser?.role || '')
      .toLowerCase()
      .includes('responsable');
  }

  canValidateInscription(candidature: Candidature): boolean {
    const statut = this.normalizeStatus(candidature.statut_inscription || candidature.statut);
    return (
      this.isInscriptionResponsableSpace() && !['inscrit', 'rejete', 'rejetee'].includes(statut)
    );
  }

  validateInscription(candidature: Candidature): void {
    if (!this.canValidateInscription(candidature)) {
      return;
    }

    const confirmed = window.confirm(
      "Voulez-vous valider définitivement l'inscription administrative de ce candidat ?",
    );

    if (!confirmed) {
      return;
    }

    candidature.statut_inscription = 'inscrit';
    this.toastService.show('Inscription validée avec succès.', 'success');
  }

  get admittedCandidatures(): Candidature[] {
    return [...this.mesCandidatures]
      .filter((candidature) => this.isAdmitted(candidature))
      .sort((a, b) => a.numero.localeCompare(b.numero));
  }

  getCandidatureStatusStepper(_candidature: Candidature): string[] {
    return ['Reçu', 'Vérifié', 'Admis'];
  }

  getCandidatureStatusIndex(candidature: Candidature): number {
    const status = (candidature.statut || '').toLowerCase();

    if (['selectionne', 'inscrit', 'valide', 'traitee'].includes(status)) {
      return 2;
    }

    if (
      [
        'preselectionne',
        'sous_examen',
        'dossier_depose',
        'paiement_soumis',
        'rejete',
        'non_admis',
        'non_preselectionne',
      ].includes(status) ||
      candidature.dossier_valide === true
    ) {
      return 1;
    }

    return 0;
  }

  getStatusBadgeClass(statut?: string): string {
    const value = (statut || '').toLowerCase();

    if (this.isValidatedStatus(value)) {
      return 'chip-success';
    }

    if (this.isRejectedStatus(value)) {
      return 'chip-danger';
    }

    if (['preselectionne', 'sous_examen', 'soumis'].includes(value)) {
      return 'chip-info';
    }

    return 'chip-warning';
  }

  private isValidatedStatus(status: string): boolean {
    return ['selectionne', 'inscrit', 'valide', 'traitee'].includes(status);
  }

  private isRejectedStatus(status: string): boolean {
    return ['rejete', 'non_admis', 'non_preselectionne'].includes(status);
  }

  private isValidatedCandidature(candidature: Candidature): boolean {
    return this.isValidatedStatus((candidature.statut || '').toLowerCase());
  }

  private isPendingCandidature(candidature: Candidature): boolean {
    const status = (candidature.statut || '').toLowerCase();
    return (
      [
        'en_attente',
        'soumis',
        'sous_examen',
        'preselectionne',
        'dossier_depose',
        'paiement_soumis',
      ].includes(status) ||
      (!this.isValidatedCandidature(candidature) && !this.isRejectedStatus(status))
    );
  }

  isCycleIngenieur(candidature: Candidature): boolean {
    const nom = (candidature.master_nom || '').toLowerCase();
    return nom.includes('ingénieur') || nom.includes('ingenieur');
  }

  workflowSteps(candidature: Candidature): Array<{ key: string; label: string; done: boolean }> {
    const rawSubmitted = candidature.statut === 'soumis' || !!candidature.date_soumission;
    const rawPreselected = ['sous_examen', 'preselectionne', 'selectionne', 'inscrit'].includes(
      candidature.statut,
    );
    const rawDossierDone =
      !!candidature.dossier_depose ||
      ['dossier_depose', 'selectionne', 'inscrit'].includes(candidature.statut);
    const rawSelected = ['selectionne', 'inscrit'].includes(candidature.statut);
    const rawConfirmed =
      candidature.statut_inscription === 'valide' || candidature.statut === 'inscrit';

    const submitted = rawSubmitted;
    const preselected = submitted && rawPreselected;
    const dossierDone = preselected && rawDossierDone;
    const selected = dossierDone && rawSelected;
    const confirmed = selected && rawConfirmed;

    return [
      { key: 'preinscription', label: 'Préinscription', done: submitted },
      { key: 'preselection', label: 'Présélection', done: preselected },
      { key: 'depot_dossier', label: 'Dépôt de dossier', done: dossierDone },
      { key: 'selection', label: 'Sélection de candidature', done: selected },
      { key: 'confirmation', label: 'Confirmation inscription en ligne', done: confirmed },
    ];
  }

  workflowTimeline(candidature: Candidature): WorkflowStage[] {
    const statut = (candidature.statut || '').toLowerCase();
    const statutInscription = (candidature.statut_inscription || '').toLowerCase();
    const motifRejet = (candidature.motif_rejet || '').toLowerCase();

    const hasDossier =
      !!candidature.dossier_depose ||
      ['dossier_depose', 'en_attente', 'selectionne', 'inscrit'].includes(statut);
    const hasPreselection =
      [
        'preselectionne',
        'non_preselectionne',
        'non_preselectionnee',
        'en_attente_dossier',
        'dossier_non_depose',
        'dossier_depose',
        'en_attente',
        'en_attente_selection',
        'selectionne',
        'inscrit',
      ].includes(statut) || hasDossier;

    const isRejected = ['rejete', 'rejetee'].includes(statut);
    const isNonAdmis =
      ['non_admis', 'non_admise'].includes(statut) || motifRejet.includes('non admis');
    const isSelected = ['selectionne', 'inscrit'].includes(statut);
    const isSelectionWaiting = ['en_attente', 'en_attente_selection'].includes(statut);
    const inscriptionConfirmed = statut === 'inscrit' || statutInscription === 'valide';
    const inscriptionNotConfirmed = [
      'non_confirme',
      'non_confirmee',
      'non confirme',
      'non confirmee',
      'rejete',
      'rejetee',
      'echec',
      'refuse',
    ].includes(statutInscription);
    const paymentOrInscriptionIssue =
      motifRejet.includes('paiement') || motifRejet.includes('inscription');
    const wasSelectedBeforeRejection =
      isRejected && hasDossier && (inscriptionNotConfirmed || paymentOrInscriptionIssue);
    const inscriptionPending = isSelected && !inscriptionConfirmed;

    if (
      ['non_preselectionne', 'non_preselectionnee'].includes(statut) ||
      (isRejected && !hasPreselection)
    ) {
      return [
        { label: 'Préinscrit', state: 'done' },
        { label: 'Non présélectionné', state: 'rejected' },
      ];
    }

    if (
      statut === 'dossier_non_depose' ||
      (isRejected && !hasDossier && motifRejet.includes('dossier'))
    ) {
      return [
        { label: 'Préinscrit', state: 'done' },
        { label: 'Présélectionné', state: 'done' },
        { label: 'Dossier de candidature non déposé', state: 'rejected' },
        { label: 'Candidature rejetée', state: 'rejected' },
      ];
    }

    if (statut === 'soumis') {
      return [
        { label: 'Préinscrit', state: 'done' },
        { label: 'Présélectionné', state: 'pending' },
      ];
    }

    if (statut === 'sous_examen') {
      return [
        { label: 'Préinscrit', state: 'done' },
        { label: 'Présélectionné', state: 'current', hint: 'En cours de vérification' },
      ];
    }

    const steps: WorkflowStage[] = [
      { label: 'Préinscrit', state: 'done' },
      { label: 'Présélectionné', state: hasPreselection ? 'done' : 'pending' },
      {
        label: 'Dossier de candidature déposé',
        state: hasDossier ? 'done' : hasPreselection ? 'current' : 'pending',
      },
      {
        label: isSelectionWaiting
          ? 'Candidature sélectionnée (en attente)'
          : 'Candidature sélectionnée',
        state: isSelected
          ? 'done'
          : isSelectionWaiting
            ? 'current'
            : hasDossier
              ? 'current'
              : 'pending',
        hint:
          (isSelected || isSelectionWaiting) && !inscriptionConfirmed
            ? "En attente de confirmation d'inscription"
            : undefined,
      },
    ];

    if (inscriptionConfirmed) {
      steps.push({ label: 'Inscription en ligne confirmée', state: 'done' });
      return steps;
    }

    if (isNonAdmis) {
      steps.push({ label: 'Non admis', state: 'rejected' });
      return steps;
    }

    if (isRejected) {
      if (
        (hasPreselection && hasDossier && (inscriptionNotConfirmed || paymentOrInscriptionIssue)) ||
        (isSelected && !inscriptionConfirmed)
      ) {
        steps.push({ label: 'Inscription en ligne non confirmée', state: 'rejected' });
      }
      steps.push({ label: 'Candidature rejetée', state: 'rejected' });
      return steps;
    }

    if (inscriptionPending) {
      steps.push({ label: 'Inscription en ligne non confirmée', state: 'current' });
    }

    return steps;
  }

  canAccessInscriptionEtape(candidature: Candidature): boolean {
    const statut = this.normalizeStatus(candidature.statut);
    const etat = this.normalizeStatus(candidature.etat_candidature);
    return (
      ['selectionne', 'inscrit'].includes(statut) ||
      etat.includes('selectionne') ||
      etat.includes('admis')
    );
  }

  isWithinInscriptionDeadline(candidature: Candidature): boolean {
    if (!candidature.date_limite_modification) {
      return true;
    }

    const deadline = new Date(candidature.date_limite_modification).getTime();
    if (Number.isNaN(deadline)) {
      return true;
    }

    return deadline >= Date.now();
  }

  workflowProcessGuide(): Array<{ title: string; description: string }> {
    return [
      {
        title: 'Préinscription',
        description: 'Création du compte candidat et soumission de la candidature.',
      },
      {
        title: 'Présélection',
        description: 'Classement préliminaire automatique selon votre dossier académique.',
      },
      {
        title: 'Dépôt de dossier',
        description: 'Téléversement et contrôle des pièces justificatives demandées.',
      },
      {
        title: 'Sélection de candidature',
        description: 'Étude finale par la commission et publication du résultat.',
      },
      {
        title: 'Inscription en ligne',
        description: 'Validation finale après paiement sur inscription.tn.',
      },
    ];
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.openActionMenuId = null;
  }

  toggleActionMenu(candidatureId: number): void {
    this.openActionMenuId = this.openActionMenuId === candidatureId ? null : candidatureId;
  }

  closeActionMenu(): void {
    this.openActionMenuId = null;
  }

  consulterCandidature(candidature: Candidature): void {
    this.closeActionMenu();
    this.router.navigate(['/consultation-dossier', candidature.id]);
  }

  ouvrirDepotDossier(candidature: Candidature): void {
    if (!this.actionPermissions.depotDossier) {
      this.notifyActionBlocked("Dépôt de dossier désactivé par l'administration.");
      return;
    }

    this.closeActionMenu();
    this.accederAuDossier(candidature);
  }

  ouvrirInscriptionDepuisCandidature(candidature: Candidature): void {
    if (!this.actionPermissions.consultationCandidature) {
      this.notifyActionBlocked("Consultation candidature désactivée par l'administration.");
      return;
    }

    if (!this.canAccessInscriptionEtape(candidature)) {
      this.notifyActionBlocked(
        "Vous devez terminer les étapes précédentes (présélection, dépôt dossier, sélection) avant l'inscription en ligne.",
      );
      return;
    }

    if (!this.isWithinInscriptionDeadline(candidature)) {
      this.notifyActionBlocked("Le délai d'inscription est dépassé pour cette candidature.");
      return;
    }

    this.closeActionMenu();
    this.selectedCandidatureForInscription = candidature;
    this.switchView('inscription');
  }

  canModifyCandidature(candidature: Candidature): boolean {
    // ► Statuts permettant la modification/dépôt du dossier
    const editableStatuts = [
      'soumis',
      'preselectionne',
      'en_attente_dossier',
      'dossier_depose',
    ];
    if (!editableStatuts.includes(candidature.statut)) {
      return false;
    }
    // Pour 'preselectionne' : autoriser indépendamment de la deadline
    if (candidature.statut === 'preselectionne' || candidature.statut === 'en_attente_dossier') {
      return true;
    }
    // Pour 'soumis' : check classique avec deadline
    if (candidature.peut_modifier !== true) {
      return false;
    }
    if (!candidature.date_limite_modification) {
      return false;
    }
    return new Date(candidature.date_limite_modification).getTime() > this.countdownNow;
  }

  canShowModifyButton(candidature: Candidature): boolean {
    return this.actionPermissions.consultationCandidature && candidature.statut === 'soumis';
  }

  getModificationCountdown(candidature: Candidature): string {
    if (!candidature.date_limite_modification) {
      return 'Délai indisponible';
    }

    const remainingMs =
      new Date(candidature.date_limite_modification).getTime() - this.countdownNow;
    if (remainingMs <= 0) {
      return 'Expiré';
    }

    const totalMinutes = Math.floor(remainingMs / 60000);
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
      return `${days}j ${hours}h ${minutes}min`;
    }

    return `${hours}h ${minutes}min`;
  }

  modifierCandidature(candidature: Candidature): void {
    if (!this.actionPermissions.consultationCandidature) {
      this.notifyActionBlocked("Modification candidature désactivée par l'administration.");
      return;
    }

    if (!this.canModifyCandidature(candidature)) {
      this.notifyActionBlocked(
        'Cette candidature ne peut plus être modifiée (délai dépassé ou statut non autorisé).',
      );
      return;
    }

    this.closeActionMenu();
    this.router.navigate(['/candidat/candidature/modifier'], {
      queryParams: { candidatureId: candidature.id },
    });
  }

  fermerModalModification(): void {
    this.showEditCandidatureModal = false;
    this.selectedCandidatureForEdit = null;
    this.editChoixPriorite = 1;
  }

  confirmerModificationCandidature(): void {
    if (!this.selectedCandidatureForEdit) {
      return;
    }

    const priorite = Number(this.editChoixPriorite);
    if (!Number.isInteger(priorite) || priorite < 1 || priorite > 5) {
      this.showAlertMessage('❌ Priorité invalide. Veuillez entrer un entier entre 1 et 5.');
      return;
    }

    const candidature = this.selectedCandidatureForEdit;
    const token = this.authService.getAccessToken();

    this.http
      .put<Candidature>(
        `${this.candidatureApiBase}/${candidature.id}/modifier/`,
        { choix_priorite: priorite },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: () => {
          this.showAlertMessage('✅ Candidature modifiée avec succès.');
          this.fermerModalModification();
          this.loadMesCandidatures();
        },
        error: (error) => {
          console.error('Erreur modification candidature:', error);
          this.showAlertMessage(
            error?.error?.error || '❌ Erreur lors de la modification de la candidature.',
          );
        },
      });
  }

  ouvrirInscription(candidature: Candidature, fileInput: HTMLInputElement): void {
    if (!this.actionPermissions.consultationCandidature) {
      this.notifyActionBlocked("Inscription en ligne désactivée par l'administration.");
      return;
    }

    if (!this.canAccessInscriptionEtape(candidature)) {
      this.notifyActionBlocked("Cette candidature n'a pas encore atteint l'étape de sélection.");
      return;
    }

    if (!this.isWithinInscriptionDeadline(candidature)) {
      this.notifyActionBlocked("Le délai d'inscription est dépassé pour cette candidature.");
      return;
    }

    this.selectedCandidatureForInscription = candidature;
    fileInput.value = '';
    fileInput.click();
  }

  onFichierPaiementDirectSelected(event: Event, candidature: Candidature): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.showAlertMessage('❌ Fichier trop volumineux (max 5 Mo)');
      return;
    }

    const reference = prompt("Entrez la référence de la fiche d'inscription (inscription.tn):", '');
    if (!reference || !reference.trim()) {
      this.showAlertMessage("❌ Référence de la fiche d'inscription obligatoire");
      return;
    }

    this.soumettrePaiementDirect(candidature, file, reference.trim());
  }

  ouvrirDossierDepuisTable(numeroDossier: string): void {
    if (!this.actionPermissions.depotDossier) {
      this.notifyActionBlocked("Import dossier désactivé par l'administration.");
      return;
    }

    this.selectedDossierNumber = numeroDossier;
    this.syncDossierPreferenceFormFromSelection();
    this.switchView('mon-dossier', { preserveDossierSelection: true });
  }

  ouvrirRecapDossierDepuisCandidature(candidatureNumero: string): void {
    const numeroDossier = this.getDossierNumber(candidatureNumero);
    if (!numeroDossier) {
      this.showAlertMessage('Aucun dossier associé à cette candidature pour le moment.');
      return;
    }
    this.ouvrirDossierDepuisTable(numeroDossier);
  }

  resetSelectionDossier(): void {
    this.selectedDossierNumber = null;
    this.dossierPreferenceForm.numero_dossier_reserve_administration = '';
  }

  private initializeDossierPreferenceForm(): void {
    const firstName = this.profileData?.first_name || this.currentUser?.first_name || '';
    const lastName = this.profileData?.last_name || this.currentUser?.last_name || '';
    this.dossierPreferenceForm.nom_prenom = `${firstName} ${lastName}`.trim();
    this.dossierPreferenceForm.etablissement_origine =
      this.profileData?.etablissement_origine || this.dossierPreferenceForm.etablissement_origine;
    this.syncDossierPreferenceFormFromSelection();
  }

  private syncDossierPreferenceFormFromSelection(): void {
    this.dossierPreferenceForm.numero_dossier_reserve_administration =
      this.selectedDossierNumber || '';
  }

  voirDetails(candidature: Candidature | HistoriqueItem): void {
    this.selectedOffreDetail =
      this.offresInscription.find((offre) => offre.titre === candidature.master_nom) || null;
    this.currentView = 'offres-inscription';
  }

  ouvrirDetailOffre(offre: Offre): void {
    const code = this.getPreinscriptionDetailCode(offre);
    this.currentOffreDetailCode = code || 'generic';
    this.selectedOffreDetail = offre;
    this.showOffreDetailModal = true;
  }

  fermerDetailModal(): void {
    this.showOffreDetailModal = false;
    this.currentOffreDetailCode = null;
  }

  canOpenOffreDetail(offre: Offre): boolean {
    return !!this.getPreinscriptionDetailCode(offre);
  }

  fermerDetailOffre(): void {
    this.selectedOffreDetail = null;
  }

  private getPreinscriptionDetailCode(offre: Offre | null): string | null {
    const codeMap: Record<string, string> = {
      MPGL: 'mpgl', MPDS: 'mpds', MP3I: 'mp3i',
      MRGL: 'mrgl', MRMI: 'mrmi', ING_GL: 'ing_info_gl',
    };
    if (offre?.code && codeMap[offre.code]) return codeMap[offre.code];

    if (offre?.type === 'cycle_ingenieur') return 'ing_info_gl';

    const normalize = (value: string): string =>
      (value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const title = normalize(offre?.titre || '');
    const desc = normalize(offre?.description || '');
    const specialite = normalize(offre?.specialite || '');
    const haystack = `${title} ${desc} ${specialite}`;

    if (haystack.includes('science') && haystack.includes('donnee')) return 'mpds';
    if (haystack.includes('instrumentation') && haystack.includes('industri')) return 'mp3i';
    if (haystack.includes('micro') && haystack.includes('instrument')) return 'mrmi';
    if (haystack.includes('recherche') && haystack.includes('genie logiciel')) return 'mrgl';
    if (haystack.includes('ingenieur') && haystack.includes('microelectronique')) return 'ing_em';
    if (haystack.includes('ingenieur') && haystack.includes('electronique')) return 'ing_em';
    if (haystack.includes('genie logiciel') || haystack.includes('ingenierie logicielle'))
      return 'mpgl';

    return null;
  }

  get acceptedMastersForPreference(): Candidature[] {
    return this.mesCandidatures.filter((c) => ['selectionne', 'inscrit'].includes(c.statut));
  }

  shouldShowPreferenceForm(): boolean {
    if (this.isPreferenceFormDemoMode) {
      return true;
    }
    return !!this.selectedDossierNumber && this.acceptedMastersForPreference.length > 1;
  }

  getPreferenceMasterOptions(): Array<{ value: string; label: string }> {
    const allowedCodes = new Set(['mpgl', 'mrgl', 'mpds']);
    const options = this.offresInscription
      .map((offre) => ({ value: this.getPreinscriptionDetailCode(offre), label: offre.titre }))
      .filter(
        (item): item is { value: string; label: string } =>
          !!item.value && allowedCodes.has(item.value),
      );

    if (options.length > 0) {
      return options;
    }

    return [
      { value: 'mpgl', label: 'Mastère Professionnel en Génie logiciel(GL)' },
      { value: 'mrgl', label: 'Mastère Recherche en Génie logiciel(MRGL)' },
      { value: 'mpds', label: 'Mastère Professionnel en sciences de données(DS)' },
    ];
  }

  activerExemplePreferenceForm(): void {
    this.isPreferenceFormDemoMode = true;
    this.prefillPreferenceFormDemoValues();
  }

  desactiverExemplePreferenceForm(): void {
    this.isPreferenceFormDemoMode = false;
  }

  private prefillPreferenceFormDemoValues(): void {
    if (!this.selectedDossierNumber) {
      this.selectedDossierNumber =
        this.dossiersCandidature[0]?.numero_dossier ||
        this.dossierPreferenceForm.numero_dossier_reserve_administration;
    }

    this.syncDossierPreferenceFormFromSelection();

    const options = this.getPreferenceMasterOptions().map((opt) => opt.value);
    if (!this.dossierPreferenceForm.choix_1 && options[0]) {
      this.dossierPreferenceForm.choix_1 = options[0];
    }
    if (!this.dossierPreferenceForm.choix_2 && options[1]) {
      this.dossierPreferenceForm.choix_2 = options[1];
    }
    if (!this.dossierPreferenceForm.choix_3 && options[2]) {
      this.dossierPreferenceForm.choix_3 = options[2];
    }
  }

  submitDossierPreferenceForm(): void {
    if (!this.shouldShowPreferenceForm()) {
      this.notifyActionBlocked(
        'Le formulaire de choix apparaît seulement si plusieurs masters sont acceptés.',
      );
      return;
    }

    const dossier = this.dossiersCandidature.find(
      (item) => item.numero_dossier === this.selectedDossierNumber,
    );

    if (!dossier) {
      this.toastService.show('Dossier sélectionné introuvable.', 'warning');
      return;
    }

    const requiredValues = [
      this.dossierPreferenceForm.nom_prenom,
      this.dossierPreferenceForm.etablissement_origine,
      this.dossierPreferenceForm.diplome,
      this.dossierPreferenceForm.choix_1,
      this.dossierPreferenceForm.choix_2,
      this.dossierPreferenceForm.choix_3,
      this.dossierPreferenceForm.numero_dossier_reserve_administration,
    ];

    if (requiredValues.some((value) => !String(value || '').trim())) {
      this.toastService.show('Veuillez remplir tout le formulaire de choix.', 'warning');
      return;
    }

    const choiceValues = [
      this.dossierPreferenceForm.choix_1,
      this.dossierPreferenceForm.choix_2,
      this.dossierPreferenceForm.choix_3,
    ].map((value) => String(value).trim().toUpperCase());

    if (new Set(choiceValues).size !== choiceValues.length) {
      this.toastService.show('Les choix 1, 2 et 3 doivent être différents.', 'warning');
      return;
    }

    const token = this.authService.getAccessToken();
    const payload = {
      formulaire: {
        ...this.dossierPreferenceForm,
        choix_1: choiceValues[0],
        choix_2: choiceValues[1],
        choix_3: choiceValues[2],
        documents: this.documentsRequis.filter((doc) => doc.depose).map((doc) => doc.nom),
      },
    };

    this.http
      .post(`${this.candidatureApiBase}/${dossier.candidature_id}/deposer-dossier/`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: () => {
          this.toastService.show('✅ Formulaire de choix enregistré et dossier déposé.', 'success');
          this.loadMesCandidatures();
          this.loadMesDossiers();
        },
        error: (error) => {
          console.error('Erreur dépôt dossier avec choix:', error);
          this.toastService.show(
            error?.error?.error || '❌ Erreur lors du dépôt du dossier avec choix.',
            'error',
          );
        },
      });
  }

  getDetailRowsForOffre(offre: Offre): OffreDetailRow[] {
    const title = (offre?.titre || '').toLowerCase();

    if (title.includes('génie logiciel') || title.includes('genie logiciel')) {
      return [
        {
          capaciteAccueilleTotale: '35',
          etablissementOrigine: "Institut Supérieur de l'Informatique et des Mathématiques (ISIMM)",
          capaciteAccueille: '30',
          typeDiplome: 'Licence en Sciences de l' + 'Informatique',
          coefficients: 'Bac (40%), Licence (60%)',
          datesImportantes: 'Inscription sur le site web : www.isimm.rnu.tn/public/formulaires',
        },
        {
          capaciteAccueilleTotale: '35',
          etablissementOrigine: 'Autres établissements',
          capaciteAccueille: '05',
          typeDiplome:
            'Licence en Sciences de l' + 'Informatique ou en Informatique de Gestion (uniquement)',
          coefficients: 'Moyenne Générale > 12/20',
          datesImportantes:
            'Du jour de la publication de cet avis jusqu au 22 juillet 2025. Proclamation de la liste des étudiants présélectionnés : Le 28 juillet 2025. Dépôt des dossiers numériques : Du 28 juillet au 31 juillet 2025. Proclamation de la liste finale : Le 08 août 2025.',
        },
      ];
    }

    return [
      {
        capaciteAccueilleTotale: String(offre.places || 0),
        etablissementOrigine: 'ISIMM',
        capaciteAccueille: String(offre.places || 0),
        typeDiplome:
          offre.type === 'cycle_ingenieur' ? 'Cycle préparatoire / ingénieur' : 'Licence',
        coefficients: 'Standard ISIMM',
        datesImportantes: `Date limite : ${new Date(offre.date_limite).toLocaleDateString('fr-FR')}`,
      },
    ];
  }

  gererDossier(candidature: Candidature): void {
    if (candidature.dossier_depose) {
      this.showAlertMessage(`Modifier le dossier pour ${candidature.master_nom}`);
    } else {
      this.switchView('mon-dossier');
    }
  }

  nouvelleCandidature(): void {
    if (!this.actionPermissions.preinscription) {
      this.notifyActionBlocked("Préinscription désactivée par l'administration.");
      return;
    }

    this.switchView('offres-inscription');
  }

  deposerDocument(doc: Document): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png';

    input.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          this.showAlertMessage('❌ Fichier trop volumineux (max 5 Mo)');
          return;
        }

        const token = this.authService.getAccessToken();
        const formData = new FormData();
        formData.append('document', file);
        formData.append('type', doc.nom);

        this.http
          .post(`${this.serviceApiBase}/documents/upload/`, formData, {
            headers: { Authorization: `Bearer ${token}` },
          })
          .subscribe({
            next: () => {
              doc.depose = true;
              doc.date_depot = new Date().toISOString().split('T')[0];
              this.showAlertMessage('✅ Document déposé avec succès !');
            },
            error: (error) => {
              console.error('Erreur:', error);
              this.showAlertMessage('❌ Erreur lors du dépôt');
            },
          });
      }
    };

    input.click();
  }

  voirDocument(doc: Document): void {
    this.showAlertMessage(`Voir le document : ${doc.nom}`);
  }

  soumettrePaiementDirect(
    candidature: Candidature,
    fichierPaiement: File,
    reference: string,
  ): void {
    if (!this.canAccessInscriptionEtape(candidature)) {
      this.notifyActionBlocked(
        "Paiement non autorisé: la candidature doit d'abord être sélectionnée.",
      );
      return;
    }

    if (!this.isWithinInscriptionDeadline(candidature)) {
      this.notifyActionBlocked("Paiement refusé: le délai d'inscription est dépassé.");
      return;
    }

    const token = this.authService.getAccessToken();
    const formData = new FormData();

    formData.append('candidature_id', candidature.id.toString());
    formData.append('reference_paiement', reference);
    formData.append('montant', '500');
    formData.append('fichier_paiement', fichierPaiement);

    this.http
      .post(`${this.serviceApiBase}/inscriptions/soumettre-paiement/`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: () => {
          this.showAlertMessage("✅ Fiche d'inscription déposée avec succès !");
          candidature.statut_inscription = 'paiement_soumis';
        },
        error: (error) => {
          console.error('Erreur:', error);
          this.showAlertMessage("❌ Erreur lors du dépôt de la fiche d'inscription");
        },
      });
  }

  getObjetLabel(objet: string): string {
    const labels: any = {
      score: 'Score incorrect',
      statut: 'Statut non mis à jour',
      dossier: 'Problème de dossier',
      paiement: 'Problème de paiement',
      autre: 'Autre',
    };
    return labels[objet] || objet;
  }

  getStatutReclamationLabel(statut: string): string {
    const labels: any = {
      en_cours: 'En cours',
      en_attente: 'En attente',
      traitee: 'Traitée',
    };
    return labels[statut] || statut;
  }

  ouvrirModalReclamation(): void {
    if (!this.actionPermissions.deposerReclamation) {
      this.notifyActionBlocked("Dépôt de réclamation désactivé par l'administration.");
      return;
    }

    this.nouvelleReclamation = {
      master_id: '',
      objet: '',
      motif: '',
    };
    this.showModalReclamation = true;
  }

  fermerModalReclamation(): void {
    this.showModalReclamation = false;
  }

  soumettreReclamation(): void {
    if (!this.actionPermissions.deposerReclamation) {
      this.notifyActionBlocked("Dépôt de réclamation désactivé par l'administration.");
      return;
    }

    if (
      !this.nouvelleReclamation.master_id ||
      !this.nouvelleReclamation.objet ||
      !this.nouvelleReclamation.motif
    ) {
      this.showAlertMessage('❌ Veuillez remplir tous les champs');
      return;
    }

    const token = this.authService.getAccessToken();

    // MOD v5 §C — mêmes champs/contrat que la page éprouvée (FormData) pour garantir
    // que la création fonctionne exactement comme avant.
    const payload = new FormData();
    payload.append('master_id', String(Number(this.nouvelleReclamation.master_id)));
    payload.append('objet', this.nouvelleReclamation.objet);
    payload.append('motif', String(this.nouvelleReclamation.motif || '').trim());

    this.http
      .post(`${this.serviceApiBase}/reclamations/creer/`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (response: any) => {
          this.showAlertMessage('✅ Réclamation soumise avec succès !');
          this.reclamations.unshift({
            id: response.id ?? Date.now(),
            identifiant: response.identifiant ?? `RECL-${new Date().getFullYear()}-${Date.now()}`,
            objet: response.objet ?? this.nouvelleReclamation.objet,
            master_nom: response.master_nom ?? 'Master',
            master_id: response.master_id ?? Number(this.nouvelleReclamation.master_id),
            motif: response.motif ?? this.nouvelleReclamation.motif,
            date: response.date ?? new Date().toISOString(),
            statut: response.statut ?? 'en_cours',
            reponse: response.reponse ?? null,
          });
          this.fermerModalReclamation();
        },
        error: (error) => {
          console.error('Erreur:', error);
          this.showAlertMessage('❌ Erreur lors de la soumission');
        },
      });
  }

  voirReclamation(reclamation: Reclamation): void {
    this.dialog.open(ReclamationDetailDialogComponent, {
      width: '640px',
      maxHeight: '80vh',
      data: reclamation,
    });
  }

  setProfileTab(tab: ProfileTab): void {
    this.activeProfileTab = tab;
  }

  enableProfileEdit(): void {
    this.isProfileEditMode = true;
  }

  cancelProfileEdit(): void {
    this.isProfileEditMode = false;
    this.profileData = { ...this.currentUser };
    this.avatarPreview = this.currentUser?.avatar_url || null;
    this.avatarFile = null;
  }

  updateProfile(): void {
    const token = this.authService.getAccessToken();

    const formData = new FormData();
    formData.append('first_name', this.profileData.first_name || '');
    formData.append('last_name', this.profileData.last_name || '');
    formData.append('phone', this.profileData.phone || '');
    formData.append('address', this.profileData.address || '');
    formData.append('diplome_last', this.profileData.diplome_last || '');
    formData.append('etablissement', this.profileData.etablissement || '');
    formData.append('annee_bac', this.profileData.annee_bac || '');
    formData.append('moyenne_generale', this.profileData.moyenne_generale || '');

    if (this.avatarFile) {
      formData.append('avatar', this.avatarFile);
    }

    this.http
      .put('http://localhost:8001/api/auth/profile/update/', formData, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (response: any) => {
          this.showAlertMessage('✅ Profil mis à jour avec succès !');
          this.currentUser = { ...this.currentUser, ...this.profileData, ...response };
          this.profileData = { ...this.currentUser };
          this.avatarPreview = response?.avatar_url || this.avatarPreview;
          this.avatarFile = null;
          this.isProfileEditMode = false;
        },
        error: (error) => {
          console.error('Erreur:', error);
          this.showAlertMessage('❌ Erreur lors de la mise à jour du profil');
        },
      });
  }

  changePassword(): void {
    if (this.passwordForm.new_password !== this.passwordForm.confirm_password) {
      this.showAlertMessage('❌ Les mots de passe ne correspondent pas');
      return;
    }

    if (this.passwordForm.new_password.length < 8) {
      this.showAlertMessage('❌ Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    const token = this.authService.getAccessToken();

    this.http
      .post(
        'http://localhost:8001/api/auth/change-password/',
        {
          current_password: this.passwordForm.current_password,
          new_password: this.passwordForm.new_password,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: () => {
          this.showAlertMessage('✅ Mot de passe modifié avec succès !');
          this.passwordForm = {
            current_password: '',
            new_password: '',
            confirm_password: '',
          };
        },
        error: (error) => {
          console.error('Erreur:', error);
          this.showAlertMessage('❌ Erreur lors du changement de mot de passe');
        },
      });
  }

  toggleTwoFactor(): void {
    const token = this.authService.getAccessToken();

    this.http
      .post(
        'http://localhost:8001/api/auth/profile/two-factor/',
        { enabled: !this.twoFactorEnabled },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: (response: any) => {
          this.twoFactorEnabled = !!response?.two_factor_enabled;
          this.profileData.two_factor_enabled = this.twoFactorEnabled;
          this.currentUser = { ...this.currentUser, two_factor_enabled: this.twoFactorEnabled };
          this.showAlertMessage(
            this.twoFactorEnabled
              ? '✅ Authentification à deux facteurs activée'
              : '✅ Authentification à deux facteurs désactivée',
          );
        },
        error: (error) => {
          console.error('Erreur 2FA:', error);
          this.showAlertMessage('❌ Impossible de modifier la double authentification');
        },
      });
  }

  changePhoto(): void {
    const el = document.getElementById('avatarFileInput') as HTMLInputElement | null;
    if (el) {
      el.click();
    }
  }

  onAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input || !input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.avatarFile = file;
    this.avatarPreview = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      this.avatarPreview = String(ev.target?.result || this.avatarPreview || null);
      // Optionally update profileData with avatar preview/base64 or send to backend on save
    };
    reader.readAsDataURL(file);
  }

  // ── Drag & Drop enrichi ──
  onDragOver(event: DragEvent, docId?: number): void {
    event.preventDefault();
    event.stopPropagation();
    if (docId !== undefined) {
      this.dragOverDocId = docId;
    }
  }

  onDragLeave(): void {
    this.dragOverDocId = null;
  }

  onDocumentDrop(event: DragEvent, doc: Document): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverDocId = null;

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];
    if (!this.isAllowedUploadFile(file)) {
      return;
    }

    this.selectedDocumentFiles[doc.id] = file;
  }

  // ── Aperçu document ──
  ouvrirApercu(doc: Document): void {
    this.apercuDoc = doc;
  }

  isPdf(url?: string): boolean {
    return !!url && /\.pdf(?:$|[?#])/i.test(url);
  }

  getApercuPdfUrl(url?: string): SafeResourceUrl | null {
    if (!url) {
      return null;
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  fermerApercu(): void {
    this.apercuDoc = null;
  }

  telechargerDocument(doc: Document): void {
    if (doc.fichier_url) {
      window.open(doc.fichier_url, '_blank');
    }
  }

  getDocumentStatusLabel(doc: Document): 'Validé' | 'Erreur' | 'Manquant' {
    if (this.uploadErrors[doc.id]) {
      return 'Erreur';
    }
    return doc.depose ? 'Validé' : 'Manquant';
  }

  getDocumentStatusIcon(doc: Document): string {
    const status = this.getDocumentStatusLabel(doc);
    if (status === 'Validé') {
      return 'fa-check-circle';
    }
    if (status === 'Erreur') {
      return 'fa-exclamation-circle';
    }
    return 'fa-clock';
  }

  // ── Finalisation dossier ── (Sprint 4 — Correction 1)
  finaliserDossier(): void {
    if (this.completionPercent < 100) {
      this.toastService.show(
        'Veuillez déposer tous les documents obligatoires avant de finaliser.',
        'warning',
      );
      return;
    }

    // Récupérer la candidature active : soit celle sélectionnée via le sélecteur de vœux,
    // soit la première éligible au dépôt.
    const candidature =
      this.candidatureDepotActive
      ?? this.candidaturesEligiblesDepot[0]
      ?? this.mesCandidatures.find((c) =>
          this.STATUTS_DEPOT_AUTORISE.includes((c.statut || '').toLowerCase()),
        );

    if (!candidature) {
      this.toastService.show(
        'Aucune candidature éligible au dépôt n\'a été trouvée.',
        'error',
      );
      return;
    }

    this.finalisationLoading = true;
    const token = this.authService.getAccessToken();
    this.http
      .post<{ message: string; statut: string; candidature_id: number }>(
        `${environment.candidatureServiceUrl}/candidatures/${candidature.id}/finaliser-dossier/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: (res) => {
          this.finalisationLoading = false;
          // Mise à jour locale du statut pour rafraîchir l'UI immédiatement
          candidature.statut = res.statut || 'dossier_depose';
          this.toastService.show(
            res.message
              || 'Dossier finalisé avec succès ! Votre dossier est en cours d\'examen.',
            'success',
          );
          // Recharger les listes pour refléter le nouveau statut
          this.loadMesCandidatures();
          this.loadMesDossiers();
        },
        error: (err) => {
          this.finalisationLoading = false;
          const msg =
            err?.error?.error
            || err?.error?.message
            || 'Erreur lors de la finalisation du dossier.';
          this.toastService.show(msg, 'error');
        },
      });
  }

  private isAllowedUploadFile(file: File): boolean {
    const allowedExtensions = ['pdf'];
    const extension = (file.name.split('.').pop() || '').toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      this.showAlertMessage('❌ Format non supporté. Utilisez uniquement le format PDF.');
      return false;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.showAlertMessage('❌ Fichier trop volumineux (max 5 Mo)');
      return false;
    }

    return true;
  }

  onDocumentFileSelected(event: Event, document: Document): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (!this.isAllowedUploadFile(file)) {
      input.value = '';
      this.uploadErrors[document.id] = 'Format invalide ou taille > 5 Mo.';
      return;
    }

    this.uploadErrors[document.id] = '';
    this.selectedDocumentFiles[document.id] = file;
  }

  removeDocumentFile(documentId: number): void {
    this.selectedDocumentFiles[documentId] = null;
  }

  get selectedDocumentsCount(): number {
    return this.documentsRequis.filter((doc) => !!this.selectedDocumentFiles[doc.id]).length;
  }

  uploadAllSelectedDocuments(): void {
    const docsToUpload = this.documentsRequis.filter((doc) => !!this.selectedDocumentFiles[doc.id]);

    if (!docsToUpload.length) {
      this.toastService.show('Aucun document sélectionné.', 'warning');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const totalCount = docsToUpload.length;

    docsToUpload.forEach((doc) => {
      this.uploadDocumentFile(
        doc,
        () => {
          successCount++;
          if (successCount + errorCount === totalCount) {
            if (errorCount === 0) {
              this.toastService.show(
                `✅ ${successCount} document${successCount > 1 ? 's' : ''} envoyé${successCount > 1 ? 's' : ''} avec succès`,
                'success',
                3500,
              );
            } else {
              this.toastService.show(
                `⚠️ ${successCount} envoyé${successCount > 1 ? 's' : ''}, ${errorCount} échoué${errorCount > 1 ? 's' : ''}`,
                'warning',
                3500,
              );
            }
          }
        },
        () => {
          errorCount++;
          if (successCount + errorCount === totalCount) {
            if (errorCount === 0) {
              this.toastService.show(
                `✅ ${successCount} document${successCount > 1 ? 's' : ''} envoyé${successCount > 1 ? 's' : ''} avec succès`,
                'success',
                3500,
              );
            } else {
              this.toastService.show(
                `⚠️ ${successCount} envoyé${successCount > 1 ? 's' : ''}, ${errorCount} échoué${errorCount > 1 ? 's' : ''}`,
                'warning',
                3500,
              );
            }
          }
        },
      );
    });
  }

  uploadDocumentFile(document: Document, onSuccess?: () => void, onError?: () => void): void {
    const selectedFile = this.selectedDocumentFiles[document.id];
    if (!selectedFile) {
      return;
    }

    const token = this.authService.getAccessToken();
    const formData = new FormData();
    formData.append('fichier', selectedFile);
    formData.append('document_type', document.nom);

    if (this.selectedDossierNumber) {
      formData.append('numero_dossier', this.selectedDossierNumber);
    }

    this.http
      .post(`${this.candidatureApiBase}/upload-fichier/`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: () => {
          const now = new Date().toLocaleDateString('fr-FR');

          document.depose = true;
          document.date_depot = now;

          this.fichiersHistorique.unshift({
            id: Date.now(),
            nom: selectedFile.name,
            date: now,
          });

          this.selectedDocumentFiles[document.id] = null;
          this.uploadErrors[document.id] = '';
          if (onSuccess) onSuccess();
        },
        error: (error) => {
          console.error('Erreur:', error);
          this.uploadErrors[document.id] = "Erreur d'envoi. Réessayez.";
          if (onError) onError();
        },
      });
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.fichierInscription = files[0];
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        this.showAlertMessage('❌ Fichier trop volumineux (max 5 Mo)');
        return;
      }
      this.fichierInscription = file;
    }
  }

  removeFichier(): void {
    this.fichierInscription = null;
  }

  uploadFichier(): void {
    if (!this.fichierInscription) return;

    const token = this.authService.getAccessToken();
    const formData = new FormData();
    formData.append('fichier', this.fichierInscription);

    this.http
      .post(`${this.candidatureApiBase}/upload-fichier/`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: () => {
          this.showAlertMessage('✅ Fichier envoyé avec succès !');
          this.fichiersHistorique.unshift({
            id: Date.now(),
            nom: this.fichierInscription!.name,
            date: new Date().toLocaleDateString('fr-FR'),
          });
          this.fichierInscription = null;
        },
        error: (error) => {
          console.error('Erreur:', error);
          this.showAlertMessage("❌ Erreur lors de l'envoi du fichier");
        },
      });
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '';
    return bytes < 1024 * 1024
      ? (bytes / 1024).toFixed(1) + ' Ko'
      : (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  }

  voirFichier(fichier: FichierHistorique): void {
    this.showAlertMessage(`Voir le fichier : ${fichier.nom}`);
  }

  telechargerFichier(fichier: FichierHistorique): void {
    this.showAlertMessage(`Télécharger le fichier : ${fichier.nom}`);
  }

  exportInscriptionsEnLigne(): void {
    if (!this.mesCandidatures.length) {
      this.showAlertMessage('❌ Aucune candidature à exporter');
      return;
    }

    const rows: ExportRow[] = this.mesCandidatures.map((c) => ({
      'N° Candidature': c.numero,
      Formation: c.master_nom,
      'Statut inscription': this.getStatutLabel(c.statut_inscription || 'en_attente'),
      'Statut candidature': this.getStatutLabel(c.statut),
      'Date soumission': c.date_soumission
        ? new Date(c.date_soumission).toLocaleDateString('fr-FR')
        : '-',
      'Année universitaire': c.annee_universitaire || this.currentAcademicYear(),
    }));

    this.exportRows(
      rows,
      this.inscriptionExportFormat,
      'inscriptions-en-ligne',
      'Inscriptions en ligne',
    );
  }

  private exportRows(
    rows: ExportRow[],
    format: ExportFormat,
    baseFileName: string,
    tableTitle: string,
  ): void {
    if (format === 'csv') {
      this.exportRowsToCSV(rows, baseFileName);
      return;
    }

    if (format === 'json') {
      this.exportRowsToJSON(rows, baseFileName);
      return;
    }

    if (format === 'xlsx') {
      this.exportRowsToXLSX(rows, baseFileName, tableTitle);
      return;
    }

    this.exportRowsToPdf(rows, baseFileName, tableTitle);
  }

  private exportRowsToCSV(rows: ExportRow[], baseFileName: string): void {
    if (!rows.length) {
      return;
    }

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    this.downloadFile(blob, baseFileName, 'csv');
  }

  private exportRowsToJSON(rows: ExportRow[], baseFileName: string): void {
    if (!rows.length) {
      return;
    }

    const jsonContent = JSON.stringify(rows, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    this.downloadFile(blob, baseFileName, 'json');
  }

  private exportRowsToXLSX(rows: ExportRow[], baseFileName: string, tableTitle: string): void {
    if (!rows.length) {
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, tableTitle.substring(0, 31));
    XLSX.writeFile(workbook, this.buildExportFileName(baseFileName, 'xlsx'));
  }

  private exportRowsToPdf(rows: ExportRow[], baseFileName: string, tableTitle: string): void {
    if (!rows.length) {
      return;
    }

    const doc = new jsPDF('l', 'mm', 'a4');
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(14);
    doc.text(tableTitle, pageWidth / 2, 14, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, 21, {
      align: 'center',
    });

    const headers = Object.keys(rows[0]);
    const body = rows.map((row) => headers.map((h) => row[h] ?? ''));

    autoTable(doc, {
      head: [headers],
      body,
      startY: 26,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      didDrawPage: (data) => {
        doc.setFontSize(8);
        doc.text(`Page ${data.pageNumber}`, pageWidth - 18, pageHeight - 8);
      },
    });

    doc.save(this.buildExportFileName(baseFileName, 'pdf'));
  }

  private downloadFile(blob: Blob, baseFileName: string, extension: string): void {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.buildExportFileName(baseFileName, extension);
    document.body.appendChild(anchor);
    anchor.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(anchor);
  }

  private buildExportFileName(baseName: string, extension: string): string {
    const timestamp = new Date().toISOString().split('T')[0];
    return `${baseName}_${timestamp}.${extension}`;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
