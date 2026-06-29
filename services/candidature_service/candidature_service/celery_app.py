import os

from celery import Celery
from celery.schedules import crontab


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "candidature_service.settings")

app = Celery("candidature_service")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

app.conf.beat_schedule = {
    "synchroniser-notifications-systeme-quotidien": {
        "task": "candidature_app.tasks.synchroniser_notifications_systeme_tous",
        "schedule": crontab(hour=8, minute=0),
    },
    "rappel-preinscription-j3": {
        "task": "candidature_app.tasks.envoyer_rappels_j3_tous",
        "schedule": crontab(hour=8, minute=5),
    },
    "verifier-dossiers-quotidien": {
        "task": "candidature_app.tasks.verifier_dossiers_non_deposes",
        "schedule": crontab(hour=2, minute=0),
    },
    "purger-donnees-rgpd-quotidien": {
        "task": "candidature_app.tasks.purger_donnees_candidats_non_admis",
        "schedule": crontab(hour=3, minute=10),
    },
    "verifier-paiements-inscriptions": {
        "task": "candidature_app.tasks.verifier_paiements_quotidien",
        "schedule": crontab(hour=4, minute=0),
    },
    "verifier-deadlines-j3": {
        "task": "candidature_app.tasks.verifier_deadlines_j3",
        "schedule": crontab(hour=21, minute=0),
    },
}
