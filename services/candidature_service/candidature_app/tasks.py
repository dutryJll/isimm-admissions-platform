from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from django.db import transaction
from django.contrib.auth import get_user_model
from .models import Candidature, Notification
from .emails import (
    envoyer_email_changement_statut,
    envoyer_rappel_deadline_j3,
    envoyer_email_preselection_admis,
    envoyer_email_preselection_refuse,
)
from .notifications import (
    envoyer_rappels_j3_preinscription,
    envoyer_rappels_j1_depot_dossier,
    sync_preinscription_open_notifications,
)
from .views import _sync_system_notifications_for_user
import logging

logger = logging.getLogger(__name__)
User = get_user_model()

@shared_task
def verifier_dossiers_non_deposes():
    """
    Vérifier les candidatures présélectionnées 
    sans dossier déposé après le délai
    """
    candidatures = Candidature.objects.filter(
        statut='en_attente_dossier',
        dossier_depose=False,
        delai_depot_dossier__lt=timezone.now().date()
    )
    
    for candidature in candidatures:
        if not candidature.prolongation_delai:
            ancien_statut = candidature.statut
            candidature.statut = 'dossier_non_depose'
            candidature.save()
            
            envoyer_email_changement_statut(
                candidature, 
                ancien_statut, 
                'dossier_non_depose'
            )


@shared_task
def purger_donnees_candidats_non_admis():
    """
    RGPD - Purger les candidatures non admises et leurs documents
    2 mois après la clôture du concours.

    Règles:
    - Admis = 'selectionne' ou 'inscrit' (jamais purgés)
    - Clôture = date_cloture du concours, sinon date_limite_candidature du master
    - Suppression des fichiers de paiement liés avant suppression des enregistrements
    - Anonymisation du compte candidat uniquement s'il n'a plus aucune candidature
    """
    cutoff_date = (timezone.now() - timedelta(days=60)).date()
    admitted_statuses = {'selectionne', 'inscrit'}

    candidatures = Candidature.objects.select_related('concours', 'master', 'candidat').exclude(
        statut__in=admitted_statuses
    )

    purged_candidatures = 0
    purged_files = 0
    anonymized_users = 0
    candidate_ids_touched = set()

    for candidature in candidatures:
        try:
            closure_date = None
            if candidature.concours and candidature.concours.date_cloture:
                closure_date = candidature.concours.date_cloture
            elif candidature.master and candidature.master.date_limite_candidature:
                closure_date = candidature.master.date_limite_candidature

            if not closure_date or closure_date > cutoff_date:
                continue

            with transaction.atomic():
                inscription = getattr(candidature, 'inscription_enligne', None)
                if inscription and inscription.fichier_paiement:
                    inscription.fichier_paiement.delete(save=False)
                    purged_files += 1

                candidate_ids_touched.add(candidature.candidat_id)
                candidature.delete()
                purged_candidatures += 1

                logger.info(
                    "RGPD purge candidature=%s candidate_id=%s",
                    candidature.numero,
                    candidature.candidat_id,
                )
        except Exception:
            logger.exception("Erreur purge candidature %s", candidature.numero)

    for candidate_id in candidate_ids_touched:
        try:
            if Candidature.objects.filter(candidat_id=candidate_id).exists():
                continue

            user = User.objects.filter(id=candidate_id).first()
            if not user:
                continue

            user.first_name = 'ANONYME'
            user.last_name = 'ANONYME'
            user.email = f'purge_{candidate_id}@anonyme.local'
            user.is_active = False
            user.save(update_fields=['first_name', 'last_name', 'email', 'is_active'])
            anonymized_users += 1
        except Exception:
            logger.exception("Erreur anonymisation candidat %s", candidate_id)

    logger.info(
        "RGPD purge termine: candidatures=%s fichiers=%s utilisateurs_anonymises=%s",
        purged_candidatures,
        purged_files,
        anonymized_users,
    )
    return {
        'candidatures_purgees': purged_candidatures,
        'fichiers_supprimes': purged_files,
        'utilisateurs_anonymises': anonymized_users,
    }


@shared_task
def verifier_paiements_listes_actives():
    """
    Tâche Celery : Vérifier les paiements des listes actives
    Exécuté quotidiennement
    """
    from .models import ListeAdmission
    from .services import VerificationPaiementService
    
    listes_actives = ListeAdmission.objects.filter(
        publiee=True,
        active=True,
        type_liste='principale'
    )
    
    for liste in listes_actives:
        resultats = VerificationPaiementService.verifier_paiements_liste(liste)
        
        if resultats['places_liberees'] > 0:
            VerificationPaiementService.generer_liste_suivante_si_necessaire(liste)


