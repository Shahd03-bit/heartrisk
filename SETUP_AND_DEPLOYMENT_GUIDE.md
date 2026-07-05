# Doctor-Patient Monitoring Module - Setup & Deployment

## 🚀 Quick Start (5 Minutes)

### Prerequisites Check
```bash
# Check Node.js
node --version  # Should be 18+

# Check Python
python --version  # Should be 3.9+

# Check npm
npm --version  # Should be 9+
```

### Step 1: Backend Setup (2 minutes)

```bash
# Navigate to backend
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Verify Flask is installed
python -m flask --version
```

**Expected Output:**
```
Flask 3.1.3
Werkzeug 3.1.0
```

### Step 2: Frontend Setup (2 minutes)

```bash
# Navigate to frontend
cd Frontend/frontend

# Install Node dependencies
npm install

# Verify React is installed
npm list react

# Should show: react@19.2.4
```

### Step 3: Environment Configuration (1 minute)

#### Create .env in Frontend/frontend
```
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_DATABASE_URL=https://your_project-rtdb.asia-southeast1.firebasedatabase.app
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

#### Verify backend/serviceAccountKey.json exists
- Download from Firebase Console → Project Settings → Service Accounts
- Place in `backend/` directory

---

## 🔧 Local Development

### Terminal 1: Start Backend

```bash
cd backend

# Run Flask server
python app.py

# Expected output:
# 🚀 Starting Flask Backend
# ==================================================
# ✓ Firebase connected
# ✓ ML model loaded
# 🎯 All systems ready!
# Running on http://127.0.0.1:5000
```

### Terminal 2: Start Frontend

```bash
cd Frontend/frontend

# Start development server
npm start

# Expected output:
# Compiled successfully!
# Local:   http://localhost:3000
# Browser will open automatically
```

### Access Points
- Frontend: http://localhost:3000
- Backend API: http://127.0.0.1:5000

---

## 🧪 Testing the System

### Test 1: Health Check

```bash
curl http://127.0.0.1:5000/health

# Expected response:
{
  "status": "ok",
  "firebase": "connected",
  "ml_model": "loaded"
}
```

### Test 2: Login Flow

1. Open http://localhost:3000
2. Click "Sign Up" or use test credentials:
   - **Patient:** patient@example.com / Test@12345
   - **Doctor:** doctor@example.com / Test@12345
3. Should redirect based on role

### Test 3: Patient Assessment

1. Login as patient
2. Navigate to "New Assessment"
3. Fill form:
   - Age: 55
   - Gender: Male
   - Cholesterol: 250
   - Blood Pressure: 140
   - Diabetes: Yes
   - Smoking: Current Smoker
4. Click "Get Prediction"
5. Should see results with risk percentage

### Test 4: Share Report

1. At assessment results page
2. Click "Share with Doctor"
3. Search for a doctor
4. Select doctor
5. Add message
6. Click "Share Report"
7. Should see success message

### Test 5: Doctor Dashboard

1. Logout patient
2. Login as doctor
3. Should see patient's shared report instantly
4. Click report
5. View patient details
6. Add clinical notes
7. Submit

---

## 📦 Production Build

### Frontend Build

```bash
cd Frontend/frontend

# Create production build
npm run build

# Output will be in build/ directory
# Upload to Firebase Hosting or your server

# For Firebase Hosting:
firebase deploy --only hosting
```

### Backend Deployment

#### Option 1: Heroku (Recommended for quick deployment)

```bash
# Install Heroku CLI
npm install -g heroku

# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set CORS_ORIGINS="https://yourdomain.com"

# Deploy
git push heroku main
```

#### Option 2: AWS EC2

```bash
# SSH into instance
ssh -i key.pem ec2-user@your-instance-ip

# Install Python & dependencies
sudo yum install python3 python3-pip
pip install -r requirements.txt

# Run with gunicorn
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

#### Option 3: Google Cloud Run

```bash
# Create Dockerfile
cat > Dockerfile << EOF
FROM python:3.9
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 app:app
EOF

# Deploy
gcloud run deploy heart-backend \
  --source . \
  --platform managed \
  --region us-central1
```

---

## 🔐 Security Checklist

### Before Production

- [ ] Update CORS origins to production domain only
- [ ] Remove `debug=True` from Flask app.py
- [ ] Set strong Firebase security rules
- [ ] Enable HTTPS/SSL
- [ ] Set environment variables in production
- [ ] Rotate service account keys
- [ ] Enable Firebase Authentication security
- [ ] Setup monitoring and logging
- [ ] Enable rate limiting
- [ ] Backup database regularly

