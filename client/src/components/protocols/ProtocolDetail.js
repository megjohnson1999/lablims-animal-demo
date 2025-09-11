import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Card,
  CardContent,
} from '@mui/material';
import {
  Edit as EditIcon,
  ContentCopy as DuplicateIcon,
  ArrowBack as BackIcon,
  Science as ExperimentIcon,
} from '@mui/icons-material';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/helpers';
import { toast } from 'react-toastify';
import ExperimentHistoryTable from '../common/ExperimentHistoryTable';

const ProtocolDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [protocol, setProtocol] = useState(null);
  const [experiments, setExperiments] = useState([]);
  const [usageStats, setUsageStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [experimentsLoading, setExperimentsLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditor = currentUser?.role === 'editor' || currentUser?.role === 'admin';

  useEffect(() => {
    fetchProtocol();
    fetchUsageStats();
    fetchExperiments();
  }, [id]);

  const fetchProtocol = async () => {
    try {
      const response = await fetch(`/api/protocols/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch protocol');
      }

      const data = await response.json();
      setProtocol(data);
    } catch (err) {
      console.error('Error fetching protocol:', err);
      setError('Failed to load protocol');
    }
  };

  const fetchUsageStats = async () => {
    try {
      const response = await fetch('/api/protocols/usage-stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const stats = await response.json();
        const protocolStats = stats.find(stat => stat.protocol_id === id);
        setUsageStats(protocolStats);
      }
    } catch (err) {
      console.error('Error fetching usage stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExperiments = async () => {
    try {
      setExperimentsLoading(true);
      const response = await fetch(`/api/protocols/${id}/experiments`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setExperiments(data.experiments || []);
      } else {
        console.warn('Could not fetch experiments for protocol');
        setExperiments([]);
      }
    } catch (err) {
      console.error('Error fetching protocol experiments:', err);
      setExperiments([]);
    } finally {
      setExperimentsLoading(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      const response = await fetch(`/api/protocols/${id}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          name: `${protocol.name} (Copy)`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to duplicate protocol');
      }

      const duplicatedProtocol = await response.json();
      toast.success('Protocol duplicated successfully');
      navigate(`/protocols/${duplicatedProtocol.id}/edit`);
    } catch (err) {
      console.error('Error duplicating protocol:', err);
      toast.error('Failed to duplicate protocol');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !protocol) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {error || 'Protocol not found'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          component={Link}
          to="/protocols"
          startIcon={<BackIcon />}
          sx={{ mr: 2 }}
        >
          Back to Protocols
        </Button>
        <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }}>
          {protocol.name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isEditor && (
            <>
              <Button
                component={Link}
                to={`/protocols/${id}/edit`}
                variant="outlined"
                startIcon={<EditIcon />}
              >
                Edit
              </Button>
              <Button
                variant="outlined"
                startIcon={<DuplicateIcon />}
                onClick={handleDuplicate}
              >
                Duplicate
              </Button>
            </>
          )}
          <Button
            component={Link}
            to={`/experiments/new?protocol=${id}`}
            variant="contained"
            startIcon={<ExperimentIcon />}
          >
            Use Protocol
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Protocol Information
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Last Updated
                </Typography>
                <Typography variant="body1">
                  {formatDate(protocol.updated_at || protocol.created_at)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Status
                </Typography>
                <Chip
                  label={protocol.is_active ? 'Active' : 'Inactive'}
                  size="small"
                  color={protocol.is_active ? 'success' : 'default'}
                />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Created By
                </Typography>
                <Typography variant="body1">
                  {protocol.created_by_first_name} {protocol.created_by_last_name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  @{protocol.created_by_username}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Created Date
                </Typography>
                <Typography variant="body1">
                  {formatDate(protocol.created_at)}
                </Typography>
              </Grid>
            </Grid>

            {protocol.description && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Description
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {protocol.description}
                </Typography>
              </>
            )}

            {protocol.basic_steps && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Protocol Steps
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {protocol.basic_steps}
                </Typography>
              </>
            )}
          </Paper>

          {protocol.required_reagents && protocol.required_reagents.length > 0 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Required Reagents
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Reagent Name</TableCell>
                      <TableCell align="right">Quantity per Sample</TableCell>
                      <TableCell>Unit</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {protocol.required_reagents.map((reagent, index) => (
                      <TableRow key={index}>
                        <TableCell>{reagent.name}</TableCell>
                        <TableCell align="right">{reagent.quantity_per_sample}</TableCell>
                        <TableCell>{reagent.unit}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Usage Statistics
              </Typography>
              {usageStats ? (
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="h4" color="primary">
                      {usageStats.usage_count || 0}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total Uses
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h4" color="primary">
                      {usageStats.user_count || 0}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Different Users
                    </Typography>
                  </Grid>
                  {usageStats.last_used && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Last Used
                      </Typography>
                      <Typography variant="body2">
                        {formatDate(usageStats.last_used)}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No usage data available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Usage History - Specimens */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
              Usage History - Specimens ({experiments.length} experiments)
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <ExperimentHistoryTable
              experiments={experiments}
              loading={experimentsLoading}
              showProtocolColumn={false}
              showSpecimenColumn={true}
              emptyMessage="This protocol has not been used in any experiments"
            />
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  component={Link}
                  to={`/experiments?protocol=${id}`}
                  variant="outlined"
                  size="small"
                  fullWidth
                >
                  View Experiments
                </Button>
                <Button
                  component={Link}
                  to={`/inventory/check-availability?protocol=${id}`}
                  variant="outlined"
                  size="small"
                  fullWidth
                >
                  Check Reagent Availability
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProtocolDetail;