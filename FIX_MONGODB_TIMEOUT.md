# Fix MongoDB Timeout Error

## Error:
```
Operation `mintrequests.findOne()` buffering timed out after 10000ms
```

## Root Cause:
MongoDB connection is failing. The code is trying to query the database, but:
1. `MONGODB_URI` environment variable is not set correctly in Railway
2. OR the connection string is wrong
3. Mongoose is "buffering" (waiting for connection) and timing out after 10 seconds

## Fix Steps:

### 1. Verify MONGODB_URI Variable in Railway
1. Go to Railway → "web" service → Variables tab
2. Look for `MONGODB_URI` (NOT `MONGODB_URL`)
3. If it doesn't exist or is named wrong:
   - Click on `MONGODB_URL` (if it exists) → Edit
   - Change NAME to: `MONGODB_URI`
   - Value should be: `mongodb://mongo:jDjZtwKQugOKYAPYZHfWTNjpfVLPBUMX@mongodb.railway.internal:27017`
   - Save

### 2. Get Connection String from MongoDB Service
If `MONGODB_URI` doesn't exist:
1. Go to Railway → MongoDB service → Variables tab
2. Copy `MONGO_URL` value
3. Go to "web" service → Variables
4. Create new variable:
   - Name: `MONGODB_URI`
   - Value: (paste the connection string)
   - Save

### 3. Apply Changes and Restart
1. Click "Apply X changes" in Variables tab
2. Go to Deployments tab
3. Click three dots (⋯) on latest deployment
4. Click "Redeploy" or wait for auto-restart

### 4. Verify Connection
Check Deploy Logs - should see:
```
✅ Mongo connected
```

NOT:
```
⚠️ Skipping Mongo connection (no URI).
```

## Why This Happens:

The `mint.service.ts` calls `connectDb()` which checks for `env.MONGODB_URI`. If it's not set:
- Connection is skipped
- When code tries to query: `MintRequest.findOne()`
- Mongoose buffers the operation (waits for connection)
- After 10 seconds, it times out with the error you're seeing

## After Fixing:

Once you see `✅ Mongo connected` in logs:
- MongoDB timeout errors will stop
- Hero minting will work
- All database operations will succeed
