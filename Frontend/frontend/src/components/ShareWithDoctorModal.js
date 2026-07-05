/**
 * Share Assessment Report with Doctor Modal
 * Allows patients to select a doctor and share their assessment results
 */

import React, { useState, useEffect } from 'react';
import { shareReportWithDoctorRTDB, getAllDoctorsRTDB, searchDoctorsRTDB } from '../utils/firebaseUtils';
import '../styles/ShareWithDoctorModal.css';

function ShareWithDoctorModal({ assessment, patientData, onClose, onSuccess }) {
  const [doctors, setDoctors] = useState([]);
  const [filteredDoctors, setFilteredDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState('Please review my latest heart risk assessment.');
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch all doctors on mount
  useEffect(() => {
    const loadDoctors = async () => {
      setLoading(true);
      
      // Add timeout to prevent indefinite loading
      const loadingTimeout = setTimeout(() => {
        console.warn('⚠️ Doctors loading timed out after 6 seconds');
        setError('Doctors list took too long to load. Please try again.');
        setLoading(false);
      }, 6000);

      try {
        console.log('📡 Fetching doctors list...');
        const doctorsList = await getAllDoctorsRTDB();
        clearTimeout(loadingTimeout);
        
        // Filter verified doctors
        const verifiedDoctors = doctorsList.filter(doc => doc.verified !== false);
        console.log(`✅ Loaded ${verifiedDoctors.length} doctors`);
        setDoctors(verifiedDoctors);
        setFilteredDoctors(verifiedDoctors);
      } catch (err) {
        clearTimeout(loadingTimeout);
        setError('Failed to load doctors list. Please refresh and try again.');
        console.error('Error loading doctors:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDoctors();
  }, []);

  // Filter doctors based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredDoctors(doctors);
      return;
    }

    const search = async () => {
      try {
        const results = await searchDoctorsRTDB(searchTerm);
        setFilteredDoctors(results);
      } catch (err) {
        console.error('Search error:', err);
        setFilteredDoctors([]);
      }
    };

    search();
  }, [searchTerm, doctors]);

  const handleSelectDoctor = (doctor) => {
    setSelectedDoctor(doctor);
    setError('');
  };

  const handleShare = async (e) => {
    e.preventDefault();
    
    if (!selectedDoctor) {
      setError('Please select a doctor');
      return;
    }

    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    if (!assessment) {
      setError('Assessment data is missing');
      return;
    }

    setSharing(true);
    setError('');

    try {
      // Share report using Firebase Realtime Database
      const shareData = {
        patientId: patientData.id || patientData.uid || patientData.userId,
        patientName: `${patientData.first_name || patientData.firstName || patientData.firstname || ''} ${patientData.last_name || patientData.lastName || patientData.lastname || ''}`.trim(),
        doctorId: selectedDoctor.uid || selectedDoctor.id || selectedDoctor.userId,
        assessmentId: assessment.assessment_id,
        predictionResult: {
          risk_percentage: assessment.risk_percentage,
          disease: assessment.disease || 'Heart Disease Risk',
          confidence: assessment.confidence,
          recommendations: assessment.recommendations
        },
        message: message.trim()
      };

      const reportData = await shareReportWithDoctorRTDB(shareData);
      
      setSuccess(`Report shared successfully with Dr. ${selectedDoctor.firstName || selectedDoctor.firstname || ''} ${selectedDoctor.lastName || selectedDoctor.lastname || ''}`.trim());
      console.log('✅ Report shared:', reportData);

      // Call success callback after a short delay
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(reportData);
        }
        onClose();
      }, 2000);
    } catch (err) {
      setError(err?.message || 'Failed to share report');
      console.error('Share error:', err);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Share Report with Doctor</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="modal-error">{error}</div>}
        {success && <div className="modal-success">{success}</div>}

        <div className="modal-body">
          <div className="form-group">
            <label>Search for a Doctor</label>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="doctors-list">
            {loading ? (
              <div className="loading">Loading doctors...</div>
            ) : filteredDoctors.length === 0 ? (
              <div className="no-results">
                {doctors.length === 0 
                  ? 'No doctors available' 
                  : 'No doctors match your search'}
              </div>
            ) : (
              filteredDoctors.map((doctor) => (
                <div
                  key={doctor.uid}
                  className={`doctor-card ${selectedDoctor?.uid === doctor.uid ? 'selected' : ''}`}
                  onClick={() => handleSelectDoctor(doctor)}
                >
                  <div className="doctor-avatar">
                    {doctor.profilePicture ? (
                      <img src={doctor.profilePicture} alt={`Dr. ${doctor.firstName || doctor.firstname || ''}`} />
                    ) : (
                      <span>{doctor.firstName?.[0]?.toUpperCase() || 'D'}</span>
                    )}
                  </div>
                  <div className="doctor-info">
                    <div className="doctor-name">
                      Dr. {doctor.firstName || doctor.firstname} {doctor.lastName || doctor.lastname}
                    </div>
                    <div className="doctor-email">{doctor.email}</div>
                    {doctor.specialization && (
                      <div className="doctor-specialization">{doctor.specialization}</div>
                    )}
                  </div>
                  <div className="selection-indicator">
                    {selectedDoctor?.uid === doctor.uid && <div className="checkmark">✓</div>}
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedDoctor && (
            <div className="form-group">
              <label htmlFor="message">Message to Doctor</label>
              <textarea
                id="message"
                placeholder="Add any message or notes for the doctor..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="message-input"
              />
              <small className="char-count">{message.length}/500</small>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="btn-share"
            onClick={handleShare}
            disabled={!selectedDoctor || sharing || !message.trim()}
          >
            {sharing ? 'Sharing...' : 'Share Report'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ShareWithDoctorModal;
