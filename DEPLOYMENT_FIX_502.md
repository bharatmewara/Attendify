# Fix 502 Bad Gateway - Ubuntu VPS Deployment Guide

## Diagnosis
502 error = nginx can't reach backend. Backend crashes without DATABASE_URL (.env missing).

## Prerequisites
- Ubuntu 22.04+ VPS with SSH access
- Domain pointed to server IP
- Root/sudo access

## Step 1: Update Code & Install Backend
```bash
cd /var/www/attendify  # or your deploy path
git pull origin main
cd backend
npm ci --production
```

## Step 2: PostgreSQL Setup
```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create DB user & database
sudo -u postgres psql
CREATE USER attendify WITH PASSWORD 'strongpassword123';
CREATE DATABASE attendify_hrms OWNER attendify;
GRANT ALL PRIVILEGES ON DATABASE attendify_hrms TO attendify;
\\q

# Import schema (run from backend/)
psql -U attendify -d attendify_hrms -f sql/schema_complete.sql
psql -U attendify -d attendify_hrms -f sql/add_notifications.sql
# Run other migrations: node run_kyc_migration.js etc.
```

## Step 3: Configure .env
```bash
cp .env.example .env
nano .env  # Edit DATABASE_URL=postgresql://attendify:strongpassword123@localhost:5432/attendify_hrms
          # JWT_SECRET=your-super-secret-key-here
```

## Step 4: PM2 Process Manager
```bash
sudo npm i -g pm2
mkdir logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions
pm2 logs attendify-backend  # Check for DB errors
```

## Step 5: Nginx Configuration
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo nano /etc/nginx/sites-available/attendify
```
**Paste nginx.conf.example content, update server_name & uploads alias to /var/www/attendify/backend/uploads/**

```bash
sudo ln -s /etc/nginx/sites-available/attendify /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo certbot --nginx -d yourdomain.com
```

## Step 6: Frontend (Static Serve via Nginx)
```bash
cd ../  # frontend root
npm run build
# Add to nginx.conf above proxy:
# location / {
#     root /var/www/attendify/dist;
#     try_files $uri $uri/ /index.html;
# }
sudo systemctl restart nginx
```

## Step 7: Test & Monitor
```bash
curl http://localhost:5000/api/health  # Should return {ok:true}
curl https://yourdomain.com/api/health

pm2 monit
journalctl -u nginx -f
tail -f backend/logs/combined.log
```

## Common Issues
- **DB Connection**: Wrong DATABASE_URL → pm2 logs show pg errors
- **Port Conflict**: Kill processes on PORT 5000: `sudo lsof -ti:5000 | xargs sudo kill -9`
- **Permissions**: `chown -R $USER:$USER /var/www/attendify`
- **Uploads**: `mkdir -p backend/uploads && chmod 755 backend/uploads`

## Quick Restart
```bash
pm2 restart attendify-backend
sudo systemctl restart nginx
```

**Success Metrics:**
- Backend: http://your-ip:5000/api/health → {ok:true}
- Frontend: https://yourdomain.com → Login page loads
- No 502 errors
