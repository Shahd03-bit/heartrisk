import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Assessment from './pages/Assessment';
import AssessmentResults from './pages/AssessmentResults';
import AssessmentHistory from './pages/AssessmentHistory';
import AssessmentReview from './pages/AssessmentReview';
import DoctorDashboard from './pages/DoctorDashboard';
import EditProfile from './pages/EditProfile';
import ForgotPassword from './pages/ForgotPassword';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/dashboard" element={<ProtectedRoute component={Dashboard} allowedRoles={["patient", "pending_doctor"]} />} />
        <Route path="/edit-profile" element={<ProtectedRoute component={EditProfile} />} />
        <Route path="/assessment" element={<ProtectedRoute component={Assessment} allowedRoles={["patient", "pending_doctor"]} />} />
        <Route path="/assessment-results" element={<ProtectedRoute component={AssessmentResults} allowedRoles={["patient", "pending_doctor"]} />} />
        <Route path="/assessment-review" element={<ProtectedRoute component={AssessmentReview} />} />
        <Route path="/doctor-dashboard" element={<ProtectedRoute component={DoctorDashboard} allowedRoles={["doctor"]} />} />
        <Route path="/assessment-history" element={<ProtectedRoute component={AssessmentHistory} allowedRoles={["patient", "pending_doctor"]} />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;