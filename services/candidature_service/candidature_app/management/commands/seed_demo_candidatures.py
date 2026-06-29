

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from candidature_app.models import Candidature, DonneesAcademiques, Master

User = get_user_model()

# ──────────────────────────────────────────────────────────────────────────────
# DONNÉES DE DÉMO (11 candidats MPGL × 5 spécialités de diplôme)
# Statuts valides : 'soumis' | 'preselectionne' | 'selectionne' | 'rejete'
# ──────────────────────────────────────────────────────────────────────────────

DEMO_CANDIDATS = [
    # ── Spécialité 1 : LSI-GL ─────────────────────────────────────────────
    {
        "prenom": "Yassine",  "nom": "Ben Ammar",
        "email": "yassine.benammar@demo.tn",
        "score": 16.85, "statut": "selectionne",  "depose": True,
        "spec": "Licence en Sciences de l'Informatique génie logiciel",
    },
    {
        "prenom": "Nour",     "nom": "Zouari",
        "email": "nour.zouari@demo.tn",
        "score": 15.20, "statut": "preselectionne", "depose": True,
        "spec": "Licence en Sciences de l'Informatique génie logiciel",
    },
    {
        "prenom": "Fedi",     "nom": "Khamassi",
        "email": "fedi.khamassi@demo.tn",
        "score": 11.40, "statut": "rejete",        "depose": True,
        "spec": "Licence en Sciences de l'Informatique génie logiciel",
    },

    # ── Spécialité 2 : IG ─────────────────────────────────────────────────
    {
        "prenom": "Rania",    "nom": "Mabrouk",
        "email": "rania.mabrouk@demo.tn",
        "score": 17.10, "statut": "selectionne",  "depose": True,
        "spec": "Informatique de Gestion (uniquement)",
    },
    {
        "prenom": "Mohamed",  "nom": "Jlassi",
        "email": "mohamed.jlassi@demo.tn",
        "score": 14.90, "statut": "preselectionne", "depose": True,
        "spec": "Informatique de Gestion (uniquement)",
    },

    # ── Spécialité 3 : GLSI ───────────────────────────────────────────────
    {
        "prenom": "Sonia",    "nom": "Trabelsi",
        "email": "sonia.trabelsi@demo.tn",
        "score": 15.75, "statut": "selectionne",  "depose": True,
        "spec": "Génie Logiciel et Systèmes d'Information",
    },
    {
        "prenom": "Marwen",   "nom": "Gharbi",
        "email": "marwen.gharbi@demo.tn",
        "score": 13.25, "statut": "preselectionne", "depose": True,
        "spec": "Génie Logiciel et Systèmes d'Information",
    },

    # ── Spécialité 4 : GL ─────────────────────────────────────────────────
    {
        "prenom": "Amira",    "nom": "Dridi",
        "email": "amira.dridi@demo.tn",
        "score": 16.40, "statut": "selectionne",  "depose": True,
        "spec": "Génie Logiciel",
    },
    {
        "prenom": "Hamza",    "nom": "Ayari",
        "email": "hamza.ayari@demo.tn",
        "score": 12.80, "statut": "rejete",        "depose": True,
        "spec": "Génie Logiciel",
    },

    # ── Spécialité 5 : LA-DSI ─────────────────────────────────────────────
    {
        "prenom": "Farah",    "nom": "Ellouze",
        "email": "farah.ellouze@demo.tn",
        "score": 14.15, "statut": "preselectionne", "depose": True,
        "spec": "Licence Appliquée en Développement des Systèmes Informatiques",
    },
    {
        "prenom": "Oussema",  "nom": "Saidi",
        "email": "oussema.saidi@demo.tn",
        "score": 15.60, "statut": "selectionne",  "depose": True,
        "spec": "Licence Appliquée en Développement des Systèmes Informatiques",
    },
]

# Candidat OCR live (dossier non déposé — prêt pour la démo OCR devant le prof)
AHMED = {
    "prenom": "Ahmed", "nom": "Ben Ali",
    "email": "ahmed.benali.test@demo.tn",
    "score": 14.50, "statut": "soumis", "depose": False,
    "spec": "Licence en Sciences de l'Informatique génie logiciel",
}


