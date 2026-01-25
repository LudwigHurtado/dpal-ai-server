# Force Deploy Using Railway CLI

## Alternative to Deleting Service

If you don't want to delete the service, you can force deploy using Railway CLI.

### Step 1: Install Railway CLI
```bash
npm install -g @railway/cli
```

### Step 2: Login
```bash
railway login
```
This will open your browser to authenticate.

### Step 3: Link to Your Project
```bash
cd c:\DPAL\dpal-ai-server
railway link
```
Select your `dpal-ai-server` service when prompted.

### Step 4: Force Deploy
```bash
railway up
```
This will force Railway to deploy the latest commit from your current branch.

### Step 5: Verify
After deployment:
- Check Railway dashboard → Deployments
- Should see new deployment with latest commit
- Check Build Logs for `npm install`, `npm run build`
- Check Runtime Logs for `✅ DPAL server running`
