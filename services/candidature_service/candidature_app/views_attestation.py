

import logging
import os

from django.conf import settings
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Candidature, MembreCommission
from .attestation_generator import ISIMMAttestationGenerator

logger = logging.getLogger(__name__)

# Parcours officiels (affichage dans les documents)
PARCOURS_OFFICIELS = {
    'MPDS':  'Mastère Professionnel en Sciences des Données',
    'MPGL':  'Mastère Professionnel en Génie Logiciel',
    'MP3I':  'Mastère Professionnel en Informatique Industrielle et IoT',
    'MRGL':  'Mastère de Recherche en Génie Logiciel',
    'MRMI':  'Mastère de Recherche en Modélisation et Intelligence Artificielle',
    'ING':   'Cycle d\'Ingénieur en Informatique',
}


def _get_logo_path() -> str | None:
    candidates = [
        os.path.join(settings.BASE_DIR, 'assets', 'images', 'logo-isimm.png'),
        os.path.join(settings.BASE_DIR, 'static', 'images', 'logo-isimm.png'),
        os.path.join(settings.BASE_DIR, 'media', 'logo-isimm.png'),
    ]
    return next((p for p in candidates if os.path.exists(p)), None)


def _check_commission_access(user, candidature) -> bool:
    """Vérifie que le membre a accès à cette candidature via sa commission."""
    role = getattr(user, 'role', None)
    if role == 'admin':
        return True
    if role not in ('responsable_commission', 'commission'):
        return False
    if role == 'responsable_commission':
        return True
    # Membre : vérifie l'appartenance via MembreCommission
    master = candidature.master
    if master is None:
        return False
    return MembreCommission.objects.filter(
        user=user,
        actif=True,
        commission__actif=True,
        commission__master=master,
    ).exists()


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/candidatures/<id>/generer-pdf/
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def generer_attestation_pdf(request, candidature_id: int):
    """
    Génère et retourne l'attestation PDF officielle ISIMM pour une candidature.

    Droits : admin | responsable_commission (tous) | commission (son master uniquement).
    Statuts autorisés : preselectionne, selectionne, admis, inscrit.
    Paramètre ?force=1 pour générer même si statut non final.
    """
    try:
        candidature = Candidature.objects.select_related(
            'candidat', 'master', 'concours',
        ).get(pk=candidature_id)
    except Candidature.DoesNotExist:
        return Response(
            {'error': 'Candidature introuvable.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    if not _check_commission_access(request.user, candidature):
        return Response(
            {'error': 'Accès refusé à cette candidature.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    statuts_attestation = {
        'preselectionne', 'selectionne', 'admis', 'inscrit',
        'dossier_depose', 'en_attente_dossier',
    }
    force = request.query_params.get('force', '').lower() in ('1', 'true', 'yes')
    if not force and candidature.statut not in statuts_attestation:
        return Response(
            {
                'error': (
                    f'Statut "{candidature.statut}" ne permet pas encore d\'attestation. '
                    'Ajoutez ?force=1 pour forcer.'
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Correction automatique du nom du master si "Demo" est présent
    if candidature.master and 'demo' in (candidature.master.nom or '').lower():
        _corriger_nom_master_demo(candidature.master)

    base_url = request.build_absolute_uri('/').rstrip('/')
    logo_path = _get_logo_path()
    media_root = getattr(settings, 'MEDIA_ROOT', None)

    try:
        generator = ISIMMAttestationGenerator()
        pdf_buf, filepath = generator.generate(
            candidature=candidature,
            base_url=base_url,
            logo_path=logo_path,
            media_root=str(media_root) if media_root else None,
        )
    except ImportError as exc:
        return Response(
            {'error': f'Bibliotheque manquante : {exc}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    except Exception as exc:
        logger.exception('Erreur generation attestation candidature %s', candidature_id)
        return Response(
            {'error': f'Erreur generation PDF : {exc}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    nom   = getattr(candidature.candidat, 'last_name', '') or ''
    prenom = getattr(candidature.candidat, 'first_name', '') or ''
    numero = getattr(candidature, 'numero', '') or str(candidature_id)
    safe  = f'{nom}_{prenom}'.replace(' ', '_')
    filename = f'ISIMM_Attestation_{safe}_{numero}.pdf'

    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    response['X-Filepath'] = filepath or ''
    response.write(pdf_buf.read())
    return response


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/candidatures/<id>/analyser-ocr/
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def analyser_ocr_candidature(request, candidature_id: int):
    """
    Lance l'analyse OCR RÉELLE (pdfplumber + Req-3) sur un document et met à jour
    le champ note_extraite_ocr de la candidature.

    Body (multipart/form-data) :
        fichier        : fichier image ou PDF du relevé de notes (optionnel)
        update_score   : '1' pour écraser aussi le champ score (défaut: non)

    Si aucun fichier n'est fourni, utilise le premier document du dossier.
    """
    from .ocr_service import OCRService
    import tempfile
    import shutil

    try:
        candidature = Candidature.objects.select_related(
            'candidat', 'master',
        ).get(pk=candidature_id)
    except Candidature.DoesNotExist:
        return Response(
            {'error': 'Candidature introuvable.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    if not _check_commission_access(request.user, candidature):
        return Response(
            {'error': 'Accès refusé.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    fichier = request.FILES.get('fichier')

    # Si pas de fichier fourni, tente de récupérer depuis le dossier
    if fichier is None:
        fichier = _get_premier_document_candidature(candidature)
        if fichier is None:
            return Response(
                {'error': 'Aucun fichier fourni et aucun document disponible dans le dossier.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    score_declare = float(candidature.score or 0) or None

    try:
        pdf_path = None
        if isinstance(fichier, str):
            pdf_path = str(fichier)
        else:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
                for chunk in fichier.chunks():
                    tmp.write(chunk)
                pdf_path = tmp.name

        result = OCRService.analyser_releve_complet(pdf_path, score_declare)

        if not isinstance(fichier, str):
            try:
                os.unlink(pdf_path)
            except Exception:
                pass

    except Exception as exc:
        logger.exception('OCR analyse candidature %s', candidature_id)
        return Response(
            {'error': f'Erreur OCR : {exc}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # ── Mise à jour de la candidature ─────────────────────────────────────────
    update_score = request.data.get('update_score', '').lower() in ('1', 'true', 'yes')
    fields_updated = []

    score_extrait = result.get('score_extrait')
    if score_extrait is not None:
        candidature.note_extraite_ocr = score_extrait
        fields_updated.append('note_extraite_ocr')

        if update_score:
            candidature.score = score_extrait
            fields_updated.append('score')

    if result.get('alerte'):
        candidature.flag_fraude = True
        fields_updated.append('flag_fraude')

    if fields_updated:
        candidature.save(update_fields=fields_updated)

    return Response({
        'candidature_id':      candidature_id,
        'numero':              candidature.numero or str(candidature_id),
        'score_extrait':       result.get('score_extrait'),
        'score_declare':       result.get('score_declare'),
        'ecart':               result.get('ecart'),
        'confiance':           result.get('confiance'),
        'moteur':              result.get('moteur'),
        'statut':              result.get('statut'),
        'alerte':              result.get('alerte'),
        'anomalies':           result.get('anomalies', []),
        # ✅ Détail des notes extraites (L1/L2/L3 + M.G/B.N.R/B.S.P + score recalculé)
        'detail_notes':        result.get('detail_notes'),
        'texte_extrait':       (result.get('texte_extrait') or '')[:500],
        'fields_updated':      fields_updated,
        'note_extraite_ocr':   float(candidature.note_extraite_ocr or 0),
    })


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/candidatures/ocr/extract/   (v4 §7)
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def ocr_extract(request):
    """
    v4 §7 — Extrait la spécialité + le type de diplôme d'un relevé de notes
    (PDF ou image) et les compare avec ce que le candidat a déclaré.

    Body (multipart/form-data) :
        fichier               : PDF ou image du relevé de notes (obligatoire)
        specialite_declaree   : spécialité déclarée dans le formulaire (optionnel)
        type_diplome_declare  : 'licence' | 'maitrise' (optionnel)

    Retour : { specialite_detectee, type_diplome_detecte,
               correspondance_specialite, correspondance_type, alerte, texte_brut }
    """
    from .ocr_service import OCRService
    import tempfile

    fichier = request.FILES.get('fichier')
    if not fichier:
        return Response({'erreur': 'Aucun fichier fourni'}, status=status.HTTP_400_BAD_REQUEST)

    specialite_declaree = request.data.get('specialite_declaree', '') or ''
    type_diplome_declare = request.data.get('type_diplome_declare', '') or ''

    content_type = (getattr(fichier, 'content_type', '') or '').lower()
    name_lower = (getattr(fichier, 'name', '') or '').lower()
    is_pdf = 'pdf' in content_type or name_lower.endswith('.pdf')
    suffix = '.pdf' if is_pdf else (os.path.splitext(name_lower)[1] or '.png')

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            for chunk in fichier.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name

        result = OCRService.analyser_specialite_type_diplome(
            tmp_path,
            specialite_declaree=specialite_declaree,
            type_diplome_declare=type_diplome_declare,
            is_pdf=is_pdf,
        )
    except Exception as exc:
        logger.exception('OCR extract specialite/diplome')
        return Response(
            {'erreur': f'Erreur OCR : {exc}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

    return Response(result)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_premier_document_candidature(candidature):
    """Retourne le premier fichier de document associé à la candidature."""
    try:
        from .models import Document
        doc = (
            Document.objects
            .filter(candidature=candidature)
            .exclude(fichier='')
            .order_by('uploaded_at')
            .first()
        )
        if doc and doc.fichier:
            return doc.fichier
    except Exception:
        pass
    return None


def _corriger_nom_master_demo(master) -> None:
    """Corrige automatiquement les noms de master de démonstration."""
    _corrections = {
        'data science':               'Mastère Professionnel en Sciences des Données (MPDS)',
        'génie logiciel':             'Mastère Professionnel en Génie Logiciel (MPGL)',
        'informatique industrielle':  'Mastère Professionnel en Informatique Industrielle et IoT (MP3I)',
        'réseaux':                    'Mastère Professionnel en Réseaux, Sécurité et Cloud (MP3I)',
        'recherche logiciel':         'Mastère de Recherche en Génie Logiciel (MRGL)',
        'recherche intelligence':     'Mastère de Recherche en Modélisation et Intelligence Artificielle (MRMI)',
        'cycle ingenieur':            'Cycle d\'Ingénieur en Informatique',
        'cycle ingénieur':            'Cycle d\'Ingénieur en Informatique',
    }
    nom_lower = (master.nom or '').lower()
    for keyword, nom_officiel in _corrections.items():
        if keyword in nom_lower:
            master.nom = nom_officiel
            if 'demo' in (master.specialite or '').lower():
                master.specialite = master.specialite.replace(' Demo', '').replace(' demo', '').strip()
            try:
                master.save(update_fields=['nom', 'specialite'])
            except Exception:
                pass
            break
