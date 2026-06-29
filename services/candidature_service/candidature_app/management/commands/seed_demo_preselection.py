# -*- coding: utf-8 -*-
"""
MOD v6 §1 — Données de démonstration pour la phase de PRÉSÉLECTION (vidéo PFE).

Crée des candidats fictifs répartis sur un ou plusieurs masters (pour varier la
spécialité affichée), remplit le tableau « Réponses des membres » (AvisMembre),
et marque les candidats présélectionnés comme ayant déposé leur dossier.

Spécificités demandées :
  - Ranim Jellali : étudiante ISIMM (interne) + dossier déposé.
  - Les présélectionnés déposent aussi leur dossier (dossier_depose = True).
  - La spécialité affichée = master.specialite → on répartit donc les candidats
    sur plusieurs masters pour éviter une spécialité unique (ex : Génie Logiciel
    + Business Computing au lieu de tout « Big Data »).

Adapté aux modèles RÉELS : Candidature, AvisMembre(avis bool + argument),
MembreCommission, Commission, Master.

Usage :
    # un seul master
    python manage.py seed_demo_preselection --master-id 18 --n 8 --reset
    # plusieurs masters (spécialités variées) — recommandé
    python manage.py seed_demo_preselection --master-ids 18,20 --n 8 --reset
"""
import random
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.utils import timezone

from candidature_app.models import (
    Candidature, Master, Commission, MembreCommission, AvisMembre,
)

User = get_user_model()

# (nom, prénom) — candidats fictifs de démo
NOMS_DEMO = [
    ("Ben Ali", "Ahmed"), ("Jellali", "Ranim"), ("Gharbi", "Marwen"),
    ("Amira", "Fatima"), ("Trabelsi", "Yassine"), ("Mejri", "Salma"),
    ("Bouazizi", "Karim"), ("Hammami", "Nour"), ("Sassi", "Iheb"),
    ("Khelifi", "Mariem"),
]

MEMBRES_DEMO = [("Membre", "Demo Un"), ("Membre", "Demo Deux"), ("Membre", "Demo Trois")]

ARGS_FAV = [
    "Dossier conforme, profil solide.", "Bon parcours académique.",
    "Moyennes régulières, candidat sérieux.", "",
]
ARGS_DEF = [
    "Moyennes insuffisantes pour le quota.", "Profil hors spécialité demandée.",
    "Trop de redoublements.",
]

# statut de présélection (pondéré vers présélectionné pour une démo lisible)
STATUTS_PRESEL = ['preselectionne', 'preselectionne', 'preselectionne', 'en_attente', 'rejete']
# statuts considérés comme « dossier déposé » → on force dossier_depose = True
STATUTS_AVEC_DOSSIER = {'preselectionne', 'dossier_depose', 'selectionne'}


