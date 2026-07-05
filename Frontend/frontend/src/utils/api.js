// RTDB-backed app utilities for shared reports and doctor feedback
import { auth, rtdb } from '../config/firebase';
import { get, ref } from 'firebase/database';
import {
  addCommentToReportRTDB,
  fetchDoctorSharedReportsRTDB,
  fetchReportCommentsRTDB,
  fetchReportsByAssessmentRTDB,
  fetchSharedReportRTDB,
  shareReportWithDoctorRTDB,
} from './firebaseUtils';

const getCurrentUser = () => auth.currentUser || null;

const getStoredUser = () => {
  const stored = localStorage.getItem('user');
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

export const apiCall = async () => {
  throw new Error('Flask API is not used in this project. Use the RTDB helpers instead.');
};

export default apiCall;

// Feedback-related helpers
export const fetchAssessmentFeedback = async (assessmentId) => {
  const reports = await fetchReportsByAssessmentRTDB(assessmentId);
  if (!reports.length) {
    return { feedback: null, reports: [] };
  }

  const enrichedReports = await Promise.all(
    reports.map(async (report) => ({
      ...report,
      comments: await fetchReportCommentsRTDB(report.report_id),
    }))
  );

  const latestReviewed = enrichedReports.find((report) => report.status === 'reviewed' && report.comments?.length);
  if (!latestReviewed) {
    return { feedback: null, reports: enrichedReports };
  }

  const latestComment = latestReviewed.comments[latestReviewed.comments.length - 1];
  return {
    feedback: latestComment ? { notes: latestComment.comment } : null,
    reports: enrichedReports,
  };
};

export const postAssessmentFeedback = async (assessmentId, payload) => {
  const reports = await fetchReportsByAssessmentRTDB(assessmentId);

  if (!reports.length) {
    throw new Error('No shared report found for this assessment. Ask the patient to share it first.');
  }

  const targetReport = reports[0];

  return addCommentToReportRTDB(targetReport.report_id, {
    doctorId: getStoredUser()?.id || getCurrentUser()?.uid || targetReport.doctor_id,
    doctorName: `${getStoredUser()?.first_name || getStoredUser()?.firstName || 'Doctor'} ${getStoredUser()?.last_name || getStoredUser()?.lastName || ''}`.trim(),
    comment: payload?.comment || payload?.notes || payload?.message || '',
  });
};

export const requestAssessmentReview = async (assessmentId, payload) => {
  const user = getStoredUser();
  if (!user) {
    throw new Error('User not found. Please log in again.');
  }

  return shareReportWithDoctorRTDB({
    patientId: user.id || user.uid,
    patientName: `${user.first_name || user.firstName || ''} ${user.last_name || user.lastName || ''}`.trim() || user.email || 'Patient',
    doctorId: null,
    assessmentId,
    predictionResult: payload?.predictionResult || {},
    message: payload?.message || '',
  });
};

// Share report with a doctor (creates a sharedReports entry)
export const shareReportWithDoctor = async (assessmentId, doctorId, message, predictionResult = {}) => {
  const user = getStoredUser();
  if (!user) {
    throw new Error('User not found. Please log in again.');
  }

  return shareReportWithDoctorRTDB({
    patientId: user.id || user.uid,
    patientName: `${user.first_name || user.firstName || ''} ${user.last_name || user.lastName || ''}`.trim() || user.email || 'Patient',
    doctorId,
    assessmentId,
    predictionResult,
    message,
  });
};

export const fetchDoctorSharedReports = async (doctorId) => {
  return fetchDoctorSharedReportsRTDB(doctorId);
};

export const fetchLatestAssessment = async (userId) => {
  const snapshot = await get(ref(rtdb, `assessments/${userId}`));
  if (!snapshot.exists()) {
    return { assessment: null };
  }

  const assessments = snapshot.val() || {};
  const assessmentList = Object.entries(assessments)
    .map(([assessment_id, assessment]) => ({ ...assessment, assessment_id }))
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return { assessment: assessmentList[0] || null };
};

export const saveDoctorComment = async (reportId, payload) => {
  return addCommentToReportRTDB(reportId, {
    doctorId: getStoredUser()?.id || getCurrentUser()?.uid,
    doctorName: `${getStoredUser()?.first_name || getStoredUser()?.firstName || 'Doctor'} ${getStoredUser()?.last_name || getStoredUser()?.lastName || ''}`.trim(),
    comment: payload?.comment || payload?.notes || '',
  });
};

export const fetchSharedReport = async (reportId) => {
  const report = await fetchSharedReportRTDB(reportId);
  if (!report) return null;
  return {
    ...report,
    comments: await fetchReportCommentsRTDB(reportId),
  };
};

export const fetchPatientSharedReportsByAssessment = async (assessmentId) => {
  const reports = await fetchReportsByAssessmentRTDB(assessmentId);
  return { reports };
};
