# Fix: Railway "No start command was found" Error

## Problem
Railway deployment is failing with:
```
✖ No start command was found
```

## Solution

### Step 1: Verify Railway Settings

Go to Railway Dashboard → `dpal-ai-server` → **Settings** → **Deploy**

**Required Settings:**
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Root Directory**: (leave empty or `/`)

### Step 2: If Settings Are Correct But Still Failing

Railway might be using the wrong buildpack. Try:

1. **Go to Settings → Deploy**
2. **Clear the Build Command** (leave it empty)
3. **Set Start Command** to: `npm start`
4. **Save**
5. **Redeploy**

Railway should auto-detect from:
- `package.json` scripts
- `Procfile` (we have `web: npm start`)
- `railway.toml` (we have `startCommand = "npm start"`)

### Step 3: Alternative - Use Direct Node Command

If `npm start` still doesn't work, try:

**Start Command**: `node dist/index.js`

But first make sure the build completes successfully!

### Step 4: Check Build Logs

After setting the commands, check **Build Logs**:

**Should see:**
```
npm install
npm run build
tsc (TypeScript compilation)
```

**Should NOT see:**
```
No start command was found
```

### Step 5: Verify Build Output

After build completes, check if `dist/index.js` exists:
- Build should create `dist/` directory
- `dist/index.js` should be the compiled server

## Current Configuration Files

We have:
- ✅ `Procfile`: `web: npm start`
- ✅ `package.json`: `"start": "node dist/index.js"`
- ✅ `railway.toml`: `startCommand = "npm start"` + `buildCommand = "npm install && npm run build"`
- ✅ `nixpacks.toml`: `[start] cmd = "npm start"`

Railway should detect one of these. If it's still failing, the issue is in Railway's dashboard settings.
