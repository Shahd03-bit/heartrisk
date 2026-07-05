import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../config/firebase';
import { API_BASE_URL } from '../config/apiConfig';
import '../styles/Auth.css';

// Calculate the max allowed date of birth (must be at least 13 years old)
const getMaxDateOfBirth = () => {
  const today = new Date();
  today.setFullYear(today.getFullYear() - 13);
  return today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
};

function Register() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    dateOfBirth: '',
    gender: '',
    role: 'patient',
    doctorCode: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [generatedAccessCode, setGeneratedAccessCode] = useState('');
  const [doctorLookupData, setDoctorLookupData] = useState(null);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Validate and lookup doctor by access code
  const validateDoctorAccessCode = async (accessCode) => {
    try {
      const response = await fetch(`${API_BASE_URL}/doctor/lookup-by-code/${accessCode}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Invalid access code');
      }

      const data = await response.json();
      console.log('✅ [REGISTER] Doctor lookup successful:', data);
      setDoctorLookupData(data);
      return data;
    } catch (err) {
      console.error('❌ [REGISTER] Doctor code lookup failed:', err.message);
      throw err;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setDoctorLookupData(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    // Validate age — must be at least 13 years old
    if (formData.dateOfBirth) {
      const dob = new Date(formData.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear()
        - (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
      if (age < 13) {
        setError('You must be at least 13 years old to register.');
        return;
      }
    }

    // Doctor access code is optional for patients; validate and link only when provided.
    let doctorUid = null;
    const normalizedDoctorCode = formData.doctorCode.trim().toUpperCase();
    if (formData.role === 'patient' && normalizedDoctorCode) {
      const codeFormat = /^DR\d{6}$/i;
      if (!codeFormat.test(normalizedDoctorCode)) {
        setError('Access code appears invalid. Expected format: DR123456');
        return;
      }

      try {
        const lookupData = await validateDoctorAccessCode(normalizedDoctorCode);
        doctorUid = lookupData.doctor_uid;
        console.log(`Doctor verified: ${lookupData.doctor_name}`);
      } catch (err) {
        setError(err.message || 'Could not verify doctor access code. Please check and try again.');
        return;
      }
    }
    setLoading(true);

    try {
      // Create user with Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const user = userCredential.user;
      const fullName = `${formData.firstName} ${formData.lastName}`;

      // Update display name (non-blocking — don't await)
      updateProfile(user, { displayName: fullName }).catch((err) =>
        console.warn('⚠️ [REGISTER] updateProfile failed (non-critical):', err.message)
      );

      // ✅ Save to localStorage immediately so the app feels instant
      const localUserData = {
        id: user.uid,
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone_number: formData.phoneNumber,
        date_of_birth: formData.dateOfBirth,
        gender: formData.gender,
        role: formData.role.toLowerCase(),
        doctor_id: formData.role === 'patient' ? doctorUid : null,
        doctor_code: formData.role === 'patient' && normalizedDoctorCode ? normalizedDoctorCode : null,
        verified: true,
      };
      localStorage.setItem('user', JSON.stringify(localUserData));

      const token = await user.getIdToken();
      localStorage.setItem('token', token);

      // ✅ Navigate immediately — don't wait for the backend RTDB write
      if (formData.role === 'doctor') {
        // For doctors we need the generated access code, so we must wait
        // But we kick off the request and show dashboard once we have the code
      } else {
        // Patient: navigate right away, backend write happens in background
        navigate('/dashboard');
      }

      // ✅ Backend RTDB write — fire and (for patients) don't await
      const registerPayload = {
        uid: user.uid,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        full_name: fullName.trim(),
        role: formData.role.toLowerCase(),
        phoneNumber: formData.phoneNumber,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        doctor_id: formData.role === 'patient' ? doctorUid : null,
        doctor_code: formData.role === 'patient' && normalizedDoctorCode ? normalizedDoctorCode : null,
        verified: true,
      };

      if (formData.role === 'doctor') {
        // Doctors must wait for the access code from backend
        const registerResponse = await fetch(`${API_BASE_URL}/auth/register-user`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(registerPayload)
        });

        if (!registerResponse.ok) {
          const errorData = await registerResponse.json();
          throw new Error(errorData.error || 'Failed to register doctor in RTDB');
        }

        const registerData = await registerResponse.json();
        console.log('✅ [REGISTER] Doctor created in RTDB:', registerData);

        if (registerData.doctor_code) {
          setGeneratedAccessCode(registerData.doctor_code);
          setRegistrationComplete(true);
          // registrationComplete screen is shown via render below
        } else {
          navigate('/doctor-dashboard');
        }
      } else {
        // Patient: fire-and-forget backend write
        fetch(`${API_BASE_URL}/auth/register-user`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(registerPayload)
        })
          .then((res) => res.json())
          .then((data) => console.log('✅ [REGISTER] Patient RTDB write complete:', data))
          .catch((err) => console.warn('⚠️ [REGISTER] Patient RTDB write failed (non-critical):', err.message));
      }
    } catch (err) {
      const errorMessages = {
        'auth/email-already-in-use': 'Email already registered. Please login instead.',
        'auth/weak-password': 'Password is too weak. Please use a stronger password.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/operation-not-allowed': 'Email/password accounts are not enabled.',
      };
      setError(errorMessages[err.code] || err.message || 'Registration failed. Please try again.');
      setLoading(false);
    }
  };

  // Screen for doctor access code display after registration
  if (registrationComplete && generatedAccessCode) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="heart-icon">❤️</div>
            <h1>CardioPredict</h1>
          </div>

          <h2 style={{ color: '#10b981', marginBottom: '20px' }}>✅ Registration Successful!</h2>

          <div style={{
            backgroundColor: '#f0fdf4',
            border: '2px solid #10b981',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <h3 style={{ marginTop: 0 }}>Your Doctor Access Code</h3>
            <p style={{ color: '#666', marginBottom: '15px' }}>
              Share this code with your patients so they can link their accounts to you during registration.
            </p>

            <div style={{
              backgroundColor: 'white',
              border: '2px dashed #10b981',
              borderRadius: '8px',
              padding: '20px',
              textAlign: 'center',
              marginBottom: '15px'
            }}>
              <p style={{ margin: '0 0 10px 0', color: '#999', fontSize: '14px' }}>Your Access Code:</p>
              <code style={{
                fontSize: '36px',
                fontWeight: 'bold',
                color: '#10b981',
                letterSpacing: '2px',
                fontFamily: 'monospace'
              }}>
                {generatedAccessCode}
              </code>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedAccessCode);
                alert('Access code copied to clipboard!');
              }}
              style={{
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 20px',
                cursor: 'pointer',
                width: '100%',
                marginBottom: '10px',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              📋 Copy Access Code
            </button>

            <div style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fcd34d',
              borderRadius: '6px',
              padding: '12px',
              fontSize: '14px',
              color: '#92400e',
              marginBottom: '20px'
            }}>
              <strong>📌 Important:</strong> Keep this code safe. Patients will need it to register and link to your clinic.
            </div>
          </div>

          <button
            onClick={() => navigate('/doctor-dashboard')}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '12px',
              width: '100%',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600
            }}
          >
            Go to Doctor Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="heart-icon">❤️</div>
          <h1>CardioPredict</h1>
        </div>

        <h2>Create account</h2>
        <p className="subtitle">Enter your information to create your account</p>

        {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name</label>
                  <input
                    id="firstName"
                    type="text"
                    name="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="lastName">Last Name</label>
                  <input
                    id="lastName"
                    type="text"
                    name="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

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
                <label htmlFor="phoneNumber">Phone Number</label>
                <input
                  id="phoneNumber"
                  type="tel"
                  name="phoneNumber"
                  placeholder="+1 (555) 123-4567"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="dateOfBirth">Date of Birth</label>
                  <input
                    id="dateOfBirth"
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    max={getMaxDateOfBirth()}  
                    required
                  />
                  <small style={{ color: '#6b7280', marginTop: '4px', display: 'block' }}>
                    Must be at least 13 years old.
                  </small>
                </div>
                <div className="form-group">
                  <label htmlFor="gender">Gender</label>
                  <select
                    id="gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="role">Register as</label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                >
                  <option value="patient">Patient</option>
                  <option value="doctor">Doctor</option>
                </select>
              </div>

              {/* Doctor Access Code — only shown for patients */}
              {formData.role === 'patient' && (
                <div className="form-group">
                  <label htmlFor="doctorCode">Doctor Access Code (Optional)</label>
                  <input
                    id="doctorCode"
                    type="text"
                    name="doctorCode"
                    placeholder="e.g., DR123456"
                    value={formData.doctorCode}
                    onChange={handleChange}
                    title="Optional code to link you to your doctor"
                    style={{ fontFamily: 'monospace', fontSize: '14px', letterSpacing: '1px' }}
                  />
                  <small style={{ color: '#6b7280', marginTop: '4px', display: 'block' }}>
                    📋 You can add this later from your dashboard. If entered now, use the format DR followed by 6 digits.
                  </small>
                  {doctorLookupData && (
                    <div style={{
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #86efac',
                      borderRadius: '6px',
                      padding: '8px',
                      marginTop: '8px',
                      fontSize: '14px',
                      color: '#166534'
                    }}>
                      ✅ Verified: {doctorLookupData.doctor_name}
                    </div>
                  )}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>

              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </form>


        <div className="auth-footer">
          <p>Already have an account? <Link to="/login">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}

export default Register;


