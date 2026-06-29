"""
Tâches Celery pour traitement asynchrone des documents - Sprint2
Traitement OCR, validation, notifications
"""
from celery import shared_task
from django.utils import timezone
from django.core.mail import send_mail
from django.template.loader import render_to_string
import logging
import os
import PyPDF2
from PIL import Image
import pytesseract

from .models import Document, Candidature, Dossier, Notification

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def traiter_ocr_document(self, document_id):
    """
    Traiter OCR d'un document
    Retry automatique en cas d'erreur (max 3 fois)
    """
    try:
        document = Document.objects.get(id=document_id)
        document.statut = 'en_cours_ocr'
        document.save(update_fields=['statut'])
        
        # Récupérer le chemin du fichier
        fichier_path = document.fichier.path
        
        # Traiter selon le format
        donnees_extraites = {}
        
        if document.format_fichier.lower() == 'pdf':
            donnees_extraites = extraire_texte_pdf(fichier_path)
        elif document.format_fichier.lower() in ['jpg', 'jpeg', 'png', 'tiff']:
            donnees_extraites = extraire_texte_image(fichier_path)
        else:
            raise ValueError(f"Format non supporté: {document.format_fichier}")
        
        # Valider les données extraites
        score_validation = valider_donnees_extraites(donnees_extraites, document)
        
        # Mettre à jour le document
        document.donnees_extraites = donnees_extraites
        document.score_ocr = score_validation
        document.date_traitement_ocr = timezone.now()
        document.statut = 'valide' if score_validation >= 0.7 else 'rejete'
        document.save()
        
        logger.info(
            f"OCR traité: document={document_id}, score={score_validation}, "
            f"candidate={document.candidature.numero}"
        )
        
        # Créer notification
        creer_notification_ocr.delay(document_id)
        
        # Recalculer la complétude du dossier
        recalculer_completude_dossier.delay(document.candidature.pk)
        
        return {
            'success': True,
            'document_id': document_id,
            'score': score_validation,
            'statut': document.statut
        }
        
    except Document.DoesNotExist:
        logger.error(f"Document introuvable: {document_id}")
        return {'error': f'Document {document_id} introuvable'}
    
    except Exception as exc:
        logger.error(f"Erreur OCR (document {document_id}): {str(exc)}")
        
        # Retry après 60 secondes avec backoff exponentiel
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


