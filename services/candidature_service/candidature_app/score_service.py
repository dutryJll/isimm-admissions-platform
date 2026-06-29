

import re
from typing import Any, Dict, List, Tuple


_SAFE_EXPR_RE = re.compile(r"^[0-9+\-*/().,\s]+$")


class ScoreService:

    # ────────────────────────────────────────────────────────────────────
    # Mode 'fixe'
    # ────────────────────────────────────────────────────────────────────
    @staticmethod
    def _valeur_fixe(critere: dict, form_data: dict) -> float:
        valeur_fixe = float(critere.get('valeurFixe') or 0)
        code = critere.get('code', '')

        if code in ('M.R', 'MR'):
            return valeur_fixe * int(form_data.get('nb_redoublements') or 0)
        if code in ('M.C', 'MC'):
            return valeur_fixe * int(form_data.get('nb_sessions_controle') or 0)

        mapping = {
            'M1':     float(form_data.get('moyenne_l1') or 0),
            'M2':     float(form_data.get('moyenne_l2') or 0),
            'M3':     float(form_data.get('moyenne_l3') or 0),
            'M.Bac':  float(form_data.get('moyenne_bac') or 0),
            'N.Math': float(form_data.get('note_maths_bac') or 0),
            'R1':     float(form_data.get('rang_l1') or 0),
            'R2':     float(form_data.get('rang_l2') or 0),
        }
        return mapping.get(code, valeur_fixe)

    # ────────────────────────────────────────────────────────────────────
    # Mode 'formule'
    # ────────────────────────────────────────────────────────────────────
    @staticmethod
    def _valeur_formule(critere: dict, form_data: dict) -> float:
        formule = str(critere.get('formuleCalc') or '0')
        vars_map = {
            'l1':   float(form_data.get('moyenne_l1') or 0),
            'l2':   float(form_data.get('moyenne_l2') or 0),
            'l3':   float(form_data.get('moyenne_l3') or 0),
            'bac':  float(form_data.get('moyenne_bac') or 0),
            'math': float(form_data.get('note_maths_bac') or 0),
            'math_bac': float(form_data.get('note_maths_bac') or 0),
            'fr':   float(form_data.get('note_francais_bac') or 0),
            'ang':  float(form_data.get('note_anglais_bac') or 0),
        }
        # Trier par longueur décroissante pour éviter de remplacer 'l' avant 'l1'
        for key in sorted(vars_map.keys(), key=len, reverse=True):
            formule = re.sub(r'\b' + re.escape(key) + r'\b', str(vars_map[key]), formule)
        if not _SAFE_EXPR_RE.match(formule):
            return 0.0
        try:
            return float(eval(formule, {"__builtins__": {}}))
        except Exception:
            return 0.0

    # ────────────────────────────────────────────────────────────────────
    # Mode 'palier'
    # ────────────────────────────────────────────────────────────────────
    @staticmethod
    def _valeur_palier(critere: dict, form_data: dict) -> float:
        code = critere.get('code', '')
        paliers = critere.get('paliers') or []
        if not paliers:
            return 0.0

        def at(i: int, default: float = 0.0) -> float:
            try:
                return float(paliers[i].get('points', default))
            except (IndexError, KeyError, TypeError):
                return default

        # --- B.N.R : Bonus Non-Redoublement
        if code in ('B.N.R', 'BNR'):
            n = int(form_data.get('nb_redoublements') or 0)
            if n == 0: return at(0, 5)
            if n == 1: return at(1, 3)
            return at(-1, 0)

        # --- B.S.P : Bonus Session Principale
        if code in ('B.S.P', 'BSP'):
            n = int(form_data.get('nb_sessions_controle') or 0)
            if n == 0: return at(0, 3)
            if n == 1: return at(1, 2)
            return at(-1, 0)

        # --- B.L : Bonus Langue
        if code in ('B.L', 'BL'):
            note_fr = float(form_data.get('note_francais_bac') or 0)
            note_ang = float(form_data.get('note_anglais_bac') or 0)
            certif_b2 = bool(form_data.get('certif_b2'))
            if note_fr >= 12 or note_ang >= 12 or certif_b2:
                return at(0, 1)
            return at(-1, 0)

        # --- B.A.D : Bonus Année Diplôme
        if code in ('B.A.D', 'BAD'):
            annee = int(form_data.get('annee_diplome') or 0)
            if annee in (2025, 2023): return at(0, 4)
            if annee in (2022, 2021, 2020): return at(1, 2)
            return at(-1, 0)

        # --- M.C : Malus Session Contrôle (MRMI)
        if code in ('M.C', 'MC'):
            malus = 0.0
            if form_data.get('session_l1_controle'): malus += at(0, -1)
            if form_data.get('session_l2_controle'): malus += at(1, -1.5)
            if form_data.get('session_l3_controle'): malus += at(2, -2)
            return malus

        # --- B1 / B2 : Bonus Ingénieur (session principale / rattrapage)
        if code == 'B1':
            session = form_data.get('session_l1') or 'principale'
            if session == 'principale': return at(0, 2)
            if session == 'rattrapage': return at(1, 1.5)
            return at(-1, 0)
        if code == 'B2':
            session = form_data.get('session_l2') or 'principale'
            if session == 'principale': return at(0, 2)
            if session == 'rattrapage': return at(1, 1.5)
            return at(-1, 0)

        # Critère palier inconnu → premier point comme défaut
        return at(0, 0)

    # ────────────────────────────────────────────────────────────────────
    # API publique
    # ────────────────────────────────────────────────────────────────────
    @staticmethod
    def calculer_valeur_critere(critere: dict, form_data: dict) -> float:
        mode = critere.get('mode', 'fixe')
        if mode == 'fixe':
            return ScoreService._valeur_fixe(critere, form_data)
        if mode == 'formule':
            return ScoreService._valeur_formule(critere, form_data)
        if mode == 'palier':
            return ScoreService._valeur_palier(critere, form_data)
        return 0.0

    @staticmethod
    def calculer_score_total(offre, form_data: dict) -> Tuple[float, List[Dict[str, Any]]]:
        """
        Recalcule le score total pour une offre + données candidat.

        Retourne un tuple (total, detail) où :
          - total  : score final arrondi à 2 décimales
          - detail : liste de {code, label, valeur} pour traçabilité
        """
        criteres = getattr(offre, 'criteres', None) or []
        formule = getattr(offre, 'score_formule', None) or '0'

        detail = []
        valeurs = {}
        for critere in criteres:
            code = critere.get('code', '')
            val = ScoreService.calculer_valeur_critere(critere, form_data)
            valeurs[code] = val
            detail.append({
                'code': code,
                'label': critere.get('label', ''),
                'valeur': val,
            })

        # Remplacer les codes dans la formule par leurs valeurs numériques
        # Tri par longueur décroissante pour gérer correctement M.Bac avant M
        expr = str(formule).replace('×', '*')
        for code in sorted(valeurs.keys(), key=len, reverse=True):
            safe = re.escape(code)
            expr = re.sub(safe, str(valeurs[code]), expr)

        if not _SAFE_EXPR_RE.match(expr):
            return 0.0, detail

        try:
            score = float(eval(expr, {"__builtins__": {}}))
            if score != score or score in (float('inf'), float('-inf')):
                return 0.0, detail
            return round(score, 2), detail
        except Exception:
            return 0.0, detail

    # ────────────────────────────────────────────────────────────────────
    # Détection de fraude
    # ────────────────────────────────────────────────────────────────────
    @staticmethod
    def detecter_fraude(score_backend: float, score_frontend: float, tolerance: float = 0.5) -> bool:
        """Retourne True si l'écart entre le score backend et déclaré dépasse la tolérance."""
        return abs(score_backend - score_frontend) > tolerance