class Command(BaseCommand):
    help = (
        "Seed démo MPGL : 11 candidats (5 spécialités diplôme) + Ahmed OCR. "
        "Nécessite que le Master MPGL (specialite='MPGL') existe déjà en base."
    )

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true",
                            help="Affiche ce qui serait créé sans toucher la base.")
        parser.add_argument("--reset", action="store_true",
                            help="Supprime les candidatures demo.tn avant de re-seeder.")

    def handle(self, *args, **options):
        dry  = options["dry_run"]
        reset = options["reset"]

        self.stdout.write(self.style.MIGRATE_HEADING(
            "\n=======================================================\n"
            "  ISIMM - Seed demo candidatures MPGL\n"
            "=======================================================\n"
        ))
        if dry:
            self.stdout.write(self.style.WARNING("Mode DRY-RUN — aucune écriture.\n"))

        # ── 1. Récupérer le master MPGL ───────────────────────────────────────
        try:
            master = Master.objects.get(specialite="MPGL")
        except Master.DoesNotExist:
            self.stderr.write(self.style.ERROR(
                "❌ Aucun Master avec specialite='MPGL' en base. "
                "Lancez d'abord fix_master_names ou créez-le via l'admin."
            ))
            return
        except Master.MultipleObjectsReturned:
            master = Master.objects.filter(specialite="MPGL").order_by("id").first()

        self.stdout.write(f"  Master cible : [{master.id}] {master.nom}\n")

        # ── 2. Reset optionnel ─────────────────────────────────────────────────
        if reset and not dry:
            emails_demo = [c["email"] for c in DEMO_CANDIDATS] + [AHMED["email"]]
            users_demo  = User.objects.filter(email__in=emails_demo)
            Candidature.objects.filter(candidat__in=users_demo, master=master).delete()
            users_demo.delete()
            self.stdout.write(self.style.WARNING("  [RESET] Données demo supprimées.\n"))

        # ── 3. Helper interne ──────────────────────────────────────────────────
        def seed_one(data: dict, numero_suffix: str, is_ahmed: bool = False) -> None:
            label = f"{data['prenom']} {data['nom']} — {data['spec'][:40]}…"
            if dry:
                self.stdout.write(f"  DRY  {label}  (statut={data['statut']}, score={data['score']})")
                return

            # Créer ou mettre à jour l'utilisateur
            u, u_created = User.objects.get_or_create(
                email=data["email"],
                defaults={
                    "username":   data["email"].split("@")[0].replace(".", "_")[:150],
                    "first_name": data["prenom"],
                    "last_name":  data["nom"],
                    "is_active":  True,
                },
            )
            if u_created:
                u.set_password("Demo@2026!")
                u.save()

            # Créer ou récupérer la candidature
            cand, c_created = Candidature.objects.get_or_create(
                candidat=u,
                master=master,
                defaults={
                    "numero":        f"CAND-DEMO-{numero_suffix}",
                    "score":         data["score"],
                    "statut":        data["statut"],
                    "dossier_depose": data["depose"],
                    "date_soumission": timezone.now(),
                },
            )
            # Forcer la mise à jour même si déjà existant
            cand.score         = data["score"]
            cand.statut        = data["statut"]
            cand.dossier_depose = data["depose"]
            cand.save(update_fields=["score", "statut", "dossier_depose"])

            # Stocker specialite_diplome dans DonneesAcademiques.notes_detaillees
            # → lu par _extract_specialite_diplome() dans views.py (dropdown filtre)
            DonneesAcademiques.objects.update_or_create(
                candidature=cand,
                defaults={
                    "moyenne_generale": data["score"],
                    "notes_detaillees": {
                        "specialite_diplome": data["spec"],
                        "payload":            {"specialite_diplome": data["spec"]},
                    },
                },
            )
            # DonneesAcademiques.save() triggers calculer_et_sauvegarder_score()
            # which overwrites Candidature.score via formula coefficients.
            # Bypass it with a direct QuerySet.update() (no save signal fired).
            Candidature.objects.filter(pk=cand.pk).update(
                score=data["score"],
                statut=data["statut"],
                dossier_depose=data["depose"],
            )

            tag = self.style.SUCCESS("CRÉÉ  ") if c_created else self.style.NOTICE("MAJ   ")
            self.stdout.write(f"  {tag} {label}  (statut={data['statut']}, score={data['score']})")

        # ── 4. Seed candidat OCR Ahmed ─────────────────────────────────────────
        self.stdout.write("\n-- Candidat OCR live (Ahmed Ben Ali) ------------------")
        seed_one(AHMED, "OCR", is_ahmed=True)

        # ── 5. Seed 11 candidats de démo ───────────────────────────────────────
        self.stdout.write("\n-- 11 candidats par specialite diplome -----------------")
        for i, data in enumerate(DEMO_CANDIDATS, start=200):
            seed_one(data, str(i))

        # ── 6. Résumé ──────────────────────────────────────────────────────────
        if not dry:
            total = Candidature.objects.filter(master=master).count()
            sel   = Candidature.objects.filter(master=master, statut="selectionne").count()
            pres  = Candidature.objects.filter(master=master, statut="preselectionne").count()
            rej   = Candidature.objects.filter(master=master, statut="rejete").count()
            self.stdout.write(self.style.SUCCESS(
                f"\n[OK] Termine : {total} candidature(s) au total pour MPGL\n"
                f"     Selectionnes={sel}  Preselectionnes={pres}  Refuses={rej}\n"
            ))
            self.stdout.write(
                ">>> Ahmed Ben Ali (ahmed.benali.test@demo.tn) -> statut=soumis, "
                "dossier_depose=False -> pret pour test OCR.\n"
            )
