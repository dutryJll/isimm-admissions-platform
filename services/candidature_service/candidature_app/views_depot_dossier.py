"""
Views pour la gestion du dépôt de dossier - Sprint2
Endpoints pour upload, traitement OCR, validation et consultation
"""
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.utils import timezone
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.db import transaction
from celery import shared_task
import logging

from .models import (
    Document, DocumentType, ValidationDocument, Dossier, 
    Candidature, Master, MembreCommission
)
from .serializers_documents import (
    DocumentSerializer,
    DocumentTypeSerializer,
    DocumentUploadSerializer,
    DossierSerializer,
    DetailedDossierSerializer,
    ValidationDocumentSerializer,
)
from .ocr_service import verifier_concordance_dossier

logger = logging.getLogger(__name__)


class DepotDossierViewSet(viewsets.ViewSet):
    """ViewSet pour la gestion complète du dépôt de dossier"""
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def _can_access_commission_dossier(self, request, candidature):
        user = request.user
        role = getattr(user, 'role', None)
        if role in ['admin', 'responsable_commission']:
            return True
        if candidature.candidat_id == user.id:
            return True
        return MembreCommission.objects.filter(
            user=user,
            actif=True,
            commission__actif=True,
            commission__master_id=candidature.master_id,
        ).exists()
    
    @action(detail=False, methods=['get'], url_path='requetes/(?P<candidature_id>\\d+)')
    def types_documents_requis(self, request, candidature_id=None):
        """Obtenir les types de documents requis pour une candidature"""
        candidature = get_object_or_404(Candidature, pk=candidature_id, candidat=request.user)
        
        types_docs = DocumentType.objects.filter(master=candidature.master)
        serializer = DocumentTypeSerializer(types_docs, many=True)
        
        return Response({
            'candidature_numero': candidature.numero,
            'master_nom': candidature.master.nom,
            'types_documents': serializer.data,
            'nombre_requis': types_docs.filter(obligatoire=True).count()
        })
    
    @action(detail=False, methods=['post'], url_path='upload/(?P<candidature_id>\\d+)')
    def upload_document(self, request, candidature_id=None):
        """Uploader un document pour une candidature"""
        candidature = get_object_or_404(Candidature, pk=candidature_id, candidat=request.user)
        
        # Vérifier que la candidature est dans un statut valide
        if candidature.statut not in ['preselectionne', 'en_attente_dossier']:
            return Response({
                'error': 'Candidature non présélectionnée'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Vérifier la date limite
        if candidature.delai_depot_dossier and timezone.now().date() > candidature.delai_depot_dossier:
            return Response({
                'error': 'Date limite dépassée'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = DocumentUploadSerializer(
            data=request.data,
            context={'candidature': candidature}
        )
        
        if serializer.is_valid():
            document = serializer.save()
            
            # Lancer le traitement OCR asynchrone
            if getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
                traiter_document_ocr_async(document.id)
            
            logger.info(f"Document uploadé: {document.id} pour candidature {candidature.numero}")
            
            return Response({
                'success': True,
                'document': DocumentSerializer(document).data,
                'message': 'Document téléversé. OCR en cours'
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'], url_path='dossier/(?P<candidature_id>\\d+)')
    def consulter_dossier(self, request, candidature_id=None):
        """Consulter l'état du dossier"""
        candidature = get_object_or_404(Candidature, pk=candidature_id, candidat=request.user)
        
        dossier = get_object_or_404(Dossier, candidature=candidature)
        dossier.calculer_completude()
        serializer = DetailedDossierSerializer(dossier)
        
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='commission-dossier/(?P<candidature_id>\\d+)')
    def consulter_dossier_commission(self, request, candidature_id=None):
        """Consulter un dossier en lecture seule depuis la commission."""
        candidature = get_object_or_404(Candidature.objects.select_related('candidat', 'master'), pk=candidature_id)
        if not self._can_access_commission_dossier(request, candidature):
            return Response({'error': 'Non autorise'}, status=status.HTTP_403_FORBIDDEN)

        dossier = get_object_or_404(Dossier, candidature=candidature)
        dossier.calculer_completude()
        serializer = DetailedDossierSerializer(dossier, context={'request': request})

        return Response({
            'success': True,
            'dossier': serializer.data,
            'candidature': {
                'id': candidature.id,
                'numero': candidature.numero,
                'nom_complet': candidature.candidat.get_full_name(),
                'email': candidature.candidat.email,
                'cin': getattr(candidature.candidat, 'cin', ''),
                'score': candidature.score,
                'statut': candidature.statut,
                'master_nom': candidature.master.nom if candidature.master else '',
                'type_concours': 'ingenieur' if candidature.concours_id else 'masters',
            },
        })
    
    @action(detail=False, methods=['post'], url_path='soumettre/(?P<candidature_id>\\d+)')
    def soumettre_dossier(self, request, candidature_id=None):
        """Soumettre/finalisé le dossier"""
        candidature = get_object_or_404(Candidature, pk=candidature_id, candidat=request.user)
        dossier = get_object_or_404(Dossier, candidature=candidature)
        
        # Recalculer la complétude
        completude = dossier.calculer_completude()
        
        if dossier.score_completude < 100:
            return Response({
                'error': 'Dossier incomplet',
                'details': {
                    'documents_attendus': dossier.nb_documents_attendus,
                    'documents_soumis': dossier.nb_documents_soumis,
                    'documents_valides': candidature.documents.filter(statut='valide').count(),
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            dossier.date_depot = timezone.now()
            dossier.statut = 'soumis'
            dossier.save()
            
            # Mettre à jour la candidature
            candidature.statut = 'dossier_depose'
            candidature.date_depot_dossier = timezone.now()
            candidature.dossier_depose = True
            candidature.ajouter_historique(
                ancien_statut='en_attente_dossier',
                nouveau_statut='dossier_depose',
                user=request.user,
                commentaire='Dossier soumis par le candidat'
            )
            candidature.save()

        logger.info(f"Dossier soumis: candidature {candidature.numero}")
        
        return Response({
            'success': True,
            'message': 'Dossier soumis ✓',
            'dossier': {
                'id': dossier.id,
                'candidature_numero': candidature.numero,
                'statut': 'soumis',
                'score_completude': float(dossier.score_completude),
                'nb_documents_attendus': dossier.nb_documents_attendus,
                'nb_documents_soumis': dossier.nb_documents_soumis,
            }
        })
    
    @action(detail=False, methods=['put'], url_path='ajuster/(?P<candidature_id>\\d+)')
    def ajuster_dossier(self, request, candidature_id=None):
        """Ajuster le dossier avant déadline"""
        candidature = get_object_or_404(Candidature, pk=candidature_id, candidat=request.user)
        dossier = get_object_or_404(Dossier, candidature=candidature)
        
        # Vérifier que c'est encore modifiable
        if timezone.now() > dossier.date_limite_depot:
            # Vérifier s'il y a une prolongation
            if not candidature.prolongation_delai:
                return Response({
                    'error': 'Modification expirée'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # Traiter les documents à ajouter/modifier
        if 'documents_a_remplacer' in request.data:
            doc_ids = request.data.getlist('documents_a_remplacer')
            Document.objects.filter(id__in=doc_ids, candidature=candidature).delete()
        
        # Uploader les nouveaux documents
        if 'files' in request.FILES:
            for fichier in request.FILES.getlist('files'):
                type_doc_id = request.data.get('type_document')
                if type_doc_id:
                    type_doc = get_object_or_404(DocumentType, id=type_doc_id)
                    # Créer le document
                    # ... (utiliser la même logique que upload_document)
        
        dossier.date_derniere_modification = timezone.now()
        dossier.save()
        
        return Response({
            'success': True,
            'message': 'Dossier ajusté ✓',
            'dossier': DetailedDossierSerializer(dossier).data
        })
    
    @action(detail=False, methods=['delete'], url_path='document/(?P<document_id>\\d+)')
    def supprimer_document(self, request, document_id=None):
        """Supprimer un document du dossier"""
        document = get_object_or_404(Document, pk=document_id)
        candidature = document.candidature
        
        # Vérifier les droits
        if candidature.candidat != request.user:
            return Response({
                'error': 'Non autorisé'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Vérifier que le dossier n'est pas finalisé
        dossier = get_object_or_404(Dossier, candidature=candidature)
        if dossier.statut in ['soumis', 'en_verification']:
            return Response({
                'error': 'Suppression impossible'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Supprimer le fichier
        if document.fichier:
            document.fichier.delete()
        
        document.delete()
        
        # Recalculer la complétude
        dossier.calculer_completude()
        
        return Response({
            'success': True,
            'message': 'Document supprimé ✓',
            'dossier': DetailedDossierSerializer(dossier).data
        })


# Tâche Celery pour traitement OCR asynchrone
@shared_task
def traiter_document_ocr_async(document_id):
    """Traiter OCR d'un document de manière asynchrone"""
    try:
        document = Document.objects.get(id=document_id)
        document.statut = 'en_cours_ocr'
        document.celery_task_id = traiter_document_ocr_async.request.id
        document.save()
        
        # Utiliser l'assistant OCR heuristique disponible dans ce codebase.
        resultat_ocr = verifier_concordance_dossier(document.candidature, {'documents': [document.type_document.type_document]})
        donnees_extraites = resultat_ocr if isinstance(resultat_ocr, dict) else {}
        score_ocr = 1.0 if isinstance(resultat_ocr, dict) and resultat_ocr.get('validation_auto') else 0.0
        
        # Mettre à jour le document
        document.donnees_extraites = donnees_extraites
        document.score_ocr = score_ocr
        document.date_traitement_ocr = timezone.now()
        document.statut = 'valide' if score_ocr >= 0.7 else 'rejete'
        document.save()
        
        logger.info(f"OCR traité pour document {document_id}: score={score_ocr}")
        
        # Créer la validation
        ValidationDocument.objects.get_or_create(document=document)
        
    except Exception as e:
        logger.error(f"Erreur OCR pour document {document_id}: {str(e)}")
        Document.objects.filter(id=document_id).update(
            statut='erreur_ocr',
            erreur_ocr=str(e)
        )


# API Views simplifiées
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def liste_mes_dossiers(request):
    """Lister tous les dossiers de l'utilisateur"""
    candidatures = request.user.candidatures.filter(
        statut__in=['preselectionne', 'en_attente_dossier', 'dossier_depose']
    )
    
    dossiers = Dossier.objects.filter(candidature__in=candidatures)
    serializer = DetailedDossierSerializer(dossiers, many=True)
    
    return Response({
        'count': dossiers.count(),
        'dossiers': serializer.data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def statut_dossier(request, candidature_id):
    """Obtenir le statut d'un dossier"""
    candidature = get_object_or_404(Candidature, pk=candidature_id, candidat=request.user)
    dossier = get_object_or_404(Dossier, candidature=candidature)
    
    serializer = DetailedDossierSerializer(dossier)
    return Response(serializer.data)
