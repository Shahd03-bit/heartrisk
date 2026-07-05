import React, { useState } from 'react';
import { postAssessmentFeedback } from '../utils/api';
import '../styles/DoctorFeedback.css';

function DoctorFeedback({
  assessmentId,
  onSaved,
  onSubmit,
  label = 'Clinical Notes & Recommendations',
  placeholder = 'Write clinical notes and recommendations for the patient',
  submitLabel = 'Save Feedback',
}) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!notes.trim()) {
      setError('Please enter notes or recommendations');
      return;
    }
    setSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(notes.trim());
      } else {
        await postAssessmentFeedback(assessmentId, { notes });
      }
      setNotes('');
      if (onSaved) onSaved();
    } catch (err) {
      setError(err?.message || 'Failed to save feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="doctor-feedback">
      <form onSubmit={handleSubmit}>
        <label className="df-label">{label}</label>
        <textarea
          className="df-textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={placeholder}
          rows={6}
        />

        {error && <div className="df-error">{error}</div>}

        <div className="df-actions">
          <button type="submit" className="df-submit" disabled={submitting}>
            {submitting ? 'Saving...' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

export default DoctorFeedback;
