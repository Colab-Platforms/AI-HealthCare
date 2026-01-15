# Environment Variables Setup Guide for Vercel

## 🚨 IMPORTANT: DO NOT Change Your Local .env File!

Your local `.env` file should stay as is for development. The changes below are ONLY for Vercel's environment variables dashboard.

---

## Current .env File (Local Development)

Your current setup:
```env
PORT=5000
MONGODB_URI=mongodb+srv://AI-Healthcare:Healthcare123@cluster0.ij9yb3s.mongodb.net/healthcare-ai?retryWrites=true&w=majority
JWT_SECRET=healthcare-ai-super-secret-jwt-key-2024
OPENROUTER_API_KEY=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
APP_URL=http://192.168.1.197:5173
NODE_ENV=development
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tech@colabplatforms.com
SMTP_PASS=akbq icwm jdmi xtrb
FROM_EMAIL=HealthAI <tech@colabplatforms.com>
AGORA_APP_ID=e788e8f838484d4dafe4705d682df57c
AGORA_APP_CERTIFICATE=086ed4e93fc6454d9025ab369959cb1a
```

---

## ✅ What to Add in Vercel Dashboard

Go to your Vercel project → Settings → Environment Variables

Add these variables (copy-paste the values):

### 1. Database
```
Variable Name: MONGODB_URI
Value: mongodb+srv://AI-Healthcare:Healthcare123@cluster0.ij9yb3s.mongodb.net/healthcare-ai?retryWrites=true&w=majority
```

### 2. Authentication
```
Variable Name: JWT_SECRET
Value: healthcare-ai-super-secret-jwt-key-2024
```

### 3. AI API (OpenRouter/Gemini)
```
Variable Name: OPENROUTER_API_KEY
Value: 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
```

**OR** if you want to use Gemini instead:
```
Variable Name: GEMINI_API_KEY
Value: [Get from https://makersuite.google.com/app/apikey]
```

### 4. Email Configuration
```
Variable Name: SMTP_HOST
Value: smtp.gmail.com

Variable Name: SMTP_PORT
Value: 587

Variable Name: SMTP_USER
Value: tech@colabplatforms.com

Variable Name: SMTP_PASS
Value: akbq icwm jdmi xtrb

Variable Name: FROM_EMAIL
Value: HealthAI <tech@colabplatforms.com>
```

### 5. Video Conference (Agora)
```
Variable Name: AGORA_APP_ID
Value: e788e8f838484d4dafe4705d682df57c

Variable Name: AGORA_APP_CERTIFICATE
Value: 086ed4e93fc6454d9025ab369959cb1a
```

### 6. Production Settings (MUST CHANGE)
```
Variable Name: NODE_ENV
Value: production

Variable Name: CLIENT_URL
Value: https://your-app-name.vercel.app
(Replace with your actual Vercel URL after first deployment)

Variable Name: APP_URL
Value: https://your-app-name.vercel.app
(Replace with your actual Vercel URL after first deployment)
```

---

## 🔄 Two-Step Deployment Process

### Step 1: Initial Deployment
1. Add all variables above to Vercel
2. For `CLIENT_URL` and `APP_URL`, temporarily use: `https://localhost:3000`
3. Deploy the project
4. Vercel will give you a URL like: `https://your-app-name.vercel.app`

### Step 2: Update URLs
1. Go back to Vercel → Settings → Environment Variables
2. Update `CLIENT_URL` to your actual Vercel URL
3. Update `APP_URL` to your actual Vercel URL
4. Redeploy (Vercel will auto-redeploy when you change env vars)

---

## 📋 Complete Vercel Environment Variables List

Copy this checklist and paste values in Vercel:

```
✅ MONGODB_URI = mongodb+srv://AI-Healthcare:Healthcare123@cluster0.ij9yb3s.mongodb.net/healthcare-ai?retryWrites=true&w=majority

✅ JWT_SECRET = healthcare-ai-super-secret-jwt-key-2024

✅ OPENROUTER_API_KEY = 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

✅ SMTP_HOST = smtp.gmail.com

✅ SMTP_PORT = 587

✅ SMTP_USER = tech@colabplatforms.com

✅ SMTP_PASS = akbq icwm jdmi xtrb

✅ FROM_EMAIL = HealthAI <tech@colabplatforms.com>

✅ AGORA_APP_ID = e788e8f838484d4dafe4705d682df57c

✅ AGORA_APP_CERTIFICATE = 086ed4e93fc6454d9025ab369959cb1a

✅ NODE_ENV = production

✅ CLIENT_URL = https://your-app-name.vercel.app (UPDATE AFTER FIRST DEPLOY)

✅ APP_URL = https://your-app-name.vercel.app (UPDATE AFTER FIRST DEPLOY)
```

---

## 🔒 Security Recommendations

### For Production (Optional but Recommended):

