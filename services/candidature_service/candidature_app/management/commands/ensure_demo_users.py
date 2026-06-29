from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

ACCOUNTS = [
    {"email": "commission@isimm.tn",  "username": "commission",   "role": "commission",              "first": "Samir",  "last": "Mokni"},
    {"email": "responsable@isimm.tn", "username": "responsable",  "role": "responsable_commission",  "first": "Meriem", "last": "Sfar"},
]


class Command(BaseCommand):
    help = 'Ensure demo commission accounts exist in candidature-service DB'

    def handle(self, *args, **options):
        w = self.stdout.write
        for acc in ACCOUNTS:
            user = User.objects.filter(email__iexact=acc["email"]).first()
            if user:
                w(self.style.SUCCESS(f"  [OK]  {acc['email']} -> username={user.username} id={user.id}"))
            else:
                # Create with password so they can also be used directly
                user = User.objects.create(
                    username=acc["username"],
                    email=acc["email"],
                    first_name=acc["first"],
                    last_name=acc["last"],
                    is_active=True,
                )
                user.set_password("Demo@2026!")
                user.save()
                w(self.style.WARNING(f"  [NEW] {acc['email']} cree dans candidature-DB (id={user.id})"))
