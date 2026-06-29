
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from candidature_app.models import (
    Candidature, Commission, DonneesAcademiques, Master, MembreCommission,
)

User = get_user_model()

# ---------------------------------------------------------------------------
# Comptes principaux — identifiés par EMAIL (même que auth-service)
# ---------------------------------------------------------------------------
RESPONSABLE_EMAIL = 'responsable@isimm.tn'
COMMISSION_EMAIL  = 'commission@isimm.tn'

# ---------------------------------------------------------------------------
# Commission cible — doit correspondre EXACTEMENT à ce qu'Angular affiche
# ---------------------------------------------------------------------------
TARGET_COMMISSION_NOM = 'Commission Genie Logiciel Demo'

# ---------------------------------------------------------------------------
# Candidats demo : 4 + 4 + 4 = 12
# ---------------------------------------------------------------------------
PRESELECTEES = [
    {"prenom": "Yassine", "nom": "Ben Ammar",  "email": "yassine.benammar@demo.tn",  "score": 16.85, "statut": "sous_examen",    "depose": False, "spec": "Licence Informatique GL"},
    {"prenom": "Nour",    "nom": "Zouari",     "email": "nour.zouari@demo.tn",       "score": 15.20, "statut": "sous_examen",    "depose": False, "spec": "Licence Informatique GL"},
    {"prenom": "Rania",   "nom": "Mabrouk",    "email": "rania.mabrouk@demo.tn",     "score": 17.10, "statut": "sous_examen",    "depose": False, "spec": "Informatique de Gestion"},
    {"prenom": "Ahmed",   "nom": "Ben Ali",    "email": "ahmed.benali.test@demo.tn", "score": 14.50, "statut": "sous_examen",    "depose": False, "spec": "Licence Informatique GL"},
]
DOSSIERS_DEPOSES = [
    {"prenom": "Mohamed", "nom": "Jlassi",    "email": "mohamed.jlassi@demo.tn",    "score": 14.90, "statut": "dossier_depose", "depose": True,  "spec": "Informatique de Gestion"},
    {"prenom": "Sonia",   "nom": "Trabelsi",  "email": "sonia.trabelsi@demo.tn",    "score": 15.75, "statut": "dossier_depose", "depose": True,  "spec": "Genie Logiciel et SI"},
    {"prenom": "Marwen",  "nom": "Gharbi",    "email": "marwen.gharbi@demo.tn",     "score": 13.25, "statut": "dossier_depose", "depose": True,  "spec": "Genie Logiciel et SI"},
    {"prenom": "Amira",   "nom": "Dridi",     "email": "amira.dridi@demo.tn",       "score": 16.40, "statut": "dossier_depose", "depose": True,  "spec": "Genie Logiciel"},
]
SELECTIONNES = [
    {"prenom": "Fedi",    "nom": "Khamassi",  "email": "fedi.khamassi@demo.tn",     "score": 15.60, "statut": "selectionne",    "depose": True,  "spec": "Licence Informatique GL"},
    {"prenom": "Hamza",   "nom": "Ayari",     "email": "hamza.ayari@demo.tn",        "score": 14.80, "statut": "selectionne",    "depose": True,  "spec": "Genie Logiciel"},
    {"prenom": "Farah",   "nom": "Ellouze",   "email": "farah.ellouze@demo.tn",     "score": 16.10, "statut": "selectionne",    "depose": True,  "spec": "Licence App. DSI"},
    {"prenom": "Oussema", "nom": "Saidi",     "email": "oussema.saidi@demo.tn",     "score": 15.60, "statut": "selectionne",    "depose": True,  "spec": "Licence App. DSI"},
]
ALL_DEMO = PRESELECTEES + DOSSIERS_DEPOSES + SELECTIONNES


