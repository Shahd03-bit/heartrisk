import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { fetchUserRoleFromRTDB } from '../utils/firebaseUtils';

function ProtectedRoute({ component: Component, allowedRoles = [] }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAuthenticated(false);
        setUserRole(null);
        setLoading(false);
        return;
      }

      setIsAuthenticated(true);
      
      // ✅ FIX: Check localStorage FIRST - it's faster and more reliable
      const stored = localStorage.getItem('user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const cachedRole = parsed?.role;
          if (cachedRole) {
            setUserRole(cachedRole);
            setLoading(false);
            return; // Don't fetch from Firebase if we have it in localStorage
          }
        } catch (e) {
          console.warn('Could not parse localStorage user:', e);
        }
      }

      // Only fetch from Firebase if not in localStorage
      try {
        const userData = await fetchUserRoleFromRTDB(user.uid, 5000, user.email);
        const role = userData?.role || 'patient';

        setUserRole(role);

        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            localStorage.setItem('user', JSON.stringify({ ...parsed, role, id: user.uid }));
          } catch (e) {}
        }
      } catch (err) {
        console.error('Error fetching user role:', err);
        setUserRole('patient');
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', paddingTop: '40px' }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length && !allowedRoles.includes(userRole)) {
    return <Navigate to={userRole === 'doctor' ? '/doctor-dashboard' : '/dashboard'} replace />;
  }

  return <Component />;
}

export default ProtectedRoute;
