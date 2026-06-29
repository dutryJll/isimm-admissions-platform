# -*- coding: utf-8 -*-
"""
Crée/met à jour les 6 pièces officielles du dossier ISIMM pour chaque master.

Usage:
    python manage.py seed_pieces_officielles
"""
from django.core.management.base import BaseCommand
from candidature_app.models import Master, DocumentType


# (code, obligatoire, taille_max_mb, formats_acceptes)
PIECES_OFFICIELLES = [
    ('formulaire_candidature', True,  5,  ['pdf']),
    ('cin',                    True,  5,  ['pdf', 'jpg', 'jpeg', 'png']),
    ('diplomes_bac',           True,  5,  ['pdf']),
    ('releves_bac',            True,  10, ['pdf']),
    ('attestation_retrait',    False, 5,  ['pdf', 'jpg', 'jpeg', 'png']),
    ('cv',                     True,  5,  ['pdf']),
]


class Command(BaseCommand):
    help = "Crée les 6 pièces officielles du dossier ISIMM pour chaque master"

    def handle(self, *args, **options):
        masters = Master.objects.all()
        if not masters.exists():
            self.stdout.write(self.style.WARNING('Aucun master en base.'))
            return

        total_crees, total_maj = 0, 0
        for master in masters:
            for code, obligatoire, taille, formats in PIECES_OFFICIELLES:
                obj, created = DocumentType.objects.update_or_create(
                    master=master,
                    type_document=code,
                    defaults={
                        'obligatoire': obligatoire,
                        'taille_max_mb': taille,
                        'formats_acceptes': formats,
                    },
                )
                if created:
                    total_crees += 1
                else:
                    total_maj += 1

            # Supprimer d'éventuels types hors liste officielle (sans documents liés)
            codes_officiels = [p[0] for p in PIECES_OFFICIELLES]
            obsoletes = DocumentType.objects.filter(master=master).exclude(
                type_document__in=codes_officiels
            )
            for dt in obsoletes:
                try:
                    dt.delete()  # PROTECT empêchera la suppression si des documents existent
                except Exception:
                    pass

        self.stdout.write(self.style.SUCCESS(
            f'OK — {total_crees} pièce(s) créée(s), {total_maj} mise(s) à jour '
            f'sur {masters.count()} master(s).'
        ))
