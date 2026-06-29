"""Initialisation des Critères d'Évaluation standards."""

from candidature_app.models import CritereEvaluation


DEFAULT_CRITERES = [
    # Critères Master Professionnel
    ('moyenne_licence', 'moyenne_licence', 'Moyenne Licence/Master M1-M2-M3', 'Moyenne générale du cursus antérieur'),
    ('moyenne_bac', 'moyenne_bac', 'Moyenne BAC/Diplôme', 'Note moyenne du BAC ou diplôme équivalent'),
    ('redoublements', 'nb_redoublements', 'Redoublements', 'Nombre de redoublements'),
    
    # Critères Master Recherche (additionnels)
    ('note_math_bac', 'noteMathBac', 'Note Mathématiques BAC', 'Note de mathématiques au BAC'),
    ('bonus_langue', 'bonus_langue', 'Bonus Langue', 'Certification de langue (B2+)'),
    ('bonus_diplome', 'bonus_diplome', 'Bonus Année Diplôme', 'Bonus selon l\'année du diplôme'),
    
    # Critères Cycle Ingénieur
    ('moyenne_m1', 'moy1', 'Moyenne M1', 'Moyenne de l\'année M1'),
    ('moyenne_m2', 'moy2', 'Moyenne M2', 'Moyenne de l\'année M2'),
    ('moyenne_m3', 'moy3', 'Moyenne M3', 'Moyenne de l\'année M3'),
    ('rang1', 'rang1', 'Rang 1ère année', 'Rang de classement 1ère année'),
    ('rang2', 'rang2', 'Rang 2ème année', 'Rang de classement 2ème année'),
]


def initialiser_criteres():
    """Crée les CritereEvaluation par défaut s'ils n'existent pas."""
    for code, nom, label, description in DEFAULT_CRITERES:
        CritereEvaluation.objects.get_or_create(
            code=code,
            defaults={
                'nom': nom,
                'label': label,
                'description': description,
            }
        )
