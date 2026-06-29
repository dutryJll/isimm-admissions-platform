

import io
import re
import hashlib
import logging
import tempfile
import os
from typing import Optional

logger = logging.getLogger(__name__)

# ── Tentatives d'import des moteurs OCR ──────────────────────────────────────
_easyocr_available = False
_paddleocr_available = False

try:
    import easyocr
    _easyocr_available = True
except ImportError:
    pass

if not _easyocr_available:
    try:
        from paddleocr import PaddleOCR
        _paddleocr_available = True
    except ImportError:
        pass

# Conversion PDF → images (optionnel)
try:
    from pdf2image import convert_from_bytes
    _pdf2image_available = True
except ImportError:
    _pdf2image_available = False

# ── Regex extraction de scores / moyennes ────────────────────────────────────
# Ordre = priorité (plus spécifique → plus générique)
_SCORE_PATTERNS = [
    # "Moyenne Generale 14.17" / "Moyenne Générale : 14,75"
    re.compile(r'moyenne\s*g[eé]n[eé]rale\s*[:\-–\.]*\s*(\d{1,2}[.,]\d{1,2})', re.I),
    # "M.G : 14.17" / "MG = 14.17"
    re.compile(r'\bm\.?g\.?\s*[:\-–=]?\s*(\d{1,2}[.,]\d{1,2})', re.I),
    # "Moyenne générale" suivi de notes en colonnes avec score à la fin
    re.compile(r'moyenne\s*g[eé]n[eé]rale\s+\S+\s+(\d{1,2}[.,]\d{1,2})', re.I),
    # "Score Total" ou "SCORE TOTAL" → extrait la valeur après
    re.compile(r'score\s*total\s*[:\-–=]?\s*(\d{1,2}[.,]\d{1,2})', re.I),
    # "Moyenne générale : 14,75" ou "Moyenne: 14.75"
    re.compile(r'moyenne\s*[:\-–]?\s*(\d{1,2}[.,]\d{1,2})', re.I),
    # "Total : 14.75 / 20"
    re.compile(r'total\s*[:\-–]?\s*(\d{1,2}[.,]\d{1,2})\s*/\s*20', re.I),
    # Un score flottant nu suivi de /20
    re.compile(r'(\d{1,2}[.,]\d{1,2})\s*/\s*20'),
    # Score sous forme "14,75" ou "14.75" isolé (last resort)
    re.compile(r'\b(\d{1,2}[.,]\d{1,2})\b'),
]

_SEUIL_FRAUDE_DELTA = 0.5   # écart absolu en points déclenchant le flag


def _parse_score(texte: str) -> Optional[float]:
    """Extrait le premier score numérique plausible du texte OCR."""
    for pattern in _SCORE_PATTERNS:
        m = pattern.search(texte)
        if m:
            raw = m.group(1).replace(',', '.')
            try:
                val = float(raw)
                if 0.0 <= val <= 20.0:
                    return val
            except ValueError:
                continue
    return None


