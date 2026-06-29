from django.urls import path
from . import views_depot_dossier

urlpatterns = [
    path('requetes/<int:candidature_id>/', views_depot_dossier.DepotDossierViewSet.as_view({'get': 'types_documents_requis'}), name='dossier_types_documents_requis'),
    path('upload/<int:candidature_id>/', views_depot_dossier.DepotDossierViewSet.as_view({'post': 'upload_document'}), name='dossier_upload_document'),
    path('dossier/<int:candidature_id>/', views_depot_dossier.DepotDossierViewSet.as_view({'get': 'consulter_dossier'}), name='dossier_consulter_dossier'),
    path('commission-dossier/<int:candidature_id>/', views_depot_dossier.DepotDossierViewSet.as_view({'get': 'consulter_dossier_commission'}), name='dossier_consulter_dossier_commission'),
    path('soumettre/<int:candidature_id>/', views_depot_dossier.DepotDossierViewSet.as_view({'post': 'soumettre_dossier'}), name='dossier_soumettre_dossier'),
    path('document/<int:document_id>/', views_depot_dossier.DepotDossierViewSet.as_view({'delete': 'supprimer_document'}), name='dossier_supprimer_document'),
    path('mes-dossiers/', views_depot_dossier.liste_mes_dossiers, name='dossier_mes_dossiers'),
]
