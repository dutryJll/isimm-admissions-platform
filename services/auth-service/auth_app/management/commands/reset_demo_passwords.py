from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

ACCOUNTS = [
    {"email": "responsable@isimm.tn", "password": "TestPassword123!"},
    {"email": "commission@isimm.tn",  "password": "Demo@2026!"},
]


class Command(BaseCommand):
    help = 'Reset demo commission passwords in auth-service DB'

    def handle(self, *args, **options):
        w = self.stdout.write
        w("\n--- Reset demo passwords (auth-service) ---")
        for acc in ACCOUNTS:
            user = User.objects.filter(email__iexact=acc["email"]).first()
            if user:
                user.set_password(acc["password"])
                user.save()
                w(self.style.SUCCESS(f"  [OK] {acc['email']} -> password set to '{acc['password']}'"))
            else:
                w(self.style.ERROR(f"  [?]  {acc['email']} not found in auth-service DB"))
        w("")