def _sha256_fichier(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class OCRDocumentAuditor:
    """
    Analyse un document (PDF scanné ou image) via OCR local.
    Extrait le score et le compare à la valeur déclarée par le candidat.
    """

    def __init__(self):
        self._reader = None   # EasyOCR reader (lazy init)
        self._paddle = None   # PaddleOCR instance (lazy init)

    # ── Initialisation lazy du moteur ────────────────────────────────────────
    def _get_reader_easyocr(self):
        if self._reader is None:
            if not _easyocr_available:
                raise ImportError(
                    "EasyOCR non disponible. Installez-le : pip install easyocr"
                )
            self._reader = easyocr.Reader(['fr', 'en'], gpu=False, verbose=False)
        return self._reader

    def _get_paddle(self):
        if self._paddle is None:
            if not _paddleocr_available:
                raise ImportError(
                    "PaddleOCR non disponible. Installez-le : pip install paddleocr"
                )
            self._paddle = PaddleOCR(use_angle_cls=True, lang='fr', show_log=False)
        return self._paddle

    # ── Extraction texte ─────────────────────────────────────────────────────
    def _extraire_texte_image(self, image_bytes: bytes) -> str:
        """Passe une image au moteur OCR et retourne le texte brut."""
        # Préférence EasyOCR, puis PaddleOCR
        if _easyocr_available:
            reader = self._get_reader_easyocr()
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                tmp.write(image_bytes)
                tmp_path = tmp.name
            try:
                resultats = reader.readtext(tmp_path, detail=0, paragraph=True)
                return '\n'.join(str(r) for r in resultats)
            finally:
                os.unlink(tmp_path)

        elif _paddleocr_available:
            paddle = self._get_paddle()
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                tmp.write(image_bytes)
                tmp_path = tmp.name
            try:
                result = paddle.ocr(tmp_path, cls=True)
                lignes = []
                if result:
                    for page in result:
                        if page:
                            for ligne in page:
                                if ligne and len(ligne) >= 2:
                                    lignes.append(str(ligne[1][0]))
                return '\n'.join(lignes)
            finally:
                os.unlink(tmp_path)

        raise RuntimeError(
            "Aucun moteur OCR disponible. Installez easyocr ou paddleocr."
        )

    def _pdf_vers_images(self, pdf_bytes: bytes) -> list[bytes]:
        """Convertit un PDF en liste d'images PNG."""
        if not _pdf2image_available:
            raise ImportError(
                "pdf2image non disponible. Installez : pip install pdf2image"
            )
        # ── Localiser Poppler (Windows) ────────────────────────────────
        import os as _os
        poppler_candidates = [
            r'C:\poppler\bin',
            r'C:\poppler\poppler-26.02.0\Library\bin',
            r'C:\Users\HP\Downloads\poppler\poppler-26.02.0\Library\bin',
        ]
        poppler_path = None
        for p in poppler_candidates:
            if _os.path.isdir(p) and _os.path.isfile(_os.path.join(p, 'pdftoppm.exe')):
                poppler_path = p
                break

        if poppler_path:
            pages = convert_from_bytes(pdf_bytes, dpi=200, poppler_path=poppler_path)
        else:
            pages = convert_from_bytes(pdf_bytes, dpi=200)

        images = []
        for page in pages:
            buf = io.BytesIO()
            page.save(buf, format='PNG')
            images.append(buf.getvalue())
        return images

    # ── API principale ────────────────────────────────────────────────────────
    def analyser_document(
        self,
        fichier,
        score_declare: Optional[float] = None,
    ) -> dict:
        """
        Analyse un fichier Django (InMemoryUploadedFile ou similaire).

        Retourne :
        {
            "texte_extrait": str,
            "score_extrait": float | None,
            "score_declare": float | None,
            "delta": float | None,
            "flag_fraude": bool,
            "confiance": float,       # 0.0 – 1.0
            "moteur": str,
            "sha256": str,
            "anomalies": list[dict],
        }
        """
        # ── Mode SIMULATION (Sprint 4) ────────────────────────────────────────
        # Activé si OCR_SIMULATION=1 OU aucun moteur OCR installé.
        force_simulation = os.environ.get('OCR_SIMULATION', '').lower() in ('1', 'true', 'yes')
        moteur_dispo = (_easyocr_available or _paddleocr_available) and _pdf2image_available
        if force_simulation or not moteur_dispo:
            import random as _random
            sd = None
            try:
                sd = float(score_declare) if score_declare is not None else None
            except (TypeError, ValueError):
                sd = None
            if not sd or sd <= 0:
                sd = round(_random.uniform(11.0, 16.0), 2)
            ecart = round(_random.uniform(-0.5, 0.5), 2)
            se = round(sd + ecart, 2)
            return {
                'texte_extrait': '[SIMULATION] Aucun moteur OCR installé — données factices.',
                'score_extrait': se,
                'score_declare': sd,
                'delta': abs(ecart),
                'ecart': abs(ecart),
                'flag_fraude': abs(ecart) > 0.5,
                'confiance': round(_random.uniform(0.82, 0.94), 2),
                'moteur': 'simulation',
                'mode_simulation': True,
                'simulation_raison': 'force_env' if force_simulation else 'aucun_moteur',
                'sha256': 'simulation',
                'statut': 'conforme' if abs(ecart) <= 0.5 else 'incoherence',
                'anomalies': [] if abs(ecart) <= 0.5 else [
                    {'type': 'score_mismatch', 'message': f"[SIMULATION] Écart simulé {abs(ecart):.2f} pt"},
                ],
            }

        data = fichier.read() if hasattr(fichier, 'read') else bytes(fichier)
        sha = _sha256_fichier(data)
        nom = getattr(fichier, 'name', '') or ''
        anomalies = []

        # ── Extraction texte ──────────────────────────────────────────────────
        texte = ''
        moteur = 'none'
        try:
            if nom.lower().endswith('.pdf'):
                if _pdf2image_available:
                    images = self._pdf_vers_images(data)
                    textes = []
                    for img_bytes in images[:4]:  # max 4 pages
                        textes.append(self._extraire_texte_image(img_bytes))
                    texte = '\n'.join(textes)
                else:
                    anomalies.append({
                        'type': 'pdf_non_converti',
                        'message': 'pdf2image non installé — impossible de lire le PDF.',
                    })
            else:
                texte = self._extraire_texte_image(data)

            moteur = 'easyocr' if _easyocr_available else ('paddleocr' if _paddleocr_available else 'none')
        except Exception as exc:
            logger.warning('OCR extraction échouée : %s', exc)
            anomalies.append({'type': 'ocr_error', 'message': str(exc)})

        # ── Extraction du score ───────────────────────────────────────────────
        score_extrait = _parse_score(texte) if texte else None

        # ── Comparaison avec score déclaré ────────────────────────────────────
        delta = None
        flag_fraude = False

        if score_extrait is not None and score_declare is not None:
            try:
                delta = round(abs(float(score_declare) - score_extrait), 2)
                if delta > _SEUIL_FRAUDE_DELTA:
                    flag_fraude = True
                    anomalies.append({
                        'type': 'score_mismatch',
                        'champ': 'score',
                        'score_declare': score_declare,
                        'score_extrait': score_extrait,
                        'delta': delta,
                        'message': (
                            f'Écart de {delta:.2f} pts entre le score déclaré '
                            f'({score_declare}) et extrait ({score_extrait}). '
                            'Vérification manuelle recommandée.'
                        ),
                    })
            except (TypeError, ValueError):
                pass

        # ── Confiance heuristique ─────────────────────────────────────────────
        if not texte:
            confiance = 0.0
        elif score_extrait is None:
            confiance = 0.4
        elif flag_fraude:
            confiance = max(0.0, 1.0 - delta / 5.0) if delta else 0.5
        else:
            confiance = 1.0

        return {
            'texte_extrait': texte[:3000],   # tronqué pour stockage
            'score_extrait': score_extrait,
            'score_declare': score_declare,
            'delta': delta,
            'flag_fraude': flag_fraude,
            'confiance': round(confiance, 2),
            'moteur': moteur,
            'sha256': sha,
            'anomalies': anomalies,
        }
