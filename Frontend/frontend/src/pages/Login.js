import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';
import { fetchUserRoleFromRTDB } from '../utils/firebaseUtils';
import '../styles/Auth.css';

function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ✅ FIX: Always fetch the full user record from RTDB after login so that
  // doctor_id (and any other profile fields) are always present in localStorage,
  // even if the user registered in a previous session before this fix was applied.
  const buildLocalStorageUser = (firebaseUser, rtdbUser) => {
    const firstName =
      rtdbUser?.firstName || rtdbUser?.first_name || rtdbUser?.full_name?.split(' ')[0] || '';
    const lastName =
      rtdbUser?.lastName || rtdbUser?.last_name || rtdbUser?.full_name?.split(' ').slice(1).join(' ') || '';

    return {
      id: firebaseUser.uid,
      first_name: firstName,
      last_name: lastName,
      email: firebaseUser.email || rtdbUser?.email || '',
      phone_number: rtdbUser?.phoneNumber || '',
      date_of_birth: rtdbUser?.dateOfBirth || '',
      gender: rtdbUser?.gender || '',
      role: (rtdbUser?.role || 'patient').toLowerCase(),
      // ✅ CRITICAL: preserve doctor_id from RTDB so assessments carry it
      doctor_id: rtdbUser?.doctor_id || null,
      doctor_code: rtdbUser?.doctor_code || null,
      photoURL: firebaseUser.photoURL || rtdbUser?.profilePicture || '',
      verified: rtdbUser?.verified ?? true,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const firebaseUser = userCredential.user;

      // Fetch full profile from RTDB (includes doctor_id, role, etc.)
      const rtdbUser = await fetchUserRoleFromRTDB(firebaseUser.uid, 5000, formData.email);

      if (!rtdbUser) {
        setError('User profile not found. Please contact support.');
        setLoading(false);
        return;
      }

      const localUser = buildLocalStorageUser(firebaseUser, rtdbUser);
      const token = await firebaseUser.getIdToken();

      localStorage.setItem('user', JSON.stringify(localUser));
      localStorage.setItem('token', token);

      console.log('✅ [LOGIN] Logged in:', {
        uid: localUser.id,
        role: localUser.role,
        doctor_id: localUser.doctor_id,
      });

      // Redirect based on role
      if (localUser.role === 'doctor') {
        navigate('/doctor-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const errorMessages = {
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
        'auth/invalid-credential': 'Invalid email or password.',
      };
      setError(errorMessages[err.code] || err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="heart-icon">❤️</div>
          <h1>CardioPredict</h1>
        </div>

        <h2>Sign in</h2>
        <p className="subtitle">Enter your credentials to access your account</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="john.doe@example.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              placeholder="Your password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Don't have an account? <Link to="/register">Create one</Link></p>
        </div>
      </div>
    </div>
  );
}

export default Login;

