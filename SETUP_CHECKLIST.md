# DPAL Setup Checklist & Troubleshooting Guide

## 🚨 CRITICAL ISSUES FOUND

### 1. Frontend Has Backend Dependencies
**Issue:** `c:\DPAL_Front_End\package.json` includes `mongoose` which is a Node.js-only library and won't work in the browser.

**Fix:** Remove mongoose from frontend (it's only used in dead code):
```bash
cd c:\DPAL_Front_End
npm uninstall mongoose
```

The frontend models using mongoose are documented as dead code and should not be used.

---

## ✅ BACKEND SETUP STEPS

### Step 1: Install Dependencies
```bash
cd c:\DPAL\dpal-ai-server
npm install
```

**Expected output:** All packages install successfully

### Step 2: Create .env File
```bash
cd c:\DPAL\dpal-ai-server
copy .env.example .env
```

Then edit `.env` and add:
- `MONGODB_URI` - Your MongoDB connection string
- `GEMINI_API_KEY` - Your actual Gemini API key

### Step 3: Verify MongoDB Connection
- Ensure MongoDB is running (local or cloud)
- Test connection string format: `mongodb://localhost:27017/dpal` or your cloud URI
- The backend will warn but continue if MongoDB URI is missing (for testing without DB)

### Step 4: Start Backend Server
```bash
npm run dev
```

**Expected output:**
```
✅ Mongo connected
✅ DPAL server running on port 8080
```

**If errors occur:**
- `Cannot find module` → Run `npm install` again
- `Port already in use` → Change PORT in .env or kill process on port 8080
- `MongoDB connection failed` → Check MONGODB_URI and ensure MongoDB is accessible

### Step 5: Test Backend Health
Open browser or use curl:
```bash
curl http://localhost:8080/health
```

**Expected response:**
```json
{"ok":true,"service":"dpal-ai-server","ts":1234567890}
```

---

## ✅ FRONTEND SETUP STEPS

### Step 1: Remove Backend Dependencies
```bash
cd c:\DPAL_Front_End
npm uninstall mongoose
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure API Base URL (Optional)
Create `.env.local` file:
```
VITE_API_BASE=http://localhost:8080
```

Or use default: `https://dpal-ai-server-production.up.railway.app`

### Step 4: Start Frontend
```bash
npm run dev
```

**Expected output:**
```
VITE v6.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

---

## 🔍 COMMON ERRORS & SOLUTIONS

### Backend Errors

#### Error: "Cannot find module '@google/genai'"
**Solution:**
```bash
cd c:\DPAL\dpal-ai-server
npm install @google/genai
```

#### Error: "GEMINI_API_KEY is not configured"
**Solution:** Add `GEMINI_API_KEY` to `.env` file

#### Error: "MONGODB_URI is not set"
**Solution:** 
- Add `MONGODB_URI` to `.env` file
- OR: Backend will continue without DB (for testing API endpoints that don't need DB)

#### Error: "Port 8080 already in use"
**Solution:**
1. Find process: `netstat -ano | findstr :8080` (Windows)
2. Kill process or change PORT in `.env`

#### Error: "Mongoose connection failed"
**Solution:**
- Verify MongoDB is running
- Check connection string format
- Verify network/firewall allows connection

### Frontend Errors

#### Error: "Failed to fetch" when calling backend
**Solutions:**
1. Ensure backend is running on port 8080
2. Check CORS - backend allows `http://localhost:5173`
3. Verify `VITE_API_BASE` points to correct backend URL
4. Check browser console for CORS errors

#### Error: "NetworkError" or CORS blocked
**Solution:**
- Backend CORS is configured for `localhost:5173` and `localhost:3000`
- If using different port, add to `FRONTEND_ORIGIN` in backend `.env`
- Or modify `c:\DPAL\dpal-ai-server\src\index.ts` line 39-40

#### Error: "mongoose is not defined" in browser
**Solution:** Remove mongoose from frontend (see Critical Issues above)

---

## 🧪 TESTING CHECKLIST

### Backend Tests
- [ ] `GET /health` returns `{"ok":true}`
- [ ] `POST /api/nft/generate-image` generates image (requires GEMINI_API_KEY)
- [ ] `GET /api/nft/receipts` returns array (requires MongoDB)
- [ ] `POST /api/nft/mint` creates NFT (requires MongoDB + GEMINI_API_KEY)

### Frontend Tests
- [ ] Frontend loads without console errors
- [ ] Can generate NFT image preview
- [ ] Can mint NFT (if backend running)
- [ ] Error messages display correctly for different error types

### Integration Tests
- [ ] Frontend can call backend `/api/nft/mint`
- [ ] Frontend receives proper error messages
- [ ] NFT images load from `/api/assets/:tokenId.png`

---

## 📋 DEPENDENCY CHECKLIST

### Backend Required Dependencies
- ✅ express
- ✅ mongoose
- ✅ cors
- ✅ dotenv
- ✅ @google/genai
- ✅ tsx (dev)
- ✅ typescript (dev)

### Frontend Required Dependencies
- ✅ react
- ✅ react-dom
- ✅ vite
- ✅ @google/genai (for direct AI calls, optional)
- ❌ mongoose (REMOVE - backend only)

---

## 🚀 QUICK START COMMANDS

### Terminal 1 - Backend
```bash
cd c:\DPAL\dpal-ai-server
npm install
# Create .env with MONGODB_URI and GEMINI_API_KEY
npm run dev
```

### Terminal 2 - Frontend
```bash
cd c:\DPAL_Front_End
npm uninstall mongoose  # Remove backend dependency
npm install
npm run dev
```

---

## 📝 ENVIRONMENT VARIABLES REFERENCE

### Backend (.env)
```
MONGODB_URI=mongodb://localhost:27017/dpal
GEMINI_API_KEY=your_key_here
PORT=8080
FRONTEND_ORIGIN=http://localhost:5173
GEMINI_MODEL=gemini-3-flash-preview
GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview
```

### Frontend (.env.local) - Optional
```
VITE_API_BASE=http://localhost:8080
VITE_GEMINI_API_KEY=your_key_here  # Only if making direct AI calls
```

---

## ⚠️ KNOWN ISSUES

1. **Frontend has mongoose dependency** - Should be removed (dead code)
2. **Backend continues without MongoDB** - Some endpoints will fail without DB
3. **Image generation requires Gemini API key** - Will fail without valid key

---

## 🆘 STILL NOT WORKING?

1. Check both terminal outputs for error messages
2. Verify all environment variables are set
3. Test backend health endpoint: `curl http://localhost:8080/health`
4. Check browser console for frontend errors
5. Verify MongoDB is accessible (if using DB features)
6. Check Gemini API key is valid (if using AI features)
