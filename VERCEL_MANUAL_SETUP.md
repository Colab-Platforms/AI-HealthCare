# Vercel Manual Setup - Fix 404 Error

## 🔴 Problem: 404 NOT_FOUND

This means Vercel can't find your built files. You need to configure the build settings in Vercel Dashboard.

---

## ✅ SOLUTION: Configure in Vercel Dashboard

### Step 1: Go to Project Settings

1. Open https://vercel.com/dashboard
2. Click on your project: **ai-diagnostic-smoky**
3. Click **Settings** (top menu)
4. Click **General** (left sidebar)

---

### Step 2: Configure Build & Development Settings

Scroll down to **Build & Development Settings** section.

#### Set These Values:

**Framework Preset:**
```
Other
```

**Root Directory:**
```
./
```
(Leave empty or use `./`)

**Build Command:**
```
cd client && npm install && npm run build && cd ../server && npm install
```

**Output Directory:**
```
client/dist
```

**Install Command:**
```
npm install --prefix client && npm install --prefix server
```

---

### Step 3: Save and Redeploy

1. Click **Save** at the bottom
2. Go to **Deployments** tab
3. Click **Redeploy** on the latest deployment
4. **IMPORTANT:** Uncheck "Use existing Build Cache"
5. Click **Redeploy**

---

## 🎯 Alternative: Simpler Configuration

If the above doesn't work, try this simpler setup:

### Build Command:
```
cd client && npm run build
```

### Output Directory:
```
client/dist
```

### Install Command:
```
cd client && npm install
```

---

## 📋 Complete Settings Checklist

In Vercel Dashboard → Settings → General:

- [ ] Framework Preset = `Other`
- [ ] Root Directory = `./` (or empty)
- [ ] Build Command = `cd client && npm run build`
- [ ] Output Directory = `client/dist`
- [ ] Install Command = `cd client && npm install`
- [ ] Node.js Version = `18.x`

---

## 🔄 After Saving Settings

1. **Go to Deployments tab**
2. **Click "Redeploy"** on latest deployment
3. **Uncheck "Use existing Build Cache"** ← IMPORTANT!
4. **Click "Redeploy"**
5. **Wait 2-3 minutes** for build to complete

---

## ✅ Verify Build Success

### 1. Check Build Logs

In Vercel Dashboard:
1. Click on the deployment
2. Click "Building" tab
3. Look for:
   ```
   ✓ Build Completed
   ✓ Output Directory: client/dist
   ```

### 2. Check Output

Should see:
```
✓ Compiled successfully
✓ dist/index.html
✓ dist/assets/...
```

### 3. Test Your Site

Open: `https://ai-diagnostic-smoky.vercel.app`

Should see your landing page, not 404!

---

## 🐛 Still Getting 404?

### Check These:

#### 1. Build Logs Show Success?
- Go to deployment → Building tab
- Should say "Build Completed"
- Should show files in `client/dist`

#### 2. Output Directory Correct?
- Must be exactly: `client/dist`
- Not `dist` or `./client/dist`

#### 3. Build Command Runs?
- Check build logs
- Should see: `vite build`
- Should see: `✓ built in X seconds`

#### 4. Files Actually Built?
- In build logs, look for:
  ```
  dist/index.html
  dist/assets/index-xxx.js
  dist/assets/index-xxx.css
  ```

---

## 💡 Quick Fix Steps

### Option 1: Use Vercel CLI (Fastest)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy from root directory
cd healthcare-ai-platform
vercel --prod

# When prompted:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? Yes
# - What's the name? ai-diagnostic-smoky
# - Overwrite settings? Yes
```

Then configure:
- Build Command: `cd client && npm run build`
- Output Directory: `client/dist`
- Install Command: `cd client && npm install`

### Option 2: Manual Dashboard Setup

Follow the steps at the top of this guide.

---

## 📊 What Should Happen

### During Build:
```
Installing dependencies...
✓ Installed dependencies

Building...
> cd client && npm run build

vite v5.4.21 building for production...
✓ 2248 modules transformed.
dist/index.html                     1.14 kB
dist/assets/index-xxx.css          55.00 kB
dist/assets/index-xxx.js        2,388.51 kB
✓ built in 11.02s

Build Completed
```

### After Deploy:
- Visit your URL
- See landing page
- No 404 error!

---

## 🎯 Correct Project Structure

Vercel needs to see:

```
healthcare-ai-platform/
├── api/
│   └── index.js          ← Serverless function
├── client/
│   ├── dist/             ← Built files (created during build)
│   │   ├── index.html
│   │   └── assets/
│   ├── src/
│   └── package.json
├── server/
│   └── ...
└── vercel.json
```

---

## 🔧 Troubleshooting Commands

### Check if build works locally:

```bash
cd healthcare-ai-platform/client
npm install
npm run build
```

Should create `dist/` folder with files.

### Check dist folder:

```bash
ls client/dist
```

Should show:
- index.html
- assets/

---

## ✅ Success Checklist

After redeploying:

- [ ] Build completes without errors
- [ ] Build logs show "Build Completed"
- [ ] Output shows `dist/index.html` created
- [ ] Visit URL - see landing page (not 404)
- [ ] Can navigate to /login, /register
- [ ] API works: `/api/health-check`

---

## 🚀 Final Steps

1. **Configure settings in Vercel Dashboard** (see Step 2 above)
2. **Save settings**
3. **Redeploy without cache**
4. **Wait 2-3 minutes**
5. **Test your URL**
6. **Should work!** 🎉

---

## 📞 Still Need Help?

### Check:
1. Vercel build logs (most important!)
2. Make sure Output Directory = `client/dist`
3. Make sure Build Command includes `cd client`
4. Try redeploying without cache

### Common Mistakes:
- ❌ Output Directory = `dist` (wrong!)
- ✅ Output Directory = `client/dist` (correct!)

- ❌ Build Command = `npm run build` (wrong!)
- ✅ Build Command = `cd client && npm run build` (correct!)

---

**The key is configuring the build settings in Vercel Dashboard!**

**Your URL:** https://ai-diagnostic-smoky.vercel.app

**Next:** Follow Step 2 above to configure build settings.

---

**Last Updated:** January 2025
