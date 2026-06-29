from django.utils import timezone
from django.contrib.auth import get_user_model
from datetime import timedelta
from .models import Candidature, Notification, ConfigurationAppel, MembreCommission
from django.core.mail import send_mail
from django.conf import settings
import logging

logger = logging.getLogger(__name__)
User = get_user_model()


def creer_notification_avec_email(user, titre, message, notif_type='info', dedup_key=None, email_html=None):
    """
    Crée une notification en base de données ET envoie un email au même moment.
    
    Args:
        user: L'utilisateur qui reçoit la notification
        titre: Titre de la notification
        message: Corps du message (notification)
        notif_type: Type de notification (info, success, warning, danger)
        dedup_key: Clé de déduplification pour éviter les doublons
        email_html: HTML pour l'email (optionnel)
    """
    # 1. Créer la notification avec gestion des doublons
    try:
        if dedup_key:
            notification, created = Notification.objects.get_or_create(
                user=user,
                dedup_key=dedup_key,
                defaults={
                    'titre': titre,
                    'message': message,
                    'type': notif_type,
                }
            )
            if not created:
                return  # Notification déjà envoyée
        else:
            notification = Notification.objects.create(
                user=user,
                titre=titre,
                message=message,
                type=notif_type,
            )
    except Exception as e:
        logger.error(f"Erreur création notification pour {user.id}: {e}")
        return
    
    # 2. Envoyer l'email
    try:
        send_mail(
            subject=titre,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=email_html,
            fail_silently=False,
        )
    except Exception as e:
        logger.error(f"Erreur envoi email notification pour {user.id}: {e}")


def envoyer_rappels_j3_preinscription():
    """
    Tâche périodique pour envoyer les notifications J-3 avant deadline préinscription.
    Envoie à TOUS les candidats qui:
    1. Ont une candidature active
    2. Pour un master dont la deadline est dans 3 jours
    """
    today = timezone.now().date()
    deadline_j3 = today + timedelta(days=3)
    
    # Trouver tous les masters dont la deadline de préinscription est dans 3 jours
    configs = ConfigurationAppel.objects.filter(
        date_limite_preinscription=deadline_j3,
        actif=True
    ).select_related('master')
    
    for config in configs:
        # Trouver tous les candidats qui ont une candidature sélectionnée pour ce master
        candidatures = Candidature.objects.filter(
            master=config.master,
            statut__in=['preselectionne', 'selectionne'],  # Les candidats pré-sélectionnés ou sélectionnés reçoivent le rappel
        ).select_related('candidat', 'master')
        
        for candidature in candidatures:
            dedup_key = f"rappel-j3-preinscription-{candidature.id}-{deadline_j3.isoformat()}"
            
            titre = f"⏰ Rappel 3 jours: Deadline préinscription {candidature.master.nom}"
            message = (
                f"Bonjour {candidature.candidat.get_full_name()},\n\n"
                f"Il vous reste 3 jours pour confirmer votre préinscription pour {candidature.master.nom}.\n"
                f"Deadline: {deadline_j3}\n\n"
                "Veuillez finaliser votre dossier avant la date limite.\n\n"
                "Cordialement,\n"
                "ISIMM Admission"
            )
            
            email_html = f"""
            <html>
              <body style="font-family: Arial, sans-serif;">
                <h2>Rappel préinscription</h2>
                <p>Bonjour <strong>{candidature.candidat.get_full_name()}</strong>,</p>
                <p>Il vous reste <strong>3 jours</strong> pour confirmer votre préinscription à:</p>
                <p style="font-size: 16px; color: #E74C3C;"><strong>{candidature.master.nom}</strong></p>
                <p><strong>Deadline:</strong> {deadline_j3.strftime('%d/%m/%Y')}</p>
                <p>Veuillez finaliser votre dossier avant cette date.</p>
                <hr/>
                <p style="color: #999; font-size: 12px;">ISIMM Admission</p>
              </body>
            </html>
            """
            
            creer_notification_avec_email(
                user=candidature.candidat,
                titre=titre,
                message=message,
                notif_type='warning',
                dedup_key=dedup_key,
                email_html=email_html,
            )


