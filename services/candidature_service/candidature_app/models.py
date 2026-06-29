# -*- coding: utf-8 -*-
from django.db import models
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import timedelta

User = get_user_model()


def _safe_float(value, default=0.0):
    """Safely coerce values to float with a default fallback.

    This helper avoids raising on missing or malformed inputs used in scoring.
    """
    try:
        if value is None or value == "":
            return float(default)
        return float(value)
    except (TypeError, ValueError):
        try:
            return float(default)
        except Exception:
            return 0.0


def _normalize_text(value):
    """Normalize text for comparison: lowercase, strip whitespace."""
    if value is None:
        return ""
    return str(value).strip().lower()


def get_bonus(session, a_redouble):
    """Bonus utilitaire pour le concours ingenieur interne.

    - Non redoublant + session principale: 2
    - Non redoublant + session rattrapage/controle: 1.5
    - Redoublant + session principale: 1
    - Redoublant + session rattrapage/controle: 0
    """
    session_norm = _normalize_text(session)
    is_principale = session_norm in {'principale', 'principal', 'main'}
    if not a_redouble:
        return 2.0 if is_principale else 1.5
    return 1.0 if is_principale else 0.0


class Master(models.Model):
    TYPE_MASTER_CHOICES = [
        ('professionnel', 'Professionnel'),
        ('recherche', 'Recherche'),
    ]

    nom = models.CharField(max_length=200)
    type_master = models.CharField(max_length=20, choices=TYPE_MASTER_CHOICES)
    description = models.TextField(blank=True)
    specialite = models.CharField(max_length=200)
    places_disponibles = models.IntegerField(default=30)
    date_limite_candidature = models.DateField()
    annee_universitaire = models.CharField(max_length=20)
    actif = models.BooleanField(default=True)
    coeff_bac = models.DecimalField(max_digits=5, decimal_places=2, default=0.4)
    coeff_licence = models.DecimalField(max_digits=5, decimal_places=2, default=0.6)
    coeff_examen = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    bonus_mention = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)

    # Sprint 4 — Critères et formule de score (définis par le responsable de commission)
    # ⚠ champ nommé `score_formule` (pas `formule_score`) pour éviter le conflit
    # avec le related_name='formule_score' de FormuleScore.master.
    criteres = models.JSONField(default=list, blank=True)
    score_formule = models.CharField(max_length=500, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['nom']

    def __str__(self):
        return self.nom


class OffreMaster(models.Model):
    titre = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    capacite = models.IntegerField(default=30)
    date_limite = models.DateField()
    actif = models.BooleanField(default=True)
    appel_actif = models.BooleanField(default=True)
    capacites_detaillees = models.JSONField(default=list, blank=True)
    date_debut_visibilite = models.DateField(null=True, blank=True)
    date_fin_visibilite = models.DateField(null=True, blank=True)
    date_limite_depot_dossier = models.DateField(null=True, blank=True)
    date_limite_preinscription = models.DateField(null=True, blank=True)
    est_publiee = models.BooleanField(default=False)
    type_formation = models.CharField(max_length=30, default='master')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    master = models.OneToOneField(Master, on_delete=models.CASCADE, related_name='offre_master')

    class Meta:
        ordering = ['date_limite', 'titre']

    def __str__(self):
        return self.titre


class Commission(models.Model):
    """Représente une commission (groupe d'examen/validation)."""
    master = models.ForeignKey(
        Master,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='commissions',
    )
    nom = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    actif = models.BooleanField(default=True)
    # Date/heure limite pour la soumission des avis par les membres
    deadline_avis = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.nom
class MembreCommission(models.Model):
    ROLE_CHOICES = [
        ('responsable', 'Responsable'),
        ('membre', 'Membre'),
    ]
    # Keep the legacy primary commission link for compatibility.
    commission = models.ForeignKey(Commission, on_delete=models.CASCADE, related_name='membres')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='commissions')
    commissions = models.ManyToManyField(Commission, related_name='membre_commission_links')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)

    date_nomination = models.DateField(auto_now_add=True)
    actif = models.BooleanField(default=True)

    class Meta:
        unique_together = ['commission', 'user']

    def __str__(self):
        # Show user and number of linked commissions for clarity
        try:
            count = self.commissions.count()
        except Exception:
            count = 0
        return f"{self.user.get_full_name()} - {count} commission(s)"


class ConfigurationAppel(models.Model):
    master = models.OneToOneField(Master, on_delete=models.CASCADE, related_name='configuration')
    
    date_debut_visibilite = models.DateField(help_text="Date à partir de laquelle l'appel est visible")
    date_fin_visibilite = models.DateField(help_text="Date de fin de visibilité de l'appel")
    
    date_limite_preinscription = models.DateField()
    date_limite_depot_dossier = models.DateField(null=True, blank=True)
    date_limite_paiement = models.DateField(null=True, blank=True)
    
    delai_modification_candidature_jours = models.IntegerField(default=7)
    delai_depot_dossier_preselectionnes_jours = models.IntegerField(default=14)
    
    capacite_accueil = models.IntegerField()
    capacite_liste_attente = models.IntegerField(default=50)
    capacite_interne = models.IntegerField(default=0)
    capacite_externe = models.IntegerField(default=0)

    # Quotas pour la décision finale automatique
    quota_lp = models.IntegerField(
        default=0,
        help_text="Nombre de places en Liste Principale (admis directs)"
    )
    quota_la = models.IntegerField(
        default=0,
        help_text="Nombre de places en Liste d'Attente"
    )
    document_officiel_pdf = models.FileField(upload_to='offres/', null=True, blank=True)
    contenu_offre_edite = models.JSONField(default=dict, blank=True)
    est_cache = models.BooleanField(default=False)

    # Schema configurable du formulaire de depot dossier par master.
    # Exemple:
    # {
    #   "required_fields": ["cin", "telephone"],
    #   "required_documents": ["releve_notes", "diplome"]
    # }
    formulaire_commission_schema = models.JSONField(default=dict, blank=True)
    
    actif = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['actif', 'date_limite_preinscription']),
            models.Index(fields=['date_debut_visibilite', 'date_fin_visibilite']),
        ]
    
    def __str__(self):
        return f"Configuration {self.master.nom}"
    
    def est_visible(self):
        today = timezone.now().date()
        if not self.actif:
            return False

        start = getattr(self, 'date_debut_visibilite', None)
        end = getattr(self, 'date_fin_visibilite', None)

        if start and end:
            return start <= today <= end

        if start and not end:
            return start <= today

        if end and not start:
            return today <= end

        # If no bounds, fallback to active flag
        return bool(self.actif)

    def peut_candidater(self):
        today = timezone.now().date()
        if not self.actif:
            return False

        deadline = getattr(self, 'date_limite_preinscription', None)
        if not deadline:
            return True

        return today <= deadline
    
    def peut_candidater(self):
        today = timezone.now().date()
        return self.actif and today <= self.date_limite_preinscription


