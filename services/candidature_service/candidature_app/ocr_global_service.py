
import io
import re
import logging
import tempfile
import os
from typing import Optional

logger = logging.getLogger(__name__)

# ── Tentative d'import PaddleOCR (full-local) ────────────────────────────────
_paddle_available = False
try:
    from paddleocr import PaddleOCR
    _paddle_available = True
except ImportError:
    logger.warning("PaddleOCR non disponible — installer avec: pip install paddleocr")

# Conversion PDF → images
_pdf2image_available = False
try:
    from pdf2image import convert_from_bytes
    _pdf2image_available = True
except ImportError:
    pass

# Instance unique de PaddleOCR (chargée une seule fois)
_paddle_instance: Optional["PaddleOCR"] = None


def _get_paddle() -> Optional["PaddleOCR"]:
    global _paddle_instance
    if not _paddle_available:
        return None
    if _paddle_instance is None:
        _paddle_instance = PaddleOCR(use_angle_cls=True, lang="fr", show_log=False)
    return _paddle_instance


# ── Regex ──────────────────────────────────────────────────────────────────────

_RE_CIN          = re.compile(r'\b(\d{8})\b')
_RE_YEAR         = re.compile(r'\b(19[89]\d|20[012]\d)\b')
_RE_SCORE        = re.compile(r'\b(\d{1,2}[.,]\d{1,2})\b')
_RE_AVERAGE      = re.compile(r'moyenne\s*[:\-–]?\s*(\d{1,2}[.,]\d{1,2})', re.I)
_RE_MENTION      = re.compile(
    r'\b(mention|tres\s+bien|bien|assez\s+bien|passable|honorable)\b', re.I
)
_RE_LICENCE_SPEC = re.compile(
    r'\b(informatique|g[eé]nie|r[eé]seaux?|syst[eè]mes?|logiciel|math[eé]matique|'
    r'[eé]lectronique|m[eé]canique|[eé]conomie|gestion|chimie|biologie)\b',
    re.I,
)
_RE_BAC_SECTION  = re.compile(
    r'\b(baccalaur[eé]at|bacalauréat|bac\b|section\s+\w+)', re.I
)

# ── Helpers ────────────────────────────────────────────────────────────────────

def _ocr_bytes(data: bytes, suffix: str = ".pdf") -> str:
    """Extrait le texte brut d'un fichier (PDF ou image) via PaddleOCR."""
    ocr = _get_paddle()
    if ocr is None:
        return ""

    pages_text: list[str] = []

    if suffix.lower() == ".pdf":
        if not _pdf2image_available:
            logger.warning("pdf2image absent — impossible de lire le PDF")
            return ""
        try:
            images = convert_from_bytes(data, dpi=200)
        except Exception as exc:
            logger.error("pdf2image error: %s", exc)
            return ""
        for img in images:
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                img.save(tmp.name, "PNG")
                tmp_path = tmp.name
            try:
                result = ocr.ocr(tmp_path, cls=True)
                for line_group in (result or []):
                    for line in (line_group or []):
                        if line and len(line) >= 2:
                            pages_text.append(str(line[1][0]))
            except Exception as exc:
                logger.error("PaddleOCR page error: %s", exc)
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
    else:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        try:
            result = ocr.ocr(tmp_path, cls=True)
            for line_group in (result or []):
                for line in (line_group or []):
                    if line and len(line) >= 2:
                        pages_text.append(str(line[1][0]))
        except Exception as exc:
            logger.error("PaddleOCR image error: %s", exc)
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    return "\n".join(pages_text)


def _parse_float(raw: str) -> Optional[float]:
    try:
        val = float(raw.replace(',', '.'))
        return val if 0.0 <= val <= 20.0 else None
    except (ValueError, AttributeError):
        return None


def _read_document_file(document) -> tuple[bytes, str]:
    """Lit les bytes et l'extension d'un objet Document Django."""
    try:
        suffix = os.path.splitext(document.nom_fichier_original or document.fichier.name)[1].lower()
        with document.fichier.open('rb') as f:
            return f.read(), suffix
    except Exception as exc:
        logger.error("Lecture document %s: %s", document.id, exc)
        return b"", ".pdf"


# ── Auditeurs par type de document ─────────────────────────────────────────────

