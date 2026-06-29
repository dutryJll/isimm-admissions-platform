#!/bin/bash
# Script complet d'exécution et test - Dépôt de dossier Sprint 2
# Utilisation: bash run_depot_dossier.sh

set -e

echo "═══════════════════════════════════════════════════════════════════"
echo "  🚀 DÉMARRAGE COMPLET - DÉPÔT DE DOSSIER SPRINT 2"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# ============================================================================
# 1. VÉRIFICATIONS PRÉALABLES
# ============================================================================

echo "✓ [1/8] Vérification des prérequis..."

# Vérifier Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 n'est pas installé"
    exit 1
fi

# Vérifier tesseract
if ! command -v tesseract &> /dev/null; then
    echo "⚠️  Tesseract OCR n'est pas installé"
    echo "   Installation: sudo apt-get install tesseract-ocr"
fi

# Vérifier redis
if ! command -v redis-cli &> /dev/null; then
    echo "⚠️  Redis n'est pas installé"
    echo "   Installation: sudo apt-get install redis-server"
fi

echo "   ✓ Prérequis vérifiés"
echo ""

# ============================================================================
# 2. INITIALISER L'ENVIRONNEMENT PYTHON
# ============================================================================

echo "✓ [2/8] Initialisation de l'environnement Python..."

cd "$(dirname "$0")"
VENV_PATH=".venv"

if [ ! -d "$VENV_PATH" ]; then
    echo "  Création du virtual environment..."
    python3 -m venv $VENV_PATH
fi

# Activer venv
source $VENV_PATH/bin/activate

# Installer les dépendances
pip install --upgrade pip > /dev/null 2>&1
pip install -q -r requirements_depot_dossier.txt

echo "   ✓ Environnement prêt"
echo ""

# ============================================================================
# 3. MIGRATIONS DJANGO
# ============================================================================

echo "✓ [3/8] Migrations de base de données..."

# Créer les migrations
python manage.py makemigrations candidature_app --noinput

# Appliquer les migrations
python manage.py migrate --noinput

# Charger les fixtures de test
if [ -f "fixtures/test_data.json" ]; then
    python manage.py loaddata fixtures/test_data.json --ignore-errors
fi

echo "   ✓ Base de données à jour"
echo ""

# ============================================================================
# 4. CRÉER UN SUPERUSER DE TEST
# ============================================================================

echo "✓ [4/8] Configuration utilisateurs de test..."

# Créer superuser
python manage.py shell << END
from django.contrib.auth import get_user_model
User = get_user_model()

if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@test.com', 'admin123')
    print("  ✓ Superuser créé (admin/admin123)")

# Créer un candidat de test
if not User.objects.filter(username='candidat_test').exists():
    candidat = User.objects.create_user(
        username='candidat_test',
        email='candidat@test.com',
        password='test123',
        first_name='Jean',
        last_name='Dupont'
    )
    print("  ✓ Candidat de test créé (candidat_test/test123)")

print("  ✓ Utilisateurs de test configurés")
END

echo ""

# ============================================================================
# 5. INITIALISER LES DONNÉES DE TEST
# ============================================================================

echo "✓ [5/8] Initialisation des données de test..."

python manage.py shell << 'END'
from datetime import timedelta
from django.utils import timezone
from candidature_app.models import Master, DocumentType, CommissionAppel
from django.contrib.auth import get_user_model

User = get_user_model()

# Créer un master de test
master, created = Master.objects.get_or_create(
    nom='Master Informatique Test',
    defaults={
        'type_master': 'professionnel',
        'specialite': 'Informatique',
        'places_disponibles': 30,
        'date_limite_candidature': timezone.now().date() + timedelta(days=30),
        'annee_universitaire': '2024-2025',
        'actif': True
    }
)

if created:
    print(f"  ✓ Master créé: {master.nom}")

# Créer types de documents
doc_types = [
    ('cv', True),
    ('diplome', True),
    ('releve_notes', True),
    ('lettre_motivation', True),
]