class Candidature(models.Model):
    STATUT_CHOICES = [
        ('soumis', 'Soumis'),
        ('annule', 'Annulé'),
        ('sous_examen', 'Sous examen'),
        ('rejete', 'Rejeté/Invalide'),
        ('preselectionne', 'Présélectionné'),
        ('en_attente_dossier', 'En attente de dossier numérique'),
        ('dossier_non_depose', 'Dossier non déposé'),
        ('dossier_depose', 'Dossier déposé'),
        ('en_attente', 'En attente'),
        ('selectionne', 'Sélectionné/Admis'),
        ('inscrit', 'Inscrit')
    ]

    NATURE_CANDIDATURE_CHOICES = [
        ('isimm', 'Étudiant ISIMM'),
        ('externe', 'Étudiant Externe'),
    ]

    numero = models.CharField(max_length=50, unique=True, blank=True)
    candidat = models.ForeignKey(User, on_delete=models.CASCADE, related_name='candidatures')
    master = models.ForeignKey(Master, on_delete=models.CASCADE, related_name='candidatures')

    # Interne (ISIMM) ou Externe — détermine INT/EXT dans le numéro de candidature
    nature_candidature = models.CharField(
        max_length=10, choices=NATURE_CANDIDATURE_CHOICES, default='externe'
    )

    # Détection fraude : True si le score soumis par le front diffère du score recalculé backend
    flag_fraude = models.BooleanField(default=False)
    score_soumis_front = models.DecimalField(max_digits=6, decimal_places=3, null=True, blank=True)

    # Champs OCR pour comparaison note extraite vs note saisie candidat
    note_extraite_ocr = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="Moyenne extraite automatiquement depuis le PDF du dossier (OCR)"
    )
    note_saisie_candidat = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="Moyenne déclarée par le candidat dans le formulaire de préinscription"
    )
    
    statut = models.CharField(max_length=30, choices=STATUT_CHOICES, default='soumis')
    score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    classement = models.IntegerField(null=True, blank=True)

    # ── Workflow d'inscription en ligne ──
    STATUT_INSCRIPTION_CHOICES = [
        ('selectionne', 'Sélectionné'),
        ('inscription_saisie', 'Inscription saisie'),
        ('en_attente_verification', 'En attente de vérification'),
        ('inscrit', 'Inscrit confirmé'),
    ]
    statut_inscription = models.CharField(
        max_length=30,
        choices=STATUT_INSCRIPTION_CHOICES,
        default='selectionne',
        help_text="Statut du processus d'inscription en ligne"
    )
    numero_inscription = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Numéro d'inscription universitaire saisi par le candidat"
    )
    date_saisie_inscription = models.DateTimeField(null=True, blank=True)
    
    date_soumission = models.DateTimeField(auto_now_add=True)
    date_limite_modification = models.DateTimeField(null=True, blank=True)
    date_changement_statut = models.DateTimeField(null=True, blank=True)
    
    dossier_valide = models.BooleanField(default=False)
    dossier_depose = models.BooleanField(default=False)
    date_depot_dossier = models.DateTimeField(null=True, blank=True)
    
    choix_priorite = models.IntegerField(default=1)
    
    peut_modifier = models.BooleanField(default=True)
    notification_envoyee = models.BooleanField(default=False)
    
    motif_rejet = models.TextField(blank=True)
    date_annulation = models.DateTimeField(null=True, blank=True)
    annule_par_candidat = models.BooleanField(default=False)
    
    delai_depot_dossier = models.DateField(null=True, blank=True)
    prolongation_delai = models.BooleanField(default=False)
    
    historique = models.JSONField(default=list, blank=True)
    # Decision finale par le responsable apres consultation des avis
    DECISION_CHOICES = [
        ('en_attente', 'En attente'),
        ('valide', 'Validé'),
        ('rejete', 'Rejeté'),
    ]
    decision_finale_responsable = models.CharField(max_length=20, choices=DECISION_CHOICES, default='en_attente')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    concours = models.ForeignKey(
        'Concours', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='candidatures_concours'
    )
    class Meta:
        unique_together = ['candidat', 'master']
        ordering = ['-date_soumission']
        indexes = [
            models.Index(fields=['candidat', 'statut']),
            models.Index(fields=['master', 'statut']),
            models.Index(fields=['statut', 'date_soumission']),
            models.Index(fields=['concours', 'statut']),
        ]
    
    def __str__(self):
        return f"{self.numero} - {self.candidat.get_full_name()}"
    
    def save(self, *args, **kwargs):
        if not self.numero:
            self.numero = self.generer_numero_candidature()
        
        if not self.date_limite_modification and self.statut == 'soumis':
            self.date_limite_modification = timezone.now() + timedelta(days=7)
        
        if self.statut in ['sous_examen', 'preselectionne', 'selectionne']:
            self.peut_modifier = False

        # Sprint 2: recalcul automatique si les details de notes bac/licence sont disponibles.
        weighted_score = self._compute_bac_licence_weighted_score()
        if weighted_score is not None:
            self.score = weighted_score
        
        super().save(*args, **kwargs)

    def _compute_bac_licence_weighted_score(self):
        donnees = getattr(self, 'donnees_academiques', None)
        if not donnees:
            return None

        notes = donnees.notes_detaillees if isinstance(donnees.notes_detaillees, dict) else {}
        payload = notes.get('payload', {}) if isinstance(notes.get('payload'), dict) else {}

        def _avg(values):
            cleaned = [_safe_float(v, None) for v in values]
            cleaned = [v for v in cleaned if v is not None]
            if not cleaned:
                return None
            return sum(cleaned) / len(cleaned)

        formation_code = str(notes.get('formation_code') or payload.get('formation_code') or '').upper()
        common = payload.get('common', {}) if isinstance(payload.get('common'), dict) else {}
        gl_ds = payload.get('glDs', {}) if isinstance(payload.get('glDs'), dict) else {}
        i3 = payload.get('i3', {}) if isinstance(payload.get('i3'), dict) else {}
        mrgl_licence = payload.get('mrglLicence', {}) if isinstance(payload.get('mrglLicence'), dict) else {}
        mrgl_maitrise = payload.get('mrglMaitrise', {}) if isinstance(payload.get('mrglMaitrise'), dict) else {}
        mrmi_cas1 = payload.get('mrmiCas1', {}) if isinstance(payload.get('mrmiCas1'), dict) else {}
        mrmi_cas2 = payload.get('mrmiCas2', {}) if isinstance(payload.get('mrmiCas2'), dict) else {}
        ing_cas1 = payload.get('ingCas1', {}) if isinstance(payload.get('ingCas1'), dict) else {}
        ing_cas2 = payload.get('ingCas2', {}) if isinstance(payload.get('ingCas2'), dict) else {}

        moyenne_bac = notes.get('moyenne_bac', payload.get('moyenne_bac'))
        moyenne_licence = notes.get('moyenne_licence', payload.get('moyenne_licence'))

        if moyenne_bac in [None, ''] or moyenne_licence in [None, '']:
            if formation_code in ['MPGL', 'MPDS']:
                moyenne_licence = moyenne_licence if moyenne_licence not in [None, ''] else _avg([
                    gl_ds.get('moy1'), gl_ds.get('moy2'), gl_ds.get('moy3')
                ])
            elif formation_code == 'MP3I':
                moyenne_bac = moyenne_bac if moyenne_bac not in [None, ''] else i3.get('moyBac')
                moyenne_licence = moyenne_licence if moyenne_licence not in [None, ''] else _avg([
                    i3.get('moyL1'), i3.get('moyL2'), i3.get('moyL3')
                ])
            elif formation_code == 'MRGL':
                parcours = str(payload.get('mrglParcours') or '').lower()
                if parcours == 'maitrise':
                    moyenne_bac = moyenne_bac if moyenne_bac not in [None, ''] else mrgl_maitrise.get('moyBac')
                    moyenne_licence = moyenne_licence if moyenne_licence not in [None, ''] else _avg([
                        mrgl_maitrise.get('moy1'),
                        mrgl_maitrise.get('moy2'),
                        mrgl_maitrise.get('moy3'),
                        mrgl_maitrise.get('moy4'),
                    ])
                else:
                    moyenne_bac = moyenne_bac if moyenne_bac not in [None, ''] else mrgl_licence.get('moyBac')
                    moyenne_licence = moyenne_licence if moyenne_licence not in [None, ''] else _avg([
                        mrgl_licence.get('moy1'), mrgl_licence.get('moy2'), mrgl_licence.get('moy3')
                    ])
            elif formation_code == 'MRMI':
                parcours = str(payload.get('mrmiParcours') or '').lower()
                if parcours == 'cas2':
                    moyenne_licence = moyenne_licence if moyenne_licence not in [None, ''] else mrmi_cas2.get('moyIng1')
                else:
                    moyenne_bac = moyenne_bac if moyenne_bac not in [None, ''] else mrmi_cas1.get('moyBac')
                    moyenne_licence = moyenne_licence if moyenne_licence not in [None, ''] else _avg([
                        mrmi_cas1.get('moyL1'), mrmi_cas1.get('moyL2'), mrmi_cas1.get('moyL3')
                    ])
            elif formation_code in ['ING_INFO_GL', 'ING_EM']:
                parcours = str(payload.get('ingParcours') or '').lower()
                if parcours == 'cas2':
                    moyenne_licence = moyenne_licence if moyenne_licence not in [None, ''] else _avg([
                        ing_cas2.get('m1'), ing_cas2.get('m2'), ing_cas2.get('m3')
                    ])
                else:
                    moyenne_licence = moyenne_licence if moyenne_licence not in [None, ''] else _avg([
                        ing_cas1.get('moy1'), ing_cas1.get('moy2')
                    ])

        if moyenne_bac in [None, '']:
            moyenne_bac = _safe_float(getattr(donnees, 'moyenne_specialite', None), default=None)
        if moyenne_licence in [None, '']:
            moyenne_licence = _safe_float(getattr(donnees, 'moyenne_generale', None), default=None)

        bac = _safe_float(moyenne_bac, default=None)
        licence = _safe_float(moyenne_licence, default=None)

        if bac is None and licence is None:
            return None

        if bac is None:
            bac = licence
        if licence is None:
            licence = bac

        coeff_bac = float(self.master.coeff_bac or 0)
        coeff_licence = float(self.master.coeff_licence or 0)
        coeff_examen = float(self.master.coeff_examen or 0)
        bonus_mention = float(self.master.bonus_mention or 0)

        examen = _safe_float(notes.get('moyenne_examen', payload.get('moyenne_examen')), default=None)
        if examen is None:
            examen = _safe_float(getattr(donnees, 'note_pfe', None), default=0.0)

        mention_bonus = 0.0
        if str(common.get('session') or '').lower() in {'principale', 'main'}:
            mention_bonus = bonus_mention

        return round(
            (float(bac) * coeff_bac)
            + (float(licence) * coeff_licence)
            + (float(examen) * coeff_examen)
            + mention_bonus,
            2,
        )

    def calculer_score_final(self, payload=None):
        """Calcule le score final en utilisant le moteur ParcoursAdmission (strategy).

        Retourne un dict: {'score': float, 'details': {...}}. Les champs manquants sont traités comme 0.
        """
        # Build payload if not provided
        if payload is None:
            donnees = getattr(self, 'donnees_academiques', None)
            if donnees and isinstance(donnees.notes_detaillees, dict):
                payload = donnees.notes_detaillees.get('payload') if isinstance(donnees.notes_detaillees.get('payload'), dict) else donnees.notes_detaillees
            else:
                payload = {}

        # Find a parcours for this master
        parcours = None
        try:
            parcours = self.master.parcours_admissions.filter(actif=True).first()
        except Exception:
            parcours = None

        details = {}
        score = None

        try:
            if parcours:
                # Use ParcoursAdmission strategy to compute numeric score
                score = parcours.calculer_score(self)
                # Build basic details by reusing parcours type logic (best-effort)
                if parcours.type == 'MASTER_PRO':
                    gl = payload.get('glDs') if isinstance(payload.get('glDs'), dict) else payload
                    m1 = _safe_float(gl.get('moy1') or gl.get('m1') or payload.get('moyenne1'), default=0.0)
                    m2 = _safe_float(gl.get('moy2') or gl.get('m2') or payload.get('moyenne2'), default=0.0)
                    m3 = _safe_float(gl.get('moy3') or gl.get('m3') or payload.get('moyenne3'), default=0.0)
                    moyenne = round((m1 + m2 + m3) / 3.0, 3)
                    nb_redoublements = int(_safe_float((payload.get('common') or {}).get('redoublements') or payload.get('nb_redoublements') or 0, default=0))
                    if nb_redoublements == 0:
                        bnr = 5.0
                    elif nb_redoublements == 1:
                        bnr = 3.0
                    else:
                        bnr = 0.0
                    session = (payload.get('common') or {}).get('session') or payload.get('session') or payload.get('session_reussite')
                    nb_rattrapages = int(_safe_float((payload.get('common') or {}).get('rattrapages') or payload.get('nb_rattrapages') or 0, default=0))
                    if (str(session or '').lower() in {'principale', 'main'}) and nb_rattrapages == 0:
                        bsp = 3.0
                    elif nb_rattrapages == 1:
                        bsp = 2.0
                    else:
                        bsp = 0.0
                    details = {'m1': m1, 'm2': m2, 'm3': m3, 'moyenne': moyenne, 'bnr': bnr, 'bsp': bsp}

                elif parcours.type == 'MASTER_RECHERCHE':
                    mrgl = payload.get('mrglLicence') if isinstance(payload.get('mrglLicence'), dict) else payload
                    m1 = _safe_float(mrgl.get('moy1') or payload.get('moy1'), default=0.0)
                    m2 = _safe_float(mrgl.get('moy2') or payload.get('moy2'), default=0.0)
                    m3 = _safe_float(mrgl.get('moy3') or payload.get('moy3'), default=0.0)
                    nb_redoublements = int(_safe_float((payload.get('common') or {}).get('redoublements') or payload.get('nb_redoublements') or 0, default=0))
                    bnr = 5.0 if nb_redoublements == 0 else (3.0 if nb_redoublements == 1 else 0.0)
                    session = (payload.get('common') or {}).get('session') or payload.get('session') or payload.get('session_reussite')
                    nb_rattrapages = int(_safe_float((payload.get('common') or {}).get('rattrapages') or payload.get('nb_rattrapages') or 0, default=0))
                    bsp = 3.0 if (str(session or '').lower() in {'principale', 'main'} and nb_rattrapages == 0) else (2.0 if nb_rattrapages == 1 else 0.0)
                    moyenne_bac = _safe_float(payload.get('moyenne_bac') or payload.get('moyenne_specialite') or payload.get('moyenne'), default=0.0)
                    note_math_bac = _safe_float(payload.get('noteMathBac') or payload.get('note_math_bac') or payload.get('math_bac'), default=0.0)
                    term = round((float(moyenne_bac) + float(note_math_bac) - 20.0) / 2.0, 3)
                    note_fr = _safe_float(payload.get('note_fr') or payload.get('note_francais') or payload.get('francais_bac'), default=0.0)
                    note_ang = _safe_float(payload.get('note_ang') or payload.get('note_anglais') or payload.get('anglais_bac'), default=0.0)
                    cert_b2 = payload.get('certif_b2') or payload.get('certif_b2_fr') or payload.get('certif_b2', False)
                    bonus_langue = 1.0 if (note_fr >= 12.0 or note_ang >= 12.0 or cert_b2) else 0.0
                    annee_diplome = None
                    try:
                        annee_diplome = int(payload.get('annee_diplome') or payload.get('year_diplome') or payload.get('annee'))
                    except Exception:
                        annee_diplome = None
                    bonus_diplome = 4.0 if annee_diplome in {2025, 2023} else (2.0 if annee_diplome in {2022, 2021, 2020} else 0.0)
                    details = {
                        'm1': m1,
                        'm2': m2,
                        'm3': m3,
                        'bnr': bnr,
                        'bsp': bsp,
                        'term_moyenne_math': term,
                        'bonus_langue': bonus_langue,
                        'bonus_diplome': bonus_diplome,
                    }

                elif parcours.type == 'CYCLE_ING':
                    mode = (payload.get('ing_type') or payload.get('type') or '').lower()
                    if mode == 'interne' or payload.get('interne'):
                        ing = payload.get('ingCas1') if isinstance(payload.get('ingCas1'), dict) else payload
                        m2 = _safe_float(ing.get('moy2') or ing.get('m2') or payload.get('moyenne2'), default=0.0)
                        nb_redoublements = int(_safe_float((payload.get('common') or {}).get('redoublements') or payload.get('nb_redoublements') or 0, default=0))
                        if nb_redoublements == 0:
                            b1 = 2.0
                            b2 = 2.0
                        elif nb_redoublements == 1:
                            b1 = 1.0
                            b2 = 1.0
                        else:
                            b1 = 0.0
                            b2 = 0.0
                        session = (payload.get('common') or {}).get('session') or payload.get('session') or payload.get('session_reussite')
                        if str(session or '').lower() not in {'principale', 'main'}:
                            b1 = max(0.0, b1 - 0.5)
                            b2 = max(0.0, b2 - 0.5)
                        details = {'m2': m2, 'b1': b1, 'b2': b2}
                    else:
                        m1 = _safe_float(payload.get('moy1') or payload.get('m1') or 0.0, default=0.0)
                        m2 = _safe_float(payload.get('moy2') or payload.get('m2') or 0.0, default=0.0)
                        m3 = _safe_float(payload.get('moy3') or payload.get('m3') or 0.0, default=0.0)
                        rang1 = _safe_float(payload.get('rang1') or payload.get('r1') or 0.0, default=0.0)
                        rang2 = _safe_float(payload.get('rang2') or payload.get('r2') or 0.0, default=0.0)
                        nb_etudiants = int(_safe_float(payload.get('nombre_etudiants') or payload.get('effectif') or 1, default=1))
                        denom = max(1, nb_etudiants - 1)
                        R1 = float(rang1) / denom if denom else 0.0
                        R2 = float(rang2) / denom if denom else 0.0
                        details = {'m1': m1, 'm2': m2, 'm3': m3, 'R1': R1, 'R2': R2, 'nb_etudiants': nb_etudiants}

            else:
                # No parcours: attempt to compute using master coefficients
                score = self._compute_bac_licence_weighted_score()
                details = {'method': 'coeff_master_fallback'}
        except Exception:
            score = None
            details = {'error': 'calculation_failed'}

        # Ensure numeric score
        try:
            score = float(score) if score is not None else 0.0
        except Exception:
            score = 0.0

        result = {'score': round(score, 3), 'details': details}

        # persist
        try:
            self.score = result['score']
            self.save(update_fields=['score', 'updated_at'])
        except Exception:
            pass

        return result
    
    def generer_numero_candidature(self):
        """
        Format : {YYMM}-{INT|EXT}-{00001}-{FILIÈRE}
        Exemples :
          - Interne MPGL  → 2603-INT-00001-GL
          - Externe MRGL  → 2603-EXT-00001-MRGL
          - Ingénieur     → 2603-INT-00001-ING
        """
        now = timezone.now()
        annee = str(now.year)[-2:]
        mois = f"{now.month:02d}"

        # Déterminer INT ou EXT selon la nature déclarée
        type_candidat = 'INT' if getattr(self, 'nature_candidature', 'externe') == 'isimm' else 'EXT'

        # Déterminer le code filière
        if getattr(self, 'concours', None):
            filiere_code = "ING"
        else:
            master_nom = self.master.nom.upper() if self.master else ''
            filiere_code = self._generer_abreviation(master_nom)

        prefix = f"{annee}{mois}"
        count = Candidature.objects.filter(numero__startswith=prefix).count() + 1
        compteur = f"{count:05d}"

        return f"{prefix}-{type_candidat}-{compteur}-{filiere_code}"
    
    def _generer_abreviation(self, nom_master):
        mots_ignores = {'master', 'de', 'des', 'et', 'en', 'pour', 'la', 'le'}
        mots = [mot for mot in nom_master.split() if mot.lower() not in mots_ignores]
        
        if len(mots) == 0:
            return "XXX"
        elif len(mots) == 1:
            return mots[0][:3]
        else:
            return ''.join([mot[0] for mot in mots[:3]])
    
    def peut_etre_modifie(self):
        if not self.peut_modifier:
            return False
        if self.statut != 'soumis':
            return False
        if timezone.now() > self.date_limite_modification:
            return False
        return True
    
    def ajouter_historique(self, ancien_statut, nouveau_statut, user, commentaire=''):
        self.historique.append({
            'date': timezone.now().isoformat(),
            'ancien_statut': ancien_statut,
            'nouveau_statut': nouveau_statut,
            'modifie_par': user.get_full_name(),
            'commentaire': commentaire
        })
        self.save()
    
    def peut_etre_annulee(self):
        return self.statut in ['soumis', 'en_attente']
    
    def est_dans_corbeille(self):
        return self.statut == 'annule' and self.annule_par_candidat


