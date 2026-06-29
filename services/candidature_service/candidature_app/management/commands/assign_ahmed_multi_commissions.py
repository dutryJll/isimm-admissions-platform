# -*- coding: utf-8 -*-
"""
Assigne ahmed.gharbi@isimm.tn à PLUSIEURS commissions (multi-master) :
  - Master Génie Logiciel  (MPGL)
  - Master Sciences des Données / Big Data (MPDS)

Idempotent : relançable sans créer de doublons.

Usage:
    python manage.py assign_ahmed_multi_commissions
"""
from django.core.management.base import BaseCommand
from django.db.models import Q
from django.contrib.auth import get_user_model

from candidature_app.models import Master, Commission, MembreCommission

User = get_user_model()
EMAIL = 'ahmed.gharbi@isimm.tn'


class Command(BaseCommand):
    help = "Assigne ahmed.gharbi à 2 commissions (Génie Logiciel + Sciences des Données)"

    def _trouver_master(self, *patterns):
        """Retourne le master qui possède déjà une commission, sinon le 1er trouvé."""
        q = Q()
        for p in patterns:
            q |= Q(nom__icontains=p) | Q(specialite__icontains=p)
        masters = list(Master.objects.filter(q))
        if not masters:
            return None
        # Préférer un master qui a déjà une commission active
        for m in masters:
            if Commission.objects.filter(master=m, actif=True).exists():
                return m
        return masters[0]

    def _assigner(self, membre, master, label):
        if master is None:
            self.stdout.write(self.style.WARNING(f'  Master {label} introuvable — ignoré.'))
            return None
        commission, _ = Commission.objects.get_or_create(
            master=master,
            defaults={'nom': f'Commission - {master.nom}', 'actif': True},
        )
        mc, created = MembreCommission.objects.get_or_create(
            commission=commission,
            user=membre,
            defaults={'role': 'membre', 'actif': True},
        )
        # S'assurer que le lien est actif + synchroniser la M2M
        if not mc.actif:
            mc.actif = True
            mc.save(update_fields=['actif'])
        mc.commissions.add(commission)

        etat = 'créé' if created else 'déjà présent'
        self.stdout.write(self.style.SUCCESS(
            f'  [{label}] {commission.nom} — lien {etat}'
        ))
        return commission

    def handle(self, *args, **options):
        try:
            membre = User.objects.get(email=EMAIL)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Utilisateur {EMAIL} introuvable.'))
            return

        self.stdout.write(f'Assignation de {EMAIL} :')

        mpgl = self._trouver_master('Génie Logiciel', 'Genie Logiciel')
        mpds = self._trouver_master('Sciences des Données', 'Sciences des Donnees',
                                    'Big Data', 'Data Science')

        self._assigner(membre, mpgl, 'MPGL')
        self._assigner(membre, mpds, 'MPDS')

        nb = MembreCommission.objects.filter(user=membre, actif=True).count()
        self.stdout.write(self.style.SUCCESS(
            f'\nTerminé — {membre.email} est membre de {nb} commission(s).'
        ))
