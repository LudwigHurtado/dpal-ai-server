# 🚨 URGENT: Fix MongoDB Connection - This is Blocking Everything

## The Problem:

Your backend test is hanging because:
1. Backend receives request ✅
2. Backend tries to query MongoDB ❌
3. **MONGODB_URI variable is NOT set** (or has wrong name)
4. Mongoose buffers query for 10 seconds
5. Times out: `Operation mintrequests.findOne() buffering timed out after 10000ms`
6. Frontend waits forever (even with timeout, backend is slow)

## The Fix (5 Minutes):

### Step 1: Go to Railway
1. Open Railway dashboard
2. Click on **"web"** service (your backend)
3. Click **"Variables"** tab

### Step 2: Fix Variable Name
1. Look for **`MONGODB_URL`** (WRONG NAME)
2. Click on it → **"Edit"**
3. Change the **NAME** from `MONGODB_URL` to `MONGODB_URI`
4. **Keep the same value** (don't change the connection string)
5. Click **"Save"**

### Step 3: Get Connection String (if variable doesn't exist)
1. Go to **MongoDB** service → **Variables** tab
2. Copy **`MONGO_URL`** value
3. Go back to **"web"** service → **Variables**
4. Click **"+ New Variable"**
5. Name: `MONGODB_URI`
6. Value: (paste the connection string)
7. Save

### Step 4: Apply and Restart
1. Click **"Apply X changes"** button
2. Go to **"Deployments"** tab
3. Click three dots (⋯) → **"Redeploy"**
4. Wait for deployment to complete

### Step 5: Verify
1. Go to **"Deploy Logs"** tab
2. Look for: `✅ Mongo connected`
3. Should NOT see: `⚠️ Skipping Mongo connection (no URI)`

## After Fixing:

- ✅ Backend test will complete in seconds
- ✅ No more timeout errors
- ✅ Hero minting will work
- ✅ All database operations will work

## Why This Matters:

The backend code checks for `MONGODB_URI`:
```typescript
MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URL || ""
```

If it's named `MONGODB_URL`, it won't find it and connection fails!

## Quick Check:

Run this in Railway → "web" service → Deploy Logs:
- ❌ `⚠️ Skipping Mongo connection (no URI)` = Variable not set
- ✅ `✅ Mongo connected` = Working!

**This is the ONLY thing blocking your app right now!**