for doc_type, obligatoire in doc_types:
    dt, created = DocumentType.objects.get_or_create(
        master=master,
        type_document=doc_type,
        defaults={
            'obligatoire': obligatoire,
            'taille_max_mb': 5 if doc_type == 'cv' else 10,
            'formats_acceptes': ['pdf', 'jpg', 'jpeg'],
        }
    )
    if created:
        print(f"  ✓ Type document créé: {doc_type}")

print("  ✓ Données de test initialisées")
END

echo ""

# ============================================================================
# 6. LANCER LES TESTS
# ============================================================================

echo "✓ [6/8] Exécution des tests..."
echo ""

# Tests unitaires
echo "  🧪 Tests unitaires..."
python manage.py test candidature_app.tests_depot_dossier.DocumentModelTest -v 2
python manage.py test candidature_app.tests_depot_dossier.DossierModelTest -v 2

echo ""
echo "  🧪 Tests d'intégration..."
python manage.py test candidature_app.tests_depot_dossier.DepotDossierIntegrationTest -v 2

# Coverage
echo ""
echo "  📊 Calcul de coverage..."
coverage run --source='candidature_app' manage.py test candidature_app.tests_depot_dossier --quiet
coverage report --fail-under=85
coverage html

echo "   ✓ Rapport coverage: htmlcov/index.html"
echo ""

# ============================================================================
# 7. LANCER LES SERVICES
# ============================================================================

echo "✓ [7/8] Lancement des services en arrière-plan..."

# Vérifier si Redis tourne
if redis-cli ping > /dev/null 2>&1; then
    echo "  ✓ Redis est en cours d'exécution"
else
    echo "  ⚠️  Redis n'est pas connecté"
    echo "    Démarrer Redis: redis-server"
fi

# Lancer Celery Worker en arrière-plan
nohup celery -A candidature_service worker -l info > celery_worker.log 2>&1 &
WORKER_PID=$!
echo "  ✓ Celery Worker démarré (PID: $WORKER_PID)"

# Lancer Celery Beat en arrière-plan
nohup celery -A candidature_service beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler > celery_beat.log 2>&1 &
BEAT_PID=$!
echo "  ✓ Celery Beat démarré (PID: $BEAT_PID)"

# Sauvegarder les PIDs
echo "$WORKER_PID" > celery_worker.pid
echo "$BEAT_PID" > celery_beat.pid

echo ""

# ============================================================================
# 8. LANCER LE SERVEUR DJANGO
# ============================================================================

echo "✓ [8/8] Démarrage du serveur Django..."
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  ✅ DÉMARRAGE COMPLET RÉUSSI!"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "📊 SERVICES EN EXÉCUTION:"
echo "  • Django API: http://localhost:8003/"
echo "  • API Admin: http://localhost:8003/admin/"
echo "  • Celery Worker: en arrière-plan (celery_worker.log)"
echo "  • Celery Beat: en arrière-plan (celery_beat.log)"
echo "  • Coverage Report: htmlcov/index.html"
echo ""
echo "🧪 UTILISATEURS DE TEST:"
echo "  • Superuser: admin / admin123"
echo "  • Candidat: candidat_test / test123"
echo ""
echo "📝 ENDPOINTS DISPONIBLES:"
echo "  • GET  /api/dossier/requetes/{candidature_id}/"
echo "  • POST /api/dossier/upload/{candidature_id}/"
echo "  • GET  /api/dossier/dossier/{candidature_id}/"
echo "  • POST /api/dossier/soumettre/{candidature_id}/"
echo "  • GET  /api/dossier/mes-dossiers/"
echo ""
echo "📖 DOCUMENTATION:"
echo "  • Guide complet: SPRINT2_DEPOT_DOSSIER_GUIDE.md"
echo "  • Résumé: DEPOT_DOSSIER_SPRINT2_RESUME.md"
echo "  • Configuration: CONFIGURATION_INTEGRATION.py"
echo ""
echo "🛑 ARRÊTER LES SERVICES:"
echo "  • Appuyer Ctrl+C pour arrêter Django"
echo "  • Exécuter: bash stop_depot_dossier.sh"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Lancer le serveur Django
python manage.py runserver 0.0.0.0:8003
