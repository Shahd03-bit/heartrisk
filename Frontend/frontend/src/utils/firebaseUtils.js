/**
 * Firebase Realtime Database utilities for role-based authentication and report sharing
 * Uses Firebase methods: ref(), get(), set(), onValue(), update(), child(), remove()
 */

import { rtdb } from '../config/firebase';
import { ref, get, set, update, onValue, remove, child, query, orderByChild, equalTo, limitToFirst } from 'firebase/database';

// Generate unique ID without external dependency
const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;
};

// ============================================
// USER ROLE MANAGEMENT
// ============================================

/**
 * Fetch user role from Firebase Realtime Database with timeout
 * Database path: users/{uid}
 * @param {string} uid - User ID
 * @param {number} timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns {Promise<Object>} User data including role
 */
const normalizeUserRecord = (user) => {
  if (!user) return null;

  const firstName = user.firstName || user.firstname || user.first_name || '';
  const lastName = user.lastName || user.lastname || user.last_name || '';
  const fullName = user.full_name || `${firstName} ${lastName}`.trim();

  return {
    ...user,
    uid: user.uid || user.id || user.userId || user.authUid || '',
    role: user.role || user.Role || user.userRole || user.type || 'patient',
    firstName,
    lastName,
    full_name: fullName,
    email: user.email || user.Email || '',
    profilePicture: user.profilePicture || user.photoURL || user.photoUrl || '',
    doctor_id: user.doctor_id || user.doctorId || null,  // ✅ CRITICAL: Preserve doctor_id
    doctor_code: user.doctor_code || user.doctorCode || null,
  };
};

export const fetchUserRoleFromRTDB = async (uid, timeoutMs = 3000, email = '') => {
  // ✅ FIX: Direct lookup with short timeout (avoid complex queries)
  try {
    const dbRef = ref(rtdb, `users/${uid}`);
    
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`RTDB fetch timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    
    // Race between actual fetch and timeout
    const snapshot = await Promise.race([
      get(dbRef),
      timeoutPromise
    ]);
    
    if (snapshot.exists()) {
      console.log('✅ User found in RTDB:', uid);
      return normalizeUserRecord(snapshot.val());
    }

    // ✅ FIX: Only try complex queries if we have time left and email is provided
    if (email && timeoutMs > 2000) {
      try {
        const usersRef = ref(rtdb, 'users');
        const byEmailSnap = await Promise.race([
          get(query(usersRef, orderByChild('email'), equalTo(email), limitToFirst(1))),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Email query timeout')), 1500))
        ]);
        
        if (byEmailSnap.exists()) {
          const value = Object.values(byEmailSnap.val() || {})[0];
          console.log('✅ User found in RTDB by email:', email);
          return normalizeUserRecord(value);
        }
      } catch (emailError) {
        console.warn('⚠️ RTDB lookup by email failed:', emailError.message);
      }
    }

    console.log('⚠️ User not found in RTDB:', uid);
    return null;
  } catch (error) {
    console.error('❌ RTDB fetch error:', error.message);
    return null;
  }
};

/**
 * Fetch user by uid child path
 * @param {string} uid - User ID
 * @returns {Promise<Object>} User data
 */
export const fetchUserByUid = async (uid) => {
  try {
    const dbRef = ref(rtdb);
    const userRef = child(dbRef, `users/${uid}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  } catch (error) {
    console.error('Error fetching user by UID:', error);
    throw error;
  }
};

/**
 * Set user role in Firebase Realtime Database
 * @param {string} uid - User ID
 * @param {Object} userData - User data including role
 * @returns {Promise<void>}
 */
