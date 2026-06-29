#!/bin/bash
# ISIMM Platform - Docker Gateway Deployment Script

set -e

echo "=========================================="
echo "ISIMM Platform - Gateway Deployment"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Docker installation
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    exit 1
fi

# Check .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found${NC}"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo -e "${YELLOW}Please edit .env with your production values${NC}"
    exit 1
fi

# Function to print section
section() {
    echo ""
    echo -e "${GREEN}>>> $1${NC}"
    echo "=========================================="
}

# Parse command line arguments
COMMAND=${1:-help}

case $COMMAND in
    build)
        section "Building Docker images"
        docker-compose build
        echo -e "${GREEN}✓ Build completed${NC}"
        ;;
    
    start)
        section "Starting services"
        docker-compose up -d
        echo -e "${GREEN}✓ Services started${NC}"
        echo ""
        echo "Waiting for services to be healthy..."
        sleep 10
        docker-compose ps
        ;;
    
    stop)
        section "Stopping services"
        docker-compose down
        echo -e "${GREEN}✓ Services stopped${NC}"
        ;;
    
    restart)
        section "Restarting services"
        docker-compose restart
        echo -e "${GREEN}✓ Services restarted${NC}"
        ;;
    
    logs)
        section "Showing service logs"
        docker-compose logs -f
        ;;
    
    status)
        section "Service Status"
        docker-compose ps
        echo ""
        echo -e "${GREEN}Testing gateway health...${NC}"
        if curl -f http://localhost/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Gateway is healthy${NC}"
        else
            echo -e "${RED}✗ Gateway is not responding${NC}"
        fi
        ;;
    
    migrate)
        section "Running database migrations"
        echo "Auth Service..."
        docker-compose exec -T auth-service python manage.py migrate
        echo "User Service..."
        docker-compose exec -T user-service python manage.py migrate
        echo "Candidature Service..."
        docker-compose exec -T candidature-service python manage.py migrate
        echo -e "${GREEN}✓ Migrations completed${NC}"
        ;;
    
    backup)
        section "Backing up database"
        BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
        docker-compose exec -T db pg_dump -U ${DB_USER:-isimm_user} ${DB_NAME:-isimm_db} > "$BACKUP_FILE"
        echo -e "${GREEN}✓ Backup saved to $BACKUP_FILE${NC}"
        ;;
    
    restore)
        if [ -z "$2" ]; then
            echo -e "${RED}Error: Please provide backup file path${NC}"
            echo "Usage: ./deploy.sh restore <backup_file>"
            exit 1
        fi
        
        section "Restoring database from $2"
        docker-compose exec -T db psql -U ${DB_USER:-isimm_user} ${DB_NAME:-isimm_db} < "$2"
        echo -e "${GREEN}✓ Database restored${NC}"
        ;;
    
    clean)
        section "Cleaning up containers and volumes"
        docker-compose down -v
        echo -e "${GREEN}✓ Cleanup completed${NC}"
        ;;
    
    full-setup)
        section "Performing full setup"
        docker-compose build
        docker-compose up -d
        sleep 10
        docker-compose exec -T auth-service python manage.py migrate
        docker-compose exec -T user-service python manage.py migrate
        docker-compose exec -T candidature-service python manage.py migrate
        echo -e "${GREEN}✓ Full setup completed${NC}"
        echo ""
        docker-compose ps
        ;;
    
    shell)
        SERVICE=${2:-candidature-service}
        section "Opening shell in $SERVICE"
        docker-compose exec $SERVICE bash
        ;;
    
    *)
        echo "ISIMM Platform - Gateway Deployment Script"
        echo ""
        echo "Usage: ./deploy.sh <command>"
        echo ""
        echo "Commands:"
        echo "  build              - Build Docker images"
        echo "  start              - Start all services"
        echo "  stop               - Stop all services"
        echo "  restart            - Restart all services"
        echo "  logs               - Show service logs"
        echo "  status             - Check service status"
        echo "  migrate            - Run database migrations"
        echo "  backup             - Backup PostgreSQL database"
        echo "  restore <file>     - Restore database from backup"
        echo "  clean              - Remove containers and volumes"
        echo "  full-setup         - Build, start, and migrate (full setup)"
        echo "  shell <service>    - Open shell in service (default: candidature-service)"
        echo "  help               - Show this help message"
        echo ""
        echo "Environment:"
        echo "  .env file is required. Copy from .env.example if missing."
        echo ""
        ;;
esac
