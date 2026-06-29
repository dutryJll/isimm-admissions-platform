"""
Ajoute un 2ème candidat démo (Marwen Gharbi) avec une spécialité diplôme différente
sur le master MPGL [5]. Permet de montrer le filtrage par spécialité pendant la démo.

Usage:
    python manage.py add_demo_candidat_2
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from candidature_app.models import Candidature, DonneesAcademiques, Master

User = get_user_model()

CANDIDAT = {
    'email':      'marwen.gharbi@demo.tn',
    'username':   'marwen_gharbi',
    'first_name': 'Marwen',
    'last_name':  'Gharbi',
    'password':   'TestPassword123!',
    'cin':        '12345678',
    'phone':      '+21698765432',
}

CANDIDATURE = {
    'numero':            'CAND-DEMO-002',
    'score':             16.2,
    'statut':            'sous_examen',
    'specialite_diplome': 'Informatique de Gestion',
    'dossier_depose':    False,
}

MASTER_NOM = 'Mastère Professionnel en Génie Logiciel (MPGL)'
MASTER_SPEC = 'MPGL'


class Command(BaseCommand):
    help = 'Ajoute Marwen Gharbi (specialité diplôme Informatique de Gestion) sur MPGL'

    def handle(self, *args, **options):
        w = self.stdout.write

        # 1. Master cible
        master = Master.objects.filter(nom=MASTER_NOM, specialite=MASTER_SPEC).first()
        if not master:
            self.stderr.write(self.style.ERROR(f"Master {MASTER_NOM} introuvable"))
            return

        # 2. User
        u = User.objects.filter(email__iexact=CANDIDAT['email']).first()
        if not u:
            u = User.objects.create(
                username=CANDIDAT['username'],
                email=CANDIDAT['email'],
                first_name=CANDIDAT['first_name'],
                last_name=CANDIDAT['last_name'],
                is_active=True,
            )
            u.set_password(CANDIDAT['password'])
            u.save()
            w(self.style.SUCCESS(f"[NEW] User cree : {u.email} (id={u.id})"))
        else:
            u.set_password(CANDIDAT['password'])
            u.save()
            w(self.style.WARNING(f"[UPDATE] Password reset pour {u.email}"))

        # 3. Candidature
        cand, created = Candidature.objects.get_or_create(
            candidat=u,
            master=master,
            defaults={
                'numero':          CANDIDATURE['numero'],
                'score':           CANDIDATURE['score'],
                'statut':          CANDIDATURE['statut'],
                'dossier_depose':  CANDIDATURE['dossier_depose'],
                'date_soumission': timezone.now(),
            },
        )
        # Reset to default values
        Candidature.objects.filter(pk=cand.pk).update(
            score=CANDIDATURE['score'],
            statut=CANDIDATURE['statut'],
            dossier_depose=CANDIDATURE['dossier_depose'],
        )

        # 4. DonneesAcademiques avec la specialite_diplome
        DonneesAcademiques.objects.update_or_create(
            candidature=cand,
            defaults={
                'moyenne_generale': CANDIDATURE['score'],
                'notes_detaillees': {
                    'specialite_diplome': CANDIDATURE['specialite_diplome'],
                    'payload': {'specialite_diplome': CANDIDATURE['specialite_diplome']},
                },
            },
        )

        tag = 'CREE' if created else 'MAJ'
        w(self.style.SUCCESS(
            f"\n[{tag}] Candidature [{cand.id}] {u.get_full_name()}"
            f"\n  Master    : [{master.id}] {master.nom}"
            f"\n  Specialite: {CANDIDATURE['specialite_diplome']}"
            f"\n  Score     : {CANDIDATURE['score']}"
            f"\n  Statut    : {CANDIDATURE['statut']}\n"
        ))
        w("=" * 60)
        w(self.style.MIGRATE_HEADING("ACCES CANDIDAT DEMO #2:"))
        w(f"  Email    : {CANDIDAT['email']}")
        w(f"  Password : {CANDIDAT['password']}")
        w("=" * 60)