class Notification(models.Model):
    TYPE_CHOICES = [
        ('info', 'Information'),
        ('success', 'Succès'),
        ('warning', 'Avertissement'),
        ('danger', 'Danger'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    titre = models.CharField(max_length=255)
    message = models.TextField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='info')
    lue = models.BooleanField(default=False)
    dedup_key = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'dedup_key'],
                name='unique_notification_dedup_per_user',
            )
        ]
        indexes = [
            models.Index(fields=['user', 'lue', 'created_at']),
        ]

    def __str__(self):
        return f"{self.user_id} - {self.titre}"


class AvisMembre(models.Model):
    """Avis laissé par un membre de commission pour une candidature.

    - `membre`: lien vers l'enregistrement MembreCommission (garde contexte rôle + user)
    - `candidature`: candidature concernée
    - `commission`: commission concernée (optionnel, on peut l'inférer depuis `membre`)
    - `avis`: True = positif / False = négatif
    - `argument`: texte explicatif (obligatoire si avis négatif but allow blank)
    - `date_avis`: timestamp de l'avis
    """
    membre = models.ForeignKey(MembreCommission, on_delete=models.CASCADE, related_name='avis')
    candidature = models.ForeignKey(Candidature, on_delete=models.CASCADE, related_name='avis_membres')
    commission = models.ForeignKey(Commission, on_delete=models.CASCADE, related_name='avis_membres')
    avis = models.BooleanField()
    argument = models.TextField(blank=True)
    date_avis = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['membre', 'candidature', 'commission']
        ordering = ['-date_avis']
        indexes = [
            models.Index(fields=['commission', 'date_avis']),
            models.Index(fields=['candidature', 'membre']),
        ]

    def __str__(self):
        try:
            user_name = self.membre.user.get_full_name()
        except Exception:
            user_name = str(self.membre_id)
        cand = getattr(self.candidature, 'numero', str(self.candidature_id))
        return f"Avis {user_name} on {cand}: {'OK' if self.avis else 'NOK'}"


