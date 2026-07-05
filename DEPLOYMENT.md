# Deployment

This project deploys as two services:

1. Flask backend on Render.
2. React frontend on Netlify.

## Backend: Render

Use the root repository and the included `render.yaml`.

Required environment variables:

```txt
FIREBASE_DATABASE_URL=https://heart-7d7ce-default-rtdb.asia-southeast1.firebasedatabase.app/
FIREBASE_SERVICE_ACCOUNT_JSON=<contents of backend/serviceAccountKey.json as one JSON string>
CORS_ORIGINS=https://your-frontend-domain.netlify.app
```

The backend start command is:

```txt
gunicorn --chdir backend app:app
```

Do not commit `backend/serviceAccountKey.json`. It is ignored by `.gitignore`; use
`FIREBASE_SERVICE_ACCOUNT_JSON` in Render instead.

## Frontend: Netlify

Deploy `Frontend/frontend`.

Build settings:

```txt
Build command: npm run build
Publish directory: build
```

Required environment variable:

```txt
REACT_APP_API_URL=https://your-render-backend-url.onrender.com
```

After the frontend deploys, copy the Netlify URL into the backend `CORS_ORIGINS`
environment variable and redeploy the backend.

## GitHub Cleanup

The root repo currently contains a full Python/Anaconda environment. Do not push
those folders. Keep only the project source:

```txt
backend/
Frontend/frontend/
ML model/
render.yaml
.gitignore
DEPLOYMENT.md
```

If Git already staged the environment files, unstage them before committing.
