import logging

from django.core.mail import send_mail, EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)

def envoyer_email_confirmation_candidature(candidature):
    """Email de confirmation après soumission"""
    subject = f"Confirmation de candidature - {candidature.master.nom}"
    
    html_message = render_to_string('emails/confirmation_candidature.html', {
        'candidat': candidature.candidat,
        'candidature': candidature,
        'master': candidature.master,
        'date_limite': candidature.date_limite_modification.strftime('%d/%m/%Y à %H:%M')
    })
    
    plain_message = strip_tags(html_message)
    
    send_mail(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[candidature.candidat.email],
        html_message=html_message,
        fail_silently=False
    )
    
    candidature.notification_envoyee = True
    candidature.save()


def envoyer_email_changement_statut(candidature, ancien_statut, nouveau_statut):
    """Email lors du changement de statut"""
    subject = f"Mise à jour de votre candidature - {candidature.master.nom}"
    
    messages_statut = {
        'sous_examen': 'Votre candidature est en cours d\'examen par la commission.',
        'preselectionne': 'Félicitations ! Vous avez été présélectionné(e).',
        'rejete': 'Malheureusement, votre candidature n\'a pas été retenue.',
        'selectionne': 'Félicitations ! Vous avez été sélectionné(e) pour une admission.',
        'en_attente_dossier': 'Vous êtes invité(e) à déposer votre dossier numérique.',
    }
    
    site_url = getattr(settings, 'SITE_URL', 'https://isimm.example.com')

    html_message = render_to_string('emails/changement_statut.html', {
        'candidat': candidature.candidat,
        'candidature': candidature,
        'master': candidature.master,
        'ancien_statut': ancien_statut,
        'nouveau_statut': nouveau_statut,
        'message': messages_statut.get(nouveau_statut, 'Votre candidature a été mise à jour.'),
        'site_url': site_url,
    })
    
    plain_message = strip_tags(html_message)
    
    send_mail(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[candidature.candidat.email],
        html_message=html_message,
        fail_silently=False
    )


def envoyer_notification_liste_publiee(candidat_liste):
    """Envoyer notification de publication de liste"""
    from datetime import timedelta
    
    candidature = candidat_liste.candidature
    candidat = candidature.candidat
    liste = candidat_liste.liste
    master = liste.master
    
    if liste.type_liste == 'principale':
        subject = f"✅ FÉLICITATIONS - Vous êtes ADMIS(E) au {master.nom}"
    else:
        subject = f"📋 Liste d'attente - {master.nom}"
    
    date_limite_paiement = liste.date_publication + timedelta(days=7)
    
    context = {
        'candidat': candidat,
        'candidature': candidature,
        'master': master,
        'liste': liste,
        'type_liste': liste.type_liste,
        'position': candidat_liste.position,
        'score': candidat_liste.score,
        'iteration': liste.iteration,
        'date_publication': liste.date_publication.strftime('%d/%m/%Y à %H:%M'),
        'date_limite_paiement': date_limite_paiement.strftime('%d/%m/%Y')
    }
    
    html_message = render_to_string('emails/notification_liste_publiee.html', context)
    plain_message = strip_tags(html_message)
    
    email = EmailMultiAlternatives(
        subject=subject,
        body=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[candidat.email]
    )
    email.attach_alternative(html_message, "text/html")
    
    try:
        email.send(fail_silently=False)
        return True
    except Exception as e:
        print(f"Erreur envoi email à {candidat.email}: {e}")
        return False


def envoyer_notifications_masse(liste_admission):
    """Envoyer notifications à tous les candidats d'une liste"""
    candidats_listes = liste_admission.candidats.all()
    
    resultats = {
        'envoyes': 0,
        'echoues': 0,
        'total': candidats_listes.count()
    }
    
    for candidat_liste in candidats_listes:
        if envoyer_notification_liste_publiee(candidat_liste):
            resultats['envoyes'] += 1
        else:
            resultats['echoues'] += 1
    
    return resultats


def envoyer_email_inscription_validee(inscription):
    """Email de confirmation après validation du paiement d'inscription."""
    candidature = inscription.candidature
    candidat = candidature.candidat

    subject = f"Confirmation d'inscription validee - {candidature.master.nom}"
    message = (
        f"Bonjour {candidat.get_full_name() or candidat.username},\n\n"
        f"Votre paiement pour la candidature {candidature.numero} a ete valide.\n"
        f"Formation: {candidature.master.nom}\n"
        f"Reference paiement: {inscription.reference_paiement or '-'}\n"
        f"Montant: {inscription.montant_paye}\n\n"
        "Votre statut est maintenant: Inscrit.\n"
        "Cordialement,\n"
        "ISIMM Admission"
    )

    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[candidat.email],
        fail_silently=False,
    )

    return True