def extraire_texte_pdf(fichier_path):
    """Extraire le texte d'un PDF"""
    try:
        texte_complet = ""
        metadonnees = {}
        
        with open(fichier_path, 'rb') as pdf_file:
            reader = PyPDF2.PdfReader(pdf_file)
            nb_pages = len(reader.pages)
            
            # Extraire métadonnées
            if reader.metadata:
                metadonnees = {
                    'titre': reader.metadata.get('/Title', ''),
                    'auteur': reader.metadata.get('/Author', ''),
                    'creation': str(reader.metadata.get('/CreationDate', '')),
                }
            
            # Extraire texte de chaque page
            for page_num in range(nb_pages):
                page = reader.pages[page_num]
                texte_complet += page.extract_text()
        
        return {
            'type': 'pdf',
            'texte': texte_complet,
            'nb_pages': nb_pages,
            'metadonnees': metadonnees,
            'date_extraction': timezone.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Erreur extraction PDF: {str(e)}")
        raise


def extraire_texte_image(fichier_path):
    """Extraire le texte d'une image avec Tesseract OCR"""
    try:
        # Ouvrir l'image
        image = Image.open(fichier_path)
        
        # Améliorer l'image pour OCR
        image = image.convert('RGB')
        # Optionnel: redimensionner pour meilleure reconnaissance
        width, height = image.size
        if width < 1000:
            scale = 1000 / width
            image = image.resize(
                (int(width * scale), int(height * scale)),
                Image.Resampling.LANCZOS
            )
        
        # Extraire le texte
        texte = pytesseract.image_to_string(image, lang='fra+eng')
        
        # Extraire les métadonnées EXIF si disponibles
        metadonnees = {}
        try:
            exif_data = image._getexif()
            if exif_data:
                metadonnees = {
                    'largeur': image.width,
                    'hauteur': image.height,
                    'format': image.format,
                }
        except:
            pass
        
        return {
            'type': 'image',
            'texte': texte,
            'dimensions': {'largeur': image.width, 'hauteur': image.height},
            'format': image.format,
            'metadonnees': metadonnees,
            'date_extraction': timezone.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Erreur extraction image: {str(e)}")
        raise


def valider_donnees_extraites(donnees, document):
    """
    Valider les données extraites
    Retourne score 0-1 (1 = valide à 100%)
    """
    score = 0.0
    max_points = 0
    
    # Critère 1: Texte extrait
    if donnees.get('texte'):
        texte_len = len(donnees['texte'])
        # Score basé sur la longueur du texte (100-5000 caractères = bon)
        if texte_len > 100:
            score += 0.3  # 30% du score max pour le texte extrait
            if texte_len > 500:
                score += 0.1  # 10% bonus si vraiment du contenu
        max_points += 0.4
    
    # Critère 2: Métadonnées présentes
    if donnees.get('metadonnees'):
        score += 0.2  # 20% pour métadonnées
    max_points += 0.2
    
    # Critère 3: Format correct
    if donnees.get('type') in ['pdf', 'image']:
        score += 0.2  # 20% pour format valide
    max_points += 0.2
    
    # Critère 4: Pas d'erreur
    if 'erreur' not in donnees:
        score += 0.2  # 20% pour absence d'erreur
    max_points += 0.2
    
    # Normaliser entre 0 et 1
    return round(score / max_points, 2) if max_points > 0 else 0


@shared_task
def creer_notification_ocr(document_id):
    """Créer une notification pour le traitement OCR"""
    try:
        document = Document.objects.select_related('candidature').get(id=document_id)
        candidature = document.candidature
        
        if document.statut == 'valide':
            titre = "✓ Document accepté"
            message = f"Votre document '{document.type_document.get_type_document_display()}' a été validé avec succès."
            type_notif = 'success'
        else:
            titre = "⚠ Document rejeté"
            message = f"Votre document '{document.type_document.get_type_document_display()}' n'a pas pu être validé (score OCR faible)."
            type_notif = 'warning'
        
        Notification.objects.create(
            user=candidature.candidat,
            titre=titre,
            message=message,
            type=type_notif,
            dedup_key=f"ocr_{document_id}"
        )
        
        # Envoyer email
        envoyer_email_ocr.delay(document_id)
        
    except Document.DoesNotExist:
        logger.error(f"Document introuvable pour notification: {document_id}")


@shared_task
def envoyer_email_ocr(document_id):
    """Envoyer email de notification OCR"""
    try:
        document = Document.objects.select_related('candidature', 'candidature__candidat').get(id=document_id)
        candidature = document.candidature
        user = candidature.candidat
        
        context = {
            'candidat_nom': user.get_full_name(),
            'type_document': document.type_document.get_type_document_display(),
            'statut': document.statut,
            'score_ocr': document.score_ocr,
            'candidature_numero': candidature.numero,
        }
        
        if document.statut == 'valide':
            subject = f"[ISIMM] Document accepté - {candidature.numero}"
            template = 'emails/document_accepte.html'
        else:
            subject = f"[ISIMM] Document rejeté - {candidature.numero}"
            template = 'emails/document_rejete.html'
        
        html_message = render_to_string(template, context)
        
        send_mail(
            subject=subject,
            message=f"Statut du document: {document.statut}",
            from_email='noreply@isimm.rnu.tn',
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False
        )
        
        logger.info(f"Email OCR envoyé à {user.email} pour document {document_id}")
        
    except Exception as e:
        logger.error(f"Erreur envoi email OCR: {str(e)}")


@shared_task
def recalculer_completude_dossier(candidature_id):
    """Recalculer la complétude du dossier après validation document"""
    try:
        candidature = Candidature.objects.get(id=candidature_id)
        dossier = Dossier.objects.get(candidature=candidature)
        
        # Recalculer
        completude = dossier.calculer_completude()
        
        logger.info(
            f"Complétude recalculée: candidature={candidature.numero}, "
            f"score={completude:.0f}%"
        )
        
        # Notifier si dossier complet
        if dossier.score_completude >= 100:
            Notification.objects.create(
                user=candidature.candidat,
                titre="✓ Dossier complet",
                message=f"Tous les documents requis ont été validés. Vous pouvez maintenant soumettre votre dossier.",
                type='success',
                dedup_key=f"dossier_complet_{candidature_id}"
            )
        
    except Candidature.DoesNotExist:
        logger.error(f"Candidature introuvable pour recalcul: {candidature_id}")
    except Dossier.DoesNotExist:
        logger.error(f"Dossier introuvable pour recalcul: {candidature_id}")


@shared_task
def verifier_delais_depot_dossier():
    """
    Tâche périodique (cron) pour vérifier les délais de dépôt
    À configurer avec Celery Beat
    """
    now = timezone.now()
    
    # Chercher les candidatures proches du délai
    candidatures = Candidature.objects.filter(
        statut__in=['en_attente_dossier', 'preselectionne'],
        delai_depot_dossier__lt=now,
        dossier_depose=False
    )
    
    for candidature in candidatures:
        # Changer le statut
        ancien_statut = candidature.statut
        candidature.statut = 'dossier_non_depose'
        candidature.ajouter_historique(
            ancien_statut=ancien_statut,
            nouveau_statut='dossier_non_depose',
            user=None,
            commentaire='Délai de dépôt dépassé. Dossier non soumis.'
        )
        candidature.save()
        
        # Envoyer notification
        Notification.objects.create(
            user=candidature.candidat,
            titre="✗ Délai de dépôt dépassé",
            message=f"Vous n'avez pas déposé votre dossier dans les délais pour {candidature.master.nom}",
            type='danger'
        )
        
        logger.info(f"Délai dépassé pour candidature: {candidature.numero}")
    
    return {
        'processed': candidatures.count(),
        'timestamp': now.isoformat()
    }
