# Role-Based Authentication System - Implementation Guide

## Overview
This guide describes the complete role-based authentication system for the Heart Disease Prediction application using React, Firebase Authentication, and Firebase Realtime Database.

---

## System Architecture

### User Roles
- **Patient** (`role: 'patient'`): Can take assessments and share reports with doctors
- **Doctor** (`role: 'doctor'`): Can view shared patient reports and add comments
- **Pending Doctor** (`role: 'pending_doctor'`): Doctor under review/verification

### Data Structure (Firebase Realtime Database)

#### 1. User Roles
```
users/
├── {uid}/
│   ├── uid
│   ├── email
│   ├── firstName
│   ├── lastName
│   ├── role                    # 'patient', 'doctor', 'pending_doctor'
│   ├── verified                # true/false
│   ├── profilePicture          # URL
│   ├── specialization          # (doctor only)
│   └── updatedAt               # ISO timestamp
```

#### 2. Shared Reports
```
sharedReports/
├── {reportId}/
│   ├── report_id               # UUID
│   ├── patient_id              # Patient UID
│   ├── patient_name            # Full name
│   ├── doctor_id               # Doctor UID
│   ├── assessment_id           # Assessment ID
│   ├── status                  # 'shared', 'reviewed', 'archived'
│   ├── message                 # Patient message
│   ├── created_at              # ISO timestamp
│   ├── shared_at               # ISO timestamp
│   ├── prediction_result/
│   │   ├── risk_percentage     # 0-100
│   │   ├── disease             # Disease name/type
│   │   ├── confidence          # 0-100
│   │   └── recommendations     # Array of strings
│   └── comments/
│       └── {commentId}/
│           ├── comment_id
│           ├── doctor_id
│           ├── doctor_name
│           ├── comment
│           └── timestamp
```

#### 3. Doctor Shared Reports Index (for fast lookups)
```
doctorSharedReports/
├── {doctorId}/
│   └── {reportId}/
│       ├── report_id
│       ├── patient_id
│       ├── patient_name
│       └── shared_at
```

---

## Firebase Utilities (`utils/firebaseUtils.js`)

### User Role Management

#### Fetch User Role
```javascript
import { fetchUserRoleFromRTDB } from '../utils/firebaseUtils';

const user = await fetchUserRoleFromRTDB(uid);
// Returns: { uid, email, firstName, lastName, role, verified, ... }
```

#### Set User Role
```javascript
import { setUserRoleInRTDB } from '../utils/firebaseUtils';

await setUserRoleInRTDB(uid, {
  email: 'doctor@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'doctor',
  verified: true,
  specialization: 'Cardiology'
});
```

#### Update User Role
```javascript
import { updateUserRole } from '../utils/firebaseUtils';

await updateUserRole(uid, 'doctor');
```

#### Check if User is Doctor
```javascript
import { isDoctor } from '../utils/firebaseUtils';

const isDoctorUser = await isDoctor(uid);
// Returns: true/false
```

#### Subscribe to Role Changes (Real-time)
```javascript
import { subscribeToUserRole } from '../utils/firebaseUtils';

const unsubscribe = subscribeToUserRole(uid, (user) => {
  console.log('User updated:', user);
});

// Later, unsubscribe to clean up
unsubscribe();
```

### Report Sharing

#### Share Report with Doctor
```javascript
import { shareReportWithDoctorRTDB } from '../utils/firebaseUtils';

const report = await shareReportWithDoctorRTDB({
  patientId: 'patient_uid',
  patientName: 'John Smith',
  doctorId: 'doctor_uid',
  assessmentId: 'assessment_123',
  predictionResult: {
    risk_percentage: 75.5,
    disease: 'Heart Disease',
    confidence: 92.3,
    recommendations: ['Consult cardiologist', 'Exercise daily']
  },
  message: 'Please review my assessment'
});
// Returns: full report object with report_id
```

