# Firebase Setup Guide

## Steps to Enable Firebase Authentication:

### 1. Create a Firebase Project
- Go to [Firebase Console](https://console.firebase.google.com/)
- Click "Add Project"
- Enter your project name (e.g., "CardioPRedict")
- Click "Create Project"

### 2. Enable Authentication Methods

#### Email/Password Authentication:
- In Firebase Console, go to **Authentication** (from left menu)
- Click **Get started**
- Click on **Email/Password** sign-in method
- Click **Enable**
- Click **Save**

#### Google Authentication:
- In **Authentication** section, click on **Sign-in method** tab
- Click **Add a new provider**
- Select **Google**
- Enable it
- Add a project name (e.g., "CardioPredict")
- Add your support email
- Click **Save**

**Note:** Google sign-in may require additional OAuth consent screen setup for production deployments.

### 3. Get Your Firebase Credentials
- Go to **Project Settings** (click gear icon in top left)
- Scroll to "Your apps" section
- Click on "Web" app (or create one if not exists)
- Copy the Firebase configuration
- You'll see something like:
```
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 4. Update Firebase Config File
- Open `src/config/firebase.js`
- Replace the firebaseConfig object with your credentials

### 5. Enable Firestore (Optional - for storing user data)
- In Firebase Console, go to **Firestore Database**
- Click **Create Database**
- Choose **Start in test mode** (for development)
- Click **Create**

### 6. Configure Firestore Rules (Security)
For development/testing, go to **Firestore > Rules** and use:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

### 7. Start the App
```bash
npm start
```

## Features Now Enabled:
✅ **Email/Password Sign Up** - Users can create accounts with email
✅ **Email/Password Login** - Users can login with email/password
✅ **Google Sign Up** - Users can sign up with their Google account
✅ **Google Sign In** - Users can login with their Google account
✅ **Dashboard** - Protected route that requires authentication
✅ **Logout** - Securely logout from Firebase
✅ **User Data** - Additional user info stored in Firestore

## Testing:
1. Go to http://localhost:3000
2. **Test Email Sign Up:**
   - Click "Sign up"
   - Fill in all fields
   - Create an account
   - You'll be redirected to the dashboard
3. **Test Email Login:**
   - Click logout
   - Click "Sign in"
   - Use your test credentials
4. **Test Google Sign In:**
   - Go back to login page
   - Click "Sign in with Google"
   - Authenticate with your Google account
   - You'll be redirected to the dashboard

## Troubleshooting:

### "firebaseConfig is incomplete"
- Make sure you've added all 6 credentials from Firebase console

### "PERMISSION_DENIED"
- Ensure Firestore is in test mode or configure rules properly

### "User not found"
- Make sure you registered first before trying to login

### Google Sign-in Not Working
- Check that Google sign-in method is enabled in Firebase Console
- Verify the app domain is authorized (usually added automatically for localhost)
- Make sure pop-ups are not blocked in your browser

### Pop-up Blocked Error
- Allow pop-ups for localhost:3000 in your browser settings

