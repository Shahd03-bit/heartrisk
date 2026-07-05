import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/apiConfig';
import '../styles/Assessment.css';

// MUI (ONLY back button)
import { Button } from '@mui/material';

function Assessment() {
  const [formData, setFormData] = useState({
    age: '',
    gender: 'Male',
    cholesterol: '',
    bloodPressure: '',
    diabetes: 'No',
    smokingStatus: 'Never Smoked',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  const navigate = useNavigate();

  // Load user
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        setError('User session invalid. Please log in again.');
      }
    } else {
      setError('Please log in first.');
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.age || !formData.cholesterol || !formData.bloodPressure) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    if (!user || !user.id) {
      setError('User session expired. Please log in again.');
      setLoading(false);
      navigate('/login');
      return;
    }

    try {
      // ✅ Prepare assessment data
      const assessmentData = {
        user_id: user.id,
        patient_name: `${user.first_name} ${user.last_name}`.trim(),
        doctor_id: user.doctor_id || null,  // ✅ Doctor UID from patient registration
        age: parseInt(formData.age),
        gender: formData.gender,
        cholesterol: parseInt(formData.cholesterol),
        blood_pressure: parseInt(formData.bloodPressure),
        diabetes: formData.diabetes === 'Yes' ? 1 : 0,
        smoking_status: formData.smokingStatus,
      };
      
      console.log('📊 [ASSESSMENT] Submitting assessment:', {
        patientId: assessmentData.user_id,
        patientName: assessmentData.patient_name,
        doctorId: assessmentData.doctor_id,
        timestamp: new Date().toISOString()
      });
      
      // 🔍 DEBUG: Show what we loaded from localStorage
      console.log('🔍 [ASSESSMENT] User object from localStorage:', {
        first_name: user.first_name,
        last_name: user.last_name,
        doctor_id: user.doctor_id,
        id: user.id,
        role: user.role
      });
      
      const response = await fetch(`${API_BASE_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assessmentData),
      });

      const result = await response.json();

      if (response.ok) {
        console.log('✅ [ASSESSMENT] Prediction received:', {
          assessmentId: result.assessment_id,
          riskPercentage: result.risk_percentage,
          confidence: result.confidence,
          doctorId: user.doctor_id
        });
        
        navigate('/assessment-results', {
          state: {
            prediction: result,
            healthData: formData,
            userId: user.id,
            patientName: `${user.first_name} ${user.last_name}`.trim(),
            doctorId: user.doctor_id || null,  // ✅ Patient's assigned doctor
            assessmentId: result.assessment_id,
          },
        });
      } else {
        // Log full server response for debugging and surface meaningful fields
        console.error('❌ [ASSESSMENT] Server returned error:', result);
        const serverMsg = result.error || result.details || result.message || 'Failed to get prediction';
        setError(serverMsg);
      }
    } catch (err) {
      setError('Unable to connect to server. Please ensure Flask is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="assessment-container">

      {/* HEADER */}
      <header className="assessment-header">

        {/* MUI BACK BUTTON (NO ARROW) */}
        <Button
          variant="outlined"
          onClick={handleBack}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '14px',
            borderRadius: '6px',
            color: '#ef4444',
            borderColor: '#e5e7eb',
            backgroundColor: '#fff',
            padding: '8px 12px',
            '&:hover': {
              backgroundColor: '#fef2f2',
              borderColor: '#ef4444'
            }
          }}
        >
          Back
        </Button>

        <div className="header-title">
          <span className="heart-icon">❤️</span>
          <h1>Heart Disease Risk Assessment</h1>
        </div>
      </header>

      {/* MAIN */}
      <main className="assessment-main">
        <div className="assessment-card">

          <div className="form-header">
            <h2>Health Information</h2>
            <p>Please provide your health information for heart disease risk assessment</p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>

            {/* ROW 1 */}
            <div className="form-row">
              <div className="form-group">
                <label>Age *</label>
                <input
                  type="number"
                  name="age"
                  placeholder="e.g. 50"
                  value={formData.age}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Gender *</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>

            {/* ROW 2 */}
            <div className="form-row">
              <div className="form-group">
                <label>Cholesterol (mg/dL) *</label>
                <input
                  type="number"
                  name="cholesterol"
                  placeholder="e.g. 200"
                  value={formData.cholesterol}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Blood Pressure (mmHg) *</label>
                <input
                  type="number"
                  name="bloodPressure"
                  placeholder="e.g. 120"
                  value={formData.bloodPressure}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* DIABETES */}
            <div className="form-group full-width">
              <label>Do you have diabetes? *</label>
              <div className="radio-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="diabetes"
                    value="Yes"
                    checked={formData.diabetes === 'Yes'}
                    onChange={handleChange}
                  />
                  <span>Yes</span>
                </label>

                <label className="radio-option">
                  <input
                    type="radio"
                    name="diabetes"
                    value="No"
                    checked={formData.diabetes === 'No'}
                    onChange={handleChange}
                  />
                  <span>No</span>
                </label>
              </div>
            </div>

            {/* SMOKING */}
            <div className="form-group full-width">
              <label>Smoking Status *</label>
              <div className="radio-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="smokingStatus"
                    value="Current Smoker"
                    checked={formData.smokingStatus === 'Current Smoker'}
                    onChange={handleChange}
                  />
                  <span>Current Smoker</span>
                </label>

                <label className="radio-option">
                  <input
                    type="radio"
                    name="smokingStatus"
                    value="Former Smoker"
                    checked={formData.smokingStatus === 'Former Smoker'}
                    onChange={handleChange}
                  />
                  <span>Former Smoker</span>
                </label>

                <label className="radio-option">
                  <input
                    type="radio"
                    name="smokingStatus"
                    value="Never Smoked"
                    checked={formData.smokingStatus === 'Never Smoked'}
                    onChange={handleChange}
                  />
                  <span>Never Smoked</span>
                </label>
              </div>
            </div>

            {/* SUBMIT */}
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Processing...' : 'Get Risk Assessment'}
            </button>

          </form>
        </div>
      </main>
    </div>
  );
}

export default Assessment;
