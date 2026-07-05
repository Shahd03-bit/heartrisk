import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AddCircleOutlined, HistoryOutlined, PersonOutlined, MedicalServicesOutlined } from '@mui/icons-material';
import NextCheckup from '../components/NextCheckup';
import DoctorFeedbackDisplay from '../components/DoctorFeedbackDisplay';
import { assignPatientToDoctorRTDB, fetchUserRoleFromRTDB } from '../utils/firebaseUtils';
import { API_BASE_URL } from '../config/apiConfig';
import '../styles/Dashboard.css';

function Dashboard() {
  const [user, setUser] = useState(null);
  const [latestAssessment, setLatestAssessment] = useState(null);
  const [doctorCode, setDoctorCode] = useState('');
  const [doctorConnection, setDoctorConnection] = useState({ loading: false, error: '', success: '' });
  const [stats, setStats] = useState({
    totalAssessments: 0,
    lastRiskLevel: 'Compare your first assessment',
    riskTrend: 'Need more data',
    nextCheckup: 'Soon',
    chartData: []
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Log latestAssessment whenever it changes
  useEffect(() => {
    if (latestAssessment) {
      console.log('Dashboard - latestAssessment state updated:', latestAssessment);
      console.log('Dashboard - latestAssessment risk:', latestAssessment.results?.risk_percentage);
    } else {
      console.warn('Dashboard - latestAssessment is null/undefined');
    }
  }, [latestAssessment]);

  useEffect(() => {
    // Check Firebase authentication state
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let currentUser;
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            if (parsed.role === 'doctor') {
              console.log('🔄 Stored user is doctor - redirecting to doctor dashboard');
              navigate('/doctor-dashboard', { replace: true });
              setLoading(false);
              return;
            }
          } catch (e) {
            console.log('Could not parse localStorage user');
          }
        }

        try {
          const rtdbUser = await fetchUserRoleFromRTDB(firebaseUser.uid, 5000, firebaseUser.email);

          currentUser = {
            id: firebaseUser.uid,
            first_name: rtdbUser?.firstName || firebaseUser.displayName?.split(' ')[0] || 'User',
            last_name: rtdbUser?.lastName || firebaseUser.displayName?.split(' ')[1] || '',
            email: rtdbUser?.email || firebaseUser.email,
            profile_picture: rtdbUser?.profilePicture || firebaseUser.photoURL || '',
            role: rtdbUser?.role || 'patient',
            doctor_id: rtdbUser?.doctor_id || null,
            verified: rtdbUser?.verified === true,
          };
        } catch (err) {
          console.error('Error fetching user from RTDB:', err);
          currentUser = {
            id: firebaseUser.uid,
            first_name: firebaseUser.displayName?.split(' ')[0] || 'User',
            last_name: firebaseUser.displayName?.split(' ')[1] || '',
            email: firebaseUser.email,
            profile_picture: firebaseUser.photoURL || '',
            role: 'patient',
            doctor_id: null,
          };
        }

        // ✅ FINAL CHECK: Redirect doctors to doctor dashboard
        if (currentUser.role === 'doctor') {
          console.log('🔄 RTDB user is doctor - redirecting to doctor dashboard');
          navigate('/doctor-dashboard', { replace: true });
          setLoading(false);
          return;
        }

        setUser(currentUser);
        localStorage.setItem('user', JSON.stringify(currentUser));

        await fetchAssessmentStats(currentUser.id);
      } else {
        navigate('/login');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [navigate]);

  // Reload assessment data when page becomes visible or regains focus
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const currentUser = auth.currentUser;
        if (currentUser) {
          try {
            await fetchAssessmentStats(currentUser.uid);
          } catch (err) {
            console.error('Error refetching assessment data:', err);
          }
        }
      }
    };

    const handleFocus = async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          await fetchAssessmentStats(currentUser.uid);
        } catch (err) {
          console.error('Error refetching assessment data on focus:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchAssessmentStats = async (userId) => {
    try {
      console.log('📊 Dashboard: Fetching assessment stats from Flask backend for user:', userId);
      const apiUrl = `${API_BASE_URL}/assessments/${userId}`;
      console.log('🌐 API Call:', apiUrl);
      const response = await fetch(apiUrl);
      const data = await response.json();

      console.log('✅ Backend response received:', data);

      if (response.ok && data.assessments && data.assessments.length > 0) {
        const assessments = data.assessments;
        console.log('✅ Total assessments from backend:', assessments.length);

        const totalAssessments = assessments.length;

        // Get the most recent assessment (first in the list)
        const latest = assessments[0];
        setLatestAssessment(latest);

        const latestRiskPercentage = latest.results?.risk_percentage || 0;

        // Calculate risk level text
        const getRiskLevelText = (percentage) => {
          if (percentage > 70) return 'HIGH RISK';
          if (percentage > 40) return 'MEDIUM RISK';
          return 'LOW RISK';
        };

        const lastRiskLevel = `${getRiskLevelText(latestRiskPercentage)} (${latestRiskPercentage.toFixed(1)}%)`;

        // Calculate risk trend by comparing last 2 assessments
        let riskTrend = 'No previous data';
        if (assessments.length >= 2) {
          const currentRisk = latestRiskPercentage;
          const previousRisk = assessments[1].results?.risk_percentage || 0;
          const riskDifference = currentRisk - previousRisk;

          if (Math.abs(riskDifference) < 2) {
            const getRiskCategory = (value) => {
              if (value > 70) return 'HIGH';
              if (value > 40) return 'MEDIUM';
              return 'LOW';
            };
            const currentCategory = getRiskCategory(currentRisk);
            if (currentCategory === 'HIGH') {
              riskTrend = 'High Risk Persists';
            } else if (currentCategory === 'MEDIUM') {
              riskTrend = 'Moderate Risk Continues';
            } else {
              riskTrend = 'Stable (Healthy Range)';
            }
          } else if (riskDifference > 0) {
            riskTrend = `↑ Increased by ${Math.abs(riskDifference).toFixed(1)}%`;
          } else {
            riskTrend = `↓ Decreased by ${Math.abs(riskDifference).toFixed(1)}%`;
          }
        }

        // ── Prepare chart data grouped by calendar week ──────────────────────
        const weekMap = {};

        [...assessments].forEach((assessment) => {
          const date = new Date(assessment.created_at);
          const year = date.getFullYear();

          // ISO week number
          const startOfYear = new Date(year, 0, 1);
          const weekNum = Math.ceil(
            ((date - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7
          );

          const monthName = date.toLocaleDateString('en-US', { month: 'short' });
          const weekOfMonth = Math.ceil(date.getDate() / 7);

          const key = `${year}-${String(weekNum).padStart(2, '0')}`;
          const label = `${monthName} W${weekOfMonth}`;

          if (!weekMap[key]) {
            weekMap[key] = { label, risks: [], startDate: date };
          }
          weekMap[key].risks.push(assessment.results?.risk_percentage || 0);
        });

        const chartData = Object.entries(weekMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, val]) => ({
            date: val.label,
            risk: parseFloat(
              (val.risks.reduce((sum, r) => sum + r, 0) / val.risks.length).toFixed(1)
            ),
            count: val.risks.length,
          }));

        console.log('📊 Weekly chart data prepared:', chartData);

        setStats({
          totalAssessments,
          lastRiskLevel,
          riskTrend,
          nextCheckup: 'Soon',
          chartData,
        });
      } else {
        // No assessments yet
        setLatestAssessment(null);
        setStats({
          totalAssessments: 0,
          lastRiskLevel: 'Compare your first assessment',
          riskTrend: 'Need more data',
          nextCheckup: 'Soon',
          chartData: [],
        });
      }
    } catch (error) {
      console.error('Error fetching assessment stats:', error);
    }
  };

  // Refetch data when returning to Dashboard route
  useEffect(() => {
    if (location.pathname === '/dashboard') {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const timer = setTimeout(() => {
          fetchAssessmentStats(currentUser.uid);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [location.pathname]);

  const handleStartAssessment = () => navigate('/assessment');
  const handleViewHistory = () => navigate('/assessment-history');
  const handleEditProfile = () => navigate('/edit-profile');

  const handleConnectDoctor = async (e) => {
    e.preventDefault();
    const normalizedCode = doctorCode.trim().toUpperCase();

    setDoctorConnection({ loading: false, error: '', success: '' });

    if (!/^DR\d{6}$/.test(normalizedCode)) {
      setDoctorConnection({
        loading: false,
        error: 'Enter a valid doctor code, for example DR123456.',
        success: '',
      });
      return;
    }

    setDoctorConnection({ loading: true, error: '', success: '' });

    try {
      const response = await fetch(`${API_BASE_URL}/doctor/lookup-by-code/${normalizedCode}`);
      const data = await response.json();

      if (!response.ok || !data.doctor_uid) {
        throw new Error(data.error || 'Doctor code was not found.');
      }

      await assignPatientToDoctorRTDB(user.id, data.doctor_uid, normalizedCode);

      const updatedUser = {
        ...user,
        doctor_id: data.doctor_uid,
        doctor_code: normalizedCode,
      };

      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setDoctorCode('');
      setDoctorConnection({
        loading: false,
        error: '',
        success: `Connected to Dr. ${data.doctor_name}.`,
      });
    } catch (err) {
      setDoctorConnection({
        loading: false,
        error: err.message || 'Unable to connect to the doctor.',
        success: '',
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (loading || !user) {
    return (
      <div className="dashboard-container">
        <div style={{ textAlign: 'center', paddingTop: '40px' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo">
            <span className="heart-icon">❤️</span>
            <span className="logo-text">HeartPredict</span>
          </div>
        </div>
        <div className="header-right">
          <div className="user-info">
            {user.profile_picture ? (
              <img
                src={user.profile_picture}
                alt="Profile"
                className="user-avatar profile-image"
              />
            ) : (
              <span className="user-avatar">{user.first_name?.[0]?.toUpperCase() || 'U'}</span>
            )}
            <div className="user-details">
              <span className="user-name">{user.first_name} {user.last_name}</span>
              <span className="user-email">{user.email}</span>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="welcome-section">
          <h1>Welcome back, {user.first_name}!</h1>
          <p>Monitor your heart health</p>
        </div>

        {/* Row 1: Key Statistics */}
        <div className="stats-grid-top">
          <div className="stat-card">
            <div className="stat-content">
              <span className="stat-value">{stats.totalAssessments}</span>
              <span className="stat-label">Total Assessments</span>
              <p className="stat-hint">
                {stats.totalAssessments === 0
                  ? 'Start your first assessment'
                  : `${stats.totalAssessments} completed`}
              </p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <span className="stat-value" style={{ color: '#ff6b6b' }}>
                {stats.totalAssessments > 0 ? stats.lastRiskLevel.split(' ')[0] : '—'}
              </span>
              <span className="stat-label">Last Risk Level</span>
              <p className="stat-hint">
                {stats.totalAssessments > 0
                  ? stats.lastRiskLevel
                  : 'Complete an assessment to see your risk level'}
              </p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <span className="stat-value" style={{ fontSize: '20px', color: '#6b7280' }}>
                {stats.riskTrend}
              </span>
              <span className="stat-label">Risk Trend</span>
              <p className="stat-hint">
                {stats.totalAssessments >= 2 ? 'vs. previous assessment' : 'Need more data'}
              </p>
            </div>
          </div>
        </div>

        {/* Row 2: Chart + Next Checkup */}
        <div className="chart-checkup-row">
          <div className="chart-container" style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              className="stat-label"
              style={{ marginBottom: '16px', display: 'block', fontWeight: 600 }}
            >
              Risk Trend Chart
            </span>

            {stats.chartData.length > 0 ? (
              <div style={{ width: '100%', height: '200px', flex: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={stats.chartData}
                    margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      stroke="#666"
                      tick={{ fontSize: 12 }}
                      interval={0}
                    />
                    <YAxis
                      stroke="#666"
                      style={{ fontSize: '11px' }}
                      domain={[0, 100]}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                      formatter={(value, name, props) => [
                        `Avg Risk: ${value}%`,
                        `${props.payload.count} assessment(s)`,
                      ]}
                      labelFormatter={(label) => `Week: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="risk"
                      stroke="#ea6666"
                      dot={{ fill: '#890909', r: 4 }}
                      activeDot={{ r: 6 }}
                      strokeWidth={2}
                      isAnimationActive={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div
                style={{
                  color: '#999',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '200px',
                }}
              >
                No data available
              </div>
            )}
          </div>

          <div className="checkup-container">
            {latestAssessment ? (
              <NextCheckup assessment={latestAssessment} />
            ) : (
              <div
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '24px',
                  border: '1px solid #e5e7eb',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#6b7280',
                    marginBottom: '8px',
                  }}
                >
                  Suggested Health Reassessment
                </span>
                <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
                  No assessments yet. Take your first assessment to get a checkup schedule.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Cards */}
        <div className="actions-grid">

          {/* Row 1: New Assessment | Medical History | Update Profile */}
          <div className="action-card">
            <AddCircleOutlined sx={{ fontSize: 48, color: '#d17777', marginBottom: '16px' }} />
            <h3>New Assessment</h3>
            <p>Input your heart health data to get your heart disease risk assessment</p>
            <button className="btn-action" onClick={handleStartAssessment}>
              Start Assessment
            </button>
          </div>

          <div className="action-card">
            <HistoryOutlined sx={{ fontSize: 48, color: '#d17777', marginBottom: '16px' }} />
            <h3>Medical History</h3>
            <p>View your past assessments and track your heart health over time</p>
            <button className="btn-action" onClick={handleViewHistory}>
              View History
            </button>
          </div>

          <div className="action-card">
            <PersonOutlined sx={{ fontSize: 48, color: '#d17777', marginBottom: '16px' }} />
            <h3>Update Profile</h3>
            <p>Manage your personal information and health profile</p>
            <button className="btn-action" onClick={handleEditProfile}>
              Edit Profile
            </button>
          </div>

          {/* Row 2: Connect Doctor | Doctor Feedback (spans 2 cols) */}
          <div className="action-card">
            <MedicalServicesOutlined
              sx={{ fontSize: 48, color: '#d17777', marginBottom: '16px' }}
            />
            <h3>
              {user.doctor_id ? 'Change Connected Doctor' : 'Connect With a Doctor'}
            </h3>
            <p>
              {user.doctor_id
                ? `Currently connected using code ${
                    user.doctor_code || 'from your account'
                  }. Enter another code to change doctors.`
                : 'Enter the access code provided by your doctor to join their patient list.'}
            </p>
            <form className="doctor-code-form" onSubmit={handleConnectDoctor}>
              <input
                type="text"
                value={doctorCode}
                onChange={(e) => setDoctorCode(e.target.value.toUpperCase())}
                placeholder="DR123456"
                maxLength={8}
                disabled={doctorConnection.loading}
              />
              <button
                className="btn-action"
                type="submit"
                disabled={doctorConnection.loading}
              >
                {doctorConnection.loading
                  ? 'Connecting...'
                  : user.doctor_id
                  ? 'Update Doctor'
                  : 'Connect Doctor'}
              </button>
            </form>
            {doctorConnection.error && (
              <div className="doctor-code-message error">{doctorConnection.error}</div>
            )}
            {doctorConnection.success && (
              <div className="doctor-code-message success">{doctorConnection.success}</div>
            )}
          </div>

          <div className="action-card doctor-feedback-card">
            <h3>Doctor Feedback</h3>
            <DoctorFeedbackDisplay patientId={user?.id} />
          </div>

        </div> {/* closes actions-grid */}

      </main>
    </div>
  );
}

export default Dashboard;
