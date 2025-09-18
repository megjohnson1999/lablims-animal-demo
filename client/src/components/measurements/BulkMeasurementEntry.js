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
  const [measurementDate, setMeasurementDate] = useState(new Date());
  const [selectedStudy, setSelectedStudy] = useState('');
  const [selectedMeasurementTypes, setSelectedMeasurementTypes] = useState(['weight', 'body_condition_score']);
  const [animals, setAnimals] = useState([]);
  const [studies, setStudies] = useState([]);
  const [measurementTypes, setMeasurementTypes] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Dialogs
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  // Search and filters
  const [animalSearch, setAnimalSearch] = useState('');
  const [filteredAnimals, setFilteredAnimals] = useState([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    filterAnimals();
  }, [animals, animalSearch, selectedStudy]);

  useEffect(() => {
    initializeMeasurements();
  }, [filteredAnimals, selectedMeasurementTypes]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [animalsRes, studiesRes, typesRes] = await Promise.all([
        axios.get('/api/animals?limit=500'), // Get more animals for selection
        axios.get('/api/studies'),
        axios.get('/api/measurements/types')
      ]);

      setAnimals(animalsRes.data.animals || []);
      setStudies(studiesRes.data.studies || []);
      setMeasurementTypes(typesRes.data.measurement_types || []);

    } catch (error) {
      console.error('Error loading data:', error);
      if (error.response?.status === 404 || error.message.includes('measurements')) {
        // Measurement tables don't exist yet - migration not applied
        setLoading(false);
        return;
      }
      toast.error('Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const filterAnimals = useCallback(() => {
    let filtered = animals;

    // Filter by study if selected
    if (selectedStudy) {
      filtered = filtered.filter(animal =>
        animal.study_assignments?.some(assignment => assignment.study_id === selectedStudy)
      );
    }

    // Filter by search term
    if (animalSearch) {
      const search = animalSearch.toLowerCase();
      filtered = filtered.filter(animal =>
        animal.animal_number?.toString().includes(search) ||
        animal.strain?.toLowerCase().includes(search) ||
        animal.genotype?.toLowerCase().includes(search)
      );
    }

    // Sort by animal number
    filtered.sort((a, b) => {
      const numA = parseInt(a.animal_number) || 0;
      const numB = parseInt(b.animal_number) || 0;
      return numA - numB;
    });

    setFilteredAnimals(filtered.slice(0, 50)); // Limit to 50 animals for performance
  }, [animals, animalSearch, selectedStudy]);

  const initializeMeasurements = useCallback(() => {
    const newMeasurements = filteredAnimals.map(animal => {
      const measurement = {
        animal_id: animal.id,
        animal_number: animal.animal_number,
        animal_strain: animal.strain,
        animal_sex: animal.sex,
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
  }, [filteredAnimals, selectedMeasurementTypes]);

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

  const addAllAnimalsFromStudy = () => {
    if (!selectedStudy) {
      toast.error('Please select a study first');
      return;
    }

    setAnimalSearch(''); // Clear search to show all animals from study
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

  return (
    <Box>
      {/* Header */}
      <Typography variant="h4" gutterBottom>
        Bulk Measurement Entry
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Enter measurements for multiple animals at once. Perfect for daily data collection from lab notebooks.
      </Typography>

      {/* Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardHeader title="Setup" />
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
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

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Study (Optional)</InputLabel>
                <Select
                  value={selectedStudy}
                  onChange={(e) => setSelectedStudy(e.target.value)}
                >
                  <MenuItem value="">All Animals</MenuItem>
                  {studies.map((study) => (
                    <MenuItem key={study.id} value={study.id}>
                      {study.study_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
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

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                label="Search Animals"
                value={animalSearch}
                onChange={(e) => setAnimalSearch(e.target.value)}
                placeholder="Animal #, strain..."
              />
            </Grid>
          </Grid>

          {selectedStudy && (
            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                onClick={addAllAnimalsFromStudy}
                startIcon={<RefreshIcon />}
              >
                Show All Animals from Selected Study
              </Button>
            </Box>
          )}
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
                  onClick={clearAllData}
                  size="small"
                >
                  Clear All
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
          {filteredAnimals.length === 0 ?
            'No animals found. Try adjusting your search criteria or selecting a different study.' :
            'Configure the measurement types above to begin data entry.'
          }
        </Alert>
      )}

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