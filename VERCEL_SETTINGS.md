# Vercel Project Settings

## 🎯 Quick Fix for "No Output Directory" Error

The code is now fixed! Vercel will automatically redeploy.

---

## ⚙️ Vercel Project Settings (If Needed)

If you still see errors, manually configure these in Vercel Dashboard:

### Go to: Project Settings → General

**Framework Preset:** `Other`

**Root Directory:** `./` (leave empty or use `./`)

**Build Command:**
```bash
cd client && npm install && npm run build
```

**Output Directory:**
```
client/dist
```

**Install Command:**
```bash
cd server && npm install
```

---

## 📋 Complete Vercel Configuration

### 1. General Settings

| Setting | Value |
|---------|-------|
| Framework Preset | Other |
| Root Directory | `./` |
| Build Command | `cd client && npm install && npm run build` |
| Output Directory | `client/dist` |
| Install Command | `cd server && npm install` |

### 2. Environment Variables

Add these in: **Settings → Environment Variables**

```env
MONGODB_URI=mongodb+srv://AI-Healthcare:Healthcare123@cluster0.ij9yb3s.mongodb.net/healthcare-ai?retryWrites=true&w=majority

JWT_SECRET=healthcare-ai-super-secret-jwt-key-2024

OPENROUTER_API_KEY=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

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tech@colabplatforms.com
SMTP_PASS=akbq icwm jdmi xtrb
FROM_EMAIL=HealthAI <tech@colabplatforms.com>

AGORA_APP_ID=e788e8f838484d4dafe4705d682df57c
AGORA_APP_CERTIFICATE=086ed4e93fc6454d9025ab369959cb1a

NODE_ENV=production
CLIENT_URL=https://ai-diagnostic-smoky.vercel.app
```

### 3. Functions Settings

**Function Region:** `Washington, D.C., USA (iad1)` (or closest to your MongoDB region)

**Node.js Version:** `18.x` (default)

---

## 🔄 Deployment Process

### Automatic (Recommended)
1. Push to GitHub
2. Vercel auto-deploys
3. Wait 2-3 minutes
4. Check deployment logs

### Manual
1. Go to Vercel Dashboard
2. Click "Deployments"
3. Click "Redeploy" on latest deployment
4. Select "Use existing Build Cache" = NO
5. Click "Redeploy"

---

## ✅ Verification Steps

### 1. Check Build Logs
- Go to Vercel Dashboard
- Click latest deployment
- Check "Building" tab
- Should see: "Build Completed"

### 2. Test API
Open in browser:
```
https://ai-diagnostic-smoky.vercel.app/api/health-check
```

Expected response:
```json
{
  "status": "ok",
  "message": "Healthcare AI Platform API"
}
```

### 3. Test Frontend
Open:
```
https://ai-diagnostic-smoky.vercel.app
```

Should see the landing page.

### 4. Test Registration
- Click "Get Started"
- Fill registration form
- Should create account successfully

---

## 🐛 Common Issues

### Issue: "No Output Directory found"
**Solution:** 
- Already fixed in latest code
- Vercel will auto-redeploy
- If not, manually set Output Directory to `client/dist`

### Issue: "Build failed"
**Solution:**
- Check build logs in Vercel
- Verify `client/package.json` has `build` script
- Try manual redeploy without cache

### Issue: "Function error"
**Solution:**
- Check environment variables are set
- Verify MongoDB Atlas allows `0.0.0.0/0`
- Check function logs for specific error

### Issue: "404 on API routes"
**Solution:**
- Verify `api/index.js` exists
- Check `vercel.json` routes configuration
- Redeploy

---

## 📊 Project Structure

```
healthcare-ai-platform/
├── api/
│   └── index.js          ← Vercel serverless entry
├── client/
│   ├── dist/             ← Build output (created by Vite)
│   ├── src/
│   └── package.json
├── server/
│   ├── server.js         ← Express app
│   └── package.json
└── vercel.json           ← Vercel configuration
```

---

## 🎯 What the Configuration Does

### vercel.json
- **buildCommand**: Builds the React client
- **outputDirectory**: Tells Vercel where to find built files
- **installCommand**: Installs server dependencies
- **builds**: Configures serverless function
- **routes**: Routes API calls to serverless, others to static files

### api/index.js
- Entry point for serverless functions
- Imports and exports Express app
- Sets VERCEL environment variable

### server/server.js
- Detects if running on Vercel
- Exports app for serverless
- Or starts server for local development

---

## 🚀 Deployment Checklist

Before deploying:
- [x] Code pushed to GitHub
- [x] `vercel.json` configured
- [x] `api/index.js` created
- [x] `server/server.js` updated
- [x] `client/package.json` has build script
- [ ] Environment variables set in Vercel
- [ ] MongoDB Atlas allows `0.0.0.0/0`

After deploying:
- [ ] Build completes successfully
- [ ] `/api/health-check` returns OK
- [ ] Frontend loads
- [ ] Registration works
- [ ] Login works

---

## 💡 Pro Tips

### Faster Deployments
- Use Vercel CLI: `vercel --prod`
- Enable build cache in settings
- Use preview deployments for testing

### Better Performance
- Enable Edge Functions (if available)
- Use CDN for static assets
- Optimize images

### Debugging
- Check Vercel function logs
- Use `console.log` in server code
- Check browser console for client errors
- Use Network tab to see API calls

---

## 📞 Need Help?

### Check These First:
1. Vercel deployment logs
2. Vercel function logs
3. MongoDB Atlas logs
4. Browser console

### Still Stuck?
- Review `VERCEL_TROUBLESHOOTING.md`
- Check Vercel documentation
- Verify all environment variables
- Try manual redeploy without cache

---

## ✅ Success Indicators

You'll know it's working when:

- ✅ Build completes in Vercel
- ✅ No errors in deployment logs
- ✅ `/api/health-check` returns `{"status":"ok"}`
- ✅ Frontend loads at your Vercel URL
- ✅ Can register new users
- ✅ Can login
- ✅ Dashboard loads

---

**Current Status:** Code is fixed and pushed to GitHub. Vercel should be redeploying now!

**Your URL:** https://ai-diagnostic-smoky.vercel.app

**Next:** Wait 2-3 minutes for deployment, then test!

---

**Last Updated:** January 2025