class AvisSelection(models.Model):
    """Avis global d'un membre pour une commission et une présélection.

    Cet avis représente l'opinion consolidée sur la liste complète.
    """

    STATUT_CHOICES = [
        ('favorable', 'Favorable'),
        ('defavorable', 'Defavorable'),
    ]

    commission = models.ForeignKey(
        Commission,
        on_delete=models.CASCADE,
        related_name='avis_selection',
    )
    membre = models.ForeignKey(
        MembreCommission,
        on_delete=models.CASCADE,
        related_name='avis_selection',
    )
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES)
    commentaire = models.TextField(blank=True)
    date_avis = models.DateTimeField(auto_now=True)
    is_global = models.BooleanField(default=True)

    class Meta:
        ordering = ['-date_avis']
        constraints = [
            models.UniqueConstraint(
                fields=['commission', 'membre', 'is_global'],
                name='unique_global_avis_selection',
            ),
            # NOTE : la contrainte "commentaire requis si défavorable" est
            # appliquée dans clean() ci-dessous + côté serializer.
            # (CheckConstraint retiré pour compatibilité Django/Python 3.14)
        ]
        indexes = [
            models.Index(fields=['commission', 'date_avis']),
            models.Index(fields=['membre', 'is_global']),
        ]

    def clean(self):
        commentaire = (self.commentaire or '').strip()
        self.commentaire = commentaire
        if self.statut == 'defavorable' and not commentaire:
            raise ValidationError('Le commentaire est obligatoire pour un avis défavorable.')

    def save(self, *args, **kwargs):
        self.commentaire = (self.commentaire or '').strip()
        if self.statut == 'defavorable' and not self.commentaire:
            raise ValidationError('Le commentaire est obligatoire pour un avis défavorable.')
        return super().save(*args, **kwargs)

    def __str__(self):
        try:
            user_name = self.membre.user.get_full_name() or self.membre.user.username
        except Exception:
            user_name = str(self.membre_id)
        return f"AvisSelection {user_name} - {self.commission.nom}: {self.statut}"


class FormuleScore(models.Model):
    master = models.OneToOneField(Master, on_delete=models.CASCADE, related_name='formule_score')
    
    nom = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    coef_moyenne_generale = models.DecimalField(max_digits=5, decimal_places=2, default=0.60)
    coef_moyenne_specialite = models.DecimalField(max_digits=5, decimal_places=2, default=0.30)
    coef_note_pfe = models.DecimalField(max_digits=5, decimal_places=2, default=0.10)
    
    bonus_mention_tres_bien = models.DecimalField(max_digits=5, decimal_places=2, default=2.00)
    bonus_mention_bien = models.DecimalField(max_digits=5, decimal_places=2, default=1.00)
    bonus_mention_assez_bien = models.DecimalField(max_digits=5, decimal_places=2, default=0.50)
    
    malus_redoublement = models.DecimalField(max_digits=5, decimal_places=2, default=-1.00)
    malus_dette = models.DecimalField(max_digits=5, decimal_places=2, default=-0.50)
    
    criteres_specifiques = models.JSONField(default=dict, blank=True)
    
    actif = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Formule {self.master.nom}"

    def _master_formula_key(self):
        haystack = _normalize_text(f"{self.master.nom} {self.master.specialite}")

        if 'mpgl' in haystack or 'genielogiciel' in haystack and 'recherche' not in haystack:
            return 'MPGL'
        if 'mpds' in haystack or 'sciencedesdonnees' in haystack:
            return 'MPDS'
        if '3i' in haystack or 'instrumentationindustrielle' in haystack:
            return 'MP3I'
        if 'mrgl' in haystack or ('recherche' in haystack and 'genielogiciel' in haystack):
            return 'MRGL'
        if 'mrmi' in haystack or ('recherche' in haystack and 'microelectronique' in haystack):
            return 'MRMI'
        if 'inginfo' in haystack or ('ingenieur' in haystack and 'informatique' in haystack and 'genielogiciel' in haystack):
            return 'ING_INFO_GL'
        if 'ingem' in haystack or ('ingenieur' in haystack and 'electronique' in haystack):
            return 'ING_EM'

        return 'GENERIC'

    def _session_control_count(self, *sessions):
        count = 0
        for session in sessions:
            value = _normalize_text(session)
            if not value:
                continue
            if value in {'control', 'controle', 'rattrapage', 'sessioncontrole', 'sessionrattrapage'}:
                count += 1
        return count

    def _bonus_session_principale(self, *sessions):
        control_count = self._session_control_count(*sessions)
        if control_count == 0:
            return 3.0
        if control_count == 1:
            return 2.0
        return 0.0

    def _bonus_redoublement(self, nb_redoublements):
        if nb_redoublements <= 0:
            return 5.0
        if nb_redoublements == 1:
            return 3.0
        return 0.0

    def _bonus_redoublement_mrgl(self, nb_redoublements):
        if nb_redoublements <= 0:
            return 5.0
        if nb_redoublements == 1:
            return 3.0
        return 0.0

    def _bonus_langue(self, note_francais, note_anglais, certification_b2):
        if _safe_float(note_francais) >= 12 or _safe_float(note_anglais) >= 12:
            return 1.0
        return 0.0

    def _bonus_annee_diplome(self, annee_diplome):
        annee = str(annee_diplome or '').strip()
        if annee in {'2025', '2023'}:
            return 4.0
        if annee in {'2022', '2021', '2020'}:
            return 2.0
        return 0.0

    def _generic_score(self, donnees_candidat):
        score = 0.0

        score += donnees_candidat.get('moyenne_generale', 0) * float(self.coef_moyenne_generale)
        score += donnees_candidat.get('moyenne_specialite', 0) * float(self.coef_moyenne_specialite)
        score += donnees_candidat.get('note_pfe', 0) * float(self.coef_note_pfe)

        mention = donnees_candidat.get('mention', '').lower()
        if mention == 'tres_bien':
            score += float(self.bonus_mention_tres_bien)
        elif mention == 'bien':
            score += float(self.bonus_mention_bien)
        elif mention == 'assez_bien':
            score += float(self.bonus_mention_assez_bien)

        nb_redoublements = donnees_candidat.get('nb_redoublements', 0)
        score += nb_redoublements * float(self.malus_redoublement)

        nb_dettes = donnees_candidat.get('nb_dettes', 0)
        score += nb_dettes * float(self.malus_dette)

        for critere, config in self.criteres_specifiques.items():
            if critere in donnees_candidat:
                valeur = donnees_candidat[critere]
                coef = config.get('coefficient', 0)
                score += valeur * coef

        return round(score, 2)

    def _score_mpgl_mpds(self, donnees_candidat):
        moyenne_generale = _safe_float(donnees_candidat.get('moyenne_generale'))
        nb_redoublements = int(_safe_float(donnees_candidat.get('nb_redoublements')))
        session_reussite = donnees_candidat.get('session_reussite') or ''

        score = moyenne_generale
        score += self._bonus_redoublement(nb_redoublements)
        score += self._bonus_session_principale(session_reussite)
        return round(score, 2)

    def _score_mp3i(self, donnees_candidat):
        payload = donnees_candidat.get('payload', {}) if isinstance(donnees_candidat.get('payload'), dict) else {}

        moyenne_bac = _safe_float(
            payload.get('moyenneBacPrincipale')
            or payload.get('moyBac')
            or donnees_candidat.get('moyenne_specialite')
        )
        moy_l1 = _safe_float(payload.get('moyenne1Annee') or payload.get('moyL1'))
        moy_l2 = _safe_float(payload.get('moyenne2Annee') or payload.get('moyL2'))
        moy_l3 = _safe_float(payload.get('moyenne3Annee') or payload.get('moyL3'))

        score = (0.5 * moyenne_bac) + (1.0 * moy_l1) + (1.5 * moy_l2) + (2.0 * moy_l3)

        nb_redoublements = int(_safe_float(payload.get('nombreRedoublement') or donnees_candidat.get('nb_redoublements')))
        if nb_redoublements > 1:
            return 0.0
        score += -4.0 * nb_redoublements

        session1 = payload.get('session1Annee') or payload.get('session1')
        session2 = payload.get('session2Annee') or payload.get('session2')
        session3 = payload.get('session3Annee') or payload.get('session3')

        if _normalize_text(session1) in {'control', 'controle'}:
            score += -1.0
        if _normalize_text(session2) in {'control', 'controle'}:
            score += -1.5
        if _normalize_text(session3) in {'control', 'controle'}:
            score += -2.0

        return round(score, 2)

    def _score_mrgl(self, donnees_candidat):
        payload = donnees_candidat.get('payload', {}) if isinstance(donnees_candidat.get('payload'), dict) else {}
        nature_diplome = _normalize_text(payload.get('natureDiplome') or payload.get('nature_diplome'))
        moyenne_bac = _safe_float(payload.get('moyenneBacPrincipale') or payload.get('moyBac'))
        note_math_bac = _safe_float(payload.get('noteMathBac') or payload.get('note_math_bac'))
        note_francais = payload.get('noteFrancaisBac') or payload.get('note_francais_bac')
        note_anglais = payload.get('noteAnglaisBac') or payload.get('note_anglais_bac')
        certification_b2 = payload.get('certificationB2') or payload.get('certification_b2')
        annee_diplome = payload.get('anneeObtentionDiplome') or payload.get('annee_obtention_diplome')

        nb_redoublements = int(_safe_float(payload.get('nombreRedoublement') or donnees_candidat.get('nb_redoublements')))
        session1 = payload.get('session1Annee')
        session2 = payload.get('session2Annee')
        session3 = payload.get('session3Annee')

        score = 0.0

        if nature_diplome == 'maitrise':
            moy1 = _safe_float(payload.get('moyenne1Annee') or payload.get('moy1'))
            moy2 = _safe_float(payload.get('moyenne2Annee') or payload.get('moy2'))
            moy3 = _safe_float(payload.get('moyenne3Annee') or payload.get('moy3'))
            moy4 = _safe_float(payload.get('moyenne4Annee') or payload.get('moy4'))
            score += (1.5 * moy1) + (2.0 * moy2) + (2.0 * moy3) + moy4
        else:
            moy1 = _safe_float(payload.get('moyenne1Annee') or payload.get('moy1'))
            moy2 = _safe_float(payload.get('moyenne2Annee') or payload.get('moy2'))
            moy3 = _safe_float(payload.get('moyenne3Annee') or payload.get('moy3'))
            score += (1.5 * moy1) + (2.0 * moy2) + moy3

        score += self._bonus_redoublement_mrgl(nb_redoublements)
        score += self._bonus_session_principale(session1, session2, session3)
        score += ((moyenne_bac + note_math_bac - 20.0) / 2.0)
        score += self._bonus_langue(note_francais, note_anglais, certification_b2)

        if nature_diplome == 'licence':
            score += self._bonus_annee_diplome(annee_diplome)

        return round(score, 2)

    def _score_mrmi(self, donnees_candidat):
        payload = donnees_candidat.get('payload', {}) if isinstance(donnees_candidat.get('payload'), dict) else {}
        parcours = _normalize_text(payload.get('mrmiParcours') or payload.get('parcours'))

        if parcours == 'cas2' or _safe_float(payload.get('moyenneIng1')):
            moyenne_ing1 = _safe_float(payload.get('moyenneIng1') or payload.get('moyIng1'))
            session = payload.get('sessionReussiteIng1') or payload.get('session_reussite_ing1')
            nb_redoublements = int(
                _safe_float(payload.get('nombreRedoublementIng1') or payload.get('nombreRedoublement'))
            )
            score = moyenne_ing1
            if _normalize_text(session) in {'control', 'controle'}:
                score -= 1.0
            score += -2.0 * nb_redoublements
            return round(score, 2)

        moyenne_bac = _safe_float(payload.get('moyenneBacPrincipale') or payload.get('moyBac'))
        moy_l1 = _safe_float(payload.get('moyenne1Annee') or payload.get('moyL1'))
        moy_l2 = _safe_float(payload.get('moyenne2Annee') or payload.get('moyL2'))
        moy_l3 = _safe_float(payload.get('moyenne3Annee') or payload.get('moyL3'))
        nb_redoublements = int(_safe_float(payload.get('nombreRedoublement') or donnees_candidat.get('nb_redoublements')))
        session1 = payload.get('session1Annee')
        session2 = payload.get('session2Annee')
        session3 = payload.get('session3Annee')

        score = (0.5 * moyenne_bac) + (1.0 * moy_l1) + (1.5 * moy_l2) + (2.0 * moy_l3)
        score += -4.0 * nb_redoublements
        if _normalize_text(session1) in {'control', 'controle'}:
            score += -1.0
        if _normalize_text(session2) in {'control', 'controle'}:
            score += -1.5
        if _normalize_text(session3) in {'control', 'controle'}:
            score += -2.0

        return round(score, 2)

    def _score_ing(self, donnees_candidat):
        payload = donnees_candidat.get('payload', {}) if isinstance(donnees_candidat.get('payload'), dict) else {}
        parcours = _normalize_text(payload.get('ingParcours') or payload.get('parcours') or 'cas1')

        rang1 = _safe_float(
            payload.get('rang1')
            or payload.get('rang_1')
            or payload.get('classement1')
            or payload.get('rank1')
        )
        rang2 = _safe_float(
            payload.get('rang2')
            or payload.get('rang_2')
            or payload.get('classement2')
            or payload.get('rank2')
        )
        effectif1 = _safe_float(payload.get('effectif1') or payload.get('effectif_1') or payload.get('total1'))
        effectif2 = _safe_float(payload.get('effectif2') or payload.get('effectif_2') or payload.get('total2'))

        if rang1 > 0 and rang2 > 0:
            moyenne1 = _safe_float(payload.get('moyenne1Annee') or payload.get('moy1'))
            moyenne2 = _safe_float(payload.get('moyenne2Annee') or payload.get('moy2'))
            moyenne3 = _safe_float(payload.get('moyenne3Annee') or payload.get('moy3'))

            ratio1 = rang1 / max(effectif1 - 1.0, 1.0)
            ratio2 = rang2 / max(effectif2 - 1.0, 1.0)
            return round(0.5 * ((2 * moyenne1) + (2 * moyenne2) + moyenne3) + 50 * (1 - ratio1) + 50 * (1 - ratio2), 2)

        if parcours == 'cas1':
            moy1 = _safe_float(payload.get('moyenne1Annee') or payload.get('moy1'))
            moy2 = _safe_float(payload.get('moyenne2Annee') or payload.get('moy2'))
            session1 = payload.get('session1Annee')
            session2 = payload.get('session2Annee')

            score = _safe_float(payload.get('moyenne2Annee') or payload.get('moy2'))

            a_redouble = int(_safe_float(payload.get('nombreRedoublement') or donnees_candidat.get('nb_redoublements'))) > 0
            bonus1 = get_bonus(session1, a_redouble)
            bonus2 = get_bonus(session2, a_redouble)

            return round(score + bonus1 + bonus2, 2)

        moyenne1 = _safe_float(payload.get('m1'))
        moyenne2 = _safe_float(payload.get('m2'))
        moyenne3 = _safe_float(payload.get('m3'))
        return round(0.5 * ((2 * moyenne1) + (2 * moyenne2) + moyenne3), 2)
    
    def calculer_score(self, donnees_candidat):
        master_key = self._master_formula_key()

        if master_key in {'MPGL', 'MPDS'}:
            return self._score_mpgl_mpds(donnees_candidat)
        if master_key == 'MP3I':
            return self._score_mp3i(donnees_candidat)
        if master_key == 'MRGL':
            return self._score_mrgl(donnees_candidat)
        if master_key == 'MRMI':
            return self._score_mrmi(donnees_candidat)
        if master_key in {'ING_INFO_GL', 'ING_EM'}:
            return self._score_ing(donnees_candidat)

        return self._generic_score(donnees_candidat)


