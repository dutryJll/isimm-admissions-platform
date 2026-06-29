"""
Test script pour les APIs de spécialités dynamiques.
Test les endpoints:
  - GET /api/specialites/by-parcours/?parcours_code=MPDS
  - GET /api/parcours/all/
  - GET /api/parcours/all/?type_formation=master
"""

import requests
import json
from tabulate import tabulate

BASE_URL = "http://127.0.0.1:8003"
API_BASE = f"{BASE_URL}/api"

def test_get_specialites_by_parcours():
    """Test GET /api/specialites/by-parcours/?parcours_code=MPDS"""
    print("\n" + "="*80)
    print("TEST 1: GET /api/specialites/by-parcours/?parcours_code=MPDS")
    print("="*80)
    
    try:
        response = requests.get(
            f"{API_BASE}/specialites/by-parcours/",
            params={'parcours_code': 'MPDS'}
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Succès!")
            print(f"\nDonnées reçues:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            
            # Afficher les spécialités dans un tableau
            specialites_table = [
                [s.get('nom', 'N/A'), s.get('abreviation', 'N/A')]
                for s in data.get('specialites', [])
            ]
            print(f"\nSpécialités pour {data.get('nom_parcours')}:")
            print(tabulate(specialites_table, headers=['Nom', 'Abréviation'], tablefmt='grid'))
        else:
            print(f"❌ Erreur: {response.text}")
            
    except Exception as e:
        print(f"❌ Erreur de connexion: {e}")


def test_list_all_parcours():
    """Test GET /api/parcours/all/"""
    print("\n" + "="*80)
    print("TEST 2: GET /api/parcours/all/")
    print("="*80)
    
    try:
        response = requests.get(f"{API_BASE}/parcours/all/")
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Succès!")
            print(f"Nombre de parcours: {len(data)}")
            
            # Afficher dans un tableau
            parcours_table = [
                [
                    p.get('code_parcours', 'N/A'),
                    p.get('nom_parcours', 'N/A'),
                    p.get('type_formation', 'N/A'),
                    p.get('nombre_specialites', 0)
                ]
                for p in data
            ]
            print(tabulate(
                parcours_table,
                headers=['Code', 'Nom Parcours', 'Type', 'Nb Spécialités'],
                tablefmt='grid'
            ))
        else:
            print(f"❌ Erreur: {response.text}")
            
    except Exception as e:
        print(f"❌ Erreur de connexion: {e}")


def test_list_all_parcours_filtered():
    """Test GET /api/parcours/all/?type_formation=master"""
    print("\n" + "="*80)
    print("TEST 3: GET /api/parcours/all/?type_formation=master")
    print("="*80)
    
    try:
        response = requests.get(
            f"{API_BASE}/parcours/all/",
            params={'type_formation': 'master'}
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Succès!")
            print(f"Nombre de parcours Masters: {len(data)}")
            
            # Afficher dans un tableau
            parcours_table = [
                [
                    p.get('code_parcours', 'N/A'),
                    p.get('nom_parcours', 'N/A'),
                    p.get('nombre_specialites', 0)
                ]
                for p in data
            ]
            print(tabulate(
                parcours_table,
                headers=['Code', 'Nom Parcours', 'Nb Spécialités'],
                tablefmt='grid'
            ))
        else:
            print(f"❌ Erreur: {response.text}")
            
    except Exception as e:
        print(f"❌ Erreur de connexion: {e}")


def test_all_parcours_specialites():
    """Test récupération des spécialités pour chaque parcours"""
    print("\n" + "="*80)
    print("TEST 4: Récupération de toutes les spécialités par parcours")
    print("="*80)
    
    try:
        # D'abord, récupère tous les parcours
        response = requests.get(f"{API_BASE}/parcours/all/")
        
        if response.status_code != 200:
            print(f"❌ Erreur lors de la récupération des parcours: {response.text}")
            return
        
        parcours_list = response.json()
        
        print(f"✅ {len(parcours_list)} parcours trouvés\n")
        
        for parcours in parcours_list:
            code = parcours.get('code_parcours')
            nom = parcours.get('nom_parcours')
            
            # Récupère les spécialités pour ce parcours
            resp_spec = requests.get(
                f"{API_BASE}/specialites/by-parcours/",
                params={'parcours_code': code}
            )
            
            if resp_spec.status_code == 200:
                spec_data = resp_spec.json()
                specialites = spec_data.get('specialites', [])
                
                print(f"📚 {nom} ({code})")
                for spec in specialites:
                    print(f"   • {spec.get('nom')}")
                print()
            else:
                print(f"❌ Erreur pour {code}: {resp_spec.text}\n")
                
    except Exception as e:
        print(f"❌ Erreur de connexion: {e}")


if __name__ == '__main__':
    print("\n" + "🧪 TESTS DES APIs SPÉCIALITÉS DYNAMIQUES")
    print("=" * 80)
    
    # Vérifier la connexion au serveur
    try:
        response = requests.get(f"{BASE_URL}/api/masters/", timeout=5)
        print(f"✅ Serveur accessible sur {BASE_URL}")
    except requests.exceptions.ConnectionError:
        print(f"❌ Impossible de se connecter à {BASE_URL}")
        print("Assurez-vous que le serveur est en cours d'exécution:")
        print("  cd candidature_service && python manage.py runserver 8003")
        exit(1)
    
    # Exécute les tests
    test_get_specialites_by_parcours()
    test_list_all_parcours()
    test_list_all_parcours_filtered()
    test_all_parcours_specialites()
    
    print("\n" + "="*80)
    print("✅ TESTS COMPLÉTÉS")
    print("="*80 + "\n")
