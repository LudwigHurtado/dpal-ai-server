# How to Find MongoDB Connection String in Railway

## You're Currently Looking At:
- **MongoDB Service** → **Deploy Logs** (shows MongoDB is running, but NOT the connection string)

## What You Need:
The **MONGODB_URI** connection string is in the **Variables** tab, NOT the logs.

## Steps to Find It:

### 1. Go to MongoDB Service Variables
- You're currently in: `MongoDB` → `Deploy Logs`
- Click on **"Variables"** tab (next to "Deploy Logs" at the top)

### 2. Look for These Variables:
In the Variables tab, you should see one of these:
- **`MONGO_URL`** ← This is the connection string!
- **`MONGODB_URI`** ← Alternative name
- **`MONGODB_URL`** ← Another alternative

### 3. Copy the Connection String
- Click on the variable name (e.g., `MONGO_URL`)
- Click the **eye icon** 👁️ to reveal the value
- **Copy the entire connection string**
- It will look something like:
  ```
  mongodb://mongo:password@switchback.proxy.rlwy.net:27017
  ```
  or
  ```
  mongodb+srv://mongo:password@switchback.proxy.rlwy.net:27017
  ```

### 4. Use It in Your Backend Service
- Go to your **backend service** (the "web" service)
- Go to **Variables** tab
- Find or create **`MONGODB_URI`**
- Paste the connection string you copied from MongoDB service

## Visual Guide:

```
Railway Dashboard
│
├── [Left Sidebar]
│   └── MongoDB ← You are here
│       ├── Deployments
│       ├── Database
│       ├── Backups
│       ├── Variables ← CLICK HERE!
│       ├── Metrics
│       └── Settings
│
└── Variables Tab (when you click it)
    ├── MONGO_URL → Click → Reveal → Copy
    └── (or MONGODB_URI / MONGODB_URL)
```

## Important Notes:

1. **The connection string is NOT in the logs** - it's in Variables
2. **Railway auto-generates this** - you don't need to create it
3. **It's already set up** - just need to copy it to your backend service
4. **The format is usually:** `mongodb://[username]:[password]@[host]:[port]`

## If You Don't See MONGO_URL:

Sometimes Railway uses different variable names:
- Check for: `MONGO_URL`, `MONGODB_URI`, `MONGODB_URL`, `DATABASE_URL`
- If you see multiple, use `MONGO_URL` or `MONGODB_URI` (they're usually the same)

## Next Step After Finding It:

1. Copy the connection string from MongoDB → Variables → `MONGO_URL`
2. Go to your backend service (web) → Variables tab
3. Set `MONGODB_URI` = (paste the connection string)
4. Save
5. Deploy!
