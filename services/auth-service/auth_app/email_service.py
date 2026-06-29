from django.core.mail import send_mail
from django.conf import settings
from django.utils.html import strip_tags

def send_verification_email(user):
    """Envoyer email de vérification"""
    subject = 'Vérifiez votre email - ISIMM'
    verification_url = f"{settings.FRONTEND_URL}/verify-email/{user.email_verification_token}"
    
    html_message = f"""
    <h2>Bienvenue {user.first_name} !</h2>
    <p>Cliquez sur ce lien pour vérifier votre email :</p>
    <a href="{verification_url}">Vérifier mon email</a>
    <p>Lien : {verification_url}</p>
    """
    
    plain_message = strip_tags(html_message)
    
    send_mail(
        subject,
        plain_message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        html_message=html_message,
        fail_silently=False,
    )
    print(f"📧 Email envoyé à {user.email}")

def send_login_notification(user, ip_address=None):
    """Notification de connexion"""
    subject = 'Nouvelle connexion - ISIMM'
    
    html_message = f"""
    <h2>Nouvelle connexion détectée</h2>
    <p>Bonjour {user.first_name},</p>
    <p>Une connexion a été détectée sur votre compte.</p>
    <p>Date : {user.last_login}</p>
    <p>IP : {ip_address or 'Non disponible'}</p>
    """
    
    plain_message = strip_tags(html_message)
    
    send_mail(
        subject,
        plain_message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        html_message=html_message,
        fail_silently=False,
    )
    print(f"📧 Notification envoyée à {user.email}")