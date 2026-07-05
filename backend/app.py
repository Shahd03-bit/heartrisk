"""Flask backend for heart-disease risk prediction and patient-doctor sharing.

The API accepts patient data, runs the trained ML model, stores assessment
results in Firebase, and exposes endpoints for registration, sharing, and
doctor dashboard workflows.
"""

from flask import Flask, request, jsonify, g
from flask_cors import CORS
import pickle
import pandas as pd
import os
import json
import uuid
import firebase_admin
from firebase_admin import credentials, db, firestore, auth as firebase_auth
from datetime import datetime, timezone
from functools import wraps
import logging

import sys
import builtins
try:
    import sklearn
    SKLEARN_VERSION = getattr(sklearn, "__version__", "unknown")
except Exception:
    sklearn = None
    SKLEARN_VERSION = "not-installed"

PY_VERSION = sys.version.split('\n')[0]

def safe_print(*args, **kwargs):
    try:
        builtins.print(*args, **kwargs)
    except UnicodeEncodeError:
        sep = kwargs.get('sep', ' ')
        text = sep.join(str(arg) for arg in args)
        encoding = sys.stdout.encoding or 'ascii'
        encoded_text = text.encode(encoding, errors='replace').decode(encoding)
        builtins.print(encoded_text, **kwargs)

print = safe_print

app = Flask(__name__)

# Allow the frontend to call this API from local development hosts and production deployments.
DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://heartrisk-e5re.vercel.app",
    # Note: wildcard origins removed for stricter security in production.
]
cors_origins = [
    origin.strip() for origin in os.getenv("CORS_ORIGINS", ",".join(DEFAULT_CORS_ORIGINS)).split(",") if origin.strip()
]
CORS(app, resources={r"/*": {"origins": cors_origins}})

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("heart_backend")


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "Real-Time Heart Disease Prediction API",
        "status": "running",
        "version": "1.0"
    }), 200

# --- 1. FIREBASE INITIALIZATION ---
# Firebase powers identity, user profiles, assessments, and shared reports.
firebase_initialized = False
firestore_client = None
try:
    firebase_service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    firebase_database_url = os.getenv(
        "FIREBASE_DATABASE_URL",
        "https://heart-7d7ce-default-rtdb.asia-southeast1.firebasedatabase.app/"
    )

    if firebase_service_account_json:
        cred = credentials.Certificate(json.loads(firebase_service_account_json))
        firebase_admin.initialize_app(cred, {
            'databaseURL': firebase_database_url
        })
        firebase_initialized = True
        firestore_client = firestore.client()
        logger.info("✓ Firebase connected from environment")
    elif os.path.exists("serviceAccountKey.json"):
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {
            'databaseURL': firebase_database_url
        })
        firebase_initialized = True
        firestore_client = firestore.client()
        logger.info("✓ Firebase connected")
    else:
        logger.warning("serviceAccountKey.json not found - Firebase disabled")
except Exception as e:
    logger.exception("Firebase failed to initialize: %s", e)

# --- 2. ML ASSET LOADING ---
# The trained model and scaler are loaded once and reused for each prediction.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "heart_disease_model.pkl")
SCALER_PATH = os.path.join(BASE_DIR, "scaler.pkl")

model = None
scaler = None


def utc_now_iso():
    # Consistent UTC timestamps for records written to Firebase.
    return datetime.now(timezone.utc).isoformat()


def json_error(status_code, message, details=None):
    # Standard error payload used by most API endpoints.
    payload = {"success": False, "error": message}
    if details:
        payload["details"] = details
    return jsonify(payload), status_code


@app.before_request
def log_request():
    logger.info("%s %s from %s", request.method, request.path, request.remote_addr)


def get_bearer_token():
    # Extract Firebase ID tokens from Authorization headers.
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    return auth_header.split("Bearer ", 1)[1].strip()


def verify_request_token():
    # Validate the caller and attach the decoded token to the request context.
    if not firebase_initialized:
        return None, json_error(500, "Firebase not initialized")

    token = get_bearer_token()
    if not token:
        return None, json_error(401, "Missing Authorization bearer token")

    try:
        decoded = firebase_auth.verify_id_token(token)
        g.auth = decoded
        return decoded, None
    except Exception as exc:
        logger.exception("Token verification failed")
        return None, json_error(401, "Invalid or expired token", str(exc))


def get_user_role(uid, decoded_token=None):
    # Resolve the user's role from token claims first, then persistent storage.
    if decoded_token:
        claims_role = decoded_token.get("role")
        if claims_role:
            return claims_role

    if firestore_client is not None:
        try:
            user_doc = firestore_client.collection("users").document(uid).get()
            if user_doc.exists:
                return user_doc.to_dict().get("role")
        except Exception:
            pass

    if firebase_initialized:
        try:
            rt_user = db.reference(f"users/{uid}").get()
            if isinstance(rt_user, dict):
                return rt_user.get('role') or rt_user.get('Role')
        except Exception:
            pass

    return None


