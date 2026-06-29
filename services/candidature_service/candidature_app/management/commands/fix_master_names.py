

from django.core.management.base import BaseCommand

CORRECTIONS = [
    # (mot-clé dans le nom actuel,   nom officiel,            specialite officielle)
    ('data science',              'Mastère Professionnel en Sciences des Données (MPDS)',                 'MPDS'),
    ('génie logiciel',            'Mastère Professionnel en Génie Logiciel (MPGL)',                       'MPGL'),
    ('informatique industrielle', 'Mastère Professionnel en Informatique Industrielle et IoT (MP3I)',      'MP3I'),
    ('réseaux',                   'Mastère Professionnel en Réseaux, Sécurité et Cloud (MP3I)',            'MP3I'),
    ('recherche logiciel',        'Mastère de Recherche en Génie Logiciel (MRGL)',                         'MRGL'),
    ('intelligence artificielle', 'Mastère de Recherche en Modélisation et Intelligence Artificielle (MRMI)', 'MRMI'),
    ('modélisation',              'Mastère de Recherche en Modélisation et Intelligence Artificielle (MRMI)', 'MRMI'),
    ('cycle ingenieur',           "Cycle d'Ingénieur en Informatique",                                    'ING'),
    ('cycle ingénieur',           "Cycle d'Ingénieur en Informatique",                                    'ING'),
    ('ingénieur informatique',    "Cycle d'Ingénieur en Informatique",                                    'ING'),
]


class Command(BaseCommand):
    help = 'Remplace les noms de masters demo par les appellations officielles ISIMM'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Affiche les changements sans les enregistrer',
        )

    def handle(self, *args, **options):
        from candidature_app.models import Master

        dry = options['dry_run']
        updated = 0

        for master in Master.objects.all():
            nom_lower = (master.nom or '').lower()
            # Ne traite que les masters avec "demo" ou des noms génériques
            is_demo = 'demo' in nom_lower or 'test' in nom_lower or 'master ' == nom_lower[:7]

            for keyword, nom_officiel, specialite_code in CORRECTIONS:
                if keyword in nom_lower:
                    ancien_nom  = master.nom
                    ancien_spec = master.specialite

                    if not dry:
                        master.nom = nom_officiel
                        # Met à jour la spécialité uniquement si elle contient "demo" ou est vide
                        if not master.specialite or 'demo' in (master.specialite or '').lower():
                            master.specialite = specialite_code
                        master.save(update_fields=['nom', 'specialite'])

                    self.stdout.write(
                        f'  [ID {master.id}] '
                        f'"{ancien_nom}" ({ancien_spec}) '
                        f'-> "{nom_officiel}" ({specialite_code})'
                        + (' [DRY RUN]' if dry else ' [OK]')
                    )
                    updated += 1
                    break

        if updated == 0:
            self.stdout.write(self.style.WARNING('Aucun master a corriger trouve.'))
        else:
            action = 'seraient corriges' if dry else 'corriges'
            self.stdout.write(
                self.style.SUCCESS(f'{updated} master(s) {action}.')
            )
