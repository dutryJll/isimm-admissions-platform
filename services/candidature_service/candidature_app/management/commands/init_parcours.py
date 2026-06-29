

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from candidature_app.init_criteres import initialiser_criteres
from candidature_app.models import (
    Master,
    ParcoursAdmission,
    CritereEvaluation,
    ValeurCritere,
)


def _future_date(days=30):
    return (timezone.now().date() + timedelta(days=days))


class Command(BaseCommand):
    help = 'Initialise ParcoursAdmission and ValeurCritere pour scoring (4 parcours prédéfinis)'

    def handle(self, *args, **options):
        # Ensure base criteria exist
        initialiser_criteres()
        self.stdout.write(self.style.SUCCESS('✓ Critères de base initialisés'))

        # Prepare or create Masters used as anchors for parcours
        masters_def = [
            {
                'nom': 'Master Professionnel (GL / DS)',
                'type_master': 'professionnel',
                'specialite': 'GL/DS',
            },
            {
                'nom': 'Master Recherche (MR-GL)',
                'type_master': 'recherche',
                'specialite': 'MR-GL',
            },
            {
                'nom': 'Cycle Ingénieur (Interne)',
                'type_master': 'professionnel',
                'specialite': 'ING-INTERNE',
            },
            {
                'nom': 'Cycle Ingénieur (Externe)',
                'type_master': 'professionnel',
                'specialite': 'ING-EXTERNE',
            },
        ]

        created_parcours = []

        for mdef in masters_def:
            master_obj, created = Master.objects.get_or_create(
                nom=mdef['nom'],
                defaults={
                    'type_master': mdef['type_master'],
                    'description': f"Auto-created anchor master for {mdef['nom']}",
                    'specialite': mdef['specialite'],
                    'places_disponibles': 50,
                    'date_limite_candidature': _future_date(90),
                    'annee_universitaire': '2026/2027',
                    'actif': True,
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'✓ Master created: {master_obj.nom}'))
            else:
                self.stdout.write(self.style.NOTICE(f'• Master exists: {master_obj.nom}'))

            # Create matching ParcoursAdmission
            if 'Professionnel' in master_obj.nom:
                p_type = 'pro'
            elif 'Recherche' in master_obj.nom or 'MR-GL' in master_obj.nom:
                p_type = 'recherche'
            else:
                p_type = 'ingenieur'

            parcours_name = f"Parcours - {master_obj.nom}"
            parcours, pc = ParcoursAdmission.objects.get_or_create(
                master=master_obj,
                nom=parcours_name,
                defaults={
                    'type': p_type,
                    'specialite': master_obj.specialite,
                    'capacite': master_obj.places_disponibles,
                    'date_limite': master_obj.date_limite_candidature,
                    'statut': 'ouvert',
                    'actif': True,
                }
            )

            if pc:
                self.stdout.write(self.style.SUCCESS(f'✓ Parcours created: {parcours.nom}'))
            else:
                self.stdout.write(self.style.NOTICE(f'• Parcours exists: {parcours.nom}'))

            created_parcours.append(parcours)

        # Map of criteria codes to coefficients for each parcours type
        # Note: coefficients chosen to reflect the requested formulas (effective multipliers)
        mapping = {
            'Master Professionnel (GL / DS)': {
                # Use moyenne_m1/m2/m3 splitted equally (1/3 each)
                'moyenne_m1': 0.333,
                'moyenne_m2': 0.333,
                'moyenne_m3': 0.334,
                # Keep redoublements and rattrapages criteres present (coef 1 for visibility)
                'redoublements': 1.0,
            },
            'Master Recherche (MR-GL)': {
                'moyenne_m1': 1.5,
                'moyenne_m2': 2.0,
                'moyenne_m3': 1.0,
                'note_math_bac': 1.0,
                'moyenne_bac': 1.0,
                'bonus_langue': 1.0,
                'bonus_diplome': 1.0,
                'redoublements': 1.0,
            },
            'Cycle Ingénieur (Interne)': {
                # Internal: score = M2 + bonuses (b1/b2 are computed), so coef for M2 = 1
                'moyenne_m2': 1.0,
            },
            'Cycle Ingénieur (Externe)': {
                # External effective coefficients: M1*1, M2*1, M3*0.5
                'moyenne_m1': 1.0,
                'moyenne_m2': 1.0,
                'moyenne_m3': 0.5,
                'rang1': 1.0,
                'rang2': 1.0,
            },
        }

        # Create ValeurCritere entries
        for parcours in created_parcours:
            master_name = parcours.master.nom
            cfg = mapping.get(master_name, {})
            for crit_code, coef in cfg.items():
                try:
                    crit = CritereEvaluation.objects.filter(code=crit_code).first()
                    if not crit:
                        # fallback: create a simple CritereEvaluation placeholder
                        crit = CritereEvaluation.objects.create(
                            code=crit_code,
                            nom=crit_code,
                            label=crit_code,
                            description=f'Auto-created critere {crit_code}'
                        )
                        self.stdout.write(self.style.WARNING(f'⚠️ Critere auto-created: {crit_code}'))

                    vc, created_vc = ValeurCritere.objects.get_or_create(
                        parcours=parcours,
                        critere=crit,
                        defaults={'coefficient': coef},
                    )
                    if created_vc:
                        self.stdout.write(self.style.SUCCESS(f'✓ ValeurCritere created: {parcours.nom} - {crit.code} = {coef}'))
                    else:
                        # update coefficient if different
                        if float(vc.coefficient) != float(coef):
                            vc.coefficient = coef
                            vc.save(update_fields=['coefficient'])
                            self.stdout.write(self.style.SUCCESS(f'✓ ValeurCritere updated: {parcours.nom} - {crit.code} -> {coef}'))
                        else:
                            self.stdout.write(self.style.NOTICE(f'• ValeurCritere exists: {parcours.nom} - {crit.code}'))
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'Error creating ValeurCritere {crit_code} for {parcours.nom}: {e}'))

        self.stdout.write(self.style.SUCCESS('✓ Initialisation des parcours et valeurs terminée'))