def require_roles(allowed_roles):
    # Guard endpoints that should only be reachable by specific user roles.
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            decoded, err = verify_request_token()
            if err:
                return err

            uid = decoded.get("uid")
            role = get_user_role(uid, decoded)
            if role not in allowed_roles:
                return json_error(403, "Insufficient permissions")

            g.user_uid = uid
            g.user_role = role
            return func(*args, **kwargs)

        return wrapper

    return decorator


def get_assessment_for_user(user_id, assessment_id):
    # Look up an assessment from either Firestore or the RTDB legacy structure.
    if firestore_client is not None:
        fs_doc = firestore_client.collection("assessments").document(assessment_id).get()
        if fs_doc.exists:
            data = fs_doc.to_dict() or {}
            if data.get("user_id") == user_id:
                data["assessment_id"] = assessment_id
                return data

        query = firestore_client.collection("assessments") \
            .where("assessment_id", "==", assessment_id) \
            .where("user_id", "==", user_id) \
            .limit(1) \
            .stream()
        for item in query:
            data = item.to_dict() or {}
            data["assessment_id"] = assessment_id
            return data

    if firebase_initialized:
        rt_data = db.reference(f"assessments/{user_id}/{assessment_id}").get()
        if rt_data:
            rt_data["assessment_id"] = assessment_id
            return rt_data

    return None


def get_user_name(uid):
    """
    Fetch display name for a user from Firestore or RTDB.
    Handles both firstName/lastName fields and the full_name field
    used by the RTDB-only registration path.
    """
    if firestore_client is not None:
        try:
            user_doc = firestore_client.collection("users").document(uid).get()
            if user_doc.exists:
                profile = user_doc.to_dict() or {}
                first_name = profile.get("firstName") or profile.get("firstname") or profile.get("first_name") or ""
                last_name = profile.get("lastName") or profile.get("lastname") or profile.get("last_name") or ""
                full_name = f"{first_name} {last_name}".strip()
                # ✅ FIX: fall back to full_name field if firstName/lastName are absent
                return full_name or profile.get("full_name") or profile.get("name") or profile.get("email")
        except Exception:
            pass

    if firebase_initialized:
        try:
            profile = db.reference(f"users/{uid}").get() or {}
            first_name = profile.get("firstName") or profile.get("firstname") or profile.get("first_name") or ""
            last_name = profile.get("lastName") or profile.get("lastname") or profile.get("last_name") or ""
            full_name = f"{first_name} {last_name}".strip()
            # ✅ FIX: fall back to full_name field if firstName/lastName are absent
            return full_name or profile.get("full_name") or profile.get("name") or profile.get("email")
        except Exception:
            pass

    return None


# --- USER REGISTRATION & MANAGEMENT ---

# ✅ FIX: Single definition of generate_doctor_access_code (was duplicated in original)
def generate_doctor_access_code():
    """Generate unique doctor access code in format DR + 6 random digits (e.g. DR582941)"""
    import random
    digits = ''.join([str(random.randint(0, 9)) for _ in range(6)])
    return f"DR{digits}"


def save_user_to_rtdb(uid, user_data):
    """
    Save user data to Firebase RTDB users table.
    For doctors: generates and stores a doctor_code + reverse index.
    For patients: stores doctor_id and doctor_code from registration.
    """
    if not firebase_initialized:
        print(f"⚠️ Firebase not initialized, cannot save user {uid}")
        return {"success": False, "error": "Firebase not initialized"}

    try:
        print(f"\n💾 [USER] Creating user in RTDB...")
        print(f"   UID: {uid}")
        print(f"   Email: {user_data.get('email')}")
        print(f"   Role: {user_data.get('role')}")

        # Normalize incoming registration payloads from different frontend forms.
        first_name = user_data.get("firstName", user_data.get("first_name", ""))
        last_name = user_data.get("lastName", user_data.get("last_name", ""))
        full_name = (user_data.get("full_name") or f"{first_name} {last_name}").strip()

        user_doc = {
            "uid": uid,
            "role": (user_data.get("role") or "patient").lower(),
            "email": user_data.get("email", ""),
            "full_name": full_name,
            "verified": user_data.get("verified", True),
            "createdAt": datetime.now().isoformat(),
        }

        if user_data.get("phoneNumber"):
            user_doc["phoneNumber"] = user_data.get("phoneNumber")
        if user_data.get("dateOfBirth"):
            user_doc["dateOfBirth"] = user_data.get("dateOfBirth")
        if user_data.get("gender"):
            user_doc["gender"] = user_data.get("gender")
        if user_data.get("profilePicture"):
            user_doc["profilePicture"] = user_data.get("profilePicture")

        # Patients keep a direct link to their doctor for dashboard and sharing flows.
        if user_data.get("doctor_id"):
            user_doc["doctor_id"] = user_data.get("doctor_id")
            print(f"   Doctor ID (linked): {user_data.get('doctor_id')}")
        if user_data.get("doctor_code"):
            user_doc["doctor_code"] = user_data.get("doctor_code").upper()
            print(f"   Doctor Code (linked): {user_doc['doctor_code']}")

        # Doctors get a unique access code so patients can verify and link to them.
        doctor_code = None
        if user_doc["role"] == "doctor":
            doctor_code = generate_doctor_access_code()

            # Ensure uniqueness
            max_attempts = 10
            for _ in range(max_attempts):
                existing = db.reference(f'doctors_by_code/{doctor_code}').get()
                if not existing:
                    break
                doctor_code = generate_doctor_access_code()

            user_doc["doctor_code"] = doctor_code
            print(f"   Generated Doctor Code: {doctor_code}")

            db.reference(f"doctors_by_code/{doctor_code}").set({
                "doctor_uid": uid,
                "created_at": datetime.now().isoformat()
            })

        db.reference(f"users/{uid}").set(user_doc)
        print(f"✅ [USER] User saved successfully!")

        return {
            "success": True,
            "uid": uid,
            "email": user_data.get("email"),
            "role": user_doc["role"],
            "full_name": user_doc["full_name"],
            "doctor_code": doctor_code,
        }

    except Exception as e:
        print(f"❌ [USER] Error saving user: {str(e)}")
        logger.exception("Error saving user to RTDB")
        return {"success": False, "error": str(e)}


