# -*- coding: utf-8 -*-
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from candidature_app.models import Candidature, Commission, Master, MembreCommission

User = get_user_model()

DEFAULT_RESPONSABLE_EMAIL = 'responsable@isimm.tn'
DEFAULT_CANDIDATE_EMAIL = 'ranimjellali47@gmail.com'
DEFAULT_FIRST_NAME = 'Ranim'
DEFAULT_LAST_NAME = 'Jellali'


class Command(BaseCommand):
    help = (
        "Ensure Ranim Jellali has a candidature visible in the responsable "
        "candidatures space."
    )

    def add_arguments(self, parser):
        parser.add_argument('--responsable-email', default=DEFAULT_RESPONSABLE_EMAIL)
        parser.add_argument('--candidate-email', default=DEFAULT_CANDIDATE_EMAIL)
        parser.add_argument('--first-name', default=DEFAULT_FIRST_NAME)
        parser.add_argument('--last-name', default=DEFAULT_LAST_NAME)
        parser.add_argument('--master-id', type=int, default=None)
        parser.add_argument('--score', type=Decimal, default=Decimal('15.25'))
        parser.add_argument('--statut', default='soumis')

    def handle(self, *args, **options):
        responsable = User.objects.filter(
            email__iexact=options['responsable_email']
        ).first()
        if not responsable:
            raise CommandError(
                f"Responsable introuvable: {options['responsable_email']}"
            )

        master = self._resolve_master(responsable, options.get('master_id'))
        self._ensure_responsable_link(responsable, master)

        candidate = self._ensure_candidate(options)
        candidature, created = Candidature.objects.get_or_create(
            candidat=candidate,
            master=master,
            defaults={
                'nature_candidature': 'externe',
                'statut': options['statut'],
                'score': options['score'],
                'dossier_depose': False,
                'dossier_valide': False,
            },
        )

        changed = []
        if not candidature.score:
            candidature.score = options['score']
            changed.append('score')
        if changed:
            candidature.save(update_fields=changed + ['updated_at'])

        action = 'created' if created else 'ok'
        self.stdout.write(
            self.style.SUCCESS(
                f"[{action}] {candidate.get_full_name()} -> "
                f"{master.nom} ({candidature.numero})"
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Visible pour {responsable.email} via master_id={master.id}."
            )
        )

    def _resolve_master(self, responsable, master_id):
        if master_id:
            try:
                return Master.objects.get(id=master_id)
            except Master.DoesNotExist as exc:
                raise CommandError(f"Master introuvable: {master_id}") from exc

        assigned_master_ids = list(
            MembreCommission.objects.filter(
                user=responsable,
                actif=True,
                commission__actif=True,
                commission__master__isnull=False,
            ).values_list('commission__master_id', flat=True)
        )
        if assigned_master_ids:
            return Master.objects.filter(id__in=assigned_master_ids).order_by('id').first()

        master = Master.objects.filter(actif=True).order_by('id').first()
        if not master:
            raise CommandError("Aucun master actif disponible pour créer la candidature.")
        return master

    def _ensure_responsable_link(self, responsable, master):
        commission, _ = Commission.objects.get_or_create(
            master=master,
            defaults={'nom': f'Commission - {master.nom}', 'actif': True},
        )
        if not commission.actif:
            commission.actif = True
            commission.save(update_fields=['actif'])

        membre, _ = MembreCommission.objects.get_or_create(
            commission=commission,
            user=responsable,
            defaults={'role': 'responsable', 'actif': True},
        )

        changed = []
        if membre.role != 'responsable':
            membre.role = 'responsable'
            changed.append('role')
        if not membre.actif:
            membre.actif = True
            changed.append('actif')
        if changed:
            membre.save(update_fields=changed)
        membre.commissions.add(commission)

    def _ensure_candidate(self, options):
        email = options['candidate_email']
        candidate = User.objects.filter(email__iexact=email).first()
        if not candidate:
            candidate = User.objects.create(
                username=email.split('@')[0][:150],
                email=email,
                first_name=options['first_name'],
                last_name=options['last_name'],
                is_active=True,
            )
            candidate.set_unusable_password()
            candidate.save(update_fields=['password'])

        changed = []
        if candidate.first_name != options['first_name']:
            candidate.first_name = options['first_name']
            changed.append('first_name')
        if candidate.last_name != options['last_name']:
            candidate.last_name = options['last_name']
            changed.append('last_name')
        if not candidate.is_active:
            candidate.is_active = True
            changed.append('is_active')
        if changed:
            candidate.save(update_fields=changed)
        return candidate
