# -*- coding: utf-8 -*-
"""
Synchronise ahmed.gharbi@isimm.tn sur EXACTEMENT les commissions des 3 masters
des candidats seed (Génie Logiciel + Big Data + Business Computing), afin qu'il
voie les 3 candidats de test depuis l'espace membre.

- Crée une commission par master seed si absente
- Ajoute le lien MembreCommission pour ces 3 commissions
- Retire les liens d'ahmed vers les autres commissions (ex: anciennes "Demo")

Idempotent — relançable sans doublon.

Usage:
    python manage.py assign_ahmed_3_masters
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from candidature_app.models import Candidature, Commission, MembreCommission

User = get_user_model()
EMAIL = 'ahmed.gharbi@isimm.tn'


class Command(BaseCommand):
    help = "Assigne ahmed.gharbi aux commissions des 3 masters des candidats seed"

    def _ecrire(self, msg, style=None):
        try:
            self.stdout.write(style(msg) if style else msg)
        except UnicodeEncodeError:
            safe = msg.encode('ascii', 'replace').decode('ascii')
            self.stdout.write(style(safe) if style else safe)

    def handle(self, *args, **options):
        try:
            membre = User.objects.get(email=EMAIL)
        except User.DoesNotExist:
            self._ecrire(f'Utilisateur {EMAIL} introuvable.', self.style.ERROR)
            return

        # 1) Masters distincts des candidats seed
        masters = []
        for c in Candidature.objects.select_related('master').all():
            if c.master and c.master not in masters:
                masters.append(c.master)

        if not masters:
            self._ecrire('Aucune candidature/master en base (lancez seed_3_candidats).',
                         self.style.WARNING)
            return

        # 2) Commission cible par master (créée si absente)
        commissions_cibles = []
        for master in masters:
            commission, created = Commission.objects.get_or_create(
                master=master,
                defaults={'nom': f'Commission - {master.nom}', 'actif': True},
            )
            if not commission.actif:
                commission.actif = True
                commission.save(update_fields=['actif'])
            commissions_cibles.append(commission)

        ids_cibles = {c.id for c in commissions_cibles}

        # 3) Retirer les liens d'ahmed hors cibles
        retires = 0
        for mc in MembreCommission.objects.filter(user=membre).exclude(commission_id__in=ids_cibles):
            mc.delete()
            retires += 1

        # 4) Créer/activer les liens vers les 3 commissions cibles
        for commission in commissions_cibles:
            mc, created = MembreCommission.objects.get_or_create(
                commission=commission,
                user=membre,
                defaults={'role': 'membre', 'actif': True},
            )
            if not mc.actif:
                mc.actif = True
                mc.save(update_fields=['actif'])
            mc.commissions.add(commission)
            nb = Candidature.objects.filter(master=commission.master).count()
            etat = 'cree' if created else 'ok'
            self._ecrire(
                f'[{etat}] commission {commission.id} - {commission.nom[:45]} '
                f'({nb} candidat(s))',
                self.style.SUCCESS,
            )

        self._ecrire('-' * 70)
        total = MembreCommission.objects.filter(user=membre, actif=True).count()
        self._ecrire(
            f'{membre.email} : {total} commission(s) active(s), {retires} lien(s) retire(s).',
            self.style.SUCCESS,
        )
