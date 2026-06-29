from django.core.management.base import BaseCommand
from django.contrib.auth.models import User


class Command(BaseCommand):
    help = 'Reset password for commission demo accounts'

    def handle(self, *args, **options):
        accounts = [
            'commission@isimm.tn',
            'responsable.member@isimm.tn',
            'local.member1@isimm.tn',
        ]
        new_password = 'Demo@2026!'
        for username in accounts:
            user = User.objects.filter(username=username).first()
            if user:
                user.set_password(new_password)
                user.save()
                self.stdout.write(self.style.SUCCESS(
                    f"[OK] {username} -> mot de passe reset"
                ))
            else:
                self.stdout.write(self.style.WARNING(
                    f"[?]  {username} -> utilisateur non trouve"
                ))
        self.stdout.write(f"\nNouveaux identifiants :")
        self.stdout.write(f"  Username : commission@isimm.tn")
        self.stdout.write(f"  Password : {new_password}")