#### Fetch Specific Report
```javascript
import { fetchSharedReportRTDB } from '../utils/firebaseUtils';

const report = await fetchSharedReportRTDB(reportId);
// Returns: report data with comments array
```

#### Fetch All Reports for a Doctor (Real-time Subscription)
```javascript
import { subscribeToDoctorSharedReports } from '../utils/firebaseUtils';

const unsubscribe = subscribeToDoctorSharedReports(doctorId, (reports) => {
  console.log('Doctor reports updated:', reports);
  // Update UI with new reports
});

// Later, unsubscribe
unsubscribe();
```

#### Fetch Patient's Shared Reports
```javascript
import { fetchPatientSharedReportsRTDB } from '../utils/firebaseUtils';

const reports = await fetchPatientSharedReportsRTDB(patientId);
// Returns: array of all reports shared by patient
```

#### Fetch Reports for Specific Assessment
```javascript
import { fetchReportsByAssessmentRTDB } from '../utils/firebaseUtils';

const reports = await fetchReportsByAssessmentRTDB(assessmentId);
// Returns: array of shared reports for this assessment
```

### Doctor Comments

#### Add Comment to Report
```javascript
import { addCommentToReportRTDB } from '../utils/firebaseUtils';

const comment = await addCommentToReportRTDB(reportId, {
  doctorId: 'doctor_uid',
  doctorName: 'Dr. John Doe',
  comment: 'Your risk level is moderate. Please follow up with diet changes.'
});
// Returns: comment object with comment_id
// Automatically updates report status to 'reviewed'
```

#### Fetch Report Comments
```javascript
import { fetchReportCommentsRTDB } from '../utils/firebaseUtils';

const comments = await fetchReportCommentsRTDB(reportId);
// Returns: array of comment objects
```

#### Subscribe to Comment Updates (Real-time)
```javascript
import { subscribeToReportComments } from '../utils/firebaseUtils';

const unsubscribe = subscribeToReportComments(reportId, (comments) => {
  console.log('Comments updated:', comments);
});

// Later, unsubscribe
unsubscribe();
```

#### Delete Comment
```javascript
import { deleteCommentRTDB } from '../utils/firebaseUtils';

await deleteCommentRTDB(reportId, commentId);
```

### Report Status Management

#### Update Report Status
```javascript
import { updateReportStatus } from '../utils/firebaseUtils';

// Status can be: 'shared', 'reviewed', 'archived'
await updateReportStatus(reportId, 'reviewed');
```

#### Archive Report
```javascript
import { archiveReportRTDB } from '../utils/firebaseUtils';

await archiveReportRTDB(reportId);
```

### Utility Functions

#### Get All Doctors
```javascript
import { getAllDoctorsRTDB } from '../utils/firebaseUtils';

const doctors = await getAllDoctorsRTDB();
// Returns: array of verified doctor users
```

#### Search Doctors
```javascript
import { searchDoctorsRTDB } from '../utils/firebaseUtils';

const results = await searchDoctorsRTDB('John');
// Returns: array of doctors matching 'John' in name or email
```

#### Get Doctor Info
```javascript
import { getDoctorInfoRTDB } from '../utils/firebaseUtils';

const doctor = await getDoctorInfoRTDB(doctorId);
// Returns: doctor user data
```

---

## Components

### 1. ShareWithDoctorModal
**Location:** `components/ShareWithDoctorModal.js`

Modal for patients to select a doctor and share their assessment report.

**Usage:**
```javascript
import ShareWithDoctorModal from '../components/ShareWithDoctorModal';
import { useState } from 'react';

function MyComponent() {
  const [showShareModal, setShowShareModal] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [user, setUser] = useState(null);

  return (
    <>
      <button onClick={() => setShowShareModal(true)}>
        Share with Doctor
      </button>

      {showShareModal && (
        <ShareWithDoctorModal
          assessment={assessment}
          patientData={user}
          onClose={() => setShowShareModal(false)}
          onSuccess={(report) => {
            console.log('Report shared:', report);
          }}
        />
      )}
    </>
  );
}
```