def envoyer_email_preselection_admis(candidature):
    """Email stylisé envoyé au candidat présélectionné avec instructions pour la phase d'audit."""
    candidat = candidature.candidat
    master = candidature.master
    site_url = getattr(settings, 'SITE_URL', 'https://isimm.example.com')

    subject = f"\U0001f389 Félicitations ! Vous êtes présélectionné(e) — {master.nom}"

    html_message = f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:32px 40px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;">\U0001f389 Félicitations !</h1>
      <p style="color:#bfdbfe;margin:8px 0 0;font-size:15px;">ISIMM — Institut Supérieur de l'Informatique et des Mathématiques de Monastir</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="font-size:16px;color:#1e293b;">Bonjour <strong>{candidat.get_full_name() or candidat.username}</strong>,</p>
      <p style="color:#374151;line-height:1.7;">Nous avons le plaisir de vous informer que votre candidature au programme <strong>{master.nom}</strong> a été présélectionnée pour la phase d'audit.</p>
      <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:16px 20px;border-radius:0 8px 8px 0;margin:24px 0;">
        <p style="margin:0;font-weight:600;color:#1e40af;font-size:15px;">\U0001f4c2 Prochaine étape : Dépôt du dossier numérique</p>
      </div>
      <p style="color:#374151;line-height:1.7;">Pour confirmer votre candidature, déposez les documents suivants dans votre espace candidat avant la date limite :</p>
      <ul style="color:#374151;line-height:2;">
        <li>Relevé de notes (Licence ou équivalent)</li>
        <li>Diplôme ou attestation de réussite</li>
        <li>Copie de la CIN</li>
        <li>Photo d'identité récente</li>
        <li>Tout document complémentaire mentionné dans l'appel</li>
      </ul>
      <div style="text-align:center;margin:32px 0;">
        <a href="{site_url}" style="background:#3b82f6;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Accéder à mon espace candidat</a>
      </div>
      <p style="color:#6b7280;font-size:13px;">Numéro de candidature : <strong>{candidature.numero}</strong></p>
      <p style="color:#374151;line-height:1.7;">Cordialement,<br><strong>Commission d'admission — ISIMM</strong></p>
    </div>
    <div style="background:#f8fafc;padding:16px 40px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">© ISIMM. Ce message est confidentiel.</p>
    </div>
  </div>
</body>
</html>"""

    plain_message = (
        f"Bonjour {candidat.get_full_name() or candidat.username},\n\n"
        f"Félicitations ! Votre candidature au programme {master.nom} a été présélectionnée.\n\n"
        "Prochaine étape : Dépôt du dossier numérique.\n"
        "Connectez-vous à votre espace candidat pour déposer vos documents.\n\n"
        f"Numéro de candidature : {candidature.numero}\n\n"
        "Cordialement,\nCommission d'admission — ISIMM"
    )

    email = EmailMultiAlternatives(
        subject=subject,
        body=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[candidat.email],
    )
    email.attach_alternative(html_message, "text/html")
    try:
        email.send(fail_silently=False)
        return True
    except Exception:
        logger.exception(
            "Erreur envoi email présélection admis candidature=%s", candidature.numero
        )
        return False


def envoyer_email_preselection_refuse(candidature):
    """Email de refus poli après la session de présélection."""
    candidat = candidature.candidat
    master = candidature.master

    subject = f"Résultat de votre candidature — {master.nom}"

    html_message = f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#475569,#64748b);padding:32px 40px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">Résultat de candidature</h1>
      <p style="color:#cbd5e1;margin:8px 0 0;font-size:15px;">ISIMM — Institut Supérieur de l'Informatique et des Mathématiques de Monastir</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="font-size:16px;color:#1e293b;">Bonjour <strong>{candidat.get_full_name() or candidat.username}</strong>,</p>
      <p style="color:#374151;line-height:1.7;">Nous vous remercions sincèrement de l'intérêt que vous avez porté au programme <strong>{master.nom}</strong> de l'ISIMM.</p>
      <p style="color:#374151;line-height:1.7;">Après examen attentif de votre dossier par la commission d'admission, nous avons le regret de vous informer que votre candidature n'a pas été retenue lors de cette session de présélection.</p>
      <p style="color:#374151;line-height:1.7;">Cette décision a été prise dans un contexte de forte concurrence et ne remet pas en cause la qualité de votre parcours académique.</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:16px 20px;border-radius:8px;margin:24px 0;">
        <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">\U0001f4a1 Nous vous encourageons à consulter les prochains appels à candidature sur notre plateforme et à retenter votre chance lors des sessions futures.</p>
      </div>
      <p style="color:#374151;line-height:1.7;">Nous vous souhaitons plein succès dans la poursuite de votre parcours et de vos projets professionnels.</p>
      <p style="color:#374151;">Cordialement,<br><strong>Commission d'admission — ISIMM</strong></p>
    </div>
    <div style="background:#f8fafc;padding:16px 40px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">© ISIMM. Ce message est confidentiel.</p>
    </div>
  </div>
</body>
</html>"""

    plain_message = (
        f"Bonjour {candidat.get_full_name() or candidat.username},\n\n"
        f"Nous vous remercions de l'intérêt porté au programme {master.nom}.\n\n"
        "Après examen de votre dossier, nous regrettons de vous informer que votre candidature "
        "n'a pas été retenue lors de cette session de présélection.\n\n"
        "Nous vous souhaitons plein succès dans vos projets.\n\n"
        "Cordialement,\nCommission d'admission — ISIMM"
    )

    email = EmailMultiAlternatives(
        subject=subject,
        body=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[candidat.email],
    )
    email.attach_alternative(html_message, "text/html")
    try:
        email.send(fail_silently=False)
        return True
    except Exception:
        logger.exception(
            "Erreur envoi email présélection refus candidature=%s", candidature.numero
        )
        return False


def envoyer_rappel_deadline_j3(candidature, jours_restants):
    """Email de rappel a J-3 (ou moins) avant la deadline de modification/depot."""
    candidat = candidature.candidat
    master = candidature.master

    subject = f"Rappel deadline: {jours_restants} jour(s) restant(s) - {master.nom}"
    message = (
        f"Bonjour {candidat.get_full_name() or candidat.username},\n\n"
        f"Votre candidature {candidature.numero} ({master.nom}) arrive bientot a echeance.\n"
        f"Il vous reste {jours_restants} jour(s) avant la deadline.\n"
        "Merci de finaliser vos actions dans les delais.\n\n"
        "Cordialement,\n"
        "ISIMM Admission"
    )

    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[candidat.email],
        fail_silently=False,
    )

    return True