# -*- coding: utf-8 -*-
"""
Routes montées sous /api/commission/ — espace membre de commission.
"""
from django.urls import path
from . import views_commission_membre

urlpatterns = [
    # Commission principale du membre connecté (PARTIE A)
    path('ma-commission-membre/', views_commission_membre.ma_commission_membre,
         name='ma_commission_membre'),
    # Toutes les commissions du membre (multi-commissions)
    path('mes-commissions-membre/', views_commission_membre.mes_commissions_membre,
         name='mes_commissions_membre_alias'),
    # Candidatures d'une commission donnée (PARTIE C)
    path('candidatures/<int:commission_id>/',
         views_commission_membre.get_candidatures_by_commission,
         name='candidatures_par_commission_alias'),
]