class Command(BaseCommand):
    help = "Crée des candidats fictifs + avis membres pour la démo vidéo PFE (présélection)."

    def add_arguments(self, parser):
        parser.add_argument('--master-id', type=int, help="ID d'un master à peupler")
        parser.add_argument('--master-ids', type=str,
                            help="IDs de masters séparés par des virgules (spécialités variées)")
        parser.add_argument('--n', type=int, default=8, help="Nombre total de candidats (max 10)")
        parser.add_argument('--reset', action='store_true',
                            help="Supprime TOUS les candidats de démo (tous masters) avant de recréer")

    def _w(self, msg, style=None):
        try:
            self.stdout.write(style(msg) if style else msg)
        except UnicodeEncodeError:
            safe = msg.encode('ascii', 'replace').decode('ascii')
            self.stdout.write(style(safe) if style else safe)

    def _resolve_masters(self, opts):
        ids = []
        if opts.get('master_ids'):
            for part in str(opts['master_ids']).split(','):
                part = part.strip()
                if part.isdigit():
                    ids.append(int(part))
        if opts.get('master_id'):
            ids.append(int(opts['master_id']))
        # dé-duplique en gardant l'ordre
        ids = list(dict.fromkeys(ids))
        if not ids:
            raise CommandError("Fournissez --master-id ou --master-ids.")
        masters = []
        for mid in ids:
            try:
                masters.append(Master.objects.get(pk=mid))
            except Master.DoesNotExist:
                raise CommandError(f"Master #{mid} introuvable.")
        return masters

    def _membres(self, master):
        """Membres actifs de la commission du master (en crée si aucun)."""
        commission, _ = Commission.objects.get_or_create(
            master=master, defaults={'nom': f'Commission - {master.nom}', 'actif': True},
        )
        membres = list(MembreCommission.objects.filter(commission=commission, actif=True))
        if membres:
            return commission, membres
        crees = []
        for i, (nom, prenom) in enumerate(MEMBRES_DEMO):
            user, _ = User.objects.get_or_create(
                username=f"demo_membre_{i+1}",
                defaults={'email': f"membre{i+1}@demo.tn", 'first_name': prenom,
                          'last_name': nom, 'is_active': True},
            )
            mc, _ = MembreCommission.objects.get_or_create(
                commission=commission, user=user, defaults={'role': 'membre', 'actif': True},
            )
            crees.append(mc)
        return commission, crees

    def handle(self, *args, **opts):
        n = max(1, min(int(opts['n']), len(NOMS_DEMO)))
        masters = self._resolve_masters(opts)

        if opts['reset']:
            qs = Candidature.objects.filter(candidat__username__startswith='demo_cand_')
            nb = qs.count()
            qs.delete()
            self._w(f"[CLEAN] {nb} candidature(s) de demo supprimee(s) (tous masters).",
                    self.style.WARNING)

        # Pré-charge membres par master
        membres_par_master = {m.id: self._membres(m) for m in masters}

        nb_avis = 0
        for i, (nom, prenom) in enumerate(NOMS_DEMO[:n]):
            # Répartition round-robin sur les masters → spécialités variées
            master = masters[i % len(masters)]
            commission, membres = membres_par_master[master.id]

            user, _ = User.objects.get_or_create(
                username=f"demo_cand_{i+1}",
                defaults={'email': f"{prenom.lower()}.{nom.lower().replace(' ', '')}@demo.tn",
                          'first_name': prenom, 'last_name': nom, 'is_active': True},
            )
            user.first_name, user.last_name = prenom, nom
            user.save(update_fields=['first_name', 'last_name'])

            is_ranim = (nom == 'Jellali' and prenom == 'Ranim')

            if is_ranim:
                # Ranim : étudiante ISIMM (interne) + dossier déposé
                statut = 'dossier_depose'
                nature = 'isimm'
            else:
                statut = random.choice(STATUTS_PRESEL)
                nature = 'isimm' if i % 2 == 0 else 'externe'

            dossier_depose = is_ranim or statut in STATUTS_AVEC_DOSSIER

            candidature, _ = Candidature.objects.update_or_create(
                candidat=user, master=master,
                defaults=dict(
                    nature_candidature=nature,
                    statut=statut,
                    score=round(random.uniform(8.0, 17.0), 2),
                    dossier_depose=dossier_depose,
                    dossier_valide=dossier_depose and statut != 'rejete',
                    date_depot_dossier=timezone.now() - timedelta(days=random.randint(1, 10)),
                ),
            )

            for membre in membres:
                fav = random.random() > 0.35
                AvisMembre.objects.update_or_create(
                    membre=membre, candidature=candidature, commission=commission,
                    defaults=dict(avis=fav, argument=random.choice(ARGS_FAV if fav else ARGS_DEF)),
                )
                nb_avis += 1

            self._w(
                f"[CREATE] #{i+1} {user.get_full_name():22} | {master.specialite[:28]:28} "
                f"| {nature:7} | statut={statut:15} | dossier={'oui' if dossier_depose else 'non'} "
                f"| score={candidature.score}",
                self.style.SUCCESS,
            )

        self._w('-' * 80)
        self._w(self.style.SUCCESS(
            f"OK : {n} candidat(s) de demo + {nb_avis} avis, repartis sur "
            f"{len(masters)} master(s): {', '.join(str(m.id) for m in masters)}."
        ))
