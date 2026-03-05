# ⚠️ CRITICAL: MongoDB Connection Not Found!

## Error in Logs:
```
"⚠️ Skipping Mongo connection (no URI)."
```

## Problem:
The backend can't find `MONGODB_URI` environment variable!

## Why This Happens:
1. Variable name is wrong (you have `MONGODB_URL` but need `MONGODB_URI`)
2. Variable wasn't saved/applied
3. Service needs restart after variable change

## Fix Steps:

### 1. Check Variable Name
- Go to "web" service → "Variables" tab
- Look for the MongoDB connection string
- **It MUST be named:** `MONGODB_URI` (not `MONGODB_URL`)

### 2. If It's Named Wrong:
- Click on `MONGODB_URL` → "Edit"
- Change the **NAME** to: `MONGODB_URI`
- Keep the value: `mongodb://mongo:jDjZtwKQugOKYAPYZHfWTNjpfVLPBUMX@mongodb.railway.internal:27017`
- Click "Save"

### 3. If It Doesn't Exist:
- Click "+ New Variable"
- Name: `MONGODB_URI`
- Value: `mongodb://mongo:jDjZtwKQugOKYAPYZHfWTNjpfVLPBUMX@mongodb.railway.internal:27017`
- Click "Save"

### 4. Apply Changes:
- Click "Apply X changes" button (top of Variables tab)
- Or wait for auto-apply

### 5. Restart Service:
- Go to "Deployments" tab
- Click the three dots (⋯) on the latest deployment
- Click "Redeploy" or "Restart"
- OR wait for Railway to auto-restart

### 6. Verify:
- Go to "Deploy Logs" tab
- Look for: `✅ Mongo connected` (instead of the warning)
- Should NOT see: `⚠️ Skipping Mongo connection (no URI)`

## Quick Checklist:

- [ ] Variable exists in "web" service Variables tab
- [ ] Variable name is exactly: `MONGODB_URI` (not `MONGODB_URL`)
- [ ] Variable value is: `mongodb://mongo:jDjZtwKQugOKYAPYZHfWTNjpfVLPBUMX@mongodb.railway.internal:27017`
- [ ] Changes are applied (clicked "Apply changes")
- [ ] Service restarted/redeployed
- [ ] Deploy logs show `✅ Mongo connected`

## After Fixing:

Once you see `✅ Mongo connected` in the logs, hero minting and storage will work!
