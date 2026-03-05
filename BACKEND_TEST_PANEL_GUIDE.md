# Backend Test Panel Guide

## Overview

The **BackendTestPanel** is a comprehensive testing tool that validates all critical backend API endpoints. It's always visible in the bottom-right corner of your app and helps diagnose connection issues, API errors, and configuration problems.

## What It Tests

### 1. **Environment Variables** ✅
- Checks if `VITE_API_BASE` is set
- Checks if `VITE_GEMINI_API_KEY` is configured
- Shows which values are being used (env vs default)

### 2. **Backend Health Check** ✅
- Tests `/health` endpoint
- Verifies backend is running and reachable
- Shows service name, version, and response time
- **Critical:** If this fails, nothing else will work

### 3. **CORS Configuration** ✅
- Tests CORS headers
- Verifies frontend can make cross-origin requests
- Shows allowed origins and methods

### 4. **NFT Mint API** ✅ (The one that was failing!)
- Tests `POST /api/nft/mint` endpoint
- Sends real mint request with test data
- **This is the endpoint causing "Neural link failed: Not Found"**
- Shows detailed error if it fails (404, 402, 500, etc.)

### 5. **NFT Generate Image API** ✅
- Tests `POST /api/nft/generate-image` endpoint
- Verifies image generation works
- 30-second timeout (image generation can be slow)

### 6. **Store Purchase Item API** ✅
- Tests `POST /api/store/purchase-item` endpoint
- Verifies store purchases work
- Tests with real item data

### 7. **Store Purchase IAP API** ✅
- Tests `POST /api/store/purchase-iap` endpoint
- Verifies IAP pack purchases work
- Tests credit addition functionality

## Features

### ✅ **Real Testing**
- Makes actual API calls (not mocked)
- Uses real request/response data
- Tests with actual backend endpoints

### ✅ **Error Detection**
- Shows exact HTTP status codes (404, 500, etc.)
- Displays full error messages from backend
- Includes response times for performance monitoring

### ✅ **Timeout Protection**
- 10-second timeout for most endpoints
- 30-second timeout for slow operations (minting, image generation)
- Prevents hanging/freezing

### ✅ **Detailed Error Messages**
- Shows the exact URL being called
- Displays backend error responses
- Provides suggestions for fixing issues
- Auto-expands error details

### ✅ **Response Time Tracking**
- Shows how long each request takes
- Helps identify slow endpoints
- Performance monitoring

### ✅ **Minimize/Maximize**
- Can be minimized to a small button
- Always accessible when needed
- Doesn't block the UI

## How to Use

1. **Open the Test Panel**
   - It's always visible in the bottom-right corner
   - If minimized, click the "Backend Test" button

2. **Check/Update Backend URL**
   - The URL field shows current backend URL
   - Update if your Railway URL is different
   - URL is auto-normalized (removes trailing slashes)

3. **Run Tests**
   - Click "Run All Tests" button
   - Tests run sequentially
   - Watch progress in real-time

4. **Review Results**
   - ✅ Green = Success
   - ❌ Red = Error
   - ⏳ Gray = Pending
   - Click "Show Details" for full error information

5. **Fix Issues**
   - Read error messages carefully
   - Check suggestions in error details
   - Verify Railway deployment status
   - Check Railway logs for backend errors

## Understanding Results

### Success ✅
```
✅ Backend is running!
Service: dpal-ai-server
Version: 2026-01-25-v3
Response time: 234ms
```

### Error ❌
```
❌ NFT mint endpoint returned error
Status: 404
Error: Not Found
Response time: 123ms

This is why minting fails in the app!
```

### Timeout ⏱️
```
❌ Backend is not reachable at this URL.

Possible issues:
1. Backend not deployed on Railway
2. Wrong Railway URL
3. Backend service is down
4. Network/CORS issue

URL tested: https://web-production-a27b.up.railway.app/api/nft/mint
Response time: 10000ms (timeout)
```

## Common Issues & Fixes

### Issue: "Backend is not reachable"
**Fix:**
1. Check Railway dashboard → Is service deployed?
2. Verify Railway URL is correct
3. Check Railway logs for errors
4. Ensure backend service is running

### Issue: "404 Not Found" on NFT Mint
**Fix:**
1. Verify route is registered in `src/index.ts`:
   ```typescript
   app.use("/api/nft", nftRoutes);
   ```
2. Check Railway deployment logs
3. Ensure backend code is deployed
4. Verify `src/routes/nft.routes.ts` exists

### Issue: "402 Insufficient Balance"
**Fix:**
- This is expected for test user
- Not a real error - endpoint is working
- Test user doesn't have credits

### Issue: "CORS blocked"
**Fix:**
1. Check `FRONTEND_ORIGIN` in Railway environment variables
2. Verify your frontend URL is in allowed origins
3. Check `src/index.ts` CORS configuration

### Issue: "Request timeout"
**Fix:**
1. Backend might be slow or overloaded
2. Check Railway logs for performance issues
3. Verify MongoDB connection (slow DB = slow API)

## Integration

The test panel is automatically included in `App.tsx`:
```typescript
import BackendTestPanel from './components/BackendTestPanel';

// In render:
<BackendTestPanel />
```

It's always visible and doesn't interfere with normal app usage.

## Benefits

1. **Quick Diagnosis** - Know immediately if backend is down
2. **Real Testing** - Tests actual endpoints, not mocks
3. **Error Details** - Full error messages with suggestions
4. **Performance** - Response time tracking
5. **Always Available** - No need to open DevTools or use curl
6. **User-Friendly** - Clear visual feedback (green/red)

## Next Steps After Testing

1. **If all tests pass:** ✅ Your backend is working correctly!
2. **If tests fail:**
   - Read error messages carefully
   - Check Railway logs
   - Verify environment variables
   - Ensure routes are registered
   - Check MongoDB connection

3. **Fix issues:**
   - Update Railway environment variables
   - Redeploy backend
   - Fix route registration
   - Check CORS configuration

4. **Re-test:**
   - Run tests again after fixes
   - Verify all endpoints work
   - Check response times are reasonable

---

**The test panel is your best friend for debugging backend issues!** 🚀
