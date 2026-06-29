"""Management command pour initialiser les critères d'évaluation."""

from django.core.management.base import BaseCommand
from candidature_app.init_criteres import initialiser_criteres


class Command(BaseCommand):
    help = 'Initialise les critères d\'évaluation par défaut'

    def handle(self, *args, **options):
        initialiser_criteres()
        self.stdout.write(self.style.SUCCESS('✓ Critères d\'évaluation initialisés'))
