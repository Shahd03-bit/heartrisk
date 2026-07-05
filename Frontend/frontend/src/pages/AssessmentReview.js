import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DoctorFeedback from '../components/DoctorFeedback';
import { fetchAssessmentFeedback, requestAssessmentReview } from '../utils/api';
import '../styles/Assessment.css';

function AssessmentReview() {
  const location = useLocation();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [user, setUser] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [requestStatus, setRequestStatus] = useState(null);

  useEffect(() => {
    if (location.state?.assessment) {
      setAssessment(location.state.assessment);
    } else if (location.state?.prediction) {
      // support navigation from results
      setAssessment({ id: location.state.assessmentId, results: location.state.prediction });
    } else {
      // nothing provided
      navigate('/assessment-history');
    }
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {}
    }
  }, [location, navigate]);

  useEffect(() => {
    if (assessment?.id) {
      fetchAssessmentFeedback(assessment.id)
        .then((res) => setFeedback(res.feedback || null))
        .catch(() => {});
    }
  }, [assessment]);

  const onSaved = () => {
    if (assessment?.id) {
      fetchAssessmentFeedback(assessment.id)
        .then((res) => setFeedback(res.feedback || null))
        .catch(() => {});
    }
  };

  return (
    <div className="assessment-container">
      <header className="assessment-header">
        <button className="btn-back" onClick={() => navigate(-1)}>
          Back
        </button>
        <div className="header-title">
          <span className="heart-icon">❤️</span>
          <h1>Assessment Review</h1>
        </div>
      </header>

      <main className="assessment-main">
        <div className="assessment-card">
          <div style={{ marginBottom: 12 }}>
            <h3>Assessment Results Summary</h3>
            {assessment?.results ? (
              <div>
                <p>Risk: {assessment.results.risk_percentage}%</p>
              </div>
            ) : (
              <p>No result details available</p>
            )}
          </div>

          <div>
            <h3>Existing Feedback</h3>
            {feedback ? (
              <div style={{ whiteSpace: 'pre-wrap', border: '1px solid #e5e7eb', padding: 10, borderRadius: 8 }}>
                {feedback.notes}
              </div>
            ) : (
              <p>No feedback yet.</p>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <h3>Add / Update Feedback</h3>
            {user?.role === 'doctor' ? (
              assessment?.id ? (
                <DoctorFeedback assessmentId={assessment.id} onSaved={onSaved} />
              ) : (
                <p>Cannot add feedback: missing assessment id.</p>
              )
            ) : (
              <div>
                <p>Only verified doctors can add feedback. You can request a review from a doctor.</p>
                <textarea
                  placeholder="Optional message to doctor"
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  rows={4}
                  style={{ width: '100%', borderRadius: 8, padding: 8, border: '1px solid #e5e7eb' }}
                />
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={async () => {
                      if (!assessment?.id) return;
                      setRequesting(true);
                      try {
                        await requestAssessmentReview(assessment.id, { message: requestMessage, predictionResult: assessment.results });
                        setRequestStatus('requested');
                      } catch (err) {
                        setRequestStatus('failed');
                      } finally {
                        setRequesting(false);
                      }
                    }}
                    className="df-submit"
                    disabled={requesting}
                  >
                    {requesting ? 'Requesting...' : 'Request Doctor Review'}
                  </button>
                  {requestStatus === 'requested' && <span style={{ marginLeft: 8, color: '#10b981' }}>Requested</span>}
                  {requestStatus === 'failed' && <span style={{ marginLeft: 8, color: '#dc2626' }}>Request failed</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default AssessmentReview;
