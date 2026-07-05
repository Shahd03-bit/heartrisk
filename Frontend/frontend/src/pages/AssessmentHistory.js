import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/apiConfig';
import '../styles/AssessmentHistory.css';

import {
  TextField,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  Box,
  Typography
} from '@mui/material';

import TuneIcon from '@mui/icons-material/Tune';

function AssessmentHistory() {
  const [assessments, setAssessments] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');

  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return navigate('/login');

    fetch(`${API_BASE_URL}/assessments/${user.id}`)
      .then(res => res.json())
      .then(data => {
        const sorted = (data.assessments || []).sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        setAssessments(sorted);
        setFiltered(sorted);
      });
  }, [navigate]);

  // FILTER + SEARCH
  useEffect(() => {
    let data = assessments;

    if (riskFilter !== 'all') {
      data = data.filter(a => {
        const r = a.results.risk_percentage;
        if (riskFilter === 'low') return r < 30;
        if (riskFilter === 'medium') return r < 60;
        return r >= 60;
      });
    }

    if (search.trim()) {
      const query = search.toLowerCase();

      data = data.filter(a => {
        const date = new Date(a.created_at)
          .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          .toLowerCase();

        const risk = a.results.risk_percentage.toString();
        const label = getRiskLabel(a.results.risk_percentage).toLowerCase();

        return date.includes(query) || risk.includes(query) || label.includes(query);
      });
    }

    setFiltered(data);
  }, [search, riskFilter, assessments]);

  const getRiskLabel = (r) => {
    if (r < 30) return 'Low Risk';
    if (r < 60) return 'Medium Risk';
    return 'High Risk';
  };

  const getRiskClass = (r) => {
    if (r < 30) return 'risk-low';
    if (r < 60) return 'risk-medium';
    return 'risk-high';
  };

  const formatDate = (date) => new Date(date).toLocaleString();

  return (
    <div className="history-container">

      {/* HEADER */}
      <div className="history-header">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          Back
        </button>

        <div className="header-title">
          <span className="heart-icon">❤️</span>
          <h1>Assessment History</h1>
        </div>
      </div>

      <div className="history-main">

        {/* FILTER */}
        <div className="filters">

          {/* LABEL */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TuneIcon sx={{ color: '#374151' }} />
            <Typography sx={{ fontWeight: 600, color: '#374151' }}>
              Filter
            </Typography>
          </Box>

          {/* CONTROLS */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>

            {/* SEARCH */}
            <TextField
              placeholder="Search by date, risk level, or score..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              sx={{
                minWidth: 300,

                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  backgroundColor: '#f9fafb',

                  '& fieldset': {
                    borderColor: '#e5e7eb',
                  },

                  '&:hover fieldset': {
                    borderColor: '#ef4444',
                  },

                  '&.Mui-focused fieldset': {
                    borderColor: '#ef4444',
                  },
                },
              }}
            />

            {/* DROPDOWN */}
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel
                sx={{
                  '&.Mui-focused': {
                    color: '#ef4444',
                  }
                }}
              >
                Risk Level
              </InputLabel>

              <Select
                value={riskFilter}
                label="Risk Level"
                onChange={(e) => setRiskFilter(e.target.value)}
                sx={{
                  borderRadius: '12px',
                  backgroundColor: '#f9fafb',

                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#e5e7eb',
                  },

                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#ef4444',
                  },

                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#ef4444',
                  },
                }}

                MenuProps={{
                  PaperProps: {
                    sx: {
                      borderRadius: '12px',

                      '& .MuiMenuItem-root': {
                        '&:hover': {
                          backgroundColor: '#fef2f2',
                        },

                        '&.Mui-selected': {
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                        },

                        '&.Mui-selected:hover': {
                          backgroundColor: '#fecaca',
                        },
                      },
                    },
                  },
                }}
              >
                <MenuItem value="all" sx={{'&.mui-selected':{ 
                backgroundColor: '#fee2e2',
                color: '#dc2626',}, '&.Mui-selected:hover': {
                          backgroundColor: '#fecaca',
                        }, '&:hover': {
                          backgroundColor: '#fef2f2',
                        },}}>All Risk Levels</MenuItem>
                <MenuItem value="low" sx={{'&.mui-selected':{ 
                backgroundColor: '#fee2e2',
                color: '#dc2626',}, '&.Mui-selected:hover': {
                          backgroundColor: '#fecaca',
                        }, '&:hover': {
                          backgroundColor: '#fef2f2',
                        },}}>Low Risk</MenuItem>
                <MenuItem value="medium" sx={{'&.mui-selected':{ 
                backgroundColor: '#fee2e2',
                color: '#dc2626',}, '&.Mui-selected:hover': {
                          backgroundColor: '#fecaca',
                        }, '&:hover': {
                          backgroundColor: '#fef2f2',
                        },}}>Medium Risk</MenuItem>
                <MenuItem value="high" sx={{'&.mui-selected':{ 
                backgroundColor: '#fee2e2',
                color: '#dc2626',}, '&.Mui-selected:hover': {
                          backgroundColor: '#fecaca',
                        }, '&:hover': {
                          backgroundColor: '#fef2f2',
                        },}}>High Risk</MenuItem>
              </Select>
            </FormControl>

          </Box>
        </div>

        {/* CARDS */}
        <div className="assessments-grid">
          {filtered.map((a) => (
            <div key={a.assessment_id} className="assessment-card">

              <div className="card-header">
                <span className="date">{formatDate(a.created_at)}</span>

                <span className={`risk-badge ${getRiskClass(a.results.risk_percentage)}`}>
                  {getRiskLabel(a.results.risk_percentage)}
                </span>
              </div>

              <div className="card-body">
                <div className="metric">
                  <p>Risk Score</p>
                  <h3>{a.results.risk_percentage}%</h3>
                </div>

                <div className="metric">
                  <p>Age</p>
                  <h3>{a.input_data.age}</h3>
                </div>

                <div className="metric">
                  <p>Blood Pressure</p>
                  <h3>{a.input_data.blood_pressure}</h3>
                </div>

                <div className="metric">
                  <p>Cholesterol</p>
                  <h3>{a.input_data.cholesterol}</h3>
                </div>
              </div>

            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

export default AssessmentHistory;
