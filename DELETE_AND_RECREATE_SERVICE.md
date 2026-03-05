# Nuclear Option: Delete and Recreate Railway Service

## Problem
- Railway stuck on old commit `aa3ff79c` (2 weeks old)
- Can't delete or change the old deployment
- Latest commits (`7b21726`) not deploying
- Logs are empty/not loading

## Solution: Delete Service and Create Fresh One

### Step 1: Save Your Environment Variables
**IMPORTANT:** Before deleting, save all your environment variables!

1. Go to Railway → `dpal-ai-server` → **Variables** tab
2. Copy all variables:
   - `MONGODB_URI`
   - `GEMINI_API_KEY`
   - `FRONTEND_ORIGIN`
   - `GEMINI_MODEL`
   - `GEMINI_IMAGE_MODEL`
   - Any others you have

### Step 2: Delete the Old Service
1. Go to Railway → `dpal-ai-server` → **Settings**
2. Scroll to the bottom
3. Find **"Danger Zone"** section
4. Click **"Delete Service"**
5. Confirm deletion

### Step 3: Create New Service
1. In Railway dashboard, click **"+ New"** → **"GitHub Repo"**
2. Select your `dpal-ai-server` repository
3. Railway will create a new service
4. **IMPORTANT:** Select the `main` branch

### Step 4: Configure New Service
1. Go to **Settings** → **Deploy**
2. Set **Pre-deploy Command**: `npm install && npm run build`
3. Set **Custom Start Command**: `npm start`
4. Leave **Watch Paths** empty
5. Save

### Step 5: Add Environment Variables
1. Go to **Variables** tab
2. Add all the variables you saved:
   - `MONGODB_URI` = (your MongoDB connection string)
   - `GEMINI_API_KEY` = (your Gemini API key)
   - `FRONTEND_ORIGIN` = `https://dpal-front-end.vercel.app`
   - `GEMINI_MODEL` = `gemini-3-flash-preview`
   - `GEMINI_IMAGE_MODEL` = `gemini-3-pro-image-preview`

### Step 6: Generate Domain
1. Go to **Settings** → **Networking**
2. Click **"Generate Domain"**
3. Copy the new URL (might be different from old one)

### Step 7: Update Frontend
After getting new Railway URL:
1. Go to Vercel → Your frontend project → **Settings** → **Environment Variables**
2. Update `VITE_API_BASE` to the new Railway URL
3. Redeploy frontend

## Alternative: Force Deploy via Railway CLI

If you don't want to delete, try Railway CLI:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Deploy latest commit
railway up
```

## Why This Works

Deleting and recreating:
- ✅ Forces Railway to start fresh
- ✅ Picks up latest commit from GitHub
- ✅ No old cached builds
- ✅ Clean deployment state

## Current Status

- **Latest commit in GitHub**: `7b21726` (just pushed)
- **Railway active commit**: `aa3ff79c` (stuck, 2 weeks old)
- **Issue**: Railway won't deploy new commits

**Recommended Action**: Delete the old service and create a fresh one. This is the fastest way to fix it.
