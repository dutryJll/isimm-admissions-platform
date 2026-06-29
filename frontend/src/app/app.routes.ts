import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';

import { ForgotPasswordComponent } from './components/forgot-password/forgot-password';
import { ResetPasswordComponent } from './components/reset-password/reset-password';
import { ConcoursIngenieurComponent } from './components/concours-ingenieur/concours-ingenieur.component';
import { CandidatureFormComponent } from './components/candidature-form/candidature-form.component';
import { CandidatureInProgressComponent } from './components/candidature-in-progress/candidature-in-progress';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin-guard';
import { roleGuard } from './guards/role-guard';
import { actionGuard } from './guards/action.guard';
import { ProfilComponent } from './components/shared/profil.component';
import { CreatePasswordComponent } from './components/create-password/create-password.component';
import { VerifyEmailComponent } from './components/verify-email/verify-email.component';

// ========================================
// NOUVEAUX LOGIN SPÉCIFIQUES
// ========================================
import { LoginCandidatComponent } from './components/login-candidat/login-candidat.component';
import { LoginCommissionComponent } from './components/login-commission/login-commission.component';
import { LoginAdminComponent } from './components/login-admin/login-admin.component';

// ========================================
// CANDIDAT COMPONENTS
// ========================================
import { DashboardCandidatComponent } from './components/candidat/dashboard-candidat/dashboard-candidat';
import { ConsulterCandidaturesComponent } from './components/candidat/consulter-candidature/consulter-candidature';
import { ModifierCandidatureComponent } from './components/candidat/modifier-candidature/modifier-candidature';
import { ConsulterDossierComponent } from './components/candidat/consulter-dossier/consulter-dossier';
import { DeposerDocumentsComponent } from './components/candidat/deposer-documents/deposer-documents';
import { ChoixCandidatureComponent } from './components/choix-candidature/choix-candidature';
import { NouvelleReclamationComponent } from './components/candidat/nouvelle-reclamation/nouvelle-reclamation';
import { InscriptionOnlineComponent } from './components/candidat/inscription-online/inscription-online';
import { GuideEtudiantComponent } from './components/guide-etudiant/guide-etudiant';
import { MasterCatalogComponent } from './components/master-catalog/master-catalog.component';
import { IngenieurCatalogComponent } from './components/ingenieur-catalog/ingenieur-catalog.component';
import { ResearchMastersExplorationComponent } from './components/research-masters-exploration/research-masters-exploration.component';
import { ProfessionalMastersExplorationComponent } from './components/professional-masters-exploration/professional-masters-exploration.component';
import { EngineerExplorationComponent } from './components/engineer-exploration/engineer-exploration.component';
import { ConsultationDossierComponent } from './components/consultation-dossier/consultation-dossier.component';

// ========================================
// ADMIN COMPONENTS
// ========================================
import { ListeCandidatures } from './components/admin/liste-candidatures/liste-candidatures';
import { DashboardAdminComponent } from './components/admin/dashboard-admin/dashboard-admin';
import { EditUserComponent } from './components/admin/edit-user/edit-user';
import { EditMasterComponent } from './components/admin/edit-master/edit-master';
import { EditOffreIngenieurComponent } from './components/admin/edit-offre-ingenieur/edit-offre-ingenieur';
import { EditCommissionMemberComponent } from './components/admin/edit-commission-member/edit-commission-member';
import { ManageCommissionMembersComponent } from './components/admin/manage-commission-members/manage-commission-members';
import { ManageResponsablesComponent } from './components/admin/manage-responsables/manage-responsables';