@app.route('/auth/register-user', methods=['POST'])
def register_user():
    """
    Create a new user record in RTDB.

    This endpoint is the single source of truth for registration so the
    frontend does not overwrite the user profile after the initial write.
    """
    try:
        data = request.get_json()

        if not data.get('uid'):
            return json_error(400, "UID is required")
        if not data.get('email'):
            return json_error(400, "Email is required")
        if not data.get('role'):
            return json_error(400, "Role is required")

        result = save_user_to_rtdb(data['uid'], data)

        if result['success']:
            return jsonify(result), 201
        else:
            return json_error(500, "Failed to register user", result.get('error'))

    except Exception as e:
        logger.exception("User registration failed")
        return json_error(500, "Registration failed", str(e))


@app.route('/auth/user/<uid>', methods=['GET'])
def get_user(uid):
    try:
        if not firebase_initialized:
            return json_error(500, "Firebase not initialized")

        user_data = db.reference(f"users/{uid}").get()

        if not user_data:
            return json_error(404, "User not found")

        return jsonify({"success": True, "user": user_data}), 200

    except Exception as e:
        logger.exception("Get user failed")
        return json_error(500, "Failed to retrieve user", str(e))


def _report_to_payload(report_id, report_data):
    # Attach the report id and normalize missing comment collections.
    report = report_data or {}
    report["report_id"] = report_id
    report["comments"] = report.get("comments") or {}
    return report


def _find_report(report_id):
    # Shared reports are stored in a flat RTDB branch for dashboard queries.
    if not firebase_initialized:
        return None
    report = db.reference(f"sharedReports/{report_id}").get()
    if report:
        return _report_to_payload(report_id, report)
    return None


def _get_comments(report_id):
    # Return comments sorted by timestamp so the latest feedback appears last.
    if not firebase_initialized:
        return []
    comments = db.reference(f"sharedReports/{report_id}/comments").get() or {}
    if isinstance(comments, dict):
        return sorted(
            [{**value, "comment_id": key} for key, value in comments.items() if isinstance(value, dict)],
            key=lambda item: item.get("timestamp", "")
        )
    return []


def load_assets():
    # Load the ML model and scaler from disk before the prediction endpoint runs.
    global model, scaler
    if model is not None and scaler is not None:
        return True

    try:
        with open(MODEL_PATH, 'rb') as f:
            model = pickle.load(f)
        logger.info("✓ ML model loaded")
        # NOTE: Do NOT monkey-patch model attributes here. If the model
        # was trained with a different scikit-learn version, it must be
        # re-saved (repickled) using the same scikit-learn version as
        # the production environment. We log the model class for
        # diagnostics.
        try:
            cls_name = getattr(model, '__class__', None).__name__ if getattr(model, '__class__', None) else ''
            logger.info("Loaded model class: %s", cls_name)
        except Exception:
            logger.exception("Failed to inspect loaded model class")
        with open(SCALER_PATH, 'rb') as f:
            scaler = pickle.load(f)
        logger.info("✓ Scaler loaded")
        return True
    except Exception as e:
        logger.exception("Failed to load ML assets: %s", e)
        return False


load_assets()


