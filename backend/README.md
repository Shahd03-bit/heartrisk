# Backend: Doctor-Patient Connection Module

This Flask backend now supports secure doctor-patient report sharing on top of the existing heart-risk prediction flow.

## What was added

- Firebase ID token verification for protected routes
- Role checks (patient / doctor) using users/{uid}.role in Firestore
- CORS config for React dev origins (default: localhost:3000)
- Shared report endpoints:
  - POST /assessments/<assessment_id>/share
  - GET /doctors/<doctor_id>/shared-reports
  - GET /shared-reports/<report_id>
  - POST /shared-reports/<report_id>/comments
- Helper endpoint for patient report page:
  - GET /assessments/<assessment_id>/shared-reports
- Request logging and structured JSON errors
- Optional dual-write to Firestore assessments in /predict while preserving current Realtime Database workflow

## Local setup

1. Create/activate your Python env.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Ensure Firebase Admin key exists at backend/serviceAccountKey.json.
4. Optional CORS override:

```bash
set CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

5. Run backend:

```bash
py -3.12 app.py
```

## API contracts

### POST /assessments/<assessment_id>/share
Headers:
- Authorization: Bearer <firebase_id_token>

Request JSON:
```json
{ "doctor_id": "uid_optional", "message": "optional" }
```

Response:
```json
{ "success": true, "report_id": "uuid" }
```

### GET /doctors/<doctor_id>/shared-reports
Headers:
- Authorization: Bearer <firebase_id_token>

Response:
```json
{
  "reports": [
    {
      "report_id": "...",
      "assessment_id": "...",
      "patientId": "...",
      "patient_name": "...",
      "predictionResult": { "risk_percentage": 72.4 },
      "message": "...",
      "status": "assigned",
      "timestamp": "2026-05-22T..."
    }
  ]
}
```

### GET /shared-reports/<report_id>
Headers:
- Authorization: Bearer <firebase_id_token>

Response:
```json
{
  "report": {
    "report_id": "...",
    "assessment_id": "...",
    "patientId": "...",
    "doctorId": "...",
    "predictionResult": {},
    "healthData": {},
    "message": "...",
    "status": "reviewed",
    "comments": [
      {
        "comment_id": "...",
        "doctorId": "...",
        "patientId": "...",
        "comment": "...",
        "timestamp": "2026-05-22T..."
      }
    ]
  }
}
```

### POST /shared-reports/<report_id>/comments
Headers:
- Authorization: Bearer <firebase_id_token>

Request JSON:
```json
{ "comment": "Clinical recommendation" }
```

Response:
```json
{ "success": true, "comment_id": "uuid" }
```

## Smoke tests (curl)

Set token + IDs first:

```bash
set TOKEN=<firebase_id_token>
set ASSESSMENT_ID=<assessment_id>
set DOCTOR_UID=<doctor_uid>
set REPORT_ID=<report_id>
```

1. Patient shares report:

```bash
curl -X POST http://127.0.0.1:5000/assessments/%ASSESSMENT_ID%/share ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"doctor_id\":\"%DOCTOR_UID%\",\"message\":\"Please review\"}"
```

2. Doctor lists assigned reports:

```bash
curl -X GET http://127.0.0.1:5000/doctors/%DOCTOR_UID%/shared-reports ^
  -H "Authorization: Bearer %TOKEN%"
```

3. Doctor reads one report:

```bash
curl -X GET http://127.0.0.1:5000/shared-reports/%REPORT_ID% ^
  -H "Authorization: Bearer %TOKEN%"
```

4. Doctor posts comment:

```bash
curl -X POST http://127.0.0.1:5000/shared-reports/%REPORT_ID%/comments ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"comment\":\"Follow low-sodium diet and retest in 2 weeks\"}"
```

## Security rules

Recommended Firestore rules are provided in backend/firestore.rules.

## Notes

- Protected endpoints return 401/403/404/500 JSON errors.
- /predict behavior remains unchanged for current workflow.
- New actions include audit fields (sharedBy/sharedAt/reviewedBy/reviewedAt).
