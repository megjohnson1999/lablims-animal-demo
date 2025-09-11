import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Grid,
  Button,
  Box,
  Chip,
  Card,
  CardContent,
  Divider,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  Science as ScienceIcon,
  Timeline as UsageIcon,
  Print as PrintIcon,
  QrCode as QrCodeIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import biologicalSamplesAPI from '../../services/biologicalSamplesAPI';
import { animalAPI, experimentalStudiesAPI } from '../../services/api';

const BiologicalSampleDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [sample, setSample] = useState(null);
  const [animal, setAnimal] = useState(null);
  const [study, setStudy] = useState(null);
  const [usageHistory, setUsageHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [usageDialogOpen, setUsageDialogOpen] = useState(false);
  const [usageForm, setUsageForm] = useState({
    quantity_used: '',
    purpose: '',
    used_by: currentUser?.username || '',
    notes: ''
  });

  // Permission checks
  const canEdit = currentUser && ['admin', 'facility_manager', 'veterinarian', 'researcher'].includes(currentUser.role);
  const canDelete = currentUser && ['admin', 'facility_manager'].includes(currentUser.role);

  useEffect(() => {
    const loadSampleData = async () => {
      try {
        setLoading(true);
        const sampleResponse = await biologicalSamplesAPI.getById(id);
        const sampleData = sampleResponse.data;
        setSample(sampleData);

        // Load related animal data
        if (sampleData.animal_id) {
          try {
            const animalResponse = await animalAPI.getById(sampleData.animal_id);
            setAnimal(animalResponse.data);
          } catch (error) {
            console.warn('Could not load animal data:', error);
          }
        }

        // Load related study data
        if (sampleData.study_id) {
          try {
            const studyResponse = await experimentalStudiesAPI.getById(sampleData.study_id);
            setStudy(studyResponse.data);
          } catch (error) {
            console.warn('Could not load study data:', error);
          }
        }

      } catch (error) {
        console.error('Error loading sample:', error);
        setError('Failed to load sample data');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadSampleData();
    }
  }, [id]);

  const handleEdit = () => {
    navigate(`/biological-samples/${id}/edit`);
  };

  const handleDelete = async () => {
    try {
      await biologicalSamplesAPI.delete(id);
      toast.success('Sample deleted successfully');
      navigate('/biological-samples');
    } catch (error) {
      console.error('Error deleting sample:', error);
      toast.error('Failed to delete sample');
    }
    setDeleteDialogOpen(false);
  };

  const handleUsageSubmit = async () => {
    try {
      const usageData = {
        ...usageForm,
        quantity_used: parseFloat(usageForm.quantity_used),
        date_used: new Date().toISOString()
      };

      await biologicalSamplesAPI.recordUsage(id, usageData);
      toast.success('Usage recorded successfully');
      
      // Reload sample data to get updated quantities
      const response = await biologicalSamplesAPI.getById(id);
      setSample(response.data);
      
      setUsageDialogOpen(false);
      setUsageForm({
        quantity_used: '',
        purpose: '',
        used_by: currentUser?.username || '',
        notes: ''
      });
    } catch (error) {
      console.error('Error recording usage:', error);
      toast.error('Failed to record usage');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'success';
      case 'depleted': return 'error';
      case 'reserved': return 'warning';
      default: return 'default';
    }
  };

  const getQuantityPercentage = () => {
    if (!sample || !sample.initial_quantity) return 0;
    return (sample.current_quantity / sample.initial_quantity) * 100;
  };

  const formatValue = (key, value) => {
    if (!value) return 'N/A';
    
    if (key.includes('date') || key.includes('time')) {
      return format(new Date(value), 'MMM dd, yyyy HH:mm');
    }
    
    if (typeof value === 'string' && value.includes('_')) {
      return value.replace(/_/g, ' ').toUpperCase();
    }
    
    return value;
  };

  if (loading) {
    return (
      <Container>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography>Loading sample data...</Typography>
        </Paper>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!sample) {
    return (
      <Container>
        <Alert severity="warning">Sample not found</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate('/biological-samples')}
            variant="outlined"
          >
            Back to Samples
          </Button>
          <Typography variant="h4">
            Sample #{sample.sample_id}
          </Typography>
          <Chip 
            label={sample.status} 
            color={getStatusColor(sample.status)} 
            size="small" 
          />
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          {canEdit && (
            <Button
              startIcon={<EditIcon />}
              variant="outlined"
              onClick={handleEdit}
            >
              Edit
            </Button>
          )}
          <Button
            startIcon={<UsageIcon />}
            variant="contained"
            onClick={() => setUsageDialogOpen(true)}
            disabled={sample.status === 'depleted'}
          >
            Record Usage
          </Button>
          {canDelete && (
            <Button
              startIcon={<DeleteIcon />}
              color="error"
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete
            </Button>
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Sample Overview */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScienceIcon />
                Sample Information
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Type</Typography>
                  <Typography variant="body1">{formatValue('sample_type', sample.sample_type)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Anatomical Site</Typography>
                  <Typography variant="body1">{formatValue('anatomical_site', sample.anatomical_site)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Collection Method</Typography>
                  <Typography variant="body1">{formatValue('collection_method', sample.collection_method)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Preservation</Typography>
                  <Typography variant="body1">{formatValue('preservation_method', sample.preservation_method)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Collected By</Typography>
                  <Typography variant="body1">{sample.collected_by}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Collection Date</Typography>
                  <Typography variant="body1">{formatValue('collection_date', sample.collection_date)}</Typography>
                </Grid>
              </Grid>

              {sample.notes && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body2" color="text.secondary">Notes</Typography>
                  <Typography variant="body1">{sample.notes}</Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Quantity & Storage */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quantity & Storage
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Quantity Remaining</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={getQuantityPercentage()} 
                    sx={{ flexGrow: 1, height: 8 }}
                    color={getQuantityPercentage() > 50 ? 'success' : getQuantityPercentage() > 25 ? 'warning' : 'error'}
                  />
                  <Typography variant="body2" sx={{ minWidth: '120px' }}>
                    {sample.current_quantity} / {sample.initial_quantity} {sample.quantity_unit}
                  </Typography>
                </Box>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Storage Location</Typography>
                  <Typography variant="body1">{sample.storage_location || 'Not specified'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Storage Condition</Typography>
                  <Typography variant="body1">{formatValue('storage_condition', sample.storage_condition)}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Sample ID</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                      {sample.sample_id}
                    </Typography>
                    <Button size="small" startIcon={<QrCodeIcon />}>
                      QR Code
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Subject Information */}
        {animal && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Subject Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Subject ID</Typography>
                    <Typography variant="body1">{animal.animal_id}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Species</Typography>
                    <Typography variant="body1">{animal.species}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Strain</Typography>
                    <Typography variant="body1">{animal.strain || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Sex</Typography>
                    <Typography variant="body1">{animal.sex}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Age</Typography>
                    <Typography variant="body1">{animal.age_weeks} weeks</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Weight</Typography>
                    <Typography variant="body1">{animal.weight_grams}g</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Study Information */}
        {study && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Study Association
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Study Title</Typography>
                    <Typography variant="body1">{study.title}</Typography>
                  </Grid>
                  {sample.treatment_group && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Treatment Group</Typography>
                      <Typography variant="body1">{sample.treatment_group}</Typography>
                    </Grid>
                  )}
                  {sample.iacuc_protocol && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">IACUC Protocol</Typography>
                      <Typography variant="body1">{sample.iacuc_protocol}</Typography>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this biological sample? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Usage Recording Dialog */}
      <Dialog open={usageDialogOpen} onClose={() => setUsageDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Sample Usage</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                required
                label="Quantity Used"
                type="number"
                value={usageForm.quantity_used}
                onChange={(e) => setUsageForm(prev => ({ ...prev, quantity_used: e.target.value }))}
                InputProps={{ 
                  inputProps: { min: 0, max: sample.current_quantity, step: 0.1 },
                  endAdornment: sample.quantity_unit
                }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Used By"
                value={usageForm.used_by}
                onChange={(e) => setUsageForm(prev => ({ ...prev, used_by: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Purpose"
                value={usageForm.purpose}
                onChange={(e) => setUsageForm(prev => ({ ...prev, purpose: e.target.value }))}
                placeholder="e.g., RNA extraction, Western blot, PCR"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes"
                value={usageForm.notes}
                onChange={(e) => setUsageForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUsageDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUsageSubmit} variant="contained">Record Usage</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default BiologicalSampleDetail;