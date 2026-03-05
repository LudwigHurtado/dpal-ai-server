# Where to Set Variables in Railway

## Answer: Variables Tab (NOT Deployments Tab)

You're currently on the **Deployments** tab (showing failed builds). 

To fix `MONGODB_URI` and `NODE_ENV`:

### Step 1: Go to Variables Tab
1. At the top of the page, you'll see tabs: **"Deployments"**, **"Variables"**, **"Metrics"**, **"Settings"**
2. Click on **"Variables"** tab (next to Deployments)

### Step 2: Edit MONGODB_URI
1. In the Variables list, find **"MONGODB_URI"**
2. Click on it (or click the eye icon to reveal value)
3. Click **"Edit"** button
4. **Get MongoDB connection string:**
   - Go to left sidebar → Click **"MongoDB"** service
   - Go to **"Variables"** tab
   - Find **"MONGO_URL"** or **"MONGODB_URI"**
   - Copy that connection string
5. **Back in your backend service Variables:**
   - Delete the old value (`mongodb://localhost:27017/dpal`)
   - Paste the MongoDB connection string
   - Click **"Save"**

### Step 3: Edit NODE_ENV
1. Still in Variables tab
2. Find **"NODE_ENV"**
3. Click on it → **"Edit"**
4. Change value from `development` to: `production`
5. Click **"Save"**

### Step 4: Fix FRONTEND_ORIGIN
1. Find **"FRONTEND_ORIGIN"**
2. Click → **"Edit"**
3. Change to: `https://dpal-front-end.vercel.app`
4. Click **"Save"**

### Step 5: Delete ALLOWED_ORIGIN
1. Find **"ALLOWED_ORIGIN"**
2. Click the **"X"** button to delete it
3. Your code doesn't use this variable

### Step 6: Deploy
1. After fixing all variables, look for **"Apply X changes"** or **"Deploy"** button
2. Click it to trigger a new deployment
3. The build should succeed now (I just fixed the TypeScript errors)

## Visual Guide

```
Railway Dashboard
│
├── [Tabs at top]
│   ├── Deployments ← You are here (shows build errors)
│   ├── Variables ← CLICK HERE to set variables
│   ├── Metrics
│   └── Settings
│
└── Variables Tab (when you click it)
    ├── MONGODB_URI → Edit → Paste connection string
    ├── NODE_ENV → Edit → Change to "production"
    ├── FRONTEND_ORIGIN → Edit → Set to Vercel URL
    └── ALLOWED_ORIGIN → Delete (not used)
```

## After Setting Variables

1. Click **"Deploy"** or **"Apply Changes"**
2. Go back to **Deployments** tab
3. Watch the new deployment
4. Build should succeed now (TypeScript errors are fixed)
5. Check **Runtime Logs** - should see `✅ DPAL server running`
