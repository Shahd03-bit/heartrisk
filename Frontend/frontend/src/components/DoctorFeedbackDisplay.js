/**
 * Doctor Feedback Display Component
 * Shows all doctor comments and recommendations for a patient's shared reports
 */

import React, { useEffect, useState } from 'react';
import { fetchPatientSharedReportsRTDB, subscribeToReportComments } from '../utils/firebaseUtils';
import '../styles/DoctorFeedbackDisplay.css';

function DoctorFeedbackDisplay({ patientId }) {
  const [sharedReports, setSharedReports] = useState([]);
  const [allComments, setAllComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unsubscribeFuncs, setUnsubscribeFuncs] = useState([]);

  // Load shared reports and subscribe to comments
  useEffect(() => {
    if (!patientId) {
      setError('Patient ID missing');
      setLoading(false);
      return;
    }

    const loadSharedReports = async () => {
      try {
        const reports = await fetchPatientSharedReportsRTDB(patientId);
        setSharedReports(reports);
        setError('');

        // Subscribe to comments for each report
        const unsubscribes = [];
        reports.forEach((report) => {
          const reportId = report.report_id || report.assessment_id || report.id;
          if (!reportId) return;

          const unsubscribe = subscribeToReportComments(reportId, (comments) => {
            setAllComments((prevComments) => {
              // Remove old comments from this report
              const filtered = prevComments.filter((c) => c.reportId !== reportId);
              // Add new comments
              return [
                ...filtered,
                ...comments.map((c) => ({
                  ...c,
                  reportId,
                  patientName: report.patient_name,
                  riskPercentage: report.prediction_result?.risk_percentage
                }))
              ];
            });
          });
          unsubscribes.push(unsubscribe);
        });

        setUnsubscribeFuncs(unsubscribes);
      } catch (err) {
        console.error('Error loading shared reports:', err);
        setError('Failed to load doctor feedback');
      } finally {
        setLoading(false);
      }
    };

    loadSharedReports();

    return () => {
      unsubscribeFuncs.forEach((unsub) => {
        if (unsub) unsub();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  if (loading) {
    return (
      <div className="feedback-container">
        <div className="feedback-loading">Loading doctor feedback...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="feedback-container">
        <div className="feedback-error">{error}</div>
      </div>
    );
  }

  if (sharedReports.length === 0) {
    return (
      <div className="feedback-container">
        <div className="feedback-empty">
          No doctors assigned yet. Share a report with a doctor to receive feedback.
        </div>
      </div>
    );
  }

  // Get unique doctors
  const doctorsMap = new Map();
  allComments.forEach((comment) => {
    if (!doctorsMap.has(comment.doctor_id || comment.doctorId)) {
      doctorsMap.set(comment.doctor_id || comment.doctorId, {
        doctorId: comment.doctor_id || comment.doctorId,
        doctorName: comment.doctor_name || comment.doctorName || 'Doctor',
        latestComment: comment
      });
    } else {
      const existing = doctorsMap.get(comment.doctor_id || comment.doctorId);
      const existingTime = new Date(existing.latestComment.timestamp || 0);
      const newTime = new Date(comment.timestamp || 0);
      if (newTime > existingTime) {
        existing.latestComment = comment;
      }
    }
  });

  return (
    <div className="feedback-container">
      <h3>Doctor Feedback & Recommendations</h3>

      {allComments.length === 0 ? (
        <div className="feedback-empty">
          Your doctors have not added any feedback yet.
        </div>
      ) : (
        <div className="feedback-grid">
          {Array.from(doctorsMap.values()).map((doctor) => (
            <div key={doctor.doctorId} className="feedback-card">
              <div className="feedback-header">
                <div className="doctor-info">
                  <div className="doctor-avatar">
                    {doctor.doctorName.charAt(0).toUpperCase()}
                  </div>
                  <div className="doctor-details">
                    <div className="doctor-name">Dr. {doctor.doctorName}</div>
                    <div className="feedback-time">
                      {doctor.latestComment.timestamp
                        ? new Date(doctor.latestComment.timestamp).toLocaleString()
                        : 'Recently'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="feedback-content">
                <p>{doctor.latestComment.comment}</p>
              </div>

              {/* Show all comments from this doctor in a collapsed view */}
              {allComments.filter((c) => (c.doctor_id || c.doctorId) === doctor.doctorId).length > 1 && (
                <div className="feedback-more">
                  +{allComments.filter((c) => (c.doctor_id || c.doctorId) === doctor.doctorId).length - 1} more feedback
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* All comments timeline */}
      {allComments.length > 0 && (
        <div className="feedback-timeline">
          <h4>All Feedback Timeline</h4>
          <div className="timeline">
            {[...allComments]
              .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
              .map((comment, index) => (
                <div key={index} className="timeline-item">
                  <div className="timeline-marker"></div>
                  <div className="timeline-content">
                    <div className="timeline-meta">
                      <strong>Dr. {comment.doctor_name || comment.doctorName || 'Doctor'}</strong>
                      <small>{comment.timestamp ? new Date(comment.timestamp).toLocaleString() : 'Recently'}</small>
                    </div>
                    <p>{comment.comment}</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DoctorFeedbackDisplay;
