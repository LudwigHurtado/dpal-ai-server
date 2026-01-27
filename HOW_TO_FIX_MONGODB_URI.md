# How to Fix MONGODB_URI - Simple Steps

## The Problem
- You have a variable called `MongoDB` that references `MONGO_URL` ✅
- But your backend needs `MONGODB_URI` (not `MongoDB`) ❌
- You also have `MONGODB_URI` but it has the wrong value

## Simple Solution: Replace MONGODB_URI

### Step 1: Delete the Old MONGODB_URI
1. In Railway → **web** service → **Variables** tab
2. Find **`MONGODB_URI`** in the list
3. Click the **trash/delete icon** (or three dots → Delete)
4. Confirm deletion

### Step 2: Create New MONGODB_URI as Variable Reference
1. Click **"+ New Variable"** button
2. Select **"Variable Reference"** (or "Reference Variable")
3. **Service:** Select **MongoDB** from dropdown
4. **Variable:** Select **`MONGO_URL`** from dropdown
5. **Name:** Type `MONGODB_URI` (exactly this name - this is what your backend expects)
6. Click **Save** or **Add**

### Step 3: Delete the MongoDB Variable (Optional)
Since you don't need it anymore:
1. Find **`MongoDB`** variable
2. Click delete/trash icon
3. Confirm deletion

### Step 4: Apply Changes
1. Click **"Apply X changes"** button (top-left)
2. Wait 1-2 minutes for Railway to restart

## Visual Guide

**Before:**
```
Variables:
- MONGODB_URI = mongodb://... (wrong value) ❌
- MongoDB = [Reference to MONGO_URL] (not used) ❌
```

**After:**
```
Variables:
- MONGODB_URI = [Reference to MongoDB → MONGO_URL] ✅
```

## Alternative: Copy Value Manually

If Variable Reference doesn't work:

1. Go to **MongoDB** service → **Variables** tab
2. Find **`MONGO_URL`**
3. Click **eye icon** 👁️ to reveal value
4. **Copy the entire connection string**
5. Go back to **web** service → **Variables**
6. Click **Edit** on `MONGODB_URI`
7. **Paste** the copied value
8. Click **Save**
9. Click **"Apply changes"**

## Test After Fix

Wait 1-2 minutes, then test:

```powershell
Invoke-WebRequest -Uri "https://web-production-a27b.up.railway.app/health" -UseBasicParsing | Select-Object -ExpandProperty Content
```

Look for:
```json
{"database":{"connected":true,"state":"connected","ready":true}}
```

## Summary

**What you need:**
- One variable named **`MONGODB_URI`**
- That references **MongoDB service's `MONGO_URL`**

**What to remove:**
- The old `MONGODB_URI` with wrong value
- The `MongoDB` variable (not needed)
