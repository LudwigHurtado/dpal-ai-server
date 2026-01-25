# Railway Diagnostic Checklist

## ✅ Current Status
- **Start Command**: `npm start` ✓ (CORRECT)
- **Service Status**: Online (but with warnings)
- **Warning Count**: ▲ 21 (needs investigation)

## 🔍 What to Check in Railway Dashboard

### 1. **Build Logs** (Most Important!)
Go to: **Deployments** → Latest Deployment → **Build Logs**

**Look for:**
- ✅ `npm install` completes successfully
- ✅ `npm run build` runs (TypeScript compilation)
- ✅ `tsc` creates files in `dist/` directory
- ✅ No TypeScript errors or missing dependencies

**If you see errors:**
- Missing dependencies → Check `package.json`
- TypeScript errors → Fix code issues
- Build timeout → Increase build timeout in Railway settings

### 2. **Runtime Logs** (Critical!)
Go to: **Logs** tab (real-time logs)

**✅ CORRECT (Backend Running):**
```
✅ Mongo connected
✅ DPAL server running on port 8080
```

**❌ WRONG (Static Files or Crashes):**
```
server running (Caddy)
handled request (static files)
❌ Failed to start server: [error]
❌ uncaughtException: [error]
```

**Common Issues:**
- `Cannot find module` → Build didn't create `dist/` files
- `MongoDB connection failed` → Check `MONGODB_URI` variable
- `Port already in use` → Railway sets PORT automatically
- `GEMINI_API_KEY is not configured` → Set environment variable

### 3. **Environment Variables**
Go to: **Variables** tab

**Required Variables:**
- ✅ `MONGODB_URI` - MongoDB connection string (optional, but recommended)
- ✅ `GEMINI_API_KEY` - Google Gemini API key (required for AI features)
- ✅ `FRONTEND_ORIGIN` - `https://dpal-front-end.vercel.app` (for CORS)
- ✅ `PORT` - Railway sets this automatically (don't set manually)

**To Check:**
1. Click **Variables** tab
2. Verify all required variables are set
3. Check for typos in variable names
4. Make sure values don't have extra spaces

### 4. **Test the Health Endpoint**

After checking logs, test if backend is actually running:

**In Browser:**
Visit: `https://dpal-ai-server-production.up.railway.app/health`

**✅ Should Return (JSON):**
```json
{"ok": true, "service": "dpal-ai-server"}
```

**❌ Wrong (HTML):**
```html
<!DOCTYPE html>
<html>...
```

If you get HTML, Railway is still serving static files, not running the backend.

### 5. **Check Build Output**

In Railway → **Deployments** → Latest → **Build Logs**

Look for:
```
> npm run build
> tsc

[TypeScript compilation output]
```

Should create:
- `dist/index.js`
- `dist/routes/`
- `dist/models/`
- etc.

### 6. **Redeploy if Needed**

If settings are correct but still not working:
1. Go to **Deployments**
2. Click **"Redeploy"** on latest deployment
3. Watch **Build Logs** and **Runtime Logs**
4. Wait for deployment to complete

## 🚨 Common Issues & Fixes

### Issue: "Cannot find module 'dist/index.js'"
**Fix:** Build is failing. Check Build Logs for TypeScript errors.

### Issue: "Backend returns HTML instead of JSON"
**Fix:** Railway is serving static files. Verify Start Command is `npm start` and redeploy.

### Issue: "Service shows Online but API calls fail"
**Fix:** Check Runtime Logs for crash errors. Service might be starting then crashing.

### Issue: "MongoDB connection failed"
**Fix:** 
1. Check `MONGODB_URI` variable is set correctly
2. Verify MongoDB service is "Online" in Railway
3. Check MongoDB connection string format

### Issue: "GEMINI_API_KEY is not configured"
**Fix:** Set `GEMINI_API_KEY` variable in Railway → Variables

## 📋 Next Steps

1. **Check Build Logs** - Look for build errors
2. **Check Runtime Logs** - See if server is actually starting
3. **Check Variables** - Verify all required env vars are set
4. **Test /health endpoint** - Confirm backend is running (not static files)
5. **Share findings** - Let me know what you see in the logs!
