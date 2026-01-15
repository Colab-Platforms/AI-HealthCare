# Deployment Guide

## Prerequisites

1. GitHub account
2. Vercel account (sign up at vercel.com)
3. MongoDB Atlas account (for production database)

## Step 1: Prepare MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster (free tier available)
3. Create a database user
4. Whitelist all IPs (0.0.0.0/0) for Vercel
5. Get your connection string

## Step 2: Push to GitHub

```bash
cd healthcare-ai-platform
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/Colab-Platforms/AI-Diagnostic.git
git push -u origin main
```

## Step 3: Deploy to Vercel

### Option A: Using Vercel Dashboard (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure project:
   - Framework Preset: Other
   - Root Directory: `./`
   - Build Command: Leave empty (we'll use vercel.json)
   - Output Directory: Leave empty

5. Add Environment Variables:
   ```
   MONGODB_URI=your_mongodb_atlas_connection_string
   JWT_SECRET=your_random_secret_key_here
   GEMINI_API_KEY=your_gemini_api_key
   AGORA_APP_ID=your_agora_app_id
   AGORA_APP_CERTIFICATE=your_agora_certificate
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_email_app_password
   CLIENT_URL=https://your-vercel-domain.vercel.app
   NODE_ENV=production
   ```

6. Click "Deploy"

### Option B: Using Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
cd healthcare-ai-platform
vercel

# Follow the prompts
# Set environment variables when prompted
```

## Step 4: Configure Environment Variables

After deployment, go to your Vercel project settings:

1. Navigate to Settings → Environment Variables
2. Add all required variables:

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/healthai` |
| `JWT_SECRET` | Secret key for JWT tokens | `your-super-secret-key-min-32-chars` |
| `GEMINI_API_KEY` | Google Gemini API key | `AIza...` |
| `AGORA_APP_ID` | Agora app ID for video | `abc123...` |
| `AGORA_APP_CERTIFICATE` | Agora certificate | `xyz789...` |
| `EMAIL_USER` | Email for notifications | `your-email@gmail.com` |
| `EMAIL_PASS` | Email app password | `your-app-password` |
| `CLIENT_URL` | Your Vercel domain | `https://your-app.vercel.app` |
| `NODE_ENV` | Environment | `production` |

## Step 5: Update API URLs

After deployment, update the API base URL in your client:

1. Open `client/src/services/api.js`
2. Update the base URL to your Vercel backend URL

```javascript
const API_URL = import.meta.env.VITE_API_URL || 'https://your-vercel-app.vercel.app/api';
```

3. Add to `client/.env`:
```
VITE_API_URL=https://your-vercel-app.vercel.app/api
```

## Step 6: Verify Deployment

1. Visit your Vercel URL
2. Test the following:
   - [ ] User registration
   - [ ] User login
   - [ ] Dashboard loads
   - [ ] Report upload works
   - [ ] AI chat works
   - [ ] Doctor booking works
   - [ ] Video consultation works

## Troubleshooting

### Build Fails

1. Check build logs in Vercel dashboard
2. Ensure all dependencies are in package.json
3. Verify Node.js version compatibility

### API Errors

1. Check environment variables are set correctly
2. Verify MongoDB connection string
3. Check CORS settings in server

### Database Connection Issues

1. Whitelist Vercel IPs in MongoDB Atlas
2. Use correct connection string format
3. Ensure database user has proper permissions

### Email Not Sending

1. Use Gmail app password (not regular password)
2. Enable "Less secure app access" if needed
3. Verify EMAIL_USER and EMAIL_PASS are correct

## Continuous Deployment

Vercel automatically deploys when you push to GitHub:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

## Custom Domain (Optional)

1. Go to Vercel project settings
2. Navigate to Domains
3. Add your custom domain
4. Update DNS records as instructed
5. Update CLIENT_URL environment variable

## Monitoring

1. Check Vercel Analytics for traffic
2. Monitor MongoDB Atlas for database usage
3. Set up error tracking (Sentry recommended)

## Scaling

For production use:
1. Upgrade MongoDB Atlas tier
2. Consider Vercel Pro for better performance
3. Implement caching (Redis)
4. Add CDN for static assets

## Security Checklist

- [ ] All environment variables are set
- [ ] JWT_SECRET is strong and unique
- [ ] MongoDB has proper access controls
- [ ] CORS is configured correctly
- [ ] File upload limits are set
- [ ] Rate limiting is enabled
- [ ] HTTPS is enforced

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Review MongoDB Atlas logs
3. Check browser console for errors
4. Review server logs in Vercel Functions

## Backup Strategy

1. Enable MongoDB Atlas automated backups
2. Export user data regularly
3. Keep local development database synced
4. Document all configuration changes
