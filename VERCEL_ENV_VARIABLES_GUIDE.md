# Vercel Environment Variables Guide

## Which Variables Do You Need in Vercel (Frontend)?

Based on your codebase analysis, here's what you **NEED** vs what you can **REMOVE**:

---

## ✅ **KEEP - Required Variables**

### 1. **VITE_API_BASE** ✅ **REQUIRED**
- **What it does:** Tells your frontend where your backend API is (Railway URL)
- **Used in:** `services/api.ts`, `components/BackendTestPanel.tsx`, `components/NftCard.tsx`, `components/NftMintingStation.tsx`
- **Value:** Your Railway backend URL (e.g., `https://web-production-a27b.up.railway.app`)
- **Status:** ✅ **KEEP THIS** - It's actively used throughout your app

---

## ❌ **REMOVE - Not Needed in Frontend**

### 1. **All MongoDB Variables** ❌ **REMOVE**
These belong on **Railway (backend)**, NOT Vercel (frontend):

- `MONGO_URL` ❌
- `MONGOPORT` ❌
- `MONGODB_URI` ❌
- `MONGOPASSWORD` ❌
- `MONGO_INITDB_ROOT_PASSWORD` ❌

**Why remove:**
- Your frontend should **NEVER** connect directly to MongoDB
- Frontend → Backend → Database (not Frontend → Database)
- These are security risks if exposed in frontend
- They're only used by your backend on Railway

**Where they should be:** Railway → Your Backend Service → Environment Variables

---

### 2. **NODE_ENV** ❌ **REMOVE**
- **What it is:** Node.js environment variable (development/production)
- **Why remove:** 
  - This is a **backend variable** (for Node.js servers)
  - Vite (your frontend build tool) uses its own mode system
  - Not used in your frontend code
- **Where it should be:** Railway → Your Backend Service → Environment Variables

---

### 3. **VITE_AI_SERVER_URL** ❌ **REMOVE**
- **Status:** Not used anywhere in your codebase
- **Action:** Safe to delete - it's an old/unused variable

---

### 4. **VITE_API_BASE_URL** ❌ **REMOVE**
- **Status:** Not used anywhere in your codebase
- **Action:** Safe to delete - it's an old/unused variable
- **Note:** You're using `VITE_API_BASE` (without `_URL` suffix) instead

---

## ⚠️ **OPTIONAL - Not Required**

### **VITE_GEMINI_API_KEY** ⚠️ **OPTIONAL**
- **Status:** Checked in `BackendTestPanel.tsx` but **NOT actually used** in frontend code
- **Why:** Your `services/geminiService.ts` uses `process.env.API_KEY` (not `VITE_GEMINI_API_KEY`)
- **Action:** 
  - If you're making direct Gemini API calls from frontend, you might need this
  - But currently, your frontend doesn't use it
  - **Safe to remove** if you're only using backend AI endpoints

---

## Summary Table

| Variable | Keep/Remove | Reason |
|----------|-------------|--------|
| `VITE_API_BASE` | ✅ **KEEP** | Required - used throughout app |
| `MONGO_URL` | ❌ **REMOVE** | Backend only - security risk |
| `MONGOPORT` | ❌ **REMOVE** | Backend only |
| `MONGODB_URI` | ❌ **REMOVE** | Backend only - security risk |
| `MONGOPASSWORD` | ❌ **REMOVE** | Backend only - security risk |
| `MONGO_INITDB_ROOT_PASSWORD` | ❌ **REMOVE** | Backend only - security risk |
| `NODE_ENV` | ❌ **REMOVE** | Backend only |
| `VITE_AI_SERVER_URL` | ❌ **REMOVE** | Not used - old variable |
| `VITE_API_BASE_URL` | ❌ **REMOVE** | Not used - old variable |
| `VITE_GEMINI_API_KEY` | ⚠️ **OPTIONAL** | Not currently used in frontend |

---

## How to Clean Up

### Step 1: Remove Unused Variables

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. For each variable listed above as "REMOVE":
   - Click on the variable
   - Click **"Delete"** or trash icon
   - Confirm deletion

### Step 2: Verify VITE_API_BASE

1. Make sure `VITE_API_BASE` exists
2. Value should be your Railway backend URL
3. Should be set for all environments (Production, Preview, Development)

### Step 3: Redeploy

After removing variables:
1. Go to **Deployments** tab
2. Click **"..."** on latest deployment
3. Click **"Redeploy"**
4. Or push a new commit to trigger auto-deploy

---

## Security Note

**Why remove MongoDB variables from frontend?**

1. **Security:** Database credentials should NEVER be in frontend code
2. **Architecture:** Frontend → Backend → Database (not Frontend → Database)
3. **Exposure:** Frontend environment variables can be visible in browser
4. **Best Practice:** Only backend should have database access

---

## Final Checklist

After cleanup, you should have:

- [ ] ✅ `VITE_API_BASE` = Your Railway URL
- [ ] ❌ No MongoDB variables
- [ ] ❌ No `NODE_ENV`
- [ ] ❌ No `VITE_AI_SERVER_URL`
- [ ] ❌ No `VITE_API_BASE_URL`
- [ ] ⚠️ `VITE_GEMINI_API_KEY` (optional - only if you need direct frontend AI calls)

---

**Result:** Clean, secure, and minimal environment variable setup! 🎯
