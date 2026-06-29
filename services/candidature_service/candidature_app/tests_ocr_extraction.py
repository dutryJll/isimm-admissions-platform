# -*- coding: utf-8 -*-
"""
MOD v7 §4 — Test de non-régression de l'extraction OCR des moyennes L1/L2/L3.

Reproduit le bug réel : un relevé formulé « 1ère année … Moyenne annuelle : 12.80 »
n'était pas reconnu par l'ancien regex rigide (« Moyenne L1 : XX »).

Aucune DB requise → SimpleTestCase.
"""
from django.test import SimpleTestCase

from candidature_app.ocr_service import OCRService


class OCRExtractionMoyennesTest(SimpleTestCase):
    # Les 3 lignes exactes fournies dans le ticket bug.
    TEXTE = (
        "1ère année Licence (2021-2022) — Moyenne annuelle : 12.80 / 20 — Session : Principale\n"
        "2ème année Licence (2022-2023) — Moyenne annuelle : 13.20 / 20 — Session : Rattrapage\n"
        "3ème année Licence (2023-2024) — Moyenne annuelle : 14.20 / 20 — Session : Principale\n"
    )

    def test_extraction_l1_l2_l3(self):
        notes = OCRService.extraire_notes_detaillees(self.TEXTE)
        self.assertEqual(notes.get('l1'), 12.80)
        self.assertEqual(notes.get('l2'), 13.20)
        self.assertEqual(notes.get('l3'), 14.20)

    def test_moyenne_generale_recalculee(self):
        notes = OCRService.extraire_notes_detaillees(self.TEXTE)
        detail = OCRService.recalculer_score_depuis_notes(notes)
        # (12.80 + 13.20 + 14.20) / 3 = 13.40
        self.assertAlmostEqual(detail['mg'], 13.40, places=2)

    def test_redoublement_non_mentionne_donne_bnr_null(self):
        # MOD v7 §3 — aucune mention de redoublement => B.N.R NON détecté (pas 5 par défaut).
        notes = OCRService.extraire_notes_detaillees(self.TEXTE)
        detail = OCRService.recalculer_score_depuis_notes(notes)
        self.assertIsNone(detail['redoublements'])
        self.assertIsNone(detail['bnr'])
        self.assertIn('B.N.R', detail['composantes_non_detectees'])

    def test_session_rattrapage_detectee(self):
        # 1 rattrapage (2ème année) => sessions = 1 => B.S.P = 2.
        notes = OCRService.extraire_notes_detaillees(self.TEXTE)
        self.assertEqual(notes.get('sessions_rattrapage'), 1)
        detail = OCRService.recalculer_score_depuis_notes(notes)
        self.assertEqual(detail['bsp'], 2)

    def test_formulations_alternatives(self):
        # Autres libellés courants : « L1 : 11,50 », « Année 2 ... Moy. 12.00 », « 13.00 de moyenne ».
        texte = (
            "L1 : 11,50 / 20\n"
            "Année 2 — Moy. : 12.00\n"
            "Troisième année : 13.00 de moyenne\n"
        )
        notes = OCRService.extraire_notes_detaillees(texte)
        self.assertEqual(notes.get('l1'), 11.50)
        self.assertEqual(notes.get('l2'), 12.00)
        self.assertEqual(notes.get('l3'), 13.00)
