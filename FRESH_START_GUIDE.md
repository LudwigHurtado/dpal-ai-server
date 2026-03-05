# Fresh Start: Delete and Recreate Railway Service

## Step 1: Save Environment Variables (You're Doing This ✅)

Before deleting, copy these from Railway → Variables:
- `MONGODB_URI`
- `GEMINI_API_KEY`
- `FRONTEND_ORIGIN` (should be `https://dpal-front-end.vercel.app`)
- `GEMINI_MODEL` (if you have it)
- `GEMINI_IMAGE_MODEL` (if you have it)
- Any other variables you set

## Step 2: Delete Old Service

1. Go to Railway Dashboard
2. Click on `dpal-ai-server` service
3. Go to **Settings** tab
4. Scroll all the way down to **"Danger Zone"** section
5. Click **"Delete Service"** button
6. Type the service name to confirm: `dpal-ai-server`
7. Click **"Delete"** to confirm

⚠️ **Warning:** This will delete the service and all its deployments. Make sure you saved your environment variables!

## Step 3: Create New Service

1. In Railway dashboard, click **"+ New"** button (top right)
2. Select **"GitHub Repo"**
3. If prompted, authorize Railway to access GitHub
4. Find and select your `dpal-ai-server` repository
5. **IMPORTANT:** When asked for branch, select **`main`** (not master)
6. Railway will create a new service and start deploying

## Step 4: Configure Build Settings

1. Go to the new service → **Settings** → **Deploy** tab
2. Set **Pre-deploy Command**: `npm install && npm run build`
3. Set **Custom Start Command**: `npm start`
4. Leave **Watch Paths** empty (or remove `tsc` if it's there)
5. Leave **Custom Build Command** empty (or set to `npm run build`)
6. Click **"Apply"** or **"Save"**

## Step 5: Add Environment Variables

1. Go to **Variables** tab
2. Click **"+ New Variable"** for each one:

   **Variable 1:**
   - Name: `MONGODB_URI`
   - Value: (paste your MongoDB connection string)

   **Variable 2:**
   - Name: `GEMINI_API_KEY`
   - Value: (paste your Gemini API key)

   **Variable 3:**
   - Name: `FRONTEND_ORIGIN`
   - Value: `https://dpal-front-end.vercel.app`

   **Variable 4 (Optional):**
   - Name: `GEMINI_MODEL`
   - Value: `gemini-3-flash-preview`

   **Variable 5 (Optional):**
   - Name: `GEMINI_IMAGE_MODEL`
   - Value: `gemini-3-pro-image-preview`

3. Save each variable

## Step 6: Get New Railway URL

1. Go to **Settings** → **Networking** tab
2. Click **"Generate Domain"** button
3. Copy the new URL (might be different from old one)
4. It will look like: `https://dpal-ai-server-production-xxxxx.up.railway.app`

## Step 7: Watch Deployment

1. Go to **Deployments** tab
2. You should see a new deployment starting
3. Click on it → **Build Logs**
4. Should see:
   - `npm install` running
   - `npm run build` running
   - `tsc` compiling TypeScript
   - Creating `dist/index.js`

5. After build completes, check **Logs** tab (Runtime Logs)
6. Should see: `✅ DPAL server running on port 8080`

## Step 8: Test Health Endpoint

Visit your new Railway URL:
```
https://your-new-railway-url.up.railway.app/health
```

Should return JSON:
```json
{
  "ok": true,
  "service": "dpal-ai-server",
  "version": "2026-01-24-v2",
  "ts": 1234567890
}
```

If it returns HTML, something is still wrong.

## Step 9: Update Frontend

After confirming backend works:

1. Go to Vercel → Your frontend project
2. **Settings** → **Environment Variables**
3. Find `VITE_API_BASE`
4. Update it to your new Railway URL
5. Save
6. Vercel will auto-redeploy

Or update in code:
- File: `c:\DPAL_Front_End\services\geminiService.ts`
- Update the default URL if needed

## What to Expect

✅ **Correct Deployment:**
- Latest commit `7b21726` (not old `aa3ff79c`)
- Build logs show TypeScript compilation
- Runtime logs show Node.js server starting
- `/health` returns JSON

❌ **Wrong (Still Static):**
- Build logs show "Caddy" or "static files"
- Runtime logs show "server running (Caddy)"
- `/health` returns HTML

## If Something Goes Wrong

If the new service still serves static files:
1. Check Build Logs - is `npm run build` running?
2. Check Runtime Logs - is `npm start` running?
3. Verify Start Command is `npm start` in Settings
4. Try redeploying: Deployments → Redeploy

Good luck! This should give you a clean, fresh deployment with your latest backend code.
