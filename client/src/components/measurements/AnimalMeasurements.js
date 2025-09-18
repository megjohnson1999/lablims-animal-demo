import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Fab,
  Tooltip,
  IconButton,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Timeline as TimelineIcon,
  Assignment as ScheduleIcon,
  Refresh as RefreshIcon,
  Download as ExportIcon,
  TrendingUp as TrendingUpIcon,
  ShowChart as ShowChartIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAuth } from '../../context/AuthContext';
import { canEditLabData } from '../../utils/roleUtils';
import axios from 'axios';
import { toast } from 'react-toastify';
import { formatDate } from '../../utils/helpers';
import MeasurementCharts from './MeasurementCharts';

const AnimalMeasurements = ({ animalId, animalInfo }) => {
  const { currentUser } = useAuth();
  const canEdit = canEditLabData(currentUser);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State
  const [measurements, setMeasurements] = useState([]);
  const [measurementTypes, setMeasurementTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMeasurement, setSelectedMeasurement] = useState(null);

  // Form data
  const [formData, setFormData] = useState({
    measurement_type: '',
    value: '',
    unit: '',
    measurement_date: new Date(),
    notes: ''
  });

  // Filters
  const [filters, setFilters] = useState({
    measurement_type: 'all',
    days_back: 30
  });

  useEffect(() => {
    loadData();
  }, [animalId, filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadMeasurements(),
        loadMeasurementTypes()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMeasurements = async () => {
    try {
      const params = {};

      if (filters.measurement_type !== 'all') {
        params.measurement_type = filters.measurement_type;
      }

      if (filters.days_back) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - filters.days_back);
        params.start_date = startDate.toISOString();
      }

      const response = await axios.get(`/api/measurements/animal/${animalId}`, { params });
      setMeasurements(response.data.measurements || []);
    } catch (error) {
      console.error('Error loading measurements:', error);
      toast.error('Failed to load measurements');
    }
  };

  const loadMeasurementTypes = async () => {
    try {
      const response = await axios.get('/api/measurements/types');
      setMeasurementTypes(response.data.measurement_types || []);
    } catch (error) {
      console.error('Error loading measurement types:', error);
    }
  };

  const handleAddMeasurement = () => {
    setFormData({
      measurement_type: '',
      value: '',
      unit: '',
      measurement_date: new Date(),
      notes: ''
    });
    setAddDialogOpen(true);
  };

  const handleEditMeasurement = (measurement) => {
    setSelectedMeasurement(measurement);
    setFormData({
      measurement_type: measurement.measurement_type,
      value: measurement.value || '',
      unit: measurement.unit || '',
      measurement_date: new Date(measurement.measurement_date),
      notes: measurement.notes || ''
    });
    setEditDialogOpen(true);
  };

  const handleSubmitMeasurement = async () => {
    try {
      if (!formData.measurement_type) {
        toast.error('Please select a measurement type');
        return;
      }

      const measurementData = {
        animal_id: animalId,
        measurement_type: formData.measurement_type,
        value: formData.value ? parseFloat(formData.value) : null,
        unit: formData.unit,
        measurement_date: formData.measurement_date.toISOString(),
        notes: formData.notes
      };

      if (selectedMeasurement) {
        // Update existing measurement
        await axios.put(`/api/measurements/${selectedMeasurement.id}`, {
          value: measurementData.value,
          unit: measurementData.unit,
          notes: measurementData.notes
        });
        toast.success('Measurement updated successfully');
        setEditDialogOpen(false);
      } else {
        // Add new measurement
        await axios.post('/api/measurements', measurementData);
        toast.success('Measurement recorded successfully');
        setAddDialogOpen(false);
      }

      loadMeasurements();
      setSelectedMeasurement(null);

    } catch (error) {
      console.error('Error saving measurement:', error);
      toast.error(error.response?.data?.message || 'Failed to save measurement');
    }
  };

  const handleDeleteMeasurement = async (measurementId) => {
    if (window.confirm('Are you sure you want to delete this measurement?')) {
      try {
        await axios.delete(`/api/measurements/${measurementId}`);
        toast.success('Measurement deleted successfully');
        loadMeasurements();
      } catch (error) {
        console.error('Error deleting measurement:', error);
        toast.error('Failed to delete measurement');
      }
    }
  };

  const getMeasurementTypeInfo = (typeName) => {
    return measurementTypes.find(type => type.name === typeName) || {};
  };

  const formatMeasurementValue = (measurement) => {
    if (measurement.value === null || measurement.value === undefined) {
      return 'N/A';
    }

    const unit = measurement.unit || getMeasurementTypeInfo(measurement.measurement_type).default_unit || '';
    return `${measurement.value} ${unit}`.trim();
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'vitals': return 'primary';
      case 'research': return 'secondary';
      case 'laboratory': return 'success';
      case 'behavioral': return 'warning';
      default: return 'default';
    }
  };

  const groupedMeasurements = measurements.reduce((acc, measurement) => {
    const type = measurement.measurement_type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(measurement);
    return acc;
  }, {});

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" gutterBottom>
            Animal Measurements
          </Typography>
          {animalInfo && (
            <Typography variant="body2" color="text.secondary">
              {animalInfo.species} #{animalInfo.animal_number} - {animalInfo.strain}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
            disabled={loading}
          >
            Refresh
          </Button>
          {canEdit && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddMeasurement}
            >
              Add Measurement
            </Button>
          )}
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Measurement Type</InputLabel>
              <Select
                value={filters.measurement_type}
                onChange={(e) => setFilters({ ...filters, measurement_type: e.target.value })}
              >
                <MenuItem value="all">All Types</MenuItem>
                {measurementTypes.map((type) => (
                  <MenuItem key={type.name} value={type.name}>
                    {type.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Time Period</InputLabel>
              <Select
                value={filters.days_back}
                onChange={(e) => setFilters({ ...filters, days_back: e.target.value })}
              >
                <MenuItem value={7}>Last Week</MenuItem>
                <MenuItem value={30}>Last Month</MenuItem>
                <MenuItem value={90}>Last 3 Months</MenuItem>
                <MenuItem value={365}>Last Year</MenuItem>
                <MenuItem value={null}>All Time</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
        <Tab label="Table View" icon={<TimelineIcon />} />
        <Tab label="By Type" icon={<TrendingUpIcon />} />
        <Tab label="Charts" icon={<ShowChartIcon />} />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {tabValue === 0 && (
            // Table view
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell>Measured By</TableCell>
                    {canEdit && <TableCell align="center">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {measurements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 6 : 5} align="center">
                        <Typography color="text.secondary">
                          No measurements found for the selected criteria
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    measurements.map((measurement) => (
                      <TableRow key={measurement.id}>
                        <TableCell>
                          {formatDate(measurement.measurement_date)}
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2">
                              {measurement.measurement_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Typography>
                            {measurement.category && (
                              <Chip
                                label={measurement.category}
                                size="small"
                                color={getCategoryColor(measurement.category)}
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {formatMeasurementValue(measurement)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {measurement.notes || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {measurement.measured_by_name || 'Unknown'}
                          </Typography>
                        </TableCell>
                        {canEdit && (
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              onClick={() => handleEditMeasurement(measurement)}
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteMeasurement(measurement.id)}
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {tabValue === 1 && (
            // Grouped by type view
            <Grid container spacing={2}>
              {Object.keys(groupedMeasurements).length === 0 ? (
                <Grid item xs={12}>
                  <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                      No measurements found for the selected criteria
                    </Typography>
                  </Paper>
                </Grid>
              ) : (
                Object.entries(groupedMeasurements).map(([type, typeMeasurements]) => {
                  const typeInfo = getMeasurementTypeInfo(type);
                  return (
                    <Grid item xs={12} md={6} lg={4} key={type}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Typography>
                          {typeInfo.category && (
                            <Chip
                              label={typeInfo.category}
                              size="small"
                              color={getCategoryColor(typeInfo.category)}
                              sx={{ mb: 2 }}
                            />
                          )}
                          <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                            {typeMeasurements.slice(0, 5).map((measurement) => (
                              <Box key={measurement.id} sx={{ mb: 1, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="body2" fontWeight="medium">
                                  {formatMeasurementValue(measurement)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatDate(measurement.measurement_date)}
                                </Typography>
                              </Box>
                            ))}
                            {typeMeasurements.length > 5 && (
                              <Typography variant="caption" color="text.secondary">
                                +{typeMeasurements.length - 5} more measurements
                              </Typography>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })
              )}
            </Grid>
          )}

          {tabValue === 2 && (
            // Charts view
            <MeasurementCharts animalId={animalId} animalInfo={animalInfo} />
          )}
        </>
      )}

      {/* Add/Edit Measurement Dialog */}
      <Dialog
        open={addDialogOpen || editDialogOpen}
        onClose={() => {
          setAddDialogOpen(false);
          setEditDialogOpen(false);
          setSelectedMeasurement(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {selectedMeasurement ? 'Edit Measurement' : 'Add New Measurement'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Measurement Type *</InputLabel>
                <Select
                  value={formData.measurement_type}
                  onChange={(e) => {
                    const selectedType = measurementTypes.find(type => type.name === e.target.value);
                    setFormData({
                      ...formData,
                      measurement_type: e.target.value,
                      unit: selectedType?.default_unit || formData.unit
                    });
                  }}
                  disabled={!!selectedMeasurement} // Can't change type when editing
                >
                  {measurementTypes.map((type) => (
                    <MenuItem key={type.name} value={type.name}>
                      {type.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      {type.description && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          - {type.description}
                        </Typography>
                      )}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={8}>
              <TextField
                fullWidth
                label="Value"
                type="number"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="Enter measurement value"
              />
            </Grid>

            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Unit"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="g, mm, etc."
              />
            </Grid>

            <Grid item xs={12}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DateTimePicker
                  label="Measurement Date & Time"
                  value={formData.measurement_date}
                  onChange={(newValue) => setFormData({ ...formData, measurement_date: newValue })}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                  disabled={!!selectedMeasurement} // Can't change date when editing
                />
              </LocalizationProvider>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes about this measurement..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setAddDialogOpen(false);
              setEditDialogOpen(false);
              setSelectedMeasurement(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmitMeasurement}
            variant="contained"
          >
            {selectedMeasurement ? 'Update' : 'Add'} Measurement
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AnimalMeasurements;