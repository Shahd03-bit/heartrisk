import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
//import { getAnalytics } from 'firebase/analytics';
import { getDatabase } from 'firebase/database';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAKt-BgWqLjTYcubqgbM4IZ2olyvYYNUjQ",
  authDomain: "heart-7d7ce.firebaseapp.com",
  databaseURL: "https://heart-7d7ce-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "heart-7d7ce",
  storageBucket: "heart-7d7ce.appspot.com",
  messagingSenderId: "434569219071",
  appId: "1:434569219071:web:a8120d9e533dd21b63f5ca",
  measurementId: "G-C372XYY3BG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Analytics
//const analytics = getAnalytics(app);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Cloud Firestore
export const db = getFirestore(app);

// Initialize Firebase Storage
export const storage = getStorage(app);

// Initialize Realtime Database (optional)
export const rtdb = getDatabase(app);

export default app;
