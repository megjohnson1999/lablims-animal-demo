import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Link,
  Alert,
  CircularProgress
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoLoggingIn, setAutoLoggingIn] = useState(false);
  const { login } = useAuth();

  // Auto-login for demo mode
  useEffect(() => {
    const demoMode = process.env.REACT_APP_DEMO_MODE === 'true';
    const demoUsername = process.env.REACT_APP_DEMO_USERNAME || 'admin';
    const demoPassword = process.env.REACT_APP_DEMO_PASSWORD || 'test123';

    if (demoMode) {
      setAutoLoggingIn(true);
      const performAutoLogin = async () => {
        try {
          await login(demoUsername, demoPassword);
        } catch (err) {
          console.error('Auto-login failed:', err);
          setAutoLoggingIn(false);
          setError('Demo auto-login failed. Please try manually.');
        }
      };
      performAutoLogin();
    }
  }, [login]);

  const { username, password } = formData;

  const onChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Debug: Attempting login
      await login(username, password);
      // Debug: Login successful
    } catch (err) {
      console.error('Login error:', err);
      setError(typeof err === 'string' ? err : (err.message || 'Login failed. Please check your credentials.'));
    } finally {
      setLoading(false);
    }
  };

  // Show loading screen during auto-login
  if (autoLoggingIn) {
    return (
      <Box className="auth-container">
        <Container maxWidth="sm">
          <Paper elevation={3} className="auth-form">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
              <CircularProgress size={60} sx={{ mb: 3 }} />
              <Typography variant="h5" gutterBottom>
                Loading Demo...
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Automatically signing you in as Facility Manager
              </Typography>
            </Box>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box className="auth-container">
      <Container maxWidth="sm">
        <Paper elevation={3} className="auth-form">
          <Typography variant="h4" component="h1" className="auth-title" gutterBottom>
            LabLIMS Animal Research
          </Typography>
          <Typography variant="h5" component="h2" className="auth-title" gutterBottom>
            Login
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <form onSubmit={onSubmit}>
            <TextField
              label="Username"
              variant="outlined"
              fullWidth
              name="username"
              value={username}
              onChange={onChange}
              margin="normal"
              required
            />
            <TextField
              label="Password"
              variant="outlined"
              fullWidth
              name="password"
              type="password"
              value={password}
              onChange={onChange}
              margin="normal"
              required
            />
            
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              className="auth-submit"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
          
          <Box className="auth-link">
            <Typography variant="body2" color="text.secondary">
              Need an account? Contact your lab manager.
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Login;