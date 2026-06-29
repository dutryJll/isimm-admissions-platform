"""
OCR Service — Extraction réelle des scores/moyennes depuis PDF
Utilise pdfplumber (extraction texte) + EasyOCR (fallback OCR image)

Req-3 — Actions automatiques :
- conforme (écart ≤ 0.5) → pièce validée auto
- incoherence (écart > 0.5) → alerte "Dossier Suspect"
"""

import re
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    import easyocr
except ImportError:
    easyocr = None

try:
    from pdf2image import convert_from_path
except ImportError:
    convert_from_path = None

try:
    import pytesseract
    from PIL import Image
except ImportError:
    pytesseract = None
    Image = None


# ─────────────────────────────────────────────────────────────────────────────
# v4 §7 — Détection de la spécialité et du type de diplôme (relevé / diplôme)
# Dictionnaires de correspondances (à enrichir selon les formats réels ISIMM).
# ─────────────────────────────────────────────────────────────────────────────
SPECIALITES_KEYWORDS = {
    "Licence en Sciences de l'Informatique": [
        "sciences de l'informatique", "sciences de l informatique",
        "licence si", "génie logiciel", "genie logiciel",
    ],
    "Licence en Informatique de Gestion": [
        "informatique de gestion", "info de gestion", "informatique gestion",
    ],
    "Licence en Mathématiques Appliquées": [
        "mathématiques appliquées", "mathematiques appliquees", "math appli",
    ],
    "Licence EEA": [
        "électronique électrotechnique automatique",
        "electronique electrotechnique automatique",
        "eea", "génie électrique", "genie electrique",
    ],
    "Licence TIC": [
        "technologies de l'information", "technologies de l information",
        "tic", "réseaux et iot", "reseaux et iot",
    ],
    "Licence Mesures et Instrumentation": [
        "mesures et instrumentation", "métrologie", "metrologie",
    ],
    "Maîtrise en Informatique": [
        "maîtrise en informatique", "maitrise en informatique",
    ],
}

DIPLOME_KEYWORDS = {
    "maitrise": ["maîtrise", "maitrise", "master 1", "mastere 1", "master i"],
    "licence": ["licence", "bachelor", "licence appliquée", "licence fondamentale"],
}


