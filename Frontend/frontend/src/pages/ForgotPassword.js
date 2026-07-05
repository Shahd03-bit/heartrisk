import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import '../styles/Auth.css';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (!email.trim()) {
        throw new Error('Please enter your email address');
      }

      // Send password reset email
      await sendPasswordResetEmail(auth, email);

      setMessage('Password reset email sent! Check your inbox for instructions.');
      setSubmitted(true);
      setEmail('');

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      const errorMessages = {
        'auth/user-not-found': 'No account found with this email address.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/too-many-requests': 'Too many reset attempts. Please try again later.',
      };
      setError(errorMessages[err.code] || err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="heart-icon">❤️</div>
          <h1>HeartPredict</h1>
        </div>

        <h2>Reset Password</h2>
        <p className="subtitle">Enter your email to receive password reset instructions</p>

        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        {!submitted && (
          <form onSubmit={handleResetPassword}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Email'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <p>Remember your password? <Link to="/login">Sign in</Link></p>
          <p>Don't have an account? <Link to="/register">Sign up</Link></p>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
