# Production-Ready Nginx Configuration with SSL/TLS

## For Let's Encrypt Certificate

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate (standalone mode)
sudo certbot certonly --standalone -d api.isimm.tn -d isimm.tn

# Certificates will be in:
# /etc/letsencrypt/live/api.isimm.tn/fullchain.pem
# /etc/letsencrypt/live/api.isimm.tn/privkey.pem

# Auto-renewal (runs twice daily)
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

## SSL Configuration (Uncomment in nginx.conf)

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name api.isimm.tn;

    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/api.isimm.tn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.isimm.tn/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;

    # HSTS (HTTP Strict-Transport-Security)
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # ... rest of server configuration ...
}
```

## Environment Variables for Production

```bash
# .env for production
DEBUG=False
SECRET_KEY=your-production-secret-key-min-50-chars
JWT_SECRET=your-production-jwt-secret-min-50-chars
DB_PASSWORD=strong-production-database-password

ALLOWED_HOSTS=api.isimm.tn,isimm.tn,www.isimm.tn
CORS_ALLOWED_ORIGINS=https://isimm.tn,https://www.isimm.tn

GATEWAY_HOST=api.isimm.tn
GATEWAY_SSL=True

LOG_LEVEL=INFO
ENABLE_API_DOCS=False  # Disable API docs in production
```

## Docker Production Configuration

```yaml
version: '3.8'

services:
  # ... existing services ...

  gateway:
    image: nginx:alpine
    container_name: isimm-gateway
    volumes:
      - ./gateway/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./frontend/dist:/usr/share/nginx/html:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - gateway_logs:/var/log/nginx
    ports:
      - '80:80'
      - '443:443'
    restart: always
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

## Monitoring and Logging

```bash
# View Nginx error logs
docker-compose logs gateway

# Monitor certificate expiration
certbot certificates

# Renew certificates manually
sudo certbot renew --dry-run
```

## Security Checklist

- [ ] SSL/TLS enabled (HTTPS only)
- [ ] HSTS header configured
- [ ] Certificate auto-renewal working
- [ ] Firewall configured (only ports 80, 443 open)
- [ ] DDoS protection enabled (rate limiting, WAF)
- [ ] Database backups configured
- [ ] Log rotation configured
- [ ] Monitoring/alerting configured
- [ ] Disaster recovery plan in place
- [ ] Security audit completed

---

See README_GATEWAY.md for full documentation.
