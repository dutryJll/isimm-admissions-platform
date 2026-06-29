

from django.db import migrations


# ──────────────────────────────────────────────────────────────────────────────
# DONNÉES SOURCES
# ──────────────────────────────────────────────────────────────────────────────

_MPGL_SPECIALITES = [
    {
        "nom": "Licence en Sciences de l'Informatique génie logiciel",
        "abreviation": "LSI-GL",
    },
    {
        "nom": "Informatique de Gestion (uniquement)",
        "abreviation": "IG",
    },
    {
        "nom": "Génie Logiciel et Systèmes d'Information",
        "abreviation": "GLSI",
    },
    {
        "nom": "Génie Logiciel",
        "abreviation": "GL",
    },
    {
        "nom": "Licence Appliquée en Développement des Systèmes Informatiques",
        "abreviation": "LA-DSI",
    },
    {
        "nom": "Big Data et Analyse de Données",
        "abreviation": "BDAD",
    },
    {
        "nom": "Business Computing",
        "abreviation": "BC",
    },
]

PARCOURS_DATA = [
    # ── Masters Professionnels ─────────────────────────────────────────────
    {
        "code_parcours": "MPGL",
        "nom_parcours": "Master Professionnel Génie Logiciel (MPGL)",
        "type_formation": "master",
        "ordre": 1,
        "specialites": _MPGL_SPECIALITES,
    },
    {
        "code_parcours": "MPDS",
        "nom_parcours": "Mastère Professionnel en sciences de données (MPDS)",
        "type_formation": "master",
        "ordre": 2,
        # MPDS = 3 spécialités propres + toutes celles du MPGL
        "specialites": [
            {
                "nom": "Licence en Mathématiques Appliquées (spécialité statistique de l'environnement)",
                "abreviation": "LMA-SE",
            },
            {
                "nom": "Mathématique Appliquée — spécialité Science de Données",
                "abreviation": "MA-SD",
            },
            {
                "nom": "Mathématiques et Applications",
                "abreviation": "MA",
            },
        ] + _MPGL_SPECIALITES,
    },
    {
        "code_parcours": "MP3I",
        "nom_parcours": "Mastère Professionnel en Ingénieries en Instrumentation industrielle (MP3I)",
        "type_formation": "master",
        "ordre": 3,
        "specialites": [
            {
                "nom": "Licence en Électronique, Électrotechnique et Automatique (MIM)",
                "abreviation": "LEEA-MIM",
            },
            {
                "nom": "Licence en Électronique, Électrotechnique et Automatique (SE)",
                "abreviation": "LEEA-SE",
            },
            {
                "nom": "Licence en Technologies de l'Information et de la Communication (TIC)",
                "abreviation": "LTIC",
            },
            {
                "nom": "Licence en Mesures et Instrumentation",
                "abreviation": "LMI",
            },
            {
                "nom": (
                    "Licence en EEA — Spécialité Automatique et Informatique Industrielle"
                    " ou Mesures et Métrologie"
                ),
                "abreviation": "LEEA-AII",
            },
            {
                "nom": (
                    "Licence en Génie Électrique — Spécialité Automatique"
                    " et Informatique Industrielle"
                ),
                "abreviation": "LGE-AII",
            },
        ],
    },
    # ── Masters Recherche ──────────────────────────────────────────────────
    {
        "code_parcours": "MRGL",
        "nom_parcours": "Mastère Recherche en Génie logiciel (MRGL)",
        "type_formation": "master",
        "ordre": 4,
        "specialites": [
            {
                "nom": "Licence en Informatique",
                "abreviation": "LI",
            },
            {
                "nom": "Maîtrise en Informatique",
                "abreviation": "MI",
            },
            {
                "nom": "Licence en Informatique ou Informatique de Gestion",
                "abreviation": "LI-IG",
            },
            {
                "nom": "Maîtrise en Informatique ou Informatique de Gestion",
                "abreviation": "MI-IG",
            },
        ],
    },
    {
        "code_parcours": "MRMI",
        "nom_parcours": "Mastère Recherche en micro-électronique et instrumentation (MRMI)",
        "type_formation": "master",
        "ordre": 5,
        "specialites": [
            {
                "nom": (
                    "Licence en EEA, MIM (Électronique, Systèmes Embarqués, Métrologie)"
                    " ou TIC (Réseaux et IoT)"
                ),
                "abreviation": "LEEA-MIM-TIC",
            },
            {
                "nom": "Licence en Électronique, Automatique ou Mesures et Instrumentation",
                "abreviation": "LEA-MI",
            },
            {
                "nom": (
                    "Réussite en 1ère année du cycle ingénieur"
                    " (Électronique/Instrumentation) ou équivalent"
                ),
                "abreviation": "1A-ING",
            },
        ],
    },
    # ── Cycle Ingénieur ────────────────────────────────────────────────────
    {
        "code_parcours": "ING_GL",
        "nom_parcours": "Ingénieur en sciences Appliquées et Technologie : Génie Logiciel",
        "type_formation": "ingenieur",
        "ordre": 1,
        "specialites": [
            {
                "nom": "Diplôme en ingénierie système d'information",
                "abreviation": "DSI",
            },
            {
                "nom": "Diplôme en ingénierie système informatique",
                "abreviation": "DISI",
            },
        ],
    },
]

_SEEDED_KEYS = [(p["code_parcours"], p["type_formation"]) for p in PARCOURS_DATA]


# ──────────────────────────────────────────────────────────────────────────────
# FONCTIONS FORWARD / REVERSE
# ──────────────────────────────────────────────────────────────────────────────

def seed_parcours_specialites(apps, schema_editor):
    """Insère ou met à jour les 6 parcours officiels ISIMM."""
    SpecialiteParcoursMapping = apps.get_model(
        "candidature_app", "SpecialiteParcoursMapping"
    )

    created_count = 0
    updated_count = 0

    for data in PARCOURS_DATA:
        obj, created = SpecialiteParcoursMapping.objects.update_or_create(
            code_parcours=data["code_parcours"],
            type_formation=data["type_formation"],
            defaults={
                "nom_parcours": data["nom_parcours"],
                "specialites": data["specialites"],
                "ordre": data.get("ordre", 0),
                "actif": True,
            },
        )
        if created:
            created_count += 1
        else:
            updated_count += 1

    print(
        f"\n[0025] SpecialiteParcoursMapping : "
        f"{created_count} créé(s), {updated_count} mis à jour."
    )


def unseed_parcours_specialites(apps, schema_editor):
    """Supprime uniquement les entrées créées par cette migration."""
    SpecialiteParcoursMapping = apps.get_model(
        "candidature_app", "SpecialiteParcoursMapping"
    )
    from django.db.models import Q

    q = Q()
    for code, type_f in _SEEDED_KEYS:
        q |= Q(code_parcours=code, type_formation=type_f)

    deleted, _ = SpecialiteParcoursMapping.objects.filter(q).delete()
    print(f"\n[0025 reverse] SpecialiteParcoursMapping : {deleted} entrée(s) supprimée(s).")


# ──────────────────────────────────────────────────────────────────────────────
# MIGRATION
# ──────────────────────────────────────────────────────────────────────────────

class Migration(migrations.Migration):

    dependencies = [
        ("candidature_app", "0024_candidature_flag_fraude_and_more"),
    ]

    operations = [
        migrations.RunPython(
            seed_parcours_specialites,
            reverse_code=unseed_parcours_specialites,
        ),
    ]
