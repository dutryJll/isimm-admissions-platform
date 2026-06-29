
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from candidature_app.models import Candidature, DonneesAcademiques, Master

User = get_user_model()

MASTER_NOM  = 'Mastère Professionnel en Génie Logiciel (MPGL)'
MASTER_SPEC = 'MPGL'

CANDIDATS = [
    # ── ISIMM : Licence en Sciences de l'Informatique génie logiciel ──
    {'email': 'fedi.benmahfoudh@isimm.tn',   'first': 'Fedi',    'last': 'Benmahfoudh',
     'spec': "Licence en Sciences de l'Informatique génie logiciel", 'score': 24.55},
    {'email': 'yassine.ghedira@isimm.tn',    'first': 'Yassine', 'last': 'Ghedira',
     'spec': "Licence en Sciences de l'Informatique génie logiciel", 'score': 23.90},
    {'email': 'ines.jaziri@isimm.tn',        'first': 'Ines',    'last': 'Jaziri',
     'spec': "Licence en Sciences de l'Informatique génie logiciel", 'score': 23.87},

    # ── ISIMM : Informatique de Gestion ──
    {'email': 'lobna.bakir@isimm.tn',        'first': 'Lobna',   'last': 'Bakir',
     'spec': 'Informatique de Gestion', 'score': 23.44},
    {'email': 'nesrine.benhammouda@isimm.tn','first': 'Nesrine', 'last': 'Ben Hammouda',
     'spec': 'Informatique de Gestion', 'score': 23.24},

    # ── ISIMM : Génie logiciel et systèmes d'information ──
    {'email': 'oussama.arouay@isimm.tn',     'first': 'Oussama', 'last': 'Arouay',
     'spec': "Génie logiciel et systèmes d'information", 'score': 23.17},
    {'email': 'noureddine.marzougui@isimm.tn','first': 'Noureddine', 'last': 'Marzougui',
     'spec': "Génie logiciel et systèmes d'information", 'score': 23.07},

    # ── Hors ISIMM : Big data et Analyse de données ──
    {'email': 'hiba.nemri@demo.tn',          'first': 'Hiba',    'last': 'Nemri',
     'spec': 'Big data et Analyse de données', 'score': 24.26},
    {'email': 'chahd.atia@demo.tn',          'first': 'Chahd',   'last': 'Atia',
     'spec': 'Big data et Analyse de données', 'score': 23.30},

    # ── Hors ISIMM : Business Computing ──
    {'email': 'amen.kaabachi@demo.tn',       'first': 'Amen',    'last': 'Kaabachi',
     'spec': 'Business Computing', 'score': 25.23},
    {'email': 'ichrak.belghouthi@demo.tn',   'first': 'Ichrak',  'last': 'Belghouthi',
     'spec': 'Business Computing', 'score': 24.98},
]


class Command(BaseCommand):
    help = 'Seed candidats préselectionés avec spécialités diplôme variées pour démo PDF officiel'

    def handle(self, *args, **options):
        w = self.stdout.write
        master = Master.objects.filter(nom=MASTER_NOM, specialite=MASTER_SPEC).first()
        if not master:
            self.stderr.write(self.style.ERROR(f"Master {MASTER_NOM} introuvable"))
            return

        w(f"Master cible : [{master.id}] {master.nom}")
        w(f"Création de {len(CANDIDATS)} candidatures préselectionées…\n")

        for i, data in enumerate(CANDIDATS, start=1):
            # User
            u = User.objects.filter(email__iexact=data['email']).first()
            if not u:
                u = User.objects.create(
                    username=data['email'].split('@')[0],
                    email=data['email'],
                    first_name=data['first'],
                    last_name=data['last'],
                    is_active=True,
                )
                u.set_password('Demo2026!')
                u.save()

            # Candidature
            cand, created = Candidature.objects.get_or_create(
                candidat=u,
                master=master,
                defaults={
                    'numero': f'CAND-DEMO-PRESEL-{i:03d}',
                    'score': data['score'],
                    'statut': 'preselectionne',
                    'dossier_depose': True,
                    'date_soumission': timezone.now(),
                },
            )
            Candidature.objects.filter(pk=cand.pk).update(
                score=data['score'],
                statut='preselectionne',
            )

            # DonneesAcademiques avec specialite_diplome
            DonneesAcademiques.objects.update_or_create(
                candidature=cand,
                defaults={
                    'moyenne_generale': data['score'],
                    'notes_detaillees': {
                        'specialite_diplome': data['spec'],
                        'payload': {'specialite_diplome': data['spec']},
                    },
                },
            )

            tag = 'CREE' if created else 'MAJ '
            w(f"  [{tag}] {data['last']:<18} {data['first']:<15} "
              f"spec={data['spec'][:35]:<35} score={data['score']}")

        # Stats finales
        total = Candidature.objects.filter(master=master, statut='preselectionne').count()
        w(self.style.SUCCESS(f"\n[OK] {total} candidature(s) préselectionée(s) sur master MPGL"))
        w("\nPour générer le PDF officiel :")
        w("  GET /api/candidatures/documents/generer-pdf/?etape=PRESELECTION&master_id=5&annee=2025-2026")