export const setUserRoleInRTDB = async (uid, userData) => {
  try {
    const dbRef = ref(rtdb, `users/${uid}`);
    const firstName = userData.firstName || userData.firstname || userData.first_name || '';
    const lastName = userData.lastName || userData.lastname || userData.last_name || '';
    const fullName = userData.full_name || `${firstName} ${lastName}`.trim();

    const normalizedData = {
      uid,
      role: (userData.role || userData.Role || userData.userRole || userData.type || 'patient').toLowerCase(),
      email: userData.email || userData.Email || '',
      full_name: fullName,
      doctor_id: userData.doctor_id || userData.doctorId || null,
      doctor_code: userData.doctor_code || userData.doctorCode || null,
      verified: userData.verified ?? true,
      createdAt: userData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (userData.phoneNumber) normalizedData.phoneNumber = userData.phoneNumber;
    if (userData.dateOfBirth) normalizedData.dateOfBirth = userData.dateOfBirth;
    if (userData.gender) normalizedData.gender = userData.gender;
    if (userData.profilePicture) normalizedData.profilePicture = userData.profilePicture;
    
    console.log('💾 [RTDB] Saving user data:', {
      uid: uid,
      has_doctor_id: 'doctor_id' in normalizedData,
      doctor_id_value: normalizedData.doctor_id,
      doctor_code_value: normalizedData.doctor_code,
      doctor_id_from_input: userData.doctor_id,
      full_data_keys: Object.keys(normalizedData)
    });
    
    await set(dbRef, normalizedData);
    console.log('✅ [RTDB] User data saved successfully');
  } catch (error) {
    console.error('Error setting user role in RTDB:', error);
    throw error;
  }
};

/**
 * Update user role
 * @param {string} uid - User ID
 * @param {string} role - New role ('doctor', 'patient', 'pending_doctor')
 * @returns {Promise<void>}
 */
export const updateUserRole = async (uid, role) => {
  try {
    const dbRef = ref(rtdb, `users/${uid}`);
    await update(dbRef, {
      role,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
};

/**
 * Verify if user is a doctor
 * @param {string} uid - User ID
 * @returns {Promise<boolean>}
 */
export const isDoctor = async (uid) => {
  try {
    const user = await fetchUserRoleFromRTDB(uid);
    return user?.role === 'doctor';
  } catch (error) {
    console.error('Error checking if user is doctor:', error);
    return false;
  }
};

/**
 * Subscribe to user role changes
 * @param {string} uid - User ID
 * @param {Function} callback - Callback function when role changes
 * @returns {Function} Unsubscribe function
 */
export const subscribeToUserRole = (uid, callback) => {
  const dbRef = ref(rtdb, `users/${uid}`);
  const unsubscribe = onValue(dbRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val());
    }
  }, (error) => {
    console.error('Error subscribing to user role:', error);
  });
  
  return unsubscribe;
};

// ============================================
// SHARED REPORTS MANAGEMENT
// ============================================

/**
 * Create and share a report with a doctor
 * Database path: sharedReports/{reportId}
 * @param {Object} shareData - Report share data
 * @returns {Promise<Object>} Created report with ID
 */
export const shareReportWithDoctorRTDB = async (shareData) => {
  try {
    const reportId = generateId();
    const dbRef = ref(rtdb, `sharedReports/${reportId}`);
    
    const reportPayload = {
      report_id: reportId,
      patient_id: shareData.patientId,
      patient_name: shareData.patientName,
      doctor_id: shareData.doctorId,
      assessment_id: shareData.assessmentId,
      prediction_result: shareData.predictionResult,
      message: shareData.message || '',
      status: 'shared',
      created_at: new Date().toISOString(),
      shared_at: new Date().toISOString(),
      comments: []
    };
    
    await set(dbRef, reportPayload);
    
    // Also create index for doctor to quickly find their shared reports
    const doctorIndexRef = ref(rtdb, `doctorSharedReports/${shareData.doctorId}/${reportId}`);
    await set(doctorIndexRef, {
      report_id: reportId,
      patient_id: shareData.patientId,
      patient_name: shareData.patientName,
      shared_at: new Date().toISOString()
    });
    
    return reportPayload;
  } catch (error) {
    console.error('Error sharing report with doctor:', error);
    throw error;
  }
};

/**
 * Fetch a specific shared report
 * @param {string} reportId - Report ID
 * @returns {Promise<Object>} Report data
 */
export const fetchSharedReportRTDB = async (reportId) => {
  try {
    const dbRef = ref(rtdb, `sharedReports/${reportId}`);
    const snapshot = await get(dbRef);
    
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  } catch (error) {
    console.error('Error fetching shared report:', error);
    throw error;
  }
};

/**
 * Fetch all reports shared with a specific doctor
 * Database path: doctorSharedReports/{doctorId}
 * @param {string} doctorId - Doctor ID
 * @returns {Promise<Array>} Array of shared reports
 */
export const fetchDoctorSharedReportsRTDB = async (doctorId) => {
  try {
    const dbRef = ref(rtdb, `doctorSharedReports/${doctorId}`);
    const snapshot = await get(dbRef);
    
    if (snapshot.exists()) {
      const reportsIndex = snapshot.val();
      const reportIds = Object.keys(reportsIndex);
      
      // Fetch full report details for each
      const reports = await Promise.all(
        reportIds.map(reportId => fetchSharedReportRTDB(reportId))
      );
      
      return reports.filter(report => report !== null);
    }
    return [];
  } catch (error) {
    console.error('Error fetching doctor shared reports:', error);
    throw error;
  }
};

/**
 * Subscribe to real-time updates of reports shared with a doctor
 * @param {string} doctorId - Doctor ID
 * @param {Function} callback - Callback with updated reports
 * @returns {Function} Unsubscribe function
 */
export const subscribeToDoctorSharedReports = (doctorId, callback) => {
  const dbRef = ref(rtdb, `doctorSharedReports/${doctorId}`);
  
  const unsubscribe = onValue(dbRef, async (snapshot) => {
    try {
      if (snapshot.exists()) {
        const reportsIndex = snapshot.val();
        const reportIds = Object.keys(reportsIndex);
        
        if (reportIds.length === 0) {
          callback([]);
          return;
        }

        // ✅ FIX: Fetch all reports and handle errors gracefully
        const reports = await Promise.all(
          reportIds.map(reportId => 
            fetchSharedReportRTDB(reportId).catch(err => {
              console.warn(`⚠️ Failed to fetch report ${reportId}:`, err.message);
              return null; // Return null for failed reports
            })
          )
        );
        
        callback(reports.filter(report => report !== null));
      } else {
        // No doctorSharedReports index exists yet (new doctor)
        console.log('ℹ️ No shared reports yet for doctor:', doctorId);
        callback([]);
      }
    } catch (error) {
      console.error('❌ Error processing doctor reports:', error);
      callback([]); // Return empty array on error instead of failing
    }
  }, (error) => {
    console.error('❌ Error subscribing to doctor reports:', error);
    callback([]); // Return empty array on subscription error
  });
  
  return unsubscribe;
};

/**
 * Fetch all reports shared by a specific patient
 * @param {string} patientId - Patient ID
 * @returns {Promise<Array>} Array of shared reports
 */
export const fetchPatientSharedReportsRTDB = async (patientId) => {
  try {
    const [sharedSnapshot, assessmentsSnapshot] = await Promise.all([
      get(ref(rtdb, 'sharedReports')),
      get(ref(rtdb, 'assessments'))
    ]);

    const reportsById = new Map();

    Object.entries(sharedSnapshot.exists() ? sharedSnapshot.val() : {}).forEach(([reportId, report]) => {
      if (!report || typeof report !== 'object' || report.patient_id !== patientId) return;

      const normalizedId = report.report_id || report.assessment_id || reportId;
      reportsById.set(normalizedId, {
        ...report,
        id: normalizedId,
        report_id: normalizedId,
      });
    });

    Object.entries(assessmentsSnapshot.exists() ? assessmentsSnapshot.val() : {}).forEach(([topLevelKey, value]) => {
      if (!value || typeof value !== 'object') return;

      const addAssessment = (assessmentId, assessment, fallbackPatientId) => {
        if (!assessment || typeof assessment !== 'object') return;

        const assessmentPatientId =
          assessment.patient_id ||
          assessment.user_id ||
          assessment.patientId ||
          fallbackPatientId;

        if (assessmentPatientId !== patientId) return;

        const normalizedId = assessment.assessment_id || assessmentId;
        const existing = reportsById.get(normalizedId) || {};
        reportsById.set(normalizedId, {
          ...existing,
          ...assessment,
          id: normalizedId,
          report_id: normalizedId,
          assessment_id: normalizedId,
          patient_id: assessmentPatientId,
          patient_name: assessment.patient_name || existing.patient_name,
          doctor_id: assessment.doctor_id || existing.doctor_id,
          prediction_result: assessment.prediction_result || assessment.results || existing.prediction_result,
          comments: assessment.comments || existing.comments,
        });
      };

      const isFlatAssessment = Boolean(
        value.assessment_id ||
        value.patient_id ||
        value.prediction_result ||
        value.patient_name
      );

      if (isFlatAssessment) {
        addAssessment(topLevelKey, value);
        return;
      }

      if (topLevelKey === patientId) {
        Object.entries(value).forEach(([assessmentId, assessment]) => {
          addAssessment(assessmentId, assessment, topLevelKey);
        });
      }
    });

    return Array.from(reportsById.values());
  } catch (error) {
    console.error('Error fetching patient shared reports:', error);
    throw error;
  }
};

/**
 * Fetch all reports for a specific assessment
 * @param {string} assessmentId - Assessment ID
 * @returns {Promise<Array>} Array of shared reports
 */
export const fetchReportsByAssessmentRTDB = async (assessmentId) => {
  try {
    const dbRef = ref(rtdb, 'sharedReports');
    const snapshot = await get(dbRef);
    
    if (snapshot.exists()) {
      const allReports = snapshot.val();
      const assessmentReports = Object.values(allReports).filter(
        report => report.assessment_id === assessmentId
      );
      return assessmentReports;
    }
    return [];
  } catch (error) {
    console.error('Error fetching reports by assessment:', error);
    throw error;
  }
};

// ============================================
// DOCTOR COMMENTS MANAGEMENT
// ============================================

/**
 * Add a comment to a shared report
 * @param {string} reportId - Report ID
 * @param {Object} commentData - Comment data
 * @returns {Promise<Object>} Created comment with ID
 */
export const addCommentToReportRTDB = async (reportId, commentData) => {
  try {
    const commentId = generateId();
    const comment = {
      comment_id: commentId,
      doctor_id: commentData.doctorId,
      doctor_name: commentData.doctorName,
      comment: commentData.comment,
      timestamp: new Date().toISOString()
    };

    // Write comment to both sharedReports (legacy) and assessments (clinic model)
    const sharedRef = ref(rtdb, `sharedReports/${reportId}/comments/${commentId}`);
    const assessRef = ref(rtdb, `assessments/${reportId}/comments/${commentId}`);

    await Promise.all([
      set(sharedRef, comment),
      set(assessRef, comment)
    ]);

    // Update shared report status if exists (legacy flow)
    try {
      await updateReportStatus(reportId, 'reviewed');
    } catch (e) {
      // Ignore if report status can't be updated (report may not exist under sharedReports)
      console.debug('updateReportStatus skipped:', e.message || e);
    }

    return comment;
  } catch (error) {
    console.error('Error adding comment to report:', error);
    throw error;
  }
};

/**
 * Fetch all comments for a report
 * @param {string} reportId - Report ID
 * @returns {Promise<Array>} Array of comments
 */
export const fetchReportCommentsRTDB = async (reportId) => {
  try {
    // Prefer clinic assessments comments path, fall back to sharedReports
    const assessRef = ref(rtdb, `assessments/${reportId}/comments`);
    const sharedRef = ref(rtdb, `sharedReports/${reportId}/comments`);

    let snapshot = await get(assessRef);
    if (!snapshot.exists()) {
      snapshot = await get(sharedRef);
    }

    if (snapshot.exists()) {
      return Object.values(snapshot.val());
    }
    return [];
  } catch (error) {
    console.error('Error fetching report comments:', error);
    throw error;
  }
};

/**
 * Subscribe to real-time updates of report comments
 * @param {string} reportId - Report ID
 * @param {Function} callback - Callback with updated comments
 * @returns {Function} Unsubscribe function
 */
export const subscribeToReportComments = (reportId, callback) => {
  // Subscribe to assessment comments (clinic model). This will also receive
  // comments written by doctors via addCommentToReportRTDB which writes to
  // assessments/{reportId}/comments. Keep legacy sharedReports path as fallback.
  const assessRef = ref(rtdb, `assessments/${reportId}/comments`);
  const subscription = onValue(assessRef, (snapshot) => {
    if (snapshot.exists()) {
      const comments = Object.values(snapshot.val());
      callback(comments);
    } else {
      // Fallback to legacy sharedReports path
      const sharedRef = ref(rtdb, `sharedReports/${reportId}/comments`);
      onValue(sharedRef, (snap2) => {
        if (snap2.exists()) {
          callback(Object.values(snap2.val()));
        } else {
          callback([]);
        }
      }, (error) => {
        console.error('Error subscribing to legacy sharedReports comments:', error);
        callback([]);
      });
    }
  }, (error) => {
    console.error('Error subscribing to assessment comments:', error);
    callback([]);
  });

  // Return a combined unsubscribe function
  return () => {
    try { subscription(); } catch (e) { /* ignore */ }
  };
};

/**
 * Delete a comment from a report
 * @param {string} reportId - Report ID
 * @param {string} commentId - Comment ID
 * @returns {Promise<void>}
 */
export const deleteCommentRTDB = async (reportId, commentId) => {
  try {
    const dbRef = ref(rtdb, `sharedReports/${reportId}/comments/${commentId}`);
    await remove(dbRef);
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};

// ============================================
// REPORT STATUS MANAGEMENT
// ============================================

/**
 * Update report status
 * @param {string} reportId - Report ID
 * @param {string} status - New status ('shared', 'reviewed', 'archived')
 * @returns {Promise<void>}
 */
export const updateReportStatus = async (reportId, status) => {
  try {
    const dbRef = ref(rtdb, `sharedReports/${reportId}`);
    await update(dbRef, {
      status,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating report status:', error);
    throw error;
  }
};

/**
 * Archive a report
 * @param {string} reportId - Report ID
 * @returns {Promise<void>}
 */
export const archiveReportRTDB = async (reportId) => {
  try {
    await updateReportStatus(reportId, 'archived');
  } catch (error) {
    console.error('Error archiving report:', error);
    throw error;
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get all doctors (for patient to select when sharing)
 * @returns {Promise<Array>} Array of doctor users
 */
export const getAllDoctorsRTDB = async (timeoutMs = 5000) => {
  try {
    const dbRef = ref(rtdb, 'users');
    
    // Add timeout to prevent infinite loading
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Doctors fetch timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    
    // Race between actual fetch and timeout
    const snapshot = await Promise.race([
      get(dbRef),
      timeoutPromise
    ]);
    
    if (snapshot.exists()) {
      const allUsers = snapshot.val();
      const doctors = Object.entries(allUsers)
        .map(([key, user]) => {
          if (!user || typeof user !== 'object') return null;

          const uid = user.uid || user.id || user.userId || key;
          const firstName = user.firstName || user.firstname || user.first_name || '';
          const lastName = user.lastName || user.lastname || user.last_name || '';
          const role = user.role || user.Role || '';

          if (role !== 'doctor') return null;

          return {
            ...user,
            uid,
            id: uid,
            firstName,
            lastName,
            email: user.email || '',
            role,
          };
        })
        .filter(Boolean);

      console.log('✅ Fetched', doctors.length, 'doctors from RTDB');
      return doctors;
    }
    return [];
  } catch (error) {
    console.error('❌ Error fetching all doctors:', error.message);
    // Return empty array instead of throwing so modal doesn't break
    return [];
  }
};

/**
 * Search doctors by name or email
 * @param {string} searchTerm - Search term
 * @returns {Promise<Array>} Filtered array of doctors
 */
export const searchDoctorsRTDB = async (searchTerm) => {
  try {
    const doctors = await getAllDoctorsRTDB();
    const lowerSearch = searchTerm.toLowerCase();
    
    const results = doctors.filter(doctor => {
      const fullName = `${doctor.firstName || ''} ${doctor.lastName || ''}`.toLowerCase();
      const email = (doctor.email || '').toLowerCase();
      const uid = (doctor.uid || doctor.id || '').toLowerCase();
      
      return fullName.includes(lowerSearch) || email.includes(lowerSearch) || uid.includes(lowerSearch);
    });
    
    console.log(`🔍 Search "${searchTerm}" found ${results.length} doctors`);
    return results;
  } catch (error) {
    console.error('❌ Error searching doctors:', error.message);
    return []; // Return empty array instead of throwing
  }
};

/**
 * Get doctor info by UID
 * @param {string} doctorId - Doctor UID
 * @returns {Promise<Object>} Doctor data
 */
export const getDoctorInfoRTDB = async (doctorId) => {
  try {
    return await fetchUserRoleFromRTDB(doctorId);
  } catch (error) {
    console.error('Error getting doctor info:', error);
    throw error;
  }
};

/**
 * Get all patients in the system (for doctors to view)
 * @returns {Promise<Array>} Array of patient users
 */
export const getAllPatientsRTDB = async () => {
  try {
    const dbRef = ref(rtdb, 'users');
    const snapshot = await get(dbRef);
    
    if (snapshot.exists()) {
      const allUsers = snapshot.val();
      const patients = Object.entries(allUsers)
        .map(([key, user]) => {
          if (!user || typeof user !== 'object') return null;

          const uid = user.uid || user.id || user.userId || key;
          const firstName = user.firstName || user.firstname || user.first_name || '';
          const lastName = user.lastName || user.lastname || user.last_name || '';
          const role = user.role || user.Role || '';

          // Include patients and pending_doctors
          if (role !== 'patient' && role !== 'pending_doctor') return null;

          return {
            ...user,
            uid,
            id: uid,
            firstName,
            lastName,
            email: user.email || '',
            role,
          };
        })
        .filter(Boolean);

      return patients;
    }
    return [];
  } catch (error) {
    console.error('Error fetching all patients:', error);
    throw error;
  }
};

// ============================================
// CLINIC-BASED PATIENT MONITORING (1 Doctor : Many Patients)
// ============================================

/**
 * Assign a patient to a doctor's clinic
 * Saves doctor_id to patient's user record
 * @param {string} patientId - Patient UID
 * @param {string} doctorId - Doctor UID (clinic owner)
 * @returns {Promise<void>}
 */
export const assignPatientToDoctorRTDB = async (patientId, doctorId, doctorCode = null) => {
  try {
    const patientRef = ref(rtdb, `users/${patientId}`);
    const assignment = {
      doctor_id: doctorId,
      assigned_to_clinic: new Date().toISOString()
    };

    if (doctorCode) {
      assignment.doctor_code = doctorCode.trim().toUpperCase();
    }

    await update(patientRef, assignment);
    console.log(`✅ Patient ${patientId} assigned to doctor ${doctorId}`);
  } catch (error) {
    console.error('Error assigning patient to doctor:', error);
    throw error;
  }
};

/**
 * Get all patients assigned to a doctor's clinic
 * @param {string} doctorId - Doctor UID
 * @returns {Promise<Array>} Array of clinic patients
 */
export const getClinicPatientsRTDB = async (doctorId) => {
  try {
    const dbRef = ref(rtdb, 'users');
    const snapshot = await get(dbRef);
    
    if (snapshot.exists()) {
      const allUsers = snapshot.val();
      const clinicPatients = Object.entries(allUsers)
        .map(([key, user]) => {
          if (!user || typeof user !== 'object') return null;

          // Filter patients assigned to this doctor
          if (user.doctor_id !== doctorId) return null;

          const uid = user.uid || user.id || user.userId || key;
          return {
            ...user,
            uid,
            id: uid,
            firstName: user.firstName || user.first_name || '',
            lastName: user.lastName || user.last_name || '',
            email: user.email || '',
            doctor_id: user.doctor_id,
          };
        })
        .filter(Boolean);

      console.log(`✅ Found ${clinicPatients.length} patients for doctor ${doctorId}`);
      return clinicPatients;
    }
    return [];
  } catch (error) {
    console.error('Error fetching clinic patients:', error);
    return [];
  }
};

/**
 * Subscribe to all assessments from patients in a doctor's clinic
 * Real-time updates whenever any patient does a new assessment
 * Handles BOTH assessment structures:
 *   - NEW flat: assessments/{assessmentId}
 *   - OLD nested: assessments/{patientId}/{assessmentId}
 * Filters by: assessment.doctor_id === doctorId (exact string match after normalization)
 * @param {string} doctorId - Doctor Firebase UID
 * @param {Function} callback - Called with updated assessments array
 * @returns {Function} Unsubscribe function
 */
export const subscribeToClinicPatientReports = (doctorId, callback) => {
  const normalizedDoctorId = doctorId?.trim() || null;

  console.log(`📡 [CLINIC] Subscribing to clinic assessments for doctor`);
  console.log(`🔐 [CLINIC] Doctor UID: "${doctorId}"`);
  console.log(`🔐 [CLINIC] Normalized UID: "${normalizedDoctorId}"`);

  if (!normalizedDoctorId) {
    console.error('❌ [CLINIC] Invalid doctor ID');
    callback([]);
    return () => {};
  }

  const assessmentsRef = ref(rtdb, 'assessments');
  const usersRef = ref(rtdb, 'users');
  let latestAssessmentsData = {};
  let latestUsersData = {};

  const isAssessmentLike = (value) => {
    return Boolean(
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (('assessment_id' in value) || ('doctor_id' in value) || ('user_id' in value) || ('patient_id' in value) || ('prediction_result' in value) || ('results' in value))
    );
  };

  const flattenAssessments = (data) => {
    const flattened = [];

    Object.entries(data || {}).forEach(([topLevelKey, topLevelValue]) => {
      if (!topLevelValue || typeof topLevelValue !== 'object') {
        return;
      }

      // Flat record: assessments/{assessmentId}
      if (isAssessmentLike(topLevelValue)) {
        flattened.push({
          assessmentId: topLevelValue.assessment_id || topLevelKey,
          patientId: topLevelValue.user_id || topLevelValue.patient_id || topLevelValue.patientId || topLevelValue.uid || 'UNKNOWN',
          ...topLevelValue
        });
        return;
      }

      // Nested bucket: assessments/{patientId}/{assessmentId}
      Object.entries(topLevelValue).forEach(([assessmentId, assessmentValue]) => {
        if (!isAssessmentLike(assessmentValue)) {
          return;
        }

        flattened.push({
          assessmentId: assessmentValue.assessment_id || assessmentId,
          patientId: topLevelKey,
          ...assessmentValue
        });
      });
    });

    return flattened;
  };

  const getPatientIdFromAssessment = (assessment) => (
    assessment.user_id ||
    assessment.patient_id ||
    assessment.patientId ||
    assessment.uid ||
    'UNKNOWN'
  );

  const buildClinicRows = () => {
    try {
      const assignedPatients = Object.entries(latestUsersData || {})
        .map(([key, user]) => {
          if (!user || typeof user !== 'object') return null;

          const uid = user.uid || user.id || user.userId || key;
          const role = (user.role || user.Role || '').toLowerCase();
          const linkedDoctorId = (user.doctor_id || user.doctorId || '').trim();

          if (!['patient', 'pending_doctor'].includes(role)) return null;
          if (linkedDoctorId !== normalizedDoctorId) return null;

          const firstName = user.firstName || user.firstname || user.first_name || '';
          const lastName = user.lastName || user.lastname || user.last_name || '';
          const fullName = user.full_name || `${firstName} ${lastName}`.trim() || user.email || 'Unknown Patient';

          return {
            ...user,
            uid,
            id: uid,
            firstName,
            lastName,
            full_name: fullName,
            patient_name: fullName,
            doctor_id: linkedDoctorId,
          };
        })
        .filter(Boolean);

      const assignedPatientIds = new Set(assignedPatients.map((patient) => patient.uid));
      const flattenedAssessments = flattenAssessments(latestAssessmentsData);
      const uniqueAssessments = Array.from(
        flattenedAssessments.reduce((byAssessmentId, assessment) => {
          const existing = byAssessmentId.get(assessment.assessmentId) || {};
          byAssessmentId.set(assessment.assessmentId, {
            ...existing,
            ...assessment,
            patient_name: assessment.patient_name || existing.patient_name,
            prediction_result: assessment.prediction_result || existing.prediction_result,
            input_data: assessment.input_data || existing.input_data,
            comments: assessment.comments || existing.comments,
          });
          return byAssessmentId;
        }, new Map()).values()
      );

      const doctorAssessments = uniqueAssessments.filter((assessment) => {
        const assessmentDoctorId = (assessment.doctor_id || assessment.doctorId || '').trim();
        const patientId = getPatientIdFromAssessment(assessment);
        return assessmentDoctorId === normalizedDoctorId || assignedPatientIds.has(patientId);
      });

      const assessmentRows = doctorAssessments.map((assessment) => {
        const patientId = getPatientIdFromAssessment(assessment);
        const linkedPatient = assignedPatients.find((patient) => patient.uid === patientId);
        const predictionResult = assessment.prediction_result || assessment.results || {};
        const inputData = assessment.input_data || assessment.health_data || {};

        return {
          id: assessment.assessmentId,
          report_id: assessment.assessmentId,
          assessment_id: assessment.assessmentId,
          patientId,
          patient_id: patientId,
          patientName: assessment.patient_name || assessment.patientName || linkedPatient?.patient_name || 'Unknown Patient',
          patient_name: assessment.patient_name || assessment.patientName || linkedPatient?.patient_name || 'Unknown Patient',
          doctorId: assessment.doctor_id || normalizedDoctorId,
          doctor_id: assessment.doctor_id || normalizedDoctorId,
          riskPercentage: predictionResult.risk_percentage ?? null,
          confidence: predictionResult.confidence ?? null,
          disease: predictionResult.disease || null,
          createdAt: assessment.created_at || assessment.timestamp || null,
          created_at: assessment.created_at || assessment.timestamp || null,
          shared_at: assessment.shared_at || assessment.created_at || assessment.timestamp || null,
          prediction_result: Object.keys(predictionResult).length ? predictionResult : null,
          input_data: inputData,
          health_data: inputData,
          comments: Object.values(assessment.comments || {}),
          hasAssessment: true,
          rawAssessment: assessment,
        };
      });

      const patientsWithAssessments = new Set(assessmentRows.map((report) => report.patient_id));
      const patientRows = assignedPatients
        .filter((patient) => !patientsWithAssessments.has(patient.uid))
        .map((patient) => ({
          id: patient.uid,
          report_id: `patient-${patient.uid}`,
          assessment_id: null,
          patientId: patient.uid,
          patient_id: patient.uid,
          patientName: patient.patient_name,
          patient_name: patient.patient_name,
          doctorId: normalizedDoctorId,
          doctor_id: normalizedDoctorId,
          riskPercentage: null,
          confidence: null,
          disease: null,
          createdAt: patient.createdAt || patient.created_at || null,
          created_at: patient.createdAt || patient.created_at || null,
          shared_at: null,
          prediction_result: null,
          input_data: {},
          health_data: {},
          comments: [],
          hasAssessment: false,
          rawPatient: patient,
        }));

      const rows = [...assessmentRows, ...patientRows]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      console.log(`[CLINIC] Assigned patients: ${assignedPatients.length}`);
      console.log(`[CLINIC] Matching assessments: ${assessmentRows.length}`);
      console.log(`[CLINIC] Sending rows to dashboard: ${rows.length}`);
      callback(rows);
    } catch (error) {
      console.error('[CLINIC] Error processing clinic data:', error);
      callback([]);
    }
  };

  const unsubscribeAssessments = onValue(
    assessmentsRef,
    (snapshot) => {
      latestAssessmentsData = snapshot.exists() ? snapshot.val() : {};
      buildClinicRows();
    },
    (error) => {
      console.error('[CLINIC] Assessments listener error:', error);
      callback([]);
    }
  );

  const unsubscribeUsers = onValue(
    usersRef,
    (snapshot) => {
      latestUsersData = snapshot.exists() ? snapshot.val() : {};
      buildClinicRows();
    },
    (error) => {
      console.error('[CLINIC] Users listener error:', error);
      callback([]);
    }
  );

  console.log('[CLINIC] Subscription attached successfully');

  return () => {
    unsubscribeAssessments();
    unsubscribeUsers();
  };
};

/**
 * Validate doctor-patient link
 * Checks if the patient's doctorUid field is correctly set
 * @param {string} patientId - Patient UID
 * @returns {Promise<Object>} { doctorUid, isLinked, patient_info }
 */
export const validatePatientDoctorLink = async (patientId) => {
  try {
    const dbRef = ref(rtdb, `users/${patientId}`);
    const snapshot = await get(dbRef);
    
    if (snapshot.exists()) {
      const userData = snapshot.val();
      const doctorUid = userData?.doctor_id || userData?.doctorUid || null;
      
      return {
        doctorUid,
        isLinked: !!doctorUid,
        firstName: userData?.firstName || userData?.first_name || '',
        lastName: userData?.lastName || userData?.last_name || '',
        email: userData?.email || '',
        validated: true
      };
    }
    
    return { doctorUid: null, isLinked: false, validated: false };
  } catch (error) {
    console.error('❌ [VALIDATE] Error validating patient-doctor link:', error);
    return { doctorUid: null, isLinked: false, validated: false };
  }
};

/**
 * Get all assessments for a specific patient
 * @param {string} patientId - Patient UID
 * @returns {Promise<Array>} Array of patient assessments
 */
export const getPatientAssessmentsRTDB = async (patientId) => {
  try {
    const dbRef = ref(rtdb, 'assessments');
    const snapshot = await get(dbRef);
    
    if (snapshot.exists()) {
      const allAssessments = snapshot.val();
      const patientAssessments = Object.entries(allAssessments)
        .map(([key, assessment]) => {
          if (!assessment || typeof assessment !== 'object') return null;
          
          // Filter assessments for this patient
          if (assessment.patient_id !== patientId && assessment.uid !== patientId) return null;
          
          return {
            ...assessment,
            assessment_id: assessment.assessment_id || key,
          };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      console.log(`✅ Found ${patientAssessments.length} assessments for patient ${patientId}`);
      return patientAssessments;
    }
    return [];
  } catch (error) {
    console.error('Error fetching patient assessments:', error);
    return [];
  }
};

/**
 * DEBUG: Get ALL assessments from Firebase (no filtering)
 * Shows what doctor_ids exist in the database
 * @returns {Promise<Array>} All assessments with their doctor_ids
 */
export const debugGetAllAssessments = async () => {
  try {
    const dbRef = ref(rtdb, 'assessments');
    const snapshot = await get(dbRef);
    
    if (snapshot.exists()) {
      const allAssessments = snapshot.val();
      const assessmentsList = Object.entries(allAssessments).map(([key, assessment]) => ({
        key,
        assessment_id: assessment?.assessment_id,
        doctor_id: assessment?.doctor_id,
        patient_id: assessment?.patient_id,
        patient_name: assessment?.patient_name,
        risk_percentage: assessment?.prediction_result?.risk_percentage,
        created_at: assessment?.created_at,
      }));
      
      console.table(assessmentsList);
      console.log('📊 [DEBUG] All assessments in Firebase:', assessmentsList);
      return assessmentsList;
    }
    console.log('ℹ️ [DEBUG] No assessments in Firebase');
    return [];
  } catch (error) {
    console.error('❌ [DEBUG] Error fetching all assessments:', error);
    return [];
  }
};
