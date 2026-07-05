# Setup & Deployment Guide

## 🚀 Installation Steps

### Step 1: Install Dependencies
```bash
cd d:\FYP2\Frontend\frontend

# Install UUID for generating unique report IDs
npm install uuid
```

### Step 2: Verify Firebase Configuration
Ensure `src/config/firebase.js` has:
```javascript
import { getDatabase } from 'firebase/database';

export const rtdb = getDatabase(app);
export const db = getFirestore(app);
export const auth = getAuth(app);
```

### Step 3: Set Up Firebase Realtime Database

#### 3a: Enable Realtime Database in Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click "Realtime Database" in left menu
4. Click "Create Database"
5. Choose location (e.g., `us-central1`)
6. Start in **Test Mode** (we'll update rules later)

#### 3b: Create Initial Data Structure
In Firebase Console → Realtime Database, manually create:

```
users/
  test-patient-uid/
    email: "patient@example.com"
    firstName: "John"
    lastName: "Patient"
    role: "patient"
    verified: true
    profilePicture: ""
    uid: "test-patient-uid"

  test-doctor-uid/
    email: "doctor@example.com"
    firstName: "Jane"
    lastName: "Doctor"
    role: "doctor"
    verified: true
    profilePicture: ""
    uid: "test-doctor-uid"
    specialization: "Cardiology"
```

### Step 4: Set Firebase Realtime Database Rules

1. Go to Firebase Console → Realtime Database
2. Click "Rules" tab
3. Replace with these rules:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'admin'",
        ".write": "$uid === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'admin'",
        ".validate": "newData.hasChildren(['uid', 'email', 'firstName', 'lastName'])"
      }
    },
    "sharedReports": {
      "$reportId": {
        ".read": "root.child('sharedReports').child($reportId).child('doctor_id').val() === auth.uid || root.child('sharedReports').child($reportId).child('patient_id').val() === auth.uid",
        ".write": "root.child('sharedReports').child($reportId).child('doctor_id').val() === auth.uid || root.child('sharedReports').child($reportId).child('patient_id').val() === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'admin'",
        ".validate": "newData.hasChildren(['report_id', 'patient_id', 'doctor_id', 'assessment_id'])"
      }
    },
    "doctorSharedReports": {
      "$doctorId": {
        ".read": "$doctorId === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'admin'",
        ".write": "root.child('users').child(auth.uid).child('role').val() === 'admin'"
      }
    },
    ".read": false,
    ".write": false
  }
}
```

4. Click "Publish"

### Step 5: Create Test User Accounts

#### Option A: Use Firebase Console Auth
1. Go to Firebase Console → Authentication
2. Click "Add user"
3. Create patient account:
   - Email: `patient@example.com`
   - Password: `Test@12345`
4. Create doctor account:
   - Email: `doctor@example.com`
   - Password: `Test@12345`

#### Option B: Use React App Registration
1. Start React app: `npm start`
2. Go to registration page
3. Create accounts with test credentials
4. Manually add role and verified fields in RTDB

### Step 6: Populate User Data in RTDB

After creating accounts, add their UIDs and data:

**For Patient:**
```
users/{patientUID}
  └─ (copy from Step 3 example, use actual UID from auth)

For Doctor:**
```
users/{doctorUID}
  └─ (copy from Step 3 example, use actual UID from auth)
```

### Step 7: Test Setup

```bash
# Start development server
npm start

# App should run on http://localhost:3000

# Open browser DevTools → Console
# Watch for logs like:
# ✅ Firestore doc not found, checking RTDB for user: {uid}
# 📊 Doctor Dashboard: Subscribing to shared reports...
```

---

## 🧪 Testing the System

### Test 1: Patient Login & Dashboard
```bash
1. Go to http://localhost:3000/login
2. Enter: patient@example.com / Test@12345
3. Click "Sign in"
4. Should redirect to /dashboard
5. Should see "Welcome back, John!"
6. Check console for role verification logs
```

