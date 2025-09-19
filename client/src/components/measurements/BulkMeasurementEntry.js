import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Autocomplete,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Clear as ClearIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAuth } from '../../context/AuthContext';
import { canEditLabData } from '../../utils/roleUtils';
import axios from 'axios';
import { toast } from 'react-toastify';

const BulkMeasurementEntry = () => {
  const { currentUser } = useAuth();
  const canEdit = canEditLabData(currentUser);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State
  const [step, setStep] = useState('study-selection'); // 'study-selection', 'animal-selection', 'measurement-entry'
  const [measurementDate, setMeasurementDate] = useState(new Date());
  const [selectedStudy, setSelectedStudy] = useState('');
  const [selectedStudyData, setSelectedStudyData] = useState(null);
  const [selectedMeasurementTypes, setSelectedMeasurementTypes] = useState(['weight', 'body_condition_score']);
  const [selectedAnimals, setSelectedAnimals] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [studies, setStudies] = useState([]);
  const [measurementTypes, setMeasurementTypes] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Dialogs
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  // Search and filters
  const [animalSearch, setAnimalSearch] = useState('');
  const [animalSelection, setAnimalSelection] = useState('recent'); // 'recent', 'all', 'custom'

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedStudy && step === 'animal-selection') {
      loadStudyData();
    }
  }, [selectedStudy, step]);

  useEffect(() => {
    if (selectedAnimals.length > 0 && step === 'measurement-entry') {
      initializeMeasurements();
    }
  }, [selectedAnimals, selectedMeasurementTypes, step]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [studiesRes, typesRes] = await Promise.all([
        axios.get('/api/studies'),
        axios.get('/api/measurements/types')
      ]);

      setStudies(studiesRes.data.studies || []);
      setMeasurementTypes(typesRes.data.measurement_types || []);

    } catch (error) {
      console.error('Error loading data:', error);
      if (error.response?.status === 404 || error.message.includes('measurements')) {
        setLoading(false);
        return;
      }
      toast.error('Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const loadStudyData = async () => {
    try {
      setLoading(true);
      const [sessionsRes, animalsRes] = await Promise.all([
        axios.get(`/api/measurements/sessions/${selectedStudy}`),
        axios.get(`/api/measurements/study/${selectedStudy}/animals-with-history`)
      ]);

      setRecentSessions(sessionsRes.data.sessions || []);
      setAnimals(animalsRes.data.animals || []);

      // Find the selected study details
      const studyData = studies.find(s => s.id === selectedStudy);
      setSelectedStudyData(studyData);

    } catch (error) {
      console.error('Error loading study data:', error);
      toast.error('Failed to load study data');
    } finally {
      setLoading(false);
    }
  };

  const continueFromSession = async (session) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/measurements/sessions/${selectedStudy}/${session.measurement_date}/animals`);
      const sessionAnimals = response.data.animals || [];

      setSelectedAnimals(sessionAnimals);
      setSelectedMeasurementTypes(session.measurement_types || ['weight']);
      setStep('measurement-entry');

      toast.success(`Loaded ${sessionAnimals.length} animals from ${new Date(session.measurement_date).toLocaleDateString()}`);
    } catch (error) {
      console.error('Error loading session animals:', error);
      toast.error('Failed to load session animals');
    } finally {
      setLoading(false);
    }
  };

  const selectStudy = (studyId) => {
    setSelectedStudy(studyId);
    setStep('animal-selection');
  };

  const selectAnimalsAndContinue = () => {
    let animalsToSelect = [];

    if (animalSelection === 'recent') {
      animalsToSelect = animals.filter(a => a.measurement_recency === 'recent' || a.measurement_recency === 'week');
    } else if (animalSelection === 'all') {
      animalsToSelect = animals;
    } else if (animalSelection === 'unmeasured') {
      animalsToSelect = animals.filter(a => a.measurement_recency === 'unmeasured');
    } else if (animalSelection === 'by_strain') {
      // Get unique strains and auto-select all animals from first strain
      const strains = [...new Set(animals.map(a => a.strain).filter(Boolean))];
      if (strains.length > 0) {
        animalsToSelect = animals.filter(a => a.strain === strains[0]);
      }
    } else {
      // Custom selection - use currently selected animals
      animalsToSelect = selectedAnimals;
    }

    if (animalSearch) {
      const search = animalSearch.toLowerCase();
      animalsToSelect = animalsToSelect.filter(animal =>
        animal.animal_number?.toString().includes(search) ||
        animal.strain?.toLowerCase().includes(search) ||
        animal.genotype?.toLowerCase().includes(search)
      );
    }

    setSelectedAnimals(animalsToSelect.slice(0, 50)); // Limit to 50 for performance
    setStep('measurement-entry');
  };

  // Auto-select animals when selection type changes (except for custom)
  useEffect(() => {
    if (animalSelection !== 'custom' && animals.length > 0) {
      let autoSelected = [];

      if (animalSelection === 'recent') {
        autoSelected = animals.filter(a => a.measurement_recency === 'recent' || a.measurement_recency === 'week');
      } else if (animalSelection === 'all') {
        autoSelected = animals;
      } else if (animalSelection === 'unmeasured') {
        autoSelected = animals.filter(a => a.measurement_recency === 'unmeasured');
      } else if (animalSelection === 'by_strain') {
        const strains = [...new Set(animals.map(a => a.strain).filter(Boolean))];
        if (strains.length > 0) {
          autoSelected = animals.filter(a => a.strain === strains[0]);
        }
      }

      setSelectedAnimals(autoSelected.slice(0, 50));
    }
  }, [animalSelection, animals]);

  const goBackToStudySelection = () => {
    setStep('study-selection');
    setSelectedStudy('');
    setSelectedStudyData(null);
    setSelectedAnimals([]);
    setRecentSessions([]);
  };

  const goBackToAnimalSelection = () => {
    setStep('animal-selection');
    setSelectedAnimals([]);
  };

  const initializeMeasurements = useCallback(() => {
    const newMeasurements = selectedAnimals.map(animal => {
      const measurement = {
        animal_id: animal.id,
        animal_number: animal.animal_number,
        animal_strain: animal.strain,
        animal_sex: animal.sex,
        last_measurement_date: animal.last_measurement_date,
        days_since_measurement: animal.days_since_measurement,
        values: {},
        notes: ''
      };

      // Initialize empty values for selected measurement types
      selectedMeasurementTypes.forEach(type => {
        measurement.values[type] = '';
      });

      return measurement;
    });

    setMeasurements(newMeasurements);
    setErrors({});
  }, [selectedAnimals, selectedMeasurementTypes]);

  const handleMeasurementChange = (animalIndex, measurementType, value) => {
    const newMeasurements = [...measurements];
    newMeasurements[animalIndex].values[measurementType] = value;
    setMeasurements(newMeasurements);

    // Clear any existing error for this field
    const errorKey = `${animalIndex}-${measurementType}`;
    if (errors[errorKey]) {
      const newErrors = { ...errors };
      delete newErrors[errorKey];
      setErrors(newErrors);
    }
  };

  const handleNotesChange = (animalIndex, notes) => {
    const newMeasurements = [...measurements];
    newMeasurements[animalIndex].notes = notes;
    setMeasurements(newMeasurements);
  };

  const getMeasurementTypeInfo = (typeName) => {
    return measurementTypes.find(type => type.name === typeName) || {};
  };

  const validateMeasurements = () => {
    const newErrors = {};
    let hasData = false;

    measurements.forEach((measurement, index) => {
      selectedMeasurementTypes.forEach(type => {
        const value = measurement.values[type];
        const typeInfo = getMeasurementTypeInfo(type);

        // Check if there's any data in this row
        if (value && value.toString().trim() !== '') {
          hasData = true;

          // Validate numeric values
          if (typeInfo.category !== 'behavioral' && isNaN(parseFloat(value))) {
            newErrors[`${index}-${type}`] = 'Must be a number';
          }
        }
      });
    });

    setErrors(newErrors);

    if (!hasData) {
      toast.error('Please enter at least one measurement');
      return false;
    }

    if (Object.keys(newErrors).length > 0) {
      toast.error('Please fix validation errors before saving');
      return false;
    }

    return true;
  };

  const prepareBulkData = () => {
    const bulkData = [];

    measurements.forEach(measurement => {
      selectedMeasurementTypes.forEach(type => {
        const value = measurement.values[type];

        if (value && value.toString().trim() !== '') {
          const typeInfo = getMeasurementTypeInfo(type);

          bulkData.push({
            animal_id: measurement.animal_id,
            measurement_type: type,
            value: typeInfo.category === 'behavioral' ? value : parseFloat(value),
            unit: typeInfo.default_unit || '',
            measurement_date: measurementDate.toISOString(),
            notes: measurement.notes || null,
            study_id: selectedStudy || null
          });
        }
      });
    });

    return bulkData;
  };

  const handleSave = () => {
    if (!canEdit) {
      toast.error('You do not have permission to add measurements');
      return;
    }

    if (!validateMeasurements()) {
      return;
    }

    setConfirmDialogOpen(true);
  };

  const confirmSave = async () => {
    try {
      setSaving(true);
      setConfirmDialogOpen(false);

      const bulkData = prepareBulkData();

      if (bulkData.length === 0) {
        toast.error('No valid measurements to save');
        return;
      }

      const response = await axios.post('/api/measurements/bulk', {
        measurements: bulkData
      });

      setSavedCount(bulkData.length);
      setSuccessDialogOpen(true);

      // Clear the form
      initializeMeasurements();

      toast.success(`Successfully saved ${bulkData.length} measurements!`);

    } catch (error) {
      console.error('Error saving measurements:', error);
      toast.error(error.response?.data?.message || 'Failed to save measurements');
    } finally {
      setSaving(false);
    }
  };

  const clearAllData = () => {
    if (window.confirm('Are you sure you want to clear all entered data?')) {
      initializeMeasurements();
      toast.info('Data cleared');
    }
  };

  const copyPreviousValue = (animalIndex, measurementType) => {
    if (animalIndex === 0) return; // No previous row

    const previousValue = measurements[animalIndex - 1].values[measurementType];
    if (previousValue) {
      handleMeasurementChange(animalIndex, measurementType, previousValue);
      toast.info('Value copied from previous row');
    }
  };

  const toggleAnimalSelection = (animal) => {
    const isSelected = selectedAnimals.some(a => a.id === animal.id);
    if (isSelected) {
      setSelectedAnimals(selectedAnimals.filter(a => a.id !== animal.id));
    } else {
      setSelectedAnimals([...selectedAnimals, animal]);
    }
  };

  const selectAllAnimals = () => {
    setSelectedAnimals(animals.slice(0, 50));
  };

  const clearAnimalSelection = () => {
    setSelectedAnimals([]);
  };

  const selectByStrain = (strain) => {
    const strainAnimals = animals.filter(a => a.strain === strain);
    setSelectedAnimals(strainAnimals.slice(0, 50));
  };

  const selectByRecency = (recency) => {
    const recencyAnimals = animals.filter(a => a.measurement_recency === recency);
    setSelectedAnimals(recencyAnimals.slice(0, 50));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!canEdit) {
    return (
      <Alert severity="error">
        You do not have permission to add measurements. Please contact your system administrator.
      </Alert>
    );
  }

  if (measurementTypes.length === 0 && !loading) {
    return (
      <Alert severity="info">
        <Typography variant="h6" gutterBottom>
          Measurement System Not Available
        </Typography>
        <Typography variant="body2">
          The bulk measurement entry system is not yet configured for this installation.
          Please contact your system administrator to apply the measurement system migration.
        </Typography>
      </Alert>
    );
  }

  // Study Selection Screen
  const renderStudySelection = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        Select Study for Measurement Entry
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Choose the study you want to record measurements for. This will show you recent measurement sessions and available animals.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader title="Available Studies" />
            <CardContent>
              {studies.length === 0 ? (
                <Alert severity="info">No studies found. Please create a study first.</Alert>
              ) : (
                <Grid container spacing={2}>
                  {studies.map((study) => (
                    <Grid item xs={12} sm={6} md={4} key={study.id}>
                      <Card
                        variant="outlined"
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { boxShadow: 3 },
                          transition: 'box-shadow 0.2s'
                        }}
                        onClick={() => selectStudy(study.id)}
                      >
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {study.study_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Protocol: {study.protocol_number || 'N/A'}
                          </Typography>
                          <Typography variant="caption" display="block">
                            Principal Investigator: {study.principal_investigator || 'N/A'}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  // Animal Selection Screen
  const renderAnimalSelection = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        Select Animals - {selectedStudyData?.study_name}
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Choose which animals to measure. You can continue from a previous session or select animals manually.
      </Typography>

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardHeader title="Recent Measurement Sessions" />
          <CardContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Continue from a previous measurement session:
            </Typography>
            <Grid container spacing={2}>
              {recentSessions.map((session, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Card
                    variant="outlined"
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { boxShadow: 2 }
                    }}
                    onClick={() => continueFromSession(session)}
                  >
                    <CardContent>
                      <Typography variant="h6">
                        {new Date(session.measurement_date).toLocaleDateString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {session.animal_count} animals
                      </Typography>
                      <Typography variant="caption" display="block">
                        Types: {session.measurement_types.join(', ')}
                      </Typography>
                      <Typography variant="caption" display="block">
                        By: {session.measurers}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Animal Selection Options */}
      <Card sx={{ mb: 3 }}>
        <CardHeader title="Select Animals for Measurement" />
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Selection Type</InputLabel>
                <Select
                  value={animalSelection}
                  onChange={(e) => setAnimalSelection(e.target.value)}
                >
                  <MenuItem value="recent">Recently Measured (Auto-select)</MenuItem>
                  <MenuItem value="all">All Study Animals (Auto-select)</MenuItem>
                  <MenuItem value="unmeasured">Never Measured (Auto-select)</MenuItem>
                  <MenuItem value="by_strain">By Strain (Auto-select)</MenuItem>
                  <MenuItem value="custom">Manual Selection</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Search Animals"
                value={animalSearch}
                onChange={(e) => setAnimalSearch(e.target.value)}
                placeholder="Animal #, strain..."
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                {animalSelection === 'custom' && (
                  <>
                    <Button variant="outlined" onClick={selectAllAnimals} size="small">
                      Select All
                    </Button>
                    <Button variant="outlined" onClick={clearAnimalSelection} size="small">
                      Clear All
                    </Button>
                  </>
                )}
                <Chip
                  label={`${selectedAnimals.length} animals selected`}
                  color={selectedAnimals.length > 0 ? 'primary' : 'default'}
                  variant="outlined"
                />
                <Button
                  variant="contained"
                  onClick={selectAnimalsAndContinue}
                  disabled={selectedAnimals.length === 0}
                  size="large"
                >
                  Continue with {selectedAnimals.length} Animals →
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Quick Selection Actions */}
      {animals.length > 0 && animalSelection === 'custom' && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Quick Selection Actions:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {/* Recency-based quick selections */}
              <Button
                size="small"
                variant="outlined"
                onClick={() => selectByRecency('recent')}
                color="success"
              >
                Recently Measured ({animals.filter(a => a.measurement_recency === 'recent').length})
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => selectByRecency('week')}
                color="warning"
              >
                This Week ({animals.filter(a => a.measurement_recency === 'week').length})
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => selectByRecency('unmeasured')}
              >
                Never Measured ({animals.filter(a => a.measurement_recency === 'unmeasured').length})
              </Button>
            </Box>

            {/* Strain-based quick selections */}
            {(() => {
              const strains = [...new Set(animals.map(a => a.strain).filter(Boolean))];
              if (strains.length > 1) {
                return (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="caption" sx={{ alignSelf: 'center', mr: 1 }}>
                      By Strain:
                    </Typography>
                    {strains.slice(0, 5).map(strain => (
                      <Button
                        key={strain}
                        size="small"
                        variant="outlined"
                        onClick={() => selectByStrain(strain)}
                      >
                        {strain} ({animals.filter(a => a.strain === strain).length})
                      </Button>
                    ))}
                  </Box>
                );
              }
              return null;
            })()}
          </CardContent>
        </Card>
      )}

      {/* Animal List */}
      {animals.length > 0 && (
        <Card>
          <CardHeader
            title={`Available Animals (${animals.length})`}
            subheader={animalSelection !== 'custom' ?
              `Auto-selected ${selectedAnimals.length} animals based on "${animalSelection}" criteria` :
              `${selectedAnimals.length} manually selected`
            }
          />
          <CardContent>
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">Select</TableCell>
                    <TableCell>Animal #</TableCell>
                    <TableCell>Strain</TableCell>
                    <TableCell>Sex</TableCell>
                    <TableCell>Last Measured</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {animals
                    .filter(animal => {
                      if (!animalSearch) return true;
                      const search = animalSearch.toLowerCase();
                      return animal.animal_number?.toString().includes(search) ||
                             animal.strain?.toLowerCase().includes(search) ||
                             animal.genotype?.toLowerCase().includes(search);
                    })
                    .map((animal) => {
                      const isSelected = selectedAnimals.some(a => a.id === animal.id);
                      return (
                        <TableRow
                          key={animal.id}
                          hover
                          selected={isSelected}
                          onClick={() => animalSelection === 'custom' && toggleAnimalSelection(animal)}
                          sx={{ cursor: animalSelection === 'custom' ? 'pointer' : 'default' }}
                        >
                          <TableCell padding="checkbox">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleAnimalSelection(animal)}
                            />
                          </TableCell>
                          <TableCell>#{animal.animal_number}</TableCell>
                          <TableCell>{animal.strain || '-'}</TableCell>
                          <TableCell>
                            <Chip
                              label={animal.sex || '?'}
                              size="small"
                              color={animal.sex === 'M' ? 'primary' : 'secondary'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            {animal.last_measurement_date ? (
                              `${animal.days_since_measurement} days ago`
                            ) : (
                              'Never'
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={animal.measurement_recency === 'recent' ? 'Recent' :
                                     animal.measurement_recency === 'week' ? 'This Week' :
                                     animal.measurement_recency === 'old' ? 'Old' : 'Unmeasured'}
                              size="small"
                              color={animal.measurement_recency === 'recent' ? 'success' :
                                     animal.measurement_recency === 'week' ? 'warning' : 'default'}
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      <Box sx={{ mt: 2 }}>
        <Button onClick={goBackToStudySelection} startIcon={<ClearIcon />}>
          Back to Study Selection
        </Button>
      </Box>
    </Box>
  );

  // Measurement Entry Screen
  const renderMeasurementEntry = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        Measurement Entry - {selectedStudyData?.study_name}
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Recording measurements for {selectedAnimals.length} animals. Enter data and click Save when complete.
      </Typography>

      {/* Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardHeader title="Measurement Settings" />
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={4}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Measurement Date *"
                  value={measurementDate}
                  onChange={setMeasurementDate}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                  maxDate={new Date()}
                />
              </LocalizationProvider>
            </Grid>

            <Grid item xs={12} sm={6} md={8}>
              <Autocomplete
                multiple
                options={measurementTypes.map(type => type.name)}
                value={selectedMeasurementTypes}
                onChange={(event, newValue) => setSelectedMeasurementTypes(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Measurement Types *"
                    placeholder="Select measurement types"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option.replace(/_/g, ' ')}
                      {...getTagProps({ index })}
                      key={option}
                    />
                  ))
                }
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Instructions */}
      {measurements.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Tips:</strong> Leave cells empty for measurements not taken.
            Use the copy button (📋) to copy values from the row above.
            Click Save when all data is entered.
          </Typography>
        </Alert>
      )}

      {/* Measurements Table */}
      {measurements.length > 0 ? (
        <Card>
          <CardHeader
            title={`Measurement Entry (${measurements.length} animals)`}
            action={
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<ClearIcon />}
                  onClick={goBackToAnimalSelection}
                  size="small"
                >
                  Change Animals
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ClearIcon />}
                  onClick={clearAllData}
                  size="small"
                >
                  Clear Data
                </Button>
                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                  onClick={handleSave}
                  disabled={saving || measurements.length === 0}
                >
                  {saving ? 'Saving...' : 'Save All'}
                </Button>
              </Box>
            }
          />
          <CardContent sx={{ p: 0 }}>
            <TableContainer sx={{ maxHeight: 600, overflow: 'auto' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 80, position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 3 }}>
                      Animal #
                    </TableCell>
                    <TableCell sx={{ minWidth: 100 }}>Strain</TableCell>
                    <TableCell sx={{ minWidth: 60 }}>Sex</TableCell>
                    <TableCell sx={{ minWidth: 100 }}>Last Measured</TableCell>
                    {selectedMeasurementTypes.map((type) => {
                      const typeInfo = getMeasurementTypeInfo(type);
                      return (
                        <TableCell key={type} sx={{ minWidth: 120 }}>
                          <Box>
                            <Typography variant="caption" fontWeight="medium">
                              {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Typography>
                            {typeInfo.default_unit && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                ({typeInfo.default_unit})
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                      );
                    })}
                    <TableCell sx={{ minWidth: 200 }}>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {measurements.map((measurement, index) => (
                    <TableRow key={measurement.animal_id} hover>
                      <TableCell sx={{ position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 2 }}>
                        <Typography variant="body2" fontWeight="medium">
                          #{measurement.animal_number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {measurement.animal_strain || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={measurement.animal_sex || '?'}
                          size="small"
                          color={measurement.animal_sex === 'M' ? 'primary' : 'secondary'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {measurement.last_measurement_date ? (
                            `${measurement.days_since_measurement} days ago`
                          ) : (
                            'Never'
                          )}
                        </Typography>
                      </TableCell>
                      {selectedMeasurementTypes.map((type) => {
                        const errorKey = `${index}-${type}`;
                        const hasError = errors[errorKey];
                        return (
                          <TableCell key={type}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <TextField
                                size="small"
                                value={measurement.values[type]}
                                onChange={(e) => handleMeasurementChange(index, type, e.target.value)}
                                error={hasError}
                                helperText={hasError ? errors[errorKey] : ''}
                                sx={{ minWidth: 80 }}
                                placeholder="--"
                              />
                              {index > 0 && (
                                <Tooltip title="Copy from above">
                                  <IconButton
                                    size="small"
                                    onClick={() => copyPreviousValue(index, type)}
                                    sx={{ ml: 0.5 }}
                                  >
                                    <CopyIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                        );
                      })}
                      <TableCell>
                        <TextField
                          size="small"
                          multiline
                          rows={1}
                          value={measurement.notes}
                          onChange={(e) => handleNotesChange(index, e.target.value)}
                          placeholder="Optional notes..."
                          sx={{ minWidth: 150 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      ) : (
        <Alert severity="info">
          Configure the measurement types above to begin data entry.
        </Alert>
      )}

      <Box sx={{ mt: 2 }}>
        <Button onClick={goBackToAnimalSelection} startIcon={<ClearIcon />}>
          Back to Animal Selection
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box>
      {step === 'study-selection' && renderStudySelection()}
      {step === 'animal-selection' && renderAnimalSelection()}
      {step === 'measurement-entry' && renderMeasurementEntry()}

      {/* Confirm Save Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>Confirm Save</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to save these measurements?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will save {prepareBulkData().length} measurements for {measurements.filter(m =>
              selectedMeasurementTypes.some(type => m.values[type]?.toString().trim())
            ).length} animals on {measurementDate.toLocaleDateString()}.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={confirmSave} variant="contained">
            Save Measurements
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={successDialogOpen} onClose={() => setSuccessDialogOpen(false)}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SuccessIcon color="success" />
          Measurements Saved Successfully!
        </DialogTitle>
        <DialogContent>
          <Typography>
            Successfully saved {savedCount} measurements.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            The data has been added to the animal records and is immediately available for analysis and visualization.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuccessDialogOpen(false)} variant="contained">
            Continue
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BulkMeasurementEntry;