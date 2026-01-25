# Correct Railway Settings Configuration

## Current Settings (What You Have)

- **Custom Build Command**: `npm run build` ✅ CORRECT
- **Watch Paths**: `tsc` ❌ WRONG - This is not a file path!
- **Pre-deploy Command**: `npm install && npm run build` ✅ CORRECT
- **Start Command**: `npm start` (should be visible in Deploy section) ✅ CORRECT

## The Problem

**Watch Paths** is for file patterns (like `.gitignore` patterns), NOT for commands!

- ❌ Wrong: `tsc` (this is a command, not a file path)
- ✅ Correct: `src/**/*.ts` or `src/` or leave it empty

## Correct Configuration

### In Railway Settings → Deploy:

1. **Custom Build Command**: 
   - `npm run build`
   - OR leave empty (Railway will auto-detect from `package.json`)

2. **Pre-deploy Command**: 
   - `npm install && npm run build`
   - This runs BEFORE deployment

3. **Custom Start Command**: 
   - `npm start`
   - This runs the server

4. **Watch Paths**: 
   - Remove `tsc` from here!
   - Either leave empty, OR use file patterns like:
     - `src/**/*.ts`
     - `src/`
     - `package.json`
   - Watch Paths tells Railway which files to watch for changes to trigger new deployments

## What Each Setting Does

- **Custom Build Command**: Overrides Railway's default build (usually not needed if you have Pre-deploy)
- **Pre-deploy Command**: Runs in the image before deployment (install + build)
- **Custom Start Command**: Command to start your app after deployment
- **Watch Paths**: File patterns that trigger deployments when changed (NOT commands!)

## Recommended Settings

**For your backend:**

1. **Custom Build Command**: Leave EMPTY (or `npm run build`)
2. **Pre-deploy Command**: `npm install && npm run build`
3. **Custom Start Command**: `npm start`
4. **Watch Paths**: Leave EMPTY (or use `src/**/*.ts` if you want to trigger on TypeScript changes)

## Action Required

1. Go to Railway → Settings → Deploy
2. **Remove `tsc` from Watch Paths** (leave it empty or use file patterns)
3. Make sure **Start Command** is `npm start`
4. Save/Apply changes