**Props:**
- `assessment` (Object): Assessment data with `assessment_id`, `risk_percentage`, etc.
- `patientData` (Object): Patient info with `id`, `first_name`, `last_name`
- `onClose` (Function): Callback when modal is closed
- `onSuccess` (Function): Callback when report is successfully shared

### 2. ProtectedRoute
**Location:** `components/ProtectedRoute.js`

Enforces role-based access control for routes.

**Features:**
- Checks Firebase authentication
- Verifies user role from Firestore
- Redirects to appropriate dashboard based on role
- Syncs role to localStorage

**Usage:**
```javascript
<Route 
  path="/doctor-dashboard" 
  element={<ProtectedRoute 
    component={DoctorDashboard} 
    allowedRoles={["doctor"]} 
  />} 
/>
```

### 3. DoctorFeedback
**Location:** `components/DoctorFeedback.js`

Text area component for doctors to add clinical comments.

**Usage:**
```javascript
<DoctorFeedback
  onSubmit={async (notes) => {
    await addCommentToReportRTDB(reportId, {
      doctorId: doctor.id,
      doctorName: `Dr. ${doctor.first_name}`,
      comment: notes
    });
  }}
  onSaved={() => console.log('Comment saved')}
  label="Clinical Notes"
  placeholder="Enter your observations..."
/>
```

---

## Login Flow with Role-Based Navigation

### Login Process (`pages/Login.js`)

1. **User enters credentials** → Firebase Authentication
2. **Fetch user profile:**
   - Priority 1: Firestore `users/{uid}`
   - Priority 2: Firebase RTDB `users/{uid}`
   - Priority 3: Firebase Auth data
3. **Extract role** from user data
4. **Store in localStorage:**
   ```json
   {
     "id": "uid",
     "first_name": "John",
     "last_name": "Doe",
     "email": "john@example.com",
     "role": "doctor|patient",
     "verified": true|false,
     "profile_picture": "url"
   }
   ```
5. **Role-based redirect:**
   - If `role === 'doctor'` → Navigate to `/doctor-dashboard`
   - Otherwise → Navigate to `/dashboard`

**Code Example:**
```javascript
const handleLogin = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  
  // Fetch profile (Firestore → RTDB → Auth)
  const userProfile = await fetchUserProfile(user);
  
  // Store user
  localStorage.setItem('user', JSON.stringify(userProfile));
  
  // Navigate based on role
  navigate(userProfile.role === 'doctor' ? '/doctor-dashboard' : '/dashboard');
};
```

---

## Doctor Dashboard (`pages/DoctorDashboard.js`)

### Features
- ✅ Real-time list of shared reports
- ✅ Display patient name and risk level
- ✅ View assessment details
- ✅ Add clinical comments/notes
- ✅ Update report status
- ✅ Real-time comment updates

### Implementation with Firebase RTDB

