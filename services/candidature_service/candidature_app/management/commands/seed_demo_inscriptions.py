# -*- coding: utf-8 -*-

import os

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from candidature_app.models import Candidature

# Numéro fixe attribué à Ranim dans l'Excel (à TAPER en live dans son espace).
RANIM_EMAIL = 'ranimjellali47@gmail.com'
RANIM_NUMERO = '20260417'
# Comptes exclus du seed : les deux « Ranim Jellali » (la vraie + le compte démo)
# pour qu'une SEULE Ranim apparaisse côté responsable, après la saisie live.
EMAILS_EXCLUS = [RANIM_EMAIL, 'ranim.jellali@demo.tn']

STATUTS_EXCLUS = ('rejete', 'rejetee', 'annule', 'annulee', 'abandonne')


class Command(BaseCommand):
    help = "Seed des inscriptions de démo + génération de l'Excel de rapprochement."

    def add_arguments(self, parser):
        parser.add_argument('--master-ids', type=str, default='18,20',
                            help='IDs de masters séparés par des virgules (défaut: 18,20).')
        parser.add_argument('--n', type=int, default=6,
                            help='Nombre max de candidats seedés par master (défaut: 6).')
        parser.add_argument('--reset', action='store_true',
                            help='Réinitialise d\'abord les saisies sur ces masters.')

    def handle(self, *args, **opts):
        master_ids = [int(x) for x in str(opts['master_ids']).split(',') if x.strip().isdigit()]
        n = opts['n']
        now = timezone.now()

        if opts['reset']:
            reset_qs = Candidature.objects.filter(master_id__in=master_ids)
            nb_reset = reset_qs.update(
                numero_inscription=None,
                statut_inscription='selectionne',
                date_saisie_inscription=None,
            )
            self.stdout.write(self.style.WARNING(f'Reset : {nb_reset} candidature(s) remises à zéro.'))

        seeded = []           # (numero_inscription, nom complet)
        seq = 0
        for mid in master_ids:
            qs = (
                Candidature.objects.select_related('candidat', 'master')
                .filter(master_id=mid)
                .exclude(statut__in=STATUTS_EXCLUS)
                .exclude(candidat__email__in=EMAILS_EXCLUS)
                .order_by('-score', '-id')
            )
            count = 0
            for c in qs:
                if count >= n:
                    break
                if not c.candidat:
                    continue
                seq += 1
                numero = f'2026{mid:02d}{seq:04d}'
                c.numero_inscription = numero
                c.statut_inscription = 'en_attente_verification'
                c.date_saisie_inscription = now
                c.save(update_fields=['numero_inscription', 'statut_inscription', 'date_saisie_inscription'])
                seeded.append((numero, c.candidat.get_full_name()))
                count += 1
            self.stdout.write(f'  Master {mid} : {count} inscription(s) seedée(s).')

        # ── Génération de l'Excel de rapprochement ───────────────────────────
        # On omet VOLONTAIREMENT le dernier numéro seedé (→ « non trouvé » en démo),
        # et on AJOUTE le numéro de Ranim (qu'elle saisira en live → confirmée).
        numeros_excel = [num for num, _ in seeded]
        omis = None
        if len(numeros_excel) >= 2:
            omis = seeded[-1]
            numeros_excel = numeros_excel[:-1]
        numeros_excel.append(RANIM_NUMERO)

        chemin_excel = self._generer_excel(numeros_excel)

        # ── Récapitulatif ────────────────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS(f'\n{len(seeded)} inscription(s) de démo créées.'))
        self.stdout.write(self.style.SUCCESS(f'Excel généré : {chemin_excel}'))
        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('À FAIRE EN VIDÉO :'))
        self.stdout.write(self.style.SUCCESS(
            f'  • Espace candidat de Ranim → saisir le numéro : {RANIM_NUMERO}'
        ))
        if omis:
            self.stdout.write(
                f'  • « Non trouvé » attendu à l\'import : {omis[1]} (n° {omis[0]}, absent de l\'Excel).'
            )
        self.stdout.write(
            '  • Espace responsable → « Importer les inscriptions » → upload de l\'Excel ci-dessus.'
        )

    def _generer_excel(self, numeros):
        import openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'Inscrits'
        ws.append(['numero_inscription'])
        for num in numeros:
            ws.append([num])

        dossier = os.path.join(settings.BASE_DIR, 'demo_files')
        os.makedirs(dossier, exist_ok=True)
        chemin = os.path.join(dossier, 'liste_inscriptions_officielles.xlsx')
        wb.save(chemin)
        return chemin
