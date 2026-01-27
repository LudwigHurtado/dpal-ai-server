# How to View JSON Responses

## Method 1: Browser (Simple)

### Step 1: Open the URL
Just paste this in your browser address bar:
```
https://your-railway-url.up.railway.app/health
```

### Step 2: What You'll See
You'll see raw JSON (all on one line):
```json
{"ok":true,"service":"dpal-ai-server","version":"2026-01-25-v3","ts":1234567890,"database":{"connected":true,"state":"connected","ready":true}}
```

### Step 3: Make It Readable
**Option A: Install Browser Extension**
- **Chrome:** Install "JSON Formatter" extension
- **Firefox:** Install "JSONView" extension
- **Edge:** Install "JSON Formatter" extension

After installing, JSON will be automatically formatted and pretty!

**Option B: Use Online Formatter**
1. Copy the JSON from browser
2. Go to: https://jsonformatter.org
3. Paste and click "Format"
4. See formatted JSON

---

## Method 2: Browser DevTools (Best for Debugging)

### Step 1: Open DevTools
- Press **F12** (or right-click → Inspect)
- Or press **Ctrl+Shift+I** (Windows) / **Cmd+Option+I** (Mac)

### Step 2: Go to Network Tab
- Click **"Network"** tab in DevTools
- Make sure it's recording (red circle = recording)

### Step 3: Open the URL
- Go to: `https://your-railway-url.up.railway.app/health`
- Or refresh the page if it's already open

### Step 4: View Response
1. In Network tab, find the `/health` request
2. Click on it
3. Click **"Response"** tab
4. See formatted JSON!

**Example:**
```
Network Tab → /health → Response Tab
{
  "ok": true,
  "service": "dpal-ai-server",
  "version": "2026-01-25-v3",
  "ts": 1234567890,
  "database": {
    "connected": true,
    "state": "connected",
    "ready": true
  }
}
```

---

## Method 3: Command Line (curl)

### Windows PowerShell:
```powershell
curl https://your-railway-url.up.railway.app/health
```

### Windows CMD:
```cmd
curl https://your-railway-url.up.railway.app/health
```

### Format JSON Output:
```powershell
curl https://your-railway-url.up.railway.app/health | ConvertFrom-Json | ConvertTo-Json
```

---

## Method 4: Online JSON Viewer

1. **Copy the URL:**
   ```
   https://your-railway-url.up.railway.app/health
   ```

2. **Go to JSON Viewer:**
   - https://jsonformatter.org
   - https://jsonviewer.stack.hu
   - https://codebeautify.org/jsonviewer

3. **Paste URL or JSON:**
   - Some viewers let you paste the URL directly
   - Or copy JSON from browser and paste it

4. **View formatted JSON:**
   - Automatically formatted
   - Collapsible sections
   - Syntax highlighting

---

## Method 5: VS Code / Code Editor

1. **Copy the JSON** from browser
2. **Paste in VS Code**
3. **Format:**
   - Press **Shift+Alt+F** (Windows) / **Shift+Option+F** (Mac)
   - Or right-click → "Format Document"

---

## Quick Test: Check Your Health Endpoint

**Replace `your-railway-url` with your actual Railway URL:**

```
https://web-production-a27b.up.railway.app/health
```

**Expected Response:**
```json
{
  "ok": true,
  "service": "dpal-ai-server",
  "version": "2026-01-25-v3",
  "ts": 1737942651000,
  "database": {
    "connected": true,    // ✅ Should be true if MongoDB is connected
    "state": "connected",  // ✅ Should be "connected"
    "ready": true          // ✅ Should be true
  }
}
```

**If `connected: false`:**
- MongoDB is not connected
- Check Railway logs
- Verify `MONGODB_URI` is set

---

## Recommended: Browser Extension

**Easiest method** - Install a JSON formatter extension:

1. **Chrome:**
   - Go to Chrome Web Store
   - Search "JSON Formatter"
   - Install (e.g., "JSON Formatter" by Callum Locke)

2. **Firefox:**
   - Go to Firefox Add-ons
   - Search "JSONView"
   - Install

3. **Edge:**
   - Go to Edge Add-ons
   - Search "JSON Formatter"
   - Install

**After installing:**
- All JSON responses will be automatically formatted
- Collapsible sections
- Syntax highlighting
- Much easier to read!

---

**Now you can easily check if MongoDB is connected!** 🎯