```javascript
import React, { useEffect, useState } from 'react';
import { 
  subscribeToDoctorSharedReports,
  fetchSharedReportRTDB,
  addCommentToReportRTDB,
  subscribeToReportComments
} from '../utils/firebaseUtils';

function DoctorDashboard() {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [comments, setComments] = useState([]);
  const [unsubscribeReports, setUnsubscribeReports] = useState(null);
  const [unsubscribeComments, setUnsubscribeComments] = useState(null);
  const user = JSON.parse(localStorage.getItem('user'));

  // Subscribe to real-time reports
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = subscribeToDoctorSharedReports(user.id, (newReports) => {
      setReports(newReports);
    });

    setUnsubscribeReports(() => unsubscribe);

    return () => unsubscribe();
  }, [user?.id]);

  // Subscribe to report comments
  useEffect(() => {
    if (!selectedReport?.report_id) return;

    const unsubscribe = subscribeToReportComments(
      selectedReport.report_id,
      (newComments) => {
        setComments(newComments);
      }
    );

    setUnsubscribeComments(() => unsubscribe);

    return () => unsubscribe();
  }, [selectedReport?.report_id]);

  const handleSelectReport = async (reportId) => {
    const report = await fetchSharedReportRTDB(reportId);
    setSelectedReport(report);
  };

  const handleAddComment = async (commentText) => {
    await addCommentToReportRTDB(selectedReport.report_id, {
      doctorId: user.id,
      doctorName: `Dr. ${user.first_name}`,
      comment: commentText
    });
  };

  return (
    <div className="doctor-dashboard">
      <h1>Shared Patient Reports</h1>
      
      <div className="reports-grid">
        {reports.map((report) => (
          <div 
            key={report.report_id}
            onClick={() => handleSelectReport(report.report_id)}
          >
            <h3>{report.patient_name}</h3>
            <p>Risk: {report.prediction_result?.risk_percentage}%</p>
          </div>
        ))}
      </div>

      {selectedReport && (
        <div className="report-details">
          <h2>{selectedReport.patient_name}'s Report</h2>
          
          <div className="risk-info">
            <p>Risk Level: {selectedReport.prediction_result?.risk_percentage}%</p>
            <p>Status: {selectedReport.status}</p>
          </div>

          <div className="comments-section">
            <h3>Clinical Notes ({comments.length})</h3>
            {comments.map((comment) => (
              <div key={comment.comment_id} className="comment">
                <p>{comment.comment}</p>
                <small>{new Date(comment.timestamp).toLocaleString()}</small>
              </div>
            ))}
          </div>

          <textarea
            placeholder="Add your clinical notes..."
            onBlur={(e) => {
              if (e.target.value) {
                handleAddComment(e.target.value);
                e.target.value = '';
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

export default DoctorDashboard;
```

---

## Patient Assessment Results with Share Button

### Integration in AssessmentResults Page

```javascript
import React, { useState } from 'react';
import ShareWithDoctorModal from '../components/ShareWithDoctorModal';

function AssessmentResults() {
  const [showShareModal, setShowShareModal] = useState(false);
  const assessment = useLocation().state?.prediction;
  const user = JSON.parse(localStorage.getItem('user'));

  return (
    <div>
      <h1>Assessment Results</h1>
      
      {/* Result details... */}

      {user?.role === 'patient' && (
        <button onClick={() => setShowShareModal(true)}>
          Share with Doctor
        </button>
      )}

      {showShareModal && (
        <ShareWithDoctorModal
          assessment={assessment}
          patientData={user}
          onClose={() => setShowShareModal(false)}
          onSuccess={(report) => {
            alert('Report shared successfully!');
          }}
        />
      )}
    </div>
  );
}

export default AssessmentResults;
```

---

## Routing Configuration (`App.js`)

```javascript
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import DoctorDashboard from './pages/DoctorDashboard';

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected Patient Routes */}
      <Route 
        path="/dashboard" 
        element={<ProtectedRoute 
          component={Dashboard} 
          allowedRoles={["patient", "pending_doctor"]} 
        />} 
      />
      <Route 
        path="/assessment-results" 
        element={<ProtectedRoute 
          component={AssessmentResults} 
          allowedRoles={["patient", "pending_doctor"]} 
        />} 
      />

      {/* Protected Doctor Routes */}
      <Route 
        path="/doctor-dashboard" 
        element={<ProtectedRoute 
          component={DoctorDashboard} 
          allowedRoles={["doctor"]} 
        />} 
      />

      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
```

---

## Testing Role-Based Flow

### Test Scenario 1: Patient Shares Report with Doctor

1. **Login as Patient**
   - User: patient@example.com (role: 'patient')
   - Navigate to `/dashboard`
   - Complete assessment
   - Click "Share with Doctor"

2. **Select Doctor**
   - Modal shows list of verified doctors
   - Search for doctor by name or email
   - Select doctor
   - Add message: "Please review this"

