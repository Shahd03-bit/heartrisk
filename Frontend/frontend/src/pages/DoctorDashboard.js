/**
 * Doctor Dashboard - Professional Patient Management Portal
 *
 * HOW DATA FLOWS TO THIS DASHBOARD :
 *
 * 1. Patient registers → backend saves users/{uid} with doctor_id = doctor's UID
 * 2. Patient submits assessment → Flask /predict saves assessments/{assessmentId}
 *    with doctor_id = patient's linked doctor UID
 * 3. This dashboard calls subscribeToClinicPatientReports(doctor.uid)
 * 4. That function reads ALL of assessments/ from Firebase and filters where
 *    assessment.doctor_id === doctor.uid
 * 5. Matching assessments are transformed and passed to this component via callback
 * 6. sharedReports state is set → filteredReports re-computed → table renders
 *
 * FIX 1: hasAssessment was never set on transformed records, permanently
 *         disabling the Feedback button. Now set to true for all clinic records
 *         since every record in subscribeToClinicPatientReports IS an assessment.
 *
 * FIX 2: riskPercentage extraction now reads from a single normalized source
 *         (getRiskPercentage helper) that checks prediction_result, results,
 *         and the top-level riskPercentage field consistently everywhere —
 *         in the table, stats cards, and filter logic.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Avatar,
  Card,
  CardContent,
  Container,
  Stack,
  TextField,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  People as PeopleIcon,
  WarningAmber as WarningAmberIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Visibility as VisibilityIcon,
  Comment as CommentIcon,
   ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import {
  subscribeToReportComments,
  addCommentToReportRTDB,
  subscribeToClinicPatientReports,
} from '../utils/firebaseUtils';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import '../styles/DoctorDashboard.css';

// ✅ FIX 2: Single helper that reads risk_percentage from wherever it lives
// on a report object. subscribeToClinicPatientReports transforms records but
// some come from the flat path (prediction_result) and some from the legacy
// nested path (results). Centralizing this avoids silent 0s in the stats cards.
const getRiskPercentage = (report) => {
  if (!report) return null;

  // Direct field set during transform in subscribeToClinicPatientReports
  if (typeof report.riskPercentage === 'number') return report.riskPercentage;

  // Flat Firebase path: assessments/{assessmentId}.prediction_result.risk_percentage
  const fromPrediction = report.prediction_result?.risk_percentage;
  if (typeof fromPrediction === 'number') return fromPrediction;

  // Legacy nested path: assessments/{patientId}/{assessmentId}.results.risk_percentage
  const fromResults = report.results?.risk_percentage;
  if (typeof fromResults === 'number') return fromResults;

  return null;
};

function DoctorDashboard() {
  const [user, setUser] = useState(null);
  const [sharedReports, setSharedReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [selectedReport, setSelectedReport] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const navigate = useNavigate();

  // ==================== INITIALIZATION ====================

  useEffect(() => {
    const stored = localStorage.getItem('user');

    const processStoredUser = (storedStr) => {
      if (!storedStr) return false;
      try {
        const parsedUser = JSON.parse(storedStr);
        const normalizedRole = (parsedUser.role || '').toLowerCase();
        if (normalizedRole !== 'doctor') {
          navigate('/dashboard');
          return false;
        }
        setUser({ ...parsedUser, role: normalizedRole });
        console.log(user);
        return true;
      } catch (err) {
        console.error('❌ [DOCTOR_DASHBOARD] Error parsing user:', err);
        navigate('/login');
        return false;
      }
    };

    if (!stored) {
      const retryTimeout = setTimeout(() => {
        const retried = localStorage.getItem('user');
        if (!processStoredUser(retried)) {
          navigate('/login');
        }
      }, 300);
      return () => clearTimeout(retryTimeout);
    }

    processStoredUser(stored);
  }, [navigate]);

  // ==================== SUBSCRIBE TO CLINIC ASSESSMENTS ====================

  useEffect(() => {
    if (!user?.id) return;

    console.log(`\n🏥 [DOCTOR_DASHBOARD] Subscribing for doctor: ${user.id}`);

    const loadingTimeout = setTimeout(() => {
      console.warn('⚠️ Loading timeout — clearing loading state');
      setLoading(false);
    }, 5000);

    // subscribeToClinicPatientReports reads assessments/ from Firebase,
    // filters by assessment.doctor_id === user.id, transforms each record,
    // and calls this callback whenever Firebase data changes in real time.
    const unsubscribe = subscribeToClinicPatientReports(user.id, (newReports) => {
      console.log(`📨 [DOCTOR_DASHBOARD] Received ${newReports.length} assessments`);

      if (!Array.isArray(newReports)) {
        console.error('❌ newReports is not an array');
        setLoading(false);
        clearTimeout(loadingTimeout);
        return;
      }

      // ✅ FIX 1: Inject hasAssessment = true on every record that arrives
      // from subscribeToClinicPatientReports. Every record here IS an assessment
      // (it came from the assessments/ path), so the Feedback button should
      // always be enabled. Previously this flag was never set anywhere, which
      // meant the Feedback button was permanently disabled.
      const reportsWithFlag = newReports.map((report) => ({
        ...report,
        hasAssessment: true,
      }));

      setSharedReports(reportsWithFlag);
      setLoading(false);
      clearTimeout(loadingTimeout);
    });

    return () => {
      clearTimeout(loadingTimeout);
      if (unsubscribe) unsubscribe();
    };
  }, [user?.id]);

  // ==================== SUBSCRIBE TO COMMENTS FOR SELECTED REPORT ====================

  useEffect(() => {
    if (!selectedReport?.report_id) {
      setComments([]);
      return;
    }

    const unsubscribe = subscribeToReportComments(selectedReport.report_id, (newComments) => {
      setComments(newComments);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedReport?.report_id]);

  // ==================== RISK HELPERS ====================

  const categorizeRisk = (riskPercentage) => {
    if (riskPercentage === null || riskPercentage === undefined) return 'none';
    if (riskPercentage >= 70) return 'high';
    if (riskPercentage >= 40) return 'moderate';
    return 'low';
  };

  const getRiskColor = (riskPercentage) => {
    const risk = categorizeRisk(riskPercentage);
    if (risk === 'high') return '#ef4444';
    if (risk === 'moderate') return '#f97316';
    if (risk === 'none') return '#6b7280';
    return '#22c55e';
  };

  const getRiskLabel = (riskPercentage) => {
    const risk = categorizeRisk(riskPercentage);
    if (risk === 'high') return 'HIGH RISK';
    if (risk === 'moderate') return 'MODERATE RISK';
    if (risk === 'none') return 'NO ASSESSMENT';
    return 'LOW RISK';
  };

  // ==================== SEARCH & FILTER ====================

  useEffect(() => {
    let filtered = sharedReports;

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((report) =>
        (report.patient_name || '').toLowerCase().includes(searchLower)
      );
    }

    if (riskFilter !== 'all') {
      filtered = filtered.filter((report) => {
        // ✅ FIX 2: Use getRiskPercentage helper instead of inline path access
        const rp = getRiskPercentage(report);
        return categorizeRisk(rp) === riskFilter;
      });
    }

    setFilteredReports(filtered);
  }, [searchTerm, riskFilter, sharedReports]);

  // ==================== STATISTICS ====================
  // ✅ FIX 2: All four stat values now use getRiskPercentage so they read
  // from the same source as the table rows and filters.

  const statistics = {
    totalPatients: new Set(sharedReports.map((r) => r.patient_id)).size,
    highRisk: sharedReports.filter(
      (r) => categorizeRisk(getRiskPercentage(r)) === 'high'
    ).length,
    moderateRisk: sharedReports.filter(
      (r) => categorizeRisk(getRiskPercentage(r)) === 'moderate'
    ).length,
    lowRisk: sharedReports.filter(
      (r) => categorizeRisk(getRiskPercentage(r)) === 'low'
    ).length,
  };

  const statCardSx = (accentColor) => ({
    height: '100%',
    borderRadius: 3,
    border: '1px solid #e5e7eb',
    borderTop: `4px solid ${accentColor}`,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 18px rgba(0, 0, 0, 0.08)',
    },
  });

  // ==================== ACTIONS ====================

  const handleViewProfile = (report) => {
    setSelectedReport(report);
    setProfileModalOpen(true);
  };

  const handleOpenFeedback = (report) => {
    setSelectedReport(report);
    setFeedbackModalOpen(true);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedReport?.hasAssessment) return;

    setSubmittingComment(true);
    try {
      await addCommentToReportRTDB(selectedReport.report_id, {
        doctorId: user.id,
        doctorName: `${user.first_name} ${user.last_name}`,
        comment: newComment,
      });
      setNewComment('');
      console.log('✅ Comment added successfully');
    } catch (err) {
      console.error('❌ Error adding comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };
  
const handleCopyDoctorCode = async () => {
  if (!user?.doctor_code) return;

  try {
    await navigator.clipboard.writeText(user.doctor_code);
    setCodeCopied(true);

    setTimeout(() => {
      setCodeCopied(false);
    }, 2000);
  } catch (err) {
    console.error('Could not copy doctor code:', err);
  }
};

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // ==================== RENDER ====================

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f3f4f6', display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <Box sx={{
        bgcolor: 'white',
        borderBottom: '1px solid #e5e7eb',
        px: { xs: 2, md: 3 },
        py: 2,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 2,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontWeight: 700, color: '#1f2937' }}>
          <span className="heart-icon">❤️</span>
          <span className="logo-text">HeartPredict - Doctor Portal</span>
        </Box>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {user?.doctor_code && (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      px: 1.5,
      py: 0.75,
      bgcolor: '#eff6ff',
      border: '1px solid #bfdbfe',
      borderRadius: 2,
    }}
  >
    <Box>
      <Typography
        sx={{
          color: '#64748b',
          fontSize: 10,
          fontWeight: 700,
          lineHeight: 1.1,
        }}
      >
        YOUR DOCTOR CODE
      </Typography>

      <Typography
        sx={{
          color: '#1d4ed8',
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: '0.08em',
        }}
      >
        {user.doctor_code}
      </Typography>
    </Box>

    <Button
      onClick={handleCopyDoctorCode}
      size="small"
      variant="text"
      startIcon={<ContentCopyIcon />}
      sx={{
        minWidth: 0,
        fontWeight: 700,
        textTransform: 'none',
      }}
    >
      {codeCopied ? 'Copied' : 'Copy'}
    </Button>
  </Box>
)}
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ width: 40, height: 40, bgcolor: '#3498db', fontWeight: 700 }}>
              {`${user?.first_name?.charAt(0) || ''}${user?.last_name?.charAt(0) || ''}`}
            </Avatar>
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column' }}>
              <Box sx={{ fontWeight: 600, color: '#1f2937', fontSize: 14 }}>
                Dr. {user?.first_name} {user?.last_name}
              </Box>
              <Box sx={{ color: '#6b7280', fontSize: 12 }}>{user?.email}</Box>
            </Box>
          </Stack>
          <Button onClick={handleLogout} variant="outlined" color="error" sx={{ fontWeight: 600, borderRadius: 2 }}>
            Logout
          </Button>
        </Stack>
      </Box>

      {/* MAIN CONTENT */}
      <Container maxWidth="xl" sx={{ flex: 1, py: { xs: 3, md: 4 } }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#1f2937', mb: 1 }}>
            Patient Management Dashboard
          </Typography>
          <Typography variant="body1" sx={{ color: '#6b7280' }}>
            Monitor and manage your assigned patients' health assessments
          </Typography>
        </Box>

        {/* STATISTICS CARDS */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={statCardSx('#3498db')}>
              <CardContent sx={{ p: 3 }}>
                <PeopleIcon sx={{ fontSize: 32, color: '#3498db', mb: 1 }} />
                <Typography variant="h3" sx={{ fontWeight: 700 }}>{statistics.totalPatients}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280', fontSize: 12, letterSpacing: '0.5px' }}>TOTAL PATIENTS</Typography>
                <Typography variant="caption" sx={{ color: '#9ca3af' }}>Unique patients linked</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={statCardSx('#ef4444')}>
              <CardContent sx={{ p: 3 }}>
                <WarningAmberIcon sx={{ fontSize: 32, color: '#ef4444', mb: 1 }} />
                <Typography variant="h3" sx={{ fontWeight: 700 }}>{statistics.highRisk}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280', fontSize: 12, letterSpacing: '0.5px' }}>HIGH RISK</Typography>
                <Typography variant="caption" sx={{ color: '#9ca3af' }}>Requires immediate attention</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={statCardSx('#f97316')}>
              <CardContent sx={{ p: 3 }}>
                <InfoIcon sx={{ fontSize: 32, color: '#f97316', mb: 1 }} />
                <Typography variant="h3" sx={{ fontWeight: 700 }}>{statistics.moderateRisk}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280', fontSize: 12, letterSpacing: '0.5px' }}>MODERATE RISK</Typography>
                <Typography variant="caption" sx={{ color: '#9ca3af' }}>Monitor regularly</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={statCardSx('#22c55e')}>
              <CardContent sx={{ p: 3 }}>
                <CheckCircleIcon sx={{ fontSize: 32, color: '#22c55e', mb: 1 }} />
                <Typography variant="h3" sx={{ fontWeight: 700 }}>{statistics.lowRisk}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280', fontSize: 12, letterSpacing: '0.5px' }}>LOW RISK</Typography>
                <Typography variant="caption" sx={{ color: '#9ca3af' }}>Healthy status</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* SEARCH AND FILTER */}
        <Card variant="outlined" sx={{ mb: 4, borderRadius: 3, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  placeholder="Search patient by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#6b7280' }} />
                      </InputAdornment>
                    ),
                  }}
                  variant="outlined"
                  size="small"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                  {['all', 'high', 'moderate', 'low'].map((filter) => (
                    <Button
                      key={filter}
                      variant={riskFilter === filter ? 'contained' : 'outlined'}
                      onClick={() => setRiskFilter(filter)}
                      size="small"
                      sx={{ textTransform: 'uppercase', fontWeight: 600, fontSize: 12 }}
                    >
                      {filter === 'all' ? 'ALL'
                        : filter === 'high' ? '🔴 HIGH'
                        : filter === 'moderate' ? '🟡 MODERATE'
                        : '🟢 LOW'}
                    </Button>
                  ))}
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* PATIENTS TABLE */}
        <Card variant="outlined" sx={{ borderRadius: 3, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)' }}>
                    {['Patient Name', 'Risk Level', 'Risk %', 'Assessment Date', 'Comments', 'Actions'].map((h) => (
                      <TableCell
                        key={h}
                        align={['Risk %', 'Comments', 'Actions'].includes(h) ? 'center' : 'left'}
                        sx={{ fontWeight: 700, color: '#374151', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px', py: 2, px: 2 }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredReports.length > 0 ? (
                    filteredReports.map((report) => {
                      // ✅ FIX 2: Use getRiskPercentage helper in table rows too
                      const rp = getRiskPercentage(report);
                      return (
                        <TableRow
                          key={report.report_id}
                          sx={{ borderBottom: '1px solid #f0f1f3', '&:hover': { backgroundColor: '#f9fafb' } }}
                        >
                          <TableCell sx={{ fontWeight: 600, color: '#1f2937', py: 2, px: 2 }}>
                            {report.patient_name}
                          </TableCell>
                          <TableCell sx={{ py: 2, px: 2 }}>
                            <Chip
                              label={getRiskLabel(rp)}
                              sx={{ backgroundColor: getRiskColor(rp), color: 'white', fontWeight: 600 }}
                            />
                          </TableCell>
                          <TableCell align="center" sx={{ py: 2, px: 2 }}>
                            <strong>{rp !== null ? `${rp.toFixed(1)}%` : '—'}</strong>
                          </TableCell>
                          <TableCell sx={{ py: 2, px: 2 }}>
                            {report.created_at
                              ? new Date(report.created_at).toLocaleDateString()
                              : '—'}
                          </TableCell>
                          <TableCell align="center" sx={{ py: 2, px: 2 }}>
                            <Chip
                              icon={<CommentIcon />}
                              label={(report.comments || []).length}
                              variant="outlined"
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center" sx={{ py: 2, px: 2 }}>
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                              <Button
                                variant="text"
                                size="small"
                                startIcon={<VisibilityIcon />}
                                onClick={() => handleViewProfile(report)}
                              >
                                View
                              </Button>
                              {/* ✅ FIX 1: hasAssessment is now always true for clinic records,
                                  so this button is always enabled */}
                              <Button
                                variant="text"
                                size="small"
                                startIcon={<CommentIcon />}
                                onClick={() => handleOpenFeedback(report)}
                                disabled={!report.hasAssessment}
                              >
                                Feedback
                              </Button>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 6, color: '#9ca3af', fontSize: 14 }}>
                        {loading
                          ? 'Loading patient data...'
                          : 'No patients are linked to your account yet'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Container>

      {/* PROFILE MODAL */}
      <Dialog open={profileModalOpen} onClose={() => setProfileModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#3498db', color: 'white', fontWeight: 600 }}>
          Patient Profile
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedReport && (() => {
            const rp = getRiskPercentage(selectedReport);
            const inputData = selectedReport.input_data || selectedReport.rawAssessment?.input_data;
            return (
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  {selectedReport.patient_name}
                </Typography>

                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Risk Assessment</Typography>
                <Box sx={{ p: 2, backgroundColor: '#f3f4f6', borderRadius: 1, mb: 3 }}>
                  <Typography variant="body2">
                    <strong>Risk Level:</strong> {getRiskLabel(rp)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Risk Percentage:</strong> {rp !== null ? `${rp.toFixed(2)}%` : 'No assessment yet'}
                  </Typography>
                </Box>

                {inputData && (
  <>
    <Typography
      variant="subtitle2"
      sx={{ fontWeight: 600, mb: 1 }}
    >
      Medical History
    </Typography>

    <Box
      sx={{
        backgroundColor: '#f3f4f6',
        borderRadius: 1,
        p: 2,
      }}
    >
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Typography variant="body2">
            <strong>Age:</strong> {inputData.age}
          </Typography>
        </Grid>

        <Grid item xs={6}>
          <Typography variant="body2">
            <strong>Gender:</strong>{' '}
            {inputData.gender || inputData.sex}
          </Typography>
        </Grid>

        <Grid item xs={6}>
          <Typography variant="body2">
            <strong>Blood Pressure:</strong>{' '}
            {inputData.blood_pressure} mmHg
          </Typography>
        </Grid>

        <Grid item xs={6}>
          <Typography variant="body2">
            <strong>Cholesterol:</strong>{' '}
            {inputData.cholesterol} mg/dL
          </Typography>
        </Grid>

        {/* <Grid item xs={6}>
          <Typography variant="body2">
            <strong>Diabetes Status:</strong>{' '}
            {inputData.diabetes === 1 ||
            inputData.diabetes === true
              ? 'Yes'
              : 'No'}
          </Typography>
        </Grid> */}

        <Grid item xs={6}>
          <Typography variant="body2">
            <strong>Smoking Status:</strong>{' '}
            {inputData.smoking_status}
          </Typography>
        </Grid>
      </Grid>
    </Box>
  </>
)}
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProfileModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* FEEDBACK MODAL */}
      <Dialog open={feedbackModalOpen} onClose={() => setFeedbackModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#22c55e', color: 'white', fontWeight: 600 }}>
          Clinical Feedback — {selectedReport?.patient_name}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedReport && (
            <Box>
              {comments.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Previous Feedback</Typography>
                  <Box sx={{ backgroundColor: '#f3f4f6', borderRadius: 1, p: 2, maxHeight: 200, overflowY: 'auto' }}>
                    {comments.map((comment, idx) => (
                      <Box key={idx} sx={{ mb: 2, pb: 1, borderBottom: '1px solid #e5e7eb' }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: '#3b82f6' }}>
                          Dr. {comment.doctor_name}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', color: '#6b7280', mb: 0.5 }}>
                          {new Date(comment.timestamp).toLocaleString()}
                        </Typography>
                        <Typography variant="body2">{comment.comment}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Add Your Feedback</Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                placeholder="Enter your clinical notes and recommendations..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                variant="outlined"
                disabled={submittingComment}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFeedbackModalOpen(false)} disabled={submittingComment}>
            Cancel
          </Button>
          <Button
            onClick={handleAddComment}
            variant="contained"
            disabled={submittingComment || !newComment.trim()}
            sx={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}
          >
            {submittingComment ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default DoctorDashboard;