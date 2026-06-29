#!/usr/bin/env python
"""Quick test of the scoring engine."""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'candidature_service.settings')
django.setup()

from candidature_app.models import Master, ParcoursAdmission

# Get an active master
master = Master.objects.filter(actif=True).first()
if not master:
    print('No active masters found.')
    exit(1)

print(f'Testing scoring with master: {master.nom} (ID={master.id})')

# Sample payloads
payload_pro = {
    'glDs': {'moy1': 14.0, 'moy2': 15.0, 'moy3': 13.0},
    'common': {'redoublements': 0, 'session': 'principale', 'rattrapages': 0}
}

payload_recherche = {
    'mrglLicence': {'moy1': 15.0, 'moy2': 16.0, 'moy3': 14.0},
    'common': {'redoublements': 0, 'session': 'principale', 'rattrapages': 0},
    'moyenne_bac': 14.0, 'noteMathBac': 16.0,
    'note_fr': 14.0, 'note_ang': 12.0, 'certif_b2': False,
    'annee_diplome': 2025
}

payload_ing = {
    'moy1': 15.0, 'moy2': 14.0, 'moy3': 13.0,
    'rang1': 5.0, 'rang2': 3.0,
    'nombre_etudiants': 100,
    'common': {'redoublements': 0, 'session': 'principale'}
}

test_payloads = [
    ('Master Pro (GL/DS)', payload_pro),
    ('Master Recherche (MRGL)', payload_recherche),
    ('Cycle Ingenieur (Externe)', payload_ing)
]

print('\nScoring Results:')
for name, payload in test_payloads:
    try:
        if hasattr(master, 'parcours_admissions'):
            parcours = master.parcours_admissions.filter(actif=True).first()
            if parcours:
                score = parcours.calculer_score(payload)
                print(f'  ✓ {name}: score={score}')
            else:
                print(f'  - {name}: no active parcours configured')
        else:
            print(f'  - {name}: master has no parcours_admissions attr')
    except Exception as e:
        print(f'  ✗ {name}: {str(e)[:80]}')

print('\n✓ Scoring engine test complete.')
