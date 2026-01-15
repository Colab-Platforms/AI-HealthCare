# Vercel 500 Error - Troubleshooting Guide

## 🔴 Error: POST /api/auth/register 500 (Internal Server Error)

This error means the server is crashing. Here's how to fix it:

---

## ✅ Solution Steps

### Step 1: Check Vercel Function Logs

1. Go to your Vercel dashboard
2. Click on your project
3. Go to "Deployments" tab
4. Click on the latest deployment
5. Click "Functions" tab
6. Look for error messages

**Common errors you might see:**
- "Cannot connect to MongoDB"
- "JWT_SECRET is not defined"
- "Module not found"

---

### Step 2: Verify Environment Variables

Go to Vercel → Settings → Environment Variables

**Make sure ALL these are set:**

```
✅ MONGODB_URI
✅ JWT_SECRET
✅ OPENROUTER_API_KEY (or GEMINI_API_KEY)
✅ SMTP_HOST
✅ SMTP_PORT
✅ SMTP_USER
✅ SMTP_PASS
✅ FROM_EMAIL
✅ AGORA_APP_ID
✅ AGORA_APP_CERTIFICATE
✅ NODE_ENV = production
✅ CLIENT_URL = https://your-app.vercel.app
```

**After adding/updating variables:**
- Vercel will automatically redeploy
- Wait 2-3 minutes for the new deployment

---

### Step 3: Check MongoDB Atlas

1. Go to MongoDB Atlas dashboard
2. Click "Network Access" in left sidebar
3. **Add IP Address**: `0.0.0.0/0` (allows all IPs)
4. Click "Confirm"

**Why?** Vercel uses dynamic IPs, so you need to allow all IPs.

---

### Step 4: Test the API Directly

Open this URL in your browser:
```
https://ai-diagnostic-smoky.vercel.app/api/health-check
```

**Expected response:**
```json
{
  "status": "ok",
  "message": "Healthcare AI Platform API"
}
```

**If you get an error:**
- The server isn't starting properly
- Check Vercel function logs
- Verify environment variables

---

### Step 5: Check Database Connection

The most common issue is MongoDB connection. Verify:

1. **Connection String Format:**
   ```
   mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
   ```

2. **Special Characters in Password:**
   If your password has special characters like `@`, `#`, `$`, etc., they need to be URL-encoded:
   - `@` → `%40`
   - `#` → `%23`
   - `$` → `%24`
   - `&` → `%26`

3. **Test Connection:**
   Your current connection string:
   ```
   mongodb+srv://AI-Healthcare:Healthcare123@cluster0.ij9yb3s.mongodb.net/healthcare-ai?retryWrites=true&w=majority
   ```
   This looks correct (no special characters in password).

---

## 🔧 Quick Fixes

### Fix 1: Redeploy with Correct Config

I've updated the files. Now push to GitHub:

```bash
cd healthcare-ai-platform
git add .
git commit -m "Fix Vercel serverless configuration"
git push origin main
```

Vercel will automatically redeploy.

### Fix 2: Check Client API URL

The client is correctly using relative URLs (`/api`), which is good for Vercel.

### Fix 3: Verify All Dependencies

Make sure `server/package.json` has all dependencies:

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^8.0.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "multer": "^1.4.5-lts.1",
    "axios": "^1.6.2",
    "nodemailer": "^7.0.12",
    "node-cron": "^4.2.1",
    "agora-token": "^2.0.5",
    "pdf-parse": "^1.1.1",
    "uuid": "^13.0.0",
    "express-validator": "^7.0.1"
  }
}
```

---

## 📊 Debugging Checklist

### Before Redeploying:

- [ ] All environment variables set in Vercel
- [ ] MongoDB Atlas IP whitelist includes `0.0.0.0/0`
- [ ] `CLIENT_URL` matches your Vercel URL
- [ ] `NODE_ENV` is set to `production`
- [ ] Latest code pushed to GitHub

### After Redeploying:

- [ ] Check Vercel function logs for errors
- [ ] Test `/api/health-check` endpoint
- [ ] Try registering a new user
- [ ] Check browser console for errors
- [ ] Check Network tab in DevTools

---

## 🎯 Most Common Issues & Solutions

### Issue 1: "Cannot connect to MongoDB"
**Solution:**
- Add `0.0.0.0/0` to MongoDB Atlas Network Access
- Verify MONGODB_URI is correct
- Check MongoDB Atlas cluster is running

### Issue 2: "JWT_SECRET is not defined"
**Solution:**
- Add JWT_SECRET to Vercel environment variables
- Redeploy after adding

### Issue 3: "Module not found"
**Solution:**
- Check all dependencies are in package.json
- Vercel will install them automatically

### Issue 4: "CORS error"
**Solution:**
- Verify CLIENT_URL is set correctly
- Should match your Vercel URL exactly

### Issue 5: "Function timeout"
**Solution:**
- MongoDB connection might be slow
- Check MongoDB Atlas region (should be close to Vercel region)
- Consider upgrading MongoDB Atlas tier

---

## 🔍 How to Read Vercel Logs

1. Go to Vercel Dashboard
2. Click your project
3. Click "Deployments"
4. Click latest deployment
5. Click "Functions" tab
6. Click on `/api/index`
7. Scroll down to see logs

**Look for:**
- Red error messages
- "Error:" or "Failed:" messages
- Stack traces
- Connection errors

---

## 💡 Testing Locally First

Before deploying, test locally:

```bash
# Terminal 1 - Server
cd healthcare-ai-platform/server
npm start

# Terminal 2 - Client
cd healthcare-ai-platform/client
npm run dev
```

If it works locally but not on Vercel:
- Environment variables issue
- MongoDB network access issue
- Vercel configuration issue

---

## 🚀 After Fixing

Once you've made changes:

1. **Commit and push:**
   ```bash
   git add .
   git commit -m "Fix deployment issues"
   git push origin main
   ```

2. **Wait for Vercel to redeploy** (2-3 minutes)

3. **Test the endpoints:**
   - `/api/health-check`
   - `/api/auth/register`
   - `/api/auth/login`

4. **Check the UI:**
   - Try registering a new user
   - Try logging in
   - Check browser console for errors

---

## 📞 Still Having Issues?

### Check These:

1. **Vercel Function Logs** - Most important!
2. **MongoDB Atlas Logs** - Check for connection attempts
3. **Browser Console** - Check for client-side errors
4. **Network Tab** - Check API request/response

### Get Help:

1. Copy the error from Vercel function logs
2. Check MongoDB Atlas monitoring
3. Verify all environment variables
4. Try deploying a simple test endpoint first

---

## ✅ Success Indicators

You'll know it's working when:

- ✅ `/api/health-check` returns `{"status":"ok"}`
- ✅ Registration creates a new user
- ✅ Login returns a JWT token
- ✅ Dashboard loads user data
- ✅ No 500 errors in console

---

## 📝 Current Status

**Your deployment URL:** https://ai-diagnostic-smoky.vercel.app

**Next steps:**
1. Push the updated code to GitHub
2. Wait for Vercel to redeploy
3. Check function logs
4. Test registration again

---

**Last Updated:** January 2025