// ========================================
// COMMISSION COMPONENTS
// ========================================
import { DashboardCommissionComponent } from './components/commission/dashboard-commission/dashboard-commission';
import { ConsulterCandidaturesComponent as ConsulterCandidaturesCommissionComponent } from './components/commission/consulter-candidatures/consulter-candidatures';
import { CandidaturesMasterResponsableComponent } from './components/commission/candidatures-master-responsable/candidatures-master-responsable.component';
import { CandidaturesMasterMembreComponent } from './components/commission/candidatures-master-membre/candidatures-master-membre.component';
import { CandidaturesIngenieurResponsableComponent } from './components/commission/candidatures-ingenieur-responsable/candidatures-ingenieur-responsable.component';
import { CandidaturesIngenieurMembreComponent } from './components/commission/candidatures-ingenieur-membre/candidatures-ingenieur-membre.component';
import { PreparerPreselection } from './components/commission/preparer-preselection/preparer-preselection';
import { SelectionMembreComponent } from './components/commission/selection-membre/selection-membre.component';
import { SelectionResponsableComponent } from './components/commission/selection-responsable/selection-responsable.component';
import { ListeDossiersComponent } from './components/commission/liste-dossiers/liste-dossiers';
import { DossierAnalysisComponent } from './components/commission/dossier-analysis/dossier-analysis';
import { ExaminerOcrComponent } from './components/commission/examiner-ocr/examiner-ocr';
import { TraiterReclamationsComponent } from './components/commission/traiter-reclamations/traiter-reclamations';
import { GererInscriptionsComponent } from './components/commission/gerer-inscriptions/gerer-inscriptions';
import { OffrePreinscriptionEditorComponent } from './components/commission/offre-preinscription-editor/offre-preinscription-editor';
import { OfferCreationWizardComponent } from './components/commission/offer-creation-wizard/offer-creation-wizard';
import { GestionCommissionComponent } from './components/admin/gestion-commission/gestion-commission.component';
import { ImportInscriptionsComponent } from './components/responsable/import-inscriptions/import-inscriptions';

