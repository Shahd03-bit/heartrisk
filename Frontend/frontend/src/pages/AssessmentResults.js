import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/AssessmentResults.css';
// import { fetchReportsByAssessmentRTDB } from '../utils/firebaseUtils';

function AssessmentResults() {
  const navigate = useNavigate();
  const location = useLocation();
  const [result, setResult] = useState(null);
  // const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // const [showShareModal, setShowShareModal] = useState(false);
  // const [sharedReports, setSharedReports] = useState([]);
  // const [allComments, setAllComments] = useState([]);

  // const assessmentId = location.state?.assessmentId || location.state?.prediction?.assessment_id;
  // const assignedDoctorId = location.state?.doctorId;
  // const patientName = location.state?.patientName;

  // Initialize user and assessment results
  useEffect(() => {
    if (location.state?.prediction) {
      setResult(location.state.prediction);
    } else {
      navigate('/assessment');
      return;
    }

    // const stored = localStorage.getItem('user');
    // if (stored) {
    //   try {
    //     setUser(JSON.parse(stored));
    //   } catch (e) {
    //     console.error('Error parsing user:', e);
    //   }
    // }
    setLoading(false);
  }, [location, navigate]);

  // Load shared reports for this assessment only
  // useEffect(() => {
  //   if (!assessmentId || user?.role === 'doctor') {
  //     return;
  //   }
  // 
  //   let unsubscribes = [];
  // 
  //   const loadSharedReports = async () => {
  //     try {
  //       const reports = await fetchReportsByAssessmentRTDB(assessmentId);
  //       setSharedReports(reports);
  //       setAllComments([]);
  //       
  //       const reportIds = new Set([assessmentId]);
  //       reports.forEach((report) => {
  //         const reportId = report.id || report.report_id || report.assessment_id;
  //         if (reportId) reportIds.add(reportId);
  //       });
  // 
  //       reportIds.forEach((reportId) => {
  //         const unsubscribe = subscribeToReportComments(reportId, (comments) => {
  //           setAllComments((prevComments) => {
  //             const filtered = prevComments.filter((c) => c.reportId !== reportId);
  //             return [...filtered, ...comments.map((c) => ({ ...c, reportId }))];
  //           });
  //         });
  //         unsubscribes.push(unsubscribe);
  //       });
  //     } catch (err) {
  //       console.error('Error loading shared reports:', err);
  //     }
  //   };
  // 
  //   loadSharedReports();
  // 
  //   return () => {
  //     unsubscribes.forEach((unsub) => {
  //       if (unsub) unsub();
  //     });
  //   };
  // }, [assessmentId, user?.role]);

  // Handlers
  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleViewHistory = () => {
    navigate('/assessment-history');
  };

  // const handleShareSuccess = () => {
  //   setShowShareModal(false);
  //   // Reload shared reports
  //   if (user?.id) {
  //     fetchReportsByAssessmentRTDB(assessmentId).then(setSharedReports).catch(console.error);
  //   }
  // };

  const renderText = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value.map((item) => renderText(item)).filter(Boolean).join(', ');
    }
    return value.message || value.text || value.comment || fallback;
  };

  const recommendations = Array.isArray(result?.recommendations)
    ? result.recommendations.map((rec) => renderText(rec)).filter(Boolean)
    : [];

  const defaultRecommendations = [
    'Consult with a cardiologist',
    'Consider lifestyle changes including diet and exercise',
    'Monitor blood pressure and cholesterol regularly',
    'Take prescribed medications as directed',
  ];
  if (loading) {
    return (
      <div className="results-container">
        <div style={{ textAlign: 'center', paddingTop: '40px' }}>Loading...</div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="results-container">
        <div style={{ textAlign: 'center', paddingTop: '40px' }}>No results available</div>
      </div>
    );
  }

  // Determine risk level and color
  const riskPercentage = result.risk_percentage || 0;
  // Only use confidence if provided by backend
  const confidence = result.confidence;
  const riskLevel =
    riskPercentage > 70 ? 'HIGH RISK' : riskPercentage > 40 ? 'MEDIUM RISK' : 'LOW RISK';
  const riskColor =
    riskPercentage > 70 ? '#ef4444' : riskPercentage > 40 ? '#f59e0b' : '#10b981';

  return (
    <div className="results-container">
      <header className="results-header">
        <button className="btn-back" onClick={handleBack}>
          ← Back
        </button>
        <div className="header-title">
          <span className="heart-icon">❤️</span>
          <h1>Heart Disease Risk Assessment</h1>
        </div>
      </header>

      <main className="results-main">
        <div className="results-card">
          <div className="result-status">
            <span className="status-icon">✓</span>
            <div className="status-text">
              <h2>Prediction Results</h2>
              <p>Your heart disease risk assessment is complete</p>
            </div>
          </div>

          <div className="risk-box" style={{ borderTop: `4px solid ${riskColor}` }}>
            <div className="risk-content">
              <span className="risk-label">Risk Level</span>
              <span className="risk-level" style={{ color: riskColor }}>
                {riskLevel}
              </span>
              <span className="risk-percentage">{riskPercentage.toFixed(1)}%</span>
              <p className="risk-score">Risk Score</p>
            </div>

            <div className="risk-bar">
              <div
                className="risk-progress"
                style={{
                  width: `${riskPercentage}%`,
                  backgroundColor: riskColor,
                }}
              ></div>
            </div>

            {confidence !== undefined && (
              <div className="confidence-text">
                Confidence: {confidence.toFixed(1)}%
              </div>
            )}
          </div>

          <div className="recommendations-section">
            <h3>Health Recommendations:</h3>
            <ul className="recommendations-list">
              {(recommendations.length > 0 ? recommendations : defaultRecommendations).map((rec, index) => (
                <li key={index}>
                  <span className="rec-icon">✓</span>
                  {rec}
                </li>
              ))}            </ul>
          </div>

          {/* <div className="doctor-feedback-section">
            <h3>Doctor Feedback</h3>
            {allComments && allComments.length > 0 ? (
              <div className="comments-list">
                {allComments
                  .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
                  .map((comment) => (
                    <div key={comment.id || comment.commentId} className="doctor-feedback-box">
                      <div className="feedback-header">
                        <strong>Dr. {comment.doctorName || 'Doctor'}</strong>
                        <small>{comment.timestamp ? new Date(comment.timestamp).toLocaleString() : ''}</small>
                      </div>
                      <p>{renderText(comment.comment, 'No comment text')}</p>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="no-feedback">No doctor comments yet. Share your report to get feedback.</div>
            )}
          </div> */}

          {/* ✅ CLINIC: Show assigned doctor info
          <div className="doctor-feedback-section">
            <h3>👨‍⚕️ Your Assigned Doctor</h3>
            {assignedDoctorId ? (
              <div style={{ backgroundColor: '#f0f9ff', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #bfdbfe' }}>
                <p style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#1e40af', fontWeight: '600' }}>
                  ✅ Automatic Sharing Enabled
                </p>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1e3a8a' }}>
                  Your assessment has been automatically shared with your assigned doctor.
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: '#3730a3' }}>
                  Doctor UID: <code style={{ backgroundColor: '#fff', padding: '2px 4px', borderRadius: '3px' }}>{assignedDoctorId.substring(0, 20)}...</code>
                </p>
              </div>
            ) : (
              <div style={{ backgroundColor: '#fef2f2', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #fecaca' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#991b1b', fontWeight: '600' }}>
                  ⚠️ No Doctor Assigned
                </p>
                <p style={{ margin: 0, fontSize: '14px', color: '#7f1d1d' }}>
                  No assigned doctor found. Please contact your clinic administrator to link your account.
                </p>
              </div>
            )}
          </div> */}

          {/* Optional: Manual sharing as backup
          {user?.role !== 'doctor' && !assignedDoctorId && (
            <div className="doctor-feedback-section">
              <h3>Share Report Manually</h3>
              <button 
                className="btn-request-review" 
                onClick={() => setShowShareModal(true)}
              >
                Share with a Doctor
              </button>
            </div>
          )} */}

          <div className="disclaimer-box">
            <p>
              <strong>Disclaimer:</strong> This prediction is for informational purposes only and
              should not replace professional medical advice. Please consult with a healthcare
              provider for proper diagnosis and treatment.
            </p>
          </div>

          <div className="results-actions">
            <button className="btn-back-dashboard" onClick={handleBack}>
              Back to Dashboard
            </button>
            <button className="btn-view-history" onClick={handleViewHistory}>
              View History
            </button>
          </div>
        </div>
      </main>

      {/* Share with Doctor Modal */}
      {/* {showShareModal && (
        <ShareWithDoctorModal
          assessment={result}
          patientData={user}
          onClose={() => setShowShareModal(false)}
          onSuccess={handleShareSuccess}
        />
      )} */}
    </div>
  );
}

export default AssessmentResults;