# --- 3. PREDICTION & SAVE LOGIC ---
@app.route('/predict', methods=['POST'])
def predict():
    try:
        if model is None or scaler is None:
            return jsonify({"error": "ML model is not loaded"}), 500

        data = request.get_json()
        
        # Build the model input from the form fields sent by the frontend.

        # Build the model input from the form fields sent by the frontend.
        user_id = data.get('user_id')
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400

        doctor_id = data.get('doctor_id')

        print(f"📋 Processing assessment for user: {user_id}")
        if doctor_id:
            print(f"🏥 Clinic doctor: {doctor_id}")
        else:
            print(f"⚠️  No doctor_id in request — assessment will not appear on doctor dashboard")

        sex = 1 if data.get('gender') == 'Male' else 0
        exang = 1 if data.get('smoking_status') in ['Former Smoker', 'Current Smoker'] else 0

        input_df = pd.DataFrame({
            'age': [float(data['age'])],
            'sex': [sex],
            'chol': [float(data['cholesterol'])],
            'trestbps': [float(data['blood_pressure'])],
            'fbs': [int(data.get('diabetes', 0))],
            'exang': [exang]
        })

        # Scale features and run the classifier.
        scaled_features = scaler.transform(input_df)
        try:
            prediction = int(model.predict(scaled_features)[0])
            probability = model.predict_proba(scaled_features)[0]
        except AttributeError as attr_err:
            # This is commonly caused by a scikit-learn version mismatch
            # between the environment where the model was pickled and the
            # current runtime. Do NOT attempt to silently patch the model
            # here; instead return a clear error and instructions.
            logger.exception("Model attribute error during prediction: %s", attr_err)
            return jsonify({
                "error": "Model runtime incompatibility: missing attribute during prediction.",
                "details": str(attr_err),
                "server_python_version": PY_VERSION,
                "server_sklearn_version": SKLEARN_VERSION,
                "advice": (
                    "Repickle the trained model using the same scikit-learn "
                    "version as the server (see server_sklearn_version) or "
                    "pin the server to the training scikit-learn version in requirements.txt."
                )
            }), 500
        risk_score = round(float(probability[1] * 100), 2)

        result = {
            "risk_percentage": risk_score,
            "prediction": prediction,
            "disease": "Present" if prediction == 1 else "Absent",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "confidence": round(float(max(probability) * 100), 2)
        }

        assessment_id = str(uuid.uuid4())
        result["assessment_id"] = assessment_id
        print(f"Generated assessment_id: {assessment_id}")

        if firebase_initialized:
            try:
                print(f"\n💾 [FIREBASE] Saving assessment {assessment_id}")
                print(f"💾 [FIREBASE] doctor_id: {doctor_id}")

                # Store the result in both the new flat structure and the older nested path.
                assessment_payload = {
                    "assessment_id": assessment_id,
                    "user_id": user_id,
                    "patient_id": user_id,
                    "doctor_id": doctor_id,          # ✅ CRITICAL for doctor dashboard filter
                    "patient_name": data.get('patient_name', 'Unknown'),
                    "input_data": {
                        "age": int(data.get('age')),
                        "gender": data.get('gender'),
                        "cholesterol": int(data.get('cholesterol')),
                        "blood_pressure": int(data.get('blood_pressure')),
                        "diabetes": int(data.get('diabetes', 0)),
                        "smoking_status": data.get('smoking_status')
                    },
                    "prediction_result": {
                        "risk_percentage": result["risk_percentage"],
                        "prediction": result["prediction"],
                        "disease": result["disease"],
                        "confidence": result.get("confidence"),
                        "timestamp": result["timestamp"]
                    },
                    "created_at": datetime.now().isoformat(),
                    "status": "new"
                }

                # Primary path: flat structure for doctor dashboard queries
                db.reference(f'assessments/{assessment_id}').set(assessment_payload)
                print(f"✅ [FIREBASE] Saved: assessments/{assessment_id}")

                # Legacy path: nested under patient for backward compatibility
                db.reference(f'assessments/{user_id}/{assessment_id}').set({
                    "input_data": assessment_payload["input_data"],
                    "results": assessment_payload["prediction_result"],
                    "user_id": user_id,
                    "doctor_id": doctor_id,
                    "created_at": assessment_payload["created_at"]
                })
                print(f"✅ [FIREBASE] Saved: assessments/{user_id}/{assessment_id}")

                if firestore_client is not None:
                    try:
                        firestore_client.collection("assessments").document(assessment_id).set({
                            "assessment_id": assessment_id,
                            "user_id": user_id,
                            "doctor_id": doctor_id,
                            "input_data": assessment_payload["input_data"],
                            "results": assessment_payload["prediction_result"],
                            "timestamp": result["timestamp"],
                            "created_at": utc_now_iso(),
                        })
                        print(f"✅ [FIRESTORE] Saved successfully")
                    except Exception as firestore_err:
                        print(f"⚠️  [FIRESTORE] Save failed (non-fatal): {firestore_err}")

                print(f"✅ [FIREBASE] Assessment saved to all locations\n")

            except Exception as firebase_err:
                print(f"\n❌ [FIREBASE] Save FAILED: {firebase_err}")
                import traceback
                traceback.print_exc()
                print(f"⚠️  Continuing — assessment_id still returned to frontend\n")
        else:
            print("⚠ Firebase not initialized — assessment returned with local ID only")

        return jsonify(result), 200

    except Exception as e:
        print(f"❌ Error in predict: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# --- 4. HEALTH CHECK ---
@app.route('/health', methods=['GET'])
def health():
    # Lightweight endpoint used by deployment checks and monitoring.
    return jsonify({
        "status": "ok",
        "firebase": "connected" if firebase_initialized else "disconnected",
        "ml_model": "loaded" if model is not None else "not loaded"
    }), 200


# --- 5. GET ASSESSMENTS ---
@app.route('/assessments/user/<user_id>/latest', methods=['GET'])
def get_latest_assessment(user_id):
    try:
        if not firebase_initialized:
            return jsonify({"error": "Firebase not initialized"}), 500

        assessments_ref = db.reference(f'assessments/{user_id}')
        assessments_data = assessments_ref.get()

        if not assessments_data:
            return jsonify({"error": "No assessments found", "assessment": None}), 404

        assessments_list = []
        for assessment_id, assessment_data in assessments_data.items():
            assessment_data['assessment_id'] = assessment_id
            assessments_list.append(assessment_data)

        assessments_list.sort(key=lambda x: x.get('created_at', ''), reverse=True)

        if assessments_list:
            return jsonify({"assessment": assessments_list[0], "success": True}), 200
        else:
            return jsonify({"error": "No assessments found", "assessment": None}), 404

    except Exception as e:
        print(f"Error fetching latest assessment: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/assessments/<user_id>', methods=['GET'])
def get_assessments(user_id):
    try:
        if not firebase_initialized:
            return jsonify({"error": "Firebase not initialized"}), 500

        assessments_ref = db.reference(f'assessments/{user_id}')
        assessments_data = assessments_ref.get()

        if not assessments_data:
            return jsonify({"assessments": [], "message": "No assessments found"}), 200

        assessments_list = []
        for assessment_id, assessment_data in assessments_data.items():
            assessment_data['assessment_id'] = assessment_id
            assessments_list.append(assessment_data)

        assessments_list.sort(key=lambda x: x.get('created_at', ''), reverse=True)

        return jsonify({"assessments": assessments_list, "total": len(assessments_list)}), 200

    except Exception as e:
        print(f"Error fetching assessments: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/assessments/<assessment_id>/share', methods=['POST'])
@require_roles({'patient'})
def share_assessment(assessment_id):
    try:
        if not firebase_initialized:
            return json_error(500, "Firebase is not initialized")

        # Patients can share one assessment with an optional doctor target.
        patient_id = g.user_uid
        payload = request.get_json(silent=True) or {}
        doctor_id = payload.get('doctor_id')
        doctor_id = doctor_id.strip() if isinstance(doctor_id, str) else None
        message = payload.get('message', '')

        assessment = get_assessment_for_user(patient_id, assessment_id)
        if not assessment:
            return json_error(404, "Assessment not found")

        if doctor_id:
            doctor_role = get_user_role(doctor_id)
            if doctor_role != 'doctor':
                return json_error(404, "Doctor not found or not verified")

        report_id = str(uuid.uuid4())
        shared_payload = {
            "report_id": report_id,
            "assessment_id": assessment_id,
            "patient_id": patient_id,
            "patient_name": get_user_name(patient_id),
            "doctor_id": doctor_id,
            "prediction_result": assessment.get("results", {}),
            "health_data": assessment.get("input_data", {}),
            "message": message,
            "status": 'shared',
            "created_at": utc_now_iso(),
            "shared_at": utc_now_iso(),
        }

        db.reference(f'sharedReports/{report_id}').set(shared_payload)
        if doctor_id:
            db.reference(f'doctorSharedReports/{doctor_id}/{report_id}').set({
                "report_id": report_id,
                "patient_id": patient_id,
                "patient_name": shared_payload.get("patient_name"),
                "shared_at": utc_now_iso(),
            })
        logger.info("Assessment shared: assessment_id=%s patient_id=%s doctor_id=%s",
                    assessment_id, patient_id, doctor_id)

        return jsonify({"success": True, "report_id": report_id}), 200
    except Exception as exc:
        logger.exception("Share assessment failed")
        return json_error(500, "Failed to share assessment", str(exc))


@app.route('/assessments/<assessment_id>/shared-reports', methods=['GET'])
@require_roles({'patient'})
def get_patient_shared_reports_for_assessment(assessment_id):
    try:
        if not firebase_initialized:
            return json_error(500, "Firebase is not initialized")

        patient_id = g.user_uid
        reports = []

        all_reports = db.reference('sharedReports').get() or {}
        if isinstance(all_reports, dict):
            for report_id, report in all_reports.items():
                if not isinstance(report, dict):
                    continue
                if report.get('patient_id') != patient_id:
                    continue
                if report.get('assessment_id') != assessment_id:
                    continue
                normalized = _report_to_payload(report_id, report)
                normalized['comments'] = _get_comments(report_id)
                reports.append(normalized)

        reports.sort(key=lambda x: x.get('shared_at', '') or x.get('created_at', ''), reverse=True)
        return jsonify({"reports": reports}), 200
    except Exception as exc:
        logger.exception("Get patient shared reports failed")
        return json_error(500, "Failed to load shared reports", str(exc))


@app.route('/doctors/<doctor_id>/shared-reports', methods=['GET'])
@require_roles({'doctor'})
def get_doctor_shared_reports(doctor_id):
    try:
        if not firebase_initialized:
            return json_error(500, "Firebase is not initialized")

        if g.user_uid != doctor_id:
            return json_error(403, "Cannot access another doctor's reports")

        reports = []
        doctor_reports = db.reference(f'doctorSharedReports/{doctor_id}').get() or {}
        if isinstance(doctor_reports, dict):
            for report_id, index_item in doctor_reports.items():
                if not isinstance(index_item, dict):
                    continue
                report = _find_report(report_id)
                if not report:
                    continue
                report['patient_name'] = (
                    report.get('patient_name') or
                    index_item.get('patient_name') or
                    get_user_name(report.get('patient_id'))
                )
                report['comments'] = _get_comments(report_id)
                reports.append(report)

        reports.sort(key=lambda x: x.get('shared_at', '') or x.get('created_at', ''), reverse=True)
        return jsonify({"reports": reports}), 200
    except Exception as exc:
        logger.exception("Get doctor shared reports failed")
        return json_error(500, "Failed to fetch shared reports", str(exc))


@app.route('/shared-reports/<report_id>', methods=['GET'])
def get_shared_report(report_id):
    try:
        if not firebase_initialized:
            return json_error(500, "Firebase is not initialized")

        decoded, err = verify_request_token()
        if err:
            return err

        uid = decoded.get('uid')
        role = get_user_role(uid, decoded)

        report = _find_report(report_id)
        if not report:
            return json_error(404, "Shared report not found")

        if uid not in {report.get('patient_id'), report.get('doctor_id')}:
            return json_error(403, "Not allowed to access this report")

        if role == 'doctor' and report.get('doctor_id') != uid:
            return json_error(403, "Doctor is not assigned to this report")

        report['comments'] = _get_comments(report_id)
        return jsonify({"report": report}), 200
    except Exception as exc:
        logger.exception("Get shared report failed")
        return json_error(500, "Failed to fetch shared report", str(exc))


@app.route('/shared-reports/<report_id>/comments', methods=['POST'])
@require_roles({'doctor'})
def add_doctor_comment(report_id):
    try:
        if not firebase_initialized:
            return json_error(500, "Firebase is not initialized")

        report = _find_report(report_id)
        if not report:
            return json_error(404, "Shared report not found")

        if report.get('doctor_id') != g.user_uid:
            return json_error(403, "Only the assigned doctor can comment")

        payload = request.get_json(silent=True) or {}
        comment_text = (payload.get('comment') or '').strip()
        if not comment_text:
            return json_error(400, "comment is required")

        comment_id = str(uuid.uuid4())
        comment_payload = {
            "comment_id": comment_id,
            "report_id": report_id,
            "doctor_id": g.user_uid,
            "doctor_name": get_user_name(g.user_uid),
            "patient_id": report.get('patient_id'),
            "comment": comment_text,
            "timestamp": utc_now_iso(),
        }

        db.reference(f'sharedReports/{report_id}/comments/{comment_id}').set(comment_payload)
        db.reference(f'sharedReports/{report_id}').update({
            "status": "reviewed",
            "reviewed_at": utc_now_iso(),
            "reviewed_by": g.user_uid,
        })

        logger.info("Doctor comment added: report_id=%s doctor_id=%s", report_id, g.user_uid)
        return jsonify({"success": True, "comment_id": comment_id}), 200
    except Exception as exc:
        logger.exception("Add doctor comment failed")
        return json_error(500, "Failed to save doctor comment", str(exc))


# --- 6. DOCTOR PATIENT MANAGEMENT ---

def categorize_risk(risk_percentage):
    # Map the numeric score into the buckets shown in dashboard widgets.
    if risk_percentage >= 70:
        return 'high'
    elif risk_percentage >= 40:
        return 'moderate'
    else:
        return 'low'


@app.route('/doctors/<doctor_id>/patients', methods=['GET'])
@require_roles({'doctor'})
def get_doctor_patients(doctor_id):
    try:
        if not firebase_initialized:
            return json_error(500, "Firebase is not initialized")

        if g.user_uid != doctor_id:
            return json_error(403, "Cannot access another doctor's patient list")

        doctor_reports = db.reference(f'doctorSharedReports/{doctor_id}').get() or {}

        patients = {}
        if isinstance(doctor_reports, dict):
            for report_id, index_item in doctor_reports.items():
                if not isinstance(index_item, dict):
                    continue
                report = _find_report(report_id)
                if not report:
                    continue

                patient_id = report.get('patient_id')
                risk_percentage = report.get('prediction_result', {}).get('risk_percentage', 0)
                risk_category = categorize_risk(risk_percentage)

                if patient_id not in patients or report.get('shared_at', '') > patients[patient_id].get('last_shared', ''):
                    patients[patient_id] = {
                        'patient_id': patient_id,
                        'patient_name': report.get('patient_name') or get_user_name(patient_id),
                        'last_report_id': report_id,
                        'risk_percentage': risk_percentage,
                        'risk_category': risk_category,
                        'last_shared': report.get('shared_at', ''),
                        'status': report.get('status', 'shared'),
                        'comments_count': len(report.get('comments', {}))
                    }

        patients_list = list(patients.values())
        patients_list.sort(key=lambda x: x['last_shared'], reverse=True)

        stats = {
            'total_patients': len(patients_list),
            'high_risk': len([p for p in patients_list if p['risk_category'] == 'high']),
            'moderate_risk': len([p for p in patients_list if p['risk_category'] == 'moderate']),
            'low_risk': len([p for p in patients_list if p['risk_category'] == 'low']),
        }

        return jsonify({"success": True, "patients": patients_list, "statistics": stats}), 200

    except Exception as exc:
        logger.exception("Get doctor patients failed")
        return json_error(500, "Failed to fetch patient list", str(exc))


@app.route('/doctors/<doctor_id>/patients/search', methods=['GET'])
@require_roles({'doctor'})
def search_doctor_patients(doctor_id):
    try:
        if not firebase_initialized:
            return json_error(500, "Firebase is not initialized")

        if g.user_uid != doctor_id:
            return json_error(403, "Cannot access another doctor's patient list")

        search_term = request.args.get('search', '').lower().strip()
        risk_filter = request.args.get('risk_level', 'all').lower().strip()

        if risk_filter not in ['all', 'high', 'moderate', 'low']:
            return json_error(400, "Invalid risk_level filter")

        doctor_reports = db.reference(f'doctorSharedReports/{doctor_id}').get() or {}

        patients = {}
        if isinstance(doctor_reports, dict):
            for report_id, index_item in doctor_reports.items():
                if not isinstance(index_item, dict):
                    continue
                report = _find_report(report_id)
                if not report:
                    continue

                patient_id = report.get('patient_id')
                patient_name = report.get('patient_name') or get_user_name(patient_id)
                risk_percentage = report.get('prediction_result', {}).get('risk_percentage', 0)
                risk_category = categorize_risk(risk_percentage)

                if search_term and search_term not in (patient_name or '').lower():
                    continue
                if risk_filter != 'all' and risk_category != risk_filter:
                    continue

                if patient_id not in patients or report.get('shared_at', '') > patients[patient_id].get('last_shared', ''):
                    patients[patient_id] = {
                        'patient_id': patient_id,
                        'patient_name': patient_name,
                        'last_report_id': report_id,
                        'risk_percentage': risk_percentage,
                        'risk_category': risk_category,
                        'last_shared': report.get('shared_at', ''),
                        'status': report.get('status', 'shared'),
                        'comments_count': len(report.get('comments', {}))
                    }

        patients_list = list(patients.values())
        patients_list.sort(key=lambda x: x['last_shared'], reverse=True)

        return jsonify({
            "success": True,
            "patients": patients_list,
            "total": len(patients_list),
            "search_term": search_term,
            "risk_filter": risk_filter
        }), 200

    except Exception as exc:
        logger.exception("Search doctor patients failed")
        return json_error(500, "Failed to search patients", str(exc))


@app.route('/patients/<patient_id>/doctors', methods=['GET'])
@require_roles({'patient'})
def get_patient_doctors(patient_id):
    try:
        if not firebase_initialized:
            return json_error(500, "Firebase is not initialized")

        if g.user_uid != patient_id:
            return json_error(403, "Cannot access another patient's doctor list")

        all_reports = db.reference('sharedReports').get() or {}

        doctors = {}
        if isinstance(all_reports, dict):
            for report_id, report in all_reports.items():
                if not isinstance(report, dict):
                    continue
                if report.get('patient_id') != patient_id:
                    continue
                doctor_id = report.get('doctor_id')
                if not doctor_id:
                    continue
                if doctor_id not in doctors or report.get('shared_at', '') > doctors[doctor_id].get('last_shared', ''):
                    doctors[doctor_id] = {
                        'doctor_id': doctor_id,
                        'doctor_name': get_user_name(doctor_id),
                        'last_report_id': report_id,
                        'last_shared': report.get('shared_at', ''),
                        'status': report.get('status', 'shared'),
                        'comments_count': len(report.get('comments', {}))
                    }

        doctors_list = list(doctors.values())
        doctors_list.sort(key=lambda x: x['last_shared'], reverse=True)

        return jsonify({"success": True, "doctors": doctors_list, "total": len(doctors_list)}), 200

    except Exception as exc:
        logger.exception("Get patient doctors failed")
        return json_error(500, "Failed to fetch doctor list", str(exc))


@app.route('/risk-statistics/<user_id>', methods=['GET'])
def get_risk_statistics(user_id):
    try:
        if not firebase_initialized:
            return json_error(500, "Firebase is not initialized")

        user_type = request.args.get('type', 'patient').lower()

        if user_type == 'patient':
            assessments_data = db.reference(f'assessments/{user_id}').get() or {}
            if not isinstance(assessments_data, dict):
                return json_error(400, "Invalid user ID")

            risks = [
                a.get('results', {}).get('risk_percentage', 0)
                for a in assessments_data.values()
            ]

            stats = {
                'total_assessments': len(risks),
                'current_risk': risks[0] if risks else 0,
                'current_category': categorize_risk(risks[0]) if risks else 'low',
                'average_risk': sum(risks) / len(risks) if risks else 0,
                'max_risk': max(risks) if risks else 0,
                'min_risk': min(risks) if risks else 0,
            }

        elif user_type == 'doctor':
            doctor_reports = db.reference(f'doctorSharedReports/{user_id}').get() or {}
            risks_by_category = {'high': 0, 'moderate': 0, 'low': 0}
            risks = []

            if isinstance(doctor_reports, dict):
                for report_id in doctor_reports:
                    report = _find_report(report_id)
                    if report:
                        risk = report.get('prediction_result', {}).get('risk_percentage', 0)
                        risks.append(risk)
                        risks_by_category[categorize_risk(risk)] += 1

            stats = {
                'total_patients': len(risks),
                'high_risk_count': risks_by_category['high'],
                'moderate_risk_count': risks_by_category['moderate'],
                'low_risk_count': risks_by_category['low'],
                'average_patient_risk': sum(risks) / len(risks) if risks else 0,
            }

        else:
            return json_error(400, "Invalid user type")

        return jsonify({"success": True, "statistics": stats, "user_type": user_type}), 200

    except Exception as exc:
        logger.exception("Get risk statistics failed")
        return json_error(500, "Failed to fetch statistics", str(exc))


# --- 7. DOCTOR ACCESS CODE MANAGEMENT ---

@app.route('/doctor/generate-access-code', methods=['POST'])
@require_roles(['doctor'])
def generate_doctor_access_code_endpoint():
    try:
        doctor_uid = g.user_uid

        existing_code = db.reference(f'users/{doctor_uid}/doctor_code').get()
        if existing_code:
            return jsonify({
                "success": True,
                "doctor_code": existing_code,
                "message": "Using existing access code",
                "is_new": False
            }), 200

        access_code = generate_doctor_access_code()
        for _ in range(10):
            if not db.reference(f'doctors_by_code/{access_code}').get():
                break
            access_code = generate_doctor_access_code()

        db.reference(f'users/{doctor_uid}/doctor_code').set(access_code)
        db.reference(f'doctors_by_code/{access_code}').set({
            'doctor_uid': doctor_uid,
            'created_at': datetime.now().isoformat()
        })

        return jsonify({
            "success": True,
            "doctor_code": access_code,
            "message": "Access code generated successfully",
            "is_new": True
        }), 200

    except Exception as exc:
        logger.exception("Generate access code failed")
        return json_error(500, "Failed to generate access code", str(exc))


@app.route('/doctor/lookup-by-code/<access_code>', methods=['GET'])
def lookup_doctor_by_access_code(access_code):
    """
    Look up a doctor's UID by their access code.
    Used by patients during registration to verify and link to a doctor.
    """
    try:
        # Normalize the code so users can enter it in any casing.
        access_code = access_code.strip().upper()

        if not access_code.startswith('DR') or len(access_code) != 8:
            return json_error(400, "Invalid access code format. Expected format: DR123456")

        print(f"🔍 [DOCTOR_CODE] Looking up doctor with access code: {access_code}")

        code_entry = db.reference(f'doctors_by_code/{access_code}').get()
        if not code_entry or not code_entry.get('doctor_uid'):
            return json_error(404, "Access code not found. Please check and try again.")

        doctor_uid = code_entry['doctor_uid']
        doctor_data = db.reference(f'users/{doctor_uid}').get()

        if not doctor_data or doctor_data.get('role') != 'doctor':
            return json_error(404, "Doctor profile not found")

        # ✅ FIX: RTDB stores full_name, not separate firstName/lastName.
        # Try all possible field combinations before falling back to email.
        first_name = doctor_data.get('firstName') or doctor_data.get('first_name') or ''
        last_name = doctor_data.get('lastName') or doctor_data.get('last_name') or ''
        doctor_name = (
            f"{first_name} {last_name}".strip()
            or doctor_data.get('full_name')
            or doctor_data.get('name')
            or doctor_data.get('email', 'Unknown Doctor')
        )
        doctor_email = doctor_data.get('email', 'N/A')

        print(f"✅ [DOCTOR_CODE] Found doctor: {doctor_name} ({doctor_uid})")

        return jsonify({
            "success": True,
            "doctor_uid": doctor_uid,
            "doctor_name": doctor_name,
            "doctor_email": doctor_email,
            "doctor_code": access_code
        }), 200

    except Exception as exc:
        logger.exception("Lookup doctor by access code failed")
        return json_error(500, "Failed to lookup doctor", str(exc))


if __name__ == '__main__':
    # Local development entrypoint: verify assets and start the Flask server.
    logger.info("✓ Flask started")
    print("\n" + "=" * 50)
    print("🚀 Starting Flask Backend")
    print("=" * 50)

    if load_assets():
        print("\n🎯 All systems ready!\n")

        # Read port from environment (Railway sets PORT). Default to 5000 for local dev.
        try:
            port = int(os.getenv("PORT", "5000"))
        except ValueError:
            port = 5000

        debug_mode = os.getenv("FLASK_DEBUG", "false").lower() == "true"
        logger.info("Starting Flask on 0.0.0.0:%s (debug=%s). CORS origins=%s", port, debug_mode, cors_origins)

        # Bind to 0.0.0.0 so external hosts (Railway) can reach the server.
        app.run(host="0.0.0.0", port=port, debug=debug_mode)
    else:
        print("\n❌ Failed to load ML assets. Exiting.\n")