class DonneesAcademiques(models.Model):
    MENTION_CHOICES = [
        ('passable', 'Passable'),
        ('assez_bien', 'Assez Bien'),
        ('bien', 'Bien'),
        ('tres_bien', 'Très Bien'),
    ]
    
    candidature = models.OneToOneField(Candidature, on_delete=models.CASCADE, related_name='donnees_academiques')
    
    moyenne_generale = models.DecimalField(max_digits=5, decimal_places=2)
    moyenne_specialite = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    note_pfe = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    
    mention = models.CharField(max_length=20, choices=MENTION_CHOICES, blank=True)
    nb_redoublements = models.IntegerField(default=0)
    nb_dettes = models.IntegerField(default=0)
    
    notes_detaillees = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Données académiques - {self.candidature.numero}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Recompute candidature score whenever bac/licence data changes.
        self.calculer_et_sauvegarder_score()
    
    def calculer_et_sauvegarder_score(self):
        # Build payload from notes_detaillees
        payload = {}
        if isinstance(self.notes_detaillees, dict):
            payload = self.notes_detaillees.get('payload', {}) if isinstance(self.notes_detaillees.get('payload'), dict) else self.notes_detaillees

        # Prefer using the new dynamic scoring engine on Candidature if available
        try:
            if hasattr(self.candidature, 'calculer_score_final'):
                result = self.candidature.calculer_score_final(payload=payload)
                # result expected to be a dict {'score': float, 'details': {...}}
                score = result.get('score') if isinstance(result, dict) else None
            else:
                score = None
        except Exception:
            score = None

        # Fallbacks when engine didn't produce a score
        if score is None:
            # Old behaviour: try FormuleScore (legacy)
            formule = getattr(self.candidature.master, 'formule_score', None)
            if formule:
                donnees = {
                    'moyenne_generale': float(self.moyenne_generale),
                    'moyenne_specialite': float(self.moyenne_specialite or 0),
                    'note_pfe': float(self.note_pfe or 0),
                    'mention': self.mention,
                    'nb_redoublements': self.nb_redoublements,
                    'nb_dettes': self.nb_dettes,
                    'notes_detaillees': self.notes_detaillees if isinstance(self.notes_detaillees, dict) else {},
                    'payload': payload,
                }
                try:
                    score = formule.calculer_score(donnees)
                except Exception:
                    score = None

        if score is None:
            # Last resort: use master coefficients
            notes = self.notes_detaillees if isinstance(self.notes_detaillees, dict) else {}
            payload = notes.get('payload', {}) if isinstance(notes.get('payload'), dict) else {}
            moyenne_bac = _safe_float(notes.get('moyenne_bac', payload.get('moyenne_bac')), default=None)
            moyenne_licence = _safe_float(notes.get('moyenne_licence', payload.get('moyenne_licence')), default=None)

            if moyenne_bac is not None or moyenne_licence is not None:
                if moyenne_bac is None:
                    moyenne_bac = moyenne_licence
                if moyenne_licence is None:
                    moyenne_licence = moyenne_bac
                score = round(
                    (float(moyenne_bac) * float(self.candidature.master.coeff_bac or 0))
                    + (float(moyenne_licence) * float(self.candidature.master.coeff_licence or 0))
                    + (float(self.note_pfe or 0) * float(self.candidature.master.coeff_examen or 0))
                    + float(self.candidature.master.bonus_mention or 0),
                    2,
                )
            else:
                score = round(
                    (float(self.moyenne_specialite) * float(self.candidature.master.coeff_bac or 0))
                    + (float(self.moyenne_generale) * float(self.candidature.master.coeff_licence or 0))
                    + (float(self.note_pfe) * float(self.candidature.master.coeff_examen or 0))
                    + float(self.candidature.master.bonus_mention or 0),
                    2,
                )

        if self.candidature.score != score:
            try:
                self.candidature.score = score
                self.candidature.save(update_fields=['score', 'updated_at'])
            except Exception:
                pass

        return score


class CritereEvaluation(models.Model):
    """Définit un critère réutilisable qui mappe à un champ attendu dans le payload du formulaire."""
    code = models.CharField(max_length=100, unique=True)
    nom = models.CharField(max_length=200, help_text="Nom du champ tel qu'il apparaît dans le payload (ex: 'moyenne_bac')")
    label = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.code} ({self.nom})"