### Test 2: Doctor Login & Dashboard
```bash
1. Go to http://localhost:3000/login (new incognito window)
2. Enter: doctor@example.com / Test@12345
3. Click "Sign in"
4. Should redirect to /doctor-dashboard
5. Should see "Doctor Portal" in header
6. Watch console for: "📊 Doctor Dashboard: Subscribing to shared reports..."
```

### Test 3: Share Report
```bash
1. (As patient) Go to assessment results
2. Click "Share with Doctor"
3. Modal should show "Dr. Jane Doctor"
4. Select doctor
5. Add message: "Please review"
6. Click "Share Report"
7. Should see success message
8. Check Firebase Console: sharedReports should have new entry
```

### Test 4: Real-time Doctor Dashboard
```bash
1. (As doctor) Open /doctor-dashboard in another window
2. (As patient) Share a report (from Test 3)
3. Doctor's dashboard should update with report (no refresh needed!)
4. Click report to view details
5. Should see patient name, risk %, message
```

### Test 5: Add Comment
```bash
1. (As doctor) Click shared report
2. Scroll to "Clinical Notes"
3. Type: "Monitor blood pressure"
4. Click "Save Note"
5. Should see success message
6. Comment should appear immediately
7. Check Firebase Console: comment in sharedReports/{id}/comments
```

### Test 6: Patient Sees Comment
```bash
1. (As patient) Go back to assessment results
2. Scroll to "Doctor Feedback"
3. Should see comment from Dr. Jane
4. Real-time update (no refresh needed)
```

---

## 🔒 Deployment Steps

### Before Deploying

1. **Update Firebase Rules** (already done in Step 4)
2. **Test all workflows** locally
3. **Enable Google Analytics** (optional)
4. **Set up environment variables**

### Deploy to Firebase Hosting

#### Step 1: Install Firebase CLI
```bash
npm install -g firebase-tools
```

#### Step 2: Login to Firebase
```bash
firebase login
```

#### Step 3: Initialize Firebase Project
```bash
cd d:\FYP2\Frontend\frontend
firebase init hosting
```

When prompted:
- Use existing project: Select your project
- What do you want to use as your public directory: `build`
- Configure as single-page app: Yes
- Set up automatic builds: No

#### Step 4: Build React App
```bash
npm run build
```

This creates optimized production build in `build/` folder

#### Step 5: Deploy
```bash
firebase deploy
```

You'll get a URL like: `https://your-app.firebaseapp.com`

### Alternative: Deploy to Vercel

#### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

#### Step 2: Deploy
```bash
cd d:\FYP2\Frontend\frontend
vercel
```

Follow prompts to link to your project

#### Step 3: Configure Environment Variables in Vercel
- Go to Vercel Dashboard
- Project Settings → Environment Variables
- Firebase config already in code, no extra vars needed

---

## 📊 Production Checklist

### Code Quality
- [ ] No console errors
- [ ] No console warnings (except 3rd party)
- [ ] All imports resolved
- [ ] No unused variables
- [ ] Clean component structure

### Security
- [ ] Firebase rules configured properly
- [ ] No hardcoded secrets in code
- [ ] HTTPS enabled on hosting
- [ ] Authentication errors don't expose details

### Performance
- [ ] Build size < 500KB (excluding node_modules)
- [ ] Page load time < 3 seconds
- [ ] Images optimized
- [ ] Lazy loading implemented

### Testing
- [ ] Patient login/logout works
- [ ] Doctor login/logout works
- [ ] Share report workflow complete
- [ ] Comment system works
- [ ] Access control enforced
- [ ] Error messages display properly

### Monitoring
- [ ] Set up Firebase analytics
- [ ] Monitor RTDB usage
- [ ] Set up error tracking (optional)
- [ ] Monitor performance metrics

---

## 🐛 Troubleshooting

