
from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP

logger = logging.getLogger(__name__)

TOLERANCE = Decimal("0.05")  # accepted rounding difference between front & backend


def _f(value, default: float = 0.0) -> Decimal:
    """Safely coerce a value to Decimal."""
    try:
        if value is None or value == "":
            return Decimal(str(default))
        return Decimal(str(value))
    except Exception:
        return Decimal(str(default))


def _bonus_mention(mention: str) -> Decimal:
    """Bonus mention pour masters (Très Bien / Bien / Assez Bien)."""
    m = (mention or "").strip().lower()
    if "très" in m or "tres" in m:
        return Decimal("2.0")
    if m == "bien":
        return Decimal("1.0")
    if "assez" in m:
        return Decimal("0.5")
    return Decimal("0.0")


def _bonus_rattrapage(nb_rattrapages: int) -> Decimal:
    """Malus sessions de rattrapage pour cycle ingénieur."""
    return Decimal(str(nb_rattrapages)) * Decimal("-1.0")


# ──────────────────────────────────────────────────────────────────────────────
# MASTER formulas
# ──────────────────────────────────────────────────────────────────────────────

def _score_mp_gl_mr_gl(payload: dict) -> Decimal:
    """
    MP-GL / MR-GL / MR-MI
    Score = M_L1*1 + M_L2*1 + M_L3*1.5 + Bonus_Mention
    """
    m1 = _f(payload.get("moyenne_l1") or payload.get("moy1"))
    m2 = _f(payload.get("moyenne_l2") or payload.get("moy2"))
    m3 = _f(payload.get("moyenne_l3") or payload.get("moy3"))
    mention = payload.get("mention") or payload.get("mention_licence") or ""
    score = m1 * Decimal("1") + m2 * Decimal("1") + m3 * Decimal("1.5") + _bonus_mention(mention)
    return score.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)


def _score_mp_ds(payload: dict) -> Decimal:
    """
    MP-DS
    Score = M_Maths*1.5 + M_L1*1 + M_L2*1 + M_L3*1
    """
    m_maths = _f(payload.get("moyenne_maths") or payload.get("moy_maths"))
    m1 = _f(payload.get("moyenne_l1") or payload.get("moy1"))
    m2 = _f(payload.get("moyenne_l2") or payload.get("moy2"))
    m3 = _f(payload.get("moyenne_l3") or payload.get("moy3"))
    score = m_maths * Decimal("1.5") + m1 + m2 + m3
    return score.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)


def _score_mp_3i(payload: dict) -> Decimal:
    """
    MP-3I
    Score = M_EEA_MIM*1.2 + M_L1*1 + M_L2*1 + M_L3*1
    """
    m_eea = _f(payload.get("moyenne_eea_mim") or payload.get("moy_eea") or payload.get("moy_mim"))
    m1 = _f(payload.get("moyenne_l1") or payload.get("moy1"))
    m2 = _f(payload.get("moyenne_l2") or payload.get("moy2"))
    m3 = _f(payload.get("moyenne_l3") or payload.get("moy3"))
    score = m_eea * Decimal("1.2") + m1 + m2 + m3
    return score.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)


# ──────────────────────────────────────────────────────────────────────────────
# CYCLE INGÉNIEUR formula
# ──────────────────────────────────────────────────────────────────────────────

def _score_ingenieur_gl(payload: dict) -> Decimal:
    """
    Informatique / GL
    Score = M_Licence*0.7 + M_Bac*0.3 + Bonus_Rattrapage(-1pt par session 2)
    """
    m_licence = _f(payload.get("moyenne_licence") or payload.get("moy_licence"))
    m_bac = _f(payload.get("moyenne_bac") or payload.get("moy_bac"))
    nb_rattrapages = int(_f(payload.get("nb_sessions_rattrapage") or payload.get("nb_rattrapages")))
    score = (
        m_licence * Decimal("0.7")
        + m_bac * Decimal("0.3")
        + _bonus_rattrapage(nb_rattrapages)
    )
    return score.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)


# ──────────────────────────────────────────────────────────────────────────────
# Branch dispatch table
# ──────────────────────────────────────────────────────────────────────────────

_BRANCH_MAP: dict[str, callable] = {
    # Master Professionnel
    "mp-gl": _score_mp_gl_mr_gl,
    "mp_gl": _score_mp_gl_mr_gl,
    # Master Recherche GL / MI
    "mr-gl": _score_mp_gl_mr_gl,
    "mr_gl": _score_mp_gl_mr_gl,
    "mr-mi": _score_mp_gl_mr_gl,
    "mr_mi": _score_mp_gl_mr_gl,
    # Data Science
    "mp-ds": _score_mp_ds,
    "mp_ds": _score_mp_ds,
    # 3I
    "mp-3i": _score_mp_3i,
    "mp_3i": _score_mp_3i,
    # Cycle Ingénieur
    "ing-gl": _score_ingenieur_gl,
    "ing_gl": _score_ingenieur_gl,
    "ingenieur": _score_ingenieur_gl,
    "ingénieur": _score_ingenieur_gl,
}


def recalculer_score(branch_code: str, payload: dict) -> Decimal | None:
    """
    Calculate the expected score for *branch_code* using *payload*.

    Returns the Decimal score or None if the branch is unknown.
    """
    key = (branch_code or "").strip().lower().replace(" ", "-")
    fn = _BRANCH_MAP.get(key)
    if fn is None:
        logger.warning("recalculer_score: branche inconnue '%s'", branch_code)
        return None
    try:
        return fn(payload)
    except Exception:
        logger.exception("recalculer_score: erreur branche '%s'", branch_code)
        return None


def valider_score_candidature(candidature, branch_code: str, payload: dict) -> bool:
    """
    Compare the score submitted by the front-end (candidature.score_soumis_front)
    with the backend-calculated score.

    Sets candidature.flag_fraude = True and blocks the dossier when the deviation
    exceeds TOLERANCE.

    Returns True if the score is valid, False if fraud is suspected.
    """
    score_backend = recalculer_score(branch_code, payload)
    if score_backend is None:
        return True  # unknown branch → skip validation

    score_front = _f(candidature.score_soumis_front)
    deviation = abs(score_backend - score_front)

    if deviation > TOLERANCE:
        candidature.flag_fraude = True
        candidature.score = score_backend  # use trusted backend score
        logger.warning(
            "FRAUD DETECTED candidature=%s branch=%s front=%.3f backend=%.3f deviation=%.3f",
            getattr(candidature, "numero", "?"),
            branch_code,
            float(score_front),
            float(score_backend),
            float(deviation),
        )
        return False

    candidature.flag_fraude = False
    candidature.score = score_backend
    return True
