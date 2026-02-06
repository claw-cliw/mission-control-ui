# Vercel Environment Variables Setup

## Problem
Frontend showing blank because `VITE_API_URL` and `VITE_API_TOKEN` not set in Vercel.

## Solution

### Step 1: Set Environment Variables in Vercel Dashboard

1. Go to: https://vercel.com/claws-projects-be0862b8/mission-control-ui/settings/environment-variables

2. Click "Add New"

3. Add **Variable 1:**
   - **Name:** `VITE_API_URL`
   - **Value:** `http://161.118.197.243:3210`
   - **Environment:** Production (check the box)
   - Click "Save"

4. Add **Variable 2:**
   - **Name:** `VITE_API_TOKEN`
   - **Value:** `mc-secure-2024-fendy`
   - **Environment:** Production (check the box)
   - Click "Save"

### Step 2: Trigger Redeploy

Go to: https://vercel.com/claws-projects-be0862b8/mission-control-ui

- Click on the latest deployment
- Click "Redeploy" button
- Wait for deployment to complete (~1-2 minutes)

### Step 3: Verify

Open: https://mission-control-ui-eosin.vercel.app/

Should now show:
- Agent list (6 agents)
- Task board
- Activity feed
- Real-time updates

---

## Code Changes Made

✅ Updated `src/App.jsx`:
- Added `apiFetch()` helper function
- Replaced all `fetch()` calls with `apiFetch()`
- Now automatically adds `?token=${API_TOKEN}` to all API requests

✅ Updated `.env.local`:
- Set `VITE_API_URL=http://161.118.197.243:3210`
- Set `VITE_API_TOKEN=mc-secure-2024-fendy`

✅ Pushed to GitHub:
- Commit: "Add API token support to all fetch calls"
- Vercel will auto-deploy after env vars are set

---

## If Still Blank After Redeploy

Check browser console (F12) for errors:
- CORS errors? → API server needs to allow Vercel origin
- 401 errors? → Token not working
- Network errors? → VPS firewall blocking port 3210

---

**Status:** ✅ Code ready, waiting for Vercel env vars + redeploy
