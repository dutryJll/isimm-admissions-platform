from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views
from . import views_export
from . import views_inscription_online
from . import views_commission_membre
from .views_parcours import ParcoursAdmissionViewSet
from . import views_pdf_official
from . import views_attestation

router = DefaultRouter()
router.register(r'parcours', ParcoursAdmissionViewSet, basename='parcours-admission')

urlpatterns = router.urls + [
    path('create/', views.create_candidature, name='create_candidature'),
    path('soumettre/', views.soumettre_candidature, name='soumettre_candidature'),
    path('preview-score/', views.preview_score_candidature, name='preview_score_candidature'),
    path('masters/', views.lister_masters, name='lister_masters'),
    path('masters/<int:master_id>/specialites/', views.get_specialites_for_master, name='get_specialites_for_master'),
    path('masters/<int:master_id>/specialites-admissibles/', views.get_specialites_admissibles_master, name='get_specialites_admissibles_master'),
    path('offers-available/', views.get_available_offers_with_specialites, name='get_available_offers_with_specialites'),
    path('masters/<int:master_id>/can-reapply/', views.can_reapply_to_master, name='can_reapply_to_master'),
    path('masters/<int:master_id>/specialites-preselection/', views.get_specialites_for_preselection, name='get_specialites_for_preselection'),
    path('masters/<int:master_id>/specialites-inscription/', views.get_specialites_for_inscription, name='get_specialites_for_inscription'),
    path('<int:candidature_id>/specialites-dossier/', views.get_specialites_for_dossier, name='get_specialites_for_dossier'),
    path('masters/admin/', views.creer_master_admin, name='creer_master_admin'),
    path('masters/<int:master_id>/', views.modifier_supprimer_master_admin, name='modifier_supprimer_master_admin'),
    path('mes-candidatures/', views.mes_candidatures, name='mes_candidatures'),
    path('mes-candidatures/reclasser-voeux/', views.reclasser_voeux, name='reclasser_voeux'),
    path('candidatures/<int:candidature_id>/finaliser-dossier/', views.finaliser_dossier, name='finaliser_dossier'),
    path('candidate-live-metrics/', views.candidate_live_metrics, name='candidate_live_metrics'),
    path('mes-notifications/', views.mes_notifications, name='mes_notifications'),
    path('notifications/mark-all-read/', views.marquer_toutes_notifications_lues, name='marquer_toutes_notifications_lues'),
    path('notifications/<int:notification_id>/mark-read/', views.marquer_notification_lue, name='marquer_notification_lue'),
    path('offres-inscription/', views.offres_inscription, name='offres_inscription'),
    path('offres-master/', views.offres_master_crud, name='offres_master_crud'),
    path('offres-master/<int:offre_id>/', views.offre_master_detail_crud, name='offre_master_detail_crud'),
    path('offres-master/<int:offre_id>/public/', views.offre_master_public_detail, name='offre_master_public_detail'),
    path('offres-inscription-responsable/', views.offres_inscription_responsable, name='offres_inscription_responsable'),
    path('offres-inscription/<int:offer_id>/contenu-edite/', views.contenu_offre_inscription, name='contenu_offre_inscription'),
    path('responsable/candidatures/', views.candidatures_responsable, name='candidatures_responsable'),
    path('responsable/mes-masters/', views.get_mes_masters, name='get_mes_masters'),
    path('responsable/notifications/', views.notifications_responsable, name='notifications_responsable'),
    path('upload-fichier/', views.upload_fichier_dossier, name='upload_fichier_dossier'),
    path('<int:candidature_id>/list-fichiers-deposes/', views.list_fichiers_deposes, name='list_fichiers_deposes'),
    path('analyser-ocr-lot/', views.analyser_ocr_lot, name='analyser_ocr_lot'),
    path('export-ocr-excel/', views.export_ocr_excel, name='export_ocr_excel'),
    path('export-ocr-pdf/', views.export_ocr_pdf, name='export_ocr_pdf'),
    path('rapport-conformite-ocr/excel/', views.rapport_conformite_ocr_excel, name='rapport_conformite_ocr_excel'),
    path('rapport-conformite-ocr/pdf/', views.rapport_conformite_ocr_pdf, name='rapport_conformite_ocr_pdf'),
    path('mes-dossiers/', views.mes_dossiers, name='mes_dossiers'),
    path('dossiers-ocr/', views.lister_dossiers_ocr, name='lister_dossiers_ocr'),
    path('<int:candidature_id>/modifier/', views.modifier_candidature, name='modifier_candidature'),
    path('<int:candidature_id>/changer-statut/', views.changer_statut_candidature, name='changer_statut'),
    path('<int:candidature_id>/update-status/', views.update_status, name='update_status'),
    path(
        '<int:candidature_id>/commission-decision/',
        views.commission_decision_candidature,
        name='commission_decision_candidature',
    ),
    path('<int:candidature_id>/avis/statistiques/', views.statistiques_avis_candidature, name='statistiques_avis_candidature'),
    path('<int:candidature_id>/avis/list/', views.list_avis_candidature, name='list_avis_candidature'),
    path('<int:candidature_id>/avis/<int:avis_id>/delete/', views.delete_avis, name='delete_avis'),
    path('<int:candidature_id>/avis/<int:avis_id>/update/', views.update_avis, name='update_avis'),
    path('<int:candidature_id>/avis/<int:avis_id>/', views.get_avis_detail, name='get_avis_detail'),
    path('<int:candidature_id>/avis/', views.soumettre_avis_membre, name='soumettre_avis_membre'),
    path('<int:candidature_id>/annuler/', views.annuler_candidature, name='annuler_candidature'),
    path('<int:candidature_id>/decision-responsable/', views.set_decision_finale_responsable, name='set_decision_finale_responsable'),
    path('<int:candidature_id>/valider-preselection/', views.valider_preselection_candidature, name='valider_preselection_candidature'),
    path('corbeille/', views.corbeille_candidatures, name='corbeille_candidatures'),
    path('configuration/<int:master_id>/', views.gerer_configuration_appel, name='gerer_configuration'),
    path('configuration/', views.gerer_configuration_appel, name='creer_configuration'),
    path('configuration/<int:master_id>/document-pdf/', views.upload_document_configuration_appel, name='upload_document_configuration_appel'),
    path('configuration/<int:master_id>/publier/', views.publier_offre_preinscription, name='publier_offre_preinscription'),
    path('masters/<int:master_id>/formule-score/', views.formule_score_master, name='formule_score_master'),
    path('masters/<int:master_id>/coefficients/', views.master_coefficients, name='master_coefficients'),
    path('masters/<int:master_id>/avis/filter/', views.filter_avis_by_commission, name='filter_avis_by_commission'),
    path('masters/<int:master_id>/commission-members/', views.get_commission_members_for_master, name='get_commission_members_for_master'),
    path('my-commissions/', views.get_my_commissions, name='get_my_commissions'),
    path('admin/avis/bulk-delete/', views.bulk_delete_avis, name='bulk_delete_avis'),
    path('admin/candidatures/bulk-update-status/', views.bulk_update_candidature_status, name='bulk_update_candidature_status'),
    path('admin/candidatures/assign-to-member/', views.assign_candidatures_to_member, name='assign_candidatures_to_member'),
    path('admin/dashboard-stats/', views.get_admin_dashboard_stats, name='get_admin_dashboard_stats'),
    path('masters/<int:master_id>/formulaire-commission/', views.formulaire_commission_master, name='formulaire_commission_master'),
    path('<int:candidature_id>/deposer-dossier/', views.deposer_dossier_numerique, name='deposer_dossier_numerique'),
    path('<int:candidature_id>/ajuster-dossier/', views.ajuster_dossier_numerique, name='ajuster_dossier_numerique'),
    path('ocr/test/', views.ocr_test_diagnostic, name='ocr_test_diagnostic'),
    path('ocr/analyser-lot/', views.analyser_lot_ocr, name='analyser_lot_ocr'),
    path('<int:candidature_id>/calculer-score/', views.calculer_score_candidature, name='calculer_score'),
    path('<int:candidature_id>/calculer-score-final/', views.calculer_score_final_et_statut, name='calculer_score_final_et_statut'),
    path('commission/historique/', views.enregistrer_action_commission, name='enregistrer_action_commission'),
    path('reclamations/<int:reclamation_id>/repondre/', views.repondre_reclamation, name='repondre_reclamation'),
    path(
        'reclamations/<int:reclamation_id>/rectifier-score/',
        views.rectifier_score_reclamation,
        name='rectifier_score_reclamation',
    ),
    path('master/<int:master_id>/generer-liste-manuelle/', views.generer_liste_manuelle, name='generer_liste_manuelle'),
    path('master/<int:master_id>/liste-admission-recente/', views.liste_admission_recente, name='liste_admission_recente'),
    path('master/<int:master_id>/generer-listes/', views.generer_listes_admission, name='generer_listes'),
    path('master/<int:master_id>/cloture-ou-relance/', views.cloturer_ou_relancer_admission, name='cloturer_ou_relancer_admission'),
    path('listes/<int:liste_id>/publier/', views.publier_liste, name='publier_liste'),
    path('importer-paiements/', views.importer_paiements, name='importer_paiements'),
    path('inscriptions/rapprochement/', views.rapprocher_inscriptions_excel, name='rapprocher_inscriptions_excel'),
    path('inscriptions-administratives/', views.consulter_inscriptions_administratives, name='consulter_inscriptions_administratives'),
    path('concours/', views.lister_concours, name='lister_concours'),
    path('concours/admin/', views.creer_concours_admin, name='creer_concours_admin'),
    path('concours/<int:concours_id>/admin/', views.modifier_supprimer_concours_admin, name='modifier_supprimer_concours_admin'),
    path('masters/reglement-reference/', views.reglement_masters_reference, name='reglement_masters_reference'),
    path('concours/reglement-reference/', views.reglement_concours_ingenieur_reference, name='reglement_concours_ingenieur_reference'),
    path('concours/<int:concours_id>/appliquer-reglement-reference/', views.appliquer_reglement_reference_concours, name='appliquer_reglement_reference_concours'),
    path('listes/<int:liste_id>/export/pdf/', views.exporter_liste_pdf, name='exporter_liste_pdf'),
    path('listes/<int:liste_id>/export/excel/', views.exporter_liste_excel, name='exporter_liste_excel'),
    path('send-member-credentials/', views.send_member_credentials, name='send_member_credentials'),
    path('export/', views_export.export_candidatures, name='export_candidatures'),
    path('specialites/by-parcours/', views.get_specialites_by_parcours, name='get_specialites_by_parcours'),
    path('all-parcours/', views.list_all_parcours, name='list_all_parcours'),
    path('commissions/my-commissions/', views.get_my_commissions, name='get_user_commissions'),
    path('commissions/<int:commission_id>/members/', views.get_commission_members_list, name='get_commission_members'),
    path('commissions/<int:commission_id>/members/add/', views.commission_add_member, name='commission_add_member'),
    path('commissions/<int:commission_id>/members/<int:membre_id>/delete/', views.commission_remove_member, name='commission_remove_member'),
    path('commissions/<int:commission_id>/appel-avis/', views.send_appel_avis, name='send_appel_avis'),
    path('commissions/<int:commission_id>/avis-global/', views.commission_avis_global, name='commission_avis_global'),
    path('commissions/<int:commission_id>/valider-preselection/', views.valider_preselection_commission, name='valider_preselection_commission'),
    path('commissions/<int:commission_id>/appliquer-quotas/', views.appliquer_quotas_decision_finale, name='appliquer_quotas_decision_finale'),
    path('<int:candidature_id>/statut/changer/', views.changer_statut_candidature_endpoint, name='changer_statut_candidature'),
    path('<int:candidature_id>/statut/historique/', views.recuperer_historique_statuts_endpoint, name='recuperer_historique_statuts'),

    # ── Workflow d'inscription en ligne ──────────────────────────────────────
    path('<int:candidature_id>/saisir-numero/', views_inscription_online.saisir_numero_inscription, name='saisir_numero_inscription'),
    path('verifier-excel-inscriptions/', views_inscription_online.verifier_excel_inscriptions, name='verifier_excel_inscriptions'),
    # v7 §6.5 — Comparer la liste des inscrits importée aux admis → « admis non inscrits »
    path('comparer-inscrits-admis/', views_inscription_online.comparer_inscrits_admis, name='comparer_inscrits_admis'),
    # Liste réelle des inscriptions saisies par les candidats (espace responsable)
    path('inscriptions-saisies/', views_inscription_online.liste_inscriptions_saisies, name='liste_inscriptions_saisies'),

    # ── Commission membre ────────────────────────────────────────────────────
    path('commissions/mes-commissions-membre/', views_commission_membre.mes_commissions_membre, name='mes_commissions_membre'),
    path('commissions/ma-commission-principale-membre/', views_commission_membre.ma_commission_principale_membre, name='ma_commission_principale_membre'),
    path('par-commission/<int:commission_id>/', views_commission_membre.get_candidatures_by_commission, name='get_candidatures_by_commission'),

    # ── Générateur PDF officiel ISIMM (GFH FOR 09 v1) ─────────────────────────
    path('documents/generer-pdf/', views_pdf_official.generer_pdf_officiel, name='generer_pdf_officiel'),
    path('documents/verifier-liste/', views_pdf_official.verifier_liste, name='verifier_liste'),
    path('documents/auditer-ocr/', views_pdf_official.auditer_document_ocr, name='auditer_document_ocr'),

    # ── Attestation individuelle + OCR par candidature ─────────────────────────
    path('<int:candidature_id>/generer-pdf/', views_attestation.generer_attestation_pdf, name='generer_attestation_pdf'),
    path('<int:candidature_id>/analyser-ocr/', views_attestation.analyser_ocr_candidature, name='analyser_ocr_candidature'),

    # ── v4 §7 — OCR extraction spécialité + type de diplôme (relevé de notes) ───
    path('ocr/extract/', views_attestation.ocr_extract, name='ocr_extract'),
]


