# Infrastructure Configuration Guide

This guide covers manual infrastructure changes needed to support long-running requests and Server-Sent Events (SSE) for progress updates.

## Table of Contents
- [Nginx Configuration (EC2)](#nginx-configuration-ec2)
- [CloudFront Configuration](#cloudfront-configuration)
- [Cloudflare Configuration](#cloudflare-configuration)
- [Testing the Configuration](#testing-the-configuration)

---

## Nginx Configuration (EC2)

If you're using Nginx as a reverse proxy in front of your Express server, you need to update the configuration to support:
1. Long-running requests (up to 2 minutes)
2. Server-Sent Events (SSE) for progress updates

### Update Nginx Config

Edit your Nginx configuration file:
```bash
sudo nano /etc/nginx/sites-available/bgg-backend
```

Replace or update with this configuration:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    
    # Increase timeouts for long-running requests (2 minutes)
    proxy_connect_timeout 120s;
    proxy_send_timeout 120s;
    proxy_read_timeout 120s;
    send_timeout 120s;
    
    # Increase buffer sizes for large responses
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        
        # Headers for SSE support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Disable buffering for SSE (critical!)
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 120s;
        
        # Keep connection alive
        proxy_set_header Connection "";
        
        # Allow large request bodies
        client_max_body_size 10M;
    }
    
    # Specific configuration for SSE endpoint
    location /api/games/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        
        # SSE-specific settings
        proxy_set_header Cache-Control 'no-cache';
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
        
        # Timeouts for SSE
        proxy_read_timeout 300s;  # 5 minutes for SSE connections
        proxy_send_timeout 300s;
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Apply Changes

```bash
# Test configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx

# Or restart if reload doesn't work
sudo systemctl restart nginx
```

### Verify Configuration

```bash
# Check Nginx status
sudo systemctl status nginx

# View Nginx error logs if issues occur
sudo tail -f /var/log/nginx/error.log
```

---

## CloudFront Configuration

CloudFront has limitations for long-running requests and SSE:

### Limitations
- **Maximum origin timeout: 60 seconds** (cannot be increased)
- **SSE support: Limited** - CloudFront may buffer SSE responses

### Options

#### Option 1: Use CloudFront for Frontend Only (Recommended)
- Deploy frontend to CloudFront (S3 + CloudFront)
- Point frontend directly to EC2 backend (bypass CloudFront for API)
- Update `VITE_API_URL` to point directly to EC2: `https://api.yourdomain.com/api`

#### Option 2: Use API Gateway (If you need CloudFront for API)
If you must use CloudFront for the API, consider:
- Using AWS API Gateway with Lambda (but this won't work with persistent cache)
- Using Application Load Balancer (ALB) instead of CloudFront for API
- Accepting 60-second timeout limit and optimizing API calls

### If Using CloudFront for API (Not Recommended)

1. **CloudFront Distribution Settings:**
   - Origin timeout: 60 seconds (maximum)
   - Origin response timeout: 60 seconds
   - Viewer protocol: Redirect HTTP to HTTPS

2. **Cache Behavior:**
   - Path pattern: `/api/games/*`
   - Cache policy: CachingDisabled (for SSE)
   - Origin request policy: AllViewer
   - Response headers policy: Allow all

3. **Note:** SSE may not work reliably through CloudFront due to buffering.

---

## Cloudflare Configuration

If using Cloudflare in front of your API:

### 1. Disable Cloudflare Proxy for API (Recommended)

In Cloudflare DNS settings:
- Set API subdomain to **DNS only** (gray cloud) instead of **Proxied** (orange cloud)
- This bypasses Cloudflare's proxy and goes directly to your EC2 instance
- You'll need to handle SSL at the origin (Let's Encrypt on EC2)

### 2. If Using Cloudflare Proxy

If you must use Cloudflare proxy:

1. **Page Rules:**
   - Create a page rule for `api.yourdomain.com/api/games/*`
   - Settings:
     - Cache Level: Bypass
     - Disable Performance
     - Disable Apps

2. **Network Settings:**
   - Go to Network tab
   - Enable "WebSockets" (helps with long connections)
   - Set "HTTP/2 to Origin" to "On"

3. **SSL/TLS Settings:**
   - Mode: Full (strict)
   - Always Use HTTPS: On

4. **Note:** Cloudflare may still timeout long requests. Consider using DNS-only mode for API subdomain.

---

## Testing the Configuration

### Test 1: Basic API Request

```bash
# Test from command line (should complete without timeout)
curl -X GET "https://api.yourdomain.com/api/games/testuser" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --max-time 180
```

### Test 2: SSE Connection

```bash
# Test SSE endpoint
curl -N "https://api.yourdomain.com/api/games/testuser/progress"
```

You should see:
```
data: {"status":"connected","requestId":"testuser-1234567890","message":"Connected to progress stream"}

: keep-alive

: keep-alive
...
```

### Test 3: Long-Running Request

1. Use a user with a large collection
2. Monitor the request in browser DevTools → Network tab
3. Check that:
   - Request doesn't timeout before 2 minutes
   - Progress updates appear in console
   - Connection stays alive

### Test 4: Nginx Logs

```bash
# Monitor access logs
sudo tail -f /var/log/nginx/access.log

# Monitor error logs
sudo tail -f /var/log/nginx/error.log
```

Look for:
- No 504 Gateway Timeout errors
- Successful 200 responses
- SSE connections staying open

---

## Troubleshooting

### Issue: Requests timing out at 60 seconds

**Cause:** CloudFront or proxy timeout
**Solution:** 
- Bypass CloudFront/Cloudflare proxy for API subdomain
- Or increase Nginx timeouts (if using Nginx)

### Issue: SSE not working / connection closes immediately

**Cause:** Proxy buffering SSE responses
**Solution:**
- Ensure `proxy_buffering off` in Nginx config
- Set Cloudflare to DNS-only for API subdomain
- Check that `X-Accel-Buffering: no` header is set

### Issue: 504 Gateway Timeout

**Cause:** Nginx timeout too short
**Solution:**
- Increase `proxy_read_timeout` to 120s or higher
- Check that Express server timeout is also increased

### Issue: Connection reset / ECONNRESET

**Cause:** Keep-alive not working
**Solution:**
- Verify `Connection: keep-alive` headers
- Check Nginx `proxy_set_header Connection "";` is set
- Ensure no intermediate proxies are closing connections

---

## Recommended Architecture

For best results with long-running requests and SSE:

```
User Browser
    ↓
CloudFront (Frontend only - static files)
    ↓
EC2 Instance (Backend API)
    ├── Nginx (reverse proxy)
    │   └── Timeouts: 120s
    │   └── SSE: Buffering disabled
    └── Express Server
        └── Timeout: 120s
        └── SSE endpoint: /api/games/:username/progress
```

**DNS Setup:**
- `yourdomain.com` → CloudFront (frontend)
- `api.yourdomain.com` → EC2 IP (DNS-only, no proxy) OR Cloudflare (DNS-only)

---

## Security Considerations

1. **Rate Limiting:** Consider adding rate limiting to prevent abuse of long-running endpoints
2. **Request Size:** Monitor request sizes to prevent DoS
3. **Connection Limits:** Set appropriate connection limits in Nginx
4. **SSL/TLS:** Always use HTTPS for API endpoints

---

## Additional Resources

- [Nginx Proxy Module Documentation](http://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [CloudFront Timeout Limits](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html)
- [Cloudflare Timeout Limits](https://developers.cloudflare.com/fundamentals/get-started/reference/timeouts/)
- [Server-Sent Events MDN Guide](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

