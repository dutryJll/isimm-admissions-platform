"""
Management command — Peuplement / resynchronisation de SpecialiteParcoursMapping.

Usage :
    python manage.py seed_specialites_parcours
    python manage.py seed_specialites_parcours --reset   # supprime d'abord les entrées existantes
    python manage.py seed_specialites_parcours --dry-run # affiche ce qui serait inséré

Idempotent : update_or_create sur (code_parcours, type_formation).
"""

from django.core.management.base import BaseCommand

from candidature_app.models import SpecialiteParcoursMapping


# ──────────────────────────────────────────────────────────────────────────────
# DONNÉES SOURCES (source de vérité unique, identique à la migration 0025)
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


# ──────────────────────────────────────────────────────────────────────────────
# COMMANDE
# ──────────────────────────────────────────────────────────────────────────────

class Command(BaseCommand):
    help = (
        "Peuple SpecialiteParcoursMapping avec les 6 parcours officiels ISIMM "
        "(5 Masters + 1 Ingénieur) et leur matrice d'éligibilité de diplômes."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Supprime d'abord les entrées existantes avant d'insérer.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Affiche ce qui serait inséré sans toucher à la base de données.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        reset = options["reset"]

        self.stdout.write(self.style.MIGRATE_HEADING(
            "\n╔══════════════════════════════════════════════════════════╗"
        ))
        self.stdout.write(self.style.MIGRATE_HEADING(
            "║   ISIMM — Seeding SpecialiteParcoursMapping              ║"
        ))
        self.stdout.write(self.style.MIGRATE_HEADING(
            "╚══════════════════════════════════════════════════════════╝\n"
        ))

        if dry_run:
            self.stdout.write(self.style.WARNING("Mode DRY-RUN — aucune écriture en base.\n"))

        # ── Optionnel : reset ──────────────────────────────────────────────
        if reset and not dry_run:
            codes = [p["code_parcours"] for p in PARCOURS_DATA]
            deleted, _ = SpecialiteParcoursMapping.objects.filter(
                code_parcours__in=codes
            ).delete()
            self.stdout.write(
                self.style.WARNING(f"[RESET] {deleted} entrée(s) supprimée(s).\n")
            )

        # ── Insertion / mise à jour ────────────────────────────────────────
        created_total = 0
        updated_total = 0

        for data in PARCOURS_DATA:
            label = f"{data['nom_parcours']} [{data['code_parcours']}]"
            nb_specs = len(data["specialites"])

            if dry_run:
                self.stdout.write(
                    f"  → {self.style.SUCCESS('DRY')} {label} "
                    f"({nb_specs} spécialité(s))"
                )
                for s in data["specialites"]:
                    self.stdout.write(
                        f"      • {s['nom']}  ({s['abreviation']})"
                    )
                self.stdout.write("")
                continue

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
                created_total += 1
                status_label = self.style.SUCCESS("CRÉÉ   ")
            else:
                updated_total += 1
                status_label = self.style.NOTICE("MAJ    ")

            self.stdout.write(
                f"  {status_label} {label} — {nb_specs} spécialité(s)  "
                f"(type: {data['type_formation']}, ordre: {data.get('ordre', 0)})"
            )

        # ── Résumé ─────────────────────────────────────────────────────────
        if not dry_run:
            self.stdout.write("")
            self.stdout.write(self.style.SUCCESS(
                f"✔  Terminé : {created_total} créé(s), {updated_total} mis à jour."
            ))

            # Vérification finale
            total_en_base = SpecialiteParcoursMapping.objects.filter(
                code_parcours__in=[p["code_parcours"] for p in PARCOURS_DATA]
            ).count()
            self.stdout.write(self.style.SUCCESS(
                f"✔  {total_en_base} parcours présents en base après seeding."
            ))

            # Récapitulatif par parcours
            self.stdout.write(self.style.MIGRATE_HEADING("\n── Récapitulatif ──────────────────────────"))
            for obj in SpecialiteParcoursMapping.objects.filter(
                code_parcours__in=[p["code_parcours"] for p in PARCOURS_DATA]
            ).order_by("type_formation", "ordre"):
                nb = len(obj.specialites) if isinstance(obj.specialites, list) else 0
                self.stdout.write(
                    f"  [{obj.code_parcours:<8}]  {obj.nom_parcours:<65}  "
                    f"{nb:>2} spécialité(s)"
                )
            self.stdout.write("")
