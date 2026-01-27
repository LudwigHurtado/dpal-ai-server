# How to Test Health Endpoint

## Quick Command

**PowerShell:**
```powershell
Invoke-WebRequest -Uri "https://web-production-a27b.up.railway.app/health" -UseBasicParsing | Select-Object -ExpandProperty Content
```

## Step-by-Step

### 1. Open PowerShell
- Press `Win + X` → Select "Windows PowerShell" or "Terminal"
- Or search "PowerShell" in Start menu

### 2. Copy the Command
Copy this entire line:
```powershell
Invoke-WebRequest -Uri "https://web-production-a27b.up.railway.app/health" -UseBasicParsing | Select-Object -ExpandProperty Content
```

### 3. Paste and Press Enter
- Right-click in PowerShell to paste (or `Ctrl + V`)
- Press `Enter`

### 4. Wait for Response
The command will take 1-2 seconds, then show JSON output.

## Expected Responses

### ✅ Success (MongoDB Connected)
```json
{"ok":true,"service":"dpal-ai-server","version":"2026-01-25-v3","ts":1769473370078,"database":{"connected":true,"state":"connected","ready":true}}
```

**What it means:**
- ✅ Backend is running
- ✅ MongoDB is connected
- ✅ NFT minting will work!

### ⚠️ Partial Success (MongoDB Not Connected)
```json
{"ok":true,"service":"dpal-ai-server","version":"2026-01-25-v3","ts":1769473370078,"database":{"connected":false,"state":"disconnected","ready":false}}
```

**What it means:**
- ✅ Backend is running
- ❌ MongoDB is NOT connected
- ❌ NFT minting will fail with 503 error

**Fix:** Check `MONGODB_URI` in Railway Variables

### ❌ Error Responses

**Connection Error:**
```
Invoke-WebRequest: Unable to connect to the remote server
```
→ Service is down or URL is wrong

**404 Not Found:**
```
{"ok":false,"error":"Not Found"}
```
→ Route not configured or wrong URL

**502 Bad Gateway:**
```
502 Bad Gateway
```
→ Service is starting/restarting (wait a minute and try again)

## Pretty Print JSON (Optional)

To see formatted JSON instead of one line:

```powershell
$response = Invoke-WebRequest -Uri "https://web-production-a27b.up.railway.app/health" -UseBasicParsing
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

This will show:
```json
{
  "ok": true,
  "service": "dpal-ai-server",
  "version": "2026-01-25-v3",
  "ts": 1769473370078,
  "database": {
    "connected": true,
    "state": "connected",
    "ready": true
  }
}
```

## Alternative: Test in Browser

Just open this URL in your browser:
```
https://web-production-a27b.up.railway.app/health
```

You'll see the JSON response directly in the browser (may need a JSON formatter extension for pretty printing).

## What to Check

After running the command, look for:

1. **`"ok": true`** → Backend is working
2. **`"database": {"connected": true}`** → MongoDB is connected ✅
3. **`"database": {"connected": false}`** → MongoDB needs configuration ❌

## Next Steps

- ✅ If `database.connected: true` → NFT minting is ready!
- ❌ If `database.connected: false` → Set `MONGODB_URI` in Railway Variables