import { DeposerDossierCommissionComponent } from './components/commission/deposer-dossier-commission/deposer-dossier-commission';
import { PreselectionDashboardComponent } from './components/commission/preselection-dashboard/preselection-dashboard.component';
import { SelectionProcessComponent } from './components/commission/selection-process/selection-process.component';
import { ListePreselection } from './components/commission/liste-preselection/liste-preselection';
export const routes: Routes = [
  // ========================================
  // ROUTES PUBLIQUES
  // ========================================
  {
    path: '',
    component: HomeComponent,
  },
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'login-candidat',
    component: LoginCandidatComponent,
  },
  {
    path: 'login-commission',
    component: LoginCommissionComponent,
  },
  {
    path: 'login-admin',
    component: LoginAdminComponent,
  },
  {
    path: 'register',
    component: RegisterComponent,
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent,
  },
  {
    path: 'reset-password',
    component: ResetPasswordComponent,
  },
  {
    path: 'reset-password/:token',
    component: ResetPasswordComponent,
  },
  {
    path: 'concours-ingenieur',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    path: 'choisir-candidature',
    component: ChoixCandidatureComponent,
  },
  {
    path: 'master/disponibles',
    component: MasterCatalogComponent,
  },
  {
    path: 'ingenieur/disponibles',
    component: IngenieurCatalogComponent,
  },
  {
    path: 'masters/disponibles',
    redirectTo: 'master/disponibles',
    pathMatch: 'full',
  },
  {
    path: 'candidature',
    component: CandidatureFormComponent,
  },
  {
    path: 'candidature/in-progress',
    component: CandidatureInProgressComponent,
  },
  {
    path: 'guide-etudiant',
    component: GuideEtudiantComponent,
  },
  {
    path: 'masters/recherche/exploration',
    component: ResearchMastersExplorationComponent,
  },
  {
    path: 'masters/professionnel/exploration',
    component: ProfessionalMastersExplorationComponent,
  },
  {
    path: 'masters/ingenieur/exploration',
    component: EngineerExplorationComponent,
  },
  {
    path: 'exploration-masters-recherche',
    component: ResearchMastersExplorationComponent,
  },

  // ========================================
  // ROUTES CANDIDAT
  // ========================================
  {
    path: 'create-password/:token',
    component: CreatePasswordComponent,
  },
  {
    path: 'verify-email/:token',
    component: VerifyEmailComponent,
  },
  {
    path: 'candidat/dashboard',
    component: DashboardCandidatComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['candidat'] },
  },
  {
    path: 'candidat/candidature/modifier',
    component: ModifierCandidatureComponent,
    canActivate: [authGuard, roleGuard, actionGuard],
    data: { roles: ['candidat'], actions: ['Modifier candidature'] },
  },
  {
    path: 'candidat/candidature',
    component: ConsulterCandidaturesComponent,
    canActivate: [authGuard, roleGuard, actionGuard],
    data: { roles: ['candidat'], actions: ['Consultation de candidature'] },
  },
  {
    path: 'candidat/candidature/:id',
    component: ConsulterCandidaturesComponent,
    canActivate: [authGuard, roleGuard, actionGuard],
    data: { roles: ['candidat'], actions: ['Consultation de candidature'] },
  },
  {
    path: 'candidat/dossier',
    component: ConsulterDossierComponent,
    canActivate: [authGuard, roleGuard, actionGuard],
    data: { roles: ['candidat'], actions: ['Consultation de dossier'] },
  },
  {
    path: 'consultation-dossier/:id',
    component: ConsultationDossierComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['candidat', 'commission', 'responsable_commission'] },
  },
  {
    path: 'candidat/dossier/deposer',
    component: DeposerDocumentsComponent,
    canActivate: [authGuard, roleGuard, actionGuard],
    data: { roles: ['candidat'], actions: ['Dépôt de dossier'] },
  },
  {
    path: 'candidat/reclamations/nouvelle',
    component: NouvelleReclamationComponent,
    canActivate: [authGuard, roleGuard, actionGuard],
    data: { roles: ['candidat'], actions: ['Déposer réclamation'] },
  },
  {
    path: 'candidat/inscription-online/:id',
    component: InscriptionOnlineComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['candidat'] },
  },

  // ========================================
  // ROUTES RESPONSABLE
  // ========================================
  {
    path: 'responsable/import-inscriptions',
    component: ImportInscriptionsComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['responsable_commission', 'admin'] },
  },

  // ========================================
  // ROUTES COMMISSION
  // ========================================
  {
    path: 'commission/dashboard',
    component: DashboardCommissionComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['commission', 'responsable_commission'] },
  },
  {
    path: 'commission/gestion-membres/:commission_id',
    component: ManageCommissionMembersComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['responsable_commission'] },
  },
  {
    path: 'commission/candidatures-master-responsable',
    component: CandidaturesMasterResponsableComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['responsable_commission'] },
  },
  {
    path: 'commission/candidatures-master-membre',
    component: CandidaturesMasterMembreComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['commission', 'membre'] },
  },
  {
    path: 'commission/candidatures-ingenieur-responsable',
    component: CandidaturesIngenieurResponsableComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['responsable_commission'] },
  },
  {
    path: 'commission/candidatures-ingenieur-membre',
    component: CandidaturesIngenieurMembreComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['commission', 'membre'] },
  },
  {
    path: 'commission/dossiers',
    component: ListeDossiersComponent,
    canActivate: [authGuard, roleGuard, actionGuard],
    data: {
      roles: ['commission', 'responsable_commission'],
      actions: ['Consultation de dossier'],
    },
  },
  {
    path: 'commission/liste-preselection',
    component: ListePreselection,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['commission', 'responsable_commission', 'membre'] },
  },
  {
    path: 'commission/decision-collegiale',
    component: PreselectionDashboardComponent,
    canActivate: [authGuard, roleGuard, actionGuard],
    data: { roles: ['responsable_commission'], actions: ['Préselection'] },
  },
  {
    path: 'commission/liste-selection',
    component: SelectionMembreComponent,
    canActivate: [authGuard, roleGuard, actionGuard],
    data: {
      roles: ['commission', 'membre'],
      actions: [
        'Sélection finale',
        'Publier liste principale',
        'Publier liste attente',
        'Consultation de candidature',
      ],
    },
  },
  {
    path: 'responsable/liste-selection',
    component: SelectionResponsableComponent,
    canActivate: [authGuard, roleGuard, actionGuard],
    data: {
      roles: ['responsable_commission'],
      actions: [
        'Sélection finale',
        'Publier liste principale',
        'Publier liste attente',
        'Consultation de candidature',
      ],
    },
  },
  {
    path: 'commission/candidatures',
    component: ConsulterCandidaturesCommissionComponent,
    canActivate: [authGuard, roleGuard, actionGuard],
    data: {
      roles: ['commission', 'responsable_commission', 'membre'],
      actions: ['Consultation de candidature'],
    },
  },
  {
    path: 'commission/candidatures/:id',
    component: ConsulterCandidaturesCommissionComponent,
    canActivate: [authGuard, roleGuard, actionGuard],
    data: {
      roles: ['commission', 'responsable_commission', 'membre'],
      actions: ['Consultation de candidature'],
    },
  },
  {
    path: 'commission/dossier/:id',
    component: ConsultationDossierComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['commission', 'responsable_commission'],
    },
  },
  {
    path: 'commission/dossier-analysis',
    component: DossierAnalysisComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['commission', 'responsable_commission'],
    },
  },
  {
    path: 'commission/offre-preinscription/edit/:id',
    component: OffrePreinscriptionEditorComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['responsable_commission', 'commission'],
    },
  },
  {
    path: 'commission/preparer-preselection',
    component: PreparerPreselection,
    canActivate: [authGuard, roleGuard, actionGuard],
    data: { roles: ['responsable_commission'], actions: ['Préselection'] },
  },
  {
    path: 'commission/examiner-ocr',
    component: ExaminerOcrComponent,
    canActivate: [authGuard, roleGuard, actionGuard],
    data: { roles: ['responsable_commission'], actions: ['Vérifier dossiers'] },
  },
  {
    path: 'commission/reclamations',
    component: TraiterReclamationsComponent,
    canActivate: [authGuard, roleGuard, actionGuard],
    data: { roles: ['responsable_commission'], actions: ['Traiter réclamations'] },
  },
  {
    path: 'commission/inscriptions',
    component: GererInscriptionsComponent,
    canActivate: [authGuard, roleGuard, actionGuard],
    data: { roles: ['responsable_commission'], actions: ['Gérer inscriptions'] },
  },
  {
    path: 'commission/dossier/deposer/:id',
    component: DeposerDossierCommissionComponent,
    canActivate: [authGuard, roleGuard, actionGuard],
    data: { roles: ['commission', 'responsable_commission'], actions: ['Dépôt de dossier'] },
  },
  {
    path: 'commission/offre-wizard/new',
    component: OfferCreationWizardComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['responsable_commission'] },
  },
  {
    path: 'commission/offre-wizard/:master_id/edit',
    component: OfferCreationWizardComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['responsable_commission'] },
  },

  // ========================================
  // ROUTES ADMIN
  // ========================================
  {
    path: 'admin/dashboard',
    component: DashboardAdminComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
  },
  {
    path: 'admin/gestion-commission',
    component: GestionCommissionComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
  },
  {
    path: 'admin/gestion-responsables',
    component: ManageResponsablesComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
  },
  {
    path: 'admin/gestion-commission/:commission_id/members',
    component: ManageCommissionMembersComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['responsable_commission'] },
  },
  {
    path: 'admin/gestion-commission/:id/edit',
    component: EditCommissionMemberComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['responsable_commission'] },
  },
  {
    path: 'admin/candidatures',
    component: ListeCandidatures,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
  },
  {
    path: 'admin/users/:id/edit',
    component: EditUserComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
  },
  {
    path: 'admin/masters/new',
    component: EditMasterComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
  },
  {
    path: 'admin/parcours-master/new',
    component: EditMasterComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
  },
  {
    path: 'admin/masters/:id/edit',
    component: EditMasterComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
  },
  {
    path: 'admin/parcours-master/:id/edit',
    component: EditMasterComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
  },
  {
    path: 'admin/offres-ingenieur/new',
    component: EditOffreIngenieurComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
  },
  {
    path: 'admin/parcours-ingenieurs/new',
    component: EditOffreIngenieurComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
  },
  {
    path: 'admin/offres-ingenieur/:id/edit',
    component: EditOffreIngenieurComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
  },
  {
    path: 'admin/parcours-ingenieurs/:id/edit',
    component: EditOffreIngenieurComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
  },
  {
    path: 'admin/concours-ingenieur',
    component: ConcoursIngenieurComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
  },

  // ========================================
  // ROUTES GÉNÉRALES
  // ========================================
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
  },
  {
    path: 'profil',
    component: ProfilComponent,
    canActivate: [authGuard],
  },

  // ========================================
  // ROUTE WILDCARD - ⚠️ TOUJOURS EN DERNIER
  // ========================================
  {
    path: 'dev/selection-process',
    component: SelectionProcessComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
