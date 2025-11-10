# TodoLink Backend

## Local Run
```bash
cp .env.example .env
npm install
npm run dev
# http://localhost:3000/health
```

## Render Deploy (Free Tier)
1) Commit this folder to a GitHub repo.
2) Create a new Web Service on Render, connect the repo.
3) Render uses `render.yaml` to set up. It will generate `JWT_SECRET` and use PORT=3000.
4) After deploy, note the public URL (e.g. https://todolink-backend.onrender.com).

Update the iOS app's `API.shared.baseURL` to this URL for on-device testing or distribution.
