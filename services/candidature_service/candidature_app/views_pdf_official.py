"""
Contrôleur : générateur PDF officiel ISIMM
GET /api/candidatures/documents/generer-pdf
"""
import logging
import os
from datetime import date

from django.conf import settings
from django.db.models import Q
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

logger = logging.getLogger(__name__)

from .models import Candidature, MembreCommission
from .exports_isimm_official import ISIMMPDFGenerator

MPGL_PARCOURS_LABEL = "Master Génie Logiciel et Systèmes d'Information"
MPGL_SPECIALITES_DIPLOME = [
    "Génie Logiciel et Systèmes d'Information",
    "Genie Logiciel et Systemes d'Information",
    "Génie Logiciel",
    "Genie Logiciel",
    "Licence Appliquée en Développement des Systèmes Informatiques",
    "Developpement des Systemes Informatiques",
    "Big Data et Analyse de Données",
    "Big Data et Analyse de Donnees",
    "Business Computing",
    "Informatique de Gestion",
]


def _get_logo_path() -> str | None:
    """Localise le logo ISIMM dans les assets statiques."""
    candidates = [
        os.path.join(settings.BASE_DIR, 'assets', 'images', 'logo-isimm.png'),
        os.path.join(settings.BASE_DIR, 'static', 'images', 'logo-isimm.png'),
        os.path.join(settings.BASE_DIR, 'media', 'logo-isimm.png'),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return None


def _build_qr_url(request, etape: str, master_id: int, specialite: str = '') -> str:
    """Construit l'URL de vérification intégrée dans le QR code."""
    base = request.build_absolute_uri('/').rstrip('/')
    url = f'{base}/api/candidatures/documents/verifier-liste/?etape={etape}&master={master_id}'
    if specialite:
        url += f'&specialite={specialite}'
    return url


def _candidature_to_dict(c: Candidature) -> dict:
    """Sérialise une Candidature en dict pour le générateur PDF."""
    candidat = c.candidat if hasattr(c, 'candidat') else None

    # Extrait la spécialité diplôme depuis DonneesAcademiques.notes_detaillees
    specialite_diplome = ''
    try:
        from .models import DonneesAcademiques
        da = DonneesAcademiques.objects.filter(candidature=c).first()
        if da and isinstance(da.notes_detaillees, dict):
            notes = da.notes_detaillees
            payload = notes.get('payload', {}) if isinstance(notes.get('payload'), dict) else {}
            for key in (
                'selected_diplome',
                'specialiteLicence',
                'specialite_diplome_obtenu',   # ← clé réelle du formulaire candidat
                'specialiteDiplomeObtenu',
                'specialite_diplome',
                'specialiteDiplome',
                'licenceSpecialite',
                'specialite',
                'specialite_autre',            # MOD v4 §5 — texte libre « Autre »
                'specialiteDiplomeAutre',
                'diplome',
                'diplome_reference',
            ):
                value = payload.get(key) or notes.get(key)
                if isinstance(value, str) and value.strip():
                    specialite_diplome = value.strip()
                    break
    except Exception:
        pass

    # MOD v6 §5 — Fallback sur la spécialité déclarée directement sur la candidature
    # (jamais sur le quota/master tant que le candidat a renseigné une valeur).
    if not specialite_diplome:
        for attr in ('specialite', 'specialite_diplome', 'specialite_diplome_obtenu'):
            val = getattr(c, attr, '') or ''
            if isinstance(val, str) and val.strip():
                specialite_diplome = val.strip()
                break

    # Type candidat : interne si email finit par @isimm.tn, externe sinon
    candidat_email = (getattr(candidat, 'email', '') or '').lower()
    type_candidat = 'interne' if candidat_email.endswith('@isimm.tn') else 'externe'

    return {
        'num_dossier': getattr(c, 'numero', '') or str(c.id),
        'nom': getattr(candidat, 'last_name', '') if candidat else (getattr(c, 'candidat_nom', '') or ''),
        'prenom': getattr(candidat, 'first_name', '') if candidat else '',
        'cin': getattr(candidat, 'cin', '') if candidat else (getattr(c, 'cin_passeport', '') or ''),
        'score': float(getattr(c, 'score', 0) or 0),
        'type_candidat': type_candidat,
        'specialite_candidat': specialite_diplome or getattr(c.master, 'specialite', '') or getattr(c.master, 'nom', '') or 'Spécialité non précisée par le candidat',
    }


def _mpgl_parcours_filter() -> Q:
    query = (
        Q(master__specialite__iexact='MPGL')
        | Q(master__specialite__iexact='MPDS')
        | Q(master__nom__icontains='Génie Logiciel')
        | Q(master__nom__icontains='Genie Logiciel')
        | Q(master__nom__icontains="Systèmes d'Information")
        | Q(master__nom__icontains="Systemes d'Information")
        | Q(master__nom__icontains='Big Data')
        | Q(master__nom__icontains='Analyse de Données')
        | Q(master__nom__icontains='Analyse de Donnees')
        | Q(master__specialite__icontains='Génie Logiciel')
        | Q(master__specialite__icontains='Genie Logiciel')
        | Q(master__specialite__icontains='Big Data')
    )
    return query


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def generer_pdf_officiel(request):
    """
    Génère la liste officielle PDF au format ISIMM GFH FOR 09 v1.

    Paramètres query string :
        etape       : 'PRESELECTION' (défaut) ou 'SELECTION'
        master_id   : int (obligatoire)
        specialite  : str (optionnel — filtre une spécialité)
        annee       : str (ex: '2025-2026', défaut: année courante)
    """
    role = getattr(request.user, 'role', None)

    # ── Contrôle d'accès ──────────────────────────────────────────────────────
    allowed_roles = ['admin', 'responsable_commission', 'commission']
    if role not in allowed_roles:
        return Response({'error': 'Permission refusée.'}, status=status.HTTP_403_FORBIDDEN)

    # ── Paramètres ────────────────────────────────────────────────────────────
    etape = request.query_params.get('etape', 'PRESELECTION').upper()
    master_id_str = request.query_params.get('master_id', '').strip()
    parcours = request.query_params.get('parcours', '').strip().upper()
    specialite_filter = request.query_params.get('specialite', '').strip()
    candidature_ids_raw = request.query_params.get('candidature_ids', '').strip()
    annee = request.query_params.get('annee', f'{date.today().year - 1}-{date.today().year}')

    if not master_id_str or not master_id_str.isdigit():
        return Response({'error': 'master_id est obligatoire.'}, status=status.HTTP_400_BAD_REQUEST)

    master_id = int(master_id_str)

    ETAPES_VALIDES = ('PRESELECTION', 'SELECTION', 'MASTER', 'INGENIEUR')
    if etape not in ETAPES_VALIDES:
        return Response(
            {'error': f"etape doit être l'un de : {', '.join(ETAPES_VALIDES)}."},
            status=status.HTTP_400_BAD_REQUEST
        )
    # Normalise MASTER/INGENIEUR to PRESELECTION for query logic
    etape_query = 'PRESELECTION' if etape in ('MASTER', 'INGENIEUR') else etape

    # ── Vérification des droits sur ce master ─────────────────────────────────
    # responsable_commission a accès global ; commission (membre) est limité à son master
    if role == 'commission':
        has_access = MembreCommission.objects.filter(
            user=request.user,
            actif=True,
            commission__actif=True,
            commission__master_id=master_id,
        ).exists()
        if not has_access:
            return Response(
                {'error': 'Accès refusé : vous n\'êtes pas membre d\'une commission pour ce master.'},
                status=status.HTTP_403_FORBIDDEN
            )

    # ── Récupération des candidatures filtrées ────────────────────────────────
    # MOD — Le PDF officiel doit contenir TOUS les candidats affichés dans l'écran
    # Présélection / Sélection (pas seulement ceux déjà marqués « preselectionne »),
    # sinon le PDF ne contenait qu'un seul candidat. On inclut donc tous les
    # candidats encore « en lice » et on exclut uniquement les rejetés/annulés.
    statuts_presel = [
        'preselectionne', 'selectionne', 'en_attente', 'en_attente_dossier',
        'dossier_depose', 'dossier_non_depose', 'sous_examen', 'soumis', 'inscrit',
    ]
    statuts_selection = [
        'selectionne', 'admis', 'en_attente_liste', 'en_attente', 'preselectionne', 'inscrit',
    ]

    qs = Candidature.objects.select_related('candidat', 'master')
    if parcours == 'MPGL':
        qs = qs.filter(_mpgl_parcours_filter())
    else:
        qs = qs.filter(master_id=master_id)

    if etape in ('INGENIEUR',):
        qs = qs.filter(type_concours='ingenieur')

    # Sous-listes de la phase Sélection : liste principale (admis) vs liste d'attente.
    # Le workflow `generer_liste_manuelle` met les admis en statut 'selectionne' et
    # la liste d'attente en statut 'en_attente'.
    liste = request.query_params.get('liste', '').strip().lower()
    titre_override = None

    if etape_query == 'PRESELECTION':
        qs = qs.filter(statut__in=statuts_presel)
    elif liste == 'admis':
        qs = qs.filter(statut__in=['selectionne', 'inscrit'])
        titre_override = (
            f'Liste Principale (Admis) — {{master}} | Année universitaire : {annee}'
        )
    elif liste == 'attente':
        qs = qs.filter(statut__in=['en_attente'])
        titre_override = (
            f"Liste d'Attente — {{master}} | Année universitaire : {annee}"
        )
    else:
        qs = qs.filter(statut__in=statuts_selection)

    candidature_ids = []
    if candidature_ids_raw:
        try:
            candidature_ids = [
                int(value)
                for value in candidature_ids_raw.replace(';', ',').split(',')
                if value.strip()
            ]
        except ValueError:
            return Response(
                {'error': 'candidature_ids contient une valeur invalide.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    if candidature_ids:
        qs = qs.filter(id__in=candidature_ids)

    qs = qs.order_by('-score')

    candidates_data = [_candidature_to_dict(c) for c in qs]
    if specialite_filter:
        specialite_filter_lower = specialite_filter.lower()
        candidates_data = [
            c
            for c in candidates_data
            if specialite_filter_lower in (c.get('specialite_candidat') or '').lower()
        ]

    if not candidates_data:
        return Response(
            {'error': 'Aucune candidature ne correspond aux critères sélectionnés.'},
            status=status.HTTP_404_NOT_FOUND
        )

    # ── Infos du responsable ──────────────────────────────────────────────────
    user = request.user
    selecteur_nom = f'{getattr(user, "first_name", "")} {getattr(user, "last_name", "")}'.strip() or str(user)

    # Nom du master
    try:
        from .models import Master
        master = Master.objects.get(pk=master_id)
        master_nom = MPGL_PARCOURS_LABEL if parcours == 'MPGL' else master.nom
    except Exception:
        master_nom = MPGL_PARCOURS_LABEL if parcours == 'MPGL' else f'Master #{master_id}'

    # ── Génération du PDF ─────────────────────────────────────────────────────
    qr_url = _build_qr_url(request, etape, master_id, specialite_filter)
    logo_path = _get_logo_path()
    date_sel = date.today().strftime('%d/%m/%Y')

    if titre_override:
        titre_override = titre_override.replace('{master}', master_nom)

    try:
        generator = ISIMMPDFGenerator()
        pdf_buffer = generator.generer(
            candidates_data=candidates_data,
            etape=etape,
            master_nom=master_nom,
            annee=annee,
            selecteur=selecteur_nom,
            specialite_filter=specialite_filter,
            qr_url=qr_url,
            logo_path=logo_path,
            date_selection=date_sel,
            titre_override=titre_override,
        )
    except ImportError as e:
        return Response(
            {'error': f'Bibliothèque PDF manquante : {e}. Installez reportlab et qrcode.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    except Exception as e:
        return Response(
            {'error': f'Erreur de génération PDF : {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # ── Nom du fichier ────────────────────────────────────────────────────────
    etape_labels = {'PRESELECTION': 'Preselection', 'SELECTION': 'Selection', 'MASTER': 'Master', 'INGENIEUR': 'Ingenieur'}
    etape_label = etape_labels.get(etape, etape.capitalize())
    liste_label = {'admis': '_Liste_Admis', 'attente': '_Liste_Attente'}.get(liste, '')
    spec_label = f'_{specialite_filter.replace(" ", "_")}' if specialite_filter else ''
    filename = f'ISIMM_{etape_label}{liste_label}{spec_label}_{annee.replace("/", "-")}.pdf'

    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    response['X-Filename'] = filename
    response.write(pdf_buffer.read())
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def verifier_liste(request):
    """
    Endpoint de vérification d'authenticité d'une liste (appelé depuis le QR code).
    Retourne les métadonnées de la liste pour confirmation.
    """
    etape = request.query_params.get('etape', '').upper()
    master_id_str = request.query_params.get('master', '').strip()
    specialite = request.query_params.get('specialite', '').strip()

    if not master_id_str or not master_id_str.isdigit():
        return Response({'valid': False, 'message': 'Paramètres invalides.'})

    master_id = int(master_id_str)

    try:
        from .models import Master
        master = Master.objects.get(pk=master_id)
        return Response({
            'valid': True,
            'master': master.nom,
            'etape': etape,
            'specialite': specialite or 'Toutes',
            'institution': 'Institut Supérieur d\'Informatique et de Mathématiques de Monastir',
            'reference': 'GFH FOR 09 v1',
            'date_verification': date.today().isoformat(),
        })
    except Exception:
        return Response({'valid': False, 'message': 'Liste introuvable.'})


# ─────────────────────────────────────────────────────────────────────────────
# OCR Document Audit View
# POST /api/documents/auditer-ocr/
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def auditer_document_ocr(request):
    """
    Analyse OCR locale d'un document soumis par le responsable/membre.

    Body (multipart/form-data) :
        fichier        : fichier PDF ou image
        candidature_id : int (optionnel — pour déclencher flag_fraude si écart)
        score_declare  : float (optionnel — score déclaré par le candidat)

    Retourne le résultat d'audit OCR et met à jour flag_fraude si nécessaire.
    """
    from .services_ocr_local import OCRDocumentAuditor

    role = getattr(request.user, 'role', None)
    if role not in ('admin', 'responsable_commission', 'commission'):
        return Response({'error': 'Permission refusée.'}, status=status.HTTP_403_FORBIDDEN)

    fichier = request.FILES.get('fichier')
    if not fichier:
        return Response({'error': 'Aucun fichier fourni.'}, status=status.HTTP_400_BAD_REQUEST)

    candidature_id_str = request.data.get('candidature_id', '').strip()
    score_declare_str = request.data.get('score_declare', '').strip()

    score_declare = None
    if score_declare_str:
        try:
            score_declare = float(score_declare_str)
        except ValueError:
            pass

    # Récupère le score déclaré depuis la candidature si non fourni
    candidature = None
    if candidature_id_str and candidature_id_str.isdigit():
        try:
            candidature = Candidature.objects.get(pk=int(candidature_id_str))
            if score_declare is None:
                score_declare = float(candidature.score or 0) or None
        except Candidature.DoesNotExist:
            pass

    try:
        auditor = OCRDocumentAuditor()
        result = auditor.analyser_document(fichier, score_declare=score_declare)
    except Exception as exc:
        logger.error('OCR audit error: %s', exc)
        return Response({'error': f'Erreur OCR : {str(exc)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # ── Mise à jour flag_fraude ───────────────────────────────────────────────
    if candidature and result.get('flag_fraude'):
        candidature.flag_fraude = True
        candidature.save(update_fields=['flag_fraude'])

        # Notification pour le responsable
        try:
            from .models import Notification, MembreCommission
            responsables = MembreCommission.objects.filter(
                commission__master=candidature.master,
                est_responsable=True,
                actif=True,
            ).select_related('user')
            for mc in responsables:
                Notification.objects.create(
                    user=mc.user,
                    type_notification='alerte_fraude',
                    titre='⚠️ Alerte Fraude Détectée',
                    message=(
                        f'L\'OCR a détecté un écart de {result["delta"]:.2f} pts '
                        f'pour la candidature #{candidature.numero or candidature.id}. '
                        f'Score déclaré : {result["score_declare"]}, '
                        f'Score extrait : {result["score_extrait"]}.'
                    ),
                    candidature=candidature,
                    lu=False,
                )
        except Exception as notif_exc:
            logger.warning('Notification fraude échouée : %s', notif_exc)

    return Response({
        'score_extrait': result['score_extrait'],
        'score_declare': result['score_declare'],
        'delta': result['delta'],
        'flag_fraude': result['flag_fraude'],
        'confiance': result['confiance'],
        'moteur': result['moteur'],
        'sha256': result['sha256'],
        'anomalies': result['anomalies'],
        'texte_extrait_preview': (result.get('texte_extrait') or '')[:500],
    })
