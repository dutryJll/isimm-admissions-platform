from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from django.utils import timezone

from .models import Candidature, Notification
from .emails import envoyer_email_changement_statut


@receiver(pre_save, sender=Candidature)
def candidature_pre_save(sender, instance, **kwargs):
	"""Store the previous statut on the instance before saving."""
	if instance.pk:
		try:
			previous = Candidature.objects.get(pk=instance.pk)
			instance._old_statut = previous.statut
		except Candidature.DoesNotExist:
			instance._old_statut = None
	else:
		instance._old_statut = None


@receiver(post_save, sender=Candidature)
def candidature_post_save(sender, instance, created, **kwargs):
	"""Send an email and create notification when the `statut` field changes.

	Uses `envoyer_email_changement_statut` defined in `emails.py` and creates a Notification entry.
	"""
	# Do not notify on creation
	if created:
		return

	# Skip duplicate notifications when the workflow service already handled them.
	if getattr(instance, '_skip_status_signal', False):
		return

	ancien = getattr(instance, '_old_statut', None)
	nouveau = instance.statut

	if ancien != nouveau:
		# 1. Send email notification
		try:
			envoyer_email_changement_statut(instance, ancien, nouveau)
		except Exception as e:
			# Avoid raising errors during save; log to stdout for now
			print(f"Erreur lors de l'envoi de l'email de changement de statut: {e}")

		# 2. Create in-app notification (Point 2: notification hook)
		try:
			status_messages = {
				'soumis': 'Votre candidature a été soumise.',
				'sous_examen': 'Votre candidature est sous examen.',
				'preselectionne': 'Félicitations! Vous êtes présélectionné(e).',
				'en_attente_dossier': 'Veuillez déposer votre dossier dans les délais impartis.',
				'dossier_depose': 'Votre dossier a été reçu. Merci!',
				'en_attente': 'Votre dossier est en attente de traitement.',
				'selectionne': 'Excellente nouvelle! Vous êtes sélectionné(e).',
				'inscrit': 'Vous êtes inscrit(e). Bienvenue!',
				'annule': 'Votre candidature a été annulée.',
				'rejete': 'Votre candidature a été rejetée. Nous vous encourageons à postuler l\'année prochaine.',
			}
			
			titre = f"Changement de statut: {nouveau.replace('_', ' ').title()}"
			message = status_messages.get(nouveau, f'Statut mis à jour: {nouveau}')
			dedup_key = f"candidature-status-{instance.id}-{nouveau}"
			
			Notification.objects.update_or_create(
				user=instance.candidat,
				dedup_key=dedup_key,
				defaults={
					'titre': titre,
					'message': message,
					'type': 'candidature',
					'lue': False,
				}
			)
		except Exception as e:
			print(f"Erreur lors de la création de la notification: {e}")


