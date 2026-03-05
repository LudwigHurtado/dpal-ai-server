# How to Set VITE_API_BASE in Vercel

## What is VITE_API_BASE?

**VITE_API_BASE** is an environment variable that tells your frontend (on Vercel) where your backend API is located (on Railway).

**Current default (fallback):** `https://web-production-a27b.up.railway.app`

## Step 1: Find Your Railway Backend URL

### Option A: Railway Dashboard (Easiest)

1. **Go to Railway Dashboard**
   - Visit: https://railway.app
   - Log in to your account

2. **Open Your Backend Service**
   - Click on your backend service (usually named `dpal-ai-server` or similar)

3. **Get the URL**
   - Go to **"Settings"** tab
   - Scroll down to **"Domains"** section
   - You'll see your Railway URL, something like:
     - `https://web-production-a27b.up.railway.app`
     - `https://dpal-ai-server-production.up.railway.app`
     - `https://your-service-name.up.railway.app`

4. **Copy the URL**
   - Copy the entire URL (including `https://`)
   - This is your backend URL!

### Option B: Railway Service Settings

1. In Railway dashboard → Your service
2. Click **"Settings"** (left sidebar)
3. Look for **"Public Domain"** or **"Custom Domain"**
4. Copy the URL shown there

### Option C: Check Railway Deployments

1. In Railway dashboard → Your service
2. Click **"Deployments"** tab
3. Look at recent deployment logs
4. The URL is often shown in the logs

## Step 2: Set VITE_API_BASE in Vercel

### Method 1: Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com
   - Log in to your account

2. **Open Your Project**
   - Click on your frontend project (the one deployed on Vercel)

3. **Go to Settings**
   - Click **"Settings"** tab (top navigation)

4. **Open Environment Variables**
   - Click **"Environment Variables"** in the left sidebar

5. **Add New Variable**
   - Click **"Add New"** button
   - **Key:** `VITE_API_BASE`
   - **Value:** Your Railway URL (e.g., `https://web-production-a27b.up.railway.app`)
   - **Environment:** Select all (Production, Preview, Development)
   - Click **"Save"**

6. **Redeploy**
   - After adding the variable, you need to redeploy
   - Go to **"Deployments"** tab
   - Click the **"..."** menu on the latest deployment
   - Click **"Redeploy"**
   - Or push a new commit to trigger auto-deploy

### Method 2: Vercel CLI

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login
vercel login

# Link your project
vercel link

# Add environment variable
vercel env add VITE_API_BASE

# When prompted, enter your Railway URL:
# https://web-production-a27b.up.railway.app

# Select environments (Production, Preview, Development)
```

## Step 3: Verify It's Set

### Check in Vercel

1. Go to Vercel → Your Project → Settings → Environment Variables
2. You should see `VITE_API_BASE` listed
3. Value should be your Railway URL

### Test in Your App

1. Open your deployed app on Vercel
2. Open the **BackendTestPanel** (bottom-right corner)
3. Check the "Environment Variables" test
4. It should show: `VITE_API_BASE: https://your-railway-url.up.railway.app`

## Important Notes

### ✅ Do's

- **Include `https://`** in the URL
- **No trailing slash** (the code handles this automatically, but cleaner without it)
- **Set for all environments** (Production, Preview, Development)
- **Redeploy after adding** the variable

### ❌ Don'ts

- Don't include `/api` or any path - just the base URL
- Don't use `http://` (use `https://`)
- Don't forget to redeploy after adding the variable

## Example

**Correct:**
```
VITE_API_BASE = https://web-production-a27b.up.railway.app
```

**Wrong:**
```
VITE_API_BASE = https://web-production-a27b.up.railway.app/  (trailing slash)
VITE_API_BASE = https://web-production-a27b.up.railway.app/api  (includes /api)
VITE_API_BASE = web-production-a27b.up.railway.app  (missing https://)
```

## What Happens If It's Not Set?

If `VITE_API_BASE` is not set in Vercel:
- The app will use the **fallback default**: `https://web-production-a27b.up.railway.app`
- This might work if that's your actual Railway URL
- But if your Railway URL is different, API calls will fail with 404 errors

## Troubleshooting

### "I can't find my Railway URL"

1. Check Railway dashboard → Settings → Domains
2. If no domain is shown, Railway might not have assigned one yet
3. Wait for deployment to complete, then check again
4. Or check Railway logs - the URL is often shown there

### "The variable isn't working after setting it"

1. **Redeploy your Vercel app** - Environment variables only apply to new deployments
2. Check that you set it for the correct environment (Production/Preview)
3. Verify the URL is correct (no typos, includes https://)
4. Check browser console for errors

### "How do I know if it's working?"

1. Open your app on Vercel
2. Open BackendTestPanel
3. Run tests
4. Check "Environment Variables" test - should show your Railway URL
5. If "Backend Health Check" passes, it's working!

## Quick Checklist

- [ ] Found Railway URL in Railway dashboard
- [ ] Copied the full URL (with https://)
- [ ] Went to Vercel → Project → Settings → Environment Variables
- [ ] Added `VITE_API_BASE` with Railway URL as value
- [ ] Selected all environments (Production, Preview, Development)
- [ ] Saved the variable
- [ ] Redeployed the Vercel app
- [ ] Verified in BackendTestPanel that it's working

---

**Once set, your frontend will know where to find your backend!** 🚀
