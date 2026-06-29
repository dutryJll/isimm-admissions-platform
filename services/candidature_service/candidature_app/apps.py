from django.apps import AppConfig


class CandidatureAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'candidature_app'  # ✅ Nom de votre app

    def ready(self):
        import candidature_app.signals  # ✅ AJOUTER CETTE LIGNE