#!/bin/bash
# Script d'arrêt - Dépôt de dossier Sprint 2
# Utilisation: bash stop_depot_dossier.sh

echo "═══════════════════════════════════════════════════════════════════"
echo "  🛑 ARRÊT DES SERVICES - DÉPÔT DE DOSSIER SPRINT 2"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Arrêter le Worker Celery
if [ -f "celery_worker.pid" ]; then
    WORKER_PID=$(cat celery_worker.pid)
    if kill -0 $WORKER_PID 2>/dev/null; then
        echo "⏹️  Arrêt du Celery Worker (PID: $WORKER_PID)..."
        kill $WORKER_PID
        rm celery_worker.pid
        echo "   ✓ Celery Worker arrêté"
    fi
else
    echo "⚠️  PID du Worker non trouvé"
fi

echo ""

# Arrêter le Beat Celery
if [ -f "celery_beat.pid" ]; then
    BEAT_PID=$(cat celery_beat.pid)
    if kill -0 $BEAT_PID 2>/dev/null; then
        echo "⏹️  Arrêt du Celery Beat (PID: $BEAT_PID)..."
        kill $BEAT_PID
        rm celery_beat.pid
        echo "   ✓ Celery Beat arrêté"
    fi
else
    echo "⚠️  PID du Beat non trouvé"
fi

echo ""

# Tuer tous les processus celery orphelins
echo "🧹 Nettoyage des processus orphelins..."
pkill -f "celery worker" 2>/dev/null || true
pkill -f "celery beat" 2>/dev/null || true

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  ✅ TOUS LES SERVICES ARRÊTÉS"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Les logs sont disponibles à:"
echo "  • celery_worker.log"
echo "  • celery_beat.log"
echo ""