class ParcoursAdmission(models.Model):
    """Un parcours d'admission pour un master. Contient la logique dynamique de calcul de score.

    La méthode `calculer_score` accepte soit une instance `Candidature` soit un dict (payload) et renvoie
    un score numérique. Les coefficients sont fournis par les objets `ValeurCritere` associés.
    Si aucun critère n'est défini, la méthode applique des comportements de secours raisonnables
    (utiliser les coefficients du Master ou sommer les champs numériques avec coef=1.0).
    """
    STATUS_CHOICES = [
        ('brouillon', 'Brouillon'),
        ('ouvert', 'Ouvert'),
        ('ferme', 'Fermé'),
    ]

    TYPE_CHOICES = [
        ('pro', 'Professionnel'),
        ('recherche', 'Recherche'),
        ('ingenieur', 'Ingénieur'),
    ]

    master = models.ForeignKey(Master, on_delete=models.CASCADE, related_name='parcours_admissions')
    nom = models.CharField(max_length=200)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='pro')
    specialite = models.CharField(max_length=200, blank=True)
    capacite = models.IntegerField(default=30)
    date_limite = models.DateField(null=True, blank=True)
    
    statut = models.CharField(max_length=20, choices=STATUS_CHOICES, default='brouillon')
    actif = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.master.nom} - {self.nom} ({self.get_statut_display()})"

    def calculer_score(self, candidature_or_payload):
        """Calcule le score avec les formules reelles selon le type de parcours.

        Type `pro`:
            Score = (M1 + M2 + M3)/3 + Bonus_NR + Bonus_SP
            Bonus_NR: 5 si 0 redoublement, 3 si 1 redoublement, sinon 0
            Bonus_SP: 3 si 0 rattrapage, 2 si 1 rattrapage, sinon 0

        Type `recherche`:
            Score = 1.5*M1 + 2*M2 + M3 + BNR + BSP
                    + ((M_Bac + Note_Math_Bac - 20)/2)
                    + Bonus_Langue + Bonus_Diplome

        Type `ingenieur`:
            - Interne: Score = M2 + B1 + B2
              B1/B2 via get_bonus(session, a_redouble)
            - Externe: Score = 0.5*(2*M1 + 2*M2 + M3) + 50*(1-R1) + 50*(1-R2)
        """
        payload = {}
        if isinstance(candidature_or_payload, dict):
            payload = candidature_or_payload
        else:
            try:
                if hasattr(candidature_or_payload, 'donnees_academiques') and candidature_or_payload.donnees_academiques:
                    notes = candidature_or_payload.donnees_academiques.notes_detaillees or {}
                    payload = notes.get('payload') if isinstance(notes.get('payload'), dict) else notes
                else:
                    payload = {}
            except Exception:
                payload = {}

        academic = payload.get('academic_data') if isinstance(payload.get('academic_data'), dict) else payload
        common = academic.get('common', {}) if isinstance(academic, dict) and isinstance(academic.get('common'), dict) else {}

        def pick_float(*values, default=0.0):
            for value in values:
                parsed = _safe_float(value, default=None)
                if parsed is not None:
                    return float(parsed)
            if default is None:
                return None
            return float(default)

        def pick_int(*values, default=0):
            for value in values:
                parsed = _safe_float(value, default=None)
                if parsed is not None:
                    return int(parsed)
            return int(default)

        def pick_session(*values):
            for value in values:
                if value not in [None, '']:
                    return str(value)
            return ''

        def bonus_redoublement(nb_redoublements):
            if nb_redoublements <= 0:
                return 5.0
            if nb_redoublements == 1:
                return 3.0
            return 0.0

        def bonus_session(nb_rattrapages):
            if nb_rattrapages <= 0:
                return 3.0
            if nb_rattrapages == 1:
                return 2.0
            return 0.0

        def count_rattrapages(*sessions):
            total = 0
            for session in sessions:
                normalized = _normalize_text(session)
                if normalized in {'rattrapage', 'controle', 'control', 'sessioncontrole', 'sessionrattrapage'}:
                    total += 1
            return total

        try:
            if self.type == 'pro':
                gl_ds = academic.get('glDs', {}) if isinstance(academic, dict) and isinstance(academic.get('glDs'), dict) else {}
                m1 = pick_float(gl_ds.get('moy1'), payload.get('moy1'), payload.get('m1'), payload.get('moyenne1'))
                m2 = pick_float(gl_ds.get('moy2'), payload.get('moy2'), payload.get('m2'), payload.get('moyenne2'))
                m3 = pick_float(gl_ds.get('moy3'), payload.get('moy3'), payload.get('m3'), payload.get('moyenne3'))

                nb_redoublements = pick_int(
                    common.get('redoublements'),
                    payload.get('nb_redoublements'),
                    payload.get('nombreRedoublement'),
                    default=0,
                )

                nb_rattrapages = pick_int(
                    common.get('rattrapages'),
                    payload.get('nb_rattrapages'),
                    payload.get('nombreRattrapage'),
                    default=count_rattrapages(
                        payload.get('session1Annee'),
                        payload.get('session2Annee'),
                        payload.get('session3Annee'),
                        common.get('session'),
                    ),
                )

                score = ((m1 + m2 + m3) / 3.0) + bonus_redoublement(nb_redoublements) + bonus_session(nb_rattrapages)
                return round(score, 2)

            if self.type == 'recherche':
                mrgl_parcours = _normalize_text(academic.get('mrglParcours') if isinstance(academic, dict) else payload.get('mrglParcours'))
                mrgl_licence = academic.get('mrglLicence', {}) if isinstance(academic, dict) and isinstance(academic.get('mrglLicence'), dict) else {}
                mrgl_maitrise = academic.get('mrglMaitrise', {}) if isinstance(academic, dict) and isinstance(academic.get('mrglMaitrise'), dict) else {}
                base = mrgl_maitrise if mrgl_parcours == 'maitrise' and mrgl_maitrise else mrgl_licence

                m1 = pick_float(base.get('moy1'), payload.get('moy1'), payload.get('m1'), payload.get('moyenne1'))
                m2 = pick_float(base.get('moy2'), payload.get('moy2'), payload.get('m2'), payload.get('moyenne2'))
                m3 = pick_float(base.get('moy3'), payload.get('moy3'), payload.get('m3'), payload.get('moyenne3'))
                moyenne_bac = pick_float(base.get('moyBac'), payload.get('moyenneBacPrincipale'), payload.get('moyenne_bac'))
                note_math_bac = pick_float(base.get('note_math_bac'), payload.get('noteMathBac'), payload.get('note_math_bac'))

                nb_redoublements = pick_int(
                    common.get('redoublements'),
                    base.get('nombreRedoublement'),
                    payload.get('nb_redoublements'),
                    default=0,
                )
                nb_rattrapages = pick_int(
                    common.get('rattrapages'),
                    payload.get('nb_rattrapages'),
                    default=count_rattrapages(
                        base.get('session1Annee'),
                        base.get('session2Annee'),
                        base.get('session3Annee'),
                        common.get('session'),
                    ),
                )

                note_fr = pick_float(base.get('note_francais_bac'), payload.get('noteFrancaisBac'), payload.get('note_francais_bac'))
                note_ang = pick_float(base.get('note_anglais_bac'), payload.get('noteAnglaisBac'), payload.get('note_anglais_bac'))
                bonus_langue = 1.0 if (note_fr >= 12.0 or note_ang >= 12.0) else 0.0

                annee_diplome = pick_int(
                    base.get('annee_obtention_diplome'),
                    payload.get('anneeObtentionDiplome'),
                    payload.get('annee_diplome'),
                    default=0,
                )
                bonus_diplome = 4.0 if annee_diplome in {2025, 2023} else (2.0 if annee_diplome in {2022, 2021, 2020} else 0.0)

                score = (
                    (1.5 * m1)
                    + (2.0 * m2)
                    + m3
                    + bonus_redoublement(nb_redoublements)
                    + bonus_session(nb_rattrapages)
                    + ((moyenne_bac + note_math_bac - 20.0) / 2.0)
                    + bonus_langue
                    + bonus_diplome
                )
                return round(score, 2)

            if self.type == 'ingenieur':
                ing_type = _normalize_text(payload.get('ing_type') or payload.get('type') or payload.get('candidate_type'))
                is_interne = bool(payload.get('interne')) or ing_type == 'interne'

                ing_cas1 = academic.get('ingCas1', {}) if isinstance(academic, dict) and isinstance(academic.get('ingCas1'), dict) else {}
                ing_cas2 = academic.get('ingCas2', {}) if isinstance(academic, dict) and isinstance(academic.get('ingCas2'), dict) else {}

                if is_interne:
                    m2 = pick_float(ing_cas1.get('moy2'), payload.get('moy2'), payload.get('m2'), payload.get('moyenne2Annee'))
                    a_redouble = pick_int(
                        ing_cas1.get('nombreRedoublement'),
                        common.get('redoublements'),
                        payload.get('nb_redoublements'),
                        default=0,
                    ) > 0
                    session1 = pick_session(ing_cas1.get('session1Annee'), payload.get('session1Annee'), payload.get('session1'))
                    session2 = pick_session(ing_cas1.get('session2Annee'), payload.get('session2Annee'), payload.get('session2'))
                    b1 = get_bonus(session1, a_redouble)
                    b2 = get_bonus(session2, a_redouble)
                    return round(m2 + b1 + b2, 2)

                m1 = pick_float(ing_cas2.get('m1'), payload.get('m1'), payload.get('moyenne1Annee'))
                m2 = pick_float(ing_cas2.get('m2'), payload.get('m2'), payload.get('moyenne2Annee'))
                m3 = pick_float(ing_cas2.get('m3'), payload.get('m3'), payload.get('moyenne3Annee'))

                rang1 = pick_float(payload.get('rang1'), payload.get('r1'), payload.get('rank1'), default=None)
                rang2 = pick_float(payload.get('rang2'), payload.get('r2'), payload.get('rank2'), default=None)
                effectif1 = pick_float(payload.get('effectif1'), payload.get('total1'), payload.get('nombre_etudiants'), default=None)
                effectif2 = pick_float(payload.get('effectif2'), payload.get('total2'), payload.get('nombre_etudiants'), default=None)

                r1 = pick_float(payload.get('R1'), default=None)
                r2 = pick_float(payload.get('R2'), default=None)

                if r1 is None and rang1 is not None and effectif1 not in [None, 0, 1]:
                    r1 = float(rang1) / max(float(effectif1) - 1.0, 1.0)
                if r2 is None and rang2 is not None and effectif2 not in [None, 0, 1]:
                    r2 = float(rang2) / max(float(effectif2) - 1.0, 1.0)

                if r1 is None:
                    r1 = 0.0
                if r2 is None:
                    r2 = 0.0

                score = (0.5 * ((2.0 * m1) + (2.0 * m2) + m3)) + (50.0 * (1.0 - r1)) + (50.0 * (1.0 - r2))
                return round(score, 2)
        except Exception:
            pass

        # Fallback historique: somme des ValeurCritere configurees
        total = 0.0
        valeurs = list(self.valeurs.select_related('critere').all())
        if valeurs:
            for v in valeurs:
                field_name = (v.critere.nom or '').strip()
                raw = None
                if field_name:
                    raw = payload.get(field_name)
                if raw is None:
                    for key in payload.keys():
                        if key and key.lower() == field_name.lower():
                            raw = payload.get(key)
                            break

                val = _safe_float(raw, default=0.0)
                coef = float(v.coefficient or 1.0)
                total += float(val) * coef
            return round(total, 2)

        return 0.0


