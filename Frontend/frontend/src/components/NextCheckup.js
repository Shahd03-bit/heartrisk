import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Box, Chip} from '@mui/material';
import { Event as EventIcon, Schedule as ScheduleIcon, WarningAmber as AlertIcon } from '@mui/icons-material';

function NextCheckup({ assessment }) {
  const [checkupData, setCheckupData] = useState({
    nextDate: null,
    daysRemaining: 0,
    reason: '',
    status: 'upcoming',
    riskLevel: 'Low Risk'
  });

  useEffect(() => {
    if (assessment) {
      console.log('📊 NextCheckup component: Assessment prop received, calculating...');
      calculateNextCheckup(assessment);
    } else {
      console.warn('⚠️ NextCheckup component: No assessment prop provided');
    }
  }, [assessment]);

  const calculateNextCheckup = (assessment) => {
    try {
      // Debug logging
      console.log('🔍 NextCheckup - Assessment received:', assessment);
      console.log('🔍 NextCheckup - Full assessment structure:', JSON.stringify(assessment, null, 2));
      console.log('🔍 NextCheckup - Risk percentage:', assessment.results?.risk_percentage);
      console.log('🔍 NextCheckup - Input data:', assessment.input_data);
      console.log('🔍 NextCheckup - Assessment keys:', Object.keys(assessment));
      
      const today = new Date();
      const assessmentDate = new Date(assessment.created_at);
      
      // Extract health indicators
      const riskPercentage = assessment.results?.risk_percentage || 0;
      const cholesterol = assessment.input_data?.cholesterol || 0;
      const bloodPressure = assessment.input_data?.blood_pressure || '0/0';
      
      console.log('🔍 Extracted data:', { riskPercentage, cholesterol, bloodPressure });
      
      // Parse blood pressure - handle both number and string formats
      let systolic = 0;
      if (typeof bloodPressure === 'number') {
        // Backend returns as number (e.g., 120)
        systolic = bloodPressure;
      } else if (typeof bloodPressure === 'string') {
        // Backend returns as string (e.g., "120/80")
        systolic = parseInt(bloodPressure.split('/')[0]) || 0;
      }
      
      console.log('🔍 Parsed systolic BP:', systolic);
      
      // Determine risk level
      const getRiskLevel = (percentage) => {
        if (percentage > 70) return 'High Risk';
        if (percentage > 40) return 'Medium Risk';
        return 'Low Risk';
      };
      
      const riskLevel = getRiskLevel(riskPercentage);
      console.log('✅ Calculated risk level:', riskLevel, 'from percentage:', riskPercentage);
      
      // Calculate months to add and reason
      let monthsToAdd = 6; // Default for Low Risk
      let reason = 'Regular health monitoring';
      
      // Check critical indicators first
      if (cholesterol > 240) {
        monthsToAdd = 1;
        reason = `High cholesterol detected (${cholesterol} mg/dL)`;
      } else if (systolic > 140) {
        monthsToAdd = 1;
        const bpDisplay = typeof bloodPressure === 'number' ? `${bloodPressure} mmHg` : `${bloodPressure} mmHg`;
        reason = `Elevated blood pressure detected (${bpDisplay})`;
      } else {
        // Use risk level if no critical indicators
        switch (riskLevel) {
          case 'High Risk':
            monthsToAdd = 1;
            reason = `High risk detected (${riskPercentage.toFixed(1)}% risk)`;
            break;
          case 'Medium Risk':
            monthsToAdd = 3;
            reason = `Medium risk detected (${riskPercentage.toFixed(1)}% risk)`;
            break;
          default:
            monthsToAdd = 6;
            reason = `Low risk detected (${riskPercentage.toFixed(1)}% risk)`;
        }
      }
      
      console.log('📅 Calculated checkup interval:', monthsToAdd, 'months');
      console.log('📝 Reason:', reason);
      
      // Calculate next checkup date
      const nextDate = new Date(assessmentDate);
      nextDate.setMonth(nextDate.getMonth() + monthsToAdd);
      
      // Calculate days remaining
      const timeDifference = nextDate - today;
      const daysRemaining = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));
      
      // Determine status
      let status = 'upcoming';
      if (daysRemaining < 0) {
        status = 'overdue';
      } else if (daysRemaining <= 7) {
        status = 'urgent';
      } else if (daysRemaining <= 30) {
        status = 'soon';
      }
      
      console.log('✅ Final checkup data:', { nextDate, daysRemaining, status, riskLevel });
      
      setCheckupData({
        nextDate,
        daysRemaining,
        reason,
        status,
        riskLevel,
        monthsToAdd
      });
      
      // Debug output
      console.log('NextCheckup calculated:', {
        nextDate: nextDate.toDateString(),
        daysRemaining,
        reason,
        status,
        riskLevel,
        monthsToAdd,
        riskPercentage,
        cholesterol,
        bloodPressure
      });
    } catch (error) {
      console.error('❌ Error calculating next checkup:', error);
      console.error('❌ Assessment data that caused error:', assessment);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const getDaysText = (days) => {
    if (days < 0) return 'Overdue';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  };

  const getStatusColor = () => {
    switch (checkupData.status) {
      case 'overdue':
        return '#f44336'; // Red
      case 'urgent':
        return '#ff9800'; // Orange
      case 'soon':
        return '#ffc107'; // Yellow
      default:
        return '#4caf50'; // Green
    }
  };

  const getStatusBgColor = () => {
    switch (checkupData.status) {
      case 'overdue':
        return '#ffebee';
      case 'urgent':
        return '#fff3e0';
      case 'soon':
        return '#fffde7';
      default:
        return '#e8f5e9';
    }
  };

  const getReasonIcon = () => {
    if (checkupData.status === 'overdue') {
      return <AlertIcon sx={{ color: '#f44336', fontSize: 20 }} />;
    }
    return <ScheduleIcon sx={{ color: getStatusColor(), fontSize: 20 }} />;
  };

  return (
    <Card
      sx={{
        background: getStatusBgColor(),
        border: `2px solid ${getStatusColor()}`,
        borderRadius: '12px',
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
          transform: 'translateY(-2px)'
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <EventIcon sx={{ color: getStatusColor(), fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1f2937' }}>
            Suggested Health Reassessment
          </Typography>
        </Box>

        {/* Main Date Display */}
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              color: getStatusColor(),
              mb: 0.5
            }}
          >
            {formatDate(checkupData.nextDate)}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getReasonIcon()}
            <Typography variant="body2" sx={{ color: '#6b7280', fontWeight: 500 }}>
              {getDaysText(checkupData.daysRemaining)}
            </Typography>
          </Box>
        </Box>

        {/* Reason Box */}
        <Box
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.6)',
            borderRadius: '8px',
            p: 1.5,
            mb: 2,
            border: `1px solid ${getStatusColor()}33`
          }}
        >
          <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mb: 0.5 }}>
            Reason
          </Typography>
          <Typography variant="body2" sx={{ color: '#1f2937', fontWeight: 600 }}>
            {checkupData.reason}
          </Typography>
        </Box>

        {/* Risk Level & Status Chips */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={checkupData.riskLevel}
            size="small"
            sx={{
              backgroundColor:
                checkupData.riskLevel === 'High Risk'
                  ? '#ffebee'
                  : checkupData.riskLevel === 'Medium Risk'
                  ? '#fff3e0'
                  : '#e8f5e9',
              color:
                checkupData.riskLevel === 'High Risk'
                  ? '#c62828'
                  : checkupData.riskLevel === 'Medium Risk'
                  ? '#e65100'
                  : '#1b5e20',
              fontWeight: 600
            }}
          />
          <Chip
            label={
              checkupData.status === 'overdue'
                ? ' Overdue'
                : checkupData.status === 'urgent'
                ? ' Urgent'
                : checkupData.status === 'soon'
                ? ' Coming Soon'
                : ' On Track'
            }
            size="small"
            sx={{
              backgroundColor: getStatusBgColor(),
              color: getStatusColor(),
              fontWeight: 600,
              border: `1px solid ${getStatusColor()}33`
            }}
          />
        </Box>

        {/* Additional Info */}
        <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${getStatusColor()}33` }}>
          <Typography variant="caption" sx={{ color: '#9ca3af', display: 'block', mb: 1 }}>
            Follow-up Interval: {checkupData.monthsToAdd} month{checkupData.monthsToAdd > 1 ? 's' : ''}
          </Typography>
          {checkupData.status === 'overdue' && (
            <Typography
              variant="caption"
              sx={{
                color: '#f44336',
                display: 'block',
                fontWeight: 600,
                backgroundColor: '#ffebee',
                p: 1,
                borderRadius: '4px'
              }}
            >
             Your checkup is overdue. Please schedule an appointment with your healthcare provider.
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

export default NextCheckup;