class OCRService:
    """Service d'extraction de moyennes depuis PDF (réel, pas simulation)."""

    @staticmethod
    def extraire_texte_pdf(fichier_path: str) -> str:
        """
        Extraction texte directe (PDF texte) + fallback OCR (PDF scanné).

        Args:
            fichier_path: Chemin du PDF

        Returns:
            Texte extrait du PDF
        """
        texte = ''

        # ÉTAPE 1 — pdfplumber (extraction texte directe, rapide et précis)
        if pdfplumber is None:
            logger.warning("pdfplumber non installé — impossible d'extraire le texte")
            return ''

        try:
            with pdfplumber.open(fichier_path) as pdf:
                for page in pdf.pages:
                    t = page.extract_text() or ''
                    texte += t + '\n'
        except Exception as e:
            logger.warning(f"Erreur pdfplumber: {e}")
            texte = ''

        # ÉTAPE 2 — Fallback : si pas assez de texte, utiliser OCR image
        if len(texte.strip()) < 20:
            texte = OCRService._ocr_image_fallback(fichier_path)

        return texte

    @staticmethod
    def _ocr_image_fallback(fichier_path: str) -> str:
        """Fallback OCR image si le PDF est scanné — utilise EasyOCR."""
        if easyocr is None or convert_from_path is None:
            logger.warning("easyocr/pdf2image non installé — impossible de faire l'OCR image")
            return ''

        try:
            images = convert_from_path(fichier_path, dpi=200)
            textes = []
            reader = easyocr.Reader(['fr', 'en'])

            for img in images[:4]:  # Max 4 pages
                results = reader.readtext(img)
                texte = '\n'.join([text for (_, text, _) in results])
                textes.append(texte)

            return '\n'.join(textes)
        except Exception as e:
            logger.warning(f"Erreur EasyOCR: {e}")
            return ''

    @staticmethod
    def extraire_moyenne(texte: str) -> Optional[float]:
        """
        Cherche la moyenne dans le texte avec plusieurs patterns regex.
        Ordre = priorité (plus spécifique → plus générique).

        Args:
            texte: Texte extrait du PDF

        Returns:
            Valeur moyenne extraite (float) ou None
        """
        patterns = [
            # "Moyenne Générale : 14.17 / 20"
            r'[Mm]oyenne\s*[Gg][ée]n[ée]rale\s*[:\-]?\s*(\d{1,2}[.,]\d{1,2})',
            # "Moyenne Générale : 14.17 / 20" (variante)
            r'[Mm]oyenne\s*[Gg][ée]n[ée]rale\s*[:\-]?\s*(\d{1,2}[.,]\d{1,2})\s*/\s*20',
            # "M.G : 14.17" / "MG = 14.17"
            r'\bm\.?g\.?\s*[:\-–=]?\s*(\d{1,2}[.,]\d{1,2})',
            # "Score Total : 14.17"
            r'score\s*total\s*[:\-–=]?\s*(\d{1,2}[.,]\d{1,2})',
            # "Moyenne : 14.17"
            r'[Mm]oyenne\s*[:\-]?\s*(\d{1,2}[.,]\d{1,2})',
            # "14.17 / 20"
            r'(\d{1,2}[.,]\d{1,2})\s*/\s*20',
            # "Total : 14.17"
            r'total\s*[:\-]?\s*(\d{1,2}[.,]\d{1,2})',
            # Score isolé "14.17"
            r'\b(\d{1,2}[.,]\d{1,2})\b',
        ]

        for pattern in patterns:
            match = re.search(pattern, texte, re.IGNORECASE)
            if match:
                valeur_str = match.group(1).replace(',', '.')
                try:
                    moyenne = float(valeur_str)
                    if 0 <= moyenne <= 20:
                        return moyenne
                except ValueError:
                    continue

        return None

    @staticmethod
    def extraire_notes_detaillees(texte: str) -> dict:
        """
        Extrait L1, L2, L3, redoublements et sessions du texte OCR.

        Returns:
            {
                'l1': 13.50,
                'l2': 14.00,
                'l3': 15.01,
                'redoublements': 0,
                'sessions_rattrapage': 0
            }
        """
        texte = texte or ''
        notes = {}

        # MOD v7 §1 — Log de debug : texte BRUT extrait (avant tout regex).
        logger.info(
            "OCR — texte brut extrait (%d caracteres) :\n----- DEBUT OCR -----\n%s\n----- FIN OCR -----",
            len(texte), texte[:2000],
        )

        lignes = [ligne for ligne in re.split(r'[\r\n]+', texte) if ligne.strip()]

        # MOD v7 §2 — Détecteurs d'année tolérants (L1 / 1ère année / Année 1 / première année…)
        annee_detecteurs = {
            'l1': r'(\bL\.?\s*1\b|1\s*[a-zéèà]{0,4}\s*ann[ée]e|ann[ée]e\s*1\b|premi[èe]re\s+ann[ée]e)',
            'l2': r'(\bL\.?\s*2\b|2\s*[a-zéèà]{0,4}\s*ann[ée]e|ann[ée]e\s*2\b|deuxi[èe]me\s+ann[ée]e)',
            'l3': r'(\bL\.?\s*3\b|3\s*[a-zéèà]{0,4}\s*ann[ée]e|ann[ée]e\s*3\b|troisi[èe]me\s+ann[ée]e)',
        }
        moy_val = r'(\d{1,2}[.,]\d{1,2})'

        def _moyenne_dans_ligne(ligne):
            # 1) valeur proche du mot « moyenne / moy. » (annuelle / générale tolérées)
            m = re.search(
                r'moy(?:enne)?\.?\s*(?:annuelle|g[ée]n[ée]rale)?\s*[:\-=]?\s*' + moy_val,
                ligne, re.IGNORECASE,
            )
            if m:
                return m.group(1)
            # 2) formulation inversée « 12.80 de moyenne »
            m = re.search(moy_val + r'\s*(?:/\s*20)?\s*de\s+moyenne', ligne, re.IGNORECASE)
            if m:
                return m.group(1)
            # 3) repli : 1re valeur décimale plausible 0..20 (les années type 2021 n'ont pas de décimale)
            for cand in re.findall(moy_val, ligne):
                try:
                    v = float(cand.replace(',', '.'))
                except ValueError:
                    continue
                if 0 <= v <= 20:
                    return cand
            return None

        for key, detecteur in annee_detecteurs.items():
            for ligne in lignes:
                if not re.search(detecteur, ligne, re.IGNORECASE):
                    continue
                cand = _moyenne_dans_ligne(ligne)
                if cand is None:
                    continue
                try:
                    v = float(cand.replace(',', '.'))
                except ValueError:
                    continue
                if 0 <= v <= 20:
                    notes[key] = v
                    break

        # MOD v7 §3 — Redoublements : None si AUCUNE mention (ne JAMAIS supposer 0).
        if re.search(r'redoublement', texte, re.IGNORECASE):
            m_redoub = re.search(r'(?:nombre\s+de\s+)?redoublements?\s*[:\-=]?\s*(\d+)', texte, re.IGNORECASE)
            if m_redoub:
                notes['redoublements'] = int(m_redoub.group(1))
            elif re.search(r'(aucun|sans|pas\s+de|z[ée]ro)\s+redoublement', texte, re.IGNORECASE):
                notes['redoublements'] = 0
            else:
                notes['redoublements'] = 0  # mot présent sans nombre → 0
        else:
            notes['redoublements'] = None  # non détecté → alerte

        # MOD v7 §3 — Sessions de contrôle/rattrapage : None si AUCUNE mention.
        if re.search(r'(rattrapage|contr[ôo]le|session)', texte, re.IGNORECASE):
            notes['sessions_rattrapage'] = len(re.findall(r'rattrapage|contr[ôo]le', texte, re.IGNORECASE))
        else:
            notes['sessions_rattrapage'] = None  # non détecté → alerte

        return notes

    @staticmethod
    def recalculer_score_depuis_notes(notes: dict, criteres: list = None, formule: str = '') -> dict:
        """
        Recalcule le score complet depuis L1, L2, L3.

        Formule:
        - M.G = moyenne des années présentes (3 pour une Licence complète)
        - B.N.R = 5 si 0 redoublement, 3 si 1, sinon 0
        - B.S.P = 3 si 0 session de rattrapage, 2 si 1, sinon 0
        - SCORE = M.G + B.N.R + B.S.P

        Args:
            notes: dict {l1, l2, l3, redoublements, sessions_rattrapage}
            criteres: réservé (barème configurable par master) — optionnel
            formule: réservé (formule configurable par master) — optionnel

        Returns:
            {
                'mg': 14.17,
                'bnr': 5,
                'bsp': 3,
                'l1': 13.50,
                'l2': 14.00,
                'l3': 15.01,
                'redoublements': 0,
                'sessions': 0,
                'score_recalcule': 22.17
            }
        """
        l1 = notes.get('l1')
        l2 = notes.get('l2')
        l3 = notes.get('l3')

        composantes_non_detectees = []

        # Moyenne générale : moyenne des années réellement détectées sur le relevé.
        presentes = [x for x in (l1, l2, l3) if isinstance(x, (int, float)) and x > 0]
        if presentes:
            mg = round(sum(presentes) / len(presentes), 2)
        else:
            mg = None  # MOD v7 §3 — non détecté (ne PAS supposer 0)
            composantes_non_detectees.append('M.G')

        # MOD v7 §3 — B.N.R : None (non détecté) si aucune mention de redoublement,
        # au lieu de supposer silencieusement le meilleur cas (5 pts).
        redoub = notes.get('redoublements')
        if redoub is None:
            bnr = None
            composantes_non_detectees.append('B.N.R')
        elif redoub == 0:
            bnr = 5
        elif redoub == 1:
            bnr = 3
        else:
            bnr = 0

        # MOD v7 §3 — B.S.P : None (non détecté) si aucune mention de session.
        sess = notes.get('sessions_rattrapage')
        if sess is None:
            bsp = None
            composantes_non_detectees.append('B.S.P')
        elif sess == 0:
            bsp = 3
        elif sess == 1:
            bsp = 2
        else:
            bsp = 0

        score_recalcule = round((mg or 0) + (bnr or 0) + (bsp or 0), 2)

        return {
            'mg': mg,
            'bnr': bnr,
            'bsp': bsp,
            'l1': l1,
            'l2': l2,
            'l3': l3,
            'redoublements': redoub,
            'sessions': sess,
            'score_recalcule': score_recalcule,
            'composantes_non_detectees': composantes_non_detectees,
        }

    @staticmethod
    def analyser_releve_complet(fichier_path: str, score_declare: float) -> Dict[str, Any]:
        """
        Analyse complète: extrait L1/L2/L3, recalcule le score, compare.
        """
        texte = OCRService.extraire_texte_pdf(fichier_path)
        notes = OCRService.extraire_notes_detaillees(texte)
        detail = OCRService.recalculer_score_depuis_notes(notes)

        score_ocr = detail['score_recalcule']
        non_detectees = detail.get('composantes_non_detectees', [])
        ecart = round(abs(score_ocr - (score_declare or 0)), 2)

        # MOD v7 §3 — Si une composante n'a pas été détectée (M.G / B.N.R / B.S.P),
        # on NE valide PAS automatiquement : alerte de vérification manuelle.
        if non_detectees:
            statut = 'incoherence'
            confiance = 60
            alerte = (
                'Écart anormal détecté — Vérification manuelle recommandée. '
                'Composante(s) non détectée(s) : ' + ', '.join(non_detectees) + '.'
            )
        elif ecart <= 0.5:
            confiance = 95
            statut = 'conforme'
            alerte = None
        else:
            confiance = max(50, 90 - int(ecart * 10))
            statut = 'incoherence'
            alerte = f'Écart de {ecart} pts (déclaré {score_declare}, recalculé {score_ocr})'

        return {
            'statut': statut,
            'score_extrait': score_ocr,
            'score_declare': score_declare,
            'ecart': ecart,
            'confiance': confiance,
            'moteur': 'pdfplumber',
            'detail_notes': detail,
            'alerte': alerte,
            'texte_extrait': texte[:500] if texte else '',
            'anomalies': non_detectees,
        }

    # ─────────────────────────────────────────────────────────────────────────
    # v4 §7 — Extraction texte (PDF ou image) + détection spécialité / diplôme
    # ─────────────────────────────────────────────────────────────────────────
    @staticmethod
    def extraire_texte_document(fichier_path: str, is_pdf: bool = True) -> str:
        """Extrait le texte d'un PDF (pdfplumber/easyocr) ou d'une image (pytesseract/easyocr)."""
        if is_pdf:
            return OCRService.extraire_texte_pdf(fichier_path)

        # Image : pytesseract d'abord, fallback EasyOCR
        if pytesseract is not None and Image is not None:
            try:
                return pytesseract.image_to_string(Image.open(fichier_path), lang='fra+ara')
            except Exception as e:
                logger.warning(f"pytesseract image: {e}")

        if easyocr is not None:
            try:
                reader = easyocr.Reader(['fr', 'en'])
                results = reader.readtext(fichier_path)
                return '\n'.join(text for (_, text, _) in results)
            except Exception as e:
                logger.warning(f"EasyOCR image: {e}")

        return ''

    @staticmethod
    def detecter_specialite(texte: str) -> Dict[str, Any]:
        """Retourne la spécialité la plus probable détectée dans le texte."""
        texte_lower = (texte or '').lower()
        resultats = []
        for specialite, keywords in SPECIALITES_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in texte_lower)
            if score > 0:
                resultats.append({'specialite': specialite, 'score': score})
        if not resultats:
            return {'specialite': None, 'score': 0}
        return max(resultats, key=lambda x: x['score'])

    @staticmethod
    def detecter_type_diplome(texte: str) -> Optional[str]:
        """Retourne 'maitrise' ou 'licence' (maîtrise prioritaire) ou None."""
        texte_lower = (texte or '').lower()
        for type_dip in ('maitrise', 'licence'):
            if any(kw in texte_lower for kw in DIPLOME_KEYWORDS[type_dip]):
                return type_dip
        return None

    @staticmethod
    def analyser_specialite_type_diplome(
        fichier_path: str,
        specialite_declaree: str = '',
        type_diplome_declare: str = '',
        is_pdf: bool = True,
    ) -> Dict[str, Any]:
        """
        v4 §7 — Extrait la spécialité + le type de diplôme depuis le relevé et les
        compare aux valeurs déclarées par le candidat.
        """
        texte = OCRService.extraire_texte_document(fichier_path, is_pdf=is_pdf)

        if not texte or len(texte.strip()) < 10:
            return {
                'statut': 'ocr_error',
                'message': 'Impossible de lire le document.',
                'specialite_detectee': None,
                'type_diplome_detecte': None,
                'correspondance_specialite': False,
                'correspondance_type': False,
                'alerte': True,
                'texte_brut': '',
            }

        spec = OCRService.detecter_specialite(texte)
        type_dip = OCRService.detecter_type_diplome(texte)

        sd = (specialite_declaree or '').lower().strip()
        td = (type_diplome_declare or '').lower().strip()

        correspondance_specialite = bool(
            spec['specialite'] is not None
            and (
                any(kw in sd for kw in SPECIALITES_KEYWORDS.get(spec['specialite'], []))
                or (sd and (spec['specialite'].lower() in sd or sd in spec['specialite'].lower()))
            )
        )
        correspondance_type = bool(
            type_dip is not None and td != '' and (type_dip == td or type_dip in td or td in type_dip)
        )

        return {
            'statut': 'ok',
            'specialite_detectee': spec['specialite'],
            'specialite_score': spec['score'],
            'type_diplome_detecte': type_dip,
            'specialite_declaree': specialite_declaree,
            'type_diplome_declare': type_diplome_declare,
            'correspondance_specialite': correspondance_specialite,
            'correspondance_type': correspondance_type,
            'alerte': not (correspondance_specialite and correspondance_type),
            'texte_brut': texte[:500],
        }

    @staticmethod
    def analyser_releve_notes(
        fichier_path: str,
        score_declare: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Analyse complète d'un relevé de notes PDF.

        Req-3 — Actions automatiques selon résultat :
        - conforme (écart ≤ 0.5) → pièce validée auto
        - incoherence (écart > 0.5) → alerte "Dossier Suspect"

        Args:
            fichier_path: Chemin du PDF
            score_declare: Score déclaré par le candidat

        Returns:
            Dict avec statut, scores extraits, écart, confiance, alerte
        """
        # Extraction texte
        texte = OCRService.extraire_texte_pdf(fichier_path)

        # Gestion erreur extraction
        if not texte or len(texte.strip()) < 10:
            return {
                'statut': 'ocr_error',
                'message': 'Impossible de lire le document PDF',
                'confiance': 0,
                'moteur': 'pdfplumber',
                'texte_extrait': '',
                'score_extrait': None,
                'score_declare': score_declare,
                'ecart': None,
                'alerte': None,
                'anomalies': ['PDF non lisible ou corrompu'],
            }

        # Extraction score
        moyenne_extraite = OCRService.extraire_moyenne(texte)

        # Gestion pas de score détecté
        if moyenne_extraite is None:
            return {
                'statut': 'ocr_no_data',
                'message': 'Aucune moyenne détectée dans le document',
                'confiance': 30,
                'moteur': 'pdfplumber',
                'texte_extrait': texte[:500],
                'score_extrait': None,
                'score_declare': score_declare,
                'ecart': None,
                'alerte': 'Impossible d\'extraire une moyenne du PDF',
                'anomalies': ['Aucune moyenne trouvée'],
            }

        # Calcul écart si score déclaré fourni
        ecart = None
        alerte = None
        statut = 'conforme'  # défaut

        if score_declare is not None:
            try:
                score_declare_float = float(score_declare)
                ecart = round(abs(moyenne_extraite - score_declare_float), 2)

                # Req-3 : Seuil de concordance = 0.5 points
                if ecart <= 0.5:
                    statut = 'conforme'
                    alerte = None
                else:
                    statut = 'incoherence'
                    alerte = f'Dossier Suspect — Écart de {ecart} pts entre déclaré ({score_declare_float}) et extrait ({moyenne_extraite})'
            except (TypeError, ValueError):
                pass

        # Confiance basée sur la précision
        if ecart is None:
            confiance = 85  # pas de comparaison possible
        elif ecart <= 0.5:
            confiance = 95  # très confiant
        else:
            confiance = max(40, 90 - int(ecart * 10))  # confiance dégradée par l'écart

        return {
            'statut': statut,
            'message': 'Moyenne extraite avec succès' if statut == 'conforme' else alerte,
            'score_extrait': moyenne_extraite,
            'score_declare': score_declare,
            'ecart': ecart,
            'confiance': confiance,
            'moteur': 'pdfplumber',
            'texte_extrait': texte[:500],
            'alerte': alerte,
            'anomalies': [alerte] if alerte else [],
        }


def verifier_concordance_dossier(
    fichier_path: str,
    score_declare: float,
) -> Dict[str, Any]:
    """
    Fonction compatibilité (import existant dans views.py).
    Encapsule OCRService.analyser_releve_notes().
    """
    return OCRService.analyser_releve_notes(fichier_path, score_declare)
