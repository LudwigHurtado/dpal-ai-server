# Step-by-Step: Set MONGODB_URI and NODE_ENV in Railway

## Part 1: Find Your MongoDB Connection String

### Step 1: Go to Your MongoDB Service
1. In Railway dashboard, look at the left sidebar
2. Find the **"MongoDB"** service (should be listed there)
3. Click on it

### Step 2: Get the Connection String
1. In the MongoDB service, go to **"Variables"** tab
2. Look for a variable called:
   - `MONGO_URL` OR
   - `MONGODB_URI` OR
   - `MONGO_CONNECTION_STRING`
3. **Copy the entire connection string** (it will look like: `mongodb://mongo:27017/...` or `mongodb+srv://...`)

**OR if you don't see it in Variables:**

1. Go to MongoDB service → **"Connect"** tab (or **"Data"** tab)
2. Look for **"Connection String"** or **"MONGO_URL"**
3. Copy that connection string

**OR if you set it up manually:**

- If you have your own MongoDB Atlas or other MongoDB instance
- Copy that connection string

## Part 2: Set MONGODB_URI in Your Backend Service

### Step 1: Go to Your Backend Service Variables
1. In Railway dashboard, click on your **"web"** service (or **"dpal-ai-server"**)
2. Click on **"Variables"** tab (at the top)

### Step 2: Find or Create MONGODB_URI
1. Look for **"MONGODB_URI"** in the list
2. **If it exists:**
   - Click on the variable name
   - Click the **"eye" icon** to reveal the current value
   - Click **"Edit"** or the pencil icon
   - Delete the old value (probably `mongodb://localhost:27017/dpal`)
   - Paste your MongoDB connection string from Part 1
   - Click **"Save"** or **"Update"**

3. **If it doesn't exist:**
   - Click **"+ New Variable"** button
   - Name: `MONGODB_URI`
   - Value: Paste your MongoDB connection string
   - Click **"Add"** or **"Save"**

## Part 3: Set NODE_ENV

### Step 1: Find NODE_ENV Variable
1. Still in **Variables** tab of your backend service
2. Look for **"NODE_ENV"** in the list

### Step 2: Edit NODE_ENV
1. Click on **"NODE_ENV"**
2. Click **"Edit"** or the pencil icon
3. Change the value from `development` to: `production`
4. Click **"Save"** or **"Update"**

## Part 4: Verify All Variables Are Correct

Check these variables have the correct values:

✅ **MONGODB_URI**: Your MongoDB connection string (not localhost)
✅ **NODE_ENV**: `production` (not `development`)
✅ **FRONTEND_ORIGIN**: `https://dpal-front-end.vercel.app` (not localhost)
✅ **GEMINI_API_KEY**: Your actual API key
✅ **GEMINI_MODEL**: `gemini-3-flash-preview`
✅ **GEMINI_IMAGE_MODEL**: `gemini-3-pro-image-preview`

❌ **ALLOWED_ORIGIN**: Delete this (not used in your code)

## Part 5: Apply Changes and Deploy

1. After fixing all variables, look for **"Apply X changes"** or **"Deploy"** button
2. Click it to save and trigger a new deployment
3. Watch **Build Logs** to see if it builds successfully
4. Check **Runtime Logs** to see if server starts

## Visual Guide

```
Railway Dashboard
├── Left Sidebar
│   ├── MongoDB service ← Click here to get connection string
│   └── web service ← Click here to set variables
│
└── Main Panel (when on web service)
    ├── Deployments tab
    ├── Variables tab ← GO HERE
    │   ├── MONGODB_URI → Edit → Paste connection string
    │   ├── NODE_ENV → Edit → Change to "production"
    │   └── FRONTEND_ORIGIN → Edit → Set to Vercel URL
    ├── Metrics tab
    └── Settings tab
```

## Common MongoDB Connection String Formats

**Railway MongoDB:**
```
mongodb://mongo:27017/dpal
```

**MongoDB Atlas:**
```
mongodb+srv://username:password@cluster.mongodb.net/dpal
```

**Local (for reference only - don't use in production):**
```
mongodb://localhost:27017/dpal
```

## Troubleshooting

**If you can't find MongoDB connection string:**
1. Check if MongoDB service is running (should show "Online")
2. Look in MongoDB service → Variables tab
3. Or check MongoDB service → Connect/Data tab

**If MONGODB_URI keeps reverting to localhost:**
1. Delete the variable completely
2. Click "+ New Variable"
3. Add it manually with correct value
4. This prevents Railway from auto-detecting wrong values

**If variables don't save:**
1. Make sure you click "Save" or "Update" after editing
2. Look for "Apply X changes" button and click it
3. Check if there's a "Deploy" button that needs to be clicked
