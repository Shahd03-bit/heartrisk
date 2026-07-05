# Debugging Guide - Doctor-Patient Sharing Issues

## 🔍 Quick Debug Steps

### **Step 1: Check Browser Console (F12)**

1. Open http://localhost:3000
2. Press `F12` → Click **"Console"** tab
3. Look for any RED error messages
4. Common errors:
   - `Firebase: Error (auth/invalid-credential)` - Wrong password/email
   - `RTDB fetch timeout` - Firebase connection issue
   - `shareReportWithDoctorRTDB failed` - Sharing function error

### **Step 2: Check Firebase Console**

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click **"Realtime Database"**
4. Expand the `users/` node
5. **Should see:**
   - Multiple user entries with `uid` as key
   - Each user has: `email`, `role` (doctor/patient), `firstName`, `lastName`

---

## 🧪 Test Commands in Console

### **Test 1: Check if Patient User Exists**

In browser console, run:
```javascript
// Get a specific user (replace with actual patient email)
firebase.database().ref('users').orderByChild('email').equalTo('sarah.johnson@patient.com').once('value').then(snapshot => {
  console.log('Patient found:', snapshot.val());
});
```

### **Test 2: Get All Doctors**

```javascript
firebase.database().ref('users').once('value').then(snapshot => {
  const users = snapshot.val();
  const doctors = Object.entries(users).filter(([id, user]) => user.role === 'doctor');
  console.log('All doctors:', doctors);
});
```

### **Test 3: Check Shared Reports**

```javascript
firebase.database().ref('sharedReports').once('value').then(snapshot => {
  console.log('All shared reports:', snapshot.val());
});
```

### **Test 4: Check Doctor's Shared Reports Index**

```javascript
// Replace {doctorId} with actual doctor UID
firebase.database().ref('doctorSharedReports/{doctorId}').once('value').then(snapshot => {
  console.log('Reports for doctor:', snapshot.val());
});
```

---

## 🚨 Common Issues & Fixes

### **Issue 1: Doctor Not Appearing in Search**

**Symptom:** Patient searches for doctor, no results

**Causes & Fixes:**

1. **Doctor user not in RTDB**
   ```
   Fix: Go to Firebase Console → Realtime Database
   Check if doctor exists in users/ node
   If not, go back and create doctor account again
   ```

2. **Doctor user has wrong role**
   ```
   Fix: Check Firebase → users/{doctorId} → role field
   Should be exactly: "doctor" (lowercase)
   If not, manually fix in Firebase Console
   ```

3. **Search function broken**
   ```
   Fix: Check browser console (F12) for errors
   Try searching with different terms:
   - Full email: james.williams@doctor.com
   - Last name: Williams  
   - First name: James
   - Partial: james
   ```

---

### **Issue 2: Doctor Doesn't See Shared Report**

**Symptom:** "Report shared successfully" but doctor's dashboard is empty

**Causes & Fixes:**

1. **Report not saved to doctorSharedReports index**
   ```
   Fix: Check Firebase → doctorSharedReports/{doctorId}
   Should have the reportId as a key
   If empty, sharing function has a bug
   ```

2. **Doctor needs to refresh**
   ```
   Fix: Logout and login again
   Or manually refresh: Ctrl+R or F5
   Wait 5 seconds for Firebase to sync
   ```

3. **Real-time subscription not working**
   ```
   Fix: Check browser console for subscription errors
   Restart frontend: npm start
   ```

---

### **Issue 3: Patient Doesn't See Doctor Feedback**

**Symptom:** Doctor adds comment, patient doesn't see it

**Causes & Fixes:**

1. **Comment not saved to sharedReports**
   ```
   Fix: Check Firebase → sharedReports/{reportId}/comments
   Should have comment objects with doctor_id, comment text, timestamp
   ```

2. **Patient component not subscribed**
   ```
   Fix: Go to Assessment Results or Dashboard
   Refresh page (Ctrl+R)
   DoctorFeedbackDisplay should reload subscription
   ```

3. **Real-time listener not active**
   ```
   Fix: Check browser console → Network tab
   Look for Firebase messages being sent/received
   If not, restart frontend
   ```

---

## 🔧 Manual Fixes in Firebase Console

### **Fix 1: Manually Create Doctor User**

If automatic creation failed:

1. Go to Firebase Console → Realtime Database
2. Click the `+` button to add a new child
3. Create path: `users/{paste-doctor-uid-here}`
4. Add data:
   ```json
   {
     "uid": "doctor-uid",
     "email": "james.williams@doctor.com",
     "firstName": "James",
     "lastName": "Williams",
     "role": "doctor",
     "verified": true,
     "createdAt": "2026-05-26T10:00:00.000Z"
   }
   ```
5. Click "Add"

### **Fix 2: Manually Create Shared Report**

1. Go to Realtime Database → `sharedReports`
2. Create new child with path: `sharedReports/{new-report-id}`
3. Add data:
   ```json
   {
     "report_id": "report-123",
     "patient_id": "patient-uid",
     "patient_name": "Sarah Johnson",
     "doctor_id": "doctor-uid",
     "assessment_id": "assessment-123",
     "prediction_result": {
       "risk_percentage": 45,
       "confidence": 0.87
     },
     "status": "shared",
     "created_at": "2026-05-26T10:05:00.000Z",
     "shared_at": "2026-05-26T10:05:00.000Z"
   }
   ```

---

## 📋 Pre-Test Checklist

Before testing, verify:

- [ ] Backend running: `http://127.0.0.1:5000/health` returns `{"status": "ok"}`
- [ ] Frontend running: `http://localhost:3000` loads
- [ ] Firebase credentials correct in `.env`
- [ ] `serviceAccountKey.json` in backend folder
- [ ] Browser console (F12) has NO red errors on startup
- [ ] Firebase database is accessible
- [ ] CORS properly configured in backend

---

## 🆘 Still Having Issues?

### **Check Logs**

**Backend logs:**
```bash
cd backend
python app.py 2>&1 | tail -50
```

**Frontend logs:**
```
Open browser console: F12 → Console tab
Filter by errors: Look for red text
```

**Firebase logs:**
```
Firebase Console → Realtime Database → Rules
Check if rules are too restrictive
```

### **Test Backend Directly**

```bash
# Test if backend can fetch all doctors
curl -X GET http://127.0.0.1:5000/doctors

# Test health check
curl http://127.0.0.1:5000/health
```

### **Reset and Start Fresh**

```bash
# Clear everything
1. Clear browser localStorage: F12 → Application → Clear all
2. Logout everywhere
3. Refresh: Ctrl+R
4. Stop frontend: Ctrl+C
5. Stop backend: Ctrl+C
6. npm start
7. python app.py
8. Try test workflow again
```

---

## 📞 Need Help?

If nothing works:

1. **Check the full error in console** - Copy and Google it
2. **Check Firebase Connection** - Can you access Firebase database?
3. **Check User Roles** - Are users marked as "doctor" and "patient"?
4. **Check Timestamps** - Firebase data should have created_at timestamps
5. **Check UIDs** - Make sure UIDs are consistent across all records

---

**Remember: The system works in this order:**
```
Create Doctor → Create Patient → Create Assessment 
     ↓
Patient Shares Report → Report appears in Doctor Dashboard
     ↓
Doctor Adds Comment → Patient sees feedback instantly
```

Each step must complete before moving to the next! ✅