def envoyer_rappels_j1_depot_dossier():
    """
    Tâche périodique pour envoyer les notifications J-1 avant deadline dépôt dossier.
    """
    today = timezone.now().date()
    deadline_j1 = today + timedelta(days=1)
    
    configs = ConfigurationAppel.objects.filter(
        date_limite_depot_dossier=deadline_j1,
        actif=True
    ).select_related('master')
    
    for config in configs:
        # Candidats en attente de dépôt dossier
        candidatures = Candidature.objects.filter(
            master=config.master,
            statut='en_attente_dossier',
            dossier_depose=False
        ).select_related('candidat', 'master')
        
        for candidature in candidatures:
            dedup_key = f"rappel-j1-dossier-{candidature.id}-{deadline_j1.isoformat()}"
            
            titre = f"⏰ Urgent: 1 jour pour déposer votre dossier {candidature.master.nom}"
            message = (
                f"Bonjour {candidature.candidat.get_full_name()},\n\n"
                f"Il vous reste 1 jour pour déposer votre dossier numérique pour {candidature.master.nom}.\n"
                f"Deadline: {deadline_j1}\n\n"
                "Connectez-vous au portail pour finaliser votre dépôt.\n\n"
                "Cordialement,\n"
                "ISIMM Admission"
            )
            
            email_html = f"""
            <html>
              <body style="font-family: Arial, sans-serif;">
                <h2 style="color: #E74C3C;">Urgent: Dépôt Dossier</h2>
                <p>Bonjour <strong>{candidature.candidat.get_full_name()}</strong>,</p>
                <p style="color: #E74C3C;"><strong>Il vous reste seulement 1 jour</strong> pour déposer votre dossier numérique!</p>
                <p><strong>Master:</strong> {candidature.master.nom}</p>
                <p><strong>Deadline:</strong> {deadline_j1.strftime('%d/%m/%Y à 23:59')}</p>
                <p>Connectez-vous au portail dès maintenant pour finaliser votre dépôt.</p>
                <hr/>
                <p style="color: #999; font-size: 12px;">ISIMM Admission</p>
              </body>
            </html>
            """
            
            creer_notification_avec_email(
                user=candidature.candidat,
                titre=titre,
                message=message,
                notif_type='danger',
                dedup_key=dedup_key,
                email_html=email_html,
            )


def sync_preinscription_open_notifications():
    """
    Envoyer une notification à tous les candidats quand une préinscription s'ouvre.
    """
    today = timezone.now().date()
    
    # Masters avec préinscription ouverte
    offres_ouvertes = ConfigurationAppel.objects.filter(
        date_debut_visibilite__lte=today,
        date_fin_visibilite__gte=today,
        date_limite_preinscription__gte=today,
        actif=True
    ).select_related('master')
    
    if not offres_ouvertes.exists():
        return
    
    # Envoyer à tous les candidats
    candidates = User.objects.filter(role='candidat')
    
    for candidat in candidates:
        dedup_key = f"offre-ouverte-{today.isoformat()}"
        
        nb_offres = offres_ouvertes.count()
        titre = f"📢 {nb_offres} offre(s) de préinscription disponible(s)"
        message = (
            f"Bonjour {candidat.get_full_name()},\n\n"
            f"{nb_offres} offre(s) de préinscription sont actuellement ouvertes. "
            "Consultez le portail pour postuler.\n\n"
            "Cordialement,\n"
            "ISIMM Admission"
        )
        
        creer_notification_avec_email(
            user=candidat,
            titre=titre,
            message=message,
            notif_type='info',
            dedup_key=dedup_key,
        )


