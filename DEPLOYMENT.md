# Deployment Guide

This guide covers deploying the Hackathon Management Platform backend to production.

## Pre-Deployment Checklist

### 1. Environment Configuration
- [ ] Set NODE_ENV=production
- [ ] Configure production MongoDB URI
- [ ] Set strong JWT secrets (minimum 32 characters)
- [ ] Configure Razorpay production keys
- [ ] Set up production email service
- [ ] Configure CORS with your frontend domain
- [ ] Set appropriate rate limits

### 2. Security
- [ ] Review all environment variables
- [ ] Ensure no sensitive data in code
- [ ] Enable HTTPS only
- [ ] Configure secure headers
- [ ] Set up database backups
- [ ] Configure firewall rules

### 3. Razorpay Setup
- [ ] Create production Razorpay account
- [ ] Generate API keys
- [ ] Configure webhook URL
- [ ] Test webhook signature verification
- [ ] Set up subscription plans

## Deployment Options

### Option 1: Traditional VPS (DigitalOcean, AWS EC2, etc.)

#### 1. Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx
```

#### 2. Deploy Application
```bash
# Clone repository
cd /var/www
git clone <your-repo-url> hackathon-backend
cd hackathon-backend

# Install dependencies
npm install --production

# Create .env file
nano .env
# Add production environment variables

# Seed subscription plans
node seed-plans.js

# Start with PM2
pm2 start src/server.js --name hackathon-api
pm2 save
pm2 startup
```

#### 3. Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/hackathon-api
```

Add configuration:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/hackathon-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 4. SSL with Let's Encrypt
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

### Option 2: Heroku

#### 1. Prepare Application
Create `Procfile`:
```
web: node src/server.js
```

Create `package.json` scripts:
```json
{
  "scripts": {
    "start": "node src/server.js",
    "heroku-postbuild": "node seed-plans.js"
  }
}
```

#### 2. Deploy
```bash
# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Add MongoDB addon
heroku addons:create mongolab:sandbox

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_jwt_secret
heroku config:set RAZORPAY_KEY_ID=your_key
heroku config:set RAZORPAY_KEY_SECRET=your_secret
# ... add all other env variables

# Deploy
git push heroku main

# Check logs
heroku logs --tail
```

### Option 3: Docker

#### 1. Create Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 5000

CMD ["node", "src/server.js"]
```

#### 2. Create docker-compose.yml
```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password

  api:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://admin:password@mongodb:27017/hackathon?authSource=admin
      - JWT_SECRET=${JWT_SECRET}
      - RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID}
      - RAZORPAY_KEY_SECRET=${RAZORPAY_KEY_SECRET}
    depends_on:
      - mongodb
    restart: unless-stopped

volumes:
  mongodb_data:
```

#### 3. Deploy
```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Option 4: AWS Elastic Beanstalk

#### 1. Install EB CLI
```bash
pip install awsebcli
```

#### 2. Initialize
```bash
eb init -p node.js-18 your-app-name --region us-east-1
```

#### 3. Create Environment
```bash
eb create production-env

# Set environment variables
eb setenv NODE_ENV=production JWT_SECRET=xxx RAZORPAY_KEY_ID=xxx
```

#### 4. Deploy
```bash
eb deploy
```

## Post-Deployment

### 1. Configure Razorpay Webhook
Go to Razorpay Dashboard → Webhooks and add:
```
URL: https://api.yourdomain.com/api/payments/webhook
Events: 
  - subscription.activated
  - subscription.charged
  - subscription.cancelled
  - payment.captured
  - payment.failed
```

### 2. Test Critical Flows
- [ ] User registration and login
- [ ] Hackathon creation
- [ ] Team registration
- [ ] Payment processing
- [ ] Coordinator invitations
- [ ] Judge scoring
- [ ] Webhook handling

### 3. Monitoring Setup

#### PM2 Monitoring
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

#### Setup Monitoring Service
Consider using:
- New Relic
- DataDog
- Sentry for error tracking

### 4. Database Backups

#### Automated MongoDB Backups
```bash
# Create backup script
nano /root/backup-mongo.sh
```

Add:
```bash
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mongodb"
mkdir -p $BACKUP_DIR

mongodump --out $BACKUP_DIR/backup_$TIMESTAMP

# Keep only last 7 days
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} +
```

Schedule with cron:
```bash
crontab -e
# Add: 0 2 * * * /root/backup-mongo.sh
```

### 5. Performance Optimization

#### Enable Compression
```javascript
// Add to server.js
const compression = require('compression');
app.use(compression());
```

#### Database Indexes
Indexes are already defined in models. Verify they're created:
```bash
mongo
use hackathon_platform
db.teams.getIndexes()
db.hackathons.getIndexes()
```

#### Caching
Consider adding Redis for:
- Leaderboard caching
- Session management
- Rate limiting

### 6. Logging

Setup centralized logging:
```bash
# Install Winston
npm install winston

# Configure in server.js
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

## Scaling Considerations

### Horizontal Scaling
- Use load balancer (Nginx, AWS ELB)
- Ensure stateless application
- Use Redis for session management
- Consider microservices architecture for large scale

### Database Scaling
- MongoDB replica sets for high availability
- Read replicas for heavy read operations
- Sharding for very large datasets

### CDN
- Serve static assets via CDN
- Cache API responses where appropriate

## Troubleshooting

### Common Issues

1. **Connection refused**
   - Check firewall rules
   - Verify port is open
   - Check PM2/service status

2. **Database connection failed**
   - Verify MongoDB is running
   - Check connection string
   - Verify network access

3. **Webhook failures**
   - Verify webhook URL is accessible
   - Check signature verification
   - Review webhook logs

4. **High memory usage**
   - Check for memory leaks
   - Increase server resources
   - Optimize database queries

### Logs Location
```bash
# PM2 logs
pm2 logs hackathon-api

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# MongoDB logs
tail -f /var/log/mongodb/mongod.log
```

## Maintenance

### Regular Tasks
- [ ] Weekly security updates
- [ ] Daily database backups
- [ ] Monthly dependency updates
- [ ] Quarterly security audits
- [ ] Monitor disk space
- [ ] Review error logs

### Update Procedure
```bash
# Pull latest changes
cd /var/www/hackathon-backend
git pull

# Install dependencies
npm install --production

# Run migrations if any
npm run migrate

# Restart application
pm2 restart hackathon-api

# Check health
curl https://api.yourdomain.com/health
```

## Security Best Practices

1. Keep Node.js and dependencies updated
2. Use environment variables for secrets
3. Enable rate limiting
4. Implement request validation
5. Use HTTPS only
6. Regular security audits
7. Monitor for suspicious activity
8. Implement proper logging
9. Use secure headers (helmet)
10. Regular database backups

## Support

For deployment issues:
- Check logs first
- Review this guide
- Contact DevOps team
- Email: devops@hackathonplatform.com
