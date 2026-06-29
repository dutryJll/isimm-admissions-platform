"""
Migre Ahmed Ben Ali vers le vrai master MPGL (spec='MPGL', actif=True)
et relie Commission Genie Logiciel Demo à ce master.

Usage:
    python manage.py migrate_to_mpgl
    python manage.py migrate_to_mpgl --dry-run
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from candidature_app.models import Candidature, Commission, Master

User = get_user_model()

MPGL_NOM   = 'Mastère Professionnel en Génie Logiciel (MPGL)'
MPGL_SPEC  = 'MPGL'
COMMISSION = 'Commission Genie Logiciel Demo'


class Command(BaseCommand):
    help = 'Migrate candidatures to the real MPGL master and relink commission.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        dry = options['dry_run']
        w   = self.stdout.write

        # 1. Find target master (nom EXACT + spec='MPGL')
        try:
            target = Master.objects.get(nom=MPGL_NOM, specialite=MPGL_SPEC)
        except Master.DoesNotExist:
            self.stderr.write(self.style.ERROR(
                f"Master '{MPGL_NOM}' (spec='{MPGL_SPEC}') introuvable."
            ))
            return
        except Master.MultipleObjectsReturned:
            target = Master.objects.filter(nom=MPGL_NOM, specialite=MPGL_SPEC).order_by('id').first()

        w(f"Target Master [{target.id}] '{target.nom}'  spec={target.specialite}  actif={target.actif}")

        if not target.actif and not dry:
            target.actif = True
            target.save(update_fields=['actif'])
            w(self.style.WARNING('  [FIX] Master active'))

        # 2. Relink commission
        try:
            comm = Commission.objects.get(nom=COMMISSION)
        except Commission.DoesNotExist:
            self.stderr.write(self.style.ERROR(f"Commission '{COMMISSION}' introuvable."))
            return

        old_mid = comm.master_id
        w(f"Commission [{comm.id}] '{comm.nom}'  master_id actuel={old_mid} -> {target.id}")
        if not dry and old_mid != target.id:
            comm.master = target
            comm.save(update_fields=['master'])
            w(self.style.SUCCESS(f'  [OK] Commission reliee a Master [{target.id}]'))

        # 3. Move candidatures from old MPGL masters to target
        old_mpgl_ids = list(
            Master.objects.filter(nom=MPGL_NOM).exclude(pk=target.pk).values_list('id', flat=True)
        )
        if old_mpgl_ids:
            cands = Candidature.objects.filter(master_id__in=old_mpgl_ids)
            w(f"Candidatures sur anciens masters MPGL {old_mpgl_ids}: {cands.count()}")
            for c in cands:
                w(f"  [{c.id}] {c.candidat.email}  statut={c.statut}  master_id={c.master_id} -> {target.id}")
                if not dry:
                    c.master = target
                    c.save(update_fields=['master'])

        # 4. Move demo candidatures from orphan masters and deactivate them
        demo_names = ['Master Genie Logiciel Demo', 'Master Demo Workflow MPGL']
        for nom in demo_names:
            for dm in Master.objects.filter(nom=nom).exclude(pk=target.pk):
                demo_cands = Candidature.objects.filter(master=dm)
                w(self.style.WARNING(
                    f"  [MIGRATE] Master [{dm.id}] '{dm.nom}' -> {demo_cands.count()} candidatures deplacees"
                ))
                if not dry and demo_cands.exists():
                    demo_cands.update(master=target)
                if not dry and dm.actif:
                    dm.actif = False
                    dm.save(update_fields=['actif'])
                    w(f"    [DEACTIVATE] Master [{dm.id}]")

        # 5. Summary
        total = Candidature.objects.filter(master=target).count()
        ahmed = Candidature.objects.filter(master=target, candidat__email__icontains='ahmed').first()
        w(self.style.SUCCESS(
            f"\n[OK] Master [{target.id}] '{target.nom}' : {total} candidatures"
        ))
        if ahmed:
            w(f"     Ahmed Ben Ali [{ahmed.candidat.email}] : statut={ahmed.statut} - VISIBLE pour le responsable")
        else:
            w(self.style.WARNING('     Ahmed introuvable sur ce master'))
