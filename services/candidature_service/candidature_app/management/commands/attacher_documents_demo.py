# -*- coding: utf-8 -*-
"""
Attache les relevés de notes démo aux candidatures, SANS passer par l'UI ni se
connecter dans l'espace de chaque candidat.

ADAPTÉ aux modèles/stockage RÉELS du projet (différents du script d'origine) :

  - Le modèle de candidature est `Candidature` (champ `master`, PAS `offre`).
  - Les candidats démo créés par `seed_demo_preselection.py` ont un username
    `demo_cand_N` mais un EMAIL stable `prenom.nom@demo.tn` → on matche par EMAIL.
  - ⚠️ L'OCR par lot (`analyser_ocr_lot`) ET la liste « Voir/Télécharger » du
    dossier (`list_fichiers_deposes`) lisent les fichiers depuis le SYSTÈME DE
    FICHIERS : `MEDIA_ROOT/dossiers/<candidature_id>/<sous-dossier>/<fichier>.pdf`
    — et NON depuis le modèle `Document` (dont le FileField pointe vers
    `candidatures/AAAA/MM/JJ/`). On copie donc les PDF dans `dossiers/...` pour
    que la démo OCR (cas 7.1 / 7.2) et le bouton « Voir » fonctionnent vraiment.

Usage :
  python manage.py attacher_documents_demo --dossier-source "C:/.../demo_v7_releves_ocr"
  python manage.py attacher_documents_demo --dossier-source "..." --master-id 18

Pré-requis : avoir lancé `seed_demo_preselection.py` pour que les candidats existent.
"""
import os
import shutil

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from candidature_app.models import Candidature

# Sous-dossier sous dossiers/<id>/ (affiché « Releve de notes » par list_fichiers_deposes)
SOUS_DOSSIER = 'Releve_de_notes'

# Mapping par EMAIL (stable) → nom de fichier PDF source.
MAPPING = {
    'ranim.jellali@demo.tn':  '05_releves_notes_RanimJellali.pdf',
    'ahmed.benali@demo.tn':   'releves_notes_AhmedBenAli.pdf',
    'marwen.gharbi@demo.tn':  'releves_notes_MarwenGharbi.pdf',
    'fatima.amira@demo.tn':   'releves_notes_FatimaAmira.pdf',
    'karim.bouazizi@demo.tn': 'releves_notes_KarimBouazizi.pdf',
}


class Command(BaseCommand):
    help = "Attache les relevés de notes démo aux candidatures (sans UI, sans login candidat)."

    def add_arguments(self, parser):
        parser.add_argument('--dossier-source', type=str, required=True,
                            help="Dossier local contenant les 5 PDF (relevés de notes démo)")
        parser.add_argument('--master-id', type=int, default=None,
                            help="(optionnel) limite l'attachement aux candidatures de ce master")

    def handle(self, *args, **opts):
        source_dir = opts['dossier_source']
        master_id = opts.get('master_id')

        if not os.path.isdir(source_dir):
            raise CommandError(f"Dossier introuvable : {source_dir}")

        media_root = str(getattr(settings, 'MEDIA_ROOT', ''))
        if not media_root:
            raise CommandError("MEDIA_ROOT non configuré.")

        ok, manquants, sans_candidature = 0, [], []

        for email, filename in MAPPING.items():
            filepath = os.path.join(source_dir, filename)
            if not os.path.exists(filepath):
                self.stdout.write(self.style.WARNING(f"[ABSENT] Fichier source : {filename}"))
                manquants.append(filename)
                continue

            qs = Candidature.objects.filter(candidat__email__iexact=email)
            if master_id:
                qs = qs.filter(master_id=master_id)
            candidatures = list(qs)

            if not candidatures:
                self.stdout.write(self.style.WARNING(
                    f"[INTROUVABLE] Aucune candidature pour {email}"
                    + (f" (master {master_id})" if master_id else '')
                    + " — as-tu lancé seed_demo_preselection ?"
                ))
                sans_candidature.append(email)
                continue

            # Copie le PDF dans dossiers/<id>/Releve_de_notes/<fichier> (lu par l'OCR + « Voir »)
            for cand in candidatures:
                dest_dir = os.path.join(media_root, 'dossiers', str(cand.id), SOUS_DOSSIER)
                os.makedirs(dest_dir, exist_ok=True)
                shutil.copyfile(filepath, os.path.join(dest_dir, filename))

                # Marque le dossier comme déposé pour la cohérence des écrans
                updates = []
                if not cand.dossier_depose:
                    cand.dossier_depose = True
                    updates.append('dossier_depose')
                if updates:
                    updates.append('updated_at')
                    cand.save(update_fields=updates)

                self.stdout.write(self.style.SUCCESS(
                    f"[OK] {email:<26} → candidature #{cand.id} ({cand.numero}) ← {filename}"
                ))
                ok += 1

        self.stdout.write('-' * 72)
        self.stdout.write(self.style.SUCCESS(f"Terminé — {ok} relevé(s) attaché(s)."))
        if manquants:
            self.stdout.write(self.style.WARNING(
                f"Fichiers source manquants dans {source_dir} : {', '.join(manquants)}"
            ))
        if sans_candidature:
            self.stdout.write(self.style.WARNING(
                f"Emails sans candidature : {', '.join(sans_candidature)}"
            ))
