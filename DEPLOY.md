# Mission Control UI Deployment

## Quick Deploy to Vercel (Recommended)

### Option 1: Vercel Dashboard (Easiest)

1. Open https://vercel.com
2. Login with: **claw@clawmail.cc**
3. Complete email verification
4. Click "Add New Project" → "Import Project"
5. Drag & drop the `dist` folder
6. Done! URL will be provided

### Option 2: Vercel CLI

```bash
cd mission-control-ui
npx vercel --prod
```

### Option 3: Netlify (Alternative)

1. Open https://app.netlify.com
2. Drag & drop `dist` folder to "Add new site"
3. Done!

## Build First (if not done)

```bash
cd mission-control-ui
npm install
npm run build
```

## Files to Deploy

```
dist/
├── index.html
├── assets/
│   ├── index-xxx.js
│   └── index-xxx.css
└── vite.svg
```

## API Configuration

The UI connects to: `http://localhost:3210`

For production, update `API_URL` in `src/App.jsx` to point to your API server's public URL.