### Firebase Security Rules Verification

```bash
# Test rules in Firebase Console
# Emulator: firebase emulators:start
```

---

## 📊 Database Migration

### Backup Production Data

```bash
# Firebase Realtime Database backup script
firebase database:get / --pretty > backup.json

# Firestore backup
gcloud firestore export gs://your-bucket/backup
```

### Import Test Data

```javascript
// Use Firebase Console → Database → Import JSON
// Or use admin SDK:
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://your-project-rtdb.firebasedatabase.app'
});

const data = require('./test-data.json');
admin.database().ref().set(data);
```

---

## 🆘 Troubleshooting Deployment

### Backend Not Starting

```bash
# Check Python version
python --version

# Check Flask installation
python -m pip list | grep -i flask

# Check port is free
lsof -i :5000

# Check logs
python app.py 2>&1 | tail -20
```

### Frontend Build Fails

```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install

# Check Node version
node --version

# Run build in verbose mode
npm run build -- --verbose
```

### Firebase Connection Issues

```bash
# Verify credentials
cat backend/serviceAccountKey.json

# Test Firebase connection
python -c "import firebase_admin; print('Firebase OK')"

# Check RTDB URL
echo "Your RTDB URL should be: https://your-project-rtdb.region.firebasedatabase.app"
```

### CORS Errors

```javascript
// In backend app.py, verify:
CORS(app, resources={r"/*": {"origins": cors_origins}})

// Check environment variable:
process.env.CORS_ORIGINS
```

---

## 📈 Monitoring & Logging

### Backend Logs

```python
# Already configured in app.py
import logging
logger = logging.getLogger("heart_backend")

# View specific logs
tail -f debug.log
```

### Frontend Logs

```javascript
// Check browser console (F12)
// Check network tab for API calls
console.log('Debug info here')
```

### Firebase Console Monitoring

- Go to Firebase Console
- Database → Rules → Test rules
- Authentication → Users monitoring
- Realtime Database → Usage
- Performance → Monitor

---

## 🔄 CI/CD Setup

### GitHub Actions Example

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Build Frontend
        run: |
          cd Frontend/frontend
          npm install
          npm run build
      
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          projectId: your-project-id
```

---

## 📊 Performance Tuning

### Database Optimization

```javascript
// Add indexes in Firebase Console
// For frequently queried fields:
- users/role
- sharedReports/doctor_id
- sharedReports/patient_id
- sharedReports/shared_at
```

### Frontend Optimization

```bash
# Analyze bundle size
npm run build -- --analyze

# Check performance
npm install -D web-vitals

# Optimize images
npm install -D imagemin
```

### Backend Optimization

```python
# Enable caching
from functools import lru_cache

@lru_cache(maxsize=128)
def get_user_name(uid):
    # Cached results for 1 hour
    return user_name
```

---

## 🚨 Scaling Considerations

### When to Optimize

- Users: > 1000
- Requests/second: > 100
- Database size: > 1GB

### Optimization Strategies

1. **Database Sharding** - Split by date/region
2. **Caching Layer** - Redis for frequently accessed data
3. **CDN** - For static assets
4. **Load Balancing** - Multiple backend instances
5. **Database Replication** - Read replicas for scaling

---

## 📋 Maintenance Tasks

### Weekly
- [ ] Check error logs
- [ ] Monitor performance metrics
- [ ] Verify backups

### Monthly
- [ ] Update dependencies
- [ ] Security patches
- [ ] Cleanup archived reports
- [ ] User audit

### Quarterly
- [ ] Load testing
- [ ] Security audit
- [ ] Performance optimization
- [ ] Feature review

---

## 📞 Support Resources

### Documentation
- Firebase Docs: https://firebase.google.com/docs
- React Docs: https://react.dev
- Flask Docs: https://flask.palletsprojects.com
- Python SDK: https://firebase.google.com/docs/database/admin/start

### Community
- Stack Overflow: firebase, react, flask
- Firebase Support: https://firebase.google.com/support
- GitHub Issues: Your repo

### Useful Tools
- Firebase Emulator: `firebase emulators:start`
- React DevTools: Chrome Extension
- Postman: API testing

---

## ✅ Pre-Launch Checklist

- [ ] All tests passing
- [ ] Security audit completed
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Error handling robust
- [ ] Logging configured
- [ ] Backups tested
- [ ] Team training done
- [ ] Monitoring setup
- [ ] Disaster recovery plan ready

---

**Last Updated:** May 26, 2026  
**Version:** 1.0  
**Status:** Production Ready ✅
