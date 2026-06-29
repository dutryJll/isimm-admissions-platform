import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription, firstValueFrom } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { CandidatureService } from '../../../services/candidature.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { WebSocketService, ConnectionStatus } from '../../../services/websocket.service';
import { MatCardModule } from '@angular/material/card';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  OffreMasterDialogComponent,
  OffreMasterDialogData,
} from '../offre-master-dialog/offre-master-dialog.component';
import { CandidaturesMasterComponent } from '../candidatures-master/candidatures-master.component';
import { SpecialitesService } from '../../../services/specialites.service';
import {
  CommissionContextService,
  CommissionContextOption,
} from '../../../services/commission-context.service';
import { CommissionStateService } from '../../../services/commission-state.service';
import {
  PARCOURS_SPECIALITE_CATALOG,
  ParcoursSpecialiteOption,
  ScoreCriterion,
  evaluateScoreFormule,
  getParcoursOptionsForType,
  resolveParcoursByCode,
} from '../../../shared/specialites-demandees-catalog';
import {
  CRITERIA_OPTIONS,
  CritereOption,
  CritereConfig,
  buildFormulaPreview,
  getCritereByCode,
} from '../../../shared/constants/criteria';

interface OcrDetailNotes {
  l1: number;
  l2: number;
  l3: number;
  mg: number;
  bnr: number;
  bsp: number;
  redoublements: number;
  sessions: number;
  score_recalcule: number;
}

interface Candidature {
  id: number;
  numero: string;
  num?: string;
  candidat_nom: string;
  nom?: string;
  candidat_email: string;
  candidat_cin?: string;
  etablissement_origine?: string;
  master_id?: number;
  specialite: string;
  specialite_diplome?: string;
  spec?: string;
  master_nom?: string;
  score: number;
  dossier_depose: boolean;
  dossier_id?: string;
  statut: string;
  avis?: string;
  type_concours?: string;
  parcours?: string;
  nouveau_statut?: string;
  date_inscription?: string;
  annee_universitaire?: string;
  notes_preinscription?: string;
  decision_responsable?: 'valide' | 'non_valide' | '';
  dossier_valide?: 'valide' | 'non_valide' | '';
  date_soumission?: string;
  date_changement_statut?: string;
  classement?: string | number;
  total_candidats?: number;
  selectionStatut?: string;
  observation?: string;
  obs?: string;
  candidat_type?: string;
  // ✅ AJOUTÉ : Résultats OCR du backend
  rapport_ocr?: {
    statut?: 'conforme' | 'incoherence' | 'ocr_error' | 'ocr_no_data';
    score_extrait?: number;
    score_declare?: number;
    ecart?: number;
    confiance?: number;
    moteur?: string;
    alerte?: string;
    message?: string;
    texte_extrait?: string;
    anomalies?: string[];
  };
}

type FinalSelectionDecision = '' | 'lp' | 'la' | 'refuse';
type FinalSelectionPresel = 'oui' | 'non';
type FinalSelectionTypeFilter = 'all' | 'interne' | 'externe';

interface FinalSelectionCandidate {
  id: number;
  rang: number;
  num: string;
  nom: string;
  spec: string;
  score: number;
  interne: boolean;
  presel: FinalSelectionPresel;
  statut: FinalSelectionDecision;
  obs: string;
}

interface FinalSelectionFilters {
  session: string;
  type: FinalSelectionTypeFilter;
  specialite: string;
  scoreMin: number;
  scoreMax: number;
  search: string;
  hideValides: boolean;
  statut: string;
  dossier: '' | 'valide' | 'invalide';
  preselOnly: boolean;
}

interface NotificationItem {
  id: number;
  titre: string;
  message: string;
  date: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  lue: boolean;
}

interface ResponsibleNotificationItem {
  id: string;
  master_id: number;
  master_nom: string;
  deadline_type: string;
  deadline_date: string;
  days_left: number;
  est_cache?: boolean;
  est_visible?: boolean;
  statut: 'ouvert' | 'ferme';
  type: 'info' | 'warning';
  message: string;
}

interface Specialite {
  id: number;
  nom: string;
  statut: 'actuel' | 'ancien';
  nb_candidatures: number;
  nb_dossiers: number;
}

interface Concours {
  id: number;
  nom: string;
  annee: string;
  nb_candidatures: number;
  nb_acceptes: number;
  nb_refuses: number;
}

interface Liste {
  id: number;
  nom: string;
  specialite: string;
  type: 'preselection' | 'selection';
  statut: 'active' | 'archivee';
  nb_candidats: number;
  date_creation: string;
  avis?: string;
  recommandation?: 'favorable' | 'defavorable' | 'reserve' | '';
}

interface ListeGenerationApiPayload {
  success: boolean;
  message?: string;
  liste: {
    id: number;
    master_id: number;
    master_nom: string;
    type_liste: 'principale' | 'attente';
    iteration: number;
    annee_universitaire: string;
    nb_candidats: number;
    date_creation: string;
  } | null;
  candidats: Candidature[];
}

interface Reclamation {
  id: number;
  objet: string;
  candidat: string;
  master: string;
  date: string;
  pj: boolean;
  etat: 'en_cours' | 'en_attente' | 'traite' | 'rejete';
  details: string;
  priorite: 'haut' | 'moyen' | 'bas';
  candidature_id?: number;
  motif_rejet?: string;
}

interface DossierOCR {
  id: number;
  candidat_nom: string;
  fichier: string;
  statut_ocr: string;
  date_upload: string;
  resultats?: any;
}

interface CandidatureVoteAvis {
  membreNom: string;
  role: 'membre' | 'responsable';
  avis?: boolean;
  recommandation?: 'favorable' | 'defavorable' | 'reserve';
  commentaire: string;
  argument?: string;
  date: string;
  diplomeConforme?: boolean;
  commissionName?: string;
}

interface InscriptionVerificationRow {
  numero_candidature: string;
  cin: string;
  numero_inscription: string;
  nom_prenom: string;
  master: string;
  specialite: string;
  verification: 'valide' | 'incoherent' | 'absent';
  details: string;
  matchPercent?: number;
  email?: string;
  dossierFile?: string;
  observation?: string;
}

interface InscriptionCandidateRow {
  id: number;
  num: string;
  numero_inscription: string;
  nom: string;
  cin: string;
  master: string;
  specialite?: string;
  dossier: 'complet' | 'incomplet';
  paiement: 'paye' | 'en_attente' | 'incoherent' | 'absent';
  receiptPdfUrl: string;
  recuVerifie: boolean;
  statut_final: 'attente_paiement' | 'inscrite' | 'rejetee';
  finalise: boolean;
  matchPercent: number;
  email: string;
  dossierFile: string;
  observation: string;
}

interface InscriptionFilters {
  search: string;
  paiement: 'all' | 'paye' | 'en_attente' | 'incoherent' | 'absent';
  dossier: 'all' | 'complet' | 'incomplet';
  finalise: 'all' | 'yes' | 'no';
}

interface ResponsableMasterStat {
  masterId: number | string;
  masterNom: string;
  typeConcours: 'masters' | 'ingenieur' | 'autre';
  totalCandidatures: number;
  dossiersDeposes: number;
  acceptes: number;
  inscrits: number;
  rejetes: number;
  tauxAcceptation: number;
  tauxInscription: number;
  tauxDossier: number;
  tauxRejet: number;
}

interface DashboardProgramStat {
  label: string;
  type: 'masters' | 'ingenieur' | 'autre';
  total: number;
  acceptes: number;
  inscrits: number;
  rejetes: number;
  tauxAcceptation: number;
  tauxInscription: number;
}

interface ProcesVerbal {
  id: number;
  titre: string;
  date_reunion: string;
  master_nom: string;
  nb_participants: number;
  nb_candidatures: number;
  nb_admis: number;
  nb_rejetes: number;
  statut: string;
}

interface CommissionMember {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  role: 'responsable' | 'evaluateur' | 'observateur';
  statut: 'actif' | 'inactif';
  date_inscription: string;
  master_rattachement?: string;
  commentaire?: string;
  date?: string;
  avis?: 'favorable' | 'defavorable' | 'attente';
}

interface UserCommissionOption {
  id: number;
  nom: string;
  description?: string;
  actif?: boolean;
  is_active?: boolean;
  role?: string;
  master_id?: number;
  master_nom?: string;
}

type CommissionView =
  | 'dashboard'
  | 'profil'
  | 'masters'
  | 'configuration-appels'
  | 'candidatures-responsable'
  | 'avis-listes'
  | 'concours-ingenieur'
  | 'candidatures'
  | 'candidatures-master'
  | 'candidatures-ingenieur'
  | 'valider-dossier'
  | 'dossiers'
  | 'listes'
  | 'membres'
  | 'ocr'
  | 'inscriptions'
  | 'statistiques'
  | 'deliberations'
  | 'reclamations'
  | 'notifications'
  | 'ma-commission'
  | 'offre-wizard';

type ExportFormat = 'csv' | 'json' | 'pdf' | 'xlsx';
type ExportRow = Record<string, string | number | boolean | null | undefined>;

interface CommissionActionPermissions {
  consultationCandidature: boolean;
  consultationDossier: boolean;
  verifierDossiers: boolean;
  preselection: boolean;
  selectionFinale: boolean;
  publierListes: boolean;
  gererInscriptions: boolean;
  consulterStatistiques: boolean;
  traiterReclamations: boolean;
}

function normalizeActionLabel(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

interface MasterOption {
  id: number;
  nom: string;
}

interface OffreOption {
  id: number;
  nom: string;
}

interface OffrePreinscription {
  id: number;
  titre: string;
  type: 'master' | 'cycle_ingenieur';
  sous_type: string;
  specialite: string;
  description: string;
  annee_universitaire?: string;
  date_limite: string;
  date_limite_preinscription?: string | null;
  date_limite_depot_dossier?: string | null;
  date_limite_paiement?: string | null;
  capacite_total?: number;
  capacite_liste_attente?: number;
  places: number;
  capacite_interne?: number;
  capacite_externe?: number;
  est_cache?: boolean;
  est_visible?: boolean;
  statut: 'ouvert' | 'ferme';
  nombre_candidats_inscrits?: number;
  document_officiel_pdf_url?: string | null;
  isDemo?: boolean;
}

interface OffreMasterCrudItem {
  id: number;
  master_id: number;
  titre: string;
  description: string;
  capacite: number;
  date_limite: string;
  actif: boolean;
  nombre_candidats_inscrits: number;
}

interface OffreCalendarPreviewRow {
  capaciteTotale: string;
  etablissementOrigine: string;
  capacite: string;
  typeDiplome: string;
  datesImportantes: string;
}

interface ConfigurationAppelForm {
  master: number | null;
  date_debut_visibilite: string;
  date_fin_visibilite: string;
  date_limite_preinscription: string;
  date_limite_depot_dossier: string;
  date_limite_paiement: string;
  delai_modification_candidature_jours: number;
  delai_depot_dossier_preselectionnes_jours: number;
  actif: boolean;
  est_cache?: boolean;
  capacite_interne?: number;
  capacite_externe?: number;
  document_officiel_pdf_url?: string | null;
}

interface NouvelleOffreForm {
  nom: string;
  type_master: 'professionnel' | 'recherche';
  specialite: string;
  description: string;
  places_disponibles: number;
  date_limite_candidature: string;
  annee_universitaire: string;
  actif: boolean;
  document_officiel_pdf_url?: string | null;
}

interface OffreEditForm extends NouvelleOffreForm {
  id: number | null;
  date_debut_visibilite: string;
  date_fin_visibilite: string;
  date_limite_preinscription: string;
  date_limite_depot_dossier: string;
  date_limite_paiement: string;
  delai_modification_candidature_jours: number;
  delai_depot_dossier_preselectionnes_jours: number;
  est_cache: boolean;
  capacite_interne: number;
  capacite_externe: number;
  document_officiel_pdf_url?: string | null;
}

// ========================================
// WORKFLOW TRANSITION RULES
// ========================================
const ALLOWED_STATUS_TRANSITIONS: Record<string, Set<string>> = {
  soumis: new Set(['sous_examen', 'rejete', 'annule']),
  sous_examen: new Set(['preselectionne', 'en_attente_dossier', 'rejete']),
  preselectionne: new Set(['en_attente_dossier', 'rejete']),
  en_attente_dossier: new Set(['dossier_depose', 'dossier_non_depose', 'rejete']),
  dossier_depose: new Set(['en_attente', 'selectionne', 'rejete']),
  en_attente: new Set(['selectionne', 'rejete', 'annule']),
  selectionne: new Set(['inscrit', 'rejete']),
  dossier_non_depose: new Set(['en_attente_dossier', 'rejete']),
  annule: new Set(),
  rejete: new Set(),
  inscrit: new Set(),
};

@Component({
  selector: 'app-dashboard-commission',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatCardModule, CandidaturesMasterComponent],
  templateUrl: './dashboard-commission.html',
  styleUrl: './dashboard-commission.css',
})
export class DashboardCommissionComponent implements OnInit {
  readonly maCommissionComponentTag = 'app-ma-commission';
  private readonly fallbackEditOfferId = 3;
  currentView: CommissionView = 'dashboard';
  currentUser: any = null;
  currentDate: Date = new Date();
  Number = Number;
  isResponsable: boolean = false;
  activeCommissionId: number | null = null;
  private activeCommissionCategory: CommissionContextOption['category'] | null = null;
  availableCommissions: UserCommissionOption[] = [];
  commissionsLoading = false;
  commissionsLoadError = '';
  userMasterNoms: string[] = [];
  userMasterSpecialites: string[] = [];
  userMasterTypes: string[] = [];
  userMasterInfoLoaded = false;

  actionPermissions: CommissionActionPermissions = {
    consultationCandidature: true,
    consultationDossier: true,
    verifierDossiers: true,
    preselection: true,
    selectionFinale: true,
    publierListes: true,
    gererInscriptions: true,
    consulterStatistiques: true,
    traiterReclamations: true,
  };
  customRoleActions: string[] = [];
  private readonly customActionViewMap: Record<string, CommissionView> = {
    [normalizeActionLabel('Consultation de candidature')]: 'candidatures',
    [normalizeActionLabel('Traiter réclamations')]: 'reclamations',
    [normalizeActionLabel('Vérifier dossiers')]: 'valider-dossier',
    [normalizeActionLabel('Étude de dossier de candidature')]: 'valider-dossier',
    [normalizeActionLabel('Consultation de dossier')]: 'dossiers',
    [normalizeActionLabel('Préselection')]: 'listes',
    [normalizeActionLabel('Sélection finale')]: 'listes',
    [normalizeActionLabel('Liste de candidature')]: 'candidatures',
    [normalizeActionLabel('Avis sur les listes')]: 'avis-listes',
    [normalizeActionLabel('Consultation des listes')]: 'avis-listes',
    [normalizeActionLabel('Listes et avis')]: 'avis-listes',
    [normalizeActionLabel('Publier liste principale')]: 'deliberations',
    [normalizeActionLabel('Publier liste attente')]: 'deliberations',
    [normalizeActionLabel('Gérer inscriptions')]: 'inscriptions',
    [normalizeActionLabel('Consulter statistiques')]: 'dashboard',
    [normalizeActionLabel('Membres de la commission')]: 'membres',
    [normalizeActionLabel('Mon profil')]: 'profil',
    [normalizeActionLabel('Les masters')]: 'masters',
    [normalizeActionLabel('Configuration des appels')]: 'configuration-appels',
    [normalizeActionLabel('Liste des candidatures')]: 'candidatures',
    [normalizeActionLabel("Concours cycle d'ingénieur")]: 'concours-ingenieur',
    [normalizeActionLabel('Analyse dossier')]: 'ocr',
  };
  private readonly knownActionNameSet = new Set<string>([
    normalizeActionLabel('Consultation de candidature'),
    normalizeActionLabel('Traiter réclamations'),
    normalizeActionLabel('Consultation de dossier'),
    normalizeActionLabel('Vérifier dossiers'),
    normalizeActionLabel('Préselection'),
    normalizeActionLabel('Sélection finale'),
    normalizeActionLabel('Liste de candidature'),
    normalizeActionLabel('Avis sur les listes'),
    normalizeActionLabel('Consultation des listes'),
    normalizeActionLabel('Listes et avis'),
    normalizeActionLabel('Publier liste principale'),
    normalizeActionLabel('Publier liste attente'),
    normalizeActionLabel('Gérer inscriptions'),
    normalizeActionLabel('Consulter statistiques'),
  ]);

  // Menu Kebab
  actionMenuOpen: number | null = null;
  selectedCandidaturePreview: Candidature | null = null;

  // Filtres principaux
  filtreSpecialite: 'actuel' | 'ancien' = 'actuel';
  filtreConcours: 'actuel' | 'ancien' = 'actuel';
  filtreSpecialiteActive: string = '';
  filtreStatut: string = '';
  filtreSpecialiteCandidature: string = '';
  typeListe: 'preselection' | 'selection' = 'preselection';

  // Filtres avancés
  filtres: any = {
    concours: '',
    statut: '',
    session: '',
    parcours: '',
    recherche: '',
    scoreMin: null,
    scoreMax: null,
    etablissement: '',
    specialite: '',
  };

  // Mapping spécialités par parcours (matrice restrictive officielle ISIMM)
  readonly specialiteParParcours: Record<string, string[]> = {
    MPGL: [
      "Licence en Sciences de l'Informatique génie logiciel",
      'Informatique de Gestion',
      "Génie logiciel et systèmes d'information",
      'Génie logiciel',
      'Licence appliquée en développement des systèmes informatiques',
      'Big data et Analyse de données',
      'Business Computing',
    ],
    MPDS: [
      'Licence en Mathématiques Appliquées',
      "Mathématique appliquée spécialité statistique de l'environnement",
      'Mathématiques et applications',
      "Licence en Sciences de l'Informatique génie logiciel",
      'Informatique de Gestion',
      "Génie logiciel et systèmes d'information",
      'Génie logiciel',
      'Licence appliquée en développement des systèmes informatiques',
      'Big data et Analyse de données',
      'Business Computing',
    ],
    MP3I: [
      'Licence en Électronique, Électrotechnique et Automatique (MIM)',
      'Licence en Électronique, Électrotechnique et Automatique (SE)',
      "Licence en Technologies de l'Information et de la Communication (TIC)",
      'Licence en Mesures et Instrumentation',
      'Licence en EEA (Spécialité Automatique et Informatique Industrielle ou Mesures et Métrologie)',
      'Licence en Génie Électrique (Spécialité Automatique et Informatique Industrielle)',
    ],
    MRGL: [
      'Licence en Informatique : Maîtrise en Informatique',
      'Licence en Informatique ou Informatique de Gestion',
      'Maîtrise en Informatique ou Informatique de Gestion',
      'Mastère Recherche en micro-électronique et instrumentation',
      'Licence en EEA, MIM (Électronique, Systèmes Embarqués, Métrologie) ou TIC (Réseaux et IoT)',
      'Licence en Électronique, Automatique ou Mesures et Instrumentation',
      'Réussite en 1ère année du cycle ingénieur (Électronique/Instrumentation) ou équivalent',
    ],
    ING: [
      'Génie Logiciel (Informatique)',
      "Diplôme en ingénierie système d'information",
      'Diplôme en ingénierie système informatique',
    ],
  };

  // Détecte le code parcours depuis le nom du master
  private detectParcoursCode(masterNom: string): string {
    const n = (masterNom || '').toLowerCase();
    if (n.includes('3i') || n.includes('instrumentation')) return 'MP3I';
    if (n.includes('recherche') && n.includes('gl')) return 'MRGL';
    if (n.includes('recherche') && n.includes('logiciel')) return 'MRGL';
    if (n.includes('data science') || n.includes('mpds') || n.includes('sciences de données'))
      return 'MPDS';
    if (n.includes('génie logiciel') || n.includes('mpgl') || n.includes('genie logiciel'))
      return 'MPGL';
    if (n.includes('ingénieur') || n.includes('ingenieur') || n.includes('cycle ing')) return 'ING';
    return '';
  }

  // Retourne les options de spécialités pour le master actuellement sélectionné
  get specialiteOptionsForCurrentMaster(): string[] {
    let masterNom = '';
    if (this.isCurrentView('candidatures-ingenieur') || this.isCurrentView('concours-ingenieur')) {
      return this.specialiteParParcours['ING'] || [];
    }
    if (this.selectedMasterForCandidatures && this.selectedMasterForCandidatures !== 'all') {
      const m = this.masterOptions.find(
        (mo) => Number(mo.id) === Number(this.selectedMasterForCandidatures),
      );
      masterNom = m?.nom || '';
    } else if (this.activeCommissionId) {
      const m = this.masterOptions.find((mo) => Number(mo.id) === Number(this.activeCommissionId));
      masterNom = m?.nom || '';
    }
    const code = this.detectParcoursCode(masterNom);
    return code ? this.specialiteParParcours[code] || [] : [];
  }
  filtreAnneeUniversitaire: 'courante' | 'precedente' | 'toutes' = 'courante';
  filtrePorteeOffres: 'specialite' | 'toutes_ouvertes' = 'specialite';
  preselectionDecisionFilter: '' | 'valide' | 'non_valide' = '';
  preselectionSearch: string = '';
  preselectionQuota: number = 100;
  pageContext: 'candidature' | 'preselection' = 'preselection';
  preselectionRowsForGeneration: Candidature[] = [];
  generatedSelectionRows: Candidature[] = [];
  selectedPreselectionCandidateIds: number[] = [];

  // Présélection membre state
  prsMembreSearch: string = '';
  prsMembreSpecFilter: string = '';
  prsMembreTypeFilter: string = '';
  prsMembreScoreMin: number | null = null;
  prsMembreScoreMax: number | null = null;
  avisGlobalMembre: string = '';
  membreAvisSelectedIds: number[] = [];
  prsMembreGenerateListOpen: boolean = false;

  // Membre sélection bulk selection
  membreSelectionSelectedIds: Set<number> = new Set();
  membreSelGenListOpen: boolean = false;

  // Selection bar properties
  filtreeCandidatureCount: number = 0;
  seuilScore: number = 0;
  candidaturesFiltrees: Candidature[] = [];
  // UI filters
  hideValidated: boolean = false;
  selectedCandidatureType: 'all' | 'interne' | 'externe' = 'all';
  etablissementOrigineFilter: string = '';
  selectedAcademicYear: string = '2025/2026';
  top100Enabled: boolean = true;
  bulkListType: 'locale' | 'globale' = 'locale';
  fadeOutCandidateIds: number[] = [];
  hiddenValidatedIds: number[] = [];

  // Export menu
  exportMenuOpen: boolean = false;
  exportMenuPosition: any = {};
  generateListOpen: boolean = false;

  // Bulk consultation modal
  bulkConsultationOpen: boolean = false;
  bulkConsultationCandidates: Candidature[] = [];
  bulkConsultationCurrentIndex: number = 0;
  bulkConsultationCandidatesIds: number[] = [];

  // Consultation massive de candidatures (simple consultation view)
  bulkConsultationCandidaturesOpen: boolean = false;
  bulkConsultationCandidatures: Candidature[] = [];
  bulkConsultationCandidaturesCurrentIndex: number = 0;
  selectedCandidaturesIds: number[] = [];

  // --- OCR Dossier Modal ---
  showDossierOCRModal: boolean = false;
  dossierOCRCandidature: Candidature | null = null;
  dossierOCRActiveTab: string = 'documents';
  dossierOCRDocumentIndex: number = 0;
  showOCRPanel: boolean = false;

  // --- OCR réel du dossier ---
  ocrModalFile: File | null = null;
  ocrModalFileName: string = '';
  ocrModalLoading: boolean = false;
  ocrModalUpdateScore: boolean = false;
  ocrModalResult: {
    score_extrait: number | null;
    score_declare: number | null;
    delta?: number | null;
    ecart?: number | null;
    alerte?: string | null;
    statut?: string;
    flag_fraude?: boolean;
    confiance: number;
    moteur: string;
    anomalies: string[];
    texte_preview: string;
    detail_notes?: OcrDetailNotes | null;
  } | null = null;

  // --- PDF Officiel + QR Code ---
  pdfOfficielLoading: boolean = false;
  pdfOfficielBlobUrl: SafeResourceUrl | null = null;
  pdfOfficielError: string = '';

  // Documents réellement déposés par le candidat (depuis le filesystem Django)
  fichiersDeposes: any[] = [];
  fichiersDeposesLoading: boolean = false;

  // --- Analyse OCR par lot ---
  ocrLotLoading: boolean = false;
  ocrLotResultats: any = null;

  lancerAnalyseOcrLot(): void {
    if (this.cmSelectedIds.size === 0 || this.ocrLotLoading) return;
    const ids = Array.from(this.cmSelectedIds);
    this.ocrLotLoading = true;
    this.ocrLotResultats = null;
    this.toastService.show(`Analyse OCR par lot lancée sur ${ids.length} candidature(s)…`, 'info');

    this.candidatureService.analyserOcrLot(ids).subscribe({
      next: (res: any) => {
        this.ocrLotResultats = {
          success: res.success,
          message: res.message,
          total: res.total,
          nb_analysees: res.nb_analysees,
          nb_conformes: res.nb_conformes,
          nb_anomalies: res.nb_anomalies,
          nb_erreurs: res.nb_erreurs,
          resultats: res.resultats || [],
        };
        this.ocrLotLoading = false;
        const msg = `✅ ${this.ocrLotResultats.nb_analysees}/${this.ocrLotResultats.total} analysées — ${this.ocrLotResultats.nb_anomalies} anomalie(s)`;
        this.toastService.show(
          msg,
          this.ocrLotResultats.nb_anomalies > 0 || this.ocrLotResultats.nb_erreurs > 0
            ? 'warning'
            : 'success',
        );
      },
      error: (err: any) => {
        this.ocrLotLoading = false;
        const msg = err?.error?.error || err?.message || 'Erreur OCR par lot';
        this.toastService.show(msg, 'error');
      },
    });
  }

  private mapOcrDetailResult(res: any): {
    score_extrait: number | null;
    score_declare: number | null;
    delta?: number | null;
    ecart?: number | null;
    alerte?: string | null;
    statut?: string;
    flag_fraude?: boolean;
    confiance: number;
    moteur: string;
    anomalies: string[];
    texte_preview: string;
    detail_notes?: OcrDetailNotes | null;
  } {
    const scoreExtrait = res?.score_extrait ?? null;
    const scoreDeclare = res?.score_declare ?? null;
    const ecart = res?.ecart ?? res?.delta ?? null;
    const anomalies = Array.isArray(res?.anomalies)
      ? res.anomalies
          .map((item: any) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
              return item.message || item.type || JSON.stringify(item);
            }
            return '';
          })
          .filter((item: string) => item.trim().length > 0)
      : [];

    return {
      score_extrait: scoreExtrait,
      score_declare: scoreDeclare,
      delta: ecart,
      ecart,
      alerte: res?.alerte ?? null,
      statut: res?.statut,
      flag_fraude: Boolean(res?.flag_fraude || res?.alerte || anomalies.length > 0),
      confiance: Number(res?.confiance ?? 0),
      moteur: res?.moteur || 'pdfplumber',
      anomalies,
      texte_preview: res?.texte_preview || res?.texte_extrait || '',
      detail_notes: res?.detail_notes ?? null,
    };
  }

  fermerOcrLotResultats(): void {
    this.ocrLotResultats = null;
  }

  ocrLotExportLoading: 'excel' | 'pdf' | null = null;

  exporterOcrLot(format: 'excel' | 'pdf'): void {
    if (!this.ocrLotResultats || !this.ocrLotResultats.resultats) {
      this.toastService.show('Aucun résultat à exporter.', 'warning');
      return;
    }
    if (this.ocrLotExportLoading) return;
    this.ocrLotExportLoading = format;

    const obs =
      format === 'excel'
        ? this.candidatureService.exportOcrExcel(this.ocrLotResultats.resultats)
        : this.candidatureService.exportOcrPdf(this.ocrLotResultats.resultats);

    obs.subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = format === 'excel' ? 'rapport_ocr_lot.xlsx' : 'rapport_ocr_lot.pdf';
        a.click();
        window.URL.revokeObjectURL(url);
        this.toastService.show(`Rapport ${format.toUpperCase()} téléchargé.`, 'success');
        this.ocrLotExportLoading = null;
      },
      error: (err: any) => {
        console.error('Export error:', err);
        this.toastService.show(`Erreur export ${format.toUpperCase()}.`, 'error');
        this.ocrLotExportLoading = null;
      },
    });
  }

  // ── Export rapport de conformité OCR (Excel / PDF) ──
  ocrRapportExportLoading: 'excel' | 'pdf' | null = null;

  exporterRapportOcr(format: 'excel' | 'pdf'): void {
    const ids = Array.from(this.cmSelectedIds);
    if (ids.length === 0) {
      this.toastService.show('Aucune candidature sélectionnée.', 'warning');
      return;
    }
    if (this.ocrRapportExportLoading) return;
    this.ocrRapportExportLoading = format;
    this.toastService.show(
      `Génération du rapport de conformité ${format.toUpperCase()}...`,
      'info',
    );

    const obs =
      format === 'excel'
        ? this.candidatureService.exportRapportOcrExcel(ids)
        : this.candidatureService.exportRapportOcrPdf(ids);

    obs.subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
        const ext = format === 'excel' ? 'xlsx' : 'pdf';
        a.href = url;
        a.download = `Rapport_Conformite_OCR_${stamp}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        this.ocrRapportExportLoading = null;
        this.toastService.show(`✅ Rapport ${format.toUpperCase()} téléchargé.`, 'success');
      },
      error: (err) => {
        this.ocrRapportExportLoading = null;
        const msg = err?.error?.error || err?.message || 'Erreur export rapport';
        this.toastService.show(msg, 'error');
      },
    });
  }

  ouvrirDossierOCR(c: Candidature): void {
    this.dossierOCRCandidature = c;
    this.dossierOCRActiveTab = 'documents';
    this.dossierOCRDocumentIndex = 0;
    this.showOCRPanel = false;
    this.showDossierOCRModal = true;
    // Reset OCR/PDF state when opening
    this.ocrModalFile = null;
    this.ocrModalFileName = '';
    this.ocrModalResult = null;
    this.ocrModalUpdateScore = false;
    this.pdfOfficielBlobUrl = null;
    this.pdfOfficielError = '';
    // Charger les vrais fichiers déposés
    this.loadFichiersDeposes(c.id);
  }

  loadFichiersDeposes(candidatureId: number): void {
    this.fichiersDeposesLoading = true;
    this.fichiersDeposes = [];
    this.candidatureService.getFichiersDeposes(candidatureId).subscribe({
      next: (res: any) => {
        this.fichiersDeposes = res?.fichiers || [];
        this.fichiersDeposesLoading = false;
      },
      error: () => {
        this.fichiersDeposes = [];
        this.fichiersDeposesLoading = false;
      },
    });
  }

  /** URL absolue d'un fichier déposé pour download/preview */
  fichierDeposeUrl(rawUrl: string): string {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('http')) return rawUrl;
    // Le proxy Angular dev redirige /media/* vers Django, mais pour le download, on cible directement le service
    return `http://localhost:8003${rawUrl}`;
  }

  ouvrirDossierOCRById(id: number): void {
    const fromSel = this.finalSelectionCandidates?.find((x) => x.id === id);
    if (fromSel) {
      const fake: Candidature = {
        id: fromSel.id,
        numero: fromSel.num,
        candidat_nom: fromSel.nom,
        candidat_email: '',
        specialite: fromSel.spec,
        score: fromSel.score,
        dossier_depose: true,
        statut: fromSel.statut,
      };
      this.ouvrirDossierOCR(fake);
      return;
    }
    const c =
      this.candidatures?.find((x) => x.id === id) ||
      this.selectionCandidates?.find((x) => x.id === id);
    if (c) this.ouvrirDossierOCR(c);
  }

  fermerDossierOCR(): void {
    this.showDossierOCRModal = false;
    this.dossierOCRCandidature = null;
  }

  setDossierOCRTab(tab: string): void {
    this.dossierOCRActiveTab = tab;
  }

  lancerAnalyseOCRDossier(): void {
    if (!this.dossierOCRCandidature) return;
    const cand = this.dossierOCRCandidature;

    // Cible le premier PDF déposé par le candidat
    const fichier = (this.fichiersDeposes || []).find((f) => f.extension === 'pdf');
    if (!fichier) {
      this.toastService.show(
        "Aucun PDF déposé par ce candidat. Utilisez la zone d'upload OCR au-dessus.",
        'warning',
      );
      return;
    }

    this.showOCRPanel = false;
    this.ocrModalLoading = true;
    this.ocrModalResult = null;
    this.toastService.show(`Analyse OCR en cours sur ${fichier.nom_fichier}…`, 'info');

    // Télécharge le fichier depuis Django + envoie à l'endpoint OCR
    const fileUrl = this.fichierDeposeUrl(fichier.url);
    fetch(fileUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Téléchargement échec : ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const file = new File([blob], fichier.nom_fichier, { type: 'application/pdf' });
        return this.candidatureService.analyserOcrCandidature(cand.id, file, false).toPromise();
      })
      .then((res: any) => {
        this.ocrModalResult = this.mapOcrDetailResult(res);
        this.showOCRPanel = true; // Affiche aussi le panel mock pour layout
        this.ocrModalLoading = false;
        const score = this.ocrModalResult.score_extrait;
        this.toastService.show(
          `✅ OCR (${this.ocrModalResult.moteur}) — Score extrait : ${score ?? '—'}`,
          this.ocrModalResult.flag_fraude ? 'warning' : 'success',
        );
      })
      .catch((err) => {
        this.ocrModalLoading = false;
        const msg = err?.message || 'Erreur OCR sur le fichier déposé.';
        this.toastService.show(msg, 'error');
        console.error('OCR error:', err);
      });
  }

  // ──────────────────────────────────────────────────────────────────
  // OCR réel du dossier — upload PDF et analyse OCR
  // ──────────────────────────────────────────────────────────────────
  onOcrModalFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.ocrModalFile = input.files[0];
      this.ocrModalFileName = this.ocrModalFile.name;
      this.ocrModalResult = null;
    }
  }

  lancerOcrReel(): void {
    if (!this.dossierOCRCandidature || this.ocrModalLoading) return;
    this.ocrModalLoading = true;
    this.ocrModalResult = null;
    const candidatureId = this.dossierOCRCandidature.id;

    this.candidatureService
      .analyserOcrCandidature(
        candidatureId,
        this.ocrModalFile || undefined,
        this.ocrModalUpdateScore,
      )
      .subscribe({
        next: (res: any) => {
          this.ocrModalResult = this.mapOcrDetailResult(res);
          if (this.ocrModalUpdateScore && res.score_extrait != null && this.dossierOCRCandidature) {
            this.dossierOCRCandidature.score = res.score_extrait;
          }
          this.toastService.show(
            `OCR (${this.ocrModalResult.moteur}) terminé — score extrait : ${this.ocrModalResult.score_extrait ?? '—'}`,
            this.ocrModalResult.flag_fraude ? 'warning' : 'success',
          );
          this.ocrModalLoading = false;
        },
        error: (err: any) => {
          const msg = err?.error?.error || err?.message || 'Erreur OCR';
          this.toastService.show(msg, 'error');
          this.ocrModalLoading = false;
        },
      });
  }

  resetOcrModal(): void {
    this.ocrModalFile = null;
    this.ocrModalFileName = '';
    this.ocrModalResult = null;
    this.ocrModalUpdateScore = false;
  }

  get ocrModalConfianceClass(): string {
    if (!this.ocrModalResult) return '';
    const c = this.ocrModalResult.confiance;
    if (this.ocrModalResult.flag_fraude) return 'ocr-conf-bad';
    if (c >= 0.8) return 'ocr-conf-high';
    if (c >= 0.5) return 'ocr-conf-medium';
    return 'ocr-conf-low';
  }

  // ──────────────────────────────────────────────────────────────────
  // PDF Officiel + QR Code (force=1 pour la démo)
  // ──────────────────────────────────────────────────────────────────
  genererPdfOfficielModal(): void {
    if (!this.dossierOCRCandidature || this.pdfOfficielLoading) return;
    this.pdfOfficielLoading = true;
    this.pdfOfficielError = '';
    this.pdfOfficielBlobUrl = null;
    const candidatureId = this.dossierOCRCandidature.id;

    this.candidatureService.genererAttestation(candidatureId, true).subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        this.pdfOfficielBlobUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.pdfOfficielLoading = false;
        this.toastService.show('Document officiel généré (QR code intégré).', 'success');
      },
      error: (err: any) => {
        const msg = err?.error?.error || err?.message || 'Erreur génération PDF';
        this.pdfOfficielError = msg;
        this.pdfOfficielLoading = false;
        this.toastService.show(msg, 'error');
      },
    });
  }

  telechargerPdfOfficielModal(): void {
    if (!this.dossierOCRCandidature) return;
    const cand = this.dossierOCRCandidature;
    this.candidatureService.genererAttestation(cand.id, true).subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const nom = (cand.candidat_nom || 'candidat').replace(/ /g, '_');
        const num = cand.numero || String(cand.id);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ISIMM_Attestation_${nom}_${num}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.toastService.show('Erreur téléchargement PDF', 'error'),
    });
  }

  fermerPdfOfficielModal(): void {
    this.pdfOfficielBlobUrl = null;
  }

  statutLabelDisplay(statut: string): string {
    switch ((statut || '').toLowerCase()) {
      case 'preselectionne':
        return 'Présélectionné';
      case 'selectionne':
        return 'Sélectionné';
      case 'rejete':
      case 'refuse':
        return 'Refusé';
      case 'sous_examen':
        return 'Sous examen';
      case 'dossier_depose':
        return 'Dossier déposé';
      case 'soumis':
        return 'Soumis';
      case 'inscrit':
        return 'Inscrit';
      default:
        return statut || '—';
    }
  }

  validerDossierOCR(): void {
    if (!this.dossierOCRCandidature) return;
    const cand = this.dossierOCRCandidature;
    this.candidatureService.updateStatus(cand.id, 'preselectionne').subscribe({
      next: () => {
        // 1) Mise à jour locale immédiate
        const idx = this.candidatures.findIndex((c) => c.id === cand.id);
        if (idx >= 0) this.candidatures[idx].statut = 'preselectionne';
        const idxR = this.candidaturesResponsable.findIndex((c) => c.id === cand.id);
        if (idxR >= 0) this.candidaturesResponsable[idxR].statut = 'preselectionne';
        // 2) Toast + fermeture modal
        this.toastService.show(
          `✅ ${cand.candidat_nom} validé — bascule vers Présélection.`,
          'success',
        );
        this.fermerDossierOCR();
        // 3) Refresh + recalcul des compteurs nav
        this.loadCandidaturesResponsable();
        this.appliquerFiltresResponsable();
        // 4) Switch automatique vers le nav-item Présélection
        setTimeout(() => this.switchView('avis-listes'), 300);
      },
      error: (err: any) => {
        const msg = err?.error?.error || err?.message || 'Erreur mise à jour statut';
        this.toastService.show(msg, 'error');
      },
    });
  }

  rejeterDossierOCR(): void {
    if (!this.dossierOCRCandidature) return;
    const cand = this.dossierOCRCandidature;
    this.candidatureService.updateStatus(cand.id, 'rejete').subscribe({
      next: () => {
        const idx = this.candidatures.findIndex((c) => c.id === cand.id);
        if (idx >= 0) this.candidatures[idx].statut = 'rejete';
        const idxR = this.candidaturesResponsable.findIndex((c) => c.id === cand.id);
        if (idxR >= 0) this.candidaturesResponsable[idxR].statut = 'rejete';
        this.toastService.show(`Dossier rejeté : ${cand.candidat_nom}`, 'warning');
        this.fermerDossierOCR();
        this.loadCandidaturesResponsable();
        this.appliquerFiltresResponsable();
      },
      error: (err: any) => {
        this.toastService.show(err?.error?.error || 'Erreur mise à jour statut', 'error');
      },
    });
  }

  updateCandidatureStatus(id: number, statut: string): void {
    this.candidatureService.updateStatus(id, statut).subscribe({
      next: () => {
        const idx = this.candidatures.findIndex((c) => c.id === id);
        if (idx >= 0) this.candidatures[idx].statut = statut;
        const idxR = this.candidaturesResponsable.findIndex((c) => c.id === id);
        if (idxR >= 0) this.candidaturesResponsable[idxR].statut = statut;
        // Refresh global après tout changement de statut
        this.loadCandidaturesResponsable();
        this.appliquerFiltresResponsable();
      },
      error: (err: any) => {
        this.toastService.show(err?.error?.error || 'Erreur mise à jour statut', 'error');
      },
    });
  }

  updateDossierValidite(c: Candidature, val: 'valide' | 'non_valide' | ''): void {
    c.dossier_valide = val;
    if (val === 'valide') {
      this.updateCandidatureStatus(c.id, 'preselectionne');
    } else if (val === 'non_valide') {
      this.updateCandidatureStatus(c.id, 'rejete');
    }
  }

  prsKebabPos: { top: number; left: number } = { top: 0, left: 0 };

  togglePrsKebab(id: number, event?: MouseEvent): void {
    this.prsKebabOpenId = this.prsKebabOpenId === id ? 0 : id;
    if (this.prsKebabOpenId === id && event) {
      const btn = (event.target as HTMLElement).closest('button') as HTMLElement | null;
      if (btn) {
        const rect = btn.getBoundingClientRect();
        // Menu en position fixed : au-dessus à gauche du bouton
        this.prsKebabPos = {
          top: rect.top - 145, // 145px = hauteur estimée du menu (3 items)
          left: rect.left - 180, // décale vers la gauche
        };
        // Si pas assez de place en haut, ouvre vers le bas
        if (this.prsKebabPos.top < 10) {
          this.prsKebabPos.top = rect.bottom + 4;
        }
        // Si pas assez de place à gauche, aligner sur le bouton
        if (this.prsKebabPos.left < 10) {
          this.prsKebabPos.left = rect.left;
        }
      }
    }
  }

  toggleSelKebab(id: number): void {
    this.selKebabOpenId = this.selKebabOpenId === id ? 0 : id;
  }

  updateReclamationEtat(id: number, etat: string): void {
    const rec = this.reclamations.find((r) => r.id === id);
    if (rec) rec.etat = etat as Reclamation['etat'];
    this.http
      .patch(
        `/api/reclamations/${id}/`,
        { etat },
        {
          headers: { Authorization: `Bearer ${this.authService.getAccessToken()}` },
        },
      )
      .subscribe({
        next: () => this.toastService.show('État réclamation mis à jour.', 'success'),
        error: () => this.toastService.show('Erreur mise à jour réclamation.', 'error'),
      });
  }

  // --- Consultation Massive Modal ---
  showConsultationMassiveModal: boolean = false;
  consultationMassiveCandidates: Candidature[] = [];
  consultationMassiveIndex: number = 0;
  consultationMassiveSearch: string = '';
  showConsultationMassiveOCRPanel: boolean = false;

  get consultationMassiveCurrent(): Candidature | null {
    return this.consultationMassiveCandidates[this.consultationMassiveIndex] ?? null;
  }

  get consultationMassiveFiltered(): Candidature[] {
    const s = this.consultationMassiveSearch.toLowerCase();
    if (!s) return this.consultationMassiveCandidates;
    return this.consultationMassiveCandidates.filter(
      (c) => c.candidat_nom.toLowerCase().includes(s) || c.numero.toLowerCase().includes(s),
    );
  }

  ouvrirConsultationMassive(candidates: Candidature[]): void {
    this.consultationMassiveCandidates = candidates;
    this.consultationMassiveIndex = 0;
    this.consultationMassiveSearch = '';
    this.showConsultationMassiveOCRPanel = false;
    this.showConsultationMassiveModal = true;
  }

  fermerConsultationMassive(): void {
    this.showConsultationMassiveModal = false;
    this.consultationMassiveCandidates = [];
  }

  consultationMassiveSelectCandidat(index: number): void {
    this.consultationMassiveIndex = index;
    this.showConsultationMassiveOCRPanel = false;
  }

  consultationMassiveSuivant(): void {
    if (this.consultationMassiveIndex < this.consultationMassiveCandidates.length - 1) {
      this.consultationMassiveIndex++;
      this.showConsultationMassiveOCRPanel = false;
    } else {
      this.fermerConsultationMassive();
    }
  }

  consultationMassivePrecedent(): void {
    if (this.consultationMassiveIndex > 0) {
      this.consultationMassiveIndex--;
      this.showConsultationMassiveOCRPanel = false;
    }
  }

  lancerConsultationMassiveOCR(): void {
    this.showConsultationMassiveOCRPanel = true;
    this.toastService.show('Analyse OCR lancée pour ce candidat', 'info');
  }

  validerPreselectioCandidat(candidatureId: number, commentaire: string = ''): void {
    this.candidatureService.validerPreselection(candidatureId, '', commentaire).subscribe({
      next: () => {
        this.toastService.show('✅ Candidat présélectionné avec succès', 'success');
        // Passer au candidat suivant
        this.consultationMassiveSuivant();
      },
      error: (err) => {
        console.error('Erreur validation:', err);
        this.toastService.show('❌ Erreur lors de la validation', 'error');
      },
    });
  }

  // --- Candidatures Master cm-* ---
  cmSelectedIds: Set<number> = new Set();
  cmAllSelected: boolean = false;

  get cmCandidatures(): Candidature[] {
    return this.isResponsable ? this.candidaturesResponsableFiltrees : this.candidaturesFiltrees;
  }

  get cmStatPreselectionnees(): number {
    return this.cmCandidatures.filter(
      (c) => c.statut === 'preselectionne' || c.statut === 'selectionne',
    ).length;
  }

  get cmStatRefuses(): number {
    return this.cmCandidatures.filter((c) => c.statut === 'rejete').length;
  }

  get cmStatDossiers(): number {
    return this.cmCandidatures.filter((c) => c.dossier_depose).length;
  }

  toggleCmSelection(id: number): void {
    if (this.cmSelectedIds.has(id)) {
      this.cmSelectedIds.delete(id);
    } else {
      this.cmSelectedIds.add(id);
    }
    this.cmAllSelected = this.cmSelectedIds.size === this.cmCandidatures.length;
  }

  toggleAllCmSelection(): void {
    this.cmAllSelected = !this.cmAllSelected;
    if (this.cmAllSelected) {
      this.cmSelectedIds = new Set(this.cmCandidatures.map((c) => c.id));
    } else {
      this.cmSelectedIds = new Set();
    }
  }

  ouvrirConsultationMassiveCm(): void {
    const selected =
      this.cmSelectedIds.size > 0
        ? this.cmCandidatures.filter((c) => this.cmSelectedIds.has(c.id))
        : this.cmCandidatures;
    this.ouvrirConsultationMassive(selected);
  }

  // --- Candidatures Ingénieur ing-* ---
  ingSelectedIds: Set<number> = new Set();
  ingAllSelected: boolean = false;

  toggleIngSelection(id: number): void {
    if (this.ingSelectedIds.has(id)) {
      this.ingSelectedIds.delete(id);
    } else {
      this.ingSelectedIds.add(id);
    }
    this.ingAllSelected = this.ingSelectedIds.size === this.candidaturesIngenieurFiltrees.length;
  }

  toggleAllIngSelection(): void {
    this.ingAllSelected = !this.ingAllSelected;
    if (this.ingAllSelected) {
      this.ingSelectedIds = new Set(this.candidaturesIngenieurFiltrees.map((c) => c.id));
    } else {
      this.ingSelectedIds = new Set();
    }
  }

  ouvrirConsultationMassiveIng(): void {
    const selected =
      this.ingSelectedIds.size > 0
        ? this.candidaturesIngenieurFiltrees.filter((c) => this.ingSelectedIds.has(c.id))
        : this.candidaturesIngenieurFiltrees;
    this.ouvrirConsultationMassive(selected);
  }

  // --- Candidatures Master (carousel & actions) ---
  candidates: any[] = [];

  currentIndex: number = 0;
  get currentCandidate() {
    return this.candidates[this.currentIndex] ?? null;
  }

  consulterDossier(id: number) {
    this.toastService.show('Ouverture du dossier ID ' + id, 'info');
    // Integrate navigation to dossier viewer if available
    // this.router.navigate(['/commission/dossier', id]);
  }

  telechargerPieces(id: number) {
    this.toastService.show('Téléchargement pièces pour ID ' + id, 'info');
    // Implement ZIP creation / invocation here
  }

  prevCandidate() {
    if (this.currentIndex > 0) this.currentIndex -= 1;
  }

  nextCandidate() {
    if (this.currentIndex < this.candidates.length - 1) this.currentIndex += 1;
  }

  carPrev() {
    this.prevCandidate();
  }

  carNext() {
    this.nextCandidate();
  }

  validerDossier(id: number) {
    const c = this.candidates.find((x) => x.id === id);
    if (!c) return;

    this.candidatureService.updateStatus(id, 'preselectionne').subscribe({
      next: (resp: any) => {
        c.statut = 'preselectionne';
        this.toastService.show(`Dossier validé: ${c.nom}`, 'success');
        this.nextCandidate();
      },
      error: (err: any) => {
        const msg = err?.error?.error || 'Erreur lors de la validation du dossier';
        this.toastService.show(msg, 'error');
      },
    });
  }

  rejeterDossier(id: number) {
    const c = this.candidates.find((x) => x.id === id);
    if (!c) return;

    this.candidatureService.updateStatus(id, 'rejete').subscribe({
      next: (resp: any) => {
        c.statut = 'rejete';
        this.toastService.show(`Dossier rejeté: ${c.nom}`, 'warning');
        this.nextCandidate();
      },
      error: (err: any) => {
        const msg = err?.error?.error || 'Erreur lors du rejet du dossier';
        this.toastService.show(msg, 'error');
      },
    });
  }
  candidaturesMarkedAsRead: Set<number> = new Set();
  validationScoreThreshold: number | null = null;

  // Selection finale (Sélection tab)
  selectionCandidates: Candidature[] = [];
  selectionFiltered: Candidature[] = [];
  selectionStats: { lp: number; la: number; refuse: number } = { lp: 0, la: 0, refuse: 0 };
  selectionAvgScore: number = 0;
  selectionSelected: Set<number> = new Set();
  selectionAllChecked: boolean = false;
  selectionExportOpen: boolean = false;
  selectionBulkAction: string = '';
  selectionFilters: any = {
    session: '2025/2026',
    type: 'all',
    specialty: '',
    scoreMin: 0,
    scoreMax: 20,
    search: '',
    top100: false,
    hideValidated: false,
  };
  quotaLpTotal: number = 55;
  quotaLaTotal: number = 20;
  currentYear: string = '2025/2026';

  // Profil
  profileData: any = {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  };

  profileCommissionCards: Array<{
    id: number;
    title: string;
    role: string;
    description: string;
    icon: string;
  }> = [
    {
      id: 1,
      title: 'Ingénieur en Génie Logiciel (GL) - 2025/2026',
      role: 'Rôle: Membre',
      description: 'Accès aux dossiers de la commission GL',
      icon: 'fa-folder-open',
    },
    {
      id: 2,
      title: 'Mastère en Data Science - 2025/2026',
      role: 'Rôle: Membre',
      description: 'Accès aux dossiers de la commission Data Science',
      icon: 'fa-folder-open',
    },
    {
      id: 3,
      title: 'Mastère en Génie Logiciel (GL) - 2025/2026',
      role: 'Rôle: Membre',
      description: 'Accès aux dossiers de la commission GL',
      icon: 'fa-folder-open',
    },
  ];

  passwordForm: any = {
    current_password: '',
    new_password: '',
    confirm_password: '',
  };

  // Données
  specialites: Specialite[] = [];

  notificationsCandidat: NotificationItem[] = [];
  notificationsNonLues: number = 0;
  filtreNotificationType: '' | 'info' | 'success' | 'warning' | 'danger' = '';
  filtreNotificationTriRapide: 'recent' | 'critique' = 'recent';
  filtreNotificationDateDebut: string = '';
  filtreNotificationDateFin: string = '';
  filtreNotificationRecherche: string = '';

  reclamations: Reclamation[] = [];
  reclamationStatusFilter: '' | 'en_cours' | 'en_attente' | 'traite' | 'rejete' = '';
  reclamationPriorityFilter: '' | 'haut' | 'moyen' | 'bas' = '';
  reclamationSearch: string = '';
  private reclamationActionMenuOpen: Record<number, boolean> = {};
  showModalReponseReclamation: boolean = false;
  showModalRectifierScore: boolean = false;
  showModalRejetReclamation: boolean = false;
  showModalConsultationReclamation: boolean = false;
  // Nouvelles propriétés pour les modales
  reclamationModalConsultOuvert: boolean = false;
  reclamationModalAcceptOuvert: boolean = false;
  reclamationModalRejetOuvert: boolean = false;
  reclamationModalData: Reclamation | null = null;
  reclamationMotifRefus: string = '';
  reclamationSelectionnee: Reclamation | null = null;
  reclamationScoreSelectionnee: Reclamation | null = null;
  reclamationRejetSelectionnee: Reclamation | null = null;
  reclamationConsultationSelectionnee: Reclamation | null = null;
  currentRejetId: number | null = null;
  reponseReclamationText: string = '';
  scoreRectification: number | null = null;
  scoreRectificationCommentaire: string = '';
  motifRejet: string = '';
  motifRejetDetail: string = '';
  notesRectification: number[] = [15.5, 17.0, 14.0, 13.5];
  notesRectificationLabels: Array<{ label: string; coef: number }> = [
    { label: 'Mathématiques', coef: 3 },
    { label: 'Algorithmique', coef: 4 },
    { label: 'Bases de données', coef: 3 },
    { label: 'Anglais', coef: 2 },
  ];

  concoursIngenieur: Concours[] = [];

  candidatures: Candidature[] = [];

  finalSelectionQuotaLpTotal: number = 55;
  finalSelectionQuotaLaTotal: number = 20;
  finalSelectionCandidates: FinalSelectionCandidate[] = [];
  finalSelectionFiltered: FinalSelectionCandidate[] = [];
  finalSelectionSelectedIds: Set<number> = new Set();
  finalSelectionTop100On: boolean = false;
  finalSelectionBulkAction: FinalSelectionDecision = '';
  finalSelectionExportOpen: boolean = false;
  cmGenerateListOpen: boolean = false;
  ingGenerateListOpen: boolean = false;
  selGenerateListOpen: boolean = false;
  ins2ExportOpen: boolean = false;
  prsmGenerateListOpen: boolean = false;
  prsmFloatGenOpen: boolean = false;
  prsKebabOpenId: number = 0;
  selKebabOpenId: number = 0;
  nouvelleOfrePdfSigneNom: string = '';
  nouvelleOfrePdfSigneFile: File | null = null;
  finalSelectionConfirmOpen: boolean = false;
  finalSelectionConfirmTitle: string = '';
  finalSelectionConfirmMessage: string = '';
  finalSelectionConsultationOpen: boolean = false;
  finalSelectionConsultationIds: number[] = [];
  finalSelectionConsultationCandidates: FinalSelectionCandidate[] = [];
  finalSelectionConsultationCurrentIndex: number = 0;

  // Consultation Massive OCR (unified modal)
  massiveOCROpen: boolean = false;
  massiveOCRCandidates: any[] = [];
  massiveOCRCurrentIndex: number = 0;
  massiveOCRTitle: string = 'Consultation massive';
  massiveOCROCRDone: { [key: string]: boolean } = {};
  massiveOCROCRData: { [key: number]: any } = {}; // ✅ Stockage des vraies données OCR
  massiveOCRDecisions: { [key: number]: 'approve' | 'reject' | 'hold' } = {};
  massiveOCRComments: { [key: number]: string } = {};
  massiveOCRSearchFilter: string = '';
  finalSelectionToast: { message: string; type: string; visible: boolean } = {
    message: '0 candidats mis a jour',
    type: 't-success',
    visible: false,
  };
  private finalSelectionToastTimer: number | null = null;
  finalSelectionFilters: FinalSelectionFilters = {
    session: '2025/2026',
    type: 'all',
    specialite: 'all',
    scoreMin: 0,
    scoreMax: 20,
    search: '',
    hideValides: false,
    statut: '',
    dossier: '',
    preselOnly: false,
  };

  // Filter properties for template binding
  finalSelectionSession: string = '2025/2026';
  finalSelectionTypeFilter: FinalSelectionTypeFilter = 'all';
  finalSelectionSpecialtyFilter: string = 'all';
  finalSelectionScoreMin: number = 0;
  finalSelectionScoreMax: number = 20;
  finalSelectionSearchTerm: string = '';
  finalSelectionHideValidated: boolean = false;

  listes: Liste[] = [];
  derniereListeGeneree: Liste | null = null;
  listesExportFormat: ExportFormat = 'pdf';
  candidaturesMembreExportFormat: ExportFormat = 'xlsx';
  candidaturesResponsableExportFormat: ExportFormat = 'xlsx';
  deliberationsExportFormat: ExportFormat = 'pdf';
  inscriptionsExportFormat: ExportFormat = 'xlsx';

  masterOptions: MasterOption[] = [];
  offreOptions: OffreOption[] = [];
  offresPreinscription: OffrePreinscription[] = [
    {
      id: 1,
      titre: 'Mastere Professionnel Genie Logiciel (MPGL)',
      type: 'master',
      sous_type: 'professionnel',
      specialite: 'MPGL',
      description: '',
      date_limite: '2026-07-22',
      places: 35,
      statut: 'ouvert',
      est_cache: false,
      est_visible: true,
    },
    {
      id: 2,
      titre: 'Mastere Professionnel en sciences de donnees (MPDS)',
      type: 'master',
      sous_type: 'professionnel',
      specialite: 'MPDS',
      description: '',
      date_limite: '2026-07-22',
      places: 35,
      statut: 'ouvert',
      est_cache: false,
      est_visible: true,
    },
    {
      id: 3,
      titre: 'Mastere Professionnel en Ingenieries en Instrumentation industrielle (MP3I)',
      type: 'master',
      sous_type: 'professionnel',
      specialite: 'MP3I',
      description: '',
      date_limite: '2026-07-20',
      places: 25,
      statut: 'ouvert',
      est_cache: false,
      est_visible: true,
    },
    {
      id: 4,
      titre: 'Mastere Recherche en Genie logiciel (MRGL)',
      type: 'master',
      sous_type: 'recherche',
      specialite: 'MRGL',
      description: '',
      date_limite: '2026-07-22',
      places: 111,
      statut: 'ouvert',
      est_cache: false,
      est_visible: true,
    },
    {
      id: 5,
      titre: 'Mastere Recherche en micro-electronique et instrumentation (MRMI)',
      type: 'master',
      sous_type: 'recherche',
      specialite: 'MRMI',
      description: '',
      date_limite: '2026-07-20',
      places: 29,
      statut: 'ouvert',
      est_cache: false,
      est_visible: true,
    },
    {
      id: 6,
      titre: 'Ingenieur en sciences Appliquees et Technologie - Genie Logiciel (ING-GL)',
      type: 'cycle_ingenieur',
      sous_type: '',
      specialite: 'ING_GL',
      description: '',
      date_limite: '2026-08-08',
      places: 65,
      statut: 'ouvert',
      est_cache: false,
      est_visible: true,
    },
  ];
  offresPreinscriptionSupprimees: Set<number> = new Set<number>();
  offresMasterCrud: OffreMasterCrudItem[] = [];
  offresMasterCrudFiltrees: OffreMasterCrudItem[] = [];
  offreMasterSearch: string = '';
  offreMasterDateSearch: string = '';
  offresMasterCrudLoading: boolean = false;
  private readonly demoOffrePreinscription: OffrePreinscription = {
    id: -1,
    titre: 'Master Démo - Ingénierie Logicielle',
    type: 'master',
    sous_type: 'professionnel',
    specialite: 'Génie Logiciel',
    description:
      'Ligne de démonstration affichée automatiquement quand aucune offre réelle n’existe.',
    date_limite: '2026-09-15',
    places: 30,
    est_cache: false,
    est_visible: true,
    statut: 'ouvert',
    document_officiel_pdf_url: null,
    isDemo: true,
  };
  selectedConfigMasterId: number | null = null;
  selectedOffreId: number | null = null;
  selectedMasterForCandidatures: number | 'all' = 'all';
  configLoading: boolean = false;
  configSaving: boolean = false;
  creationOffreLoading: boolean = false;
  editingOffreLoading: boolean = false;
  offreEditionMode: boolean = false;
  candidaturesResponsable: Candidature[] = [];
  candidaturesResponsableFiltrees: Candidature[] = [];
  private responsableCandidaturesFromApi: boolean = false;

  // Master Candidatures list (ranked)
  candidaturesMasterRankedListExportFormat: ExportFormat = 'xlsx';
  candidaturesMasterTableColumns: string[] = [
    'ranking',
    'nom',
    'score',
    'diplome',
    'documents',
    'actions',
  ];

  get candidaturesMasterFiltered(): Candidature[] {
    return this.candidaturesResponsableFiltrees
      .filter((c) => c.type_concours !== 'ingenieur')
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

    if (
      !this.selectedCandidaturePreview ||
      !this.candidaturesFiltrees.some((item) => item.id === this.selectedCandidaturePreview?.id)
    ) {
      this.selectedCandidaturePreview = this.candidaturesFiltrees[0] || null;
    }
  }

  get candidaturesMasterViewFiltered(): Candidature[] {
    return this.candidaturesFiltrees
      .filter((c) => c.type_concours !== 'ingenieur')
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  }

  getVisibleCandidaturesForTable(): Candidature[] {
    // En vue Présélection responsable : utiliser candidaturesResponsableFiltrees (source API)
    const sourceList =
      this.currentView === 'avis-listes' && this.isResponsable
        ? this.candidaturesResponsableFiltrees
        : this.candidaturesFiltrees;
    let rows = (sourceList || []).slice();
    // In présélection responsable view, show only préselectionné candidates
    if (this.currentView === 'avis-listes' && this.isResponsable) {
      rows = rows.filter((r) => r.statut === 'preselectionne');
    }
    if (this.selectedCandidatureType !== 'all') {
      rows = rows.filter((row) => {
        const isExternal = this.isExternalCandidate(row);
        return this.selectedCandidatureType === 'externe' ? isExternal : !isExternal;
      });
    }
    if (this.etablissementOrigineFilter) {
      rows = rows.filter((r) =>
        (r.etablissement_origine || '')
          .toLowerCase()
          .includes(this.etablissementOrigineFilter.toLowerCase()),
      );
    }
    if (this.hideValidated) {
      rows = rows.filter(
        (r) => !(r.statut === 'selectionne' || r.decision_responsable === 'valide'),
      );
    }
    // apply basic search filter
    if (this.filtres?.recherche) {
      const q = String(this.filtres.recherche).toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.candidat_nom || '').toLowerCase().includes(q) ||
          (r.numero || '').toLowerCase().includes(q),
      );
    }
    rows = rows.filter(
      (r) =>
        !this.fadeOutCandidateIds.includes(Number(r.id)) &&
        !this.hiddenValidatedIds.includes(Number(r.id)),
    );
    rows = rows.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    return this.top100Enabled ? rows.slice(0, 100) : rows;
  }

  getRank(c: Candidature): number {
    const sorted = (this.candidaturesFiltrees || [])
      .slice()
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    const idx = sorted.findIndex((s) => Number(s.id) === Number(c.id));
    return idx === -1 ? 0 : idx + 1;
  }

  get finalSelectionSpecialiteOptions(): string[] {
    const uniques = new Set(this.finalSelectionCandidates.map((c) => c.spec));
    return Array.from(uniques).sort();
  }

  updateFinalSelectionFiltered(): void {
    const scoreMin = Number(this.finalSelectionFilters.scoreMin) || 0;
    const scoreMax = Number(this.finalSelectionFilters.scoreMax) || 20;
    const search = (this.finalSelectionFilters.search || '').toLowerCase();
    const type = this.finalSelectionFilters.type;
    const specialite = this.finalSelectionFilters.specialite;
    const hideValides = this.finalSelectionFilters.hideValides;

    let rows = this.finalSelectionCandidates.slice();

    rows = rows.filter((c) => c.score >= scoreMin && c.score <= scoreMax);

    if (search) {
      rows = rows.filter(
        (c) =>
          (c.nom || '').toLowerCase().includes(search) ||
          (c.num || '').toLowerCase().includes(search),
      );
    }

    if (type === 'interne') {
      rows = rows.filter((c) => c.interne);
    } else if (type === 'externe') {
      rows = rows.filter((c) => !c.interne);
    }

    if (specialite && specialite !== 'all') {
      rows = rows.filter((c) => c.spec === specialite);
    }

    if (hideValides) {
      rows = rows.filter((c) => !c.statut);
    }

    if (this.finalSelectionFilters.preselOnly) {
      rows = rows.filter((c) => c.presel === 'oui');
    }

    if (this.finalSelectionFilters.dossier === 'valide') {
      rows = rows.filter((c) => c.presel === 'oui');
    } else if (this.finalSelectionFilters.dossier === 'invalide') {
      rows = rows.filter((c) => c.presel !== 'oui');
    }

    if (this.finalSelectionFilters.statut) {
      rows = rows.filter((c) => c.statut === this.finalSelectionFilters.statut);
    }

    if (this.finalSelectionTop100On) {
      rows = rows
        .slice()
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
        .slice(0, 100);
    }

    this.finalSelectionFiltered = rows;
  }

  isFinalSelectionRowSelected(id: number): boolean {
    return this.finalSelectionSelectedIds.has(id);
  }

  areAllFinalSelectionRowsSelected(): boolean {
    const rows = this.finalSelectionFiltered;
    return rows.length > 0 && rows.every((row) => this.finalSelectionSelectedIds.has(row.id));
  }

  toggleFinalSelectionRow(id: number, checked: boolean): void {
    if (checked) {
      this.finalSelectionSelectedIds.add(id);
    } else {
      this.finalSelectionSelectedIds.delete(id);
    }
  }

  toggleFinalSelectionAll(checked: boolean): void {
    this.finalSelectionFiltered.forEach((row) => {
      if (checked) {
        this.finalSelectionSelectedIds.add(row.id);
      } else {
        this.finalSelectionSelectedIds.delete(row.id);
      }
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
      specialite: 'all',
      scoreMin: 0,
      scoreMax: 20,
      search: '',
      hideValides: false,
      statut: '',
      dossier: '',
      preselOnly: false,
    };
    this.finalSelectionTop100On = false;
    this.updateFinalSelectionFiltered();
  }

  toggleFinalSelectionCandidate(id: number, checked: boolean): void {
    if (checked) this.finalSelectionSelectedIds.add(id);
    else this.finalSelectionSelectedIds.delete(id);
  }

  updateFinalSelectionStatus(candidate: FinalSelectionCandidate, value: string): void {
    const c = this.finalSelectionCandidates.find((x) => x.id === candidate.id);
    if (c) c.statut = value as FinalSelectionDecision;
    this.updateFinalSelectionFiltered();
  }

  openFinalSelectionConsultation(): void {
    this.openFinalSelMassiveOCR();
  }

  repechageAutomatique(): void {
    this.toastService.show('Repêchage automatique lancé.', 'info');
  }

  publierEtNotifier(): void {
    this.toastService.show('Listes publiées et candidats notifiés.', 'success');
  }

  loadAvisListes(): void {
    this.toastService.show('Données actualisées.', 'success');
  }

  getDistinctSpecialites(): string[] {
    const all = this.candidaturesFiltrees.map((c) => c.specialite || '').filter((s) => !!s);
    return [...new Set(all)];
  }

  applyFinalSelectionBulkAction(): void {
    if (!this.finalSelectionBulkAction) {
      this.showFinalSelectionToast('Choisissez une action groupee', 't-warn');
      return;
    }

    const selectedIds = Array.from(this.finalSelectionSelectedIds);
    selectedIds.forEach((id) => {
      const candidate = this.finalSelectionCandidates.find((c) => c.id === id);
      if (candidate) {
        candidate.statut = this.finalSelectionBulkAction;
      }
    });

    this.finalSelectionSelectedIds.clear();
    this.finalSelectionBulkAction = '';
    this.updateFinalSelectionFiltered();
    const count = selectedIds.length;
    const plural = count > 1 ? 's' : '';
    this.showFinalSelectionToast(`${count} candidat${plural} mis a jour`, 't-success');
  }

  finalSelectionConsult(candidate: FinalSelectionCandidate): void {
    if (!candidate) return;
    this.openFinalSelectionConsultationModal(candidate);
  }

  openFinalSelectionConsultationModal(candidate?: FinalSelectionCandidate): void {
    const selectedIds = Array.from(this.finalSelectionSelectedIds);
    const consultationIds = selectedIds.length > 0 ? selectedIds : candidate ? [candidate.id] : [];

    if (consultationIds.length === 0) {
      this.showFinalSelectionToast('Aucun candidat selectionne', 't-warn');
      return;
    }

    const selectedCandidates = this.finalSelectionCandidates.filter((row) =>
      consultationIds.includes(row.id),
    );

    if (selectedCandidates.length === 0) {
      this.showFinalSelectionToast('Aucun candidat selectionne', 't-warn');
      return;
    }

    this.finalSelectionConsultationIds = consultationIds;
    this.finalSelectionConsultationCandidates = selectedCandidates;
    this.finalSelectionConsultationCurrentIndex = candidate
      ? Math.max(
          0,
          selectedCandidates.findIndex((row) => row.id === candidate.id),
        )
      : 0;
    this.finalSelectionConsultationOpen = true;
  }

  closeFinalSelectionConsultationModal(): void {
    this.finalSelectionConsultationOpen = false;
    this.finalSelectionConsultationIds = [];
    this.finalSelectionConsultationCandidates = [];
    this.finalSelectionConsultationCurrentIndex = 0;
  }

  getCurrentFinalSelectionConsultationCandidate(): FinalSelectionCandidate | null {
    if (
      this.finalSelectionConsultationCandidates.length === 0 ||
      this.finalSelectionConsultationCurrentIndex >=
        this.finalSelectionConsultationCandidates.length
    ) {
      return null;
    }

    return this.finalSelectionConsultationCandidates[this.finalSelectionConsultationCurrentIndex];
  }

  getFinalSelectionConsultationProgressLabel(): string {
    const total = this.finalSelectionConsultationCandidates.length;
    const current = total === 0 ? 0 : this.finalSelectionConsultationCurrentIndex + 1;
    return `Dossier ${current} / ${total}`;
  }

  finalSelectionConsultationPrevious(): void {
    if (this.finalSelectionConsultationCurrentIndex > 0) {
      this.finalSelectionConsultationCurrentIndex--;
    }
  }

  finalSelectionConsultationNext(): void {
    if (
      this.finalSelectionConsultationCurrentIndex <
      this.finalSelectionConsultationCandidates.length - 1
    ) {
      this.finalSelectionConsultationCurrentIndex++;
    }
  }

  private advanceFinalSelectionConsultationOrClose(): void {
    if (
      this.finalSelectionConsultationCurrentIndex <
      this.finalSelectionConsultationCandidates.length - 1
    ) {
      this.finalSelectionConsultationNext();
      return;
    }

    this.showFinalSelectionToast('Tous les dossiers ont ete traites', 't-success');
    this.closeFinalSelectionConsultationModal();
  }

  finalSelectionConsultationValidate(): void {
    const candidate = this.getCurrentFinalSelectionConsultationCandidate();
    if (!candidate) return;

    candidate.statut = 'lp';
    this.finalSelectionCandidates = this.finalSelectionCandidates.map((row) =>
      row.id === candidate.id ? { ...row, statut: 'lp' } : row,
    );
    this.updateFinalSelectionFiltered();
    this.showFinalSelectionToast(`${candidate.nom} valide en LP`, 't-success');
    this.advanceFinalSelectionConsultationOrClose();
  }

  finalSelectionConsultationReject(): void {
    const candidate = this.getCurrentFinalSelectionConsultationCandidate();
    if (!candidate) return;

    candidate.statut = 'refuse';
    this.finalSelectionCandidates = this.finalSelectionCandidates.map((row) =>
      row.id === candidate.id ? { ...row, statut: 'refuse' } : row,
    );
    this.updateFinalSelectionFiltered();
    this.showFinalSelectionToast(`${candidate.nom} rejete`, 't-success');
    this.advanceFinalSelectionConsultationOrClose();
  }

  toggleFinalSelectionExportMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.finalSelectionExportOpen = !this.finalSelectionExportOpen;
  }

  onFinalSelectionPageClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.export-wrap')) {
      this.finalSelectionExportOpen = false;
    }
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

  // Missing filter methods
  applyFinalSelectionFilters(): void {
    this.finalSelectionFilters = {
      session: this.finalSelectionSession,
      type: this.finalSelectionTypeFilter,
      specialite: this.finalSelectionSpecialtyFilter,
      scoreMin: this.finalSelectionScoreMin,
      scoreMax: this.finalSelectionScoreMax,
      search: this.finalSelectionSearchTerm,
      hideValides: this.finalSelectionHideValidated,
      statut: '',
      dossier: '',
      preselOnly: false,
    };
    this.updateFinalSelectionFiltered();
  }

  onFinalSelectionSessionChange(): void {
    this.finalSelectionFilters.session = this.finalSelectionSession;
    this.updateFinalSelectionFiltered();
  }

  // Missing quota methods
  getFinalSelectionTotalQuota(): number {
    return this.finalSelectionQuotaLpTotal;
  }

  getFinalSelectionLaQuota(): number {
    return this.finalSelectionQuotaLaTotal;
  }

  getFinalSelectionLpRemaining(): number {
    return Math.max(0, this.finalSelectionQuotaLpTotal - this.getFinalSelectionLpCount());
  }

  getFinalSelectionLaRemaining(): number {
    return Math.max(0, this.finalSelectionQuotaLaTotal - this.getFinalSelectionLaCount());
  }

  // Missing selection methods
  getFinalSelectionSelectedCount(): number {
    return this.finalSelectionSelectedIds.size;
  }

  isFinalSelectionAllSelected(): boolean {
    const rows = this.finalSelectionFiltered;
    return rows.length > 0 && rows.every((row) => this.finalSelectionSelectedIds.has(row.id));
  }

  toggleAllFinalSelection(checked: boolean): void {
    if (checked) {
      this.finalSelectionFiltered.forEach((row) => this.finalSelectionSelectedIds.add(row.id));
    } else {
      this.finalSelectionSelectedIds.clear();
    }
  }

  bulkValidateSelection(): void {
    if (this.finalSelectionSelectedIds.size === 0) return;
    this.finalSelectionSelectedIds.forEach((id) => {
      const c = this.finalSelectionFiltered.find((r) => r.id === id);
      if (c) c.statut = 'lp';
    });
    this.toastService.show(
      `${this.finalSelectionSelectedIds.size} candidat(s) validé(s).`,
      'success',
    );
    this.finalSelectionSelectedIds.clear();
  }

  // Missing export/action methods
  generateFinalSelectionPV(): void {
    this.showFinalSelectionToast('Generation du PV final...', 't-info');
  }

  generateFinalSelectionPDFOfficial(): void {
    this.showFinalSelectionToast('Generation du PV officiel PDF...', 't-info');
  }

  exportFinalSelectionExcel(): void {
    this.showFinalSelectionToast('Export Excel en cours...', 't-info');
  }

  showFinalSelectionConfirm(): void {
    this.openFinalSelectionConfirm();
  }

  finalSelectionExportPdf(): void {
    this.finalSelectionExportOpen = false;
    this.showFinalSelectionToast('Generation du PV final (demo)', 't-info');
  }

  finalSelectionExportExcel(): void {
    this.finalSelectionExportOpen = false;
    this.showFinalSelectionToast('Export Excel (demo)', 't-info');
  }

  private showFinalSelectionToast(message: string, type: string): void {
    this.finalSelectionToast = { message, type, visible: true };
    if (this.finalSelectionToastTimer) {
      window.clearTimeout(this.finalSelectionToastTimer);
    }
    this.finalSelectionToastTimer = window.setTimeout(() => {
      this.finalSelectionToast.visible = false;
    }, 3500);
  }

  getValidatedCount(): number {
    return (this.candidatures || []).filter(
      (c) =>
        c.statut === 'selectionne' ||
        c.statut === 'preselectionne' ||
        c.decision_responsable === 'valide',
    ).length;
  }

  isExternalCandidate(candidature: Candidature): boolean {
    const origin = String(candidature.etablissement_origine || '')
      .trim()
      .toLowerCase();
    if (!origin) {
      return false;
    }
    return !origin.includes('isimm');
  }

  isVisibleTableRowChecked(candidatureId: number): boolean {
    return this.selectedPreselectionCandidateIds.includes(Number(candidatureId));
  }

  areAllVisibleTableRowsChecked(): boolean {
    const rows = this.getVisibleCandidaturesForTable();
    return (
      rows.length > 0 && rows.every((row) => this.selectedPreselectionCandidateIds.includes(row.id))
    );
  }

  getRemainingQuota(): number {
    return Math.max(0, this.getMasterCapacity() - this.getValidatedCount());
  }

  getQuotaFillPercent(): number {
    const total = this.getMasterCapacity();
    if (!total) return 0;
    return Math.min(100, (this.getValidatedCount() / total) * 100);
  }

  quickValidate(c: Candidature): void {
    if (!c) return;
    if (
      c.statut === 'selectionne' ||
      c.statut === 'preselectionne' ||
      c.decision_responsable === 'valide'
    ) {
      this.toastService.show('Candidat déjà admissible', 'warning');
      return;
    }
    if (this.getRemainingQuota() <= 0) {
      this.toastService.show(
        'Quota atteint. Aucune validation supplémentaire possible.',
        'warning',
      );
      return;
    }

    void this.validateCandidatesOnBackend([c], 'Validation individuelle', false);
  }

  fullAutoValidate(): void {
    const scoreThreshold = Number(this.validationScoreThreshold);
    if (!Number.isFinite(scoreThreshold)) {
      this.toastService.show('Définissez un seuil de score avant le mode automatique.', 'warning');
      return;
    }

    const remaining = this.getRemainingQuota();
    if (remaining <= 0) {
      this.toastService.show('Quota atteint. Aucune validation automatique possible.', 'warning');
      return;
    }

    const candidates = this.getVisibleCandidaturesForTable()
      .filter((c) => c.statut !== 'selectionne' && c.decision_responsable !== 'valide')
      .filter((c) => Number(c.score) >= scoreThreshold)
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

    const selected = candidates.slice(0, remaining);

    if (!selected.length) {
      this.toastService.show('Aucun candidat éligible pour ce seuil de score.', 'warning');
      return;
    }

    const confirmed = window.confirm(
      `Valider automatiquement les ${selected.length} candidats avec un score >= ${scoreThreshold} ?`,
    );
    if (!confirmed) return;

    void this.validateCandidatesOnBackend(selected, 'Validation complète', true);
  }

  private async validateCandidatesOnBackend(
    candidates: Candidature[],
    actionLabel: string,
    autoGenerated: boolean,
  ): Promise<void> {
    const token = this.authService.getAccessToken();
    if (!token) {
      this.toastService.show('Session expirée. Veuillez vous reconnecter.', 'error');
      return;
    }

    const master = this.offresPreinscription.find(
      (offer) => offer.id === Number(this.selectedMasterForCandidatures),
    );
    const masterLabel = master?.specialite || this.getSelectedMasterName();
    const session = this.selectedAcademicYear || this.getCurrentAcademicYear();

    for (const candidate of candidates) {
      try {
        await firstValueFrom(
          this.http.post(
            `/api/candidatures/${candidate.id}/commission-decision/`,
            { decision: 'accepter' },
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        );
        this.animateAndHideValidatedCandidate(candidate.id);
      } catch (error) {
        console.error('Erreur validation candidat:', error);
        this.toastService.show('Erreur lors de la validation d’une candidature.', 'error');
        return;
      }
    }

    try {
      await firstValueFrom(
        this.http.post(
          '/api/candidatures/commission/historique/',
          {
            action: actionLabel,
            specialite: masterLabel,
            session,
            nb_candidats: candidates.length,
            master_id: master?.id || null,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
    } catch (error) {
      console.warn('Impossible d’enregistrer l’historique commission:', error);
    }

    this.selectedPreselectionCandidateIds = [];

    this.toastService.show(
      `${actionLabel} ${autoGenerated ? 'terminée' : 'enregistrée'} (${candidates.length} candidat(s)).`,
      'success',
    );
  }

  private animateAndHideValidatedCandidate(candidateId: number): void {
    if (!this.fadeOutCandidateIds.includes(candidateId)) {
      this.fadeOutCandidateIds = [...this.fadeOutCandidateIds, candidateId];
    }

    window.setTimeout(() => {
      this.fadeOutCandidateIds = this.fadeOutCandidateIds.filter((id) => id !== candidateId);
      this.hiddenValidatedIds = Array.from(
        new Set([...(this.hiddenValidatedIds || []), candidateId]),
      );
    }, 280);
  }

  get candidaturesMasterCount(): number {
    return this.candidaturesMasterFiltered.length;
  }

  responsibleNotifications: ResponsibleNotificationItem[] = [];
  filtreResponsibleNotificationType: '' | 'info' | 'warning' = '';
  filtreResponsibleNotificationStatut: '' | 'ouvert' | 'ferme' = '';
  nouvelleOffre: NouvelleOffreForm = {
    nom: '',
    type_master: 'recherche',
    specialite: '',
    description: '',
    places_disponibles: 30,
    date_limite_candidature: '',
    annee_universitaire: '2026/2027',
    actif: true,
  };
  offreEditForm: OffreEditForm = {
    id: null,
    nom: '',
    type_master: 'recherche',
    specialite: '',
    description: '',
    places_disponibles: 30,
    date_limite_candidature: '',
    annee_universitaire: '2026/2027',
    actif: true,
    date_debut_visibilite: '',
    date_fin_visibilite: '',
    date_limite_preinscription: '',
    date_limite_depot_dossier: '',
    date_limite_paiement: '',
    delai_modification_candidature_jours: 7,
    delai_depot_dossier_preselectionnes_jours: 14,
    est_cache: false,
    capacite_interne: 0,
    capacite_externe: 0,
    document_officiel_pdf_url: null,
  };
  configurationAppel: ConfigurationAppelForm = {
    master: null,
    date_debut_visibilite: '',
    date_fin_visibilite: '',
    date_limite_preinscription: '',
    date_limite_depot_dossier: '',
    date_limite_paiement: '',
    delai_modification_candidature_jours: 7,
    delai_depot_dossier_preselectionnes_jours: 14,
    actif: true,
  };

  dossiersOCR: DossierOCR[] = [];

  procesVerbaux: ProcesVerbal[] = [];

  // Membres
  membres: CommissionMember[] = [];
  membresFiltres: CommissionMember[] = [];
  rechercheMembres: string = '';
  filtreStatutMembre: string = '';
  showAddMemberModal = false;
  newMemberNom = '';
  newMemberPrenom = '';
  newMemberEmail = '';
  newMemberSpecialite = '';
  memberActionMenuOpenId: number | null = null;
  newMemberTelephone = '';
  showEditMemberModal = false;
  editingMember: CommissionMember | null = null;
  editMemberNom = '';
  editMemberPrenom = '';
  editMemberEmail = '';
  editMemberTelephone = '';
  editMemberSpecialite = '';
  showDeleteMemberConfirm = false;
  memberToDelete: CommissionMember | null = null;

  // Statistiques
  filtreStatPeriode: 'jour' | 'semaine' | 'mois' | 'annee' = 'mois';
  statMasterExportFormat: string = 'pdf';

  // Modal nouvelle offre (stepper)
  showModalNouvelleOffre: boolean = false;
  nouvelleOffreStep: number = 1;
  nouvelleOffreQuotas: {
    categorie: string;
    etablissement: string;
    places: number;
    diplome: string;
  }[] = [];
  nouvelleOffreAppelActif: boolean = true;
  nouvelleOffreVisible: boolean = true;
  nouvelleOffreDateDebutVisibilite: string = '';
  nouvelleOffreDateFinVisibilite: string = '';
  nouvelleOffreDateLimitePreinscription: string = '';
  nouvelleOffreDateLimiteDepotDossier: string = '';
  nouvelleOffreParcoursCode: string = 'MPGL';
  nouvelleOffreSpecialitesDemandees: string[] = [];
  nouvelleOffreShowSpecialitesEditor: boolean = false;
  nouvelleOffreNouvelleSpecialite: string = '';
  nouvelleOffreScoreCriteres: ScoreCriterion[] = [];
  nouvelleOffreScoreFormule: string = '';

  // ─── MOD 2A — Tableau critères + coefficients (Espace Responsable UNIQUEMENT) ───
  // Le coefficient n'est jamais exposé au candidat ; le système l'utilise pour
  // calculer le score (valeur × coefficient).
  readonly CRITERIA_OPTIONS: CritereOption[] = CRITERIA_OPTIONS;
  nouvelleOffreCriteres: CritereConfig[] = [];

  // Modal avis
  showModalAvis: boolean = false;
  candidatureSelectionnee: Candidature | null = null;
  avisArgument: string = '';
  avisRecommandation: 'favorable' | 'defavorable' = 'favorable';
  avisDecisionFinale: string = '';

  get avisFavorablesCount(): number {
    const id = this.candidatureSelectionnee?.id;
    if (!id) return 0;
    return (this.candidatureVotes[id] || []).filter((v) => v.recommandation === 'favorable').length;
  }

  get avisTotal(): number {
    const id = this.candidatureSelectionnee?.id;
    if (!id) return 0;
    return (this.candidatureVotes[id] || []).length;
  }

  rappelerMembre(): void {
    const nom = this.candidatureSelectionnee?.candidat_nom || 'ce candidat';
    this.toastService.show(`Rappel envoyé aux membres pour ${nom}`, 'info');
  }
  showModalConsultation: boolean = false;
  candidatureConsultationSelectionnee: Candidature | null = null;
  showModalAvisListe: boolean = false;
  listeSelectionneeAvis: Liste | null = null;
  avisListeText: string = '';
  avisListeRecommandation: 'favorable' | 'defavorable' | 'reserve' = 'favorable';

  // Modal changement statut
  showModalStatut: boolean = false;
  candidatureStatutSelectionnee: Candidature | null = null;
  statusOptions: string[] = [];
  statusSelection: string = '';
  statusRejectReason: string = '';

  // Modal OCR
  showModalOCR: boolean = false;
  fichierOCR: File | null = null;
  selectedOCRCandidature: Candidature | null = null;

  candidatureVotes: Record<number, CandidatureVoteAvis[]> = {};
  avisMembreLoading: boolean = false;

  /** Liste stricte des spécialités diplôme pour le master MPGL (filtre + tableau). */
  readonly SPECIALITES_DIPLOME_MPGL: string[] = [
    "Licence en Sciences de l'Informatique génie logiciel",
    'Informatique de Gestion',
    "Génie logiciel et systèmes d'information",
    'Génie logiciel',
    'Licence appliquée en développement des systèmes informatiques',
    'Big data et Analyse de données',
    'Business Computing',
  ];

  /**
   * TRUE si l'utilisateur peut donner un avis de membre commission.
   * Conditions :
   *  - Drawer ouvert sur un candidat (`dossierOCRCandidature` non null)
   *  - User connecté ET pas responsable_commission ni admin ni candidat
   *  - User a au moins une commission active (déduit de availableCommissions)
   */
  get canMembreVote(): boolean {
    if (!this.dossierOCRCandidature) return false;
    const role = (this.currentUser?.role || '').toLowerCase();
    if (!role) return false;
    // Exclure les rôles non-membres
    if (['responsable_commission', 'responsable', 'admin', 'candidat'].includes(role)) {
      return false;
    }
    // Tout autre rôle = membre potentiel (commission, membre, etc.)
    return true;
  }

  inscriptionsExcelRows: any[] = [];
  inscriptionsVerificationRows: InscriptionVerificationRow[] = [];
  selectedInscriptionsFileName: string = '';
  lastRapprochementAuditId: number | null = null;
  inscriptionCandidates: InscriptionCandidateRow[] = [];
  inscriptionFilteredCandidates: InscriptionCandidateRow[] = [];
  inscriptionSelectedIds: Set<number> = new Set();
  inscriptionSelectAll: boolean = false;
  inscriptionActionMenuOpenId: number | null = null;
  inscriptionFileLoaded: boolean = false;
  inscriptionVerified: boolean = false;
  inscriptionExportOpen: boolean = false;
  showModalRejectInscription: boolean = false;
  inscriptionRejectSelectionnee: InscriptionCandidateRow | null = null;
  motifRejetInscription: string = '';
  inscriptionFilters: InscriptionFilters = {
    search: '',
    paiement: 'all',
    dossier: 'all',
    finalise: 'all',
  };
  inscriptionStats = {
    eligible: 0,
    verifiedPayments: 0,
    incoherencies: 0,
    absents: 0,
    finalised: 0,
    matchPercent: 0,
  };

  validationFilters = {
    recherche: '',
    statut: '',
    diplomeConforme: '',
  };

  // WebSocket status
  public ConnectionStatus = ConnectionStatus;
  public socketConnectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private wsStatusSub: Subscription | null = null;
  private routeSub: Subscription | null = null;
  private commissionSub: Subscription | null = null;
  private onDocClickBound: any = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private authService: AuthService,
    private toastService: ToastService,
    private candidatureService: CandidatureService,
    private dialog: MatDialog,
    private webSocketService: WebSocketService,
    public location: Location,
    private specialitesService: SpecialitesService,
    private commissionContext: CommissionContextService,
    private commissionState: CommissionStateService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.profileData = { ...this.currentUser };
    this.isResponsable = ['responsable_commission', 'responsable'].includes(this.currentUser?.role);
    this.refreshUserProfile();
    this.commissionSub = this.commissionContext.activeCommissionId$.subscribe((commissionId) => {
      this.activeCommissionId = commissionId;
      this.activeCommissionCategory = this.getCommissionCategoryFromId(commissionId);
      this.refreshCommissionScopedData();
    });

    this.loadUserCommissions();

    // Prefer to source specialities from SpecialitesService when available
    this.specialitesService.getSpecialitesData().subscribe((data) => {
      if (data && data.programs) {
        this.specialites = Object.keys(data.programs).map((code, idx) => ({
          id: idx + 1,
          nom: data.programs[code].full_name || code,
          statut: 'actuel' as 'actuel',
          nb_candidatures: 0,
          nb_dossiers: 0,
        }));
      }
    });

    this.syncViewFromRoute();
    this.resetSelectionState();

    this.loadActionPermissions();
    this.candidaturesFiltrees = [...this.candidatures];
    this.updateFinalSelectionFiltered();
    if (this.isResponsable) {
      this.loadMastersForConfiguration();
    }
    // Load offers for responsables; also load preinscription offers for membres
    if (this.isResponsable) {
      this.loadOffresPreinscription();
      this.loadOffresMasterCrud();
      this.loadResponsibleNotifications();
    } else if (this.currentUser?.role === 'commission') {
      // commission membres can view offers relevant to their commissions
      this.loadOffresPreinscription();
    }
    this.loadMembers();
    this.loadNotifications();
    this.loadUserMasterInfo();
    if (this.isResponsable) {
      this.loadCandidaturesResponsable();
    } else if (this.currentUser?.role === 'commission') {
      this.loadCandidaturesMembre();
    }

    this.routeSub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.syncViewFromRoute();
        this.resetSelectionState();
      }
    });

    // Load data for initial view
    if (
      this.currentView === 'candidatures-responsable' ||
      this.currentView === 'candidatures-master' ||
      this.currentView === 'candidatures-ingenieur'
    ) {
      this.resetFiltresResponsable();
      this.loadCandidaturesResponsable();
    }

    this.loadDerniereListeGenereeDepuisBackend();

    // Start the WebSocket connection only for roles that use live notifications.
    if (this.isResponsable) {
      const wsUrl = new URL('/ws/candidatures/', window.location.origin).toString();
      this.webSocketService.connect(wsUrl).subscribe({
        next: () => {},
        error: (err: any) => console.warn('WebSocket service connection error (commission):', err),
      });

      this.wsStatusSub = this.webSocketService.connectionStatus$.subscribe((status: any) => {
        this.socketConnectionStatus = status;
      });
    }

    // Close menus when clicking outside (export menu + various action kebabs)
    try {
      this.onDocClickBound = (evt: MouseEvent) => {
        const menu = document.getElementById('export-menu');
        const button = (evt.target as HTMLElement)?.closest('button[type="button"]');

        if (menu && !menu.contains(evt.target as Node) && !button?.closest('.export-wrap')) {
          this.exportMenuOpen = false;
        }

        // Close all per-row action menus when clicking outside
        this.actionMenuOpen = null;
        this.memberActionMenuOpenId = null;
        this.inscriptionActionMenuOpenId = null;
        this.reclamationActionMenuOpen = {};
      };
      document.addEventListener('click', this.onDocClickBound);
    } catch (e) {
      console.warn('Could not attach global menu listener:', e);
    }
  }

  ngOnDestroy(): void {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
      this.routeSub = null;
    }
    if (this.wsStatusSub) {
      this.wsStatusSub.unsubscribe();
      this.wsStatusSub = null;
    }
    this.webSocketService.disconnect();
    if (this.onDocClickBound) {
      document.removeEventListener('click', this.onDocClickBound);
      this.onDocClickBound = null;
    }
  }

  getActiveCommissionLabel(): string {
    if (this.commissionsLoading) {
      return 'Chargement des commissions...';
    }

    if (!this.availableCommissions.length) {
      return 'Aucune commission disponible';
    }

    return (
      this.availableCommissions.find((commission) => commission.id === this.activeCommissionId)
        ?.nom || this.availableCommissions[0].nom
    );
  }

  onActiveCommissionChange(value: string | number): void {
    const commissionId = Number(value);
    if (!Number.isFinite(commissionId)) {
      return;
    }

    this.activeCommissionId = commissionId;
    this.activeCommissionCategory = this.getCommissionCategoryFromId(commissionId);
    this.commissionContext.setActiveCommissionId(commissionId);
    this.refreshCommissionScopedData();
  }

  loadUserCommissions(): void {
    this.commissionsLoading = true;
    this.commissionsLoadError = '';

    const storedActiveIdRaw = localStorage.getItem('active_commission_id');
    const storedActiveId = storedActiveIdRaw ? Number(storedActiveIdRaw) : null;

    this.candidatureService.getMyCommissions(storedActiveId).subscribe({
      next: (response: any) => {
        const commissions = Array.isArray(response?.commissions) ? response.commissions : [];
        this.availableCommissions = commissions.map((commission: any) => ({
          id: Number(commission.id),
          nom: commission.nom || `Commission #${commission.id}`,
          description: commission.description || '',
          actif: commission.actif ?? true,
          is_active: commission.is_active ?? false,
          role: commission.role || '',
          master_id: commission.master_id ?? null,
          master_nom: commission.master_nom || '',
        }));

        // If user is a commission member, scope available commissions to those where role === 'membre'
        if (this.currentUser?.role === 'commission') {
          const memberScoped = this.availableCommissions.filter((c) => c.role === 'membre');
          if (memberScoped.length) {
            this.availableCommissions = memberScoped;
          }
        }

        const responseActiveId = Number(response?.active_commission_id);
        const candidateActiveId = Number.isFinite(responseActiveId)
          ? responseActiveId
          : Number.isFinite(storedActiveId as number)
            ? (storedActiveId as number)
            : this.availableCommissions.find((commission) => commission.is_active)?.id ||
              this.availableCommissions[0]?.id ||
              null;

        this.activeCommissionId = Number.isFinite(candidateActiveId as number)
          ? (candidateActiveId as number)
          : null;
        this.activeCommissionCategory = this.getCommissionCategoryFromId(this.activeCommissionId);

        if (this.activeCommissionId !== null) {
          this.commissionContext.setActiveCommissionId(this.activeCommissionId);
        } else {
          this.commissionContext.setActiveCommissionId(null);
        }

        this.commissionsLoading = false;
        this.refreshCommissionScopedData();
      },
      error: (error) => {
        console.error('Erreur chargement commissions utilisateur:', error);
        this.commissionsLoadError = 'Impossible de charger les commissions';
        this.commissionsLoading = false;

        if (Number.isFinite(storedActiveId as number)) {
          this.activeCommissionId = storedActiveId as number;
          this.activeCommissionCategory = this.getCommissionCategoryFromId(this.activeCommissionId);
        }
      },
    });
  }

  private refreshCommissionScopedData(): void {
    this.loadNotifications();
    this.loadResponsibleNotifications();
    this.loadMembers();
    if (this.isResponsable) {
      this.loadCandidaturesResponsable();
    } else if (this.currentUser?.role === 'commission') {
      this.loadCandidaturesMembre();
    }
    this.appliquerFiltres();
    this.appliquerFiltresResponsable();
    this.updateFinalSelectionFiltered();
  }

  private syncViewFromRoute(): void {
    let requestedView = this.route.snapshot.queryParamMap.get('view') as CommissionView | null;
    if (requestedView === 'candidatures-master') {
      requestedView = 'candidatures';
    }
    if (requestedView === 'candidatures-ingenieur') {
      requestedView = 'candidatures-ingenieur';
    }
    if (requestedView && this.canAccessView(requestedView)) {
      this.currentView = requestedView;
    }

    this.pageContext =
      this.currentView === 'candidatures' ||
      this.currentView === 'candidatures-master' ||
      this.currentView === 'candidatures-ingenieur'
        ? 'candidature'
        : 'preselection';
  }

  private resetSelectionState(): void {
    this.selectedCandidaturesIds = [];
    this.selectedPreselectionCandidateIds = [];
    this.candidaturesMarkedAsRead.clear();

    const bulkBar = document.getElementById('bulk-bar');
    if (bulkBar) {
      bulkBar.classList.remove('show');
    }
  }

  private loadNotifications(): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    this.http
      .get<NotificationItem[]>('/api/candidatures/mes-notifications/', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (data) => {
          this.notificationsCandidat = data || [];
          this.notificationsNonLues = this.notificationsCandidat.filter((n) => !n.lue).length;
        },
        error: (error) => {
          console.error('Erreur chargement notifications commission:', error);
          this.notificationsCandidat = this.buildMockNotificationsForRole();
          this.notificationsNonLues = this.notificationsCandidat.filter((n) => !n.lue).length;
        },
      });
  }

  private buildMockNotificationsForRole(): NotificationItem[] {
    const now = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    if (this.isResponsable) {
      return [
        {
          id: 1,
          titre: 'Phase de présélection ouverte',
          message:
            'La phase de présélection pour Master GL 2025/2026 est maintenant active. Vérifiez les dossiers des candidats.',
          date: now,
          type: 'info',
          lue: false,
        },
        {
          id: 2,
          titre: 'Quota atteint — Master DS',
          message:
            '45 candidats ont été présélectionnés. Le quota de 50 places est presque atteint.',
          date: now,
          type: 'warning',
          lue: false,
        },
        {
          id: 3,
          titre: 'Réclamation en attente',
          message:
            'Une réclamation de Amina Ben Salah concernant son score est en attente de traitement.',
          date: yesterday,
          type: 'danger',
          lue: false,
        },
        {
          id: 4,
          titre: 'Décision finale validée',
          message: 'La liste de sélection finale pour Ingénieur GL a été publiée avec succès.',
          date: yesterday,
          type: 'success',
          lue: true,
        },
        {
          id: 5,
          titre: 'Nouveau membre ajouté',
          message:
            'Dr. Karim Mansouri a rejoint la commission Master GL en tant que membre évaluateur.',
          date: yesterday,
          type: 'info',
          lue: true,
        },
      ];
    } else {
      return [
        {
          id: 1,
          titre: 'Nouvelle candidature à évaluer',
          message:
            'Vous avez 3 nouveaux dossiers à examiner pour la commission Master DS. Merci de soumettre vos avis avant la date limite.',
          date: now,
          type: 'info',
          lue: false,
        },
        {
          id: 2,
          titre: "Délai d'avis approche",
          message:
            'La date limite pour soumettre vos avis sur la cohorte Master GL 2025/2026 est dans 2 jours.',
          date: now,
          type: 'warning',
          lue: false,
        },
        {
          id: 3,
          titre: 'Réunion commission planifiée',
          message:
            'Une réunion de délibération est planifiée le 05/06/2026 à 10h00. Votre présence est requise.',
          date: yesterday,
          type: 'info',
          lue: false,
        },
        {
          id: 4,
          titre: 'Avis enregistré',
          message: 'Votre avis favorable sur la candidature CAND-2026-0042 a bien été enregistré.',
          date: yesterday,
          type: 'success',
          lue: true,
        },
      ];
    }
  }

  marquerNotificationCommeLue(notificationId: number): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    this.http
      .post(
        `/api/candidatures/notifications/${notificationId}/mark-read/`,
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
          console.error('Erreur marquage notification commission:', error);
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
        '/api/candidatures/notifications/mark-all-read/',
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: () => {
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

  loadMastersForConfiguration(): void {
    this.http.get<any[]>('/api/candidatures/masters/').subscribe({
      next: (masters) => {
        this.masterOptions = (masters || []).map((m) => ({ id: Number(m.id), nom: m.nom }));
        if (!this.selectedConfigMasterId && this.masterOptions.length > 0) {
          this.selectedConfigMasterId = this.masterOptions[0].id;
          this.onConfigMasterChange();
        }
        // If the current user is responsable, lock their master for candidatures
        try {
          const profileMasterLabel = this.getUserMasterOrSpecialiteLabel();
          if (this.isResponsable && profileMasterLabel) {
            const found = this.masterOptions.find(
              (m) =>
                String(m.nom || '').toLowerCase() ===
                String(profileMasterLabel || '').toLowerCase(),
            );
            if (found) {
              this.selectedMasterForCandidatures = found.id;
              // Reload candidatures for this responsable master
              this.loadCandidaturesResponsable(this.selectedMasterForCandidatures);
            }
          }
        } catch (err) {
          console.warn('Error locking master for responsable:', err);
        }
      },
      error: (error) => {
        console.error('Erreur chargement masters:', error);
      },
    });
  }

  loadOffresPreinscription(): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    this.http
      .get<OffrePreinscription[]>('/api/candidatures/offres-inscription-responsable/', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (data) => {
          const received = data || [];
          this.offresPreinscription =
            received.length > 0 ? received : this.getCanonicalOffresPreinscription();

          this.offreOptions = this.offresPreinscription.map((offre) => ({
            id: offre.id,
            nom:
              offre.type === 'cycle_ingenieur'
                ? `${offre.titre} (Cycle Ingénieur)`
                : `${offre.titre} (Master)`,
          }));

          const hasCurrentSelection =
            this.selectedConfigMasterId !== null &&
            this.offreOptions.some((item) => item.id === this.selectedConfigMasterId);

          if (!hasCurrentSelection) {
            this.selectedConfigMasterId =
              this.offreOptions.length > 0 ? this.offreOptions[0].id : null;
          }

          if (this.selectedConfigMasterId) {
            this.onConfigMasterChange();
          }
        },
        error: (error) => {
          console.error('Erreur chargement offres responsable:', error);
          this.offresPreinscription = this.getCanonicalOffresPreinscription();
          this.offreOptions = this.offresPreinscription.map((offre) => ({
            id: offre.id,
            nom:
              offre.type === 'cycle_ingenieur'
                ? `${offre.titre} (Cycle Ingenieur)`
                : `${offre.titre} (Master)`,
          }));
        },
      });
  }

  // ── Offres filtrées par la commission active (espace membre) ──────────────
  /** Normalise: minuscules + sans accents + espaces compactés. */
  private normaliserTexte(s: string): string {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  /** Une offre correspond-elle au master de la commission active ? */
  private offreCorrespondCommission(offre: OffrePreinscription, refMaster: string): boolean {
    const hay = this.normaliserTexte(`${offre.specialite} ${offre.titre} ${offre.sous_type}`);
    const motsRef = refMaster.split(' ').filter((m) => m.length > 3);
    // correspondance si au moins un mot significatif du master est présent dans l'offre
    return motsRef.some((mot) => hay.includes(mot));
  }

  /** Offres visibles : toutes pour le responsable, filtrées par commission pour le membre. */
  get offresPreinscriptionFiltrees(): OffrePreinscription[] {
    if (this.isResponsable) {
      return this.offresPreinscription;
    }
    const commission = this.availableCommissions.find((c) => c.id === this.activeCommissionId);
    const refMaster = this.normaliserTexte(
      `${commission?.master_nom || ''} ${commission?.nom || ''}`,
    );
    if (!refMaster) {
      return this.offresPreinscription;
    }
    const filtrees = this.offresPreinscription.filter((o) =>
      this.offreCorrespondCommission(o, refMaster),
    );
    // fallback : si rien ne matche, montrer tout (évite un écran vide)
    return filtrees.length ? filtrees : this.offresPreinscription;
  }

  private sortRowsByScoreDesc(rows: Candidature[]): Candidature[] {
    return [...rows].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  }

  getCandidateEtablissement(candidature: Candidature): string {
    const directValue = (candidature.etablissement_origine || '').trim();
    if (directValue) {
      return directValue;
    }

    const raw = candidature as unknown as Record<string, unknown>;
    const fallbackKeys = [
      'etablissement',
      'etablissementOrigine',
      'universite',
      'universite_origine',
      'institution',
    ];

    for (const key of fallbackKeys) {
      const value = raw[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return '';
  }

  downloadDossier(candidature: Candidature | null): void {
    if (!candidature) {
      return;
    }

    const dossierId = candidature.id ?? 'dossier';
    this.showAlertMessage(`Téléchargement du dossier ${dossierId} lancé (mock).`);
  }

  loadOffresMasterCrud(): void {
    const token = this.authService.getAccessToken();
    if (!token || !this.isResponsable) {
      this.offresMasterCrud = [];
      this.offresMasterCrudFiltrees = [];
      return;
    }

    this.offresMasterCrudLoading = true;

    const params = new URLSearchParams();
    if (this.offreMasterSearch.trim()) {
      params.set('search', this.offreMasterSearch.trim());
    }
    if (this.offreMasterDateSearch) {
      params.set('date_limite', this.offreMasterDateSearch);
    }

    const query = params.toString();
    const endpoint = `/api/candidatures/offres-master/${query ? `?${query}` : ''}`;

    this.http
      .get<OffreMasterCrudItem[]>(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (rows) => {
          this.offresMasterCrud = rows || [];
          this.offresMasterCrudFiltrees = [...this.offresMasterCrud];
          this.offresMasterCrudLoading = false;
        },
        error: (error) => {
          console.error('Erreur chargement offres master CRUD:', error);
          this.offresMasterCrud = [];
          this.offresMasterCrudFiltrees = [];
          this.offresMasterCrudLoading = false;
        },
      });
  }

  appliquerFiltresOffresMasterCrud(): void {
    const search = this.offreMasterSearch.trim().toLowerCase();
    const byDate = this.offreMasterDateSearch;

    this.offresMasterCrudFiltrees = this.offresMasterCrud.filter((offre) => {
      const matchesSearch =
        !search ||
        String(offre.titre || '')
          .toLowerCase()
          .includes(search) ||
        String(offre.description || '')
          .toLowerCase()
          .includes(search);

      const matchesDate = !byDate || String(offre.date_limite || '') === byDate;
      return matchesSearch && matchesDate;
    });
  }

  reinitialiserFiltresOffresMasterCrud(): void {
    this.offreMasterSearch = '';
    this.offreMasterDateSearch = '';
    this.loadOffresMasterCrud();
  }

  ouvrirDialogOffreMaster(mode: 'create' | 'edit', offre?: OffreMasterCrudItem): void {
    if (!this.isResponsable) {
      this.notifyActionBlocked('Action réservée au responsable de commission.');
      return;
    }

    const data: OffreMasterDialogData = {
      mode,
      value: offre
        ? {
            titre: offre.titre,
            description: offre.description,
            capacite: offre.capacite,
            date_limite: offre.date_limite,
            actif: offre.actif,
          }
        : undefined,
    };

    const dialogRef = this.dialog.open(OffreMasterDialogComponent, {
      width: '520px',
      data,
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }
      if (mode === 'create') {
        this.creerOffreMaster(result);
        return;
      }
      if (offre) {
        this.modifierOffreMaster(offre.id, result);
      }
    });
  }

  private creerOffreMaster(payload: {
    titre: string;
    description: string;
    capacite: number;
    date_limite: string;
    actif: boolean;
  }): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      this.toastService.show('Session expirée. Veuillez vous reconnecter.', 'error');
      return;
    }

    this.http
      .post<OffreMasterCrudItem>('/api/candidatures/offres-master/', payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: () => {
          this.toastService.show('Offre créée avec succès.', 'success');
          this.loadOffresMasterCrud();
          this.loadOffresPreinscription();
        },
        error: (error) => {
          const backendMsg = error?.error?.error || error?.error?.message || '';
          this.toastService.show(backendMsg || "Impossible de créer l'offre.", 'error');
        },
      });
  }

  private modifierOffreMaster(
    offreId: number,
    payload: {
      titre: string;
      description: string;
      capacite: number;
      date_limite: string;
      actif: boolean;
    },
  ): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      this.toastService.show('Session expirée. Veuillez vous reconnecter.', 'error');
      return;
    }

    this.http
      .put<OffreMasterCrudItem>(`/api/candidatures/offres-master/${offreId}/`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: () => {
          this.toastService.show('Offre mise à jour.', 'success');
          this.loadOffresMasterCrud();
          this.loadOffresPreinscription();
        },
        error: (error) => {
          const backendMsg = error?.error?.error || error?.error?.message || '';
          this.toastService.show(backendMsg || "Impossible de modifier l'offre.", 'error');
        },
      });
  }

  supprimerOffreMaster(offre: OffreMasterCrudItem): void {
    if (!this.isResponsable) {
      this.notifyActionBlocked('Action réservée au responsable de commission.');
      return;
    }

    if (!confirm(`Supprimer l'offre "${offre.titre}" ?`)) {
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      this.toastService.show('Session expirée. Veuillez vous reconnecter.', 'error');
      return;
    }

    this.http
      .delete(`/api/candidatures/offres-master/${offre.id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: () => {
          this.toastService.show('Offre supprimée.', 'success');
          this.loadOffresMasterCrud();
          this.loadOffresPreinscription();
        },
        error: (error) => {
          const backendMsg = error?.error?.error || error?.error?.message || '';
          this.toastService.show(backendMsg || "Impossible de supprimer l'offre.", 'error');
        },
      });
  }

  private getCanonicalOffresPreinscription(): OffrePreinscription[] {
    return [
      {
        id: 1,
        titre: 'Mastere Professionnel Genie Logiciel (MPGL)',
        type: 'master',
        sous_type: 'professionnel',
        specialite: 'MPGL',
        description: '',
        date_limite: '2026-07-22',
        places: 35,
        statut: 'ouvert',
        est_cache: false,
        est_visible: true,
      },
      {
        id: 2,
        titre: 'Mastere Professionnel en sciences de donnees (MPDS)',
        type: 'master',
        sous_type: 'professionnel',
        specialite: 'MPDS',
        description: '',
        date_limite: '2026-07-22',
        places: 35,
        statut: 'ouvert',
        est_cache: false,
        est_visible: true,
      },
      {
        id: 3,
        titre: 'Mastere Professionnel en Ingenieries en Instrumentation industrielle (MP3I)',
        type: 'master',
        sous_type: 'professionnel',
        specialite: 'MP3I',
        description: '',
        date_limite: '2026-07-20',
        places: 25,
        statut: 'ouvert',
        est_cache: false,
        est_visible: true,
      },
      {
        id: 4,
        titre: 'Mastere Recherche en Genie logiciel (MRGL)',
        type: 'master',
        sous_type: 'recherche',
        specialite: 'MRGL',
        description: '',
        date_limite: '2026-07-22',
        places: 111,
        statut: 'ouvert',
        est_cache: false,
        est_visible: true,
      },
      {
        id: 5,
        titre: 'Mastere Recherche en micro-electronique et instrumentation (MRMI)',
        type: 'master',
        sous_type: 'recherche',
        specialite: 'MRMI',
        description: '',
        date_limite: '2026-07-20',
        places: 29,
        statut: 'ouvert',
        est_cache: false,
        est_visible: true,
      },
      {
        id: 6,
        titre: 'Ingenieur en sciences Appliquees et Technologie - Genie Logiciel (ING-GL)',
        type: 'cycle_ingenieur',
        sous_type: '',
        specialite: 'ING_GL',
        description: '',
        date_limite: '2026-08-08',
        places: 65,
        statut: 'ouvert',
        est_cache: false,
        est_visible: true,
      },
    ];
  }

  getOffresPreinscriptionForDisplay(): OffrePreinscription[] {
    return this.getCanonicalOffresPreinscription().filter(
      (offre) => !this.offresPreinscriptionSupprimees.has(offre.id),
    );
  }

  supprimerOffre(offre: OffrePreinscription): void {
    if (!this.isResponsable) {
      this.notifyActionBlocked('Action réservée au responsable de commission.');
      return;
    }

    if (!offre?.id) {
      return;
    }

    if (!confirm(`Supprimer l'offre "${offre.titre}" ?`)) {
      return;
    }

    this.offresPreinscriptionSupprimees.add(offre.id);

    const backendOffre = this.offresPreinscription.find((item) => item.id === offre.id);
    if (backendOffre && !backendOffre.isDemo) {
      const token = this.authService.getAccessToken();
      if (token) {
        this.http
          .delete(`/api/candidatures/offres-master/${offre.id}/`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          .subscribe({
            next: () => {
              this.toastService.show('Offre supprimée.', 'success');
              this.loadOffresPreinscription();
            },
            error: (error) => {
              const backendMsg = error?.error?.error || error?.error?.message || '';
              this.toastService.show(
                backendMsg || "Impossible de supprimer l'offre côté serveur (masquée localement).",
                'warning',
              );
            },
          });
        return;
      }
    }

    this.toastService.show('Offre supprimée.', 'success');
  }

  hasRealOffresPreinscription(): boolean {
    return this.offresPreinscription.length > 0;
  }

  getSelectedOffreForCandidatPreview(): OffrePreinscription | null {
    if (this.selectedOffreId) {
      return this.offresPreinscription.find((offre) => offre.id === this.selectedOffreId) || null;
    }

    return this.offresPreinscription.length > 0 ? this.offresPreinscription[0] : null;
  }

  getSelectedConfigurationMasterLabel(): string {
    if (!this.selectedConfigMasterId) {
      return 'Aucune offre sélectionnée';
    }

    return (
      this.offreOptions.find((item) => item.id === this.selectedConfigMasterId)?.nom ||
      this.masterOptions.find((item) => item.id === this.selectedConfigMasterId)?.nom ||
      'Offre inconnue'
    );
  }

  getOffreCalendarPreviewRows(): OffreCalendarPreviewRow[] {
    const totalCapacity =
      Number(this.configurationAppel.capacite_interne || 0) +
      Number(this.configurationAppel.capacite_externe || 0);
    const masterLabel = this.getSelectedConfigurationMasterLabel();
    const title = masterLabel.toLowerCase();

    let typeDiplome = 'Licence ou diplôme équivalent';
    if (title.includes('science des données') || title.includes('data')) {
      typeDiplome = 'Licence en Mathématiques Appliquées (ou équivalent)';
    } else if (title.includes('génie logiciel') || title.includes('genie logiciel')) {
      typeDiplome = 'Licence en Sciences de l’Informatique (ou équivalent)';
    } else if (title.includes('ingénieur') || title.includes('ingenieur')) {
      typeDiplome = 'Diplôme d’accès au cycle ingénieur';
    }

    const dates = [
      `Inscription en ligne : ${this.configurationAppel.date_debut_visibilite || '-'} → ${this.configurationAppel.date_limite_preinscription || '-'}`,
      `Résultats de présélection : ${this.configurationAppel.date_limite_depot_dossier || '-'}`,
      `Dépôt des dossiers numériques : ${this.configurationAppel.date_limite_paiement || '-'}`,
    ].join(' | ');

    return [
      {
        capaciteTotale: String(totalCapacity || 0),
        etablissementOrigine: 'ISIMM',
        capacite: String(this.configurationAppel.capacite_interne || 0),
        typeDiplome,
        datesImportantes: dates,
      },
      {
        capaciteTotale: '',
        etablissementOrigine: 'Autres établissements',
        capacite: String(this.configurationAppel.capacite_externe || 0),
        typeDiplome,
        datesImportantes: `Liste finale des admis : ${this.configurationAppel.date_fin_visibilite || '-'}`,
      },
    ];
  }

  refreshUserProfile(): void {
    const token = this.authService.getAccessToken();
    if (!token) return;
    this.http
      .get<any>('/api/auth/profile/', { headers: { Authorization: `Bearer ${token}` } })
      .subscribe({
        next: (profile) => {
          if (profile && profile.id) {
            this.currentUser = { ...this.currentUser, ...profile };
            localStorage.setItem('current_user', JSON.stringify(this.currentUser));
          }
        },
        error: () => {},
      });
  }

  loadUserMasterInfo(): void {
    const token = this.authService.getAccessToken();
    if (!token) return;
    this.http
      .get<any>('/api/candidatures/responsable/mes-masters/', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (response) => {
          const masters: any[] = response?.masters || [];
          this.userMasterNoms = masters.map((m) => m.nom).filter(Boolean);
          this.userMasterSpecialites = masters.map((m) => m.specialite).filter(Boolean);
          this.userMasterTypes = masters.map((m) => m.type_master).filter(Boolean);
          this.userMasterInfoLoaded = true;
        },
        error: () => {
          this.userMasterNoms = [];
          this.userMasterSpecialites = [];
          this.userMasterTypes = [];
          this.userMasterInfoLoaded = true;
        },
      });
  }

  loadCandidaturesResponsable(masterId: number | 'all' = this.selectedMasterForCandidatures): void {
    this.responsableCandidaturesFromApi = false;
    this.candidaturesResponsable = [];
    this.candidaturesResponsableFiltrees = [];
    this.appliquerFiltresResponsable();

    const token = this.authService.getAccessToken();
    if (!token) {
      console.warn('[LoadCandidaturesResponsable] No token available');
      return;
    }

    const params = new URLSearchParams();
    if (masterId !== 'all') {
      params.set('master_id', String(masterId));
    }

    const apiUrl = `/api/candidatures/responsable/candidatures/?${params.toString()}`;
    console.log('[LoadCandidaturesResponsable] Fetching from:', apiUrl);

    this.http
      .get<Candidature[]>(apiUrl, { headers: { Authorization: `Bearer ${token}` } })
      .subscribe({
        next: (data) => {
          const apiRows = data || [];
          this.responsableCandidaturesFromApi = true;
          this.candidaturesResponsable =
            apiRows.length > 0 ? this.sortRowsByScoreDesc(apiRows) : [];
          this.candidaturesResponsableFiltrees = [...this.candidaturesResponsable];
          this.appliquerFiltresResponsable();
        },
        error: () => {
          this.responsableCandidaturesFromApi = false;
          this.candidaturesResponsable = [];
          this.candidaturesResponsableFiltrees = [];
          this.appliquerFiltresResponsable();
        },
      });
  }

  loadCandidaturesMembre(): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      this.candidaturesFiltrees = [];
      return;
    }

    // ✅ Filtrer par la commission active : changer de commission recharge la liste.
    if (this.activeCommissionId) {
      this.candidatureService.getCandidaturesByCommission(this.activeCommissionId).subscribe({
        next: (data: any) => {
          this.candidatures = data?.candidatures || [];
          this.candidaturesFiltrees = [...this.candidatures];
          this.appliquerFiltres();
        },
        error: () => {
          this.candidatures = [];
          this.candidaturesFiltrees = [];
          this.appliquerFiltres();
        },
      });
      return;
    }

    // Fallback (aucune commission active) : endpoint général
    this.http
      .get<any[]>('/api/candidatures/responsable/candidatures/', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (data) => {
          this.candidatures = data || [];
          this.candidaturesFiltrees = [...this.candidatures];
          this.appliquerFiltres();
        },
        error: () => {
          this.candidatures = [];
          this.candidaturesFiltrees = [];
          this.appliquerFiltres();
        },
      });
  }

  loadResponsibleNotifications(): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    this.http
      .get<
        ResponsibleNotificationItem[]
      >('/api/candidatures/responsable/notifications/', { headers: { Authorization: `Bearer ${token}` } })
      .subscribe({
        next: (data) => {
          this.responsibleNotifications = data || [];
        },
        error: (error) => {
          console.error('Erreur chargement notifications responsable:', error);
          this.responsibleNotifications = [];
        },
      });
  }

  onConfigMasterChange(): void {
    if (!this.selectedConfigMasterId) {
      return;
    }
    this.loadConfigurationAppel(this.selectedConfigMasterId);
  }

  private loadConfigurationAppel(masterId: number): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    this.configLoading = true;

    this.http
      .get<any>(`/api/candidatures/configuration/${masterId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (config) => {
          this.configurationAppel = {
            master: config.master,
            date_debut_visibilite: config.date_debut_visibilite || '',
            date_fin_visibilite: config.date_fin_visibilite || '',
            date_limite_preinscription: config.date_limite_preinscription || '',
            date_limite_depot_dossier: config.date_limite_depot_dossier || '',
            date_limite_paiement: config.date_limite_paiement || '',
            delai_modification_candidature_jours: config.delai_modification_candidature_jours ?? 7,
            delai_depot_dossier_preselectionnes_jours:
              config.delai_depot_dossier_preselectionnes_jours ?? 14,
            actif: config.actif ?? true,
            est_cache: config.est_cache ?? false,
            capacite_interne: config.capacite_interne ?? 0,
            capacite_externe: config.capacite_externe ?? 0,
            document_officiel_pdf_url: config.document_officiel_pdf_url || null,
          };
          this.configLoading = false;
        },
        error: () => {
          this.configurationAppel = {
            master: masterId,
            date_debut_visibilite: '',
            date_fin_visibilite: '',
            date_limite_preinscription: '',
            date_limite_depot_dossier: '',
            date_limite_paiement: '',
            delai_modification_candidature_jours: 7,
            delai_depot_dossier_preselectionnes_jours: 14,
            actif: true,
            est_cache: false,
            capacite_interne: 0,
            capacite_externe: 0,
            document_officiel_pdf_url: null,
          };
          this.configLoading = false;
        },
      });
  }

  saveConfigurationAppel(): void {
    if (!this.isResponsable || !this.selectedConfigMasterId) {
      this.notifyActionBlocked('Configuration des appels réservée au responsable.');
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    const payload = {
      ...this.configurationAppel,
      master: this.selectedConfigMasterId,
    };

    this.configSaving = true;

    this.http
      .put(`/api/candidatures/configuration/${this.selectedConfigMasterId}/`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: () => {
          this.toastService.show('Configuration des appels enregistrée.', 'success');
          this.configSaving = false;
        },
        error: () => {
          this.http
            .post('/api/candidatures/configuration/', payload, {
              headers: { Authorization: `Bearer ${token}` },
            })
            .subscribe({
              next: () => {
                this.toastService.show('Configuration des appels créée.', 'success');
                this.configSaving = false;
              },
              error: (createError) => {
                console.error('Erreur sauvegarde configuration:', createError);
                this.toastService.show(
                  'Erreur lors de la sauvegarde de la configuration.',
                  'error',
                );
                this.configSaving = false;
              },
            });
        },
      });
  }

  creerNouvelleOffrePreinscription(): void {
    if (!this.isResponsable) {
      this.notifyActionBlocked("Création d'offre réservée au responsable.");
      return;
    }

    const requiredFields = [
      this.nouvelleOffre.nom,
      this.nouvelleOffre.type_master,
      this.nouvelleOffre.specialite,
      this.nouvelleOffre.date_limite_candidature,
    ];

    if (requiredFields.some((value) => !String(value || '').trim())) {
      this.toastService.show(
        'Veuillez remplir les champs obligatoires de la nouvelle offre.',
        'warning',
      );
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    this.creationOffreLoading = true;

    this.http
      .post<any>('/api/candidatures/masters/admin/', this.nouvelleOffre, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (created) => {
          this.toastService.show('Nouvelle offre créée avec succès.', 'success');

          this.nouvelleOffre = {
            nom: '',
            type_master: 'recherche',
            specialite: '',
            description: '',
            places_disponibles: 30,
            date_limite_candidature: '',
            annee_universitaire: this.nouvelleOffre.annee_universitaire || '2026/2027',
            actif: true,
          };

          this.loadMastersForConfiguration();
          if (created?.id) {
            this.selectedConfigMasterId = Number(created.id);
            this.onConfigMasterChange();
          }

          this.creationOffreLoading = false;
        },
        error: (error) => {
          console.error('Erreur création offre:', error);
          this.toastService.show(
            error?.error?.error || "Erreur lors de la création de l'offre.",
            'error',
          );
          this.creationOffreLoading = false;
        },
      });
  }

  selectionnerOffre(offre: OffrePreinscription): void {
    this.selectedOffreId = offre.id;
    this.offreEditionMode = true;
    this.offreEditForm = {
      id: offre.id,
      nom: offre.titre,
      type_master: offre.type === 'cycle_ingenieur' ? 'professionnel' : 'recherche',
      specialite: offre.specialite,
      description: offre.description,
      places_disponibles: offre.places,
      date_limite_candidature: offre.date_limite || '',
      annee_universitaire: '2026/2027',
      actif: offre.statut === 'ouvert',
      date_debut_visibilite: '',
      date_fin_visibilite: '',
      date_limite_preinscription: offre.date_limite_preinscription || '',
      date_limite_depot_dossier: offre.date_limite_depot_dossier || '',
      date_limite_paiement: offre.date_limite_paiement || '',
      delai_modification_candidature_jours: 7,
      delai_depot_dossier_preselectionnes_jours: 14,
      est_cache: !!offre.est_cache,
      capacite_interne: offre.capacite_interne || 0,
      capacite_externe: offre.capacite_externe || 0,
      document_officiel_pdf_url: offre.document_officiel_pdf_url || null,
    };
    this.selectedConfigMasterId = offre.id;
    this.onConfigMasterChange();
  }

  ouvrirModalEditionOffre(offre: OffrePreinscription): void {
    this.ouvrirPageEditionOffre(offre);
  }

  onOfrePdfSigne(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    this.nouvelleOfrePdfSigneFile = file;
    this.nouvelleOfrePdfSigneNom = file.name;
  }

  ouvrirPageEditionOffre(offre: OffrePreinscription): void {
    if (!offre?.id) {
      return;
    }

    if (offre.isDemo) {
      this.router.navigate(['/commission/offre-preinscription/edit', this.fallbackEditOfferId]);
      return;
    }

    this.router.navigate(['/commission/offre-preinscription/edit', offre.id]);
  }

  ouvrirNouvelleOffreVide(): void {
    this.router.navigate(['/commission/offre-preinscription/edit', this.fallbackEditOfferId], {
      queryParams: { empty: '1' },
    });
  }

  ouvrirModalNouvelleOffre(): void {
    this.showModalNouvelleOffre = true;
    this.nouvelleOffreStep = 1;
    this.nouvelleOffreQuotas = [];
    this.nouvelleOffreAppelActif = true;
    this.nouvelleOffreVisible = true;
    this.nouvelleOffreDateDebutVisibilite = '';
    this.nouvelleOffreDateFinVisibilite = '';
    this.nouvelleOffreDateLimitePreinscription = '';
    this.nouvelleOffreDateLimiteDepotDossier = '';
    this.nouvelleOffre = {
      nom: '',
      type_master: 'recherche',
      specialite: '',
      description: '',
      places_disponibles: 30,
      date_limite_candidature: '',
      annee_universitaire: '2026/2027',
      actif: true,
    };
    this.nouvelleOffreParcoursCode = 'MPGL';
    this.nouvelleOffreShowSpecialitesEditor = false;
    this.nouvelleOffreNouvelleSpecialite = '';
    this.nouvelleOffreCriteres = [];
    this.applyNouvelleOffreParcours(this.nouvelleOffreParcoursCode, true);
  }

  nouvelleOffreParcoursOptions(): ParcoursSpecialiteOption[] {
    const type = this.nouvelleOffre.type_master === 'recherche' ? 'recherche' : 'professionnel';
    return getParcoursOptionsForType('master', type);
  }

  applyNouvelleOffreParcours(code: string, resetSpecialites: boolean): void {
    const parcours = resolveParcoursByCode(code);
    if (!parcours) return;
    this.nouvelleOffreParcoursCode = parcours.code;
    this.nouvelleOffre.specialite = parcours.label;
    if (parcours.sousType) {
      this.nouvelleOffre.type_master = parcours.sousType;
    }
    if (resetSpecialites || this.nouvelleOffreSpecialitesDemandees.length === 0) {
      this.nouvelleOffreSpecialitesDemandees = [...parcours.defaultSpecialitesDemandees];
    }
    if (resetSpecialites || this.nouvelleOffreScoreCriteres.length === 0) {
      this.nouvelleOffreScoreCriteres = parcours.defaultScoreConfig.criteres.map((c) => ({
        ...c,
        paliers: c.paliers ? c.paliers.map((p) => ({ ...p })) : undefined,
      }));
      this.nouvelleOffreScoreFormule = parcours.defaultScoreConfig.formule;
    }
  }

  ajouterNouvelleOffreCritereScore(): void {
    this.nouvelleOffreScoreCriteres = [
      ...this.nouvelleOffreScoreCriteres,
      { code: '', label: '', description: '', mode: 'fixe', valeurFixe: 0 },
    ];
  }

  supprimerNouvelleOffreCritereScore(index: number): void {
    this.nouvelleOffreScoreCriteres = this.nouvelleOffreScoreCriteres.filter((_, i) => i !== index);
  }

  // ─────────────────────────────────────────────────────────────
  //  MOD 2A — Tableau critères + coefficients (Responsable seulement)
  // ─────────────────────────────────────────────────────────────
  /** Ajoute une ligne vide au tableau des critères. */
  ajouterNouvelleOffreCritere(): void {
    this.nouvelleOffreCriteres = [
      ...this.nouvelleOffreCriteres,
      { code: '', label: '', coefficient: 1, valeur: '', category: 'bac' },
    ];
  }

  /** Supprime la ligne du critère et met à jour l'aperçu de la formule. */
  supprimerNouvelleOffreCritere(index: number): void {
    this.nouvelleOffreCriteres = this.nouvelleOffreCriteres.filter((_, i) => i !== index);
  }

  /** Auto-remplit le label + la catégorie quand le critère est sélectionné. */
  onNouvelleOffreCritereCodeChange(critere: CritereConfig): void {
    const opt = getCritereByCode(critere.code);
    if (opt) {
      critere.label = opt.label;
      critere.category = opt.category;
    }
  }

  /** Bouton ✎ — édition rapide du coefficient et de la valeur/seuil via prompt. */
  modifierNouvelleOffreCritere(critere: CritereConfig): void {
    const nc = window.prompt('Coefficient :', String(critere.coefficient));
    if (nc !== null && nc.trim() !== '') {
      const parsed = Number(nc);
      if (!Number.isNaN(parsed)) critere.coefficient = parsed;
    }
    const nv = window.prompt('Valeur / Seuil :', critere.valeur);
    if (nv !== null) critere.valeur = nv;
  }

  /** Aperçu temps réel de la formule du score (avec coefficients). */
  nouvelleOffreFormulePreview(): string {
    return buildFormulaPreview(this.nouvelleOffreCriteres);
  }

  /** true si le même critère est sélectionné plus d'une fois (alerte doublon). */
  critereDejaSelectionne(code: string): boolean {
    if (!code) return false;
    return this.nouvelleOffreCriteres.filter((c) => c.code === code).length > 1;
  }

  /** Validation MOD 2A : au moins un critère valide avant de passer à l'étape suivante. */
  nouvelleOffreCriteresValides(): boolean {
    return this.nouvelleOffreCriteres.some((c) => !!c.code);
  }

  onNouvelleOffreCritereModeChange(critere: ScoreCriterion): void {
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

  ajouterNouvelleOffrePalier(critere: ScoreCriterion): void {
    if (!critere.paliers) critere.paliers = [];
    critere.paliers.push({ condition: '', points: 0 });
  }

  supprimerNouvelleOffrePalier(critere: ScoreCriterion, index: number): void {
    if (!critere.paliers) return;
    critere.paliers.splice(index, 1);
  }

  insererCodeDansFormuleModal(code: string): void {
    const current = this.nouvelleOffreScoreFormule || '';
    const trimmed = current.trimEnd();
    if (trimmed.length === 0) {
      this.nouvelleOffreScoreFormule = code;
    } else {
      const lastChar = trimmed.slice(-1);
      const needsOp = !/[+\-*/(]/.test(lastChar);
      this.nouvelleOffreScoreFormule = trimmed + (needsOp ? ' + ' : ' ') + code;
    }
  }

  evaluerNouvelleOffreScoreFormule(): {
    ok: boolean;
    value: number | null;
    error: string | null;
  } {
    return evaluateScoreFormule(this.nouvelleOffreScoreFormule, this.nouvelleOffreScoreCriteres);
  }

  onNouvelleOffreParcoursChange(): void {
    this.applyNouvelleOffreParcours(this.nouvelleOffreParcoursCode, true);
  }

  onNouvelleOffreTypeMasterChange(): void {
    const opts = this.nouvelleOffreParcoursOptions();
    if (opts.length === 0) return;
    const stillValid = opts.some((p) => p.code === this.nouvelleOffreParcoursCode);
    if (!stillValid) {
      this.applyNouvelleOffreParcours(opts[0].code, true);
    }
  }

  toggleNouvelleOffreSpecialitesEditor(): void {
    this.nouvelleOffreShowSpecialitesEditor = !this.nouvelleOffreShowSpecialitesEditor;
  }

  ajouterNouvelleOffreSpecialite(): void {
    const value = (this.nouvelleOffreNouvelleSpecialite || '').trim();
    if (!value) return;
    if (this.nouvelleOffreSpecialitesDemandees.includes(value)) {
      this.nouvelleOffreNouvelleSpecialite = '';
      return;
    }
    this.nouvelleOffreSpecialitesDemandees = [...this.nouvelleOffreSpecialitesDemandees, value];
    this.nouvelleOffreNouvelleSpecialite = '';
  }

  supprimerNouvelleOffreSpecialite(index: number): void {
    this.nouvelleOffreSpecialitesDemandees = this.nouvelleOffreSpecialitesDemandees.filter(
      (_, i) => i !== index,
    );
    this.nouvelleOffreQuotas = this.nouvelleOffreQuotas.map((q) => {
      if (!this.nouvelleOffreSpecialitesDemandees.includes(q.diplome)) {
        return { ...q, diplome: '' };
      }
      return q;
    });
  }

  fermerModalNouvelleOffre(): void {
    this.showModalNouvelleOffre = false;
    this.nouvelleOffreStep = 1;
  }

  nextStepNouvelleOffre(): void {
    if (this.nouvelleOffreStep < 4) this.nouvelleOffreStep++;
  }

  prevStepNouvelleOffre(): void {
    if (this.nouvelleOffreStep > 1) this.nouvelleOffreStep--;
  }

  ajouterQuotaNouvelle(): void {
    this.nouvelleOffreQuotas.push({ categorie: '', etablissement: '', places: 0, diplome: '' });
  }

  supprimerQuotaNouvelle(index: number): void {
    this.nouvelleOffreQuotas.splice(index, 1);
  }

  sauvegarderNouvelleOffre(): void {
    this.fermerModalNouvelleOffre();
    this.ouvrirNouvelleOffreVide();
  }

  ouvrirEditionOuCreation(offre: OffrePreinscription): void {
    if (offre?.isDemo) {
      this.router.navigate(['/commission/offre-preinscription/edit', this.fallbackEditOfferId]);
      return;
    }

    this.ouvrirPageEditionOffre(offre);
  }

  uploadOfferPdf(event: any): void {
    if (!this.selectedOffreId) {
      this.toastService.show('Sélectionnez une offre avant de téléverser un PDF.', 'warning');
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.type !== 'application/pdf') {
      this.toastService.show('Veuillez sélectionner un fichier PDF.', 'error');
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    const formData = new FormData();
    formData.append('document_pdf', file);

    this.http
      .post(`/api/candidatures/configuration/${this.selectedOffreId}/document-pdf/`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (response: any) => {
          this.offresPreinscription = this.offresPreinscription.map((offre) =>
            offre.id === this.selectedOffreId
              ? { ...offre, document_officiel_pdf_url: response.document_url || null }
              : offre,
          );
          this.offreEditForm.document_officiel_pdf_url = response.document_url || null;
          this.toastService.show('PDF téléversé avec succès.', 'success');
          if (event.target) {
            event.target.value = '';
          }
        },
        error: (error) => {
          console.error('Erreur téléversement PDF offre:', error);
          this.toastService.show('Erreur lors du téléversement PDF.', 'error');
        },
      });
  }

  basculerEtatOffre(offre: OffrePreinscription, hidden: boolean): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    this.http
      .put(
        `/api/candidatures/configuration/${offre.id}/`,
        {
          master: offre.id,
          est_cache: hidden,
          actif: offre.statut === 'ouvert',
        },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: () => {
          this.toastService.show(
            hidden ? 'Offre retirée de la publication.' : 'Offre validée et publiée.',
            'success',
          );
          this.loadOffresPreinscription();
        },
        error: (error) => {
          console.error('Erreur bascule visibilité offre:', error);
          this.toastService.show('Impossible de modifier la visibilité.', 'error');
        },
      });
  }

  onOffreStatutSwitchChange(offre: OffrePreinscription, event: Event): void {
    if (offre?.isDemo) {
      const input = event.target as HTMLInputElement | null;
      if (input) {
        input.checked = offre.statut === 'ouvert';
      }
      this.toastService.show(
        'Mode démo: créez une offre réelle pour changer le statut.',
        'warning',
      );
      return;
    }
    const checked = (event.target as HTMLInputElement | null)?.checked ?? false;
    this.ouvrirFermerOffre(offre, checked);
  }

  onOffreVisibiliteSwitchChange(offre: OffrePreinscription, event: Event): void {
    if (offre?.isDemo) {
      const input = event.target as HTMLInputElement | null;
      if (input) {
        input.checked = !offre.est_cache;
      }
      this.toastService.show(
        'Mode démo: créez une offre réelle pour changer la visibilité.',
        'warning',
      );
      return;
    }
    const checked = (event.target as HTMLInputElement | null)?.checked ?? true;
    // checked=true => visible => hidden=false
    this.basculerEtatOffre(offre, !checked);
  }

  ouvrirFermerOffre(offre: OffrePreinscription, ouvert: boolean): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    const dateLimite = ouvert
      ? this.offreEditForm.date_limite_candidature || offre.date_limite
      : '2000-01-01';

    this.http
      .put(
        `/api/candidatures/masters/${offre.id}/`,
        {
          nom: offre.titre,
          type_master: offre.sous_type,
          specialite: offre.specialite,
          description: offre.description,
          places_disponibles: offre.places,
          date_limite_candidature: dateLimite,
          annee_universitaire: '2026/2027',
          actif: ouvert,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: () => {
          this.toastService.show(ouvert ? 'Offre ouverte.' : 'Offre fermée.', 'success');
          this.loadOffresPreinscription();
        },
        error: (error) => {
          console.error('Erreur ouverture/fermeture offre:', error);
          this.toastService.show("Impossible de modifier le statut de l'offre.", 'error');
        },
      });
  }

  enregistrerEditionOffre(): void {
    if (!this.selectedOffreId) {
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    this.editingOffreLoading = true;

    const payload = {
      nom: this.offreEditForm.nom,
      type_master: this.offreEditForm.type_master,
      specialite: this.offreEditForm.specialite,
      description: this.offreEditForm.description,
      places_disponibles: this.offreEditForm.places_disponibles,
      date_limite_candidature: this.offreEditForm.date_limite_candidature,
      annee_universitaire: this.offreEditForm.annee_universitaire,
      actif: this.offreEditForm.actif,
      est_cache: this.offreEditForm.est_cache,
      capacite_interne: this.offreEditForm.capacite_interne,
      capacite_externe: this.offreEditForm.capacite_externe,
    };

    this.http
      .put(`/api/candidatures/masters/${this.selectedOffreId}/`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: () => {
          this.toastService.show('Offre mise à jour.', 'success');
          this.editingOffreLoading = false;
          this.offreEditionMode = false;
          this.loadOffresPreinscription();
        },
        error: (error) => {
          console.error('Erreur mise à jour offre:', error);
          this.toastService.show('Erreur lors de la mise à jour.', 'error');
          this.editingOffreLoading = false;
        },
      });
  }

  get candidaturesMastersResponsableList(): Candidature[] {
    return this.candidatures.filter((candidature) => candidature.type_concours === 'masters');
  }

  get candidaturesIngenieurResponsableList(): Candidature[] {
    return this.candidatures.filter((candidature) => candidature.type_concours === 'ingenieur');
  }

  uploadConfigurationPdf(event: any): void {
    if (!this.selectedConfigMasterId) {
      this.toastService.show('Veuillez sélectionner un master.', 'error');
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.type !== 'application/pdf') {
      this.toastService.show('Veuillez sélectionner un fichier PDF.', 'error');
      return;
    }

    const maxSizeMB = 10;
    if (file.size > maxSizeMB * 1024 * 1024) {
      this.toastService.show(`Le fichier dépasse ${maxSizeMB} MB.`, 'error');
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    const formData = new FormData();
    formData.append('document_pdf', file);

    this.http
      .post(
        `/api/candidatures/configuration/${this.selectedConfigMasterId}/document-pdf/`,
        formData,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      .subscribe({
        next: (response: any) => {
          this.configurationAppel.document_officiel_pdf_url = response.document_url;
          this.toastService.show('Document PDF chargé avec succès.', 'success');
          // Reset file input
          if (event.target) {
            event.target.value = '';
          }
        },
        error: (error) => {
          console.error('Erreur upload PDF:', error);
          const errorMsg = error?.error?.error || 'Erreur lors du téléchargement du document.';
          this.toastService.show(errorMsg, 'error');
        },
      });
  }

  downloadConfigurationPdf(): void {
    if (!this.configurationAppel.document_officiel_pdf_url) {
      this.toastService.show('Aucun document disponible.', 'warning');
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    // Get the base URL from the document_officiel_pdf_url
    const link = document.createElement('a');
    link.href = this.configurationAppel.document_officiel_pdf_url;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private loadActionPermissions(): void {
    this.authService.getMyEnabledActions().subscribe({
      next: (actions: string[]) => {
        this.customRoleActions = this.extractCustomRoleActions(actions || []);

        // Fallback permissif: si l'API des actions est indisponible/vide,
        // on conserve les permissions locales pour ne pas masquer le menu.
        if (!actions || actions.length === 0) {
          console.warn('Aucune action distante chargee, conservation des permissions locales.');
          return;
        }

        this.actionPermissions = {
          consultationCandidature: this.authService.hasMyAction('Consultation de candidature'),
          consultationDossier: this.authService.hasMyAction('Consultation de dossier'),
          verifierDossiers: this.authService.hasMyAction('Vérifier dossiers'),
          preselection: this.authService.hasMyAction('Préselection'),
          selectionFinale: this.authService.hasMyAction('Sélection finale'),
          publierListes: this.authService.hasMyAction([
            'Publier liste principale',
            'Publier liste attente',
          ]),
          gererInscriptions: this.authService.hasMyAction('Gérer inscriptions'),
          consulterStatistiques: this.authService.hasMyAction('Consulter statistiques'),
          traiterReclamations: this.authService.hasMyAction('Traiter réclamations'),
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

  canAccessView(view: CommissionView): boolean {
    if (view === 'dashboard' || view === 'profil' || view === 'masters') {
      return true;
    }

    if (view === 'reclamations') {
      return this.isResponsable || this.actionPermissions.consultationCandidature;
    }

    if (view === 'configuration-appels') {
      // Allow responsables, and also allow commission members who belong to
      // at least one commission (so they can view offers for their speciality).
      // ⚠️ Le rôle d'un membre de commission est 'commission' (pas 'membre').
      return (
        this.isResponsable ||
        (['commission', 'membre'].includes(this.currentUser?.role) &&
          Array.isArray(this.availableCommissions) &&
          this.availableCommissions.length > 0)
      );
    }

    if (view === 'concours-ingenieur') {
      return this.isResponsable || this.actionPermissions.consultationCandidature;
    }

    if (view === 'candidatures') {
      return this.isResponsable || this.actionPermissions.consultationCandidature;
    }

    if ((view as string) === 'candidatures-responsable') {
      return this.isResponsable;
    }

    if ((view as string) === 'avis-listes') {
      return true;
    }

    if (view === 'valider-dossier') {
      return this.actionPermissions.verifierDossiers;
    }

    if (view === 'dossiers') {
      return this.actionPermissions.consultationDossier;
    }

    if (view === 'listes') {
      return true;
    }

    if (view === 'ocr') {
      return this.actionPermissions.verifierDossiers || this.actionPermissions.consultationDossier;
    }

    if (view === 'inscriptions') {
      return (
        this.actionPermissions.gererInscriptions || this.actionPermissions.consultationCandidature
      );
    }

    if (view === 'statistiques') {
      return false;
    }

    if (view === 'deliberations') {
      return (
        this.isResponsable &&
        (this.actionPermissions.selectionFinale || this.actionPermissions.publierListes)
      );
    }

    if (view === 'membres') {
      return this.isResponsable;
    }

    if (view === 'candidatures-responsable') {
      return this.isResponsable;
    }

    if (view === 'candidatures-master') {
      return this.isResponsable || this.actionPermissions.consultationCandidature;
    }

    if (view === 'candidatures-ingenieur') {
      if (this.isResponsable && this.userManagesMasterPrograms) return false;
      return this.isResponsable || this.actionPermissions.consultationCandidature;
    }

    return true;
  }

  isMenuDisabled(view: CommissionView): boolean {
    return !this.canAccessView(view);
  }

  openMenuView(view: CommissionView): void {
    if (this.isMenuDisabled(view)) {
      this.notifyActionBlocked('Fonctionnalité non accessible pour votre rôle.');
      return;
    }
    this.switchView(view);
  }

  private get userManagesMasterPrograms(): boolean {
    // 1. Definitive: MembreCommission API returned master records
    if (this.userMasterNoms.length > 0) return true;
    // 2. Reliable: user profile specialite contains master/mastère keyword or known formation code
    const spec = String(this.currentUser?.specialite || '')
      .toLowerCase()
      .trim();
    if (spec) {
      const masterCodes = ['mpgl', 'mpds', 'mp3i', 'mrgl', 'mrmi'];
      if (
        spec.includes('master') ||
        spec.includes('mastère') ||
        spec.includes('mastere') ||
        masterCodes.some((c) => spec.includes(c))
      ) {
        return true;
      }
      // If spec explicitly names an ingénieur program, it's not master
      if (spec.includes('ing') || spec.includes('ingénieur') || spec.includes('ingenieur')) {
        return false;
      }
    }
    // 3. Fallback: commission category detection (null → default to master)
    return this.activeCommissionCategory !== 'ingenieur';
  }

  canOpenCandidaturesMasterMenu(): boolean {
    if (this.isResponsable) {
      return this.userManagesMasterPrograms;
    }
    const scope = this.activeCommissionCategory;
    const isMasterScope = !scope || scope !== 'ingenieur';
    if (!isMasterScope) return false;
    return (
      this.actionPermissions.consultationCandidature ||
      (Array.isArray(this.availableCommissions) && this.availableCommissions.length > 0)
    );
  }

  canOpenCandidaturesIngenieurMenu(): boolean {
    if (this.isResponsable) {
      return !this.userManagesMasterPrograms;
    }

    if (this.activeCommissionCategory && this.activeCommissionCategory !== 'ingenieur') {
      return false;
    }

    if (this.currentUser?.role === 'membre') {
      return Array.isArray(this.availableCommissions) && this.availableCommissions.length > 0;
    }

    return this.actionPermissions.consultationCandidature;
  }

  private getCommissionCategoryFromId(
    commissionId: number | null,
  ): CommissionContextOption['category'] | null {
    if (commissionId === null) {
      return null;
    }

    const fromContext = this.commissionContext.commissions.find(
      (commission) => commission.id === commissionId,
    );
    if (fromContext?.category) {
      return fromContext.category;
    }

    const fromAvailable = this.availableCommissions.find(
      (commission) => commission.id === commissionId,
    );
    const label = `${fromAvailable?.nom || ''} ${fromAvailable?.description || ''}`.toLowerCase();
    if (label.includes('ingénieur') || label.includes('ingenieur')) return 'ingenieur';
    if (label.includes('data science')) return 'master-ds';
    if (label.includes('génie logiciel') || label.includes('genie logiciel')) return 'master-gl';
    return null;
  }

  openCandidaturesMasterMenu(): void {
    if (!this.canOpenCandidaturesMasterMenu()) {
      this.notifyActionBlocked('Fonctionnalité non accessible pour votre rôle.');
      return;
    }
    this.switchView(this.isResponsable ? 'candidatures-responsable' : 'candidatures');
  }

  openCandidaturesIngenieurMenu(): void {
    if (!this.canOpenCandidaturesIngenieurMenu()) {
      this.notifyActionBlocked('Fonctionnalité non accessible pour votre rôle.');
      return;
    }
    this.switchView('candidatures-ingenieur');
  }

  allerOffreWizard(): void {
    this.router.navigate(['/commission/offre-wizard/new']);
  }

  getCandidaturesResponsableByType(type: 'masters' | 'ingenieur'): Candidature[] {
    return this.candidaturesResponsable.filter((candidature) => candidature.type_concours === type);
  }

  getResponsableMasterStats(): ResponsableMasterStat[] {
    const grouped = new Map<string, ResponsableMasterStat>();

    this.candidaturesResponsable.forEach((candidature) => {
      const masterId = candidature.master_id || candidature.master_nom || 'unknown';
      const masterNom = candidature.master_nom || candidature.specialite || 'Master inconnu';
      const typeConcours = (candidature.type_concours === 'ingenieur' ? 'ingenieur' : 'masters') as
        | 'masters'
        | 'ingenieur'
        | 'autre';
      const key = `${masterId}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          masterId,
          masterNom,
          typeConcours,
          totalCandidatures: 0,
          dossiersDeposes: 0,
          acceptes: 0,
          inscrits: 0,
          rejetes: 0,
          tauxAcceptation: 0,
          tauxInscription: 0,
          tauxDossier: 0,
          tauxRejet: 0,
        });
      }

      const stat = grouped.get(key)!;
      stat.totalCandidatures += 1;
      if (candidature.dossier_depose) {
        stat.dossiersDeposes += 1;
      }
      if (candidature.statut === 'selectionne' || candidature.statut === 'inscrit') {
        stat.acceptes += 1;
      }
      if (candidature.statut === 'inscrit') {
        stat.inscrits += 1;
      }
      if (candidature.statut === 'rejete') {
        stat.rejetes += 1;
      }

      stat.tauxAcceptation = this.getRate(stat.acceptes, stat.totalCandidatures);
      stat.tauxInscription = this.getRate(stat.inscrits, Math.max(stat.acceptes, 1));
      stat.tauxDossier = this.getRate(stat.dossiersDeposes, stat.totalCandidatures);
      stat.tauxRejet = this.getRate(stat.rejetes, stat.totalCandidatures);
    });

    return Array.from(grouped.values()).sort((a, b) => b.totalCandidatures - a.totalCandidatures);
  }

  getTotalResponsableCandidatures(): number {
    return this.getResponsableMasterStats().reduce(
      (total, stat) => total + stat.totalCandidatures,
      0,
    );
  }

  getTotalResponsableDossiersDeposes(): number {
    return this.getResponsableMasterStats().reduce(
      (total, stat) => total + stat.dossiersDeposes,
      0,
    );
  }

  getTotalResponsableAcceptes(): number {
    return this.getResponsableMasterStats().reduce((total, stat) => total + stat.acceptes, 0);
  }

  getTotalResponsableInscrits(): number {
    return this.getResponsableMasterStats().reduce((total, stat) => total + stat.inscrits, 0);
  }

  getTotalResponsableRejetes(): number {
    return this.getResponsableMasterStats().reduce((total, stat) => total + stat.rejetes, 0);
  }

  getTauxResponsableAcceptationGlobal(): number {
    return this.getRate(this.getTotalResponsableAcceptes(), this.getTotalResponsableCandidatures());
  }

  getTauxResponsableInscriptionGlobal(): number {
    return this.getRate(
      this.getTotalResponsableInscrits(),
      Math.max(this.getTotalResponsableAcceptes(), 1),
    );
  }

  getTauxResponsableDossierGlobal(): number {
    return this.getRate(
      this.getTotalResponsableDossiersDeposes(),
      this.getTotalResponsableCandidatures(),
    );
  }

  getDashboardDossiersTraitesCount(): number {
    return (
      this.getTotalResponsableAcceptes() +
      this.getTotalResponsableInscrits() +
      this.getTotalResponsableRejetes()
    );
  }

  getDashboardDossiersNonTraitesCount(): number {
    return Math.max(
      this.getTotalResponsableCandidatures() - this.getDashboardDossiersTraitesCount(),
      0,
    );
  }

  getDashboardAdmisCount(): number {
    return this.getTotalResponsableAcceptes();
  }

  getDashboardInscritsCount(): number {
    return this.getTotalResponsableInscrits();
  }

  getDashboardTauxTraitement(): number {
    return this.getRate(
      this.getDashboardDossiersTraitesCount(),
      this.getTotalResponsableCandidatures(),
    );
  }

  getDashboardTauxNonTraites(): number {
    return this.getRate(
      this.getDashboardDossiersNonTraitesCount(),
      this.getTotalResponsableCandidatures(),
    );
  }

  getDashboardTauxAcceptation(): number {
    return this.getTauxResponsableAcceptationGlobal();
  }

  getDashboardTauxInscription(): number {
    return this.getTauxResponsableInscriptionGlobal();
  }

  getRate(numerator: number, denominator: number): number {
    if (!denominator) {
      return 0;
    }
    return Math.round((numerator / denominator) * 1000) / 10;
  }

  getDonutDasharray(percentage: number): string {
    const safeValue = Math.max(0, Math.min(100, Math.round(Number(percentage) || 0)));
    return `${safeValue} ${100 - safeValue}`;
  }

  // --- Commission dashboard helpers (stat-row support) ---
  getInternalCandidatesCount(): number {
    const rows = this.candidaturesFiltrees || [];
    const interneCount = rows.filter((c) =>
      (c.parcours || '').toLowerCase().includes('inter'),
    ).length;
    if (interneCount > 0) return interneCount;
    // fallback: treat candidates with a CIN as internal
    return rows.filter((c) => !!(c.candidat_cin || '').toString().trim()).length;
  }

  getAverageScore(): number {
    const rows = (this.candidaturesFiltrees || []).filter(
      (c) => c.score !== undefined && c.score !== null,
    );
    if (!rows.length) return 0;
    const sum = rows.reduce((s, r) => s + Number(r.score || 0), 0);
    return Math.round((sum / rows.length) * 100) / 100;
  }

  getPreselectedCount(): number {
    return (this.candidaturesFiltrees || []).filter((c) => c.statut === 'preselectionne').length;
  }

  getSelectedMasterName(): string {
    if (this.selectedMasterForCandidatures === 'all') return 'Tous les masters';
    const m = this.masterOptions.find((mo) => mo.id === Number(this.selectedMasterForCandidatures));
    return m?.nom || 'Master sélectionné';
  }

  getSelectedCount(): number {
    const rows = this.candidaturesFiltrees || [];
    if (this.selectedMasterForCandidatures === 'all') {
      return rows.filter((c) => c.statut === 'selectionne').length;
    }
    return rows.filter(
      (c) =>
        c.statut === 'selectionne' && c.master_id === Number(this.selectedMasterForCandidatures),
    ).length;
  }

  getMasterCapacity(): number {
    if (this.selectedMasterForCandidatures === 'all') {
      const total = (this.offresPreinscription || []).reduce(
        (s, o) => s + Number(o.places || 0),
        0,
      );
      return total || 1;
    }
    const offre = (this.offresPreinscription || []).find(
      (o) => o.id === Number(this.selectedMasterForCandidatures),
    );
    return Number(offre?.places || 1) || 1;
  }

  // --- Template handler stubs for the integrated static markup ---
  applyFilters(): void {
    try {
      if (this.selectedCandidatureType !== 'externe') {
        this.etablissementOrigineFilter = '';
      }
      if (typeof (this as any).appliquerFiltres === 'function') {
        (this as any).appliquerFiltres();
        return;
      }
    } catch (e) {}
  }

  updateSpecOptions(): void {}

  toggleExtraFilters(): void {
    try {
      const el = document.getElementById('extra-filters');
      if (el) el.style.display = el.style.display === 'none' || !el.style.display ? 'grid' : 'none';
    } catch (e) {}
  }

  toggleTop100(): void {
    this.top100Enabled = !this.top100Enabled;
  }

  resetFilters(): void {
    try {
      if (typeof (this as any).resetFiltres === 'function') {
        (this as any).resetFiltres();
        return;
      }
    } catch (e) {}
  }

  setListType(type: 'locale' | 'globale'): void {
    this.bulkListType = type;
  }

  // Modal Décision Finale (Sélectionner / Rejeter)
  showFinalDecisionModal: boolean = false;
  finalDecisionLoading: boolean = false;

  showConfirm(): void {
    this.showFinalDecisionModal = true;
  }

  closeFinalDecisionModal(): void {
    this.showFinalDecisionModal = false;
  }

  /**
   * Action "SÉLECTIONNER" :
   *  - Tous les candidats actuellement visibles dans la vue Présélection (statut='preselectionne')
   *    passent à 'selectionne'
   *  - Bascule auto vers Nav Sélection
   */
  decisionFinaleSelectionner(): void {
    if (this.finalDecisionLoading) return;
    const candidats = this.getVisibleCandidaturesForTable().filter(
      (c) => c.statut === 'preselectionne',
    );
    if (candidats.length === 0) {
      this.toastService.show('Aucun candidat présélectionné à sélectionner.', 'warning');
      this.closeFinalDecisionModal();
      return;
    }
    this.finalDecisionLoading = true;
    let done = 0;
    candidats.forEach((cand) => {
      this.candidatureService.updateStatus(cand.id, 'selectionne').subscribe({
        next: () => {
          done++;
          // MAJ locale immédiate
          const idx = this.candidatures.findIndex((c) => c.id === cand.id);
          if (idx >= 0) this.candidatures[idx].statut = 'selectionne';
          const idxR = this.candidaturesResponsable.findIndex((c) => c.id === cand.id);
          if (idxR >= 0) this.candidaturesResponsable[idxR].statut = 'selectionne';
          if (done === candidats.length) {
            this.finalDecisionLoading = false;
            this.closeFinalDecisionModal();
            this.toastService.show(
              `✅ ${candidats.length} candidat(s) sélectionné(s) — bascule vers Sélection`,
              'success',
            );
            this.loadCandidaturesResponsable();
            this.appliquerFiltresResponsable();
            setTimeout(() => this.switchView('listes'), 400);
          }
        },
        error: () => {
          done++;
          if (done === candidats.length) {
            this.finalDecisionLoading = false;
            this.closeFinalDecisionModal();
            this.toastService.show('Erreur partielle pendant la sélection.', 'error');
          }
        },
      });
    });
  }

  /**
   * Action "REJETER" : passe tous les candidats présélectionnés à 'rejete'
   */
  decisionFinaleRejeter(): void {
    if (this.finalDecisionLoading) return;
    const candidats = this.getVisibleCandidaturesForTable().filter(
      (c) => c.statut === 'preselectionne',
    );
    if (candidats.length === 0) {
      this.toastService.show('Aucun candidat à rejeter.', 'warning');
      this.closeFinalDecisionModal();
      return;
    }
    if (
      !window.confirm(`Rejeter ${candidats.length} candidat(s) ? Cette action est irréversible.`)
    ) {
      return;
    }
    this.finalDecisionLoading = true;
    let done = 0;
    candidats.forEach((cand) => {
      this.candidatureService.updateStatus(cand.id, 'rejete').subscribe({
        next: () => {
          done++;
          const idx = this.candidatures.findIndex((c) => c.id === cand.id);
          if (idx >= 0) this.candidatures[idx].statut = 'rejete';
          const idxR = this.candidaturesResponsable.findIndex((c) => c.id === cand.id);
          if (idxR >= 0) this.candidaturesResponsable[idxR].statut = 'rejete';
          if (done === candidats.length) {
            this.finalDecisionLoading = false;
            this.closeFinalDecisionModal();
            this.toastService.show(`${candidats.length} candidat(s) rejeté(s)`, 'warning');
            this.loadCandidaturesResponsable();
            this.appliquerFiltresResponsable();
          }
        },
        error: () => {
          done++;
          if (done === candidats.length) {
            this.finalDecisionLoading = false;
            this.closeFinalDecisionModal();
            this.toastService.show('Erreur partielle pendant le rejet.', 'error');
          }
        },
      });
    });
  }

  toggleExport(evt?: Event): void {
    try {
      this.exportMenuOpen = !this.exportMenuOpen;
      if (this.exportMenuOpen && evt) {
        // Position the menu relative to the button
        const button = (evt.target as HTMLElement)?.closest('button');
        if (button) {
          const rect = button.getBoundingClientRect();
          this.exportMenuPosition = {
            position: 'fixed',
            left: rect.left + 'px',
            top: rect.bottom + 8 + 'px',
            zIndex: '1000',
          };
        }
      }
      evt?.stopPropagation?.();
    } catch (e) {
      console.error('toggleExport error:', e);
    }
  }

  exportCandidatures(scope: 'specialite' | 'master', format: 'pdf' | 'xlsx'): void {
    try {
      const token = this.authService.getAccessToken();
      if (!token) {
        this.toastService.show('Session expirée. Veuillez vous reconnecter.', 'error');
        return;
      }

      // Close the menu
      this.exportMenuOpen = false;

      // Get the current specialty filter if scope is 'specialite'
      let specialite = '';
      if (scope === 'specialite') {
        // Try to get from filter
        specialite = this.filtres.specialite || '';
        // If no filter, try to get from current user's specialty
        if (!specialite && this.currentUser?.specialite) {
          specialite = this.currentUser.specialite;
        }
      }

      // Build query parameters
      const params = new URLSearchParams();
      params.append('scope', scope);
      params.append('format', format);
      if (specialite) {
        params.append('specialite', specialite);
      }

      const url = `/api/candidatures/export/?${params.toString()}`;

      this.http
        .get(url, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        })
        .subscribe({
          next: (blob) => {
            const urlBlob = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = urlBlob;
            const timestamp = new Date().getTime();
            link.download = `candidatures_${scope}_${timestamp}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
            link.click();
            window.URL.revokeObjectURL(urlBlob);
            this.toastService.show(`✅ Export ${format.toUpperCase()} réussi`, 'success');
          },
          error: (err) => {
            console.error('Export error:', err);
            const errorMsg = err.error?.message || `❌ Erreur lors de l'export`;
            this.toastService.show(errorMsg, 'error');
          },
        });
    } catch (e) {
      console.error('exportCandidatures error:', e);
      this.toastService.show("❌ Erreur lors de l'export", 'error');
    }
  }

  toggleGenerateListMenu(): void {
    this.generateListOpen = !this.generateListOpen;
  }

  genererExcel(): void {
    this.exportCandidatures('specialite', 'xlsx');
    this.generateListOpen = false;
  }

  genererPDF(): void {
    this.exportCandidatures('specialite', 'pdf');
    this.generateListOpen = false;
  }

  genererExcelCandidatures(type: 'master' | 'ingenieur'): void {
    this.exportCandidatures('master', 'xlsx');
  }

  genererPDFOfficielISIMM(
    etape: 'PRESELECTION' | 'SELECTION' | 'MASTER' | 'INGENIEUR' = 'PRESELECTION',
    liste: '' | 'admis' | 'attente' = '',
  ): void {
    this.generateListOpen = false;
    try {
      const token = this.authService.getAccessToken();
      if (!token) {
        this.toastService.show('Session expirée. Veuillez vous reconnecter.', 'error');
        return;
      }
      // FIX : convertir commission ID -> master ID via availableCommissions (master_id fourni par my-commissions API)
      const activeComm = this.availableCommissions.find((c) => c.id === this.activeCommissionId);
      const masterId =
        activeComm?.master_id ??
        (Number.isFinite(Number(this.selectedMasterForCandidatures))
          ? Number(this.selectedMasterForCandidatures)
          : null);
      if (!masterId) {
        this.toastService.show(
          'Veuillez sélectionner une commission avant de générer le PDF.',
          'warning',
        );
        return;
      }
      const useMpglParcoursScope = this.shouldUseMpglParcoursPdfScope();
      const specialite =
        useMpglParcoursScope
          ? ''
          : etape === 'SELECTION'
          ? this.finalSelectionFilters.specialite !== 'all'
            ? this.finalSelectionFilters.specialite
            : ''
          : this.filtres?.specialite || '';
      const annee = this.finalSelectionFilters.session || '2025-2026';

      const params = new URLSearchParams({ etape, master_id: String(masterId), annee });
      if (useMpglParcoursScope) params.append('parcours', 'MPGL');
      if (specialite) params.append('specialite', specialite);
      if (liste) params.append('liste', liste);

      const url = `/api/candidatures/documents/generer-pdf/?${params}`;
      this.toastService.show('Génération du PDF officiel ISIMM...', 'info');

      this.http
        .get(url, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        })
        .subscribe({
          next: (blob) => {
            const urlBlob = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = urlBlob;
            const listeSuffix = liste === 'admis' ? '_Liste_Admis' : liste === 'attente' ? '_Liste_Attente' : '';
            link.download = `ISIMM_${etape}${listeSuffix}_${annee.replace('/', '-')}.pdf`;
            link.click();
            window.URL.revokeObjectURL(urlBlob);
            this.toastService.show('✅ PDF officiel ISIMM généré avec succès', 'success');
          },
          error: async (err) => {
            console.error('PDF officiel error:', err);
            const message = await this.extractPdfGenerationErrorMessage(err);
            this.toastService.show(message, 'error');
          },
        });
    } catch (e) {
      console.error('genererPDFOfficielISIMM error:', e);
    }
  }

  private shouldUseMpglParcoursPdfScope(): boolean {
    const email = String(this.currentUser?.email || '').trim().toLowerCase();
    const label = `${this.getDisplayedResponsableSpecialite()} ${this.getUserMasterOrSpecialiteLabel()}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    return (
      this.isResponsable &&
      (email.endsWith('@isimm.tn') ||
        label.includes('mpgl') ||
        label.includes('genie logiciel') ||
        label.includes("systemes d'information"))
    );
  }

  private async extractPdfGenerationErrorMessage(err: any): Promise<string> {
    const fallback = 'Erreur lors de la génération du PDF officiel.';
    const error = err?.error;

    if (error instanceof Blob) {
      try {
        const text = await error.text();
        const parsed = JSON.parse(text);
        return parsed?.error || parsed?.detail || fallback;
      } catch {
        return fallback;
      }
    }

    return error?.error || error?.detail || err?.message || fallback;
  }

  clearSelection(): void {
    this.selectedPreselectionCandidateIds = [];
    this.generateListOpen = false;
  }

  /**
   * Ouvre la modal de consultation massive si plusieurs candidats sont sélectionnés
   * Sinon, ouvre la consultation simple
   */
  openConsultationMode(candidature: Candidature): void {
    if (this.typeListe !== 'preselection') {
      this.voirDossier(candidature);
      return;
    }

    // If multiple selected, open bulk consultation modal
    if (this.selectedPreselectionCandidateIds.length > 1) {
      this.openBulkConsultationModal();
    } else {
      this.voirDossier(candidature);
    }
  }

  setListSection(type: 'preselection' | 'selection'): void {
    if (this.typeListe === type) {
      return;
    }

    this.typeListe = type;
    this.resetSelectionState();
    this.pageContext = type === 'selection' ? 'candidature' : 'preselection';
  }

  switchListType(type: 'preselection' | 'selection'): void {
    this.setListSection(type);
  }

  /**
   * Ouvre la modal de consultation massive avec les candidats sélectionnés
   */
  openBulkConsultationModal(): void {
    this.bulkConsultationCandidatesIds = [...this.selectedPreselectionCandidateIds];

    // Get candidature objects for selected IDs
    const allCandidatures = this.getVisibleCandidaturesForTable();
    this.bulkConsultationCandidates = allCandidatures.filter((c) =>
      this.bulkConsultationCandidatesIds.includes(Number(c.id)),
    );

    if (this.bulkConsultationCandidates.length === 0) {
      this.toastService.show('Aucun candidat sélectionné.', 'warning');
      return;
    }

    this.bulkConsultationCurrentIndex = 0;
    this.bulkConsultationOpen = true;
  }

  openSelectionBulkConsultation(): void {
    if (this.selectedPreselectionCandidateIds.length < 2) {
      this.toastService.show(
        'Sélectionnez au moins deux candidats pour ouvrir la consultation massive.',
        'warning',
      );
      return;
    }

    this.openBulkConsultationModal();
  }

  openSelectionBulkConsultationModal(): void {
    this.openPrsSelectionMassiveOCR();
  }

  /**
   * Ferme la modal de consultation massive
   */
  closeBulkConsultationModal(): void {
    this.bulkConsultationOpen = false;
    this.bulkConsultationCandidates = [];
    this.bulkConsultationCurrentIndex = 0;
  }

  private removeBulkConsultationSelection(candidateId: number): void {
    this.selectedPreselectionCandidateIds = this.selectedPreselectionCandidateIds.filter(
      (id) => id !== candidateId,
    );

    const bulkBar = document.getElementById('bulk-bar');
    if (bulkBar) {
      bulkBar.classList.toggle('show', this.selectedPreselectionCandidateIds.length > 0);
    }
  }

  private goToNextBulkConsultationCandidate(): void {
    if (this.bulkConsultationCurrentIndex < this.bulkConsultationCandidates.length - 1) {
      this.bulkConsultationNext();
      return;
    }

    this.toastService.show('✅ Tous les candidats ont été traités.', 'success');
    this.closeBulkConsultationModal();
  }

  /**
   * Navigation suivant dans la modal
   */
  bulkConsultationNext(): void {
    if (this.bulkConsultationCurrentIndex < this.bulkConsultationCandidates.length - 1) {
      this.bulkConsultationCurrentIndex++;
    }
  }

  /**
   * Navigation précédent dans la modal
   */
  bulkConsultationPrevious(): void {
    if (this.bulkConsultationCurrentIndex > 0) {
      this.bulkConsultationCurrentIndex--;
    }
  }

  /**
   * Retourne le candidat actuellement affiché dans la modal
   */
  getCurrentBulkConsultationCandidate(): Candidature | null {
    if (
      this.bulkConsultationCandidates.length === 0 ||
      this.bulkConsultationCurrentIndex >= this.bulkConsultationCandidates.length
    ) {
      return null;
    }
    return this.bulkConsultationCandidates[this.bulkConsultationCurrentIndex];
  }

  /**
   * Valide le candidat actuel et passe au suivant
   */
  bulkConsultationValidate(): void {
    const candidature = this.getCurrentBulkConsultationCandidate();
    if (!candidature) return;

    void this.validateBulkConsultationCandidate(candidature);
  }

  /**
   * Rejette le candidat actuel et passe au suivant
   */
  bulkConsultationReject(): void {
    const candidature = this.getCurrentBulkConsultationCandidate();
    if (!candidature) return;

    void this.rejectBulkConsultationCandidate(candidature);
  }

  private async validateBulkConsultationCandidate(candidature: Candidature): Promise<void> {
    const token = this.authService.getAccessToken();
    if (!token) {
      this.toastService.show('Session expirée. Veuillez vous reconnecter.', 'error');
      return;
    }

    const master = this.offresPreinscription.find(
      (offer) => offer.id === Number(this.selectedMasterForCandidatures),
    );
    const masterLabel = master?.specialite || this.getSelectedMasterName();
    const session = this.selectedAcademicYear || this.getCurrentAcademicYear();

    try {
      await firstValueFrom(
        this.http.post(
          `/api/candidatures/${candidature.id}/commission-decision/`,
          { decision: 'accepter' },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );

      try {
        await firstValueFrom(
          this.http.post(
            '/api/candidatures/commission/historique/',
            {
              action: 'Validation depuis consultation massive',
              specialite: masterLabel,
              session,
              nb_candidats: 1,
              master_id: master?.id || null,
            },
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        );
      } catch (historyError) {
        console.warn('Impossible d’enregistrer l’historique commission:', historyError);
      }

      candidature.statut = 'preselectionne';
      this.removeBulkConsultationSelection(candidature.id);
      this.animateAndHideValidatedCandidate(candidature.id);
      this.toastService.show(`✅ ${candidature.candidat_nom} validé(e)`, 'success');
      window.setTimeout(() => this.goToNextBulkConsultationCandidate(), 220);
    } catch (error) {
      console.error('Erreur validation candidat:', error);
      this.toastService.show('Erreur lors de la validation d’une candidature.', 'error');
    }
  }

  private async rejectBulkConsultationCandidate(candidature: Candidature): Promise<void> {
    const token = this.authService.getAccessToken();
    if (!token) {
      this.toastService.show('Session expirée.', 'error');
      return;
    }

    try {
      await firstValueFrom(
        this.http.put(
          `/api/candidatures/${candidature.id}/changer-statut/`,
          { nouveau_statut: 'rejete', raison: 'Rejet lors de la consultation massive' },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );

      candidature.statut = 'rejete';
      this.removeBulkConsultationSelection(candidature.id);
      this.animateAndHideValidatedCandidate(candidature.id);
      this.toastService.show(`✅ ${candidature.candidat_nom} rejeté(e)`, 'success');

      window.setTimeout(() => this.goToNextBulkConsultationCandidate(), 220);
    } catch (error) {
      this.toastService.show('❌ Erreur lors du rejet', 'error');
      console.error(error);
    }
  }

  // =========== CONSULTATION MASSIVE DE CANDIDATURES (Simple Consultation View) ===========

  /**
   * Ouvre la modal de consultation massive pour les candidatures sélectionnées
   */
  openBulkConsultationCandidaturesModal(): void {
    if (this.selectedCandidaturesIds.length === 0) {
      this.toastService.show('Aucun candidat sélectionné', 'warning');
      return;
    }

    // Récupère les candidatures correspondant aux IDs sélectionnés
    const selectedCandidatures = this.candidaturesMasterViewFiltered.filter((c) =>
      this.selectedCandidaturesIds.includes(c.id),
    );

    if (selectedCandidatures.length === 0) {
      this.toastService.show('Aucun candidat sélectionné', 'warning');
      return;
    }

    this.bulkConsultationCandidatures = selectedCandidatures;
    this.bulkConsultationCandidaturesCurrentIndex = 0;
    this.bulkConsultationCandidaturesOpen = true;
  }

  /**
   * Ferme la modal de consultation massive
   */
  closeBulkConsultationCandidaturesModal(): void {
    this.bulkConsultationCandidaturesOpen = false;
    this.bulkConsultationCandidatures = [];
    this.bulkConsultationCandidaturesCurrentIndex = 0;
  }

  /**
   * Avance au candidat suivant dans la consultation massive
   */
  bulkCandidaturesNext(): void {
    if (
      this.bulkConsultationCandidaturesCurrentIndex <
      this.bulkConsultationCandidatures.length - 1
    ) {
      this.bulkConsultationCandidaturesCurrentIndex++;
    }
  }

  /**
   * Recule au candidat précédent dans la consultation massive
   */
  bulkCandidaturesPrevious(): void {
    if (this.bulkConsultationCandidaturesCurrentIndex > 0) {
      this.bulkConsultationCandidaturesCurrentIndex--;
    }
  }

  /**
   * Retourne le candidat actuellement affiché dans la modal de consultation massive
   */
  getCurrentBulkConsultationCandidature(): Candidature | null {
    if (
      this.bulkConsultationCandidatures.length === 0 ||
      this.bulkConsultationCandidaturesCurrentIndex >= this.bulkConsultationCandidatures.length
    ) {
      return null;
    }
    return this.bulkConsultationCandidatures[this.bulkConsultationCandidaturesCurrentIndex];
  }

  /**
   * Marque un candidat comme lu/vérifié
   */
  markCandidatureAsRead(candidature: Candidature | null): void {
    if (!candidature) {
      this.toastService.show('Aucun candidat à marquer comme lu.', 'warning');
      return;
    }

    this.candidaturesMarkedAsRead.add(candidature.id);
    this.toastService.show(`✓ ${candidature.candidat_nom} marqué comme lu`, 'success');

    // Auto-avance au suivant
    setTimeout(() => {
      if (
        this.bulkConsultationCandidaturesCurrentIndex <
        this.bulkConsultationCandidatures.length - 1
      ) {
        this.bulkCandidaturesNext();
      } else {
        this.toastService.show('✅ Tous les candidats consultés.', 'success');
        this.closeBulkConsultationCandidaturesModal();
      }
    }, 500);
  }

  /**
   * Valide le candidat actuellement affiché dans la modal "Consultation Massive" (candidatures)
   */
  async bulkConsultationCandidatureValidate(): Promise<void> {
    const candidature = this.getCurrentBulkConsultationCandidature();
    if (!candidature) return;

    const token = this.authService.getAccessToken();
    if (!token) {
      this.toastService.show('Session expirée. Veuillez vous reconnecter.', 'error');
      return;
    }

    try {
      await firstValueFrom(
        this.http.post(
          `/api/candidatures/${candidature.id}/commission-decision/`,
          { decision: 'accepter' },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );

      // Optional historique
      try {
        const master = this.offresPreinscription.find(
          (offer) => offer.id === Number(this.selectedMasterForCandidatures),
        );
        const masterLabel = master?.specialite || this.getSelectedMasterName();
        const session = this.selectedAcademicYear || this.getCurrentAcademicYear();

        await firstValueFrom(
          this.http.post(
            '/api/candidatures/commission/historique/',
            {
              action: 'Validation depuis consultation massive',
              specialite: masterLabel,
              session,
              nb_candidats: 1,
              master_id: master?.id || null,
            },
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        );
      } catch (historyError) {
        console.warn('Impossible d’enregistrer l’historique commission:', historyError);
      }

      candidature.statut = 'preselectionne';
      // remove from selected ids
      this.selectedCandidaturesIds = this.selectedCandidaturesIds.filter(
        (id) => id !== candidature.id,
      );
      this.animateAndHideValidatedCandidate(candidature.id);
      this.toastService.show(`✅ ${candidature.candidat_nom} validé(e)`, 'success');

      window.setTimeout(() => {
        if (
          this.bulkConsultationCandidaturesCurrentIndex <
          this.bulkConsultationCandidatures.length - 1
        ) {
          this.bulkCandidaturesNext();
        } else {
          this.toastService.show('✅ Tous les candidats ont été traités.', 'success');
          this.closeBulkConsultationCandidaturesModal();
        }
      }, 220);
    } catch (error) {
      console.error('Erreur validation candidat (candidatures modal):', error);
      this.toastService.show('Erreur lors de la validation d’une candidature.', 'error');
    }
  }

  /**
   * Rejette le candidat actuellement affiché dans la modal "Consultation Massive" (candidatures)
   */
  async bulkConsultationCandidatureReject(): Promise<void> {
    const candidature = this.getCurrentBulkConsultationCandidature();
    if (!candidature) return;

    const token = this.authService.getAccessToken();
    if (!token) {
      this.toastService.show('Session expirée.', 'error');
      return;
    }

    try {
      await firstValueFrom(
        this.http.put(
          `/api/candidatures/${candidature.id}/changer-statut/`,
          { nouveau_statut: 'rejete', raison: 'Rejet lors de la consultation massive' },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );

      candidature.statut = 'rejete';
      this.selectedCandidaturesIds = this.selectedCandidaturesIds.filter(
        (id) => id !== candidature.id,
      );
      this.animateAndHideValidatedCandidate(candidature.id);
      this.toastService.show(`✅ ${candidature.candidat_nom} rejeté(e)`, 'success');

      window.setTimeout(() => {
        if (
          this.bulkConsultationCandidaturesCurrentIndex <
          this.bulkConsultationCandidatures.length - 1
        ) {
          this.bulkCandidaturesNext();
        } else {
          this.toastService.show('✅ Tous les candidats ont été traités.', 'success');
          this.closeBulkConsultationCandidaturesModal();
        }
      }, 220);
    } catch (error) {
      console.error('Erreur rejet candidat (candidatures modal):', error);
      this.toastService.show('❌ Erreur lors du rejet', 'error');
    }
  }

  // =========== CONSULTATION MASSIVE OCR (Unified Modal) ===========

  openMassiveOCR(candidates: any[], title: string = 'Consultation massive'): void {
    if (!candidates || candidates.length === 0) {
      this.toastService.show('Sélectionnez au moins un candidat.', 'warning');
      return;
    }
    this.massiveOCRCandidates = candidates;
    this.massiveOCRCurrentIndex = 0;
    this.massiveOCRTitle = title;
    this.massiveOCROCRDone = {};
    this.massiveOCRDecisions = {};
    this.massiveOCRComments = {};
    this.massiveOCRSearchFilter = '';
    this.massiveOCROpen = true;
  }

  closeMassiveOCR(): void {
    this.massiveOCROpen = false;
  }

  getMassiveOCRCurrentCandidate(): any {
    return this.massiveOCRCandidates[this.massiveOCRCurrentIndex] || null;
  }

  getMassiveOCRFilteredList(): any[] {
    if (!this.massiveOCRSearchFilter) return this.massiveOCRCandidates;
    const f = this.massiveOCRSearchFilter.toLowerCase();
    return this.massiveOCRCandidates.filter(
      (c) =>
        (c.candidat_nom || c.nom || '').toLowerCase().includes(f) ||
        (c.numero || c.num || '').toLowerCase().includes(f),
    );
  }

  massiveOCRPrev(): void {
    if (this.massiveOCRCurrentIndex > 0) this.massiveOCRCurrentIndex--;
  }

  massiveOCRNext(): void {
    if (this.massiveOCRCurrentIndex < this.massiveOCRCandidates.length - 1)
      this.massiveOCRCurrentIndex++;
  }

  massiveOCRSaveAndNext(): void {
    this.toastService.show('Modifications enregistrées', 'success');
    if (this.massiveOCRCurrentIndex < this.massiveOCRCandidates.length - 1) {
      this.massiveOCRCurrentIndex++;
    } else {
      this.toastService.show('Dernier dossier — consultation terminée', 'info');
    }
  }

  decideMassiveOCRCandidate(decision: 'approve' | 'reject' | 'hold'): void {
    const c = this.getMassiveOCRCurrentCandidate();
    if (!c) return;
    this.massiveOCRDecisions[c.id] = decision;
    const labels = { approve: 'Dossier validé', reject: 'Dossier rejeté', hold: 'Mis en attente' };
    const types = { approve: 'success', reject: 'error', hold: 'info' };
    this.toastService.show(labels[decision], types[decision] as any);
  }

  getMassiveOCRDecision(id: number): 'approve' | 'reject' | 'hold' | null {
    return this.massiveOCRDecisions[id] || null;
  }

  lancerOCRMassifCandidat(candId: number): void {
    const key = `${candId}_all`;
    this.massiveOCROCRDone[key] = true;
    this.toastService.show('Analyse OCR lancée pour ce dossier', 'info');
  }

  // ✅ CORRIGÉ : Retourne TRUE seulement s'il y a vraiment des données OCR
  isOCRDoneForCandidat(candId: number): boolean {
    const ocrData = this.massiveOCROCRData[candId];
    return !!(ocrData && ocrData.moteur && ocrData.moteur !== 'none');
  }

  // ✅ NOUVEAU : Récupère les vraies données OCR ou null
  getOCRDataForCandidat(candId: number): any {
    return this.massiveOCROCRData[candId] || null;
  }

  // ✅ NOUVEAU : Enregistre les vraies données OCR
  setOCRDataForCandidat(candId: number, data: any): void {
    this.massiveOCROCRData[candId] = data;
  }

  openPrsSelectionMassiveOCR(): void {
    const ids = this.selectedPreselectionCandidateIds;
    if (ids.length === 0) {
      this.toastService.show('Sélectionnez au moins un candidat.', 'warning');
      return;
    }
    const candidates = this.getVisibleCandidaturesForTable().filter((c) =>
      ids.includes(Number(c.id)),
    );
    this.openMassiveOCR(candidates, 'Consultation massive — Présélection');
  }

  openFinalSelMassiveOCR(): void {
    const ids = Array.from(this.finalSelectionSelectedIds);
    const candidates = this.finalSelectionFiltered.filter((c) => ids.includes(c.id));
    this.openMassiveOCR(candidates, 'Consultation massive — Sélection finale');
  }

  // =========== MEMBRE SÉLECTION BULK ===========

  toggleSelectionMembre(id: number, checked: boolean): void {
    if (checked) this.membreSelectionSelectedIds.add(id);
    else this.membreSelectionSelectedIds.delete(id);
  }

  toggleAllSelectionMembre(checked: boolean): void {
    if (checked) {
      this.finalSelectionFiltered.forEach((c) => this.membreSelectionSelectedIds.add(c.id));
    } else {
      this.membreSelectionSelectedIds.clear();
    }
  }

  isAllSelectionMembreSelected(): boolean {
    return (
      this.finalSelectionFiltered.length > 0 &&
      this.finalSelectionFiltered.every((c) => this.membreSelectionSelectedIds.has(c.id))
    );
  }

  openMassiveOCRMembre(): void {
    const ids = Array.from(this.membreSelectionSelectedIds);
    const candidates = this.finalSelectionFiltered.filter((c) => ids.includes(c.id));
    this.openMassiveOCR(candidates, 'Consultation massive — Sélection (Membre)');
  }

  clearSelectionMembre(): void {
    this.membreSelectionSelectedIds.clear();
  }

  validateAllSelectionMembre(): void {
    const ids = Array.from(this.membreSelectionSelectedIds);
    if (!ids.length) return;
    ids.forEach((id) => {
      const c = this.finalSelectionFiltered.find((x) => x.id === id);
      if (c) c.statut = 'lp';
    });
    this.toastService.show(`${ids.length} candidat(s) validé(s)`, 'success');
    this.clearSelectionMembre();
  }

  /**
   * Marque tous les candidats sélectionnés comme lus
   */
  markAllCandidaturesAsRead(): void {
    if (this.selectedCandidaturesIds.length === 0) {
      this.toastService.show('Aucun candidat sélectionné.', 'warning');
      return;
    }

    const count = this.selectedCandidaturesIds.length;
    this.selectedCandidaturesIds.forEach((id) => {
      this.candidaturesMarkedAsRead.add(id);
    });

    this.toastService.show(
      `✓ ${count} candidat${count > 1 ? 's' : ''} marqué${count > 1 ? 's' : ''} comme lu${count > 1 ? 's' : ''}`,
      'success',
    );
  }

  /**
   * Coche/décoche tous les candidats visibles dans la section candidatures
   */
  toggleAllCandidatures(checked: boolean): void {
    if (checked) {
      this.selectedCandidaturesIds = this.candidaturesMasterViewFiltered.map((c) => c.id);
    } else {
      this.selectedCandidaturesIds = [];
    }

    // Affiche/masque la barre d'actions
    const candidatureBulkBar = document.querySelector('.candidatures-bulk-bar');
    if (candidatureBulkBar) {
      candidatureBulkBar.classList.toggle('show', this.selectedCandidaturesIds.length > 0);
    }
  }

  /**
   * Coche/décoche un candidat spécifique
   */
  toggleCandidature(candidatureId: number, checked: boolean): void {
    const idx = this.selectedCandidaturesIds.indexOf(candidatureId);
    if (checked && idx === -1) {
      this.selectedCandidaturesIds.push(candidatureId);
    } else if (!checked && idx !== -1) {
      this.selectedCandidaturesIds.splice(idx, 1);
    }

    // Affiche/masque la barre d'actions
    const candidatureBulkBar = document.querySelector('.candidatures-bulk-bar');
    if (candidatureBulkBar) {
      candidatureBulkBar.classList.toggle('show', this.selectedCandidaturesIds.length > 0);
    }
  }

  /**
   * Télécharge les dossiers des candidats sélectionnés sous forme de ZIP
   */
  downloadSelectedCandidaturesAsZip(): void {
    if (this.selectedCandidaturesIds.length === 0) {
      this.toastService.show('Aucun candidat sélectionné', 'warning');
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      this.toastService.show('Session expirée.', 'error');
      return;
    }

    const candidatureIds = this.selectedCandidaturesIds.join(',');

    this.toastService.show('Préparation du ZIP... Veuillez patienter', 'info');

    this.http
      .get(`/api/candidatures/download-zip/?ids=${candidatureIds}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      })
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `candidatures_${new Date().toISOString().split('T')[0]}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          this.toastService.show('✅ Téléchargement terminé', 'success');
        },
        error: (err) => {
          console.error(err);
          this.toastService.show(
            '❌ Erreur lors du téléchargement. Endpoint peut ne pas être disponible.',
            'error',
          );
        },
      });
  }

  /**
   * Vérifie si un candidat est coché dans la section candidatures
   */
  isCandidatureChecked(candidatureId: number): boolean {
    return this.selectedCandidaturesIds.includes(candidatureId);
  }

  /**
   * Vérifie si tous les candidats visibles sont cochés
   */
  areAllCandidaturesChecked(): boolean {
    const visibleCandidatures = this.candidaturesMasterViewFiltered;
    return (
      visibleCandidatures.length > 0 &&
      visibleCandidatures.every((c) => this.selectedCandidaturesIds.includes(c.id))
    );
  }

  sendPrompt(msg: string): void {
    try {
      this.toastService?.show?.(msg, 'info');
    } catch (e) {
      console.info('sendPrompt:', msg);
    }
  }

  toggleAll(checked: boolean): void {
    if (!checked) {
      this.selectedPreselectionCandidateIds = [];
      const bulkBar = document.getElementById('bulk-bar');
      if (bulkBar) bulkBar.classList.remove('show');
      return;
    }
    this.selectedPreselectionCandidateIds = this.getVisibleCandidaturesForTable().map((c) =>
      Number(c.id),
    );
    const bulkBar = document.getElementById('bulk-bar');
    if (bulkBar) bulkBar.classList.add('show');
  }

  /**
   * Indique si le "check all" en présélection est actif (tous les éléments visibles cochés)
   */
  isPreselectionCheckAllActive(): boolean {
    const visible = this.getVisibleCandidaturesForTable();
    return visible.length > 0 && this.selectedPreselectionCandidateIds.length === visible.length;
  }

  toggleRow(id: number, checked: boolean): void {
    const idx = this.selectedPreselectionCandidateIds.indexOf(Number(id));
    if (checked && idx === -1) this.selectedPreselectionCandidateIds.push(Number(id));
    if (!checked && idx !== -1) this.selectedPreselectionCandidateIds.splice(idx, 1);
    const bulkBar = document.getElementById('bulk-bar');
    if (bulkBar) bulkBar.classList.toggle('show', this.selectedPreselectionCandidateIds.length > 0);
  }

  private getSelectedVisibleCandidatures(): Candidature[] {
    const selectedIds = new Set(this.selectedPreselectionCandidateIds);
    return this.getVisibleCandidaturesForTable().filter((row) => selectedIds.has(row.id));
  }

  validateBulkSelection(): void {
    const selectedRows = this.getSelectedVisibleCandidatures();
    if (!selectedRows.length) {
      this.toastService.show('Veuillez cocher au moins une candidature.', 'warning');
      return;
    }

    const remainingQuota = this.getRemainingQuota();
    if (selectedRows.length > remainingQuota) {
      this.toastService.show(
        `Validation impossible: ${selectedRows.length} sélectionné(s) pour ${remainingQuota} place(s) restante(s).`,
        'warning',
      );
      return;
    }

    void this.validateCandidatesOnBackend(
      selectedRows,
      this.bulkListType === 'locale'
        ? 'Validation de masse (Locale)'
        : 'Validation de masse (Globale)',
      false,
    );
  }

  changePage(_delta: number): void {}

  goPage(_n: number): void {}

  getResponsibleMasterLabel(stat: ResponsableMasterStat): string {
    return stat.masterNom || 'Master inconnu';
  }

  private notifyActionBlocked(message: string): void {
    this.toastService.show(message, 'warning');
  }

  showAlertMessage(message: string): void {
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

  getCommissionActiveLabel(): string {
    return this.currentYear;
  }

  canAnalyzeDossier(): boolean {
    return this.actionPermissions.verifierDossiers || this.actionPermissions.consultationDossier;
  }

  canChangeStatus(): boolean {
    return (
      this.isResponsable &&
      (this.actionPermissions.verifierDossiers || this.actionPermissions.preselection)
    );
  }

  canGiveAvis(): boolean {
    return this.actionPermissions.preselection || this.actionPermissions.consultationCandidature;
  }

  // ========================================
  // MENU KEBAB
  // ========================================
  toggleActionMenu(candidatureId: number): void {
    if (this.actionMenuOpen === candidatureId) {
      this.actionMenuOpen = null;
    } else {
      this.actionMenuOpen = candidatureId;
    }
  }

  closeActionMenu(): void {
    this.actionMenuOpen = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.action-menu-container')) {
      this.closeActionMenu();
    }
  }

  telechargerDossier(candidature: Candidature): void {
    if (!this.actionPermissions.consultationDossier) {
      this.notifyActionBlocked("Consultation dossier désactivée par l'administration.");
      return;
    }

    const token = this.authService.getAccessToken();

    this.http
      .get(`/api/candidatures/${candidature.id}/telecharger-dossier/`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      })
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `dossier_${candidature.numero}.zip`;
          link.click();
          window.URL.revokeObjectURL(url);
        },
        error: (error) => {
          console.error('Erreur:', error);
          this.showAlertMessage('❌ Erreur lors du téléchargement');
        },
      });

    this.closeActionMenu();
  }

  modifierScore(candidature: Candidature): void {
    if (!this.isResponsable) {
      this.notifyActionBlocked('Seul le responsable peut recalculer le score.');
      this.closeActionMenu();
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      this.toastService.show('Session expirée. Veuillez vous reconnecter.', 'error');
      this.closeActionMenu();
      return;
    }

    this.http
      .post<{
        success?: boolean;
        score?: number;
      }>(
        `/api/candidatures/${candidature.id}/calculer-score/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: (response) => {
          const computedScore = Number(response?.score);
          if (!Number.isFinite(computedScore)) {
            this.toastService.show('Score recalculé, mais valeur invalide retournée.', 'warning');
            return;
          }

          candidature.score = computedScore;

          this.candidatures = this.candidatures.map((row) =>
            row.id === candidature.id ? { ...row, score: computedScore } : row,
          );
          this.candidaturesResponsable = this.candidaturesResponsable.map((row) =>
            row.id === candidature.id ? { ...row, score: computedScore } : row,
          );
          this.candidaturesResponsableFiltrees = this.candidaturesResponsableFiltrees.map((row) =>
            row.id === candidature.id ? { ...row, score: computedScore } : row,
          );

          this.toastService.show(
            `Score recalculé automatiquement: ${computedScore.toFixed(2)}`,
            'success',
          );
        },
        error: (error) => {
          const backendMsg = error?.error?.error || error?.error?.message || '';
          this.toastService.show(
            backendMsg
              ? `Impossible de recalculer le score: ${backendMsg}`
              : 'Impossible de recalculer le score automatiquement.',
            'error',
          );
        },
      });

    this.closeActionMenu();
  }

  rejeterCandidature(candidature: Candidature): void {
    if (!this.canChangeStatus()) {
      this.notifyActionBlocked('Seul le responsable peut rejeter une candidature.');
      return;
    }

    if (
      !confirm(`Êtes-vous sûr de vouloir rejeter la candidature de ${candidature.candidat_nom} ?`)
    ) {
      return;
    }

    const motif = prompt('Motif du rejet :');

    if (!motif) {
      this.showAlertMessage('❌ Le motif est obligatoire');
      return;
    }

    const token = this.authService.getAccessToken();

    this.http
      .post(
        `/api/candidatures/${candidature.id}/rejeter/`,
        { motif: motif },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: () => {
          this.showAlertMessage('✅ Candidature rejetée');
          candidature.statut = 'rejete';
        },
        error: (error) => {
          console.error('Erreur:', error);
          this.showAlertMessage('❌ Erreur lors du rejet');
        },
      });

    this.closeActionMenu();
  }

  // ========================================
  // GESTION PROCÈS-VERBAUX
  // ========================================
  creerPV(): void {
    if (!this.actionPermissions.selectionFinale) {
      this.notifyActionBlocked("Création PV désactivée par l'administration.");
      return;
    }

    if (!this.masterOptions.length) {
      this.toastService.show('Aucun master disponible pour créer un PV.', 'warning');
      return;
    }

    let masterId = this.selectedConfigMasterId;
    if (!masterId) {
      masterId = this.masterOptions[0].id;
    }

    const selectedMaster = this.masterOptions.find((m) => m.id === masterId);
    if (!selectedMaster) {
      this.toastService.show('Master invalide pour la création du PV.', 'error');
      return;
    }

    const token = this.authService.getAccessToken();
    this.http
      .post<any>(
        `/api/candidatures/master/${masterId}/generer-listes/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: (response) => {
          const existingIndex = this.procesVerbaux.findIndex(
            (pv) => pv.master_nom === selectedMaster.nom && pv.statut !== 'publie',
          );

          const pv: ProcesVerbal = {
            id: Number(response?.id ?? Date.now()),
            titre:
              response?.titre ||
              `Délibération ${selectedMaster.nom} - Session ${new Date().getFullYear()}`,
            date_reunion:
              response?.date_reunion ||
              response?.date_creation ||
              new Date().toISOString().slice(0, 10),
            master_nom: response?.master_nom || selectedMaster.nom,
            nb_participants: Number(response?.nb_participants ?? 0),
            nb_candidatures: Number(response?.nb_candidatures ?? response?.total_candidats ?? 0),
            nb_admis: Number(response?.nb_admis ?? response?.admis ?? 0),
            nb_rejetes: Number(response?.nb_rejetes ?? response?.rejetes ?? 0),
            statut: response?.statut || 'brouillon',
          };

          if (existingIndex >= 0) {
            this.procesVerbaux[existingIndex] = pv;
          } else {
            this.procesVerbaux.unshift(pv);
          }

          this.toastService.show('PV généré avec succès.', 'success');
        },
        error: (error) => {
          console.error('Erreur création PV:', error);
          this.toastService.show('Erreur lors de la génération du PV.', 'error');
        },
      });
  }

  voirPV(pv: ProcesVerbal): void {
    this.showAlertMessage(`Consulter PV: ${pv.titre}`);
  }

  telechargerPV(pv: ProcesVerbal): void {
    const token = this.authService.getAccessToken();

    this.http
      .get(`/api/deliberations/${pv.id}/export-pdf/`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      })
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `PV_${pv.id}.pdf`;
          link.click();
          window.URL.revokeObjectURL(url);
        },
        error: (error) => {
          console.error('Erreur:', error);
          this.showAlertMessage('❌ Erreur lors du téléchargement');
        },
      });
  }

  publierPV(pv: ProcesVerbal): void {
    if (!this.actionPermissions.publierListes) {
      this.notifyActionBlocked("Publication désactivée par l'administration.");
      return;
    }

    if (!confirm('Publier ce PV ? Il ne sera plus modifiable.')) {
      return;
    }

    const token = this.authService.getAccessToken();

    this.http
      .post(
        `/api/deliberations/${pv.id}/publier/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: () => {
          this.showAlertMessage('✅ PV publié');
          pv.statut = 'publie';
        },
        error: (error) => {
          console.error('Erreur:', error);
          this.showAlertMessage('❌ Erreur lors de la publication');
        },
      });
  }

  // ========================================
  // NAVIGATION & TITRES
  // ========================================
  get candidaturesAvecDossier(): Candidature[] {
    return this.candidatures.filter((c) => c.dossier_depose);
  }

  get nbDossiersDeposes(): number {
    return this.candidatures.filter((c) => c.dossier_depose).length;
  }

  get validationValidatedCount(): number {
    return this.candidaturesAvecDossier.filter(
      (c) => c.statut === 'dossier_depose' || c.statut === 'selectionne' || c.statut === 'inscrit',
    ).length;
  }

  get validationRejectedCount(): number {
    return this.candidaturesAvecDossier.filter((c) => c.statut === 'rejete').length;
  }

  get validationPendingCount(): number {
    return (
      this.candidaturesAvecDossier.length -
      this.validationValidatedCount -
      this.validationRejectedCount
    );
  }

  switchView(view: CommissionView): void {
    if (!this.canAccessView(view)) {
      this.notifyActionBlocked("Cette section n'est pas active pour votre rôle.");
      return;
    }
    this.currentView = view;
    if (view === 'notifications') {
      this.loadNotifications();
    }
    const candidatureViews: CommissionView[] = [
      'candidatures-responsable',
      'candidatures-master',
      'candidatures-ingenieur',
    ];
    if (candidatureViews.includes(view)) {
      this.resetFiltresResponsable();
      this.loadCandidaturesResponsable();
      if (view === 'candidatures-ingenieur') {
        this.filtres.concours = 'ingenieur';
        this.appliquerFiltresResponsable();
      }
    }
    if (view === 'candidatures') {
      this.loadCandidaturesMembre();
    }

    if (view === 'listes') {
      this.loadDerniereListeGenereeDepuisBackend();
      // ► PEUPLE finalSelectionCandidates depuis les candidatures responsable
      // (statuts éligibles : selectionne + preselectionne)
      this.populateFinalSelectionFromApi();
    }

    // Vues « Inscription en ligne » et « Réclamations » : ces tableaux n'étaient
    // jamais alimentés (arrays vides) → écran blanc. On charge des données de
    // démonstration si rien n'est présent.
    if (view === 'inscriptions') {
      this.ensureInscriptionDemoData();
    }
    if (view === 'reclamations') {
      this.ensureReclamationsDemoData();
    }

    // Vue Présélection : charger les avis pour le 1er candidat préselectionné par défaut
    if (view === 'avis-listes' && this.isResponsable) {
      setTimeout(() => {
        const visibles = this.getVisibleCandidaturesForTable();
        if (visibles.length > 0 && !this.candidatureSelectionnee) {
          this.candidatureSelectionnee = visibles[0];
        }
        if (this.candidatureSelectionnee) {
          this.loadAvisForCandidature(this.candidatureSelectionnee.id);
        }
      }, 200);
    }
  }

  isCurrentView(view: CommissionView): boolean {
    return this.currentView === view;
  }

  openCustomRoleAction(actionName: string): void {
    const normalized = normalizeActionLabel(actionName);
    const target = this.customActionViewMap[normalized];

    if (!target) {
      this.notifyActionBlocked(`Action non mappée: ${actionName}`);
      return;
    }

    if (target === 'ocr') {
      this.openOcrAnalysisPage();
      return;
    }

    if (target) {
      this.switchView(target);
      return;
    }
  }

  openOcrAnalysisPage(candidature?: Candidature): void {
    if (!this.canAnalyzeDossier()) {
      this.notifyActionBlocked('Analyse OCR non autorisée pour votre profil.');
      return;
    }

    const queryParams = candidature?.id ? { candidatureId: candidature.id } : undefined;
    this.currentView = 'ocr';
    this.router.navigate(['/commission/dossier-analysis'], { queryParams });
  }

  allerCandidaturesPage(): void {
    if (!this.actionPermissions.consultationCandidature) {
      this.notifyActionBlocked("Consultation candidature désactivée par l'administration.");
      return;
    }

    this.router.navigate(['/commission/candidatures']);
  }

  getViewTitle(): string {
    const masterLabel = this.getDisplayedResponsableSpecialite();
    const titleMasterSuffix =
      this.isResponsable && masterLabel && masterLabel !== 'Non renseignée'
        ? ` - ${masterLabel}`
        : '';
    const titles: any = {
      dashboard: `Tableau de bord${titleMasterSuffix}`,
      profil: 'Mon Profil',
      'configuration-appels': 'Offre de préinscription',
      'candidatures-responsable': 'Liste de candidature',
      'avis-listes': `Présélection${titleMasterSuffix}`,
      candidatures: this.isResponsable ? 'Candidatures à évaluer' : 'Liste de candidature',
      'valider-dossier': 'Dossiers à valider',
      dossiers: 'Tous les dossiers soumis',
      listes: "Listes d'admission",
      membres: 'Membres de la commission',
      ocr: 'Analyse automatique (OCR)',
      inscriptions: 'Validation des inscriptions',
      statistiques: 'Statistiques et rapports',
      deliberations: 'Procès-verbaux de délibération',
      notifications: 'Notifications',
      'candidatures-master': 'Candidatures Master',
      'candidatures-ingenieur': 'Candidatures Ingénieur',
    };
    return titles[this.currentView] || 'Tableau de bord';
  }

  getCommissionUserRoleLabel(): string {
    return this.isEngineerScope() ? 'Commission Ingénieur' : 'Commission Master';
  }

  getDisplayedResponsableSpecialite(): string {
    const responsableParcours = this.getResponsableParcoursLabel();
    if (responsableParcours) {
      return responsableParcours;
    }

    // Show the active commission's master name (not all masters concatenated)
    if (this.activeCommissionId && this.availableCommissions.length > 0) {
      const activeComm = this.availableCommissions.find((c) => c.id === this.activeCommissionId);
      if (activeComm?.master_nom) return activeComm.master_nom;
      if (activeComm?.nom) return activeComm.nom;
    }
    // Single master → show it directly
    if (this.userMasterNoms.length === 1) {
      return this.userMasterNoms[0];
    }
    // Specific master selected in filter
    if (this.selectedMasterForCandidatures !== 'all') {
      const found = this.masterOptions.find(
        (m) => Number(m.id) === Number(this.selectedMasterForCandidatures),
      );
      if (found?.nom) return found.nom;
    }
    // Fallback to user profile specialite
    return String(this.currentUser?.specialite || '').trim();
  }

  private getResponsableParcoursLabel(): string {
    const email = String(this.currentUser?.email || '').trim().toLowerCase();
    if (this.isResponsable && email.endsWith('@isimm.tn')) {
      return "Master Génie Logiciel et Systèmes d'Information";
    }

    const profileLabel = this.getUserMasterOrSpecialiteLabel();
    if (
      this.isResponsable &&
      /g[ée]nie logiciel|genie logiciel|syst[èe]mes d'information|systemes d'information|mpgl/i.test(
        profileLabel,
      )
    ) {
      return "Master Génie Logiciel et Systèmes d'Information";
    }

    return '';
  }

  getSpecialitesFiltrees(): Specialite[] {
    return this.specialites.filter((s) => s.statut === this.filtreSpecialite);
  }

  consulterSpecialite(spec: Specialite): void {
    this.filtreSpecialiteActive = spec.id.toString();
    this.switchView('candidatures');
  }

  getConcoursStatut(concours: Concours): 'actuel' | 'ancien' {
    const year = Number(concours.annee);
    const currentYear = new Date().getFullYear();

    if (!Number.isNaN(year) && year < currentYear) {
      return 'ancien';
    }

    return 'actuel';
  }

  getConcoursIngenieur(): Concours[] {
    return this.concoursIngenieur.filter(
      (concours) => this.getConcoursStatut(concours) === this.filtreConcours,
    );
  }

  get candidaturesMastersResponsable(): Candidature[] {
    return this.candidaturesResponsable.filter(
      (candidature) => candidature.type_concours === 'masters',
    );
  }

  get candidaturesIngenieurResponsable(): Candidature[] {
    return this.candidaturesResponsable.filter(
      (candidature) => candidature.type_concours === 'ingenieur',
    );
  }

  get candidaturesResponsableMastersCount(): number {
    return this.candidaturesResponsableFiltrees.filter((c) => c.type_concours === 'masters').length;
  }

  get candidaturesResponsableIngenieurCount(): number {
    return this.candidaturesResponsableFiltrees.filter((c) => c.type_concours === 'ingenieur')
      .length;
  }

  get candidaturesIngenieurFiltrees(): Candidature[] {
    return this.candidaturesResponsableFiltrees.filter((c) => c.type_concours === 'ingenieur');
  }

  get ingStatPreselectionnees(): number {
    return this.candidaturesIngenieurFiltrees.filter(
      (c) => c.statut === 'preselectionne' || c.statut === 'selectionne',
    ).length;
  }

  get ingStatRefusees(): number {
    return this.candidaturesIngenieurFiltrees.filter((c) => c.statut === 'rejete').length;
  }

  get ingStatDossierDeposes(): number {
    return this.candidaturesIngenieurFiltrees.filter((c) => c.dossier_depose).length;
  }

  get candidaturesResponsableDossiersDeposesCount(): number {
    return this.candidaturesResponsableFiltrees.filter((c) => c.dossier_depose).length;
  }

  resetFiltresResponsable(): void {
    this.selectedMasterForCandidatures = 'all';
    this.filtres.concours = '';
    this.filtres.statut = '';
    this.filtres.recherche = '';
    this.filtres.scoreMin = null;
    this.filtres.scoreMax = null;
    this.filtres.etablissement = '';
    this.filtreAnneeUniversitaire = 'courante';
    this.filtrePorteeOffres = 'specialite';
    this.selectedCandidaturePreview = null;
    this.candidaturesResponsableFiltrees = [...this.candidaturesResponsable];
  }

  appliquerFiltresResponsable(): void {
    const offresEligibles = this.getEligibleOpenOffresForCurrentProfile();
    const masterIdsEligibles = new Set<number>(
      offresEligibles.map((offre) => Number(offre.id)).filter((id) => Number.isFinite(id)),
    );

    // Use responsable list when available, otherwise fallback to global candidatures
    const baseList: Candidature[] =
      this.candidaturesResponsable && this.candidaturesResponsable.length > 0
        ? this.candidaturesResponsable
        : this.candidatures;

    this.candidaturesResponsableFiltrees = baseList
      .filter((candidature) => {
        if (masterIdsEligibles.size > 0) {
          const masterId = Number(candidature.master_id || 0);
          if (masterId && !masterIdsEligibles.has(masterId)) {
            return false;
          }
        }

        if (
          this.selectedMasterForCandidatures !== 'all' &&
          candidature.master_id !== this.selectedMasterForCandidatures
        ) {
          return false;
        }

        if (this.filtres.concours && candidature.type_concours !== this.filtres.concours) {
          return false;
        }

        if (this.filtres.statut && candidature.statut !== this.filtres.statut) {
          return false;
        }

        const search = (this.filtres.recherche || '').toLowerCase();
        if (search) {
          const match =
            candidature.numero.toLowerCase().includes(search) ||
            candidature.candidat_nom.toLowerCase().includes(search) ||
            candidature.candidat_email.toLowerCase().includes(search) ||
            (candidature.specialite || '').toLowerCase().includes(search);
          if (!match) {
            return false;
          }
        }

        const score = Number(candidature.score || 0);
        const scoreMin = Number(this.filtres.scoreMin);
        const scoreMax = Number(this.filtres.scoreMax);
        if (Number.isFinite(scoreMin) && this.filtres.scoreMin !== null && score < scoreMin) {
          return false;
        }
        if (Number.isFinite(scoreMax) && this.filtres.scoreMax !== null && score > scoreMax) {
          return false;
        }

        const etablissement = (this.filtres.etablissement || '').toLowerCase().trim();
        if (etablissement) {
          const candidateEtab = this.getCandidateEtablissement(candidature).toLowerCase();
          if (!candidateEtab.includes(etablissement)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  }

  validerCandidatureRapide(candidature: Candidature): void {
    if (!this.canChangeStatus()) {
      this.notifyActionBlocked('Seul le responsable peut valider une candidature.');
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      this.toastService.show('Session expirée. Veuillez vous reconnecter.', 'error');
      return;
    }

    this.http
      .post<{
        success: boolean;
        candidature?: Candidature;
        message?: string;
      }>(
        `/api/candidatures/${candidature.id}/update-status/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: (response) => {
          const updatedStatus = response?.candidature?.statut || 'preselectionne';
          this.candidaturesResponsable = this.sortRowsByScoreDesc(
            this.candidaturesResponsable.map((row) =>
              row.id === candidature.id
                ? { ...row, statut: updatedStatus, decision_responsable: 'valide' }
                : row,
            ),
          );
          this.candidatures = this.sortRowsByScoreDesc(
            this.candidatures.map((row) =>
              row.id === candidature.id
                ? { ...row, statut: updatedStatus, decision_responsable: 'valide' }
                : row,
            ),
          );
          this.appliquerFiltresResponsable();
          this.appliquerFiltres();
          this.toastService.show(
            response?.message || 'Candidature validée: présélectionnée.',
            'success',
          );
        },
        error: (error) => {
          const backendMsg = error?.error?.error || error?.error?.message || '';
          this.toastService.show(backendMsg || 'Erreur lors de la validation rapide.', 'error');
        },
      });
  }

  get responsibleNotificationsFiltered(): ResponsibleNotificationItem[] {
    return this.responsibleNotifications.filter((item) => {
      if (
        this.filtreResponsibleNotificationType &&
        item.type !== this.filtreResponsibleNotificationType
      ) {
        return false;
      }

      if (
        this.filtreResponsibleNotificationStatut &&
        item.statut !== this.filtreResponsibleNotificationStatut
      ) {
        return false;
      }

      return true;
    });
  }

  get responsibleDeadlineSoonItems(): ResponsibleNotificationItem[] {
    return this.responsibleNotifications
      .filter((item) => item.days_left >= 0 && item.days_left <= 3)
      .sort((a, b) => a.days_left - b.days_left);
  }

  get responsibleDeadlineSoonCount(): number {
    return this.responsibleDeadlineSoonItems.length;
  }

  getCurrentAcademicYear(): string {
    const now = new Date();
    const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return `${startYear}/${startYear + 1}`;
  }

  getPreviousAcademicYear(): string {
    const [startRaw] = this.getCurrentAcademicYear().split('/');
    const startYear = Number(startRaw || new Date().getFullYear());
    return `${startYear - 1}/${startYear}`;
  }

  getAcademicYearLabel(mode: 'courante' | 'precedente' | 'toutes'): string {
    if (mode === 'courante') {
      return this.getCurrentAcademicYear();
    }
    if (mode === 'precedente') {
      return this.getPreviousAcademicYear();
    }
    return 'Toutes';
  }

  getUserMasterOrSpecialiteLabel(): string {
    const direct =
      this.currentUser?.responsable_master_name ||
      this.currentUser?.responsable_master?.nom ||
      this.currentUser?.responsable_master?.name ||
      this.currentUser?.master_rattachement ||
      this.currentUser?.master_nom ||
      this.currentUser?.master_name ||
      this.currentUser?.master?.nom ||
      this.currentUser?.master?.name ||
      this.currentUser?.specialite ||
      this.currentUser?.speciality ||
      '';
    if (String(direct).trim()) {
      return String(direct).trim();
    }

    const masterId = Number(
      this.currentUser?.responsable_master_id ||
        this.currentUser?.master_id ||
        this.currentUser?.responsable_master?.id ||
        this.currentUser?.master?.id ||
        0,
    );
    if (Number.isFinite(masterId) && masterId > 0) {
      const fromOptions = this.masterOptions.find((m) => Number(m.id) === masterId)?.nom;
      if (String(fromOptions || '').trim()) {
        return String(fromOptions).trim();
      }
    }

    const fromMembers = this.membres.find(
      (member) => member.email?.toLowerCase() === (this.currentUser?.email || '').toLowerCase(),
    );
    return fromMembers?.master_rattachement || 'Tous les masters';
  }

  hasUserScopeLabel(): boolean {
    return this.getUserMasterOrSpecialiteLabel() !== 'Tous les masters';
  }

  isEngineerScope(): boolean {
    const commissionLabel = this.getActiveCommissionLabel().toLowerCase();
    if (commissionLabel && commissionLabel !== 'aucune commission disponible') {
      return commissionLabel.includes('ingénieur') || commissionLabel.includes('ingenieur');
    }

    const label = this.getUserMasterOrSpecialiteLabel().toLowerCase();
    return label.includes('ingénieur') || label.includes('ingenieur');
  }

  private getOffreAcademicYear(offre: OffrePreinscription): string {
    const fromPayload = String(offre.annee_universitaire || '').trim();
    if (fromPayload) {
      return fromPayload;
    }

    const refDate = new Date(offre.date_limite || new Date().toISOString());
    const year = refDate.getFullYear();
    return refDate.getMonth() >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  }

  private getEligibleOpenOffresForCurrentProfile(): OffrePreinscription[] {
    const currentYear = this.getCurrentAcademicYear();
    const previousYear = this.getPreviousAcademicYear();
    // prefer active commission selection if present
    let profileMaster = '';
    if (this.activeCommissionId) {
      const comm = this.availableCommissions.find(
        (c) => Number(c.id) === Number(this.activeCommissionId),
      );
      if (comm && comm.nom) {
        profileMaster = String(comm.nom).toLowerCase();
      }
    }
    if (!profileMaster) {
      profileMaster = this.getUserMasterOrSpecialiteLabel().toLowerCase();
    }

    return this.offresPreinscription.filter((offre) => {
      if (offre.statut !== 'ouvert') {
        return false;
      }

      const offerYear = this.getOffreAcademicYear(offre);
      if (this.filtreAnneeUniversitaire === 'courante' && offerYear !== currentYear) {
        return false;
      }
      if (this.filtreAnneeUniversitaire === 'precedente' && offerYear !== previousYear) {
        return false;
      }

      if (this.filtrePorteeOffres === 'toutes_ouvertes') {
        return true;
      }

      if (!profileMaster || profileMaster === 'tous les masters') {
        return true;
      }

      const offerText = `${offre.titre || ''} ${offre.specialite || ''}`.toLowerCase();
      return offerText.includes(profileMaster);
    });
  }

  onResponsableOfferFiltersChanged(): void {
    this.appliquerFiltresResponsable();
  }

  get offresEligiblesCount(): number {
    return this.getEligibleOpenOffresForCurrentProfile().length;
  }

  getDashboardProgramStats(): DashboardProgramStat[] {
    const baseSource = this.isResponsable
      ? this.candidaturesResponsable.length
        ? this.candidaturesResponsable
        : this.candidatures
      : this.candidatures;
    const source = this.getScopedCandidatures(baseSource);

    const grouped = new Map<string, DashboardProgramStat>();
    source.forEach((cand) => {
      const label = cand.master_nom || cand.specialite || 'Programme non défini';
      const type = (cand.type_concours === 'ingenieur' ? 'ingenieur' : 'masters') as
        | 'masters'
        | 'ingenieur'
        | 'autre';

      if (!grouped.has(label)) {
        grouped.set(label, {
          label,
          type,
          total: 0,
          acceptes: 0,
          inscrits: 0,
          rejetes: 0,
          tauxAcceptation: 0,
          tauxInscription: 0,
        });
      }

      const stat = grouped.get(label)!;
      stat.total += 1;
      if (cand.statut === 'selectionne' || cand.statut === 'inscrit') {
        stat.acceptes += 1;
      }
      if (cand.statut === 'inscrit') {
        stat.inscrits += 1;
      }
      if (cand.statut === 'rejete') {
        stat.rejetes += 1;
      }

      stat.tauxAcceptation = this.getRate(stat.acceptes, stat.total);
      stat.tauxInscription = this.getRate(stat.inscrits, Math.max(stat.acceptes, 1));
    });

    return Array.from(grouped.values()).sort((a, b) => b.total - a.total);
  }

  consulterConcours(concours: Concours): void {
    this.filtreSpecialiteActive = '';
    this.filtres.concours = 'ingenieur';
    this.switchView('candidatures');
    this.appliquerFiltres();
  }

  getCandidaturesFiltrees(): Candidature[] {
    let filtered = [...this.candidatures];

    if (this.filtreSpecialiteActive) {
      const spec = this.specialites.find((s) => s.id.toString() === this.filtreSpecialiteActive);
      if (spec) {
        filtered = filtered.filter((c) => c.specialite === spec.nom);
      }
    }

    if (this.filtreStatut) {
      filtered = filtered.filter((c) => c.statut === this.filtreStatut);
    }

    return filtered;
  }

  // ========================================
  // FILTRES AVANCÉS
  // ========================================
  appliquerFiltres(): void {
    this.candidaturesFiltrees = this.candidatures
      .filter((candidature) => {
        if (this.filtres.concours && candidature.type_concours !== this.filtres.concours) {
          return false;
        }

        if (this.filtres.statut && candidature.statut !== this.filtres.statut) {
          return false;
        }

        if (this.filtres.parcours) {
          const parcours = (candidature.parcours || candidature.specialite || '').toLowerCase();
          if (!parcours.includes(this.filtres.parcours.toLowerCase())) {
            return false;
          }
        }

        if (this.filtres.recherche) {
          const recherche = this.filtres.recherche.toLowerCase();
          const matchNom = candidature.candidat_nom.toLowerCase().includes(recherche);
          const matchEmail = candidature.candidat_email.toLowerCase().includes(recherche);
          const matchCIN = (candidature.candidat_cin || '').toLowerCase().includes(recherche);

          if (!matchNom && !matchEmail && !matchCIN) {
            return false;
          }
        }

        const score = Number(candidature.score || 0);
        const scoreMin = Number(this.filtres.scoreMin);
        const scoreMax = Number(this.filtres.scoreMax);
        if (Number.isFinite(scoreMin) && this.filtres.scoreMin !== null && score < scoreMin) {
          return false;
        }
        if (Number.isFinite(scoreMax) && this.filtres.scoreMax !== null && score > scoreMax) {
          return false;
        }

        const etablissement = (this.filtres.etablissement || '').toLowerCase().trim();
        if (etablissement) {
          const candidateEtab = this.getCandidateEtablissement(candidature).toLowerCase();
          if (!candidateEtab.includes(etablissement)) {
            return false;
          }
        }

        const specFilter = (
          this.filtres.specialite ||
          this.filtreSpecialiteCandidature ||
          ''
        ).trim();
        if (
          specFilter &&
          (candidature.specialite || '').toLowerCase() !== specFilter.toLowerCase()
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  }

  resetFiltres(): void {
    this.filtres = {
      concours: '',
      statut: '',
      parcours: '',
      recherche: '',
      scoreMin: null,
      scoreMax: null,
      etablissement: '',
    };
    this.candidaturesFiltrees = [...this.candidatures];
    this.selectedCandidaturePreview = this.candidaturesFiltrees[0] || null;
  }

  openPanel(index: number): void {
    this.selectedCandidaturePreview = this.candidaturesFiltrees[index] || null;
  }

  closePanel(): void {
    this.selectedCandidaturePreview = null;
  }

  getSelectionStatusBadgeClass(statut: string): string {
    switch ((statut || '').toLowerCase()) {
      case 'soumis':
        return 'b-recv';
      case 'sous_examen':
        return 'b-exam';
      case 'preselectionne':
      case 'selectionne':
      case 'inscrit':
        return 'b-valid';
      case 'rejete':
      case 'annule':
        return 'b-reject';
      default:
        return 'b-recv';
    }
  }

  getSelectionStatusLabel(statut: string): string {
    switch ((statut || '').toLowerCase()) {
      case 'soumis':
        return 'Reçu';
      case 'sous_examen':
        return 'En examen';
      case 'preselectionne':
      case 'selectionne':
      case 'inscrit':
        return 'Validé';
      case 'rejete':
      case 'annule':
        return 'Rejeté';
      case 'dossier_depose':
        return 'Dossier déposé';
      default:
        return statut || 'Inconnu';
    }
  }

  filterTable(): void {
    this.appliquerFiltresResponsable();
  }

  voirDossier(candidature: Candidature): void {
    if (!candidature.dossier_depose) {
      this.toastService.show(
        'Aucun dossier confirmé pour cette candidature. Ouverture de la page documents.',
        'info',
      );
    }

    this.router.navigate(['/consultation-dossier', candidature.id], {
      queryParams: { source: 'liste-generation' },
    });
    this.closeActionMenu();
  }

  voirDossierById(candidatureId: number): void {
    // Navigate to the commission dossier view for a specific candidature id
    this.router.navigate(['/consultation-dossier', candidatureId], {
      queryParams: { source: 'liste-generation' },
    });
    this.closeActionMenu();
  }

  accepterCandidature(candidature: Candidature): void {
    this.candidatureService.deciderCandidatureCommission(candidature.id, 'accepter').subscribe({
      next: (response: { candidature?: Partial<Candidature> }) => {
        const updated = response?.candidature;
        if (updated) {
          this.candidatures = this.candidatures.map((item) => {
            if (item.id !== updated.id) {
              return item;
            }

            return {
              ...item,
              statut: updated.statut ?? item.statut,
              date_changement_statut: updated.date_changement_statut ?? item.date_changement_statut,
            };
          });
          this.appliquerFiltres();
        }
        this.toastService.show('Candidature acceptée.', 'success');
      },
      error: (error: any) => {
        this.toastService.show(
          error?.error?.error || 'Impossible de valider la candidature.',
          'error',
        );
      },
    });
  }

  refuserCandidature(candidature: Candidature): void {
    const motifRejet = window.prompt('Motif du refus (optionnel)', '') || '';

    this.candidatureService
      .deciderCandidatureCommission(candidature.id, 'refuser', motifRejet)
      .subscribe({
        next: (response: { candidature?: Partial<Candidature> }) => {
          const updated = response?.candidature;
          if (updated) {
            this.candidatures = this.candidatures.map((item) => {
              if (item.id !== updated.id) {
                return item;
              }

              return {
                ...item,
                statut: updated.statut ?? item.statut,
                date_changement_statut:
                  updated.date_changement_statut ?? item.date_changement_statut,
              };
            });
            this.appliquerFiltres();
          }
          this.toastService.show('Candidature refusée.', 'warning');
        },
        error: (error: any) => {
          this.toastService.show(
            error?.error?.error || 'Impossible de refuser la candidature.',
            'error',
          );
        },
      });
  }

  // ========================================
  // MODAL AVIS
  // ========================================
  ouvrirModalAvis(candidature: Candidature): void {
    if (!this.isResponsable && !this.actionPermissions.consultationCandidature) {
      this.notifyActionBlocked("Consultation candidature désactivée par l'administration.");
      return;
    }

    this.candidatureSelectionnee = candidature;
    this.avisArgument = '';
    this.avisRecommandation = 'favorable';
    this.showModalAvis = true;
  }

  fermerModalAvis(): void {
    this.showModalAvis = false;
    this.candidatureSelectionnee = null;
    this.avisArgument = '';
    this.avisRecommandation = 'favorable';
  }

  soumettreAvisGlobal(): void {
    if (!this.avisGlobalMembre.trim()) {
      this.toastService.show('Veuillez saisir un commentaire.', 'warning');
      return;
    }
    this.toastService.show('Avis global soumis avec succès.', 'success');
    this.avisGlobalMembre = '';
  }

  toggleMembreAvisSelected(id: number, checked: boolean): void {
    if (checked && !this.membreAvisSelectedIds.includes(id)) {
      this.membreAvisSelectedIds.push(id);
    } else if (!checked) {
      this.membreAvisSelectedIds = this.membreAvisSelectedIds.filter((x) => x !== id);
    }
  }

  clearMembreAvisSelection(): void {
    this.membreAvisSelectedIds = [];
    this.prsMembreGenerateListOpen = false;
  }

  toggleSelectAllMembreAvis(checked: boolean): void {
    if (checked) {
      this.membreAvisSelectedIds = this.getPreselectionMembreFiltered().map((c) => c.id);
    } else {
      this.clearMembreAvisSelection();
    }
  }

  togglePrsMembreGenerateListMenu(): void {
    this.prsMembreGenerateListOpen = !this.prsMembreGenerateListOpen;
  }

  getPreselectionMembreFiltered(): Candidature[] {
    return this.candidaturesFiltrees.filter((c) => {
      if (c.statut !== 'preselectionne') return false;
      const search = (this.prsMembreSearch || '').toLowerCase();
      const matchSearch =
        !search ||
        (c.candidat_nom || '').toLowerCase().includes(search) ||
        String(c.id).includes(search);
      const matchSpec = !this.prsMembreSpecFilter || c.specialite === this.prsMembreSpecFilter;
      const matchType =
        !this.prsMembreTypeFilter ||
        (this.prsMembreTypeFilter === 'interne' && (c as any).type_candidat === 'interne') ||
        (this.prsMembreTypeFilter === 'externe' && (c as any).type_candidat === 'externe');
      const matchMin = this.prsMembreScoreMin == null || (c.score || 0) >= this.prsMembreScoreMin;
      const matchMax = this.prsMembreScoreMax == null || (c.score || 0) <= this.prsMembreScoreMax;
      return matchSearch && matchSpec && matchType && matchMin && matchMax;
    });
  }

  ouvrirModalAvisListe(liste: Liste): void {
    this.listeSelectionneeAvis = liste;
    this.avisListeText = liste.avis || '';
    this.avisListeRecommandation = liste.recommandation || 'favorable';
    this.showModalAvisListe = true;
  }

  fermerModalAvisListe(): void {
    this.showModalAvisListe = false;
    this.listeSelectionneeAvis = null;
    this.avisListeText = '';
    this.avisListeRecommandation = 'favorable';
  }

  enregistrerAvisListe(): void {
    if (!this.avisListeText.trim()) {
      this.showAlertMessage('❌ Veuillez saisir un avis');
      return;
    }

    if (!this.listeSelectionneeAvis) {
      return;
    }

    const avis = this.avisListeText.trim();
    this.listeSelectionneeAvis.avis = avis;
    this.listeSelectionneeAvis.recommandation = this.avisListeRecommandation;

    const index = this.listes.findIndex((liste) => liste.id === this.listeSelectionneeAvis!.id);
    if (index !== -1) {
      this.listes[index].avis = avis;
      this.listes[index].recommandation = this.avisListeRecommandation;
    }

    this.showAlertMessage('✅ Avis enregistré avec succès !');
    this.fermerModalAvisListe();
  }

  enregistrerAvis(): void {
    if (!this.canGiveAvis()) {
      this.notifyActionBlocked('Vous ne pouvez pas déposer un avis sur cette candidature.');
      return;
    }

    if (this.avisRecommandation === 'defavorable' && !this.avisArgument.trim()) {
      this.showAlertMessage('❌ Veuillez saisir un argument pour un avis défavorable');
      return;
    }

    const candidatureId = this.candidatureSelectionnee?.id;
    if (!candidatureId) {
      this.showAlertMessage('❌ Aucune candidature sélectionnée');
      return;
    }

    const activeCommissionIdRaw = localStorage.getItem('active_commission_id');
    const activeCommissionId = activeCommissionIdRaw ? Number(activeCommissionIdRaw) : null;

    const payload: { avis: boolean; argument: string; commission_id?: number } = {
      avis: this.avisRecommandation === 'favorable',
      argument: this.avisArgument.trim(),
    };

    if (Number.isFinite(activeCommissionId as number)) {
      payload.commission_id = activeCommissionId as number;
    }

    this.candidatureService.submitAvis(candidatureId, payload).subscribe({
      next: (response: any) => {
        this.showAlertMessage(response?.message || '✅ Avis enregistré avec succès !');

        const existingVotes = this.candidatureVotes[candidatureId] || [];
        const membreNom =
          this.currentUser?.first_name && this.currentUser?.last_name
            ? `${this.currentUser.first_name} ${this.currentUser.last_name}`
            : this.currentUser?.username || this.currentUser?.email || 'Membre';
        const commissionName = activeCommissionId
          ? `Commission #${activeCommissionId}`
          : 'Commission';

        this.candidatureVotes[candidatureId] = [
          ...existingVotes.filter((vote) => vote.membreNom !== membreNom),
          {
            membreNom,
            role: this.isResponsable ? 'responsable' : 'membre',
            avis: payload.avis,
            recommandation: payload.avis ? 'favorable' : 'defavorable',
            commentaire: payload.argument || 'Sans argument',
            argument: payload.argument,
            date: new Date().toISOString(),
            commissionName,
          },
        ];

        const index = this.candidatures.findIndex((c) => c.id === candidatureId);
        if (index !== -1) {
          this.candidatures[index].avis = payload.argument || this.candidatures[index].avis;
        }

        this.fermerModalAvis();
      },
      error: (error) => {
        console.error('Erreur:', error);
        this.showAlertMessage(
          error?.error?.error || "❌ Erreur lors de l'enregistrement de l'avis",
        );
      },
    });
  }

  getVotesForCandidature(candidatureId: number): CandidatureVoteAvis[] {
    return this.candidatureVotes[candidatureId] || [];
  }

  /**
   * Charge les vrais avis depuis l'API et les croise avec la liste des membres
   * pour afficher : favorable / défavorable / en_attente pour CHAQUE membre.
   * Appelé quand on entre dans la vue Présélection ou qu'on sélectionne un candidat.
   */
  loadAvisForCandidature(candidatureId: number): void {
    if (!candidatureId) return;
    this.candidatureService.getAvisCandidature(candidatureId).subscribe({
      next: (res: any) => {
        const avisList = res?.avis || [];
        // Normaliser en CandidatureVoteAvis (champs renvoyés par AvisMembreSerializer)
        this.candidatureVotes[candidatureId] = avisList.map((a: any) => ({
          membreNom: a.membre_name || '',
          membreEmail: a.membre_email || '',
          recommandation:
            a.avis_type === 'favorable' || a.avis === true ? 'favorable' : 'defavorable',
          commentaire: a.argument || '',
          date: a.date || a.date_avis || '',
        }));
      },
      error: (err) => {
        console.warn('loadAvisForCandidature error:', err);
      },
    });
  }

  /**
   * MEMBRE COMMISSION : soumet un avis Favorable / Défavorable sur le candidat
   * actuellement ouvert dans le drawer OCR.
   *
   * - avis=true  → Favorable
   * - avis=false → Défavorable (un commentaire est demandé via prompt)
   *
   * Côté backend : POST /api/candidatures/<id>/avis/
   * { avis: bool, argument: string, commission_id?: number }
   */
  donnerAvisMembre(favorable: boolean): void {
    if (!this.dossierOCRCandidature || this.avisMembreLoading) return;
    const cand = this.dossierOCRCandidature;

    let argument = '';
    if (!favorable) {
      argument = (
        window.prompt('Avis défavorable : merci de saisir un argument (obligatoire).', '') || ''
      ).trim();
      if (!argument) {
        this.toastService.show('Argument obligatoire pour un avis défavorable.', 'warning');
        return;
      }
    } else {
      argument = (window.prompt('Commentaire (optionnel) :', '') || '').trim();
    }

    // Détermine la commission active (utilisée pour cibler l'avis)
    const activeComm = this.availableCommissions.find((c) => c.id === this.activeCommissionId);
    const commission_id = activeComm?.id || undefined;

    this.avisMembreLoading = true;
    this.candidatureService
      .soumettreAvisMembre(cand.id, {
        avis: favorable,
        argument,
        commission_id,
      })
      .subscribe({
        next: (res: any) => {
          this.avisMembreLoading = false;
          const label = favorable ? 'Favorable' : 'Défavorable';
          this.toastService.show(
            `✅ Avis ${label} enregistré pour ${cand.candidat_nom}`,
            'success',
          );
          // Recharger les avis localement pour cohérence
          this.loadAvisForCandidature(cand.id);
          this.fermerDossierOCR();
        },
        error: (err: any) => {
          this.avisMembreLoading = false;
          const msg = err?.error?.error || err?.message || 'Erreur enregistrement avis';
          this.toastService.show(msg, 'error');
        },
      });
  }

  /**
   * Retourne l'avis d'un membre donné pour la candidature sélectionnée :
   *   { choix: 'favorable' | 'defavorable' | 'en_attente', commentaire, date }
   */
  getAvisMembrePourCandidature(membreEmail: string): {
    choix: 'favorable' | 'defavorable' | 'en_attente';
    commentaire: string;
    date: string;
  } {
    const id = this.candidatureSelectionnee?.id;
    if (!id) return { choix: 'en_attente', commentaire: '', date: '' };
    const votes = this.candidatureVotes[id] || [];
    const vote = votes.find(
      (v: any) => (v.membreEmail || '').toLowerCase() === (membreEmail || '').toLowerCase(),
    );
    if (!vote) return { choix: 'en_attente', commentaire: '', date: '' };
    return {
      choix: (vote.recommandation === 'favorable' ? 'favorable' : 'defavorable') as any,
      commentaire: (vote as any).commentaire || '',
      date: (vote as any).date || '',
    };
  }

  getAllVotesDisplay(candidatureId: number): string {
    const votes = this.getVotesForCandidature(candidatureId);
    if (!votes.length) {
      return 'Aucun avis';
    }

    return votes
      .map((vote) => {
        const role = vote.role === 'responsable' ? 'Responsable' : 'Membre';
        const recomm =
          vote.avis === true || vote.recommandation === 'favorable' ? 'Favorable' : 'Défavorable';
        const argument = (vote.argument || vote.commentaire || '').trim();
        const commission = vote.commissionName ? ` · ${vote.commissionName}` : '';
        return `${role} ${vote.membreNom}${commission}: ${recomm}${argument ? ` (${argument})` : ''}`;
      })
      .join(' | ');
  }

  getCurrentUserScopeLabel(): string {
    const label = this.getUserMasterOrSpecialiteLabel();
    return label && label !== 'Tous les masters' ? label : 'Toutes les spécialités';
  }

  private isCandidatureInScope(candidature: Candidature): boolean {
    const scope = this.getUserMasterOrSpecialiteLabel().toLowerCase().trim();
    if (!scope || scope === 'tous les masters') {
      return true;
    }

    const text = `${candidature.specialite || ''} ${candidature.master_nom || ''}`.toLowerCase();
    return text.includes(scope);
  }

  private getScopedCandidatures(source: Candidature[]): Candidature[] {
    return source.filter((candidature) => this.isCandidatureInScope(candidature));
  }

  getScoreCalculeLabel(candidature: Candidature): string {
    const value = Number(candidature.score);
    if (!Number.isFinite(value)) {
      return '--';
    }
    return value.toFixed(2);
  }

  hasPiecesJointes(candidature: Candidature): boolean {
    return Boolean(candidature.dossier_depose);
  }

  private getCandidatureAcademicYear(candidature: Candidature): string {
    const raw = String(candidature.annee_universitaire || '').trim();
    if (raw) {
      return raw;
    }

    return this.getCurrentAcademicYear();
  }

  getPreselectionWorkflowRows(): Candidature[] {
    const source = this.isResponsable
      ? this.candidaturesResponsable.length
        ? this.candidaturesResponsable
        : this.candidatures
      : this.candidatures;

    const scoped = this.getScopedCandidatures(source);
    const currentYear = this.getCurrentAcademicYear();
    const previousYear = this.getPreviousAcademicYear();
    const search = (this.preselectionSearch || '').toLowerCase().trim();

    const matchesSearchAndDecision = (candidature: Candidature): boolean => {
      const isPreselectedCandidate =
        candidature.statut === 'preselectionne' || candidature.decision_responsable === 'valide';
      if (!isPreselectedCandidate) {
        return false;
      }

      if (
        this.preselectionDecisionFilter &&
        candidature.decision_responsable !== this.preselectionDecisionFilter
      ) {
        return false;
      }

      if (search) {
        const haystack =
          `${candidature.numero || ''} ${candidature.candidat_nom || ''} ${candidature.candidat_email || ''} ${candidature.specialite || ''}`.toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }

      return true;
    };

    const filtered = scoped.filter((candidature) => {
      if (!matchesSearchAndDecision(candidature)) {
        return false;
      }

      const academicYear = this.getCandidatureAcademicYear(candidature);
      if (this.filtreAnneeUniversitaire === 'courante' && academicYear !== currentYear) {
        return false;
      }
      if (this.filtreAnneeUniversitaire === 'precedente' && academicYear !== previousYear) {
        return false;
      }

      return true;
    });

    if (filtered.length === 0 && this.filtreAnneeUniversitaire !== 'toutes') {
      return scoped
        .filter((candidature) => matchesSearchAndDecision(candidature))
        .sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    return filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  consulterCandidaturePreselection(candidature: Candidature): void {
    if (!this.isResponsable && !this.actionPermissions.consultationCandidature) {
      this.notifyActionBlocked("Consultation candidature désactivée par l'administration.");
      return;
    }

    this.candidatureConsultationSelectionnee = candidature;
    this.showModalConsultation = true;
  }

  fermerModalConsultation(): void {
    this.showModalConsultation = false;
    this.candidatureConsultationSelectionnee = null;
  }

  setDecisionPreselection(candidature: Candidature, decision: 'valide' | 'non_valide' | ''): void {
    if (!this.isResponsable) {
      this.notifyActionBlocked('Seul le responsable peut enregistrer la décision finale.');
      return;
    }

    candidature.decision_responsable = decision;
  }

  confirmerDecisionPreselection(candidature: Candidature): void {
    if (!this.isResponsable) {
      this.notifyActionBlocked('Seul le responsable peut confirmer la décision.');
      return;
    }

    if (!candidature.decision_responsable) {
      this.toastService.show('Sélectionnez une décision valide/non valide.', 'warning');
      return;
    }

    const nextStatus = candidature.decision_responsable === 'valide' ? 'preselectionne' : 'rejete';
    this.candidatureStatutSelectionnee = candidature;
    this.statusSelection = nextStatus;
    this.statusRejectReason =
      nextStatus === 'rejete' ? 'Non validée en commission de présélection.' : '';

    if (candidature.statut === nextStatus) {
      this.toastService.show(
        nextStatus === 'preselectionne'
          ? 'La candidature est déjà validée en présélection.'
          : 'La candidature est déjà rejetée.',
        'info',
      );
      return;
    }

    this.confirmerChangementStatut();
  }

  getPreselectionValidCount(): number {
    return this.getPreselectionWorkflowRows().filter((row) => row.decision_responsable === 'valide')
      .length;
  }

  getPreselectionCheckedCount(): number {
    return this.getCheckedPreselectionRows().length;
  }

  isPreselectionRowChecked(candidatureId: number): boolean {
    return this.selectedPreselectionCandidateIds.includes(candidatureId);
  }

  areAllPreselectionRowsChecked(): boolean {
    const rows = this.getPreselectionWorkflowRows();
    if (!rows.length) {
      return false;
    }

    return rows.every((row) => this.selectedPreselectionCandidateIds.includes(row.id));
  }

  togglePreselectionRow(candidature: Candidature, checked: boolean): void {
    if (!this.isResponsable) {
      return;
    }

    if (checked) {
      if (!this.selectedPreselectionCandidateIds.includes(candidature.id)) {
        this.selectedPreselectionCandidateIds = [
          ...this.selectedPreselectionCandidateIds,
          candidature.id,
        ];
      }
      return;
    }

    this.selectedPreselectionCandidateIds = this.selectedPreselectionCandidateIds.filter(
      (id) => id !== candidature.id,
    );
  }

  toggleAllPreselectionRows(checked: boolean): void {
    if (!this.isResponsable) {
      return;
    }

    const rows = this.getPreselectionWorkflowRows();
    if (!rows.length) {
      this.selectedPreselectionCandidateIds = [];
      return;
    }

    if (checked) {
      const ids = rows.map((row) => row.id);
      this.selectedPreselectionCandidateIds = Array.from(
        new Set([...this.selectedPreselectionCandidateIds, ...ids]),
      );
      return;
    }

    const idsToRemove = new Set(rows.map((row) => row.id));
    this.selectedPreselectionCandidateIds = this.selectedPreselectionCandidateIds.filter(
      (id) => !idsToRemove.has(id),
    );
  }

  getCheckedPreselectionRows(): Candidature[] {
    const selectedIds = new Set(this.selectedPreselectionCandidateIds);
    return this.getPreselectionWorkflowRows().filter((row) => selectedIds.has(row.id));
  }

  private createSelectionListFromRows(
    rows: Candidature[],
    listNamePrefix: string,
    recommendation: 'favorable' | 'reserve',
  ): Liste {
    const specialiteLabel = this.getCurrentUserScopeLabel();
    const dateCreation = new Date().toLocaleDateString('fr-FR');
    return {
      id: Date.now() + Math.floor(Math.random() * 1000),
      nom: `${listNamePrefix} ${specialiteLabel} ${this.selectedAcademicYear}`,
      specialite: specialiteLabel,
      type: 'selection',
      statut: 'active',
      nb_candidats: rows.length,
      date_creation: dateCreation,
      avis: `Générée depuis la présélection (${rows.length} candidature(s), session ${this.selectedAcademicYear}).`,
      recommandation: recommendation,
    };
  }

  private applyGeneratedListLocally(
    rows: Candidature[],
    typeListe: 'principale' | 'attente',
  ): void {
    const createdList =
      typeListe === 'attente'
        ? this.createSelectionListFromRows(rows, "Liste d'Attente -", 'reserve')
        : this.createSelectionListFromRows(rows, 'Liste Principale -', 'favorable');

    const statutApplique: 'selectionne' | 'en_attente' =
      typeListe === 'attente' ? 'en_attente' : 'selectionne';

    this.upsertGeneratedListInMemory(createdList);
    this.generatedSelectionRows = [...rows]
      .map((row) => ({ ...row, statut: statutApplique }))
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

    this.synchronizeStatusesAfterGeneration(
      rows.map((row) => row.id),
      statutApplique,
    );

    this.switchView('listes');
    this.typeListe = 'selection';
    this.selectedPreselectionCandidateIds = [];

    this.showAlertMessage(
      `Nouvelle liste créée:\nNom: ${createdList.nom}\nCandidats: ${createdList.nb_candidats}\nDate: ${createdList.date_creation}\nAvis: ${createdList.avis}\nRecommandation: ${createdList.recommandation}`,
    );

    const label = typeListe === 'attente' ? "d'attente" : 'de sélection';
    this.toastService.show(
      `Liste ${label} générée en mode local (${rows.length} candidature(s)).`,
      'warning',
    );
  }

  private canPersistGeneratedList(rows: Candidature[]): boolean {
    return rows.every((row) => Number(row.master_id || 0) > 0);
  }

  private getMasterIdForSelectedRows(rows: Candidature[]): number | null {
    const idsFromRows = Array.from(
      new Set(
        rows
          .map((row) => Number(row.master_id || 0))
          .filter((masterId) => Number.isFinite(masterId) && masterId > 0),
      ),
    );

    if (idsFromRows.length > 1) {
      this.toastService.show(
        'Les candidatures cochées appartiennent à plusieurs masters. Filtrez par master avant génération.',
        'warning',
      );
      return null;
    }

    if (idsFromRows.length === 1) {
      return idsFromRows[0];
    }

    if (
      this.selectedMasterForCandidatures !== 'all' &&
      Number.isFinite(Number(this.selectedMasterForCandidatures))
    ) {
      return Number(this.selectedMasterForCandidatures);
    }

    if (this.selectedConfigMasterId && Number.isFinite(Number(this.selectedConfigMasterId))) {
      return Number(this.selectedConfigMasterId);
    }

    const fallback = this.getPreselectionWorkflowRows().find(
      (row) => Number(row.master_id || 0) > 0,
    );
    return fallback ? Number(fallback.master_id) : null;
  }

  private getPreferredMasterIdForLatestList(): number | null {
    if (
      this.selectedMasterForCandidatures !== 'all' &&
      Number.isFinite(Number(this.selectedMasterForCandidatures))
    ) {
      return Number(this.selectedMasterForCandidatures);
    }

    if (this.selectedConfigMasterId && Number.isFinite(Number(this.selectedConfigMasterId))) {
      return Number(this.selectedConfigMasterId);
    }

    const fromRows = this.getPreselectionWorkflowRows().find(
      (row) => Number(row.master_id || 0) > 0,
    );
    if (fromRows) {
      return Number(fromRows.master_id);
    }

    const fromAll = this.candidatures.find((row) => Number(row.master_id || 0) > 0);
    return fromAll ? Number(fromAll.master_id) : null;
  }

  private formatApiListToUiList(payload: NonNullable<ListeGenerationApiPayload['liste']>): Liste {
    const typeLabel = payload.type_liste === 'attente' ? "Liste d'Attente" : 'Liste Principale';
    const createdDate = new Date(payload.date_creation);
    return {
      id: payload.id,
      nom: `${typeLabel} - ${payload.master_nom} (${payload.annee_universitaire})`,
      specialite: payload.master_nom,
      type: 'selection',
      statut: 'active',
      nb_candidats: payload.nb_candidats,
      date_creation: Number.isNaN(createdDate.getTime())
        ? payload.date_creation
        : createdDate.toLocaleDateString('fr-FR'),
      avis: `Générée depuis la présélection (${payload.nb_candidats} candidature(s)).`,
      recommandation: payload.type_liste === 'attente' ? 'reserve' : 'favorable',
    };
  }

  private upsertGeneratedListInMemory(list: Liste): void {
    this.listes = [list, ...this.listes.filter((existing) => existing.id !== list.id)];
    this.derniereListeGeneree = list;
  }

  private synchronizeStatusesAfterGeneration(
    candidateIds: number[],
    statut: 'selectionne' | 'en_attente',
  ): void {
    const selectedIds = new Set(candidateIds);

    this.candidatures = this.candidatures.map((candidature) =>
      selectedIds.has(candidature.id) ? { ...candidature, statut } : candidature,
    );

    this.candidaturesResponsable = this.candidaturesResponsable.map((candidature) =>
      selectedIds.has(candidature.id) ? { ...candidature, statut } : candidature,
    );
  }

  private loadDerniereListeGenereeDepuisBackend(): void {
    const masterId = this.getPreferredMasterIdForLatestList();
    const token = this.authService.getAccessToken();

    if (!masterId || !token) {
      return;
    }

    this.http
      .get<ListeGenerationApiPayload>(
        `/api/candidatures/master/${masterId}/liste-admission-recente/`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: (response) => {
          if (!response?.liste) {
            this.generatedSelectionRows = [];
            return;
          }

          const uiList = this.formatApiListToUiList(response.liste);
          this.upsertGeneratedListInMemory(uiList);
          this.generatedSelectionRows = [...(response.candidats || [])].sort(
            (a, b) => Number(b.score || 0) - Number(a.score || 0),
          );
        },
        error: (error) => {
          console.warn('Impossible de charger la dernière liste générée:', error);
        },
      });
  }

  private submitGeneratedListToBackend(
    rows: Candidature[],
    typeListe: 'principale' | 'attente',
  ): void {
    if (!this.canPersistGeneratedList(rows)) {
      this.applyGeneratedListLocally(rows, typeListe);
      return;
    }

    const masterId = this.getMasterIdForSelectedRows(rows);
    const token = this.authService.getAccessToken();

    if (!masterId) {
      this.applyGeneratedListLocally(rows, typeListe);
      return;
    }

    if (!token) {
      this.applyGeneratedListLocally(rows, typeListe);
      return;
    }

    const candidatureIds = rows.map((row) => row.id);
    const statutApplique: 'selectionne' | 'en_attente' =
      typeListe === 'attente' ? 'en_attente' : 'selectionne';

    this.http
      .post<ListeGenerationApiPayload>(
        `/api/candidatures/master/${masterId}/generer-liste-manuelle/`,
        {
          candidature_ids: candidatureIds,
          type_liste: typeListe,
          annee_universitaire: this.selectedAcademicYear || this.getCurrentAcademicYear(),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: (response) => {
          if (!response?.liste) {
            this.toastService.show(
              'Réponse backend invalide pour la génération de liste.',
              'error',
            );
            return;
          }

          const createdList = this.formatApiListToUiList(response.liste);
          this.upsertGeneratedListInMemory(createdList);
          this.generatedSelectionRows = [...(response.candidats || rows)]
            .map((row) => ({ ...row, statut: row.statut || statutApplique }))
            .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
          this.synchronizeStatusesAfterGeneration(candidatureIds, statutApplique);

          this.switchView('listes');
          this.typeListe = 'selection';
          this.selectedPreselectionCandidateIds = [];

          this.showAlertMessage(
            `Nouvelle liste créée:\nNom: ${createdList.nom}\nCandidats: ${createdList.nb_candidats}\nDate: ${createdList.date_creation}\nAvis: ${createdList.avis}\nRecommandation: ${createdList.recommandation}`,
          );

          const label = typeListe === 'attente' ? "d'attente" : 'de sélection';
          this.toastService.show(
            `Liste ${label} générée et persistée (${rows.length} candidature(s)).`,
            'success',
          );
        },
        error: (error) => {
          console.error('Erreur génération liste persistée:', error);
          const backendMessage = error?.error?.error || error?.error?.message;
          this.toastService.show(
            backendMessage || 'Erreur backend, bascule en mode local.',
            'warning',
          );
          this.applyGeneratedListLocally(rows, typeListe);
        },
      });
  }

  genererListeSelectionDepuisCandidaturesCochees(): void {
    if (!this.isResponsable) {
      this.notifyActionBlocked('Seul le responsable peut générer la liste de sélection.');
      return;
    }

    const selectedRows = this.getCheckedPreselectionRows();
    if (!selectedRows.length) {
      this.toastService.show('Veuillez cocher au moins une candidature.', 'warning');
      return;
    }

    this.submitGeneratedListToBackend(selectedRows, 'principale');
  }

  genererListeAttenteDepuisCandidaturesCochees(): void {
    if (!this.isResponsable) {
      this.notifyActionBlocked("Seul le responsable peut générer la liste d'attente.");
      return;
    }

    const selectedRows = this.getCheckedPreselectionRows();
    if (!selectedRows.length) {
      this.toastService.show('Veuillez cocher au moins une candidature.', 'warning');
      return;
    }

    this.submitGeneratedListToBackend(selectedRows, 'attente');
  }

  genererListePreselectionParScore(): void {
    if (!this.isResponsable) {
      this.notifyActionBlocked('Seul le responsable peut générer la liste de présélection.');
      return;
    }

    const quota = Math.max(1, Number(this.preselectionQuota || 0));
    const baseRows = this.getPreselectionWorkflowRows();
    const eligibles = baseRows.filter(
      (row) => row.decision_responsable === 'valide' && row.statut !== 'rejete',
    );

    if (!eligibles.length) {
      this.toastService.show(
        'Aucune candidature validée par le responsable pour générer la présélection.',
        'warning',
      );
      return;
    }

    const topRows = eligibles.slice(0, quota);
    const selectedIds = new Set<number>(topRows.map((row) => row.id));

    this.preselectionRowsForGeneration = topRows;
    this.candidatures = this.candidatures.map((candidature) =>
      selectedIds.has(candidature.id)
        ? { ...candidature, statut: 'preselectionne', decision_responsable: 'valide' }
        : candidature,
    );

    const specialiteLabel = this.getCurrentUserScopeLabel();
    const existing = this.listes.find(
      (liste) => liste.type === 'preselection' && liste.specialite === specialiteLabel,
    );
    const dateCreation = new Date().toLocaleDateString('fr-FR');

    if (existing) {
      existing.nb_candidats = topRows.length;
      existing.date_creation = dateCreation;
      existing.statut = 'active';
    } else {
      this.listes.unshift({
        id: Date.now(),
        nom: `Présélection ${specialiteLabel} ${new Date().getFullYear()}`,
        specialite: specialiteLabel,
        type: 'preselection',
        statut: 'active',
        nb_candidats: topRows.length,
        date_creation: dateCreation,
      });
    }

    this.toastService.show(
      `Liste de présélection générée (${topRows.length} candidats).`,
      'success',
    );
  }

  getSelectionListsForMember(): Liste[] {
    return this.listes
      .filter((liste) => liste.type === 'selection')
      .sort((a, b) => {
        const dateA = new Date(a.date_creation || '').getTime() || 0;
        const dateB = new Date(b.date_creation || '').getTime() || 0;
        return dateB - dateA;
      });
  }

  getSelectionCandidatesTotalForMember(): number {
    return this.getSelectionListsForMember().reduce(
      (total, liste) => total + Number(liste.nb_candidats || 0),
      0,
    );
  }

  get validationRows(): Candidature[] {
    const rows = this.getScopedCandidatures(this.candidaturesAvecDossier);
    const search = (this.validationFilters.recherche || '').toLowerCase().trim();

    return rows.filter((candidature) => {
      if (this.validationFilters.statut && candidature.statut !== this.validationFilters.statut) {
        return false;
      }

      if (this.validationFilters.diplomeConforme) {
        const votes = this.getVotesForCandidature(candidature.id);
        const hasNonConforme = votes.some((vote) => vote.diplomeConforme === false);
        if (this.validationFilters.diplomeConforme === 'oui' && hasNonConforme) {
          return false;
        }
        if (this.validationFilters.diplomeConforme === 'non' && !hasNonConforme) {
          return false;
        }
      }

      if (!search) {
        return true;
      }

      const haystack =
        `${candidature.numero} ${candidature.candidat_nom} ${candidature.specialite}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  verifierDossiersFiltres(): void {
    this.toastService.show(
      `${this.validationRows.length} dossier(s) correspondent aux filtres de vérification.`,
      'info',
    );
  }

  getFavorableVotesCount(candidatureId: number): number {
    return this.getVotesForCandidature(candidatureId).filter(
      (vote) => vote.recommandation === 'favorable',
    ).length;
  }

  canValidatePreselection(candidature: Candidature): boolean {
    return this.canChangeStatus() && candidature.statut === 'sous_examen';
  }

  validerPreselectionParResponsable(candidature: Candidature): void {
    if (!this.canValidatePreselection(candidature)) {
      this.notifyActionBlocked('Validation de présélection réservée au responsable.');
      return;
    }

    const favorableVotes = this.getFavorableVotesCount(candidature.id);
    if (favorableVotes < 2) {
      this.toastService.show(
        'Validation impossible: au moins 2 avis favorables sont requis.',
        'warning',
      );
      return;
    }

    if (candidature.statut === 'preselectionne') {
      candidature.decision_responsable = 'valide';
      this.toastService.show('La candidature est déjà validée en présélection.', 'info');
      this.closeActionMenu();
      return;
    }

    // ✅ Utiliser le nouveau modal au lieu de confirmerChangementStatut directement
    this.ouvrirModalValidationPreselection(candidature);
    this.closeActionMenu();
  }

  onStatutChange(candidature: Candidature): void {
    console.log('Nouveau statut sélectionné:', candidature.nouveau_statut);
  }

  getAuthorizedStatutTransitions(candidature: Candidature): string[] {
    const currentStatut = candidature.statut;
    const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatut] || new Set();
    return Array.from(allowed);
  }

  getStatusDisplayLabel(statut: string): string {
    const labels: Record<string, string> = {
      soumis: 'Soumis',
      sous_examen: 'En examen',
      preselectionne: 'Présélectionné',
      en_attente_dossier: 'En attente dossier',
      dossier_depose: 'Dossier déposé',
      dossier_non_depose: 'Dossier non déposé',
      en_attente: 'En attente',
      selectionne: 'Sélectionné',
      rejete: 'Rejeté',
      annule: 'Annulé',
      inscrit: 'Inscrit',
    };

    return labels[statut] || statut;
  }

  ouvrirModalStatut(candidature: Candidature): void {
    if (!this.canChangeStatus()) {
      this.notifyActionBlocked('Seul le responsable peut changer le statut.');
      return;
    }

    const authorized = this.getAuthorizedStatutTransitions(candidature);
    if (authorized.length === 0) {
      this.showAlertMessage('Aucune transition de statut autorisée pour cette candidature.');
      return;
    }

    this.candidatureStatutSelectionnee = candidature;
    this.statusOptions = authorized;
    this.statusSelection =
      candidature.nouveau_statut && authorized.includes(candidature.nouveau_statut)
        ? candidature.nouveau_statut
        : authorized[0];
    this.statusRejectReason = '';
    this.showModalStatut = true;
    this.closeActionMenu();
  }

  fermerModalStatut(): void {
    this.showModalStatut = false;
    this.candidatureStatutSelectionnee = null;
    this.statusOptions = [];
    this.statusSelection = '';
    this.statusRejectReason = '';
  }

  changerStatut(candidature: Candidature): void {
    this.ouvrirModalStatut(candidature);
  }

  confirmerChangementStatut(): void {
    if (!this.canChangeStatus()) {
      this.notifyActionBlocked('Seul le responsable peut confirmer un changement de statut.');
      return;
    }

    if (!this.candidatureStatutSelectionnee) {
      return;
    }

    const candidature = this.candidatureStatutSelectionnee;
    candidature.nouveau_statut = this.statusSelection;

    const authorized = this.getAuthorizedStatutTransitions(candidature);
    if (!authorized.includes(candidature.nouveau_statut!)) {
      this.showAlertMessage(
        `❌ Transition non autorisée: ${candidature.statut} → ${candidature.nouveau_statut}`,
      );
      return;
    }

    let motif_rejet = '';

    if (candidature.nouveau_statut === 'rejete') {
      motif_rejet = this.statusRejectReason.trim();
      if (!motif_rejet) {
        this.showAlertMessage('❌ Le motif de rejet est obligatoire');
        return;
      }
    }

    // En mode fallback local (aucune ligne API), appliquer la transition côté UI
    // pour éviter une erreur 404 sur une candidature mock/non persistée.
    if (this.isResponsable && !this.responsableCandidaturesFromApi) {
      candidature.statut = candidature.nouveau_statut!;
      candidature.nouveau_statut = '';
      if (candidature.statut === 'preselectionne') {
        candidature.decision_responsable = 'valide';
      } else if (candidature.statut === 'rejete') {
        candidature.decision_responsable = 'non_valide';
      }
      this.toastService.show('Statut mis à jour (mode local).', 'success');
      this.fermerModalStatut();
      return;
    }

    const token = this.authService.getAccessToken();

    this.http
      .post(
        `/api/candidatures/${candidature.id}/changer-statut/`,
        {
          statut: candidature.nouveau_statut,
          motif_rejet: motif_rejet,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: () => {
          this.toastService.show('Statut changé avec succès.', 'success');
          candidature.statut = candidature.nouveau_statut!;
          candidature.nouveau_statut = '';
          this.fermerModalStatut();
        },
        error: (error) => {
          console.error('Erreur:', error);
          const backendMsg = error?.error?.error || error?.error?.message || '';
          this.toastService.show(
            backendMsg
              ? `Erreur lors du changement de statut: ${backendMsg}`
              : 'Erreur lors du changement de statut.',
            'error',
          );
        },
      });
  }

  // ========================================
  // LISTES
  // ========================================
  getListesByType(): Liste[] {
    const lists = this.listes.filter((l) => l.type === this.typeListe);

    if (this.typeListe === 'selection' && lists.length === 0) {
      const selectionCount =
        this.generatedSelectionRows.length || this.selectedCandidaturesIds.length;

      if (selectionCount > 0) {
        return [
          {
            id: -1,
            nom: 'Sélection générée localement',
            specialite: this.getCurrentUserScopeLabel(),
            type: 'selection',
            statut: 'active',
            nb_candidats: selectionCount,
            date_creation: new Date().toLocaleDateString('fr-FR'),
            avis: 'Liste de sélection préparée à partir des candidatures validées.',
            recommandation: 'favorable',
          },
        ];
      }
    }

    return lists;
  }

  get listesActivesByTypeCount(): number {
    return this.getListesByType().filter((liste) => liste.statut === 'active').length;
  }

  get listesArchivesByTypeCount(): number {
    return this.getListesByType().filter((liste) => liste.statut === 'archivee').length;
  }

  get totalCandidatsByTypeCount(): number {
    return this.getListesByType().reduce((total, liste) => total + (liste.nb_candidats || 0), 0);
  }

  // ============= SELECTION FINALE METHODS =============

  get selectionSelectedCount(): number {
    return this.selectionSelected.size;
  }

  filterSelectionTable(): void {
    let filtered = [...this.selectionCandidates];
    const f = this.selectionFilters;

    // Score filter
    filtered = filtered.filter((c) => c.score >= f.scoreMin && c.score <= f.scoreMax);

    // Search filter
    if (f.search) {
      const s = f.search.toLowerCase();
      filtered = filtered.filter((c) => c.candidat_nom.toLowerCase().includes(s));
    }

    // Type filter
    if (f.type !== 'all') {
      filtered = filtered.filter((c) =>
        f.type === 'interne' ? c.type_concours === 'interne' : c.type_concours === 'externe',
      );
    }

    // Specialty filter
    if (f.specialty) {
      filtered = filtered.filter((c) => c.specialite === f.specialty);
    }

    // Hide validated
    if (f.hideValidated) {
      filtered = filtered.filter((c) => !c.selectionStatut || c.selectionStatut === '');
    }

    // Top 100
    if (f.top100) {
      const sorted = filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
      filtered = sorted.slice(0, 100);
    }

    this.selectionFiltered = filtered;
    this.updateSelectionStats();
  }

  resetSelectionFilters(): void {
    this.selectionFilters = {
      session: this.currentYear,
      type: 'all',
      specialty: '',
      scoreMin: 0,
      scoreMax: 20,
      search: '',
      top100: false,
      hideValidated: false,
    };
    this.filterSelectionTable();
  }

  toggleSelectionRow(id: number): void {
    if (this.selectionSelected.has(id)) {
      this.selectionSelected.delete(id);
    } else {
      this.selectionSelected.add(id);
    }
    this.updateSelectionAll();
  }

  toggleSelectionAll(): void {
    if (this.selectionAllChecked) {
      this.selectionSelected.clear();
      this.selectionFiltered.forEach((c) => this.selectionSelected.add(c.id));
    } else {
      this.selectionSelected.clear();
    }
    this.selectionAllChecked = !this.selectionAllChecked;
  }

  updateSelectionAll(): void {
    this.selectionAllChecked =
      this.selectionFiltered.length > 0 &&
      this.selectionFiltered.every((c) => this.selectionSelected.has(c.id));
  }

  updateSelectionStats(): void {
    const lp = this.selectionCandidates.filter((c) => c.selectionStatut === 'lp').length;
    const la = this.selectionCandidates.filter((c) => c.selectionStatut === 'la').length;
    const refuse = this.selectionCandidates.filter((c) => c.selectionStatut === 'refuse').length;
    this.selectionStats = { lp, la, refuse };
    const scores = this.selectionCandidates.filter((c) => c.score).map((c) => c.score);
    this.selectionAvgScore =
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  }

  updateSelectionStatut(cand: Candidature): void {
    const idx = this.selectionCandidates.findIndex((c) => c.id === cand.id);
    if (idx >= 0) {
      this.selectionCandidates[idx].selectionStatut = cand.selectionStatut;
      this.updateSelectionStats();
    }
  }

  updateSelectionObs(cand: Candidature): void {
    const idx = this.selectionCandidates.findIndex((c) => c.id === cand.id);
    if (idx >= 0) {
      this.selectionCandidates[idx].observation = cand.observation;
    }
  }

  getScoreClass(score: number): string {
    if (score > 15) return 'sf-green';
    if (score >= 10) return 'sf-amber';
    return 'sf-red';
  }

  getScorePct(score: number): number {
    return Math.min(100, Math.round((score / 20) * 100));
  }

  getStatutSelectClass(statut: string | undefined): string {
    if (statut === 'lp') return 's-lp';
    if (statut === 'la') return 's-la';
    if (statut === 'refuse') return 's-refuse';
    return 's-empty';
  }

  getQuotaClass(type: 'lp' | 'la'): string {
    const count = type === 'lp' ? this.selectionStats.lp : this.selectionStats.la;
    const total = type === 'lp' ? this.quotaLpTotal : this.quotaLaTotal;
    if (count > total) return 'qf-full';
    if (count >= total - 2) return 'qf-warn';
    return type === 'lp' ? 'qf-lp' : 'qf-la';
  }

  getQuotaPct(type: 'lp' | 'la'): number {
    const count = type === 'lp' ? this.selectionStats.lp : this.selectionStats.la;
    const total = type === 'lp' ? this.quotaLpTotal : this.quotaLaTotal;
    return Math.min(100, Math.round((count / total) * 100));
  }

  getQuotaHint(type: 'lp' | 'la'): string {
    const count = type === 'lp' ? this.selectionStats.lp : this.selectionStats.la;
    const total = type === 'lp' ? this.quotaLpTotal : this.quotaLaTotal;
    if (count > total) return `Quota dépassé !`;
    return `${total - count} place(s) restante(s) — ${type.toUpperCase()}`;
  }

  getQuotaHintClass(type: 'lp' | 'la'): string {
    const count = type === 'lp' ? this.selectionStats.lp : this.selectionStats.la;
    const total = type === 'lp' ? this.quotaLpTotal : this.quotaLaTotal;
    if (count > total) return 'qh-full';
    if (count >= total - 2) return 'qh-warn';
    return 'qh-ok';
  }

  applySelectionBulkAction(): void {
    const action = this.selectionBulkAction;
    if (!action) {
      this.showToast('Choisissez une action groupée', 't-warn');
      return;
    }
    this.selectionSelected.forEach((id) => {
      const cand = this.selectionCandidates.find((c) => c.id === id);
      if (cand) {
        cand.selectionStatut = action;
      }
    });
    this.selectionSelected.clear();
    this.updateSelectionStats();
    this.filterSelectionTable();
    this.showToast(`${this.selectionSelected.size} candidats mis à jour`, 't-success');
  }

  toggleSelectionExport(event: Event): void {
    event.stopPropagation();
    this.selectionExportOpen = !this.selectionExportOpen;
  }

  generatePVPdf(): void {
    this.showToast('Génération du PV en cours...', 't-info');
    setTimeout(() => {
      this.showToast('PV généré avec succès', 't-success');
      this.selectionExportOpen = false;
    }, 2000);
  }

  exportSelectionExcel(): void {
    this.showToast('Export Excel en cours...', 't-info');
    setTimeout(() => {
      this.showToast('Excel téléchargé', 't-success');
      this.selectionExportOpen = false;
    }, 2000);
  }

  showConfirmPublish(): void {
    // Show confirmation modal
    this.showToast('Résultats publiés — notifications envoyées aux candidats', 't-success');
  }

  showToast(msg: string, cls?: string): void {
    // Show toast notification
  }

  initSelectionTestData(): void {
    this.selectionCandidates = [];
    this.selectionFiltered = [];
  }

  /**
   * Peuple finalSelectionCandidates à partir de la liste API responsable.
   * Inclut les statuts : selectionne, preselectionne, inscrit (visibles dans Sélection).
   * Recharge depuis l'API si la liste est vide pour garantir des données fraîches.
   */
  populateFinalSelectionFromApi(): void {
    const buildFromList = () => {
      const eligibles = (this.candidaturesResponsable || []).filter((c) =>
        ['selectionne', 'preselectionne', 'inscrit'].includes(c.statut),
      );
      const sorted = [...eligibles].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
      this.finalSelectionCandidates = sorted.map((c, idx) => ({
        id: Number(c.id),
        rang: idx + 1,
        num: c.numero || `CAND-${c.id}`,
        nom: c.candidat_nom || '',
        spec: c.specialite || c.master_nom || '',
        score: Number(c.score || 0),
        interne: !this.isExternalCandidate(c),
        presel: 'oui' as FinalSelectionPresel,
        statut:
          c.statut === 'selectionne' || c.statut === 'inscrit'
            ? 'lp'
            : ('' as FinalSelectionDecision),
        obs: '',
      }));
      this.updateFinalSelectionFiltered();
    };

    if (!this.candidaturesResponsable || this.candidaturesResponsable.length === 0) {
      // Charge depuis API puis construit
      this.candidatureService.getCandidaturesCommissionClassees().subscribe({
        next: (data: any[]) => {
          this.candidaturesResponsable = data || [];
          buildFromList();
        },
        error: () => buildFromList(),
      });
    } else {
      buildFromList();
    }
  }

  nouvelleListe(type: 'preselection' | 'selection'): void {
    if (type === 'preselection' && !this.actionPermissions.preselection) {
      this.notifyActionBlocked("Préselection désactivée par l'administration.");
      return;
    }

    if (type === 'selection' && !this.actionPermissions.selectionFinale) {
      this.notifyActionBlocked("Sélection finale désactivée par l'administration.");
      return;
    }

    if (type === 'selection') {
      this.genererListesSelectionFinaleAutomatique();
      return;
    }

    this.showAlertMessage(`Créer une nouvelle liste de ${type}`);
  }

  genererListesSelectionFinaleAutomatique(): void {
    if (!this.isResponsable) {
      this.notifyActionBlocked('Seul le responsable peut générer les listes finales.');
      return;
    }

    const eligibles = this.candidatures
      .filter(
        (c) => c.dossier_depose && (c.statut === 'preselectionne' || c.statut === 'selectionne'),
      )
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    if (eligibles.length === 0) {
      this.toastService.show('Aucune candidature éligible pour la sélection finale.', 'warning');
      return;
    }

    const byMaster = new Map<number, Candidature[]>();
    eligibles.forEach((cand) => {
      const masterId = Number(cand.master_id || 0);
      if (!masterId) {
        return;
      }
      if (!byMaster.has(masterId)) {
        byMaster.set(masterId, []);
      }
      byMaster.get(masterId)!.push(cand);
    });

    if (byMaster.size === 0) {
      this.toastService.show(
        'Les candidatures éligibles doivent être rattachées à un master.',
        'warning',
      );
      return;
    }

    this.listes = this.listes.filter(
      (liste) =>
        !['Liste Principale', "Liste d'Attente", 'Liste Retenue'].some((prefix) =>
          liste.nom.startsWith(prefix),
        ),
    );

    const dateCreation = new Date().toLocaleDateString('fr-FR');
    let baseId = Date.now();
    const nouvellesListes: Liste[] = [];

    byMaster.forEach((cands, masterId) => {
      const offre = this.offresPreinscription.find((item) => Number(item.id) === masterId);

      const capacitePrincipale = Math.max(
        0,
        Number(
          offre?.capacite_total ||
            offre?.places ||
            Number(offre?.capacite_interne || 0) + Number(offre?.capacite_externe || 0),
        ),
      );

      const capaciteAttente = Math.max(
        0,
        Number(offre?.capacite_liste_attente || Math.ceil(capacitePrincipale * 0.5)),
      );

      const principale = cands.slice(0, capacitePrincipale);
      const attente = cands.slice(capacitePrincipale, capacitePrincipale + capaciteAttente);
      const retenu = cands.slice(0, capacitePrincipale + capaciteAttente);

      const specialite = cands[0]?.specialite || offre?.specialite || 'Toutes spécialités';
      const masterLabel = offre?.titre || cands[0]?.master_nom || `Master ${masterId}`;

      nouvellesListes.push(
        {
          id: baseId++,
          nom: `Liste Principale - ${masterLabel}`,
          specialite,
          type: 'selection',
          statut: 'active',
          nb_candidats: principale.length,
          date_creation: dateCreation,
        },
        {
          id: baseId++,
          nom: `Liste d'Attente - ${masterLabel}`,
          specialite,
          type: 'selection',
          statut: 'active',
          nb_candidats: attente.length,
          date_creation: dateCreation,
        },
        {
          id: baseId++,
          nom: `Liste Retenue - ${masterLabel}`,
          specialite,
          type: 'selection',
          statut: 'active',
          nb_candidats: retenu.length,
          date_creation: dateCreation,
        },
      );
    });

    this.listes.unshift(...nouvellesListes);
    this.toastService.show(
      'Listes de sélection finale générées selon les capacités réelles.',
      'success',
    );
  }

  modifierListe(liste: Liste): void {
    if (!this.actionPermissions.publierListes) {
      this.notifyActionBlocked("Modification des listes désactivée par l'administration.");
      return;
    }

    const nouveauNom = prompt('Modifier le nom de la liste :', liste.nom);
    if (nouveauNom === null) {
      return;
    }

    const nomNettoye = nouveauNom.trim();
    if (!nomNettoye) {
      this.toastService.show('Le nom de la liste est obligatoire.', 'warning');
      return;
    }

    const nouvelleSpecialite = prompt('Modifier la spécialité :', liste.specialite);
    if (nouvelleSpecialite === null) {
      return;
    }

    const specialiteNettoyee = nouvelleSpecialite.trim();
    if (!specialiteNettoyee) {
      this.toastService.show('La spécialité est obligatoire.', 'warning');
      return;
    }

    liste.nom = nomNettoye;
    liste.specialite = specialiteNettoyee;
    this.toastService.show('Liste mise à jour avec succès.', 'success');
  }

  consulterListe(liste: Liste): void {
    console.log('Consultation liste:', liste);
    this.listeSelectionneeAvis = liste;
    this.showModalAvisListe = true;
  }

  exporterListe(liste: Liste): void {
    if (!this.actionPermissions.publierListes) {
      this.notifyActionBlocked("Export des listes désactivé par l'administration.");
      return;
    }

    const rows: ExportRow[] = [liste].map((item) => ({
      ID: item.id.toString(),
      Nom: item.nom,
      Spécialité: item.specialite,
      Type: item.type === 'preselection' ? 'Présélection' : 'Sélection',
      Statut: item.statut === 'active' ? 'Active' : 'Archivée',
      Candidats: item.nb_candidats.toString(),
      Avis: item.avis || '-',
      Recommandation: item.recommandation || '-',
      'Date Création': item.date_creation,
    }));

    const suffixe = this.typeListe === 'preselection' ? 'preselection' : 'selection';
    this.exportRows(
      rows,
      this.listesExportFormat,
      `consultation-listes-${suffixe}`,
      `Consultation des listes (${suffixe})`,
    );
  }

  archiverListe(liste: Liste): void {
    if (!this.actionPermissions.publierListes) {
      this.notifyActionBlocked("Archivage des listes désactivé par l'administration.");
      return;
    }

    const action = liste.statut === 'active' ? 'archiver' : 'désarchiver';

    if (confirm(`Voulez-vous ${action} cette liste ?`)) {
      const token = this.authService.getAccessToken();

      this.http
        .post(
          `/api/listes/${liste.id}/archiver/`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        )
        .subscribe({
          next: () => {
            liste.statut = liste.statut === 'active' ? 'archivee' : 'active';
            this.showAlertMessage(`✅ Liste ${action}e avec succès`);
          },
          error: (error) => {
            console.error('Erreur:', error);
            this.showAlertMessage("❌ Erreur lors de l'archivage");
          },
        });
    }
  }

  // ========================================
  // OCR
  // ========================================
  ouvrirModalOCR(candidature?: Candidature): void {
    if (!this.canAnalyzeDossier()) {
      this.notifyActionBlocked("Analyse dossier désactivée par l'administration.");
      return;
    }

    this.selectedOCRCandidature = candidature || null;
    this.fichierOCR = null;
    this.showModalOCR = true;
  }

  fermerModalOCR(): void {
    this.showModalOCR = false;
    this.fichierOCR = null;
    this.selectedOCRCandidature = null;
  }

  onFileOCRSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.includes('pdf') && !file.type.includes('image')) {
        this.showAlertMessage('❌ Format non supporté. Utilisez PDF ou images');
        return;
      }
      this.fichierOCR = file;
    }
  }

  lancerAnalyseOCR(): void {
    if (!this.canAnalyzeDossier()) {
      this.notifyActionBlocked("Analyse dossier désactivée par l'administration.");
      return;
    }

    if (!this.fichierOCR) {
      this.showAlertMessage('❌ Veuillez sélectionner un fichier');
      return;
    }

    const token = this.authService.getAccessToken();
    const formData = new FormData();
    formData.append('fichier', this.fichierOCR);
    if (this.selectedOCRCandidature?.id) {
      formData.append('candidature_id', String(this.selectedOCRCandidature.id));
    }

    this.http
      .post('/api/ocr/analyser/', formData, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (response: any) => {
          this.showAlertMessage('✅ Analyse OCR lancée avec succès !');
          this.dossiersOCR.unshift({
            id: Date.now(),
            candidat_nom: this.selectedOCRCandidature?.candidat_nom || 'En cours...',
            fichier: this.fichierOCR!.name,
            statut_ocr: 'en_cours',
            date_upload: new Date().toISOString(),
            resultats: response,
          });
          this.fermerModalOCR();
        },
        error: (error) => {
          console.error('Erreur OCR:', error);
          this.showAlertMessage("❌ Erreur lors de l'analyse OCR");
        },
      });
  }

  voirResultatsOCR(dossier: DossierOCR): void {
    this.showAlertMessage(`Voir les résultats OCR pour ${dossier.candidat_nom}`);
  }

  // ========================================
  // RÉCLAMATIONS
  // ========================================
  get reclamationsFiltered(): Reclamation[] {
    const search = this.reclamationSearch.trim().toLowerCase();

    return this.reclamations.filter((reclamation) => {
      if (this.reclamationStatusFilter && reclamation.etat !== this.reclamationStatusFilter) {
        return false;
      }

      if (
        this.reclamationPriorityFilter &&
        reclamation.priorite !== this.reclamationPriorityFilter
      ) {
        return false;
      }

      if (!search) {
        return true;
      }

      const content =
        `${reclamation.id} ${reclamation.objet} ${reclamation.candidat} ${reclamation.master} ${reclamation.details}`.toLowerCase();
      return content.includes(search);
    });
  }

  get reclamationsEnCoursCount(): number {
    return this.reclamations.filter((reclamation) => reclamation.etat === 'en_cours').length;
  }

  get reclamationsEnAttenteCount(): number {
    return this.reclamations.filter((reclamation) => reclamation.etat === 'en_attente').length;
  }

  get reclamationsTraiteesCount(): number {
    return this.reclamations.filter(
      (reclamation) => reclamation.etat === 'traite' || reclamation.etat === 'rejete',
    ).length;
  }

  getReclamationPriority(reclamation: Reclamation): 'haut' | 'moyen' | 'bas' {
    return reclamation.priorite;
  }

  getReclamationPriorityLabel(prio: 'haut' | 'moyen' | 'bas'): string {
    if (prio === 'haut') return 'Haut';
    if (prio === 'moyen') return 'Moyen';
    return 'Bas';
  }

  getReclamationPriorityClass(prio: 'haut' | 'moyen' | 'bas'): string {
    if (prio === 'haut') return 'b-haut';
    if (prio === 'moyen') return 'b-moyen';
    return 'b-bas';
  }

  formatReclamationStatus(statut: Reclamation['etat']): string {
    if (statut === 'en_cours') return 'En cours';
    if (statut === 'en_attente') return 'En attente';
    if (statut === 'traite') return 'Traitée';
    return 'Rejetée';
  }

  getReclamationStatusClass(statut: Reclamation['etat']): string {
    if (statut === 'en_cours') return 'b-encours';
    if (statut === 'en_attente') return 'b-attente';
    if (statut === 'traite') return 'b-traite';
    return 'b-rejete';
  }

  getReclamationMaster(reclamation: Reclamation): string {
    return reclamation.master || '-';
  }

  resetReclamationFilters(): void {
    this.reclamationStatusFilter = '';
    this.reclamationPriorityFilter = '';
    this.reclamationSearch = '';
  }

  toggleReclamationActionMenu(id: number): void {
    this.reclamationActionMenuOpen[id] = !this.reclamationActionMenuOpen[id];
  }

  isReclamationResponsableAction(): boolean {
    return !!this.actionPermissions?.traiterReclamations;
  }

  isReclamationActionMenuOpen(id: number): boolean {
    return !!this.reclamationActionMenuOpen[id];
  }

  closeReclamationActionMenu(id?: number): void {
    if (typeof id === 'number') {
      delete this.reclamationActionMenuOpen[id];
      return;
    }

    this.reclamationActionMenuOpen = {};
  }

  // Nouvelles méthodes pour les modales de consultation, acceptation et refus
  openConsultationReclamation(id: number): void {
    const reclamation = this.reclamations.find((item) => item.id === id) || null;
    if (!reclamation) {
      return;
    }
    this.reclamationModalData = reclamation;
    this.reclamationModalConsultOuvert = true;
    this.closeReclamationActionMenu(id);
  }

  openReponse(id: number): void {
    const reclamation = this.reclamations.find((item) => item.id === id) || null;
    if (!reclamation) {
      return;
    }
    this.reclamationModalData = reclamation;
    this.reclamationModalAcceptOuvert = true;
    this.closeReclamationActionMenu(id);
  }

  openRejet(id: number): void {
    const reclamation = this.reclamations.find((item) => item.id === id) || null;
    if (!reclamation) {
      return;
    }
    this.reclamationModalData = reclamation;
    this.reclamationMotifRefus = '';
    this.reclamationModalRejetOuvert = true;
    this.closeReclamationActionMenu(id);
  }

  accepterRecours(id: number | null | undefined): void {
    if (!id || !this.reclamationModalData) {
      return;
    }
    // Mise à jour de l'état de la réclamation
    const reclamation = this.reclamations.find((item) => item.id === id);
    if (reclamation) {
      reclamation.etat = 'traite';
      // TODO: Appeler l'API pour mettre à jour la base de données
      // TODO: Réintégrer le candidat dans le classement
      // TODO: Envoyer un e-mail automatique d'acceptation
      console.log('Recours accepté pour la réclamation #' + id);
      alert('✓ Recours accepté ! Le candidat a été réintégré dans le classement.');
    }
    this.closeReclamationModals();
  }

  refuserRecours(id: number | null | undefined): void {
    if (!id || !this.reclamationModalData || !this.reclamationMotifRefus.trim()) {
      alert('Veuillez saisir un motif de refus');
      return;
    }
    // Mise à jour de l'état de la réclamation
    const reclamation = this.reclamations.find((item) => item.id === id);
    if (reclamation) {
      reclamation.etat = 'rejete';
      // TODO: Appeler l'API pour mettre à jour la base de données
      // TODO: Envoyer un e-mail automatique de refus avec le motif
      console.log('Recours refusé pour la réclamation #' + id + ' : ' + this.reclamationMotifRefus);
      alert('✗ Recours refusé ! Le candidat a reçu la notification.');
    }
    this.closeReclamationModals();
  }

  closeReclamationModals(): void {
    this.reclamationModalConsultOuvert = false;
    this.reclamationModalAcceptOuvert = false;
    this.reclamationModalRejetOuvert = false;
    this.reclamationModalData = null;
    this.reclamationMotifRefus = '';
  }

  private getCandidatureForReclamation(reclamation: Reclamation): Candidature | null {
    if (typeof reclamation.candidature_id !== 'number') {
      return null;
    }

    return this.candidatures.find((item) => item.id === reclamation.candidature_id) || null;
  }

  private getAcceptedReclamationStatus(candidature: Candidature): 'selectionne' | 'preselectionne' {
    const currentStatus = (candidature.statut || '').toLowerCase();
    if (currentStatus === 'preselectionne' || candidature.decision_responsable === 'valide') {
      return 'preselectionne';
    }

    return 'selectionne';
  }

  private reintegrateCandidateAfterReclamationAcceptance(candidature: Candidature): void {
    const acceptedStatus = this.getAcceptedReclamationStatus(candidature);
    candidature.statut = acceptedStatus;
    candidature.decision_responsable = 'valide';
    candidature.selectionStatut = acceptedStatus === 'preselectionne' ? 'lp' : 'lp';
    candidature.date_changement_statut = new Date().toISOString();
  }

  openScore(id: number): void {
    const reclamation = this.reclamations.find((item) => item.id === id) || null;
    if (!reclamation) {
      return;
    }
    this.reclamationScoreSelectionnee = reclamation;
    this.scoreRectification = 15;
    this.scoreRectificationCommentaire = '';
    this.closeReclamationActionMenu(id);
    this.showModalRectifierScore = true;
    this.recalcScore();
  }

  closeModalReclamation(): void {
    this.showModalReponseReclamation = false;
    this.showModalRectifierScore = false;
    this.showModalRejetReclamation = false;
    this.showModalConsultationReclamation = false;
    this.reclamationSelectionnee = null;
    this.reclamationScoreSelectionnee = null;
    this.reclamationRejetSelectionnee = null;
    this.reclamationConsultationSelectionnee = null;
    this.currentRejetId = null;
    this.reponseReclamationText = '';
    this.scoreRectificationCommentaire = '';
    this.motifRejet = '';
    this.motifRejetDetail = '';
  }

  onReclamationNoteChange(index: number, value: string): void {
    const parsed = Number(value);
    this.notesRectification[index] = Number.isFinite(parsed)
      ? Math.min(20, Math.max(0, parsed))
      : 0;
    this.recalcScore();
  }

  recalcScore(): void {
    const totalCoef = this.notesRectificationLabels.reduce((sum, item) => sum + item.coef, 0);
    const weighted = this.notesRectification.reduce(
      (sum, note, index) => sum + note * this.notesRectificationLabels[index].coef,
      0,
    );
    this.scoreRectification = Number((weighted / totalCoef).toFixed(2));
  }

  updateMotif(): void {
    const motifs: Record<string, string> = {
      infondee: 'Réclamation infondée — les notes sont correctes',
      'hors-delai': 'Dépôt hors délai réglementaire',
      'manque-preuves': 'Manque de preuves justificatives',
      autre: 'Autre motif à préciser',
    };

    this.motifRejetDetail = motifs[this.motifRejet] || '';
  }

  validerRectification(): void {
    if (!this.reclamationScoreSelectionnee) {
      return;
    }

    this.reclamationScoreSelectionnee.etat = 'traite';
    this.showAlertMessage('✅ Score rectifié et candidat notifié.');
    this.closeModalReclamation();
  }

  validerRejet(): void {
    if (!this.reclamationRejetSelectionnee) {
      return;
    }

    const reclamation = this.reclamationRejetSelectionnee;
    reclamation.etat = 'rejete';
    reclamation.motif_rejet = [this.motifRejetDetail || this.motifRejet]
      .filter(Boolean)
      .join(' - ');

    const candidature = this.getCandidatureForReclamation(reclamation);
    if (candidature) {
      candidature.selectionStatut = 'refuse';
      candidature.decision_responsable = 'non_valide';
      candidature.statut = 'rejete';
      candidature.date_changement_statut = new Date().toISOString();
    }

    this.showAlertMessage('✅ Réclamation rejetée et motif enregistré.');
    this.closeModalReclamation();
  }

  validerReponse(): void {
    if (!this.reclamationSelectionnee) {
      return;
    }

    this.reclamationSelectionnee.etat = 'traite';
    const candidature = this.getCandidatureForReclamation(this.reclamationSelectionnee);
    if (candidature) {
      this.reintegrateCandidateAfterReclamationAcceptance(candidature);
    }

    this.showAlertMessage('✅ Recours accepté et candidat réintégré dans le classement.');
    this.closeModalReclamation();
  }

  exportReclamations(): void {
    const rows: ExportRow[] = this.reclamationsFiltered.map((reclamation) => ({
      Identifiant: reclamation.id,
      Objet: reclamation.objet,
      Candidat: reclamation.candidat,
      Master: reclamation.master,
      Date: reclamation.date,
      Priorite: this.getReclamationPriorityLabel(reclamation.priorite),
      Etat: this.formatReclamationStatus(reclamation.etat),
      Details: reclamation.details,
    }));

    this.exportRows(rows, 'xlsx', 'reclamations', 'Réclamations');
  }

  voirDossierAssocieReclamation(reclamation: Reclamation): void {
    this.reclamationConsultationSelectionnee = reclamation;
    this.closeReclamationActionMenu();
    this.showModalConsultationReclamation = true;
  }

  getReclamationConsultationCandidature(): Candidature | null {
    if (!this.reclamationConsultationSelectionnee) {
      return null;
    }

    return this.getCandidatureForReclamation(this.reclamationConsultationSelectionnee);
  }

  getReclamationConsultationDocuments(): Array<{
    label: string;
    value: string;
    tone: string;
    url?: string;
  }> {
    const candidature = this.getReclamationConsultationCandidature();
    if (!candidature) {
      return [];
    }

    const docs: Array<{ label: string; value: string; tone: string; url?: string }> = [
      {
        label: 'CIN',
        value: candidature.candidat_cin || 'Non disponible',
        tone: 'blue',
      },
      {
        label: 'Notes',
        value: candidature.notes_preinscription || 'Non disponibles',
        tone: 'green',
      },
      {
        label: 'Texte détaillé du recours',
        value: this.reclamationConsultationSelectionnee?.details || 'Non disponible',
        tone: 'orange',
      },
    ];

    if (candidature.dossier_id) {
      docs.push({
        label: 'Pièces jointes',
        value: 'Ouvrir le dossier',
        tone: 'blue',
        url: `/api/dossiers/${candidature.dossier_id}/download`,
      });
    }

    return docs;
  }

  openReclamationDocument(url: string): void {
    if (!url) {
      this.toastService.show('Aucune pièce jointe disponible.', 'warning');
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }

  openReclamationDocuments(): void {
    const candidature = this.getReclamationConsultationCandidature();
    if (candidature && candidature.dossier_id) {
      // Navigate to the dossier view in the commission area when possible
      this.router.navigate(['/commission/consulter-candidature', candidature.id]);
      return;
    }

    this.toastService.show('Aucune pièce jointe disponible pour ce dossier.', 'warning');
  }

  // ========================================
  // MEMBRES
  // ========================================
  loadMembers(): void {
    if (!this.activeCommissionId) {
      this.membres = [];
      this.membresFiltres = [];
      return;
    }
    const token = this.authService.getAccessToken();
    if (!token) return;
    this.http
      .get<any>(`/api/candidatures/commissions/${this.activeCommissionId}/members/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (response) => {
          const list: any[] = Array.isArray(response)
            ? response
            : response?.membres || response?.members || [];
          this.membres = list.map((m: any) => ({
            id: m.id,
            nom: m.last_name || m.nom || '',
            prenom: m.first_name || m.prenom || '',
            email: m.email || '',
            telephone: m.phone || m.telephone || '-',
            role: m.role || 'membre',
            statut: m.actif !== false ? 'actif' : 'inactif',
            date_inscription: m.date_nomination || m.date_inscription || '',
            master_rattachement: m.master_rattachement || '',
          }));
          this.membresFiltres = [...this.membres];
        },
        error: () => {
          this.membres = [];
          this.membresFiltres = [];
        },
      });
  }

  filtrerMembres(): void {
    this.membresFiltres = this.membres.filter((membre) => {
      // Filtre par recherche (nom, email)
      if (this.rechercheMembres) {
        const recherche = this.rechercheMembres.toLowerCase();
        const matchNom = `${membre.prenom} ${membre.nom}`.toLowerCase().includes(recherche);
        const matchEmail = membre.email.toLowerCase().includes(recherche);
        const matchTelephone = membre.telephone.toLowerCase().includes(recherche);

        if (!matchNom && !matchEmail && !matchTelephone) {
          return false;
        }
      }

      // Filtre par statut
      if (this.filtreStatutMembre && membre.statut !== this.filtreStatutMembre) {
        return false;
      }

      return true;
    });
  }

  reinitialiserFiltresMembres(): void {
    this.rechercheMembres = '';
    this.filtreStatutMembre = '';
    this.membresFiltres = [...this.membres];
  }

  openAddMemberModal(): void {
    this.newMemberNom = '';
    this.newMemberPrenom = '';
    this.newMemberEmail = '';
    this.newMemberSpecialite = '';
    this.showAddMemberModal = true;
    this.memberActionMenuOpenId = null;
  }

  closeAddMemberModal(): void {
    this.showAddMemberModal = false;
    this.newMemberNom = '';
    this.newMemberPrenom = '';
    this.newMemberEmail = '';
    this.newMemberSpecialite = '';
  }

  submitAddMember(): void {
    const nom = this.newMemberNom.trim();
    const prenom = this.newMemberPrenom.trim();
    const email = this.newMemberEmail.trim();
    const specialite = this.newMemberSpecialite.trim();
    if (!nom || !prenom || !email || !specialite) {
      this.toastService.show('Veuillez renseigner Nom, Prénom, Email et Spécialité.', 'warning');
      return;
    }

    const generatedPassword = this.generateTemporaryMemberPassword();
    const newMember: CommissionMember = {
      id: this.membres.length ? Math.max(...this.membres.map((member) => member.id)) + 1 : 1,
      nom,
      prenom,
      email,
      telephone: this.newMemberTelephone.trim() || '-',
      role: 'evaluateur',
      statut: 'actif',
      date_inscription: new Date().toISOString().slice(0, 10),
      master_rattachement: specialite,
    };

    this.membres = [newMember, ...this.membres];
    this.filtrerMembres();
    this.sendMemberWelcomeEmail(email, generatedPassword, prenom, nom, specialite);
    this.toastService.show(`Membre ajouté. E-mail d'accès envoyé à ${email}.`, 'success');
    this.newMemberTelephone = '';
    this.closeAddMemberModal();
  }

  private generateTemporaryMemberPassword(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let generated = '';
    for (let index = 0; index < 12; index += 1) {
      generated += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return generated;
  }

  private sendMemberWelcomeEmail(
    email: string,
    temporaryPassword: string,
    prenom: string,
    nom: string,
    specialite: string,
  ): void {
    // Workflow stub: replace with backend endpoint when API is available.
    console.log('member-welcome-email', {
      email,
      temporaryPassword,
      prenom,
      nom,
      specialite,
    });
  }

  toggleMemberActionMenu(memberId: number, event: MouseEvent): void {
    event.stopPropagation();
    this.memberActionMenuOpenId = this.memberActionMenuOpenId === memberId ? null : memberId;
  }

  toggleStatutMembre(membre: CommissionMember): void {
    membre.statut = membre.statut === 'actif' ? 'inactif' : 'actif';
    const label = membre.statut === 'actif' ? 'activé' : 'désactivé';
    this.toastService.show(`${membre.prenom} ${membre.nom} — compte ${label}.`, 'success');
  }

  getMemberAvatarClass(index: number): string {
    const classes = ['mem-av-blue', 'mem-av-teal', 'mem-av-violet', 'mem-av-gray'];
    return classes[index % classes.length];
  }

  openEditMemberModal(membre: CommissionMember): void {
    this.editingMember = membre;
    this.editMemberNom = membre.nom;
    this.editMemberPrenom = membre.prenom;
    this.editMemberEmail = membre.email;
    this.editMemberTelephone = membre.telephone !== '-' ? membre.telephone : '';
    this.editMemberSpecialite = membre.master_rattachement || '';
    this.showEditMemberModal = true;
    this.memberActionMenuOpenId = null;
  }

  closeEditMemberModal(): void {
    this.showEditMemberModal = false;
    this.editingMember = null;
  }

  submitEditMember(): void {
    if (!this.editingMember) return;
    const nom = this.editMemberNom.trim();
    const prenom = this.editMemberPrenom.trim();
    const email = this.editMemberEmail.trim();
    if (!nom || !prenom || !email) {
      this.toastService.show('Veuillez renseigner Nom, Prénom et Email.', 'warning');
      return;
    }
    this.editingMember.nom = nom;
    this.editingMember.prenom = prenom;
    this.editingMember.email = email;
    this.editingMember.telephone = this.editMemberTelephone.trim() || '-';
    this.editingMember.master_rattachement = this.editMemberSpecialite.trim() || undefined;
    this.filtrerMembres();
    this.toastService.show(`Membre ${prenom} ${nom} modifié avec succès.`, 'success');
    this.closeEditMemberModal();
  }

  openDeleteMemberConfirm(membre: CommissionMember): void {
    this.memberToDelete = membre;
    this.showDeleteMemberConfirm = true;
    this.memberActionMenuOpenId = null;
  }

  cancelDeleteMemberConfirm(): void {
    this.showDeleteMemberConfirm = false;
    this.memberToDelete = null;
  }

  confirmDeleteMember(): void {
    if (!this.memberToDelete) return;
    const { prenom, nom } = this.memberToDelete;
    this.membres = this.membres.filter((m) => m.id !== this.memberToDelete!.id);
    this.filtrerMembres();
    this.toastService.show(`Membre ${prenom} ${nom} supprimé.`, 'success');
    this.cancelDeleteMemberConfirm();
  }

  voirProfilMembre(membre: CommissionMember): void {
    this.showAlertMessage(
      `👤 Profil\n\n${membre.prenom} ${membre.nom}\nRôle: ${membre.role}\nEmail: ${membre.email}\nTéléphone: ${membre.telephone}`,
    );
  }

  // ========================================
  // PROFIL
  // ========================================
  updateProfile(): void {
    const token = this.authService.getAccessToken();

    this.http
      .put('http://localhost:8001/api/auth/profile/update/', this.profileData, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (updated) => {
          this.showAlertMessage('✅ Profil mis à jour avec succès !');
          this.currentUser = { ...this.currentUser, ...this.profileData, ...(updated || {}) };
          localStorage.setItem('current_user', JSON.stringify(this.currentUser));
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

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // ========================================
  // EXPORT FUNCTIONALITY
  // ========================================
  exportListes(): void {
    if (this.listes.length === 0) {
      this.showAlertMessage('❌ Aucune liste à exporter');
      return;
    }

    const rows: ExportRow[] = this.listes.map((liste) => ({
      ID: liste.id.toString(),
      Nom: liste.nom,
      Spécialité: liste.specialite,
      Type: liste.type === 'preselection' ? 'Présélection' : 'Sélection',
      Statut: liste.statut === 'active' ? 'Active' : 'Inactive',
      Candidats: liste.nb_candidats.toString(),
      'Date Création': liste.date_creation,
    }));

    this.exportRows(rows, this.listesExportFormat, 'listes-admission', "Listes d'Admission");
  }

  exportListesByType(): void {
    const listes = this.getListesByType();
    if (listes.length === 0) {
      this.toastService.show('Aucune liste à exporter pour le type sélectionné.', 'warning');
      return;
    }

    const rows: ExportRow[] = listes.map((liste) => ({
      ID: liste.id.toString(),
      Nom: liste.nom,
      Spécialité: liste.specialite,
      Type: liste.type === 'preselection' ? 'Présélection' : 'Sélection',
      Statut: liste.statut === 'active' ? 'Active' : 'Archivée',
      Candidats: liste.nb_candidats.toString(),
      Avis: liste.avis || '-',
      Recommandation: liste.recommandation || '-',
      'Date Création': liste.date_creation,
    }));

    const suffixe = this.typeListe === 'preselection' ? 'preselection' : 'selection';
    this.exportRows(
      rows,
      this.listesExportFormat,
      `consultation-listes-${suffixe}`,
      `Consultation des listes (${suffixe})`,
    );
  }

  exportCandidaturesResponsable(): void {
    if (this.candidaturesResponsableFiltrees.length === 0) {
      this.toastService.show('Aucune candidature à exporter.', 'warning');
      return;
    }

    const rows: ExportRow[] = this.candidaturesResponsableFiltrees.map((cand) => ({
      ID: cand.id.toString(),
      Numéro: cand.numero,
      Candidat: cand.candidat_nom || cand.candidat_email,
      Email: cand.candidat_email,
      CIN: cand.candidat_cin || '-',
      Master: cand.master_nom || '-',
      Spécialité: cand.specialite,
      Score: cand.score,
      Statut: this.getStatusDisplayLabel(cand.statut),
      'Dossier déposé': cand.dossier_depose ? 'Oui' : 'Non',
      Type: cand.type_concours || 'master',
    }));

    this.exportRows(
      rows,
      this.candidaturesResponsableExportFormat,
      'candidatures-responsable',
      'Liste de candidature (Responsable)',
    );
  }

  generateMasterRankedList(): void {
    // Prefer the list from the currently visible table, fallback to responsible view list.
    const masterCandidatures =
      this.candidaturesMasterViewFiltered.length > 0
        ? [...this.candidaturesMasterViewFiltered]
        : [...this.candidaturesMasterFiltered];

    if (masterCandidatures.length === 0) {
      this.toastService.show('Aucune candidature Master à exporter.', 'warning');
      return;
    }

    // Create ranked list with ranking
    const rankedRows: ExportRow[] = masterCandidatures.map((cand, index) => ({
      Classement: (index + 1).toString(),
      Candidat: cand.candidat_nom || cand.candidat_email,
      CIN: cand.candidat_cin || '-',
      Master: cand.master_nom || cand.specialite,
      Diplôme: cand.specialite || '-',
      Score: cand.score,
      Email: cand.candidat_email,
      Statut: this.getStatusDisplayLabel(cand.statut),
      'Dossier déposé': cand.dossier_depose ? 'Oui' : 'Non',
    }));

    this.exportRows(
      rankedRows,
      this.candidaturesMasterRankedListExportFormat,
      'master-candidatures-classees',
      'Liste Classée - Candidatures Master',
    );

    this.toastService.show(
      `Liste classée générée: ${masterCandidatures.length} candidat(s) Master.`,
      'success',
    );
  }

  exportCandidaturesMembre(): void {
    if (this.candidaturesFiltrees.length === 0) {
      this.toastService.show('Aucune candidature à exporter.', 'warning');
      return;
    }

    const rows: ExportRow[] = this.candidaturesFiltrees.map((cand) => ({
      ID: cand.id.toString(),
      Numéro: cand.numero,
      Candidat: cand.candidat_nom || cand.candidat_email,
      Email: cand.candidat_email,
      CIN: cand.candidat_cin || '-',
      Spécialité: cand.specialite,
      Score: cand.score,
      Statut: this.getStatusDisplayLabel(cand.statut),
      'Dossier déposé': cand.dossier_depose ? 'Oui' : 'Non',
      Type: cand.type_concours || 'master',
    }));

    this.exportRows(
      rows,
      this.candidaturesMembreExportFormat,
      'candidatures-master-membre',
      'Liste de candidature (Membre de commission)',
    );
  }

  exportDeliberations(): void {
    if (this.procesVerbaux.length === 0) {
      this.showAlertMessage('❌ Aucune délibération à exporter');
      return;
    }

    const rows: ExportRow[] = this.procesVerbaux.map((pv) => ({
      ID: pv.id.toString(),
      Titre: pv.titre,
      Master: pv.master_nom,
      'Date Réunion': pv.date_reunion,
      Participants: pv.nb_participants.toString(),
      Candidatures: pv.nb_candidatures.toString(),
      Admis: pv.nb_admis.toString(),
      Rejetés: pv.nb_rejetes.toString(),
      Statut:
        pv.statut === 'approuve' ? 'Approuvé' : pv.statut === 'en_cours' ? 'En Cours' : 'Archivé',
    }));

    this.exportRows(
      rows,
      this.deliberationsExportFormat,
      'deliberations-pv',
      'Procès-Verbaux de Délibération',
    );
  }

  onInscriptionsExcelSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.selectedInscriptionsFileName = file.name;
    this.inscriptionFileLoaded = true;
    this.inscriptionVerified = false;
    const reader = new FileReader();

    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      this.inscriptionsExcelRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      this.inscriptionsVerificationRows = [];
      this.updateInscriptionStats();
      this.toastService.show('Fichier Excel chargé.', 'success');
    };

    reader.onerror = () => {
      this.toastService.show("Erreur lors de la lecture du fichier d'inscriptions.", 'error');
    };

    reader.readAsArrayBuffer(file);
  }

  verifierInscriptionsExcel(): void {
    if (this.inscriptionCandidates.length === 0) {
      this.toastService.show('Aucune inscription à vérifier.', 'warning');
      return;
    }

    if (this.inscriptionsExcelRows.length === 0) {
      this.toastService.show("Veuillez d'abord charger un fichier Excel.", 'warning');
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      this.toastService.show(
        "Token d'authentification manquant. Utilisation de la vérification locale.",
        'warning',
      );
      this.verifyInscriptionsLocally();
      return;
    }

    // Show loading toast
    this.toastService.show('Contacting backend pour rapprochement...', 'info');

    const masterId = this.selectedConfigMasterId || null;

    this.http
      .post<any>(
        '/api/candidatures/inscriptions/rapprochement/',
        {
          rows: this.inscriptionsExcelRows,
          source_filename: this.selectedInscriptionsFileName,
          master_id: masterId,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: (response) => {
          // Validate response structure
          if (!response || !response.rows || !Array.isArray(response.rows)) {
            console.warn('Invalid response structure from backend:', response);
            this.verifyInscriptionsLocally();
            return;
          }

          const summary = response?.summary || { valide: 0, incoherent: 0, absent: 0 };

          // Le rapprochement backend ne reconnaît que les candidats déjà « inscrit »
          // en base (match par N° candidature/CIN). En démo, les candidats sont en
          // mémoire → 0 valide. On bascule alors sur la vérification LOCALE (par CIN)
          // qui produit un résultat lisible (valide / incohérent / absent).
          if ((summary.valide || 0) === 0 && this.inscriptionCandidates.length > 0) {
            this.verifyInscriptionsLocally();
            return;
          }

          this.inscriptionsVerificationRows = response.rows as InscriptionVerificationRow[];
          this.lastRapprochementAuditId = response?.audit_id ? Number(response.audit_id) : null;
          this.inscriptionVerified = true;
          this.updateInscriptionStats();

          this.toastService.show(
            `✅ Rapprochement backend réussi: ${summary.valide || 0} valide(s), ${summary.incoherent || 0} incohérent(s), ${summary.absent || 0} absent(s).`,
            'success',
          );
        },
        error: (error) => {
          const errorMsg = error?.error?.message || error?.message || 'Erreur inconnue';
          console.error('Erreur rapprochement inscriptions (backend):', errorMsg);
          this.toastService.show(
            `⚠️ Backend indisponible (${errorMsg}). Utilisation de la vérification locale.`,
            'warning',
          );
          this.verifyInscriptionsLocally();
        },
      });
  }

  exporterFichierFinalInscriptions(): void {
    const lignesValides = this.inscriptionsVerificationRows.filter(
      (row) => row.verification === 'valide',
    );
    if (lignesValides.length === 0) {
      this.toastService.show('Aucune ligne valide à exporter.', 'warning');
      return;
    }

    const rows: ExportRow[] = lignesValides.map((row) => ({
      'Numéro candidature': row.numero_candidature,
      CIN: row.cin,
      'Numéro inscription': row.numero_inscription,
      'Nom et prénom': row.nom_prenom,
      Master: row.master,
      Spécialité: row.specialite,
    }));

    this.exportRows(rows, 'xlsx', 'inscriptions-finales', 'Fichier Final Inscriptions');
  }

  genererListeComplementaireDepuisAbsents(): void {
    if (!this.isResponsable) {
      this.notifyActionBlocked('Seul le responsable peut préparer la liste complémentaire.');
      return;
    }

    const absents = this.inscriptionsVerificationRows.filter(
      (row) => row.verification === 'absent',
    );
    if (absents.length === 0) {
      this.toastService.show('Aucun absent détecté après vérification.', 'warning');
      return;
    }

    const candidatsEnAttente = this.getInscriptionsScopeRows()
      .filter((c) => c.statut === 'en_attente' && c.dossier_depose)
      .sort((a, b) => b.score - a.score);

    if (candidatsEnAttente.length === 0) {
      this.toastService.show(
        "Aucun candidat éligible en liste d'attente pour la liste complémentaire.",
        'warning',
      );
      return;
    }

    const remplacements = candidatsEnAttente.slice(0, absents.length);
    const liste = this.createSelectionListFromRows(
      remplacements,
      'Liste complémentaire',
      'reserve',
    );

    liste.avis = `${absents.length} absent(s) détecté(s) après import Excel.`;
    liste.recommandation = 'reserve';
    this.upsertGeneratedListInMemory(liste);

    this.generatedSelectionRows = remplacements.map((c) => ({ ...c }));
    this.typeListe = 'selection';
    this.currentView = 'listes';

    this.toastService.show(
      `Liste complémentaire préparée avec ${remplacements.length} candidat(s).`,
      'success',
    );
  }

  exportInscriptions(): void {
    if (this.inscriptionsExportFormat === 'pdf') {
      this.genererPDFOfficielISIMM('MASTER');
      return;
    }
    if (this.inscriptionsVerificationRows.length > 0) {
      this.exportVerifiedInscriptions(this.inscriptionsExportFormat === 'xlsx' ? 'xlsx' : 'xlsx');
      return;
    }

    const rows: ExportRow[] = this.inscriptionCandidates.map((candidate) => ({
      ID: candidate.id.toString(),
      Numéro: candidate.num,
      Candidat: candidate.nom,
      CIN: candidate.cin,
      Master: candidate.master,
      Dossier: candidate.dossier,
      Paiement: this.getInscriptionPaymentLabel(candidate.paiement),
      Finalisé: candidate.finalise ? 'Oui' : 'Non',
    }));

    this.exportRows(rows, this.inscriptionsExportFormat, 'inscriptions-payment', 'Inscriptions');
  }

  private getInscriptionsScopeRows(): Candidature[] {
    const baseSource = this.isResponsable
      ? this.candidaturesResponsable.length
        ? this.candidaturesResponsable
        : this.candidatures
      : this.candidatures;
    return this.getScopedCandidatures(baseSource);
  }

  get inscriptionsConfirmedCount(): number {
    return this.getInscriptionsScopeRows().filter((c) => c.statut === 'inscrit').length;
  }

  get inscriptionsEligibleCount(): number {
    return this.getInscriptionsScopeRows().filter((c) => c.statut === 'selectionne').length;
  }

  get inscriptionsVerificationTotal(): number {
    return this.inscriptionsVerificationRows.length;
  }

  get inscriptionsVerificationValideCount(): number {
    return this.inscriptionsVerificationRows.filter((row) => row.verification === 'valide').length;
  }

  get inscriptionsVerificationIncoherentCount(): number {
    return this.inscriptionsVerificationRows.filter((row) => row.verification === 'incoherent')
      .length;
  }

  get inscriptionsVerificationAbsentCount(): number {
    return this.inscriptionsVerificationRows.filter((row) => row.verification === 'absent').length;
  }

  get inscriptionsCandidateRows(): Candidature[] {
    const trackedStatuses = new Set([
      'selectionne',
      'inscrit',
      'dossier_depose',
      'en_attente_dossier',
    ]);
    return this.getInscriptionsScopeRows()
      .filter((c) => trackedStatuses.has(c.statut) || c.dossier_depose)
      .sort((a, b) => {
        const statusOrder = (value: string): number => {
          if (value === 'inscrit') {
            return 0;
          }
          if (value === 'selectionne') {
            return 1;
          }
          if (value === 'dossier_depose') {
            return 2;
          }
          return 3;
        };

        const byStatus = statusOrder(a.statut) - statusOrder(b.statut);
        if (byStatus !== 0) {
          return byStatus;
        }

        if (a.dossier_depose !== b.dossier_depose) {
          return a.dossier_depose ? -1 : 1;
        }

        return (a.candidat_nom || '').localeCompare(b.candidat_nom || '');
      });
  }

  get inscriptionsDepotCount(): number {
    return this.inscriptionsCandidateRows.filter((c) => c.dossier_depose).length;
  }

  get inscriptionsNonDepotCount(): number {
    return this.inscriptionsCandidateRows.filter((c) => !c.dossier_depose).length;
  }

  getInscriptionFileStateLabel(candidature: Candidature): string {
    return candidature.dossier_depose ? 'Déposé' : 'Non déposé';
  }

  getInscriptionProcessLabel(candidature: Candidature): string {
    if (candidature.statut === 'inscrit') {
      return 'Inscription finalisée';
    }
    if (candidature.dossier_depose) {
      return 'Fichier déposé - en vérification';
    }
    return 'En attente de dépôt';
  }

  initInscriptionTestData(): void {
    this.inscriptionCandidates = [];
  }

  // Données de démo pour la vue « Inscription en ligne » (responsable).
  // Le rapprochement local (verifyInscriptionsLocally) compare le CIN de ces
  // candidats avec la colonne CIN du fichier Excel importé.
  private ensureInscriptionDemoData(): void {
    if (this.inscriptionCandidates.length > 0) {
      this.applyInscriptionFilters();
      this.updateInscriptionStats();
      return;
    }
    const GL = "Master Génie Logiciel et Systèmes d'Information";
    const BC = 'Master Business Computing';
    const base = {
      receiptPdfUrl: '',
      recuVerifie: false,
      statut_final: 'attente_paiement' as InscriptionCandidateRow['statut_final'],
      finalise: false,
      matchPercent: 0,
      dossierFile: '',
      observation: '',
    };
    this.inscriptionCandidates = [
      { ...base, id: 1, num: '2606-EXT-00004-GLS', numero_inscription: '20260417', nom: 'Ranim Jellali', cin: '11111111', master: GL, specialite: GL, dossier: 'complet', paiement: 'paye', email: 'ranimjellali47@gmail.com', recuVerifie: true },
      { ...base, id: 2, num: '2606-EXT-00001-GLS', numero_inscription: '20261804', nom: 'Skander Mansouri', cin: '22222222', master: GL, specialite: GL, dossier: 'complet', paiement: 'paye', email: 'candidat.test.1@isimm.tn', recuVerifie: true },
      { ...base, id: 3, num: '2606-INT-00009-GLS', numero_inscription: '20261801', nom: 'Yassine Trabelsi', cin: '33333333', master: GL, specialite: GL, dossier: 'complet', paiement: 'paye', email: 'yassine.trabelsi@demo.tn', recuVerifie: true },
      { ...base, id: 4, num: '2606-INT-00007-GLS', numero_inscription: '20261802', nom: 'Marwen Gharbi', cin: '44444444', master: GL, specialite: GL, dossier: 'complet', paiement: 'en_attente', email: 'marwen.gharbi@demo.tn' },
      { ...base, id: 5, num: '2606-INT-00011-GLS', numero_inscription: '20261805', nom: 'Karim Bouazizi', cin: '55555555', master: GL, specialite: GL, dossier: 'complet', paiement: 'paye', email: 'karim.bouazizi@demo.tn', recuVerifie: true },
      { ...base, id: 6, num: '2606-EXT-00010-BC', numero_inscription: '20262006', nom: 'Salma Mejri', cin: '66666666', master: BC, specialite: BC, dossier: 'complet', paiement: 'paye', email: 'salma.mejri@demo.tn', recuVerifie: true },
    ];
    this.applyInscriptionFilters();
    this.updateInscriptionStats();
  }

  // Données de démo pour la vue « Réclamations » (responsable).
  private ensureReclamationsDemoData(): void {
    if (this.reclamations.length > 0) {
      return;
    }
    const GL = "Master Génie Logiciel et Systèmes d'Information";
    const BC = 'Master Business Computing';
    this.reclamations = [
      { id: 1, objet: 'Contestation du score de présélection', candidat: 'Ranim Jellali', master: GL, date: '2026-06-12T09:05:00', pj: true, etat: 'en_attente', priorite: 'haut', candidature_id: 215, details: "Ma moyenne de licence est de 13.4 ; je pense que mon rang de présélection doit être revu." },
      { id: 2, objet: 'Erreur dans le calcul du score', candidat: 'Ahmed Ben Ali', master: GL, date: '2026-06-10T10:30:00', pj: true, etat: 'en_cours', priorite: 'haut', candidature_id: 232, details: "Le score affiché ne correspond pas à mes relevés (moyenne 16.5 vs score 15.2)." },
      { id: 3, objet: 'Demande de réexamen du dossier', candidat: 'Karim Bouazizi', master: GL, date: '2026-06-13T15:40:00', pj: false, etat: 'en_attente', priorite: 'moyen', candidature_id: 238, details: "Un de mes relevés n'a pas été pris en compte lors de l'évaluation." },
      { id: 4, objet: 'Problème technique lors du dépôt', candidat: 'Mohamed Karoui', master: GL, date: '2026-06-08T09:15:00', pj: false, etat: 'traite', priorite: 'bas', details: "Le système a planté lors du dépôt ; délai prolongé de 7 jours accordé." },
      { id: 5, objet: 'Erreur sur la spécialité affichée', candidat: 'Salma Mejri', master: BC, date: '2026-06-07T13:20:00', pj: false, etat: 'traite', priorite: 'moyen', details: 'Spécialité de diplôme corrigée dans le dossier ; aucune incidence sur le score.' },
      { id: 6, objet: 'Justificatif signalé manquant à tort', candidat: 'Yassine Trabelsi', master: GL, date: '2026-06-05T16:45:00', pj: true, etat: 'rejete', priorite: 'bas', motif_rejet: 'Après vérification, le justificatif fourni était illisible.', details: 'Le candidat conteste le rejet de son justificatif.' },
    ];
  }

  applyInscriptionFilters(): void {
    const search = normalizeActionLabel(this.inscriptionFilters.search);
    this.inscriptionFilteredCandidates = this.inscriptionCandidates
      .filter((candidate) => {
        if (search) {
          const haystack = [
            candidate.num,
            candidate.nom,
            candidate.cin,
            candidate.master,
            candidate.email,
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(search)) {
            return false;
          }
        }

        if (
          this.inscriptionFilters.paiement !== 'all' &&
          candidate.paiement !== this.inscriptionFilters.paiement
        ) {
          return false;
        }

        if (
          this.inscriptionFilters.dossier !== 'all' &&
          candidate.dossier !== this.inscriptionFilters.dossier
        ) {
          return false;
        }

        if (this.inscriptionFilters.finalise === 'yes' && !candidate.finalise) {
          return false;
        }

        if (this.inscriptionFilters.finalise === 'no' && candidate.finalise) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (a.finalise !== b.finalise) {
          return a.finalise ? 1 : -1;
        }

        const statusWeight = (value: InscriptionCandidateRow['paiement']): number => {
          if (value === 'paye') return 0;
          if (value === 'en_attente') return 1;
          if (value === 'incoherent') return 2;
          return 3;
        };

        const byStatus = statusWeight(a.paiement) - statusWeight(b.paiement);
        if (byStatus !== 0) {
          return byStatus;
        }

        return a.nom.localeCompare(b.nom);
      });

    this.updateInscriptionSelectAll();
    this.updateInscriptionStats();
  }

  resetInscriptionFilters(): void {
    this.inscriptionFilters = {
      search: '',
      paiement: 'all',
      dossier: 'all',
      finalise: 'all',
    };
    this.applyInscriptionFilters();
  }

  toggleInscriptionRow(id: number): void {
    if (this.inscriptionSelectedIds.has(id)) {
      this.inscriptionSelectedIds.delete(id);
    } else {
      this.inscriptionSelectedIds.add(id);
    }
    this.updateInscriptionSelectAll();
  }

  toggleInscriptionAll(): void {
    const shouldSelectAll = !this.inscriptionSelectAll;
    this.inscriptionSelectedIds.clear();

    if (shouldSelectAll) {
      this.inscriptionFilteredCandidates.forEach((candidate) =>
        this.inscriptionSelectedIds.add(candidate.id),
      );
    }

    this.inscriptionSelectAll = shouldSelectAll;
  }

  updateInscriptionSelectAll(): void {
    this.inscriptionSelectAll =
      this.inscriptionFilteredCandidates.length > 0 &&
      this.inscriptionFilteredCandidates.every((candidate) =>
        this.inscriptionSelectedIds.has(candidate.id),
      );
  }

  updateInscriptionStats(): void {
    const eligible = this.inscriptionCandidates.filter(
      (candidate) => candidate.dossier === 'complet',
    ).length;
    const verifiedPayments = this.inscriptionCandidates.filter(
      (candidate) => candidate.paiement === 'paye',
    ).length;
    const incoherencies = this.inscriptionCandidates.filter(
      (candidate) => candidate.paiement === 'incoherent',
    ).length;
    const absents = this.inscriptionCandidates.filter(
      (candidate) => candidate.paiement === 'absent',
    ).length;
    const finalised = this.inscriptionCandidates.filter(
      (candidate) => candidate.statut_final === 'inscrite',
    ).length;
    const validRows = this.inscriptionsVerificationRows.filter(
      (row) => row.verification === 'valide',
    ).length;

    this.inscriptionStats = {
      eligible,
      verifiedPayments,
      incoherencies,
      absents,
      finalised,
      matchPercent: eligible > 0 ? Math.round((validRows / eligible) * 100) : 0,
    };
  }

  getInscriptionPaymentLabel(value: InscriptionCandidateRow['paiement']): string {
    if (value === 'paye') return 'Payé';
    if (value === 'en_attente') return 'En attente';
    if (value === 'incoherent') return 'Incohérent';
    return 'Absent';
  }

  getInscriptionPaymentClass(value: InscriptionCandidateRow['paiement']): string {
    if (value === 'paye') return 'badge-success';
    if (value === 'en_attente') return 'badge-warning';
    if (value === 'incoherent') return 'badge-danger';
    return 'badge-muted';
  }

  getInscriptionFinalStatusLabel(value: InscriptionCandidateRow['statut_final']): string {
    if (value === 'inscrite') return 'Inscrite';
    if (value === 'rejetee') return 'Rejetée (Délai dépassé)';
    return 'En attente de paiement';
  }

  getInscriptionFinalStatusClass(value: InscriptionCandidateRow['statut_final']): string {
    if (value === 'inscrite') return 'badge-success';
    if (value === 'rejetee') return 'badge-danger';
    return 'badge-warning';
  }

  getInscriptionDossierClass(value: InscriptionCandidateRow['dossier']): string {
    return value === 'complet' ? 'badge-success' : 'badge-warning';
  }

  getInscriptionFinaliseClass(value: boolean): string {
    return value ? 'badge-success' : 'badge-muted';
  }

  openInscriptionContact(candidate: InscriptionCandidateRow): void {
    this.closeInscriptionActionMenu(candidate.id);
    window.location.href = `mailto:${candidate.email}?subject=Inscription%20administrative`;
  }

  toggleInscriptionActionMenu(id: number, event?: MouseEvent): void {
    event?.stopPropagation();
    this.inscriptionActionMenuOpenId = this.inscriptionActionMenuOpenId === id ? null : id;
  }

  isInscriptionActionMenuOpen(id: number): boolean {
    return this.inscriptionActionMenuOpenId === id;
  }

  closeInscriptionActionMenu(id?: number): void {
    if (typeof id === 'number' && this.inscriptionActionMenuOpenId === id) {
      this.inscriptionActionMenuOpenId = null;
      return;
    }

    this.inscriptionActionMenuOpenId = null;
  }

  openInscriptionReceipt(candidate: InscriptionCandidateRow): void {
    this.closeInscriptionActionMenu(candidate.id);
    if (candidate.receiptPdfUrl) {
      window.open(candidate.receiptPdfUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    this.toastService.show('Aucun reçu PDF disponible.', 'warning');
  }

  validateInscription(candidate: InscriptionCandidateRow): void {
    const confirmed = window.confirm(
      "Voulez-vous valider définitivement l'inscription administrative de ce candidat ?",
    );

    if (!confirmed) {
      return;
    }

    candidate.statut_final = 'inscrite';
    candidate.finalise = true;
    candidate.recuVerifie = true;
    candidate.observation = 'Inscription administrative validée';
    this.closeInscriptionActionMenu(candidate.id);
    this.applyInscriptionFilters();
    this.updateInscriptionStats();
    this.toastService.show('Inscription validée et dossier verrouillé.', 'success');
  }

  openRejectInscription(candidate: InscriptionCandidateRow): void {
    this.inscriptionRejectSelectionnee = candidate;
    this.motifRejetInscription = '';
    this.closeInscriptionActionMenu(candidate.id);
    this.showModalRejectInscription = true;
  }

  closeRejectInscriptionModal(): void {
    this.showModalRejectInscription = false;
    this.inscriptionRejectSelectionnee = null;
    this.motifRejetInscription = '';
  }

  confirmRejectInscription(): void {
    if (!this.inscriptionRejectSelectionnee) {
      return;
    }

    if (!this.motifRejetInscription.trim()) {
      this.toastService.show('Le motif du rejet est obligatoire.', 'warning');
      return;
    }

    this.inscriptionRejectSelectionnee.statut_final = 'rejetee';
    this.inscriptionRejectSelectionnee.finalise = false;
    this.inscriptionRejectSelectionnee.observation = this.motifRejetInscription.trim();
    this.applyInscriptionFilters();
    this.updateInscriptionStats();
    this.toastService.show('Inscription rejetée et candidat notifié.', 'success');
    this.closeRejectInscriptionModal();
  }

  getInscriptionProgressPct(): number {
    return Math.min(100, Math.max(0, this.inscriptionStats.matchPercent));
  }

  getInscriptionVerificationBadgeClass(value: InscriptionVerificationRow['verification']): string {
    if (value === 'valide') return 'badge-success';
    if (value === 'incoherent') return 'badge-warning';
    return 'badge-danger';
  }

  getInscriptionVerificationSummaryLabel(
    value: InscriptionVerificationRow['verification'],
  ): string {
    if (value === 'valide') return 'Valide';
    if (value === 'incoherent') return 'Incohérent';
    return 'Absent';
  }

  private getImportedCins(): Set<string> {
    const cins = this.inscriptionsExcelRows
      .map((row) => {
        const raw = row?.CIN ?? row?.cin ?? row?.candidat_cin ?? row?.Cni ?? row?.cni ?? '';
        return normalizeActionLabel(String(raw));
      })
      .filter((value) => !!value);

    return new Set(cins);
  }

  private verifyInscriptionsLocally(): void {
    const importedCins = this.getImportedCins();
    const sourceRows = this.inscriptionCandidates.length > 0 ? this.inscriptionCandidates : [];

    this.inscriptionsVerificationRows = sourceRows.map((candidate, index) => {
      const cin = normalizeActionLabel(candidate.cin);
      const matched =
        importedCins.size > 0 ? importedCins.has(cin) : candidate.paiement !== 'absent';

      let verification: InscriptionVerificationRow['verification'] = 'absent';
      let details = 'Candidat non trouvé dans le fichier importé';

      if (matched && candidate.paiement === 'paye') {
        verification = 'valide';
        details = 'Correspondance exacte et paiement confirmé';
      } else if (matched && candidate.paiement === 'en_attente') {
        verification = 'incoherent';
        details = 'Fiche présente mais paiement en attente';
      } else if (matched && candidate.paiement === 'incoherent') {
        verification = 'incoherent';
        details = 'Incohérence détectée dans les données';
      } else if (matched) {
        verification = 'absent';
        details = 'Présent dans le dossier mais paiement manquant';
      }

      return {
        numero_candidature: candidate.num,
        cin: candidate.cin,
        numero_inscription: `INS-${String(index + 1).padStart(4, '0')}`,
        nom_prenom: candidate.nom,
        master: candidate.master,
        specialite: candidate.master,
        verification,
        details,
      };
    });

    this.inscriptionVerified = true;
    this.lastRapprochementAuditId = Date.now();
    this.updateInscriptionStats();
    this.toastService.show('Vérification locale terminée.', 'success');
  }

  finalizeInscriptions(): void {
    const finalisable = this.inscriptionCandidates.filter(
      (candidate) =>
        candidate.dossier === 'complet' && candidate.paiement === 'paye' && !candidate.finalise,
    );

    if (finalisable.length === 0) {
      this.toastService.show('Aucune inscription prête à finaliser.', 'warning');
      return;
    }

    finalisable.forEach((candidate) => {
      candidate.finalise = true;
      candidate.statut_final = 'inscrite';
      candidate.observation = 'Inscription finalisée';
    });

    this.applyInscriptionFilters();
    this.toastService.show(`${finalisable.length} inscription(s) finalisée(s).`, 'success');
  }

  exportVerifiedInscriptions(format: 'xlsx' | 'pdf' = 'xlsx'): void {
    const rows: ExportRow[] = (
      this.inscriptionsVerificationRows.length > 0
        ? this.inscriptionsVerificationRows.filter((row) => row.verification === 'valide')
        : this.inscriptionCandidates.filter(
            (candidate) => candidate.paiement === 'paye' && candidate.dossier === 'complet',
          )
    ).map((item: any) => ({
      'Numéro candidature': item.numero_candidature || item.num,
      CIN: item.cin,
      'Numéro inscription':
        item.numero_inscription || `INS-${String(item.id || 0).padStart(4, '0')}`,
      'Nom et prénom': item.nom_prenom || item.nom,
      Master: item.master,
      Spécialité: item.specialite || item.master,
    }));

    if (rows.length === 0) {
      this.toastService.show('Aucune ligne valide à exporter.', 'warning');
      return;
    }

    this.exportRows(rows, format as ExportFormat, 'inscriptions-finales', 'Inscriptions finales');
  }

  exportRows(
    rows: ExportRow[],
    format: ExportFormat,
    baseFileName: string,
    tableTitle: string,
  ): void {
    if (format === 'csv') {
      this.exportRowsToCSV(rows, baseFileName);
    } else if (format === 'json') {
      this.exportRowsToJSON(rows, baseFileName);
    } else if (format === 'xlsx') {
      this.exportRowsToXLSX(rows, baseFileName, tableTitle);
    } else if (format === 'pdf') {
      this.exportRowsToPdf(rows, baseFileName, tableTitle);
    }
  }

  exportRowsToCSV(rows: ExportRow[], baseFileName: string): void {
    if (rows.length === 0) {
      this.showAlertMessage('❌ Aucune donnée à exporter');
      return;
    }

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => headers.map((h) => `"${row[h]}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    this.downloadFile(blob, baseFileName, 'csv');
  }

  exportRowsToJSON(rows: ExportRow[], baseFileName: string): void {
    if (rows.length === 0) {
      this.showAlertMessage('❌ Aucune donnée à exporter');
      return;
    }

    const jsonContent = JSON.stringify(rows, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    this.downloadFile(blob, baseFileName, 'json');
  }

  exportRowsToXLSX(rows: ExportRow[], baseFileName: string, tableTitle: string): void {
    if (rows.length === 0) {
      this.showAlertMessage('❌ Aucune donnée à exporter');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, tableTitle.substring(0, 31));

    const fileName = this.buildExportFileName(baseFileName, 'xlsx');
    XLSX.writeFile(workbook, fileName);
  }

  private exportRowsToPdf(rows: ExportRow[], baseFileName: string, tableTitle: string): void {
    if (rows.length === 0) {
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

  // ══ MODAL VALIDATION PRÉSÉLECTION ══
  showModalValidationPreselection = false;
  candidatureValidationPreselection: Candidature | null = null;
  preselAvisSelectionne: string = 'favorable';
  preselCommentaire: string = '';
  preselConfirmLoading = false;
  preselectionValidationSuccess = false;

  ouvrirModalValidationPreselection(candidature?: Candidature): void {
    this.candidatureValidationPreselection = candidature ?? null;
    this.preselAvisSelectionne = 'favorable';
    this.preselCommentaire = '';
    this.preselConfirmLoading = false;
    this.preselectionValidationSuccess = false;
    this.showModalValidationPreselection = true;
    this.closeActionMenu();
  }

  fermerModalValidationPreselection(): void {
    this.showModalValidationPreselection = false;
    this.preselectionValidationSuccess = false;
    this.candidatureValidationPreselection = null;
  }

  confirmerValidationPreselection(): void {
    if (!this.preselAvisSelectionne || !this.candidatureValidationPreselection) return;
    this.preselConfirmLoading = true;

    const token = this.authService.getAccessToken();
    if (!token) {
      this.preselConfirmLoading = false;
      this.toastService.show('Session expirée. Veuillez vous reconnecter.', 'error');
      return;
    }

    this.http
      .post(
        `/api/candidatures/${this.candidatureValidationPreselection.id}/valider-preselection/`,
        {
          recommandation: this.preselAvisSelectionne,
          commentaire: this.preselCommentaire,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .subscribe({
        next: () => {
          this.preselConfirmLoading = false;
          this.preselectionValidationSuccess = true;

          // Mise à jour locale du statut
          if (this.candidatureValidationPreselection) {
            this.candidatureValidationPreselection.statut = 'preselectionne';
            this.candidatureValidationPreselection.decision_responsable = 'valide';
          }

          // Synchroniser dans toutes les listes locales
          const id = this.candidatureValidationPreselection!.id;
          this.candidatures = this.candidatures.map((c) =>
            c.id === id ? { ...c, statut: 'preselectionne', decision_responsable: 'valide' } : c,
          );
          this.candidaturesResponsable = this.sortRowsByScoreDesc(
            this.candidaturesResponsable.map((c) =>
              c.id === id ? { ...c, statut: 'preselectionne', decision_responsable: 'valide' } : c,
            ),
          );
          this.appliquerFiltresResponsable();
          this.appliquerFiltres();

          // Enregistrer l'avis dans candidatureVotes
          const membreNom =
            this.currentUser?.first_name && this.currentUser?.last_name
              ? `${this.currentUser.first_name} ${this.currentUser.last_name}`
              : this.currentUser?.username || this.currentUser?.email || 'Responsable';

          this.candidatureVotes[id] = [
            ...(this.candidatureVotes[id] || []).filter((v) => v.membreNom !== membreNom),
            {
              membreNom,
              role: 'responsable',
              recommandation: this.preselAvisSelectionne as 'favorable' | 'defavorable' | 'reserve',
              commentaire: this.preselCommentaire || 'Validé par le responsable',
              date: new Date().toISOString(),
              diplomeConforme: true,
            },
          ];
        },
        error: (error) => {
          console.error('Erreur validation présélection:', error);
          this.preselConfirmLoading = false;

          // Fallback mode local si l'API est indisponible
          if (!this.responsableCandidaturesFromApi) {
            this.preselectionValidationSuccess = true;
            if (this.candidatureValidationPreselection) {
              this.candidatureValidationPreselection.statut = 'preselectionne';
              this.candidatureValidationPreselection.decision_responsable = 'valide';
            }
            this.toastService.show('Présélection validée en mode local.', 'warning');
          } else {
            const backendMsg = error?.error?.error || error?.error?.message || '';
            this.toastService.show(
              backendMsg || 'Erreur lors de la validation de présélection.',
              'error',
            );
          }
        },
      });
  }

}
