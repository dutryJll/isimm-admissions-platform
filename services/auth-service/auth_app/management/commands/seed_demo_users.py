"""
Commande de management : initialise les comptes de démonstration ISIMM.

Usage:
    python manage.py seed_demo_users
    python manage.py seed_demo_users --reset-password
"""
from django.core.management.base import BaseCommand


DEMO_ACCOUNTS = [
    {
        'email':      'responsable@isimm.tn',
        'username':   'responsable_isimm',
        'first_name': 'Responsable',
        'last_name':  'GL Demo',
        'password':   'TestPassword123!',
        'role':       'responsable_commission',
        'specialite': 'MPGL',
    },
]


class Command(BaseCommand):
    help = 'Crée ou remet à jour les comptes de démonstration ISIMM'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset-password', action='store_true',
            help='Réinitialise le mot de passe même si le compte existe déjà',
        )

    def handle(self, *args, **options):
        from auth_app.models import User

        reset_pw = options['reset_password']

        for account in DEMO_ACCOUNTS:
            email = account['email']
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'username':         account['username'],
                    'first_name':       account['first_name'],
                    'last_name':        account['last_name'],
                    'role':             account['role'],
                    'specialite':       account['specialite'],
                    'is_email_verified': True,
                    'is_active':        True,
                },
            )

            changed = []

            # Toujours s'assurer que les champs critiques sont corrects
            if user.role != account['role']:
                user.role = account['role']
                changed.append('role')
            if user.specialite != account['specialite']:
                user.specialite = account['specialite']
                changed.append('specialite')
            if not user.is_email_verified:
                user.is_email_verified = True
                changed.append('is_email_verified')
            if not user.is_active:
                user.is_active = True
                changed.append('is_active')

            if created or reset_pw:
                user.set_password(account['password'])
                changed.append('password')

            if changed:
                user.save(update_fields=changed if not created else None)

            verb = 'Cree' if created else ('Mis a jour' if changed else 'Inchange')
            self.stdout.write(
                self.style.SUCCESS(
                    f'[{verb}] {email} '
                    f'(role={account["role"]}, specialite={account["specialite"]})'
                )
            )

        self.stdout.write(self.style.SUCCESS('seed_demo_users termine.'))
