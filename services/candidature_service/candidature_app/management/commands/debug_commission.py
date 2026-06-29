from django.core.management.base import BaseCommand
from candidature_app.models import MembreCommission, Commission, Master, Candidature
from django.contrib.auth.models import User


class Command(BaseCommand):
    help = 'Debug commission membership vs seeded candidatures'

    def handle(self, *args, **options):
        w = self.stdout.write

        w("=== COMMISSIONS EN BASE ===")
        for comm in Commission.objects.select_related('master').all():
            nb = Candidature.objects.filter(master=comm.master).count() if comm.master else 0
            w(f"  Commission [{comm.id}] '{comm.nom}' actif={comm.actif} -> master_id={comm.master_id} ({nb} candidatures)")

        w("\n=== MEMBRES COMMISSION ===")
        for m in MembreCommission.objects.select_related('user', 'commission__master').all():
            role = getattr(m.user, 'role', '?')
            master_id = m.commission.master_id if m.commission else None
            nb = Candidature.objects.filter(master_id=master_id).count() if master_id else 0
            w(f"  User '{m.user.username}' (role={role}) -> commission_id={m.commission_id} master_id={master_id} actif={m.actif} ({nb} cand.)")

        w("\n=== USERS AVEC ROLE COMMISSION ===")
        for u in User.objects.all():
            role = getattr(u, 'role', None)
            if role in ['commission', 'responsable_commission']:
                master_ids = list(
                    MembreCommission.objects.filter(user=u, actif=True, commission__actif=True)
                    .values_list('commission__master_id', flat=True)
                )
                nb_total = Candidature.objects.filter(master_id__in=master_ids).count() if master_ids else 0
                w(f"  {u.username} (role={role}) -> master_ids={master_ids} -> {nb_total} candidatures visibles")

        w("\n=== MASTER [5] ===")
        try:
            m5 = Master.objects.get(id=5)
            comms = Commission.objects.filter(master=m5)
            w(f"  Master: {m5.nom} actif={m5.actif}")
            w(f"  Commissions liees: {list(comms.values('id','nom','actif'))}")
            membres = MembreCommission.objects.filter(commission__master=m5).select_related('user')
            w(f"  Membres: {[m.user.username for m in membres]}")
        except Exception as e:
            w(f"  Erreur: {e}")