### Issue: "Cannot find module 'uuid'"
```bash
# Solution: Install UUID
npm install uuid
```

### Issue: Firebase RTDB not found
```bash
# Solution: Ensure RTDB is enabled in Firebase Console
# Go to Firebase Console → Realtime Database
# Click "Create Database" if not present
```

### Issue: Users can't sign up
```bash
# Check:
1. Firebase Authentication enabled
2. Email/Password provider enabled
3. Sign-up allowed in Auth settings
# Go to: Firebase Console → Authentication → Settings
```

### Issue: "Permission denied" errors
```bash
# Solution: Update RTDB rules
# Rules must allow reads/writes for authenticated users
# Follow Step 4 rules above
```

### Issue: Real-time updates not working
```bash
# Check console for:
// 📊 Doctor Dashboard: Subscribing to shared reports...

# If not present:
1. Check doctorId matches user.id
2. Verify subscribeToReportComments is called
3. Check RTDB path exists
4. Verify user role is 'doctor'
```

### Issue: Share modal shows no doctors
```bash
# Check:
1. Doctors exist in RTDB: users/{uid}
2. Doctor role = 'doctor'
3. Doctor verified = true
4. Run: getAllDoctorsRTDB() in console
```

---

## 📈 Monitoring & Maintenance

### Daily Checks
- Monitor Firebase Console for errors
- Check RTDB usage (quota)
- Verify no database rule violations

### Weekly Tasks
- Review user feedback
- Check crash reports
- Monitor performance metrics
- Backup database (optional)

### Monthly Tasks
- Security audit
- Update dependencies
- Review analytics
- Plan improvements

---

## 🔄 Updates & Maintenance

### To Update Firebase Rules
1. Go to Firebase Console → Realtime Database
2. Click "Rules"
3. Edit rules
4. Click "Publish"

### To Update React Code
```bash
# Make changes in src/
npm start  # Test locally

npm run build  # Build for production

firebase deploy  # Deploy
```

### To Rollback a Deployment
```bash
# Firebase keeps previous versions
firebase hosting:channel:list
firebase hosting:clone-version {version}
```

---

## 🎓 Production Best Practices

### Security
✅ Enable HTTPS (automatic with Firebase)
✅ Keep Firebase SDK updated
✅ Regularly audit RTDB rules
✅ Monitor for suspicious activity
✅ Use strong password requirements

### Performance
✅ Enable database indexing
✅ Use lazy loading for components
✅ Optimize images
✅ Enable compression
✅ Use CDN (Firebase does this)

### Reliability
✅ Implement error boundaries
✅ Add retry logic for network errors
✅ Monitor uptime
✅ Set up alerting
✅ Regular backups

---

## 📞 Support Resources

### Firebase Documentation
- [Firebase Realtime Database Docs](https://firebase.google.com/docs/database)
- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [Firebase Security Rules](https://firebase.google.com/docs/database/security)

### Project Documentation
- `ROLE_BASED_AUTH_GUIDE.md` - Implementation details
- `IMPLEMENTATION_CHECKLIST.md` - Feature checklist
- `SYSTEM_SUMMARY.md` - System overview

### Local Testing
```bash
# Start React dev server
npm start

# Watch console for logs
# Monitor Network tab for API calls
# Check Firefox/Chrome DevTools
```

---

## ✅ Final Checklist Before Launch

- [ ] Local testing complete
- [ ] Firebase RTDB configured
- [ ] Security rules deployed
- [ ] Test users created
- [ ] UI tested on mobile
- [ ] All components render properly
- [ ] Real-time updates working
- [ ] Error handling verified
- [ ] Production build successful
- [ ] Deployed to hosting
- [ ] Production URL accessible
- [ ] SSL certificate valid
- [ ] Analytics enabled
- [ ] Documentation complete
- [ ] Team trained

---

**🎉 You're ready to deploy your role-based authentication system!**

Start with local testing, then move to production when confident.