def _auditer_cin(doc_data: bytes, suffix: str, cin_attendu: str) -> dict:
    """Vérifie que le CIN OCR correspond au CIN déclaré."""
    result = {"type": "CIN", "statut": "ok", "anomalies": []}
    texte = _ocr_bytes(doc_data, suffix)
    if not texte:
        result["statut"] = "non_lisible"
        result["anomalies"].append({"code": "ocr_vide", "message": "Aucun texte extrait du document CIN."})
        return result

    cin_matches = _RE_CIN.findall(texte)
    result["cin_extraits"] = cin_matches

    cin_attendu_clean = re.sub(r'\D', '', cin_attendu or '')
    if not cin_attendu_clean:
        result["statut"] = "non_verifie"
        result["anomalies"].append({"code": "cin_inconnu", "message": "CIN de référence non disponible."})
        return result

    if cin_attendu_clean not in cin_matches:
        result["statut"] = "anomalie"
        result["flag_fraude"] = True
        result["anomalies"].append({
            "code": "cin_mismatch",
            "message": f"CIN attendu {cin_attendu_clean} absent du document ({cin_matches}).",
            "attendu": cin_attendu_clean,
            "extraits": cin_matches,
        })

    return result


def _auditer_bac(doc_data: bytes, suffix: str) -> dict:
    """Vérifie la présence de mentions bac et d'une année plausible."""
    result = {"type": "BAC", "statut": "ok", "anomalies": []}
    texte = _ocr_bytes(doc_data, suffix)
    if not texte:
        result["statut"] = "non_lisible"
        result["anomalies"].append({"code": "ocr_vide", "message": "Aucun texte extrait du diplôme bac."})
        return result

    result["texte_brut_extrait"] = texte[:500]

    mentions = _RE_MENTION.findall(texte)
    annees = _RE_YEAR.findall(texte)
    is_bac = bool(_RE_BAC_SECTION.search(texte))

    result["mentions_trouvees"] = mentions
    result["annees_trouvees"] = annees
    result["mot_cle_bac_detecte"] = is_bac

    if not is_bac:
        result["statut"] = "anomalie"
        result["anomalies"].append({
            "code": "bac_non_detecte",
            "message": "Aucun mot-clé lié au baccalauréat détecté dans le document.",
        })

    if not annees:
        result["anomalies"].append({
            "code": "annee_absente",
            "message": "Aucune année lisible trouvée sur le diplôme bac.",
        })

    return result


def _auditer_licence(doc_data: bytes, suffix: str, specialite_attendue: str = "") -> dict:
    """Vérifie la spécialité et la mention du diplôme de licence."""
    result = {"type": "LICENCE", "statut": "ok", "anomalies": []}
    texte = _ocr_bytes(doc_data, suffix)
    if not texte:
        result["statut"] = "non_lisible"
        result["anomalies"].append({"code": "ocr_vide", "message": "Aucun texte extrait du diplôme licence."})
        return result

    result["texte_brut_extrait"] = texte[:500]
    specialites_detectees = list({m.lower() for m in _RE_LICENCE_SPEC.findall(texte)})
    result["specialites_detectees"] = specialites_detectees

    if specialite_attendue:
        spec_lower = specialite_attendue.lower()
        match = any(spec_lower in s or s in spec_lower for s in specialites_detectees)
        if not match and specialites_detectees:
            result["statut"] = "anomalie"
            result["anomalies"].append({
                "code": "specialite_mismatch",
                "message": (
                    f"Spécialité attendue '{specialite_attendue}' non trouvée "
                    f"(détectées : {specialites_detectees})."
                ),
                "attendue": specialite_attendue,
                "detectees": specialites_detectees,
            })
        elif not specialites_detectees:
            result["anomalies"].append({
                "code": "specialite_non_lue",
                "message": "Impossible de lire la spécialité depuis le diplôme.",
            })

    return result


def _auditer_releves(doc_data: bytes, suffix: str, annees: list[str] = None) -> dict:
    """Extrait les moyennes annuelles (L1/L2/L3) depuis les relevés de notes."""
    result = {"type": "RELEVES", "statut": "ok", "anomalies": [], "moyennes": {}}
    annees = annees or ["L1", "L2", "L3"]

    texte = _ocr_bytes(doc_data, suffix)
    if not texte:
        result["statut"] = "non_lisible"
        result["anomalies"].append({"code": "ocr_vide", "message": "Aucun texte extrait des relevés de notes."})
        return result

    result["texte_brut_extrait"] = texte[:800]

    # Extraction des moyennes (patrons: "Moyenne : 14,55" ou flottants /20)
    moyennes_brutes: list[float] = []
    for m in _RE_AVERAGE.finditer(texte):
        val = _parse_float(m.group(1))
        if val is not None:
            moyennes_brutes.append(val)

    if not moyennes_brutes:
        for m in _RE_SCORE.finditer(texte):
            val = _parse_float(m.group(1))
            if val is not None:
                moyennes_brutes.append(val)

    # Associe les valeurs trouvées aux années dans l'ordre
    for i, label in enumerate(annees):
        if i < len(moyennes_brutes):
            result["moyennes"][label] = moyennes_brutes[i]
        else:
            result["anomalies"].append({
                "code": f"moyenne_{label.lower()}_absente",
                "message": f"Impossible de lire la moyenne de {label} depuis les relevés.",
            })

    if len(moyennes_brutes) < len(annees):
        result["statut"] = "incomplet"

    return result


