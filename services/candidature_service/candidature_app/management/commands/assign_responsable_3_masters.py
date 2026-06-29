# -*- coding: utf-8 -*-
"""
Assigne responsable@isimm.tn (rôle responsable) aux commissions des 3 masters
des candidats seed, afin qu'il voie les 3 candidats dans l'espace responsable.

Idempotent.

Usage:
    python manage.py assign_responsable_3_masters [--email autre@isimm.tn]
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from candidature_app.models import Candidature, Commission, MembreCommission

User = get_user_model()
DEFAULT_EMAIL = 'responsable@isimm.tn'


class Command(BaseCommand):
    help = "Assigne le responsable aux commissions des 3 masters des candidats seed"

    def add_arguments(self, parser):
        parser.add_argument('--email', default=DEFAULT_EMAIL)

    def _ecrire(self, msg, style=None):
        try:
            self.stdout.write(style(msg) if style else msg)
        except UnicodeEncodeError:
            safe = msg.encode('ascii', 'replace').decode('ascii')
            self.stdout.write(style(safe) if style else safe)

    def handle(self, *args, **options):
        email = options['email']
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            self._ecrire(f'Utilisateur {email} introuvable.', self.style.ERROR)
            return

        # Masters distincts des candidats seed
        masters = []
        for c in Candidature.objects.select_related('master').all():
            if c.master and c.master not in masters:
                masters.append(c.master)
        if not masters:
            self._ecrire('Aucun master/candidat seed (lancez seed_3_candidats).',
                         self.style.WARNING)
            return

        # Commission cible par master
        cibles = []
        for master in masters:
            commission, _ = Commission.objects.get_or_create(
                master=master,
                defaults={'nom': f'Commission - {master.nom}', 'actif': True},
            )
            if not commission.actif:
                commission.actif = True
                commission.save(update_fields=['actif'])
            cibles.append(commission)

        ids_cibles = {c.id for c in cibles}

        # Retirer les liens hors cibles
        retires = 0
        for mc in MembreCommission.objects.filter(user=user).exclude(commission_id__in=ids_cibles):
            mc.delete()
            retires += 1

        # Créer/activer les liens responsable
        for commission in cibles:
            mc, created = MembreCommission.objects.get_or_create(
                commission=commission,
                user=user,
                defaults={'role': 'responsable', 'actif': True},
            )
            changed = []
            if mc.role != 'responsable':
                mc.role = 'responsable'; changed.append('role')
            if not mc.actif:
                mc.actif = True; changed.append('actif')
            if changed:
                mc.save(update_fields=changed)
            mc.commissions.add(commission)
            nb = Candidature.objects.filter(master=commission.master).count()
            self._ecrire(
                f'[{"cree" if created else "ok"}] commission {commission.id} - '
                f'{commission.nom[:45]} ({nb} candidat(s))',
                self.style.SUCCESS,
            )

        total = MembreCommission.objects.filter(user=user, actif=True).count()
        self._ecrire('-' * 70)
        self._ecrire(
            f'{user.email} : {total} commission(s) (responsable), {retires} lien(s) retire(s).',
            self.style.SUCCESS,
        )
