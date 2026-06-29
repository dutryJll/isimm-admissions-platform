# ISIMM Platform - Docker Gateway Deployment Script (PowerShell for Windows)

param(
    [Parameter(Position = 0)]
    [string]$Command = "help"
)

# Colors for output
$ErrorColor = "Red"
$SuccessColor = "Green"
$WarningColor = "Yellow"

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host ">>> $Title" -ForegroundColor $SuccessColor
    Write-Host "==========================================" 
}

function Test-DockerInstalled {
    try {
        $null = docker --version
        return $true
    } catch {
        return $false
    }
}

function Test-DockerComposeInstalled {
    try {
        $null = docker-compose --version
        return $true
    } catch {
        return $false
    }
}

# Check Docker installation
if (-not (Test-DockerInstalled)) {
    Write-Host "Error: Docker is not installed" -ForegroundColor $ErrorColor
    exit 1
}

if (-not (Test-DockerComposeInstalled)) {
    Write-Host "Error: Docker Compose is not installed" -ForegroundColor $ErrorColor
    exit 1
}

# Check .env file
if (-not (Test-Path ".env")) {
    Write-Host "Warning: .env file not found" -ForegroundColor $WarningColor
    Write-Host "Creating .env from .env.example..."
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "Please edit .env with your production values" -ForegroundColor $WarningColor
    }
    exit 1
}

# Main command switch
switch ($Command.ToLower()) {
    "build" {
        Write-Section "Building Docker images"
        docker-compose build
        Write-Host "Build completed" -ForegroundColor $SuccessColor
    }
    
    "start" {
        Write-Section "Starting services"
        docker-compose up -d
        Write-Host "Services started" -ForegroundColor $SuccessColor
        Write-Host ""
        Write-Host "Waiting for services to be healthy..."
        Start-Sleep -Seconds 10
        docker-compose ps
    }
    
    "stop" {
        Write-Section "Stopping services"
        docker-compose down
        Write-Host "Services stopped" -ForegroundColor $SuccessColor
    }
    
    "restart" {
        Write-Section "Restarting services"
        docker-compose restart
        Write-Host "Services restarted" -ForegroundColor $SuccessColor
    }
    
    "logs" {
        Write-Section "Showing service logs"
        docker-compose logs -f
    }
    
    "status" {
        Write-Section "Service Status"
        docker-compose ps
        Write-Host ""
        Write-Host "Testing gateway health..." -ForegroundColor $SuccessColor
        try {
            $response = Invoke-WebRequest -Uri "http://localhost/health" -ErrorAction Stop
            Write-Host "Gateway is healthy" -ForegroundColor $SuccessColor
        } catch {
            Write-Host "Gateway is not responding" -ForegroundColor $ErrorColor
        }
    }
    
    "migrate" {
        Write-Section "Running database migrations"
        Write-Host "Auth Service..."
        docker-compose exec -T auth-service python manage.py migrate
        Write-Host "User Service..."
        docker-compose exec -T user-service python manage.py migrate
        Write-Host "Candidature Service..."
        docker-compose exec -T candidature-service python manage.py migrate
        Write-Host "Migrations completed" -ForegroundColor $SuccessColor
    }
    
    "backup" {
        Write-Section "Backing up database"
        $BackupFile = "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
        
        # Load environment variables
        $EnvContent = Get-Content ".env" | Where-Object { $_ -match "^DB_USER|^DB_NAME" }
        $EnvContent | ForEach-Object {
            $key, $value = $_ -split '='
            [System.Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim())
        }
        
        $dbUser = [System.Environment]::GetEnvironmentVariable("DB_USER") ?? "isimm_user"
        $dbName = [System.Environment]::GetEnvironmentVariable("DB_NAME") ?? "isimm_db"
        
        docker-compose exec -T db pg_dump -U $dbUser $dbName | Out-File -FilePath $BackupFile -Encoding UTF8
        Write-Host "Backup saved to $BackupFile" -ForegroundColor $SuccessColor
    }
    
    "restore" {
        if (-not $args[0]) {
            Write-Host "Error: Please provide backup file path" -ForegroundColor $ErrorColor
            Write-Host "Usage: .\deploy.ps1 restore <backup_file>"
            exit 1
        }
        
        $BackupFile = $args[0]
        Write-Section "Restoring database from $BackupFile"
        
        if (-not (Test-Path $BackupFile)) {
            Write-Host "Error: Backup file not found: $BackupFile" -ForegroundColor $ErrorColor
            exit 1
        }
        
        # Load environment variables
        $EnvContent = Get-Content ".env" | Where-Object { $_ -match "^DB_USER|^DB_NAME" }
        $EnvContent | ForEach-Object {
            $key, $value = $_ -split '='
            [System.Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim())
        }
        
        $dbUser = [System.Environment]::GetEnvironmentVariable("DB_USER") ?? "isimm_user"
        $dbName = [System.Environment]::GetEnvironmentVariable("DB_NAME") ?? "isimm_db"
        
        $BackupContent = Get-Content $BackupFile -Raw
        $BackupContent | docker-compose exec -T db psql -U $dbUser $dbName
        Write-Host "Database restored" -ForegroundColor $SuccessColor
    }
    
    "clean" {
        Write-Section "Cleaning up containers and volumes"
        docker-compose down -v
        Write-Host "Cleanup completed" -ForegroundColor $SuccessColor
    }
    
    "full-setup" {
        Write-Section "Performing full setup"
        docker-compose build
        docker-compose up -d
        Start-Sleep -Seconds 10
        docker-compose exec -T auth-service python manage.py migrate
        docker-compose exec -T user-service python manage.py migrate
        docker-compose exec -T candidature-service python manage.py migrate
        Write-Host "Full setup completed" -ForegroundColor $SuccessColor
        Write-Host ""
        docker-compose ps
    }
    
    "shell" {
        $Service = $args[0] ?? "candidature-service"
        Write-Section "Opening shell in $Service"
        docker-compose exec $Service bash
    }
    
    default {
        Write-Host "ISIMM Platform - Gateway Deployment Script (PowerShell)"
        Write-Host ""
        Write-Host "Usage: .\deploy.ps1 <command>"
        Write-Host ""
        Write-Host "Commands:"
        Write-Host "  build              - Build Docker images"
        Write-Host "  start              - Start all services"
        Write-Host "  stop               - Stop all services"
        Write-Host "  restart            - Restart all services"
        Write-Host "  logs               - Show service logs"
        Write-Host "  status             - Check service status"
        Write-Host "  migrate            - Run database migrations"
        Write-Host "  backup             - Backup PostgreSQL database"
        Write-Host "  restore <file>     - Restore database from backup"
        Write-Host "  clean              - Remove containers and volumes"
        Write-Host "  full-setup         - Build, start, and migrate (full setup)"
        Write-Host "  shell <service>    - Open shell in service (default: candidature-service)"
        Write-Host "  help               - Show this help message"
        Write-Host ""
        Write-Host "Environment:"
        Write-Host "  .env file is required. Copy from .env.example if missing."
        Write-Host ""
    }
}
