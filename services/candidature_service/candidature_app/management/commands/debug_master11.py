from django.core.management.base import BaseCommand
from candidature_app.models import Master, Commission, MembreCommission


class Command(BaseCommand):
    help = 'Show master 11 details'

    def handle(self, *args, **options):
        w = self.stdout.write
        try:
            m = Master.objects.get(id=11)
            w(f"Master [11]: nom={m.nom}")
            w(f"  specialite = '{getattr(m, 'specialite', 'N/A')}'")
            w(f"  code       = '{getattr(m, 'code', 'N/A')}'")
            w(f"  actif      = {m.actif}")
            for field in m._meta.get_fields():
                try:
                    val = getattr(m, field.name, None)
                    if not hasattr(val, 'all'):
                        w(f"  {field.name} = {val}")
                except Exception:
                    pass
        except Exception as e:
            w(f"Erreur: {e}")
