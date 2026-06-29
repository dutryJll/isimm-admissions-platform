#!/usr/bin/env python
"""Test des endpoints CRUD Parcours."""

import os
import django
import requests
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'candidature_service.settings')
django.setup()

from candidature_app.models import Master, ParcoursAdmission, ValeurCritere

# Test 1: Lister les parcours
print('=== Test 1: Lister les parcours ===')
resp = requests.get('http://127.0.0.1:8003/api/candidatures/parcours/')
print(f'Status: {resp.status_code}')
if resp.status_code == 200:
    data = resp.json()
    print(f'Parcours found: {len(data) if isinstance(data, list) else "single"}')
else:
    print(f'Response: {resp.text[:200]}')

# Test 2: Créer un parcours
print('\n=== Test 2: Créer un parcours ===')
master = Master.objects.filter(actif=True).first()
if not master:
    print('ERROR: No active master found')
    exit(1)

parcours_data = {
    'master': master.id,
    'nom': 'Parcours Master Data Science 2026',
    'type': 'pro',
    'specialite': 'Data Science',
    'capacite': 25,
    'date_limite': '2026-06-30',
    'statut': 'brouillon'
}

resp = requests.post('http://127.0.0.1:8003/api/candidatures/parcours/',
                     json=parcours_data)
print(f'Status: {resp.status_code}')
if resp.status_code in [200, 201]:
    result = resp.json()
    print(f'Created: {result.get("nom")}')
    print(f'ID: {result.get("id")}')
    parcours_id = result.get('id')
    
    # Test 3: Vérifier les ValeurCritere créées automatiquement
    print('\n=== Test 3: ValeurCritere créées automatiquement ===')
    parcours = ParcoursAdmission.objects.get(id=parcours_id)
    valeurs = parcours.valeurs.all()
    print(f'Nombre de critères: {valeurs.count()}')
    for v in valeurs:
        print(f'  - {v.critere.label} (coef: {v.coefficient})')
else:
    print(f'Error: {resp.text[:500]}')

print('\n✓ Tests complétés')
