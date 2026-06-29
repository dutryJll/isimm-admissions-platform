# -*- coding: utf-8 -*-
"""
Endpoints pour les membres de commission
"""

import logging
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from candidature_app.models import MembreCommission, Candidature, Commission

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mes_commissions_membre(request):
    """
    Récupère TOUTES les commissions du membre connecté.

    Réponse:
        {
            "success": true,
            "count": 2,
            "commissions": [
                {"id": 1, "nom": "Commission - Master Génie Logiciel", "master_id": 5},
                {"id": 2, "nom": "Commission - Master Big Data", "master_id": 6}
            ]
        }
    """
    try:
        membre_commissions = MembreCommission.objects.filter(
            user=request.user,
            actif=True
        ).select_related('commission', 'commission__master')

        commissions = []
        for mc in membre_commissions:
            commissions.append({
                'id': mc.commission.id,
                'nom': mc.commission.nom,
                'master_id': mc.commission.master.id if mc.commission.master else None,
                'master_nom': mc.commission.master.nom if mc.commission.master else None,
                'role': mc.role,
            })

        return Response({
            'success': True,
            'count': len(commissions),
            'commissions': commissions,
        })

    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ma_commission_principale_membre(request):
    """
    Récupère la commission PRINCIPALE du membre (la première).

    Réponse:
        {
            "success": true,
            "commission": {
                "id": 1,
                "nom": "Commission - Master Génie Logiciel",
                "master_id": 5,
                "master_nom": "Master Génie Logiciel et Systèmes d'Information"
            }
        }
    """
    try:
        membre_commission = MembreCommission.objects.filter(
            user=request.user,
            actif=True
        ).select_related('commission', 'commission__master').first()

        if not membre_commission:
            return Response({
                'success': False,
                'message': 'Aucune commission assignée'
            }, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'success': True,
            'commission': {
                'id': membre_commission.commission.id,
                'nom': membre_commission.commission.nom,
                'master_id': membre_commission.commission.master.id if membre_commission.commission.master else None,
                'master_nom': membre_commission.commission.master.nom if membre_commission.commission.master else None,
                'role': membre_commission.role,
            }
        })

    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ma_commission_membre(request):
    """
    GET /api/commission/ma-commission-membre/

    Retourne LA commission (principale) du membre connecté.

    Réponse 200 : { "id", "nom", "specialite", "master_id", "master_nom" }
    Réponse 404 : { "detail": "Aucune commission assignée" }
    """
    mc = (
        MembreCommission.objects
        .filter(user=request.user, actif=True, commission__actif=True)
        .select_related('commission', 'commission__master')
        .first()
    )

    if not mc or not mc.commission:
        return Response(
            {'detail': 'Aucune commission assignée'},
            status=status.HTTP_404_NOT_FOUND,
        )

    commission = mc.commission
    master = commission.master
    return Response({
        'id': commission.id,
        'nom': commission.nom,
        'specialite': (master.specialite if master else '') or (master.nom if master else ''),
        'master_id': master.id if master else None,
        'master_nom': master.nom if master else None,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_candidatures_by_commission(request, commission_id):
    """
    GET /api/candidatures/par-commission/<commission_id>/

    Retourne les candidatures associées à une commission spécifique.
    Le membre doit être assigné à cette commission.

    Réponse:
        {
            "success": true,
            "commission_id": 1,
            "commission_nom": "Commission - Master GL",
            "count": 15,
            "candidatures": [...]
        }
    """
    try:
        # Vérifier que le membre fait partie de cette commission
        membre = MembreCommission.objects.filter(
            user=request.user,
            commission_id=commission_id,
            actif=True
        ).first()

        if not membre:
            return Response({
                'error': 'Accès refusé à cette commission'
            }, status=status.HTTP_403_FORBIDDEN)

        # Récupérer la commission
        try:
            commission = Commission.objects.get(id=commission_id, actif=True)
        except Commission.DoesNotExist:
            return Response({
                'error': 'Commission non trouvée'
            }, status=status.HTTP_404_NOT_FOUND)

        # Récupérer TOUTES les candidatures du master de cette commission
        # (le membre examine l'ensemble des candidatures de son parcours)
        candidatures = (
            Candidature.objects
            .filter(master=commission.master)
            .select_related('master', 'candidat')
            .order_by('-score')
        )

        # Payload riche (mêmes champs que /responsable/candidatures/) pour le tableau membre
        try:
            from candidature_app.views import _extract_specialite_diplome
        except Exception:
            _extract_specialite_diplome = lambda c: ''

        payload = []
        for c in candidatures:
            payload.append({
                'id': c.id,
                'numero': c.numero,
                'candidat_nom': c.candidat.get_full_name() if c.candidat else '',
                'candidat_email': c.candidat.email if c.candidat else '',
                'candidat_cin': getattr(c.candidat, 'cin', ''),
                'specialite': c.master.specialite if c.master else '',
                'specialite_diplome': _extract_specialite_diplome(c),
                'master_id': c.master_id,
                'master_nom': c.master.nom if c.master else '',
                'score': c.score,
                'classement': c.classement or 0,
                'dossier_depose': c.dossier_depose,
                'statut': c.statut,
                'statut_inscription': c.statut_inscription,
                'numero_inscription': c.numero_inscription,
                'type_concours': 'ingenieur' if c.concours_id else 'masters',
                'date_soumission': c.date_soumission,
                'date_changement_statut': c.date_changement_statut,
            })

        return Response({
            'success': True,
            'commission_id': commission_id,
            'commission_nom': commission.nom,
            'count': len(payload),
            'candidatures': payload,
        })

    except Exception as e:
        logger.exception("Erreur get_candidatures_by_commission pour commission %s", commission_id)
        return Response({
            'error': f'Erreur serveur: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
