# -*- coding: utf-8 -*-
"""
Assigne ahmed.gharbi@isimm.tn à la commission "Master Génie Logiciel" (MPGL).

Idempotent — relançable sans créer de doublon.

Usage:
    python manage.py assign_ahmed_mpgl

Équivalent Django shell (python manage.py shell) :
    from django.contrib.auth import get_user_model
    from candidature_app.models import Master, Commission, MembreCommission
    User = get_user_model()
    membre = User.objects.get(email='ahmed.gharbi@isimm.tn')
    master = Master.objects.filter(specialite__icontains='Génie Logiciel').first()
    commission, _ = Commission.objects.get_or_create(
        master=master, defaults={'nom': f'Commission - {master.nom}', 'actif': True})
    MembreCommission.objects.get_or_create(
        commission=commission, user=membre, defaults={'role': 'membre', 'actif': True})
    print(f"{membre.email} → {commission.nom}")
"""
from django.core.management.base import BaseCommand
from django.db.models import Q
from django.contrib.auth import get_user_model

from candidature_app.models import Master, Commission, MembreCommission

User = get_user_model()
EMAIL = 'ahmed.gharbi@isimm.tn'


class Command(BaseCommand):
    help = "Assigne ahmed.gharbi à la commission Master Génie Logiciel (MPGL)"

    def handle(self, *args, **options):
        # 1) Utilisateur
        try:
            membre = User.objects.get(email=EMAIL)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Utilisateur {EMAIL} introuvable.'))
            return

        # 2) Master Génie Logiciel (préférer celui ayant déjà une commission)
        masters = Master.objects.filter(
            Q(nom__icontains='Génie Logiciel') | Q(nom__icontains='Genie Logiciel') |
            Q(specialite__icontains='Génie Logiciel') | Q(specialite__icontains='Genie Logiciel')
        )
        master = None
        for m in masters:
            if Commission.objects.filter(master=m, actif=True).exists():
                master = m
                break
        master = master or masters.first()

        if not master:
            self.stdout.write(self.style.ERROR('Aucun master "Génie Logiciel" trouvé.'))
            return

        # 3) Lien MembreCommission
        commission, _ = Commission.objects.get_or_create(
            master=master,
            defaults={'nom': f'Commission - {master.nom}', 'actif': True},
        )
        mc, created = MembreCommission.objects.get_or_create(
            commission=commission,
            user=membre,
            defaults={'role': 'membre', 'actif': True},
        )
        if not mc.actif:
            mc.actif = True
            mc.save(update_fields=['actif'])
        mc.commissions.add(commission)

        # 4) Vérification
        etat = 'cree' if created else 'deja existant'
        msg = f'{membre.email} -> {commission.nom}  (lien {etat})'
        try:
            self.stdout.write(self.style.SUCCESS(msg))
        except UnicodeEncodeError:
            self.stdout.write(self.style.SUCCESS(msg.encode('ascii', 'replace').decode('ascii')))
