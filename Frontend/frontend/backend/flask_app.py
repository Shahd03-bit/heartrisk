from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, auth, firestore
from functools import wraps

app = Flask(__name__)
# Restrict CORS to the React dev server origins used during development
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}}, supports_credentials=True)

# Initialize Firebase Admin SDK
# Make sure to set GOOGLE_APPLICATION_CREDENTIALS env var to your service account JSON
cred = None
try:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred)
except Exception as e:
    print('Firebase admin initialization error:', e)

db = firestore.client()


def verify_token(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        id_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not id_token:
            return jsonify({'message': 'Missing token'}), 401
        try:
            decoded = auth.verify_id_token(id_token)
            request.uid = decoded.get('uid')
            request.claims = decoded
        except Exception as e:
            return jsonify({'message': 'Invalid token', 'error': str(e)}), 401
        return f(*args, **kwargs)
    return wrapper


@app.route('/assessments/<assessment_id>/share', methods=['POST'])
@verify_token
def share_assessment(assessment_id):
    print(f"Received share request for assessment {assessment_id} from {request.uid}")
    data = request.get_json() or {}
    doctor_id = data.get('doctor_id')
    message = data.get('message')

    # Load assessment
    assessment_ref = db.collection('assessments').document(assessment_id)
    assessment = assessment_ref.get()
    if not assessment.exists:
        return jsonify({'message': 'Assessment not found'}), 404

    patient_id = assessment.to_dict().get('user_id')
    if patient_id != request.uid:
        return jsonify({'message': 'Forbidden'}), 403

    # Create shared report
    shared_ref = db.collection('sharedReports').document()
    shared_ref.set({
        'report_id': shared_ref.id,
        'assessment_id': assessment_id,
        'patientId': patient_id,
        'doctorId': doctor_id,
        'predictionResult': assessment.to_dict().get('results'),
        'healthData': assessment.to_dict().get('input_data'),
        'message': message or '',
        'status': 'shared',
        'timestamp': firestore.SERVER_TIMESTAMP
    })

    return jsonify({'success': True, 'report_id': shared_ref.id}), 201


@app.route('/assessments/user/<user_id>/latest', methods=['GET'])
@verify_token
def get_latest_assessment(user_id):
    # allow user to fetch their own latest assessment
    if user_id != request.uid:
        return jsonify({'message': 'Forbidden'}), 403

    q = db.collection('assessments').where('user_id', '==', user_id).order_by('created_at', direction=firestore.Query.DESCENDING).limit(1).stream()
    latest = None
    for doc in q:
        latest = doc.to_dict()
        latest['assessment_id'] = doc.id
        break

    if not latest:
        return jsonify({'message': 'No assessments found'}), 404

    return jsonify({'assessment': latest})


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200


@app.route('/doctors/<doctor_id>/shared-reports', methods=['GET'])
@verify_token
def doctor_shared_reports(doctor_id):
    # Only allow doctor to fetch their reports
    if doctor_id != request.uid:
        return jsonify({'message': 'Forbidden'}), 403

    q = db.collection('sharedReports').where('doctorId', '==', doctor_id).order_by('timestamp', direction=firestore.Query.DESCENDING).stream()
    reports = []
    for doc in q:
        r = doc.to_dict()
        r['report_id'] = doc.id
        reports.append(r)
    return jsonify({'reports': reports})


@app.route('/assessments/<assessment_id>/shared-reports', methods=['GET'])
@verify_token
def assessment_shared_reports(assessment_id):
    # Allow owner (patient) or assigned doctor to view shared reports for an assessment
    q = db.collection('sharedReports').where('assessment_id', '==', assessment_id).order_by('timestamp', direction=firestore.Query.DESCENDING).stream()
    reports = []
    for doc in q:
        r = doc.to_dict()
        r['report_id'] = doc.id

        # fetch comments for this report
        comments_q = db.collection('doctorComments').where('report_id', '==', doc.id).order_by('timestamp', direction=firestore.Query.ASCENDING).stream()
        comments = [c.to_dict() for c in comments_q]
        r['comments'] = comments

        # enforce access: only include if requester is patient owner or assigned doctor
        if request.uid in [r.get('patientId'), r.get('doctorId')]:
            reports.append(r)

    return jsonify({'reports': reports})


@app.route('/shared-reports/<report_id>', methods=['GET'])
@verify_token
def get_shared_report(report_id):
    doc_ref = db.collection('sharedReports').document(report_id)
    doc = doc_ref.get()
    if not doc.exists:
        return jsonify({'message': 'Not found'}), 404
    data = doc.to_dict()
    # Allow patient or assigned doctor
    if request.uid not in [data.get('patientId'), data.get('doctorId')]:
        return jsonify({'message': 'Forbidden'}), 403
    return jsonify({'report': data})


@app.route('/shared-reports/<report_id>/comments', methods=['POST'])
@verify_token
def post_report_comment(report_id):
    data = request.get_json() or {}
    comment = data.get('comment') or data.get('notes') or ''

    doc_ref = db.collection('sharedReports').document(report_id)
    doc = doc_ref.get()
    if not doc.exists:
        return jsonify({'message': 'Not found'}), 404
    report = doc.to_dict()
    # only assigned doctor can comment
    if request.uid != report.get('doctorId'):
        return jsonify({'message': 'Forbidden'}), 403

    comment_ref = db.collection('doctorComments').document()
    comment_ref.set({
        'comment_id': comment_ref.id,
        'report_id': report_id,
        'doctorId': request.uid,
        'patientId': report.get('patientId'),
        'comment': comment,
        'timestamp': firestore.SERVER_TIMESTAMP
    })

    # Update report status
    doc_ref.update({'status': 'reviewed'})

    return jsonify({'success': True, 'comment_id': comment_ref.id}), 201


if __name__ == '__main__':
    app.run(debug=True)
