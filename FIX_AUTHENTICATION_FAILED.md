# Fix MongoDB Authentication Failed Error

## Current Error
```
❌ Mongo connection failed: Authentication failed.
```

## What This Means
- ✅ `MONGODB_URI` variable IS set
- ❌ The username/password in the connection string are **incorrect**
- ❌ Or the connection string format is wrong

## Solution: Use Railway's Auto-Generated Connection String

### Step 1: Get the Correct Connection String

1. Go to Railway → **MongoDB** service → **Variables** tab
2. Find **`MONGO_URL`** (this is Railway's auto-generated connection string with correct credentials)
3. Click the **eye icon** 👁️ to reveal the value
4. **Copy the entire connection string**

**It should look like:**
```
mongodb://mongo:ACTUAL_PASSWORD@switchback.proxy.rlwy.net:27017
```
or
```
mongodb://mongo:ACTUAL_PASSWORD@mongodb.railway.internal:27017
```

### Step 2: Update MONGODB_URI

1. Go to Railway → **web** service → **Variables** tab
2. Find **`MONGODB_URI`**
3. Click **Edit** (or delete and recreate)
4. **Paste the exact `MONGO_URL` value** you copied from MongoDB service
5. Click **Save**

**Important:** Use the **exact same value** as `MONGO_URL` from MongoDB service - don't modify it!

### Step 3: Wait for Restart

Railway will auto-restart. Wait **1-2 minutes**, then check logs again.

### Step 4: Check Logs

Go to Railway → **web** service → **Deploy Logs**

**Success looks like:**
```
✅ Mongo connected successfully
   Database: railway
   Host: mongodb.railway.internal
```

**Still failing?** Check the error message:
- `Authentication failed` → Wrong password (use exact `MONGO_URL` value)
- `Connection timeout` → Network issue
- `No MONGODB_URI set` → Variable not saved

## Alternative: Use Variable Reference (Recommended)

Instead of copying the value, use Railway's Variable Reference:

1. Go to Railway → **web** service → **Variables** tab
2. Click **"+ New Variable"**
3. Select **"Variable Reference"** (or "Reference Variable")
4. **Service:** Select **MongoDB**
5. **Variable:** Select **`MONGO_URL`**
6. **Name:** `MONGODB_URI` (this is what your backend expects)
7. Click **Save**

This automatically syncs the connection string and updates if MongoDB credentials change.

## Why Authentication Failed

Common causes:
1. **Manually typed connection string** with wrong password
2. **Copied from wrong place** (not from MongoDB service Variables)
3. **Connection string format wrong** (missing `@` or `:`)
4. **Password changed** but `MONGODB_URI` wasn't updated

## Test After Fix

Wait 1-2 minutes, then test:

```powershell
Invoke-WebRequest -Uri "https://web-production-a27b.up.railway.app/health" -UseBasicParsing | Select-Object -ExpandProperty Content
```

**Expected success:**
```json
{"ok":true,"service":"dpal-ai-server","version":"2026-01-25-v3","ts":1769473682665,"database":{"connected":true,"state":"connected","ready":true}}
```

## Quick Fix Checklist

- [ ] Go to MongoDB service → Variables → Copy `MONGO_URL`
- [ ] Go to web service → Variables → Update `MONGODB_URI` with exact `MONGO_URL` value
- [ ] OR use Variable Reference (recommended)
- [ ] Wait 1-2 minutes for restart
- [ ] Check logs for "✅ Mongo connected successfully"
- [ ] Test health endpoint
