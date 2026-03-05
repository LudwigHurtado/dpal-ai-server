# Fix: Railway Auto-Detecting Wrong Environment Variables

## Problem
Railway is auto-detecting environment variables from `.env.example` and setting them to localhost values, even after you manually change them.

## Why This Happens
Railway scans your codebase for:
- `.env.example` files
- Environment variable patterns in code
- And auto-creates variables with those values

## Solution: Override in Railway Dashboard

### Step 1: Go to Variables Tab
Railway → `web` service → **Variables** tab

### Step 2: Edit Each Variable

**For `ALLOWED_ORIGIN`:**
1. Click on the variable
2. Change value to: `https://dpal-front-end.vercel.app`
3. Click **"Save"** or **"Update"**

**For `FRONTEND_ORIGIN`:**
1. Click on the variable
2. Change value to: `https://dpal-front-end.vercel.app`
3. Click **"Save"** or **"Update"**

**For `MONGODB_URI`:**
1. Click on the variable
2. Get the value from: Railway → MongoDB service → Variables → `MONGO_URL`
3. Copy that connection string
4. Paste it as the value
5. Click **"Save"**

**For `NODE_ENV`:**
1. Click on the variable
2. Change value to: `production`
3. Click **"Save"**

### Step 3: Remove Unnecessary Variables

**Remove `ALLOWED_ORIGIN` if you have `FRONTEND_ORIGIN`:**
- You only need `FRONTEND_ORIGIN` (the backend code uses this)
- `ALLOWED_ORIGIN` might be a duplicate

### Step 4: Verify After Saving

After updating each variable:
1. Make sure the value is saved (not reverting to localhost)
2. If it keeps reverting, Railway might be re-detecting from code

### Step 5: If Variables Keep Reverting

**Option A: Update `.env.example` (I just did this)**
- I updated `.env.example` with production values
- Push the change and Railway should pick up the new defaults

**Option B: Disable Auto-Detection**
- Railway might not have this option, but you can manually override
- After setting values, click **"Deploy"** to lock them in

**Option C: Delete and Re-add Variables**
1. Delete the variable
2. Click **"+ New Variable"**
3. Add it manually with correct value
4. This prevents Railway from auto-detecting

## Correct Variable Values

- `FRONTEND_ORIGIN`: `https://dpal-front-end.vercel.app`
- `FRONTEND_ORIGIN_2`: (leave empty or remove)
- `MONGODB_URI`: (get from Railway MongoDB service)
- `NODE_ENV`: `production`
- `GEMINI_API_KEY`: (your actual key)
- `GEMINI_MODEL`: `gemini-3-flash-preview`
- `GEMINI_IMAGE_MODEL`: `gemini-3-pro-image-preview`

## After Fixing Variables

1. Click **"Deploy"** or **"Apply Changes"** button
2. Watch Build Logs - should build successfully now
3. Check Runtime Logs - should see server starting
4. Test `/health` endpoint