class Command(BaseCommand):
    help = "Seed 12 candidats demo sur 'Commission Genie Logiciel Demo'."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--reset",   action="store_true",
                            help="Supprime les candidats demo.tn avant de reseed.")

    def handle(self, *args, **options):
        dry = options["dry_run"]
        reset = options["reset"]
        w = self.stdout.write

        w(self.style.MIGRATE_HEADING(
            "\n=======================================================\n"
            "  ISIMM - Seed WORKFLOW demo\n"
            "  Cible : Commission Genie Logiciel Demo\n"
            "=======================================================\n"
        ))

        # ── 1. Trouver les comptes par email ─────────────────────────────
        responsable_user = User.objects.filter(email__iexact=RESPONSABLE_EMAIL).first()
        commission_user  = User.objects.filter(email__iexact=COMMISSION_EMAIL).first()

        if not responsable_user:
            self.stderr.write(self.style.ERROR(
                f"User '{RESPONSABLE_EMAIL}' introuvable.\n"
                "Connectez-vous UNE FOIS avec ce compte pour l'auto-creer dans la DB."
            ))
            return
        if not commission_user:
            self.stderr.write(self.style.ERROR(
                f"User '{COMMISSION_EMAIL}' introuvable.\n"
                "Connectez-vous UNE FOIS avec ce compte pour l'auto-creer dans la DB."
            ))
            return

        w(f"  Responsable : [{responsable_user.id}] {responsable_user.username} ({responsable_user.email})")
        w(f"  Commission  : [{commission_user.id}]  {commission_user.username} ({commission_user.email})\n")

        # ── 2. Trouver la commission cible par nom EXACT ──────────────────
        try:
            commission = Commission.objects.get(nom=TARGET_COMMISSION_NOM)
        except Commission.DoesNotExist:
            self.stderr.write(self.style.ERROR(
                f"Commission '{TARGET_COMMISSION_NOM}' introuvable en base.\n"
                "Verifiez le nom exact dans Django admin."
            ))
            return
        except Commission.MultipleObjectsReturned:
            commission = Commission.objects.filter(nom=TARGET_COMMISSION_NOM).order_by('id').first()

        w(f"  Commission  : [{commission.id}] '{commission.nom}' actif={commission.actif}")

        if not commission.actif:
            commission.actif = True
            commission.save(update_fields=['actif'])
            w(self.style.WARNING("  [FIX] Commission mise actif=True"))

        # ── 3. Master lié ─────────────────────────────────────────────────
        if not commission.master_id:
            self.stderr.write(self.style.ERROR(
                f"La commission '{TARGET_COMMISSION_NOM}' n'a pas de master associé."
            ))
            return

        master = commission.master
        w(f"  Master      : [{master.id}] '{master.nom}' actif={master.actif}")

        if not master.actif:
            master.actif = True
            master.save(update_fields=['actif'])
            w(self.style.WARNING(f"  [FIX] Master [{master.id}] mis actif=True"))

        # ── 4. Membres ────────────────────────────────────────────────────
        if not dry:
            for user, role in [(responsable_user, 'responsable'), (commission_user, 'membre')]:
                mb, created = MembreCommission.objects.get_or_create(
                    commission=commission,
                    user=user,
                    defaults={"role": role, "actif": True},
                )
                changed = False
                if not mb.actif:
                    mb.actif = True
                    changed = True
                if mb.role != role:
                    mb.role = role
                    changed = True
                if changed:
                    mb.save(update_fields=['actif', 'role'])
                tag = "CREE" if created else ("MAJ " if changed else "OK  ")
                w(f"  [{tag}] MembreCommission : {user.username} -> role={role}")

        # ── 5. Reset ──────────────────────────────────────────────────────
        if reset and not dry:
            emails = [c["email"] for c in ALL_DEMO]
            users_demo = User.objects.filter(email__in=emails)
            nb, _ = Candidature.objects.filter(candidat__in=users_demo).delete()
            users_demo.delete()
            w(self.style.WARNING(f"\n  [RESET] {nb} candidature(s) demo supprimee(s).\n"))

        # ── 6. Seed ───────────────────────────────────────────────────────
        def seed_one(data: dict, suffix: str) -> None:
            label = f"{data['prenom']} {data['nom']} [{data['statut']}] score={data['score']}"
            if dry:
                w(f"  DRY  {label}")
                return

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

            cand, c_created = Candidature.objects.get_or_create(
                candidat=u,
                master=master,
                defaults={
                    "numero":          f"CAND-WF-{suffix}",
                    "score":           data["score"],
                    "statut":          data["statut"],
                    "dossier_depose":  data["depose"],
                    "date_soumission": timezone.now(),
                },
            )

            DonneesAcademiques.objects.update_or_create(
                candidature=cand,
                defaults={
                    "moyenne_generale": data["score"],
                    "notes_detaillees": {
                        "specialite_diplome": data["spec"],
                        "payload": {"specialite_diplome": data["spec"]},
                    },
                },
            )

            # Bypass signal recalcul — force les valeurs correctes
            Candidature.objects.filter(pk=cand.pk).update(
                score=data["score"],
                statut=data["statut"],
                dossier_depose=data["depose"],
            )

            tag = self.style.SUCCESS("CREE  ") if c_created else self.style.NOTICE("MAJ   ")
            w(f"  {tag} {label}")

        w("\n-- 4x sous_examen (présélection) -----------------------")
        for i, d in enumerate(PRESELECTEES, start=100):
            seed_one(d, str(i))

        w("\n-- 4x dossier_depose (sélection) -----------------------")
        for i, d in enumerate(DOSSIERS_DEPOSES, start=200):
            seed_one(d, str(i))

        w("\n-- 4x selectionne (admis) ------------------------------")
        for i, d in enumerate(SELECTIONNES, start=300):
            seed_one(d, str(i))

        # ── 7. Résumé ─────────────────────────────────────────────────────
        if not dry:
            def count(s):
                return Candidature.objects.filter(master=master, statut=s).count()

            total = Candidature.objects.filter(master=master).count()
            w(self.style.SUCCESS(
                f"\n[OK] {total} candidature(s) sur '{master.nom}'\n"
                f"     sous_examen={count('sous_examen')}  "
                f"dossier_depose={count('dossier_depose')}  "
                f"selectionne={count('selectionne')}\n"
            ))
            w("Identifiants demo :")
            w(f"  Responsable : {RESPONSABLE_EMAIL}  / TestPassword123!")
            w(f"  Commission  : {COMMISSION_EMAIL}   / Demo@2026!\n")