class ValeurCritere(models.Model):
    parcours = models.ForeignKey(ParcoursAdmission, on_delete=models.CASCADE, related_name='valeurs')
    critere = models.ForeignKey(CritereEvaluation, on_delete=models.CASCADE)
    coefficient = models.DecimalField(max_digits=6, decimal_places=3, default=1.0)

    class Meta:
        unique_together = ['parcours', 'critere']

    def __str__(self):
        return f"{self.parcours} - {self.critere.code}: {self.coefficient}"


class ListeAdmission(models.Model):
    TYPE_CHOICES = [
        ('principale', 'Liste Principale'),
        ('attente', 'Liste d\'Attente'),
    ]
    
    ITERATION_CHOICES = [
        (1, 'Première Liste'),
        (2, 'Deuxième Liste'),
        (3, 'Troisième Liste'),
        (4, 'Quatrième Liste'),
    ]
    
    master = models.ForeignKey(Master, on_delete=models.CASCADE, related_name='listes')
    type_liste = models.CharField(max_length=20, choices=TYPE_CHOICES)
    iteration = models.IntegerField(choices=ITERATION_CHOICES, default=1)
    
    annee_universitaire = models.CharField(max_length=20)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_publication = models.DateTimeField(null=True, blank=True)
    
    publiee = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    
    capacite_accueil = models.IntegerField()
    places_restantes = models.IntegerField()
    
    class Meta:
        unique_together = ['master', 'type_liste', 'iteration', 'annee_universitaire']
        ordering = ['-date_creation']
    
    def __str__(self):
        return f"{self.get_type_liste_display()} - {self.master.nom} - Itération {self.iteration}"


class CandidatListe(models.Model):
    liste = models.ForeignKey(ListeAdmission, on_delete=models.CASCADE, related_name='candidats')
    candidature = models.ForeignKey(Candidature, on_delete=models.CASCADE)
    
    position = models.IntegerField()
    score = models.DecimalField(max_digits=5, decimal_places=2)
    
    a_paye = models.BooleanField(default=False)
    date_paiement = models.DateTimeField(null=True, blank=True)
    
    a_confirme_inscription = models.BooleanField(default=False)
    date_confirmation = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        unique_together = ['liste', 'candidature']
        ordering = ['position']
    
    def __str__(self):
        return f"{self.position}. {self.candidature.candidat.get_full_name()} - {self.score}"


class Paiement(models.Model):
    STATUT_CHOICES = [
        ('en_attente', 'En attente'),
        ('paye', 'Payé'),
        ('echoue', 'Échoué'),
        ('rembourse', 'Remboursé'),
    ]
    
    candidature = models.OneToOneField(Candidature, on_delete=models.CASCADE, related_name='paiement')
    
    montant = models.DecimalField(max_digits=10, decimal_places=3)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='en_attente')
    
    reference_paiement = models.CharField(max_length=100, unique=True, null=True, blank=True)
    date_paiement = models.DateTimeField(null=True, blank=True)
    
    fichier_import = models.CharField(max_length=255, blank=True)
    date_import = models.DateTimeField(null=True, blank=True)
    
    methode_paiement = models.CharField(max_length=50, blank=True)
    numero_transaction = models.CharField(max_length=100, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Paiement {self.candidature.numero} - {self.statut}"
    
    def marquer_comme_paye(self, reference, date_paiement=None):
        self.statut = 'paye'
        self.reference_paiement = reference
        self.date_paiement = date_paiement or timezone.now()
        self.save()
        
        self.candidature.statut = 'inscrit'
        self.candidature.save()


class Reclamation(models.Model):
    STATUT_CHOICES = [
        ('en_cours', 'En cours'),
        ('en_attente', 'En attente'),
        ('traitee', 'Traitée'),
    ]
    
    OBJET_CHOICES = [
        ('score', 'Score incorrect'),
        ('statut', 'Statut non mis à jour'),
        ('dossier', 'Problème de dossier'),
        ('paiement', 'Problème de paiement'),
        ('autre', 'Autre'),
    ]
    
    identifiant = models.CharField(max_length=50, unique=True, blank=True)
    candidature = models.ForeignKey(Candidature, on_delete=models.CASCADE, related_name='reclamations')
    
    objet = models.CharField(max_length=50, choices=OBJET_CHOICES)
    master_concerne = models.ForeignKey(Master, on_delete=models.CASCADE, related_name='reclamations')
    
    motif = models.TextField()
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='en_cours')
    
    reponse = models.TextField(blank=True)
    traitee_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reclamations_traitees')
    date_traitement = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def save(self, *args, **kwargs):
        if not self.identifiant:
            annee = timezone.now().year
            count = Reclamation.objects.filter(created_at__year=annee).count() + 1
            self.identifiant = f"RECL-{annee}-{count:05d}"
        super().save(*args, **kwargs)
    
    def __str__(self):
        return self.identifiant


class Concours(models.Model):
    TYPE_CHOICES = [
        ('master', 'Master'),
        ('ingenieur', 'Cycle Ingénieur'),
    ]
    
    nom = models.CharField(max_length=200)
    type_concours = models.CharField(max_length=20, choices=TYPE_CHOICES)
    description = models.TextField()
    
    date_ouverture = models.DateField()
    date_cloture = models.DateField()
    
    places_disponibles = models.IntegerField()
    actif = models.BooleanField(default=True)
    document_officiel_pdf = models.FileField(upload_to='offres/', null=True, blank=True)
    
    conditions_admission = models.JSONField(default=dict)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['actif', 'date_cloture']),
        ]
    
    def __str__(self):
        return f"{self.nom} ({self.get_type_concours_display()})"


class InscriptionEnLigne(models.Model):
    STATUT_CHOICES = [
        ('en_attente', 'En attente de paiement'),
        ('paiement_soumis', 'Paiement soumis'),
        ('valide', 'Validé'),
        ('refuse', 'Refusé'),
    ]
    
    candidature = models.OneToOneField(Candidature, on_delete=models.CASCADE, related_name='inscription_enligne')
    
    fichier_paiement = models.FileField(upload_to='paiements/%Y/%m/', null=True, blank=True)
    
    reference_paiement = models.CharField(max_length=100, blank=True)
    montant_paye = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    
    statut = models.CharField(max_length=30, choices=STATUT_CHOICES, default='en_attente')
    
    valide_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='inscriptions_validees')
    date_validation = models.DateTimeField(null=True, blank=True)
    commentaire_validation = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Inscription {self.candidature.numero} - {self.statut}"


class InscriptionRapprochementAudit(models.Model):
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inscription_rapprochements',
    )
    master = models.ForeignKey(
        Master,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inscription_rapprochements',
    )
    source_filename = models.CharField(max_length=255, blank=True)
    total_rows = models.PositiveIntegerField(default=0)
    valide_rows = models.PositiveIntegerField(default=0)
    incoherent_rows = models.PositiveIntegerField(default=0)
    absent_rows = models.PositiveIntegerField(default=0)
    payload_rows = models.JSONField(default=list, blank=True)
    result_rows = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"Rapprochement inscriptions #{self.id} ({self.total_rows} lignes)"


class HistoriqueActionCommission(models.Model):
    responsable = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='commission_action_history',
    )
    master = models.ForeignKey(
        Master,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='commission_action_history',
    )
    action = models.CharField(max_length=120)
    specialite = models.CharField(max_length=200)
    session = models.CharField(max_length=20, default='')
    nb_candidats = models.PositiveIntegerField(default=0)
    date_action = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_action']
        verbose_name = 'Historique Action Commission'
        verbose_name_plural = 'Historique des Actions Commission'

    def __str__(self):
        return f"{self.action} - {self.specialite} ({self.nb_candidats})"


class HistoriqueCandidature(models.Model):
    candidat_nom = models.CharField(max_length=200)
    candidat_email = models.EmailField()
    
    numero = models.CharField(max_length=50)
    master_nom = models.CharField(max_length=200)
    annee_universitaire = models.CharField(max_length=20)
    
    statut_final = models.CharField(max_length=30)
    score = models.DecimalField(max_digits=5, decimal_places=2, null=True)
    classement = models.IntegerField(null=True)
    
    date_soumission = models.DateTimeField()
    date_decision = models.DateTimeField(null=True)
    
    a_ete_admis = models.BooleanField(default=False)
    a_confirme_inscription = models.BooleanField(default=False)
    
    archive_le = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-annee_universitaire', '-date_soumission']
        verbose_name = 'Historique Candidature'
        verbose_name_plural = 'Historique des Candidatures'
    
    def __str__(self):
        return f"{self.numero} - {self.candidat_nom} ({self.annee_universitaire})"


def archiver_candidatures_annee_precedente():
    """
    Tâche à exécuter chaque début d'année universitaire
    Archive les candidatures de l'année N-1
    """
    from django.utils import timezone
    from datetime import timedelta
    
    # Année universitaire précédente
    annee_actuelle = timezone.now().year
    annee_precedente = f"{annee_actuelle - 1}/{annee_actuelle}"
    
    # Candidatures à archiver (statut final atteint)
    candidatures = Candidature.objects.filter(
        master__configuration__annee_universitaire=annee_precedente,
        statut__in=['inscrit', 'rejete', 'annule', 'en_attente']
    )
    
    count_archive = 0
    
    for candidature in candidatures:
        # Créer entrée historique
        HistoriqueCandidature.objects.create(
            candidat_nom=candidature.candidat.get_full_name(),
            candidat_email=candidature.candidat.email,
            numero=candidature.numero,
            master_nom=candidature.master.nom,
            annee_universitaire=annee_precedente,
            statut_final=candidature.statut,
            score=candidature.score,
            classement=candidature.classement,
            date_soumission=candidature.date_soumission,
            date_decision=candidature.date_changement_statut,
            a_ete_admis=(candidature.statut == 'inscrit'),
            a_confirme_inscription=(candidature.statut == 'inscrit')
        )
        
        count_archive += 1
    
    return count_archive


