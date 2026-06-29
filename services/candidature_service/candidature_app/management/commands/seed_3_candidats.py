# -*- coding: utf-8 -*-

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone

from candidature_app.models import Candidature, Master, Commission, MembreCommission

User = get_user_model()

# (nom du master, spécialité du diplôme, prénom, nom, email, score)
CANDIDATS = [
    {
        'master_nom': "Master Génie Logiciel et Systèmes d'Information",
        'specialite': "Génie Logiciel et Systèmes d'Information",
        'first_name': 'Ahmed', 'last_name': 'Ben Ali',
        'email': 'candidat.test.1@isimm.tn', 'score': 14.17,
    },
    {
        'master_nom': "Master Big Data et Analyse de Données",
        'specialite': "Big Data et Analyse de Données",
        'first_name': 'Fatima', 'last_name': 'Amira',
        'email': 'candidat.test.2@isimm.tn', 'score': 15.50,
    },
    {
        'master_nom': "Master Business Computing",
        'specialite': "Business Computing",
        'first_name': 'Marwen', 'last_name': 'Gharbi',
        'email': 'candidat.test.3@isimm.tn', 'score': 13.80,
    },
]


class Command(BaseCommand):
    help = "Nettoie et recrée EXACTEMENT 3 candidats de test (3 spécialités différentes)"

    def _ecrire(self, msg, style=None):
        try:
            self.stdout.write(style(msg) if style else msg)
        except UnicodeEncodeError:
            safe = msg.encode('ascii', 'replace').decode('ascii')
            self.stdout.write(style(safe) if style else safe)

    def _get_or_create_master(self, nom, specialite):
        """Réutilise un master existant (par nom) ou le crée — gère les doublons."""
        master = Master.objects.filter(nom=nom).first()
        if master:
            # met à jour la spécialité au besoin
            if (master.specialite or '') != specialite:
                master.specialite = specialite
                master.save(update_fields=['specialite'])
            return master
        return Master.objects.create(
            nom=nom,
            specialite=specialite,
            type_master='professionnel',
            places_disponibles=30,
            date_limite_candidature=timezone.now().date() + timedelta(days=30),
            annee_universitaire='2025-2026',
            actif=True,
            coeff_bac=0.4,
            coeff_licence=0.6,
        )

    def handle(self, *args, **options):
        # 1) NETTOYAGE : supprimer toutes les candidatures de test
        nb_avant = Candidature.objects.count()
        Candidature.objects.all().delete()
        self._ecrire(f'[CLEAN] {nb_avant} candidature(s) supprimee(s).', self.style.WARNING)

        # 2) RECRÉATION des 3 candidats
        crees = []
        for i, cfg in enumerate(CANDIDATS, 1):
            master = self._get_or_create_master(cfg['master_nom'], cfg['specialite'])

            user, _ = User.objects.get_or_create(
                email=cfg['email'],
                defaults={
                    'first_name': cfg['first_name'],
                    'last_name': cfg['last_name'],
                    'username': cfg['email'].split('@')[0],
                    'is_active': True,
                },
            )
            # garantir nom/prénom à jour
            user.first_name = cfg['first_name']
            user.last_name = cfg['last_name']
            user.save(update_fields=['first_name', 'last_name'])

            candidature = Candidature.objects.create(
                candidat=user,
                master=master,
                nature_candidature='externe',
                statut='selectionne',
                statut_inscription='selectionne',
                score=cfg['score'],
                dossier_depose=True,
                dossier_valide=True,
                date_depot_dossier=timezone.now(),
            )

            # S'assurer qu'une commission existe pour ce master (tests commission/OCR)
            Commission.objects.get_or_create(
                master=master,
                defaults={'nom': f'Commission - {master.nom}', 'actif': True},
            )

            crees.append(candidature)
            self._ecrire(
                f'[CREATE] #{i} {user.get_full_name():22} | {master.specialite:40} | '
                f'score={cfg["score"]} | {candidature.numero}',
                self.style.SUCCESS,
            )

        # 3) VÉRIFICATION : exactement 3
        total = Candidature.objects.count()
        self._ecrire('-' * 70)
        if total == 3:
            self._ecrire(f'[OK] Exactement {total} candidature(s) en base.', self.style.SUCCESS)
        else:
            self._ecrire(f'[ATTENTION] {total} candidature(s) en base (3 attendues).',
                         self.style.ERROR)
