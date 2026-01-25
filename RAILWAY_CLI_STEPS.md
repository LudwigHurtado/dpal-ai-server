# Railway CLI - Step by Step

## Step 1: Login (You Already Did This ✅)
```bash
railway login
```
This should have opened your browser. If not, it might have completed silently.

## Step 2: Link to Your Service
```bash
cd c:\DPAL\dpal-ai-server
railway link
```

When you run `railway link`, it will:
1. Show you a list of your Railway projects
2. Ask you to select the project (choose "dazzling-upliftment")
3. Ask you to select the service (choose "dpal-ai-server")

## Step 3: Verify Link
```bash
railway status
```
This should show your service information if linked correctly.

## Step 4: Force Deploy
```bash
railway up
```
This will deploy the latest code from your current directory.

## Step 5: Check Deployment
After `railway up`, check:
- Railway dashboard → Deployments (should show new deployment)
- Build Logs (should show npm install, npm run build)
- Runtime Logs (should show server starting)

## If `railway link` Doesn't Work

Try specifying the service directly:
```bash
railway link --service dpal-ai-server
```

Or if you know your project ID:
```bash
railway link --project <project-id>
```

## Alternative: Manual Deploy via Dashboard

If CLI doesn't work, go back to Railway dashboard:
1. Railway → Deployments
2. Click "Deploy" button (top right)
3. Select "Deploy Latest Commit"
4. This should pick up commit `7b21726`