class DocumentType(models.Model):
    """Types de pièces du dossier de candidature (liste officielle ISIMM).

    6 pièces officielles. La pièce ``attestation_retrait`` est optionnelle
    (le cas échéant), les 5 autres sont obligatoires.
    """
    TYPE_CHOICES = [
        ('formulaire_candidature', 'Les formulaires de candidature aux masters'),
        ('cin', "Copie de la Carte d'Identité Nationale (CIN)"),
        ('diplomes_bac', "Diplômes obtenus depuis l'année du baccalauréat"),
        ('releves_bac', "Relevés de notes depuis l'année du baccalauréat"),
        ('attestation_retrait', "Attestation(s) de retrait d'inscription et/ou de réorientation (le cas échéant)"),
        ('cv', 'Curriculum Vitae (CV)'),
    ]

    # Pièces optionnelles (toutes les autres sont obligatoires par défaut)
    TYPES_OPTIONNELS = ['attestation_retrait']
    
    master = models.ForeignKey(Master, on_delete=models.CASCADE, related_name='types_documents')
    type_document = models.CharField(max_length=50, choices=TYPE_CHOICES)
    
    obligatoire = models.BooleanField(default=True)
    description = models.TextField(blank=True)
    taille_max_mb = models.IntegerField(default=5)
    formats_acceptes = models.JSONField(default=list, help_text="Ex: ['pdf', 'jpg', 'png']")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['master', 'type_document']
        ordering = ['type_document']
    
    def __str__(self):
        return f"{self.master.nom} - {self.get_type_document_display()}"


class Document(models.Model):
    """Documents soumis dans le dossier de candidature"""
    STATUT_CHOICES = [
        ('en_attente', 'En attente de traitement'),
        ('en_cours_ocr', 'OCR en cours'),
        ('valide', 'Valid�'),
        ('rejete', 'Rejet�'),
        ('erreur_ocr', 'Erreur lors de l\'OCR'),
    ]
    
    candidature = models.ForeignKey(Candidature, on_delete=models.CASCADE, related_name='documents')
    type_document = models.ForeignKey(DocumentType, on_delete=models.PROTECT)
    
    fichier = models.FileField(upload_to='candidatures/%Y/%m/%d/')
    nom_fichier_original = models.CharField(max_length=255)
    taille_bytes = models.BigIntegerField()
    format_fichier = models.CharField(max_length=10)
    
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='en_attente')
    description = models.TextField(blank=True)
    
    donnees_extraites = models.JSONField(default=dict, blank=True)
    score_ocr = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    erreur_ocr = models.TextField(blank=True)
    
    date_upload = models.DateTimeField(auto_now_add=True)
    date_traitement_ocr = models.DateTimeField(null=True, blank=True)
    celery_task_id = models.CharField(max_length=255, blank=True)
    
    checksum_sha256 = models.CharField(max_length=64, unique=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-date_upload']
        indexes = [
            models.Index(fields=['candidature', 'statut']),
            models.Index(fields=['type_document', 'statut']),
        ]
    
    def __str__(self):
        type_code = (self.type_document.type_document or '').upper()
        return f"{self.candidature.numero} - {self.type_document.get_type_document_display()} ({type_code})"


class ValidationDocument(models.Model):
    """Audit des validations de documents"""
    STATUS_CHOICES = [
        ('accepte', 'Accept�'),
        ('rejete', 'Rejet�'),
        ('en_attente', 'En attente de r�vision'),
    ]
    
    document = models.OneToOneField(Document, on_delete=models.CASCADE, related_name='validation')
    
    statut = models.CharField(max_length=20, choices=STATUS_CHOICES, default='en_attente')
    commentaires = models.TextField(blank=True)
    
    valide_par = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='validations_documents')
    date_validation = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.document} - {self.get_statut_display()}"


class Dossier(models.Model):
    """Dossier de candidat pour un master"""
    STATUT_CHOICES = [
        ('en_cours', 'En cours'),
        ('soumis', 'Soumis'),
        ('en_verification', 'En v�rification'),
        ('incomplet', 'Incomplet'),
        ('complet', 'Complet'),
        ('rejete', 'Rejet�'),
    ]
    
    candidature = models.OneToOneField(Candidature, on_delete=models.CASCADE, related_name='dossier')
    
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='en_cours')
    
    date_depot = models.DateTimeField(null=True, blank=True)
    date_limite_depot = models.DateTimeField(null=True, blank=True)
    date_derniere_modification = models.DateTimeField(auto_now=True)
    
    nb_documents_attendus = models.IntegerField()
    nb_documents_soumis = models.IntegerField(default=0)
    
    score_completude = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    feedback = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Dossier"
        verbose_name_plural = "Dossiers"
        ordering = ['-date_depot']
    
    def __str__(self):
        return f"Dossier {self.candidature.numero}"
    
    def calculer_completude(self):
        """Calcule le pourcentage de compl�tude du dossier"""
        if self.nb_documents_attendus == 0:
            return 100
            
        docs_valides = self.candidature.documents.filter(
            statut='valide'
        ).count()
        
        self.score_completude = (docs_valides / self.nb_documents_attendus) * 100
        self.nb_documents_soumis = self.candidature.documents.exclude(
            statut__in=['en_attente', 'erreur_ocr']
        ).count()
        
        if self.score_completude == 100:
            self.statut = 'complet'
        elif self.score_completude > 0:
            self.statut = 'incomplet'
        
        self.save()
        return self.score_completude

class SpecialiteParcoursMapping(models.Model):
    """
    Mappe les spécialités (licences) requises pour chaque parcours (Master ou Cycle Ingénieur).
    
    Exemples:
    - Master DS: Lic Mathématiques Appliquées, Lic Sciences de l'Informatique, etc.
    - Master GL: Lic Informatique, Lic Informatique de Gestion, etc.
    - Master 3I: Lic Électronique, Lic MIM, etc.
    """
    # Référence au Master ou à un type de formation (pour Cycle Ingénieur)
    master = models.ForeignKey(Master, on_delete=models.CASCADE, related_name='specialites_requises', null=True, blank=True)
    
    # Type de formation: 'master' ou 'ingenieur'
    type_formation = models.CharField(max_length=20, choices=[
        ('master', 'Master'),
        ('ingenieur', 'Cycle Ingénieur'),
    ], default='master')
    
    # Code du parcours (ex: MPDS, MPGL, MP3I, MRGL, MRMI, ING_APPLI)
    code_parcours = models.CharField(max_length=50)
    nom_parcours = models.CharField(max_length=200)  # ex: "Master Professionnel Data Science"
    
    # Liste des spécialités requises (en JSON pour flexibilité)
    # Format: [
    #   {"nom": "Licence en Mathématiques Appliquées", "abreviation": "LMA"},
    #   {"nom": "Licence en Sciences de l'Informatique", "abreviation": "LSI"},
    # ]
    specialites = models.JSONField(default=list, blank=True)
    
    # Numéro d'ordre d'affichage
    ordre = models.IntegerField(default=0)
    
    actif = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['ordre', 'nom_parcours']
        unique_together = ['code_parcours', 'type_formation']
        indexes = [
            models.Index(fields=['code_parcours']),
            models.Index(fields=['type_formation']),
        ]
    
    def __str__(self):
        return f"{self.nom_parcours} ({self.code_parcours})"


class StatusHistory(models.Model):
    """
    Historique des changements de statut pour chaque candidature.
    Permet de tracker le workflow complet d'une candidature.
    """
    STATUT_TYPES = [
        ('soumis', 'Soumis'),
        ('annule', 'Annulé'),
        ('sous_examen', 'Sous examen'),
        ('rejete', 'Rejeté/Invalide'),
        ('preselectionne', 'Présélectionné'),
        ('en_attente_dossier', 'En attente de dossier numérique'),
        ('dossier_non_depose', 'Dossier non déposé'),
        ('dossier_depose', 'Dossier déposé'),
        ('en_attente', 'En attente'),
        ('selectionne', 'Sélectionné/Admis'),
        ('inscrit', 'Inscrit'),
    ]
    
    candidature = models.ForeignKey(
        Candidature,
        on_delete=models.CASCADE,
        related_name='status_history'
    )
    ancien_statut = models.CharField(max_length=30, choices=STATUT_TYPES, null=True, blank=True)
    nouveau_statut = models.CharField(max_length=30, choices=STATUT_TYPES)
    
    raison = models.TextField(blank=True, help_text="Raison du changement de statut")
    changed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='status_changes_made'
    )
    
    date_changement = models.DateTimeField(auto_now_add=True)
    notification_envoyee = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-date_changement']
        indexes = [
            models.Index(fields=['candidature', '-date_changement']),
            models.Index(fields=['nouveau_statut']),
        ]
    
    def __str__(self):
        return f"{self.candidature.numero}: {self.ancien_statut} → {self.nouveau_statut}"


class NotificationQueue(models.Model):
    """
    Queue des notifications à envoyer (in-app et email).
    Permet de gérer les envois asynchrones sans bloquer les endpoints.
    """
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('sent', 'Envoyée'),
        ('failed', 'Échouée'),
    ]
    
    notification = models.OneToOneField(
        Notification,
        on_delete=models.CASCADE,
        related_name='queue_entry'
    )
    email = models.EmailField()
    subject = models.CharField(max_length=255)
    body_text = models.TextField()
    body_html = models.TextField(null=True, blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    retry_count = models.IntegerField(default=0)
    
    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
        ]
    
    def __str__(self):
        return f"Notification {self.notification_id} - {self.status}"
    
    def get_specialites_list(self):
        """Retourne la liste des spécialités sous forme de strings."""
        return [s['nom'] for s in self.specialites if isinstance(s, dict) and 'nom' in s]
