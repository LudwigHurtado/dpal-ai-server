# MongoDB Setup Checklist

## ✅ Verify MongoDB is Working

### Step 1: Check Railway Environment Variables

1. **Go to Railway Dashboard**
   - Visit: https://railway.app
   - Open your backend service (usually `dpal-ai-server` or `web`)

2. **Go to Variables Tab**
   - Click **"Variables"** in the left sidebar

3. **Check for MONGODB_URI**
   - ✅ **Should exist:** `MONGODB_URI` (exactly this name)
   - ❌ **Wrong name:** `MONGODB_URL` (needs to be renamed)
   - ✅ **Alternative:** `MONGO_URL` (also works as fallback)

4. **Get MongoDB Connection String**
   - If you have a MongoDB service in Railway:
     - Go to your **MongoDB service** → **Variables** tab
     - Look for `MONGO_URL` or connection string
     - Copy the full connection string
   - Format should be: `mongodb://user:password@host:port/database`

### Step 2: Set MONGODB_URI in Railway

**If MONGODB_URI doesn't exist:**

1. In Railway → Your Backend Service → Variables
2. Click **"New Variable"**
3. **Name:** `MONGODB_URI`
4. **Value:** Your MongoDB connection string
5. Click **"Add"**

**If you have MONGODB_URL (wrong name):**

1. Click on `MONGODB_URL` variable
2. Click **"Edit"** or rename option
3. Change name from `MONGODB_URL` to `MONGODB_URI`
4. Save

### Step 3: Verify MongoDB Service is Running

1. **Check MongoDB Service Status**
   - In Railway, find your MongoDB service
   - Should show "Deployed" status
   - Check logs for any errors

2. **Verify Connection String Format**
   - Should start with `mongodb://` or `mongodb+srv://`
   - Should include credentials and host
   - Example: `mongodb://mongo:password@mongodb.railway.internal:27017`

### Step 4: Test MongoDB Connection

#### Option A: Use Health Endpoint

1. **Open in browser:**
   ```
   https://your-railway-url.up.railway.app/health
   ```

2. **Check response:**
   ```json
   {
     "ok": true,
     "service": "dpal-ai-server",
     "database": {
       "connected": true,  // ✅ Should be true
       "state": "connected",
       "ready": true
     }
   }
   ```

3. **If `connected: false`:**
   - MongoDB is not connected
   - Check Railway logs for connection errors
   - Verify `MONGODB_URI` is set correctly

#### Option B: Use BackendTestPanel

1. Open your app
2. Open **BackendTestPanel** (bottom-right)
3. Run tests
4. Check "Backend Health Check" result
5. Should show database connection status

#### Option C: Check Railway Logs

1. Go to Railway → Your Backend Service → **Logs**
2. Look for:
   - ✅ `✅ Mongo connected successfully` - **GOOD!**
   - ✅ `Database: your-database-name` - **GOOD!**
   - ❌ `⚠️ Skipping Mongo connection (no MONGODB_URI set)` - **BAD!**
   - ❌ `❌ Mongo connection failed` - **BAD!**

### Step 5: Test NFT Minting

1. **Try to mint an NFT** in your app
2. **If it works:** ✅ MongoDB is connected!
3. **If you get error:**
   - Check the error message
   - If it says "database_unavailable", MongoDB isn't connected
   - Check Railway logs for details

---

## 🔍 Troubleshooting

### Issue: "database_unavailable" Error

**Symptoms:**
- NFT minting fails with "database_unavailable"
- Health endpoint shows `"connected": false`

**Fixes:**

1. **Check Variable Name**
   - Must be `MONGODB_URI` (not `MONGODB_URL`)
   - Check Railway → Variables → Look for exact name

2. **Check Variable Value**
   - Should be a valid MongoDB connection string
   - Should start with `mongodb://` or `mongodb+srv://`
   - Should include host, port, credentials

3. **Check MongoDB Service**
   - Ensure MongoDB service is deployed in Railway
   - Check MongoDB service logs for errors
   - Verify MongoDB service is accessible

4. **Check Railway Logs**
   - Look for connection errors
   - Check if connection string is correct
   - Verify network connectivity

### Issue: "buffering timed out"

**Symptoms:**
- Error: "Operation buffering timed out after 10000ms"
- MongoDB connection hangs

**Fixes:**

1. **Check Connection String**
   - Use Railway internal hostname if available
   - Format: `mongodb://mongo:password@mongodb.railway.internal:27017`
   - Or use public connection string if provided

2. **Check Network**
   - Ensure backend service can reach MongoDB service
   - In Railway, both services should be in same project
   - Check Railway service networking settings

3. **Check MongoDB Service**
   - Ensure MongoDB is running
   - Check MongoDB service logs
   - Verify MongoDB is accepting connections

### Issue: "MONGODB_URI is not set"

**Symptoms:**
- Logs show: "⚠️ Skipping Mongo connection (no MONGODB_URI set)"
- Health endpoint shows `"connected": false`

**Fixes:**

1. **Set MONGODB_URI in Railway**
   - Go to Railway → Backend Service → Variables
   - Add `MONGODB_URI` variable
   - Value: Your MongoDB connection string

2. **Redeploy Backend**
   - After adding variable, redeploy backend service
   - Variables only apply to new deployments

---

## ✅ Success Indicators

You'll know MongoDB is working when:

1. ✅ **Railway Logs Show:**
   ```
   ✅ Mongo connected successfully
   Database: your-database-name
   Host: mongodb.railway.internal
   ```

2. ✅ **Health Endpoint Shows:**
   ```json
   {
     "database": {
       "connected": true,
       "state": "connected",
       "ready": true
     }
   }
   ```

3. ✅ **NFT Minting Works:**
   - No "database_unavailable" errors
   - Minting completes successfully
   - NFT is saved to database

4. ✅ **BackendTestPanel Shows:**
   - "Backend Health Check" passes
   - Database connection status is "connected"

---

## 📋 Quick Checklist

- [ ] `MONGODB_URI` exists in Railway (not `MONGODB_URL`)
- [ ] `MONGODB_URI` has valid connection string
- [ ] MongoDB service is deployed and running
- [ ] Railway logs show "✅ Mongo connected successfully"
- [ ] Health endpoint shows `"connected": true`
- [ ] NFT minting works without database errors
- [ ] BackendTestPanel shows database connected

---

**Once all checkboxes are ✅, MongoDB is working!** 🎯
