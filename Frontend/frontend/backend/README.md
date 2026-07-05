# Backend scaffold for Doctor-Patient Connection Module

This folder contains a minimal Flask scaffold that implements endpoints used by the frontend to share reports, list doctor shared reports, and post doctor comments.

Setup

1. Install requirements:

```bash
pip install -r requirements.txt
```

2. Set `GOOGLE_APPLICATION_CREDENTIALS` to a Firebase service account JSON with Firestore access.

3. Run the app:

```bash
python flask_app.py
```

Notes

- This is a minimal scaffold. In production, you should add proper error handling, logging, and secure the app behind HTTPS.
- The app depends on Firebase Admin SDK and Firestore.