1. **Generate New JWT Secret**
   ```bash
   # Run this in terminal to generate a secure random string
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Use the output as your new `JWT_SECRET`

2. **MongoDB Atlas Security**
   - Go to MongoDB Atlas → Network Access
   - Add IP: `0.0.0.0/0` (allows Vercel to connect)
   - Or add specific Vercel IPs if you want tighter security

3. **Email Security**
   - Your current Gmail app password is exposed in the .env
   - Consider creating a new app-specific password for production
   - Go to: https://myaccount.google.com/apppasswords

4. **Agora Security**
   - Your current Agora credentials are working
   - For production, consider creating a separate Agora project
   - This helps track usage separately

---

## 🚫 What NOT to Change

Keep these the same:
- ✅ MONGODB_URI (your current one works)
- ✅ SMTP credentials (already working)
- ✅ AGORA credentials (already working)
- ✅ OPENROUTER_API_KEY (already working)

Only change:
- ❌ PORT (Vercel handles this automatically)
- ✅ NODE_ENV → `production`
- ✅ CLIENT_URL → Your Vercel URL
- ✅ APP_URL → Your Vercel URL

---

## 📝 Step-by-Step Vercel Setup

### 1. Go to Vercel Dashboard
https://vercel.com/dashboard

### 2. Import Your GitHub Repository
- Click "Add New Project"
- Select "Import Git Repository"
- Choose: `Colab-Platforms/AI-Diagnostic`

### 3. Configure Project
- Framework Preset: **Other**
- Root Directory: `./`
- Build Command: (leave empty)
- Output Directory: (leave empty)

### 4. Add Environment Variables
Click "Environment Variables" and add all variables from the list above.

**Pro Tip**: You can add them all at once by clicking "Add Another" after each one.

### 5. Deploy
Click "Deploy" button

### 6. Wait for Deployment
- First deployment takes 2-3 minutes
- Watch the build logs for any errors

### 7. Get Your URL
After deployment, Vercel gives you a URL like:
`https://ai-diagnostic-xyz123.vercel.app`

### 8. Update URLs
Go back to Environment Variables and update:
- `CLIENT_URL` = your Vercel URL
- `APP_URL` = your Vercel URL

### 9. Redeploy
Vercel will automatically redeploy when you change environment variables.

---

## 🧪 Testing After Deployment

Visit your Vercel URL and test:

1. **Homepage loads** ✓
2. **User registration works** ✓
3. **Login works** ✓
4. **Dashboard loads** ✓
5. **AI Chat works** ✓
6. **Report upload works** ✓
7. **Email notifications work** ✓
8. **Video calls work** ✓

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to database"
**Solution**: 
- Check MongoDB Atlas Network Access
- Add IP: `0.0.0.0/0`
- Verify MONGODB_URI is correct

### Issue: "JWT token invalid"
**Solution**:
- Verify JWT_SECRET is set in Vercel
- Clear browser cookies and try again

### Issue: "Email not sending"
**Solution**:
- Verify SMTP credentials
- Check Gmail app password is correct
- Ensure "Less secure app access" is enabled

### Issue: "Video call not working"
**Solution**:
- Verify AGORA_APP_ID and AGORA_APP_CERTIFICATE
- Check Agora console for usage limits
- Ensure Agora project is active

### Issue: "AI Chat not responding"
**Solution**:
- Verify OPENROUTER_API_KEY is set
- Check API key is valid
- Check API usage limits

---

## 📊 Environment Variables Summary

| Variable | Current Value | Change for Vercel? | Notes |
|----------|---------------|-------------------|-------|
| MONGODB_URI | ✅ Set | ❌ No | Keep same |
| JWT_SECRET | ✅ Set | ❌ No | Keep same (or generate new) |
| OPENROUTER_API_KEY | ✅ Set | ❌ No | Keep same |
| SMTP_* | ✅ Set | ❌ No | Keep same |
| AGORA_* | ✅ Set | ❌ No | Keep same |
| NODE_ENV | development | ✅ Yes | Change to `production` |
| CLIENT_URL | localhost | ✅ Yes | Change to Vercel URL |
| APP_URL | localhost | ✅ Yes | Change to Vercel URL |
| PORT | 5000 | ❌ Remove | Vercel handles this |

---

## ✅ Final Checklist

Before deploying:
- [ ] All environment variables added to Vercel
- [ ] NODE_ENV set to `production`
- [ ] MongoDB Atlas IP whitelist configured
- [ ] Email credentials verified
- [ ] Agora credentials verified

After first deployment:
- [ ] Got Vercel URL
- [ ] Updated CLIENT_URL in Vercel
- [ ] Updated APP_URL in Vercel
- [ ] Tested all features
- [ ] Verified email notifications
- [ ] Tested video calls

---

## 🎉 You're Ready!

Your environment variables are already configured and working locally. Just copy them to Vercel's dashboard and you're good to go!

**No changes needed to your local .env file!**

---

**Need Help?**
- Check Vercel deployment logs
- Review MongoDB Atlas logs
- Check browser console for errors
- See DEPLOYMENT.md for detailed guide

**Last Updated**: January 2025