# ── Pipeline principal ─────────────────────────────────────────────────────────

def auditer_dossier_complet(candidat_id: int) -> dict:
    """
    Audite tous les documents obligatoires d'un candidat.

    Retourne un dict structuré :
    {
      "candidat_id": int,
      "flag_fraude": bool,
      "statut_global": "ok" | "incomplet" | "anomalie" | "erreur",
      "details": {
        "CIN":     {...},
        "BAC":     {...},
        "LICENCE": {...},
        "RELEVES": {...},
      },
      "anomalies_consolidees": [...],
    }
    """
    from .models import Candidature

    rapport: dict = {
        "candidat_id": candidat_id,
        "flag_fraude": False,
        "statut_global": "ok",
        "details": {},
        "anomalies_consolidees": [],
    }

    try:
        candidature = (
            Candidature.objects
            .select_related("candidat", "master")
            .prefetch_related("documents", "documents__type_document")
            .filter(candidat_id=candidat_id)
            .order_by("-date_soumission")
            .first()
        )
    except Exception as exc:
        logger.error("Candidature introuvable pour candidat_id=%s: %s", candidat_id, exc)
        rapport["statut_global"] = "erreur"
        rapport["anomalies_consolidees"].append({
            "code": "candidature_introuvable",
            "message": str(exc),
        })
        return rapport

    if not candidature:
        rapport["statut_global"] = "erreur"
        rapport["anomalies_consolidees"].append({
            "code": "candidature_introuvable",
            "message": f"Aucune candidature pour candidat_id={candidat_id}.",
        })
        return rapport

    cin_ref = str(getattr(candidature.candidat, 'cin', '') or '').strip()
    specialite_ref = (candidature.master.specialite if candidature.master else '') or ''

    # Répartit les documents par type
    docs_by_type: dict[str, list] = {}
    for doc in candidature.documents.all():
        key = (doc.type_document.type_document if doc.type_document else 'autre').lower()
        docs_by_type.setdefault(key, []).append(doc)

    audit_map = [
        ('cin',           'CIN',     lambda d, s: _auditer_cin(d, s, cin_ref)),
        ('diplome_bac',   'BAC',     lambda d, s: _auditer_bac(d, s)),
        ('diplome',       'LICENCE', lambda d, s: _auditer_licence(d, s, specialite_ref)),
        ('releve_notes',  'RELEVES', lambda d, s: _auditer_releves(d, s)),
    ]

    all_anomalies: list[dict] = []
    any_fraud = False

    for doc_type_key, label, auditor_fn in audit_map:
        docs = docs_by_type.get(doc_type_key, [])
        if not docs:
            section = {
                "type": label,
                "statut": "document_absent",
                "anomalies": [{
                    "code": "document_absent",
                    "message": f"Document '{label}' non déposé dans le dossier.",
                }],
            }
            rapport["details"][label] = section
            all_anomalies.extend(section["anomalies"])
            continue

        doc = docs[0]
        data, suffix = _read_document_file(doc)
        if not data:
            section = {
                "type": label,
                "statut": "lecture_impossible",
                "anomalies": [{
                    "code": "lecture_impossible",
                    "message": f"Fichier '{label}' illisible ou corrompu.",
                }],
            }
        else:
            try:
                section = auditor_fn(data, suffix)
            except Exception as exc:
                logger.error("Audit %s erreur: %s", label, exc)
                section = {
                    "type": label,
                    "statut": "erreur",
                    "anomalies": [{"code": "erreur_interne", "message": str(exc)}],
                }

        rapport["details"][label] = section
        all_anomalies.extend(section.get("anomalies", []))
        if section.get("flag_fraude"):
            any_fraud = True

    rapport["anomalies_consolidees"] = all_anomalies
    rapport["flag_fraude"] = any_fraud

    if any_fraud:
        rapport["statut_global"] = "anomalie"
        # Persiste le flag dans la DB
        try:
            Candidature.objects.filter(id=candidature.id).update(flag_fraude=True)
        except Exception as exc:
            logger.error("Impossible de persister flag_fraude: %s", exc)
    elif any(a["code"] == "document_absent" for a in all_anomalies):
        rapport["statut_global"] = "incomplet"
    elif all_anomalies:
        rapport["statut_global"] = "anomalie"

    return rapport
