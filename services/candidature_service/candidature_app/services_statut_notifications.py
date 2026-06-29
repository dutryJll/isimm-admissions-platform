
import logging
from typing import Dict, Optional, List
from django.utils import timezone
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings

from .models import Candidature, StatusHistory, Notification, NotificationQueue, User

logger = logging.getLogger(__name__)


class StatutNotificationService:
    """Service principal pour gérer statuts et notifications."""
    
    # Messages de notification par type de changement de statut
    STATUS_MESSAGES = {
        'soumis': {
            'title': 'Candidature soumise',
            'message': 'Votre candidature a été soumise avec succès.',
            'type': 'success',
            'email_template': 'candidature_soumis.html'
        },
        'sous_examen': {
            'title': 'Candidature en examen',
            'message': 'Votre candidature est en cours d\'examen par la commission.',
            'type': 'info',
            'email_template': 'candidature_sous_examen.html'
        },
        'preselectionne': {
            'title': '🎉 Vous êtes présélectionné!',
            'message': 'Félicitations! Vous avez été présélectionné. Veuillez déposer votre dossier numérique.',
            'type': 'success',
            'email_template': 'candidature_preselectionne.html'
        },
        'en_attente_dossier': {
            'title': 'Dossier numérique attendu',
            'message': 'Veuillez déposer votre dossier numérique avant la date limite.',
            'type': 'warning',
            'email_template': 'candidature_attente_dossier.html'
        },
        'dossier_depose': {
            'title': 'Dossier reçu',
            'message': 'Votre dossier numérique a été reçu avec succès.',
            'type': 'success',
            'email_template': 'candidature_dossier_depose.html'
        },
        'selectionne': {
            'title': '✅ Vous êtes admis!',
            'message': 'Félicitations! Vous avez été sélectionné/admis. Veuillez finaliser votre inscription.',
            'type': 'success',
            'email_template': 'candidature_selectionne.html'
        },
        'rejete': {
            'title': '❌ Candidature rejetée',
            'message': 'Votre candidature n\'a pas été retenue à cette étape.',
            'type': 'danger',
            'email_template': 'candidature_rejete.html'
        },
        'annule': {
            'title': 'Candidature annulée',
            'message': 'Votre candidature a été annulée.',
            'type': 'danger',
            'email_template': 'candidature_annule.html'
        },
    }
    
    @staticmethod
    def changer_statut(
        candidature: Candidature,
        nouveau_statut: str,
        raison: str = '',
        changed_by: Optional[User] = None,
        envoyer_notification: bool = True,
    ) -> StatusHistory:
        """
        Changer le statut d'une candidature et envoyer les notifications appropriées.
        
        Args:
            candidature: Instance de Candidature
            nouveau_statut: Nouveau statut (doit être dans Candidature.STATUT_CHOICES)
            raison: Raison du changement (optionnel)
            changed_by: Utilisateur qui fait le changement (optionnel)
            envoyer_notification: Envoyer les notifications (True par défaut)
        
        Returns:
            Instance de StatusHistory créée
        """
        if nouveau_statut not in dict(Candidature.STATUT_CHOICES):
            raise ValueError(f"Statut invalide: {nouveau_statut}")
        
        ancien_statut = candidature.statut
        
        # Créer l'enregistrement d'historique
        status_history = StatusHistory.objects.create(
            candidature=candidature,
            ancien_statut=ancien_statut,
            nouveau_statut=nouveau_statut,
            raison=raison,
            changed_by=changed_by,
        )
        
        # Mettre à jour la candidature
        candidature.statut = nouveau_statut
        candidature.date_changement_statut = timezone.now()
        candidature._skip_status_signal = True
        candidature.save(update_fields=['statut', 'date_changement_statut'])
        
        logger.info(
            f"Statut changé pour candidature {candidature.numero}: "
            f"{ancien_statut} → {nouveau_statut}",
            extra={
                'candidature_id': candidature.id,
                'raison': raison,
                'changed_by_id': changed_by.id if changed_by else None,
            }
        )
        
        # Envoyer les notifications
        if envoyer_notification:
            StatutNotificationService._envoyer_notifications(
                candidature,
                nouveau_statut,
                status_history
            )
        
        return status_history
    
    @staticmethod
    def _envoyer_notifications(
        candidature: Candidature,
        nouveau_statut: str,
        status_history: StatusHistory,
    ) -> None:
        """
        Envoyer les notifications (in-app + email) pour un changement de statut.
        
        Args:
            candidature: Instance de Candidature
            nouveau_statut: Le nouveau statut
            status_history: Instance de StatusHistory créée
        """
        message_config = StatutNotificationService.STATUS_MESSAGES.get(
            nouveau_statut,
            {
                'title': 'Changement de statut',
                'message': f'Votre candidature a changé de statut: {nouveau_statut}',
                'type': 'info'
            }
        )
        
        # 1. Créer/Mettre à jour la notification in-app (dedup_key UNIQUE)
        notification, _created = Notification.objects.update_or_create(
            user=candidature.candidat,
            dedup_key=f"candidature_{candidature.id}_{nouveau_statut}",
            defaults={
                'titre': message_config['title'],
                'message': message_config['message'],
                'type': message_config['type'],
            },
        )
        
        status_history.notification_envoyee = True
        status_history.save(update_fields=['notification_envoyee'])
        
        logger.info(
            f"Notification in-app créée pour candidature {candidature.numero}",
            extra={'notification_id': notification.id}
        )
        
        # 2. Créer l'entrée dans la queue d'emails
        try:
            StatutNotificationService._creer_email_notification(
                candidature,
                notification,
                message_config
            )
        except Exception as e:
            logger.error(
                f"Erreur lors de la création de la notification email: {str(e)}",
                extra={'candidature_id': candidature.id},
                exc_info=True
            )
    
    @staticmethod
    def _creer_email_notification(
        candidature: Candidature,
        notification: Notification,
        message_config: Dict,
    ) -> NotificationQueue:
        """
        Créer une entrée dans la queue d'emails pour envoi asynchrone.
        
        Args:
            candidature: Instance de Candidature
            notification: Instance de Notification créée
            message_config: Configuration du message
        
        Returns:
            Instance de NotificationQueue créée
        """
        user = candidature.candidat
        
        # Contexte pour le template email
        context = {
            'candidat_nom': user.get_full_name() or user.username,
            'master_nom': candidature.master.nom,
            'candidature_numero': candidature.numero,
            'statut': candidature.get_statut_display(),
            'date': timezone.now().strftime('%d/%m/%Y %H:%M'),
            'site_url': settings.SITE_URL if hasattr(settings, 'SITE_URL') else 'https://isimm.tn'
        }
        
        # Renderer le template HTML
        template_name = f'notifications/{message_config.get("email_template", "candidature_default.html")}'
        try:
            body_html = render_to_string(template_name, context)
        except:
            body_html = f"<p>{message_config['message']}</p>"
        
        # Créer la queue entry
        queue_entry = NotificationQueue.objects.create(
            notification=notification,
            email=user.email,
            subject=message_config['title'],
            body_text=message_config['message'],
            body_html=body_html,
            status='pending'
        )
        
        logger.info(
            f"Email ajouté à la queue pour candidature {candidature.numero}",
            extra={'queue_id': queue_entry.id}
        )
        
        return queue_entry
    
    @staticmethod
    def recuperer_historique_statuts(candidature: Candidature) -> List[Dict]:
        """
        Récupérer l'historique complet des changements de statut.
        
        Args:
            candidature: Instance de Candidature
        
        Returns:
            Liste des changements de statut formatés
        """
        history = StatusHistory.objects.filter(candidature=candidature).values(
            'id',
            'ancien_statut',
            'nouveau_statut',
            'raison',
            'date_changement',
            'changed_by__username',
            'notification_envoyee'
        ).order_by('-date_changement')
        
        return list(history)
    
    @staticmethod
    def envoyer_emails_en_attente() -> Dict[str, int]:
        """
        Envoyer tous les emails en attente de la queue.
        À appeler régulièrement (celery task ou cron job).
        
        Returns:
            Dictionnaire avec statistiques d'envoi
        """
        stats = {'sent': 0, 'failed': 0, 'total': 0}
        
        # Récupérer les emails en attente avec retry <= 3
        pending_emails = NotificationQueue.objects.filter(
            status='pending',
            retry_count__lt=3
        ).order_by('created_at')[:100]  # Traiter max 100 à la fois
        
        stats['total'] = pending_emails.count()
        
        for queue_entry in pending_emails:
            try:
                # Envoyer l'email
                send_mail(
                    subject=queue_entry.subject,
                    message=queue_entry.body_text,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[queue_entry.email],
                    fail_silently=False,
                    html_message=queue_entry.body_html,
                )
                
                # Marquer comme envoyé
                queue_entry.status = 'sent'
                queue_entry.sent_at = timezone.now()
                queue_entry.save(update_fields=['status', 'sent_at'])
                
                stats['sent'] += 1
                
                logger.info(
                    f"Email envoyé avec succès: {queue_entry.email}",
                    extra={'queue_id': queue_entry.id}
                )
                
            except Exception as e:
                # Marquer comme échouée et incrémenter retry_count
                queue_entry.retry_count += 1
                queue_entry.error_message = str(e)
                
                if queue_entry.retry_count >= 3:
                    queue_entry.status = 'failed'
                
                queue_entry.save(update_fields=['retry_count', 'error_message', 'status'])
                stats['failed'] += 1
                
                logger.error(
                    f"Erreur lors de l'envoi d'email: {str(e)}",
                    extra={'queue_id': queue_entry.id},
                    exc_info=True
                )
        
        return stats
