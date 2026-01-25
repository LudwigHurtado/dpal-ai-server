# ⚠️ Variable Name Issue Found!

## Problem:
You have: **`MONGODB_URL`** ❌
Code expects: **`MONGODB_URI`** ✅

The backend code checks for:
- `MONGODB_URI` (preferred)
- `MONGO_URL` (fallback)
- **NOT** `MONGODB_URL`

## Fix Options:

### Option 1: Rename the Variable (Recommended)
1. In Railway → "web" service → Variables tab
2. Find **`MONGODB_URL`**
3. Click on it → **"Edit"**
4. Change the **name** from `MONGODB_URL` to `MONGODB_URI`
5. Keep the same value: `mongodb://mongo:jDjZtwKQugOKYAPYZHfWTNjpfVLPBUMX@mongodb.railway.internal:27017`
6. Save

### Option 2: Add MONGODB_URI (Keep Both)
1. Click **"+ New Variable"**
2. Name: `MONGODB_URI`
3. Value: `mongodb://mongo:jDjZtwKQugOKYAPYZHfWTNjpfVLPBUMX@mongodb.railway.internal:27017`
4. Save
5. (You can delete `MONGODB_URL` later if you want)

## Other Variables to Verify:

While you're there, make sure these are set correctly:

- ✅ **`MONGODB_URI`** = `mongodb://mongo:jDjZtwKQugOKYAPYZHfWTNjpfVLPBUMX@mongodb.railway.internal:27017`
- ✅ **`NODE_ENV`** = `production`
- ✅ **`FRONTEND_ORIGIN`** = `https://dpal-front-end.vercel.app`
- ✅ **`GEMINI_API_KEY`** = (your API key - should be set)
- ✅ **`GEMINI_MODEL`** = `gemini-3-flash-preview` (or your preferred model)
- ✅ **`GEMINI_IMAGE_MODEL`** = `gemini-3-pro-image-preview` (or your preferred image model)

## After Fixing:

1. Click **"Apply 3 changes"** button (or it will auto-apply)
2. Go to **"Deployments"** tab
3. Watch for a new deployment
4. Check if build succeeds

## Why This Matters:

The connection string value is correct, but the variable name must match what the code expects. Without `MONGODB_URI`, the database connection will fail and hero minting/storage won't work.
