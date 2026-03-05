# Railway Deployment Guide for DPAL Backend

## Quick Deploy Steps

### 1. Push Backend Code to GitHub
```bash
cd c:\DPAL\dpal-ai-server
git add .
git commit -m "Backend ready for Railway deployment"
git push
```

### 2. Deploy on Railway

1. **Go to Railway Dashboard**: https://railway.app
2. **Create New Project** (or use existing)
3. **Add Service** → **GitHub Repo** → Select `dpal-ai-server` repo
4. **Railway will auto-detect** Node.js and start building

### 3. Configure Environment Variables

In Railway dashboard, go to your service → **Variables** tab, add:

```
MONGODB_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_gemini_api_key
FRONTEND_ORIGIN=https://dpal-front-end.vercel.app
GEMINI_MODEL=gemini-3-flash-preview
GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview
```

**Note:** Railway automatically sets `PORT` - don't set it manually.

### 4. Configure Build Settings

Railway should auto-detect, but verify:

- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start` (or `node dist/index.js`)

### 5. Get Your Railway URL

After deployment:
1. Go to your service → **Settings** → **Networking**
2. Click **Generate Domain** (or use the auto-generated one)
3. Copy the URL (e.g., `https://dpal-ai-server-production.up.railway.app`)

### 6. Update Frontend

In Vercel, add environment variable:
- `VITE_API_BASE` = Your Railway backend URL

Or update the default in `services/geminiService.ts` if you prefer.

## Troubleshooting

### Build Fails
- Check Railway logs for errors
- Ensure `tsconfig.json` is correct
- Verify all dependencies in `package.json`

### Server Won't Start
- Check Railway logs
- Verify `MONGODB_URI` is set (backend will warn but continue without it)
- Verify `GEMINI_API_KEY` is set (required for image generation)

### CORS Errors
- Add `FRONTEND_ORIGIN` environment variable with your Vercel URL
- Backend allows `.vercel.app` domains automatically

### Health Check Fails
- Check Railway service is running (green status)
- Check logs for startup errors
- Verify PORT is not manually set (Railway sets it automatically)

## Verify Deployment

1. Test health endpoint: `https://your-railway-url.railway.app/health`
2. Should return: `{"ok":true,"service":"dpal-ai-server",...}`
3. Use the Backend Test Panel in frontend to verify all endpoints