@shared_task
def verifier_deadlines_j3():
    """
    Cree les notifications J-3 (et en-dessous) pour les candidats selectionnes/preselectionnes
    et envoie un email de rappel une seule fois par candidature+deadline.
    """
    now = timezone.now()
    limite = now + timedelta(days=3)

    candidatures = Candidature.objects.select_related('candidat', 'master').filter(
        statut__in=['selectionne', 'preselectionne'],
        date_limite_modification__isnull=False,
        date_limite_modification__gte=now,
        date_limite_modification__lte=limite,
    )

    created_notifications = 0
    sent_emails = 0

    for candidature in candidatures:
        delta = candidature.date_limite_modification - now
        jours_restants = max(0, int((delta.total_seconds() + 86399) // 86400))
        dedup_key = (
            f"deadline-j3-{candidature.id}-"
            f"{candidature.date_limite_modification.date().isoformat()}"
        )

        notification, created = Notification.objects.get_or_create(
            user=candidature.candidat,
            dedup_key=dedup_key,
            defaults={
                'titre': 'Deadline proche',
                'message': (
                    f"Votre candidature {candidature.numero} ({candidature.master.nom}) "
                    f"arrive a echeance dans {jours_restants} jour(s)."
                ),
                'type': 'warning',
                'lue': False,
            },
        )

        if created:
            created_notifications += 1
            try:
                envoyer_rappel_deadline_j3(candidature, jours_restants)
                sent_emails += 1
            except Exception:
                logger.exception(
                    "Erreur envoi email rappel J-3 candidature=%s",
                    candidature.id,
                )
        else:
            # Si deja creee mais non lue, on conserve l'etat. Pas de re-envoi email.
            notification.message = (
                f"Votre candidature {candidature.numero} ({candidature.master.nom}) "
                f"arrive a echeance dans {jours_restants} jour(s)."
            )
            notification.save(update_fields=['message'])

    logger.info(
        "Tache J-3 terminee: notifications_creees=%s emails_envoyes=%s",
        created_notifications,
        sent_emails,
    )
    return {
        'notifications_creees': created_notifications,
        'emails_envoyes': sent_emails,
    }


@shared_task
def envoyer_rappels_j3_tous():
    """
    Tâche Celery pour envoyer les rappels J-3 avant deadline préinscription.
    À exécuter quotidiennement via Celery Beat.
    """
    try:
        envoyer_rappels_j3_preinscription()
        return {'status': 'success', 'task': 'envoyer_rappels_j3_preinscription'}
    except Exception as e:
        logger.exception("Erreur tâche envoyer_rappels_j3_preinscription: %s", e)
        return {'status': 'error', 'error': str(e)}


@shared_task
def envoyer_rappels_j1_tous():
    """
    Tâche Celery pour envoyer les rappels J-1 avant deadline dépôt dossier.
    À exécuter quotidiennement via Celery Beat.
    """
    try:
        envoyer_rappels_j1_depot_dossier()
        return {'status': 'success', 'task': 'envoyer_rappels_j1_depot_dossier'}
    except Exception as e:
        logger.exception("Erreur tâche envoyer_rappels_j1_depot_dossier: %s", e)
        return {'status': 'error', 'error': str(e)}


@shared_task
def sync_offres_ouvertes_tous():
    """
    Tâche Celery pour notifier les candidats des offres ouvertes.
    À exécuter quotidiennement via Celery Beat.
    """
    try:
        sync_preinscription_open_notifications()
        return {'status': 'success', 'task': 'sync_preinscription_open_notifications'}
    except Exception as e:
        logger.exception("Erreur tâche sync_preinscription_open_notifications: %s", e)
        return {'status': 'error', 'error': str(e)}


@shared_task
def synchroniser_notifications_systeme_tous():
    """
    Tâche Celery pour synchroniser les notifications système de tous les rôles métier.
    Génère les notifications in-app et les emails associés pour les candidats,
    les membres de commission, les responsables et les admins.
    """
    users = User.objects.all()
    processed = 0

    for user in users.iterator():
        try:
            _sync_system_notifications_for_user(user)
            processed += 1
        except Exception:
            logger.exception("Erreur synchronisation notifications système pour user=%s", user.id)

    return {'status': 'success', 'users_processed': processed}


@shared_task
def cloture_preselection_worker(commission_id):
    """
    Déclenché quand le Responsable valide la présélection (Session_Preselection_Cloturee).
    Pour chaque candidature de la commission :
      - présélectionné  → email avec instructions dossier + notification WS personnelle
      - rejeté          → email de refus poli + notification WS personnelle
    Puis envoie une notification globale de clôture.
    """
    from .models import Commission, Candidature
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync
    from django.utils import timezone as tz

    channel_layer = get_channel_layer()
    now = tz.now().isoformat()

    try:
        commission = Commission.objects.select_related('master').get(id=commission_id)
    except Commission.DoesNotExist:
        logger.error("cloture_preselection_worker: commission %s introuvable", commission_id)
        return {'status': 'error', 'reason': 'commission_not_found'}

    candidatures = Candidature.objects.select_related('candidat', 'master').filter(
        master=commission.master,
        statut__in=['preselectionne', 'rejete'],
    )

    emails_admis = 0
    emails_refuses = 0
    ws_sent = 0
    errors = 0

    for cand in candidatures:
        user_group = f'user_{cand.candidat_id}'

        # Email selon le statut
        try:
            if cand.statut == 'preselectionne':
                envoyer_email_preselection_admis(cand)
                emails_admis += 1
            elif cand.statut == 'rejete':
                envoyer_email_preselection_refuse(cand)
                emails_refuses += 1
        except Exception:
            logger.exception(
                "Erreur email clôture présélection candidature=%s", cand.numero
            )
            errors += 1

        # Notification WebSocket sur le canal personnel du candidat
        try:
            async_to_sync(channel_layer.group_send)(
                user_group,
                {
                    'type': 'candidature_status_changed',
                    'candidature_id': cand.id,
                    'candidate_user_id': cand.candidat_id,
                    'new_status': cand.statut,
                    'updated_at': now,
                },
            )
            ws_sent += 1
        except Exception:
            logger.exception(
                "Erreur WS clôture présélection candidature=%s", cand.numero
            )
            errors += 1

    # Notification globale de clôture de session
    try:
        async_to_sync(channel_layer.group_send)(
            'candidatures_updates',
            {
                'type': 'preselection_closed',
                'commission_id': commission_id,
                'message': (
                    f"La session de présélection pour {commission.master.nom} a été clôturée."
                    if commission.master
                    else "La session de présélection a été clôturée."
                ),
                'timestamp': now,
            },
        )
    except Exception:
        logger.exception(
            "Erreur WS notification globale clôture commission=%s", commission_id
        )
        errors += 1

    result = {
        'commission_id': commission_id,
        'emails_admis': emails_admis,
        'emails_refuses': emails_refuses,
        'ws_sent': ws_sent,
        'errors': errors,
    }
    logger.info("cloture_preselection_worker terminé: %s", result)
    return result


@shared_task
def appliquer_decision_finale_quotas(commission_id):
    """
    Applique la décision finale basée sur les quotas LP/LA de la ConfigurationAppel.
    Classe les candidatures présélectionnées par score décroissant :
      - Top quota_lp  → statut 'selectionne'  (liste principale)
      - Suivants quota_la → statut 'en_attente' (liste d'attente)
      - Reste          → statut 'rejete'
    Puis envoie une notification WS globale et les emails correspondants.
    """
    from .models import Commission, Candidature, ConfigurationAppel
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync
    from django.utils import timezone as tz
    from django.db import transaction

    channel_layer = get_channel_layer()
    now = tz.now().isoformat()

    try:
        commission = Commission.objects.select_related('master').get(id=commission_id)
    except Commission.DoesNotExist:
        logger.error("appliquer_decision_finale_quotas: commission %s introuvable", commission_id)
        return {'status': 'error', 'reason': 'commission_not_found'}

    master = commission.master
    if not master:
        logger.error("appliquer_decision_finale_quotas: commission %s sans master", commission_id)
        return {'status': 'error', 'reason': 'no_master'}

    try:
        config = master.configuration
    except ConfigurationAppel.DoesNotExist:
        logger.error(
            "appliquer_decision_finale_quotas: aucune ConfigurationAppel pour master %s", master.id
        )
        return {'status': 'error', 'reason': 'no_configuration'}

    quota_lp = config.quota_lp or 0
    quota_la = config.quota_la or 0

    # Candidatures présélectionnées avec dossier déposé, classées par score
    candidatures = list(
        Candidature.objects.select_related('candidat', 'master')
        .filter(master=master, statut='preselectionne')
        .order_by('-score', 'date_soumission')
    )

    selectionnes = 0
    en_attente = 0
    refuses = 0
    errors = 0

    with transaction.atomic():
        for i, cand in enumerate(candidatures):
            if i < quota_lp:
                nouveau_statut = 'selectionne'
                selectionnes += 1
            elif i < quota_lp + quota_la:
                nouveau_statut = 'en_attente'
                en_attente += 1
            else:
                nouveau_statut = 'rejete'
                refuses += 1

            if cand.statut != nouveau_statut:
                cand.statut = nouveau_statut
                cand.date_changement_statut = tz.now()
                cand.save(update_fields=['statut', 'date_changement_statut'])

            # Email
            try:
                if nouveau_statut == 'selectionne':
                    envoyer_email_changement_statut(cand, 'preselectionne', 'selectionne')
                elif nouveau_statut == 'rejete':
                    envoyer_email_preselection_refuse(cand)
            except Exception:
                logger.exception(
                    "Erreur email décision finale candidature=%s", cand.numero
                )
                errors += 1

            # Notification WS personnelle
            try:
                async_to_sync(channel_layer.group_send)(
                    f'user_{cand.candidat_id}',
                    {
                        'type': 'candidature_status_changed',
                        'candidature_id': cand.id,
                        'candidate_user_id': cand.candidat_id,
                        'new_status': nouveau_statut,
                        'updated_at': now,
                    },
                )
            except Exception:
                logger.exception(
                    "Erreur WS décision finale candidature=%s", cand.numero
                )
                errors += 1

    result = {
        'commission_id': commission_id,
        'quota_lp': quota_lp,
        'quota_la': quota_la,
        'selectionnes': selectionnes,
        'en_attente': en_attente,
        'refuses': refuses,
        'errors': errors,
    }
    logger.info("appliquer_decision_finale_quotas terminé: %s", result)
    return result