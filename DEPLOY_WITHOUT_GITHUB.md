# Deploy Without GitHub

Use this route:

1. Backend: PythonAnywhere manual file upload.
2. Frontend: Netlify manual drag-and-drop.

## Backend on PythonAnywhere

Upload these folders/files into `/home/iamshahd03/CardioPredict`:

```txt
backend/
ML model/
```

Create a PythonAnywhere virtualenv and install:

```txt
pip install -r /home/iamshahd03/CardioPredict/backend/requirements.txt
```

In the PythonAnywhere Web tab:

1. Create a Flask web app.
2. Set the WSGI file content based on `backend/pythonanywhere_wsgi.py`.
3. Confirm the project directory is `/home/iamshahd03/CardioPredict`.
4. Add environment variables in the WSGI file before importing the app:

```python
os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = '{"type":"service_account",...}'
os.environ["CORS_ORIGINS"] = "https://teal-kashata-3d7745.netlify.app"
```

Do not upload `backend/serviceAccountKey.json` publicly.

Your backend URL will look like:

```txt
https://iamshahd03.pythonanywhere.com
```

## Frontend on Netlify

Build the React app, then upload `Frontend/frontend/build` to Netlify using
manual drag-and-drop.

After the backend URL is known, edit:

```txt
Frontend/frontend/build/config.js
```

Set:

```js
window.__APP_CONFIG__ = {
  API_URL: "https://iamshahd03.pythonanywhere.com"
};
```

Then drag the `build` folder into Netlify.

## Manual ZIPs

This workspace can produce:

```txt
deploy/backend-pythonanywhere.zip
deploy/frontend-netlify-build.zip
```

The frontend ZIP should only be created after `build/config.js` contains the
real backend URL.
