#!/usr/bin/env python
"""
Validation Script for Specialites Dynamiques APIs (ÉTAPE 1)
Teste les endpoints:
  - GET /api/candidatures/specialites/by-parcours/?parcours_code=MPDS
  - GET /api/candidatures/parcours/all/
  - GET /api/candidatures/parcours/all/?type_formation=master
"""

import requests
import sys

API_BASE = "http://127.0.0.1:8003/api/candidatures"
TESTS_PASSED = 0
TESTS_FAILED = 0

def print_header(title):
    print(f"\n{'='*80}")
    print(f"🧪 {title}")
    print(f"{'='*80}")

def test_1_specialites_by_code():
    """Test 1: GET /api/candidatures/specialites/by-parcours/?parcours_code=MPDS"""
    print_header("TEST 1: Récupérer spécialités par code de parcours (MPDS)")
    
    global TESTS_PASSED, TESTS_FAILED
    
    try:
        url = f"{API_BASE}/specialites/by-parcours/"
        params = {'parcours_code': 'MPDS'}
        
        print(f"🔗 URL: {url}")
        print(f"📝 Params: {params}")
        
        response = requests.get(url, params=params, timeout=5)
        
        print(f"✓ Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"✅ SUCCÈS!")
            print(f"\n📊 Données reçues:")
            print(f"   Code: {data.get('code_parcours')}")
            print(f"   Nom: {data.get('nom_parcours')}")
            print(f"   Type: {data.get('type_formation')}")
            print(f"   Spécialités ({len(data.get('specialites', []))} trouvées):")
            
            for spec in data.get('specialites', []):
                print(f"      • {spec.get('nom')} ({spec.get('abreviation')})")
            
            TESTS_PASSED += 1
            return True
        else:
            print(f"❌ ERREUR HTTP {response.status_code}")
            print(f"Response: {response.text}")
            TESTS_FAILED += 1
            return False
            
    except Exception as e:
        print(f"❌ ERREUR: {e}")
        TESTS_FAILED += 1
        return False


def test_2_list_all_parcours():
    """Test 2: GET /api/candidatures/parcours/all/"""
    print_header("TEST 2: Lister tous les parcours")
    
    global TESTS_PASSED, TESTS_FAILED
    
    try:
        url = f"{API_BASE}/parcours/all/"
        
        print(f"🔗 URL: {url}")
        
        response = requests.get(url, timeout=5)
        
        print(f"✓ Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"✅ SUCCÈS!")
            print(f"\n📊 {len(data)} parcours trouvés:")
            
            for p in data:
                code = p.get('code_parcours')
                nom = p.get('nom_parcours')
                type_form = p.get('type_formation')
                nb_specs = p.get('nombre_specialites', 0)
                print(f"   • {code} | {nom} ({type_form}) | {nb_specs} spécialités")
            
            TESTS_PASSED += 1
            return True
        else:
            print(f"❌ ERREUR HTTP {response.status_code}")
            print(f"Response: {response.text}")
            TESTS_FAILED += 1
            return False
            
    except Exception as e:
        print(f"❌ ERREUR: {e}")
        TESTS_FAILED += 1
        return False


def test_3_list_masters_only():
    """Test 3: GET /api/candidatures/parcours/all/?type_formation=master"""
    print_header("TEST 3: Lister les parcours filtrés (Masters uniquement)")
    
    global TESTS_PASSED, TESTS_FAILED
    
    try:
        url = f"{API_BASE}/parcours/all/"
        params = {'type_formation': 'master'}
        
        print(f"🔗 URL: {url}")
        print(f"📝 Params: {params}")
        
        response = requests.get(url, params=params, timeout=5)
        
        print(f"✓ Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Vérifier que seuls les Masters sont retournés
            non_masters = [p for p in data if p.get('type_formation') != 'master']
            
            print(f"✅ SUCCÈS!")
            print(f"\n📊 {len(data)} Masters trouvés:")
            
            for p in data:
                code = p.get('code_parcours')
                nom = p.get('nom_parcours')
                nb_specs = p.get('nombre_specialites', 0)
                print(f"   • {code} | {nom} | {nb_specs} spécialités")
            
            if non_masters:
                print(f"\n⚠️ ATTENTION: {len(non_masters)} non-Masters trouvés (filtre pas appliqué)")
                TESTS_FAILED += 1
                return False
            
            TESTS_PASSED += 1
            return True
        else:
            print(f"❌ ERREUR HTTP {response.status_code}")
            print(f"Response: {response.text}")
            TESTS_FAILED += 1
            return False
            
    except Exception as e:
        print(f"❌ ERREUR: {e}")
        TESTS_FAILED += 1
        return False


def test_4_verify_all_specialites():
    """Test 4: Vérifier que chaque parcours a au moins une spécialité"""
    print_header("TEST 4: Vérifier intégrité des données (chaque parcours a des spécialités)")
    
    global TESTS_PASSED, TESTS_FAILED
    
    try:
        url = f"{API_BASE}/parcours/all/"
        response = requests.get(url, timeout=5)
        
        if response.status_code != 200:
            print(f"❌ ERREUR HTTP {response.status_code}")
            TESTS_FAILED += 1
            return False
        
        parcours_list = response.json()
        problemes = []
        
        print(f"📊 Vérification de {len(parcours_list)} parcours...")
        
        for p in parcours_list:
            code = p.get('code_parcours')
            nom = p.get('nom_parcours')
            nb_specs = p.get('nombre_specialites', 0)
            
            if nb_specs == 0:
                problemes.append(f"   ❌ {code}: 0 spécialités trouvées")
            else:
                print(f"   ✓ {code}: {nb_specs} spécialités")
        
        if problemes:
            print(f"\n❌ ERREURS DÉTECTÉES:")
            for prob in problemes:
                print(prob)
            TESTS_FAILED += 1
            return False
        
        print(f"\n✅ SUCCÈS! Tous les parcours ont des spécialités.")
        TESTS_PASSED += 1
        return True
        
    except Exception as e:
        print(f"❌ ERREUR: {e}")
        TESTS_FAILED += 1
        return False


def main():
    """Exécute tous les tests"""
    
    print(f"\n{'#'*80}")
    print(f"# 🎯 VALIDATION ÉTAPE 1: SPÉCIALITÉS DYNAMIQUES")
    print(f"{'#'*80}")
    
    # Vérifier que le serveur est accessible
    print("\n⏳ Vérification de la connexion au serveur...")
    try:
        response = requests.get(f"{API_BASE}/masters/", timeout=5)
        print(f"✅ Serveur accessible sur {API_BASE}")
    except requests.exceptions.ConnectionError:
        print(f"\n❌ ERREUR: Impossible de se connecter à {API_BASE}")
        print(f"Assurez-vous que le serveur candidature_service est en cours d'exécution:")
        print(f"  cd c:\\Users\\HP\\Desktop\\PFE\\isimm-platform\\services\\candidature_service")
        print(f"  .venv\\Scripts\\Activate.ps1")
        print(f"  python manage.py runserver 8003")
        sys.exit(1)
    except Exception as e:
        print(f"⚠️  Erreur de vérification: {e}")
    
    # Exécuter tous les tests
    test_1_specialites_by_code()
    test_2_list_all_parcours()
    test_3_list_masters_only()
    test_4_verify_all_specialites()
    
    # Résumé final
    print(f"\n{'='*80}")
    print(f"📊 RÉSUMÉ DES TESTS")
    print(f"{'='*80}")
    print(f"✅ Tests réussis: {TESTS_PASSED}")
    print(f"❌ Tests échoués: {TESTS_FAILED}")
    print(f"📈 Total: {TESTS_PASSED + TESTS_FAILED}")
    
    if TESTS_FAILED == 0:
        print(f"\n🎉 VALIDATION ÉTAPE 1 COMPLÈTE!")
        print(f"Prêt pour ÉTAPE 2: Système de Statut + Notifications")
        return 0
    else:
        print(f"\n⚠️  Certains tests ont échoué. Vérifiez les erreurs ci-dessus.")
        return 1


if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)