def sync_new_candidature_notification(candidature):
    """
    Envoyer une notification au candidat quand sa candidature est créée.
    """
    dedup_key = f"candidature-created-{candidature.id}"
    
    titre = f"✅ Candidature reçue: {candidature.numero}"
    message = (
        f"Bonjour {candidature.candidat.get_full_name()},\n\n"
        f"Votre candidature {candidature.numero} pour {candidature.master.nom} a bien été reçue.\n"
        f"Numéro de suivi: {candidature.numero}\n\n"
        "Vous pouvez suivre l'évolution de votre candidature depuis votre tableau de bord.\n\n"
        "Cordialement,\n"
        "ISIMM Admission"
    )
    
    email_html = f"""
    <html>
      <body style="font-family: Arial, sans-serif;">
        <h2>Candidature reçue</h2>
        <p>Bonjour <strong>{candidature.candidat.get_full_name()}</strong>,</p>
        <p>Votre candidature a bien été reçue ✅</p>
        <p><strong>Numéro de suivi:</strong> {candidature.numero}</p>
        <p><strong>Master:</strong> {candidature.master.nom}</p>
        <p><strong>Date de soumission:</strong> {timezone.now().strftime('%d/%m/%Y %H:%M')}</p>
        <p>Vous pouvez suivre l'évolution de votre candidature depuis votre tableau de bord.</p>
        <hr/>
        <p style="color: #999; font-size: 12px;">ISIMM Admission</p>
      </body>
    </html>
    """
    
    creer_notification_avec_email(
        user=candidature.candidat,
        titre=titre,
        message=message,
        notif_type='success',
        dedup_key=dedup_key,
        email_html=email_html,
    )


def envoyer_notification_preselection(candidature):
    """
    Envoie une notification au candidat pour confirmer son inscription suite à sa présélection.
    """
    titre = '🎉 Félicitations! Vous avez été présélectionné(e)'
    message = (
        f"Bonjour {candidature.candidat.get_full_name()},\n\n"
        f"Nous sommes heureux de vous informer que vous avez été présélectionné(e) "
        f"pour le concours {candidature.master.nom}.\n\n"
        f"Veuillez confirmer votre inscription pour procéder à l'étape suivante.\n\n"
        f"Numéro de suivi: {candidature.numero}\n\n"
        "Connectez-vous à votre tableau de bord pour confirmer votre inscription.\n\n"
        "Cordialement,\n"
        "ISIMM Admission"
    )

    email_html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <div style="background-color: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: 20px auto;">
          <h2 style="color: #27ae60;">🎉 Félicitations!</h2>
          <p>Bonjour <strong>{candidature.candidat.get_full_name()}</strong>,</p>
          <p style="font-size: 16px;">Nous sommes heureux de vous informer que vous avez été <strong>présélectionné(e)</strong> pour:</p>
          <div style="background-color: #f0f8ff; padding: 15px; border-left: 4px solid #27ae60; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Master/Concours:</strong> {candidature.master.nom}</p>
            <p style="margin: 5px 0;"><strong>Numéro de suivi:</strong> {candidature.numero}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> {timezone.now().strftime('%d/%m/%Y')}</p>
          </div>
          <p style="font-size: 16px; color: #c0392b;"><strong>Action requise:</strong> Veuillez confirmer votre inscription au plus tôt pour procéder à l'étape suivante.</p>
          <p><a href="http://localhost:4200/dashboard-candidat" style="background-color: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Accéder à mon tableau de bord</a></p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;"/>
          <p style="color: #999; font-size: 12px;">ISIMM Admission - Portail des Admissions</p>
        </div>
      </body>
    </html>
    """

    dedup_key = f"preselection-{candidature.id}"

    creer_notification_avec_email(
        user=candidature.candidat,
        titre=titre,
        message=message,
        notif_type='success',
        dedup_key=dedup_key,
        email_html=email_html,
    )
