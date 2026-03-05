# Copy MongoDB Connection String - Step by Step

## You Found It! ✅

You're in: **MongoDB** → **Variables** tab

## Connection String to Use:

**`MONGO_URL`** = 
```
mongodb://mongo:jDjZtwKQugOKYAPYZHfWTNjpfVLPBUMX@mongodb.railway.internal:27017
```

## Steps to Set It in Your Backend:

### 1. Copy the Connection String
- Click on **`MONGO_URL`** in the MongoDB Variables tab
- Click the **eye icon** 👁️ to reveal (if hidden)
- **Copy the entire string**: `mongodb://mongo:jDjZtwKQugOKYAPYZHfWTNjpfVLPBUMX@mongodb.railway.internal:27017`

### 2. Go to Your Backend Service
- In the left sidebar, click on **"web"** service (the one showing "Build failed")
- Click on **"Variables"** tab

### 3. Set MONGODB_URI
- Find **`MONGODB_URI`** in the list (or create it if it doesn't exist)
- Click on it → **"Edit"**
- **Paste** the connection string you copied
- Click **"Save"**

### 4. Also Set These (While You're There):
- **`NODE_ENV`** = `production`
- **`FRONTEND_ORIGIN`** = `https://dpal-front-end.vercel.app`
- **`GEMINI_API_KEY`** = (your Gemini API key)

## ⚠️ IMPORTANT: Build Failed!

Your "web" service shows **"Build failed 7 minutes ago"**

**After setting variables:**
1. Go to **"web"** service → **"Deployments"** tab
2. Check the build logs to see why it failed
3. The TypeScript errors should be fixed now (we fixed them in git)
4. Click **"Redeploy"** or wait for auto-deploy

## Quick Copy-Paste:

```
mongodb://mongo:jDjZtwKQugOKYAPYZHfWTNjpfVLPBUMX@mongodb.railway.internal:27017
```

This is your `MONGODB_URI` value!
