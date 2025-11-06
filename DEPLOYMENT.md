# Deployment Guide for BGCube

This guide covers multiple deployment options for the BGCube application, including detailed AWS instructions.

## Table of Contents
- [Option 1: Railway (Recommended for Simplicity)](#option-1-railway-recommended-for-simplicity)
- [Option 2: Render](#option-2-render)
- [Option 3: AWS (Detailed Instructions)](#option-3-aws-detailed-instructions)
- [Option 4: Vercel + Railway](#option-4-vercel--railway)
- [Important Notes](#important-notes)

---

## Option 1: Railway (Recommended for Simplicity)

Railway is the easiest option as it handles both frontend and backend with minimal configuration.

### Steps:

1. **Prepare your code:**
   - Ensure `.env` is in `.gitignore`
   - Create a `railway.json` (optional) or use Railway's UI

2. **Deploy Backend:**
   - Go to [railway.app](https://railway.app) and sign up
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repo
   - Railway will auto-detect Node.js
   - Set Root Directory to `server`
   - Add environment variables:
     - `BGG_API_TOKEN` = your token
     - `PORT` = 3001 (or let Railway assign)
     - `CACHE_ADMIN_PASSWORD` = your secure password for cache admin endpoints
   - **Important:** Railway provides persistent storage by default, so the cache database (`server/cache/bgg-cache.db`) will persist across deployments
   - Railway will provide a URL like `https://your-app.railway.app`

3. **Deploy Frontend:**
   - Create a new service in the same project
   - Root Directory: `/` (root)
   - Build Command: `npm run build`
   - Start Command: `npx serve -s dist -l 3000` (or use Railway's static file serving)
   - Add environment variable:
     - `VITE_API_URL` = `https://your-backend-url.railway.app/api`
   - Build the frontend with this variable set

4. **Connect Domain (Cloudflare):**
   - In Railway, go to your frontend service → Settings → Domains
   - Add your custom domain
   - Railway will provide DNS records
   - In Cloudflare DNS, add the CNAME record Railway provides

---

## Option 2: Render

Similar to Railway, Render offers easy deployment for both frontend and backend.

1. **Backend:**
   - Go to [render.com](https://render.com)
   - New → Web Service
   - Connect GitHub repo
   - Root Directory: `server`
   - Build: `npm install`
   - Start: `npm start`
   - Environment: `BGG_API_TOKEN`, `PORT=3001`, `CACHE_ADMIN_PASSWORD`
   - **Important:** Enable "Persistent Disk" in Render settings to ensure the cache database persists across deployments
     - Go to Settings → Persistent Disk
     - Mount path: `/opt/render/project/src/server/cache`
     - Size: 1GB (or more if you expect heavy usage)
   - Get backend URL

2. **Frontend:**
   - New → Static Site
   - Root Directory: `/`
   - Build: `npm install && VITE_API_URL=https://your-backend.onrender.com/api npm run build`
   - Publish: `dist`
   - Add custom domain in Render settings

---

## Option 3: AWS (Detailed Instructions)

This option provides more control but requires more setup. Architecture:
- **EC2** for backend
- **S3 + CloudFront** for frontend
- **Route 53** (or Cloudflare) for DNS

### Part 1: Deploy Backend to EC2

1. **Launch EC2 Instance:**
   - Use Ubuntu 22.04 LTS
   - Instance type: t3.micro (free tier) or t3.small
   - Security Group: Allow HTTP (80), HTTPS (443), SSH (22)
   - Create/use a key pair for SSH

2. **SSH into EC2:**
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   ```

3. **Install Node.js:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   node --version  # Verify
   ```

4. **Install PM2 (process manager):**
   ```bash
   sudo npm install -g pm2
   ```

5. **Clone and setup:**
   ```bash
   git clone https://github.com/your-username/bgg-kallax-organizer.git
   cd bgg-kallax-organizer/server
   npm install
   ```

6. **Create .env file:**
   ```bash
   nano .env
   # Add:
   BGG_API_TOKEN=your_token_here
   PORT=3001
   CACHE_ADMIN_PASSWORD=your_secure_password_here
   ```
   
   **Note:** The cache database will be created automatically at `server/cache/bgg-cache.db` on first run. The cache directory will persist on the EC2 instance.

7. **Start with PM2:**
   ```bash
   pm2 start server.js --name bgg-backend
   pm2 save
   pm2 startup  # Follow instructions to enable on boot
   ```

8. **Setup Nginx as reverse proxy:**
   ```bash
   sudo apt update
   sudo apt install nginx
   sudo nano /etc/nginx/sites-available/bgg-backend
   ```
   
   Add this config:
   ```nginx
   server {
       listen 80;
       server_name api.yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   
   ```bash
   sudo ln -s /etc/nginx/sites-available/bgg-backend /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

9. **Setup SSL with Let's Encrypt:**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d api.yourdomain.com
   ```

### Part 2: Deploy Frontend to S3 + CloudFront

1. **Build Frontend Locally:**
   ```bash
   # On your local machine
   cd bgg-kallax-organizer
   VITE_API_URL=https://api.yourdomain.com/api npm run build
   ```

2. **Create S3 Bucket:**
   - Go to S3 Console
   - Create bucket: `yourdomain-frontend` (or similar)
   - Uncheck "Block all public access"
   - Enable static website hosting:
     - Index document: `index.html`
     - Error document: `index.html` (for React routing)

3. **Upload Build:**
   ```bash
   aws s3 sync dist/ s3://yourdomain-frontend --delete
   ```

4. **Create CloudFront Distribution:**
   - Origin: S3 bucket (or S3 website endpoint)
   - Viewer protocol: Redirect HTTP to HTTPS
   - Default root object: `index.html`
   - Error pages: 404 → `/index.html` (200)
   - Alternate domain names: `yourdomain.com`, `www.yourdomain.com`
   - SSL certificate: Request or import one in ACM (us-east-1)

5. **Update S3 Bucket Policy:**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::yourdomain-frontend/*"
       }
     ]
   }
   ```

### Part 3: Cloudflare DNS Setup

1. **In Cloudflare:**
   - Add A record: `api` → Your EC2 IP (or use Cloudflare proxy)
   - Add CNAME: `@` → Your CloudFront domain (e.g., `d1234abcd.cloudfront.net`)
   - Add CNAME: `www` → Your CloudFront domain

2. **Cloudflare SSL/TLS:**
   - Set to "Full" or "Full (strict)"
   - Enable "Always Use HTTPS"

### Quick Setup Script for AWS EC2

Save this as `setup.sh` on your EC2 instance:

```bash
#!/bin/bash
# Save as setup.sh, then: chmod +x setup.sh && ./setup.sh

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Git
sudo apt install -y git

# Clone your repo (update URL)
cd /home/ubuntu
git clone https://github.com/your-username/bgg-kallax-organizer.git
cd bgg-kallax-organizer/server
npm install

# Create .env (you'll need to edit this)
echo "BGG_API_TOKEN=your_token_here" > .env
echo "PORT=3001" >> .env
echo "CACHE_ADMIN_PASSWORD=your_secure_password_here" >> .env

# Create cache directory (database will be created automatically)
mkdir -p cache

# Start with PM2
pm2 start server.js --name bgg-backend
pm2 save
pm2 startup

echo "Setup complete! Now configure Nginx and SSL."
```

---

## Option 4: Vercel (Frontend) + Railway (Backend)

1. **Backend on Railway** (as in Option 1)
   - **Important:** Railway provides persistent storage, so the cache will work properly ✅

2. **Frontend on Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Import GitHub repo
   - Root Directory: `/`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Environment Variables:
     - `VITE_API_URL` = `https://your-backend.railway.app/api`
   - Add custom domain

**Note:** Do NOT deploy the backend to Vercel (serverless functions). The cache database requires persistent storage, which Vercel serverless functions do not provide. Use Railway, Render, or EC2 for the backend.

---

## Important Notes

1. **Environment Variables:**
   - Never commit `.env` files to git
   - Always use your platform's environment variable settings
   - Backend needs: 
     - `BGG_API_TOKEN` (required) - Your BoardGameGeek API token
     - `PORT` (optional) - Server port, defaults to 3001
     - `CACHE_ADMIN_PASSWORD` (optional but recommended) - Password for cache admin endpoints (`/api/admin/cache/*`)
   - Frontend needs: `VITE_API_URL` (set during build)

2. **CORS:**
   - Your backend already has `cors()` enabled, which should work
   - If you encounter CORS issues, update the CORS configuration in `server.js` to allow your frontend domain

3. **API Token Security:**
   - Keep `BGG_API_TOKEN` secret
   - Only set it in backend environment variables
   - Never expose it in frontend code

4. **Cost Estimates:**
   - Railway: ~$5-20/month (free tier available)
   - Render: ~$7-25/month (free tier available)
   - AWS: ~$5-15/month (EC2 free tier for 12 months)
   - Vercel: Free for frontend

5. **Monitoring:**
   - Set up health checks for your backend
   - Monitor backend logs regularly
   - Consider adding error tracking (e.g., Sentry)

6. **Cache Database:**
   - The application uses SQLite for caching BGG API responses
   - Cache location: `server/cache/bgg-cache.db`
   - Cache directory is created automatically on first run
   - **Persistent Storage Required:** The cache database must persist across deployments
     - **Railway:** Persistent by default ✅
     - **Render:** Enable "Persistent Disk" in settings ⚠️
     - **EC2:** File system persists naturally ✅
     - **Vercel/Serverless:** Cache will NOT persist (each request is isolated) ❌
   - Cache size limit: 2GB (automatic cleanup removes entries older than 7 days)
   - Cache TTL: 1 hour (data refreshed after 1 hour)
   - **Backup:** Consider backing up `server/cache/bgg-cache.db` periodically if you want to preserve cache data

7. **Updates:**
   - For EC2: SSH in, `git pull`, `pm2 restart bgg-backend`
   - For S3: Rebuild and `aws s3 sync dist/ s3://your-bucket --delete`
   - For Railway/Render: Usually auto-deploys on git push
   - **Note:** Cache database persists through updates unless you manually delete it

---

## Recommended Approach

**For fastest deployment:** Start with Railway (Option 1) - it's the simplest, handles everything, and provides persistent storage for the cache database.

**For more control and scalability:** Use AWS (Option 3) - more setup but full control, and file system persistence works naturally.

**For best of both worlds:** Vercel (frontend) + Railway (backend) - great performance with minimal setup, and Railway's persistent storage ensures cache works properly.

**⚠️ Important:** Do not use serverless platforms (Vercel serverless, AWS Lambda, etc.) for the backend, as they don't provide persistent storage for the SQLite cache database. The cache will be lost on each request, defeating its purpose.

---

## Troubleshooting

### Backend not responding
- Check PM2 status: `pm2 status`
- Check logs: `pm2 logs bgg-backend`
- Verify environment variables are set
- Check Nginx configuration: `sudo nginx -t`

### Frontend can't connect to backend
- Verify `VITE_API_URL` is set correctly
- Check CORS settings in backend
- Ensure backend is accessible (test with curl)
- Check Cloudflare/security group firewall rules

### SSL Certificate issues
- Ensure DNS is pointing correctly
- Wait for DNS propagation (can take up to 48 hours)
- Verify certificate in ACM (for CloudFront) or Let's Encrypt (for EC2)

### Cache not working / Database errors
- Verify the `server/cache` directory exists and is writable
- Check file permissions: `chmod 755 server/cache` (on EC2)
- Ensure persistent storage is enabled (Render requires "Persistent Disk")
- Check logs for SQLite errors
- Verify `CACHE_ADMIN_PASSWORD` is set if using admin endpoints
- On Railway/Render, check that the cache directory persists across deployments
- If cache is lost, it will rebuild automatically (just slower first requests)

---

## Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [Render Documentation](https://render.com/docs)
- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)