3. **Report Created in RTDB**
   - Report saved to `sharedReports/{reportId}`
   - Index created in `doctorSharedReports/{doctorId}/{reportId}`
   - Patient can view all shared reports

### Test Scenario 2: Doctor Views Shared Reports

1. **Login as Doctor**
   - User: doctor@example.com (role: 'doctor')
   - Redirected to `/doctor-dashboard`
   - Real-time list of shared reports updates

2. **View Patient Report**
   - Click on patient name
   - See assessment results
   - View patient's message
   - View existing comments

3. **Add Clinical Note**
   - Type comment in text area
   - Click "Save Comment"
   - Comment saved to `sharedReports/{reportId}/comments/{commentId}`
   - Report status updated to 'reviewed'
   - Patient sees comment in their assessment results

### Test Scenario 3: Access Control

1. **Patient tries to access `/doctor-dashboard`**
   - ProtectedRoute checks role
   - Route blocks access
   - Redirects to `/dashboard`

2. **Doctor tries to access `/dashboard`**
   - ProtectedRoute checks role
   - Route blocks access
   - Redirects to `/doctor-dashboard`

---

## Environment Setup

### Firebase Configuration
Ensure `config/firebase.js` has:
```javascript
export const rtdb = getDatabase(app);  // Realtime Database
export const db = getFirestore(app);   // Firestore (optional)
export const auth = getAuth(app);      // Authentication
```

### Install UUID (if not already installed)
```bash
npm install uuid
```

### Firebase Realtime Database Rules
```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'admin'",
        ".write": "$uid === auth.uid"
      }
    },
    "sharedReports": {
      "$reportId": {
        ".read": "root.child('sharedReports').child($reportId).child('doctor_id').val() === auth.uid || root.child('sharedReports').child($reportId).child('patient_id').val() === auth.uid",
        ".write": "root.child('sharedReports').child($reportId).child('doctor_id').val() === auth.uid || root.child('sharedReports').child($reportId).child('patient_id').val() === auth.uid"
      }
    },
    "doctorSharedReports": {
      "$doctorId": {
        ".read": "$doctorId === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'admin'",
        ".write": "root.child('users').child(auth.uid).child('role').val() === 'admin'"
      }
    }
  }
}
```

---

## Security Considerations

1. **Authentication:** All requests protected by Firebase Auth
2. **Database Rules:** Reports visible only to patient and doctor
3. **Role Verification:** Server-side validation (add to backend if needed)
4. **Data Validation:** Sanitize user input before saving
5. **HTTPS Only:** Always use HTTPS in production

---

## Troubleshooting

### Issue: User role not updating
- **Solution:** Check Firestore and RTDB for role field
- **Check:** `localStorage.getItem('user')` in browser console

### Issue: Reports not showing in doctor dashboard
- **Solution:** Verify `doctorId` matches authenticated user ID
- **Check:** `subscribeToDoctorSharedReports` is called with correct doctorId

### Issue: Comments not appearing
- **Solution:** Ensure comment is being saved before subscription
- **Check:** Monitor Firebase RTDB in Firebase Console

### Issue: Modal not closing after share
- **Solution:** Check if `onSuccess` callback is called
- **Check:** Console for errors in `shareReportWithDoctorRTDB`

---

## Summary of Key Files

| File | Purpose |
|------|---------|
| `utils/firebaseUtils.js` | Firebase RTDB operations |
| `components/ShareWithDoctorModal.js` | Share modal UI |
| `pages/Login.js` | Authentication with role check |
| `pages/DoctorDashboard.js` | Doctor portal |
| `pages/AssessmentResults.js` | Results with share button |
| `components/ProtectedRoute.js` | Role-based routing |
| `App.js` | Route configuration |

---

## Next Steps

1. ✅ Set up Firebase RTDB structure
2. ✅ Create test users (patient, doctor)
3. ✅ Test role-based login and navigation
4. ✅ Test share report functionality
5. ✅ Test doctor dashboard and comments
6. ✅ Deploy and verify in production

