import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  MenuItem,
  Alert,
  Box,
  FormControl,
  InputLabel,
  Select,
  Chip,
  Autocomplete,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import biologicalSamplesAPI from '../../services/biologicalSamplesAPI';
import { animalAPI, experimentalStudiesAPI } from '../../services/api';

const sampleTypes = [
  'blood', 'serum', 'plasma', 'urine', 'feces', 'saliva',
  'liver', 'brain', 'heart', 'lung', 'kidney', 'muscle',
  'bone', 'skin', 'tumor', 'other_tissue'
];

const anatomicalSites = [
  'head', 'neck', 'thorax', 'abdomen', 'pelvis', 'limbs',
  'tail', 'liver', 'brain', 'heart', 'lungs', 'kidneys',
  'spleen', 'pancreas', 'stomach', 'intestines', 'muscle',
  'bone', 'skin', 'other'
];

const collectionMethods = [
  'venipuncture', 'cardiac_puncture', 'tail_vein', 'surgical_biopsy',
  'necropsy', 'fine_needle_aspirate', 'swab', 'manual_collection',
  'other'
];

const preservationMethods = [
  'fresh', 'frozen_-20', 'frozen_-80', 'formalin_fixed',
  'paraffin_embedded', 'rnalater', 'ethanol', 'other'
];

const storageConditions = [
  'room_temperature', 'refrigerated_4c', 'frozen_-20c',
  'frozen_-80c', 'liquid_nitrogen', 'other'
];

const BiologicalSampleForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isEditMode = Boolean(id);

  const [formData, setFormData] = useState({
    animal_id: '',
    sample_type: '',
    anatomical_site: '',
    collection_method: '',
    preservation_method: '',
    storage_location: '',
    storage_temperature: 'frozen_-80c',
    initial_volume_ml: '',
    initial_weight_mg: '',
    collected_by: currentUser?.username || '',
    collection_date: new Date(),
    notes: '',
    study_id: '',
    treatment_group: '',
    iacuc_protocol: ''
  });

  const [animals, setAnimals] = useState([]);
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load animals and studies for selection
  useEffect(() => {
    const loadData = async () => {
      try {
        const [animalsResponse, studiesResponse] = await Promise.all([
          animalAPI.getAll(),
          experimentalStudiesAPI.getAll()
        ]);
        setAnimals(animalsResponse.data.animals || []);
        setStudies(studiesResponse.data.studies || []);
      } catch (error) {
        console.error('Error loading form data:', error);
        toast.error('Failed to load form data');
      }
    };
    loadData();
  }, []);

  // Load existing sample data if editing
  useEffect(() => {
    if (isEditMode) {
      const loadSample = async () => {
        try {
          setLoading(true);
          const response = await biologicalSamplesAPI.getById(id);
          const sample = response.data;
          setFormData({
            ...sample,
            collection_date: new Date(sample.collection_date)
          });
        } catch (error) {
          console.error('Error loading sample:', error);
          setError('Failed to load sample data');
        } finally {
          setLoading(false);
        }
      };
      loadSample();
    }
  }, [id, isEditMode]);

  const handleInputChange = (field) => (event) => {
    const value = event.target ? event.target.value : event;
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDateChange = (date) => {
    setFormData(prev => ({
      ...prev,
      collection_date: date
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    try {
      setLoading(true);
      setError(null);

      // Validate required fields
      const requiredFields = ['animal_id', 'sample_type'];
      const missingFields = requiredFields.filter(field => !formData[field]);
      
      if (missingFields.length > 0) {
        setError(`Please fill in required fields: ${missingFields.join(', ')}`);
        return;
      }

      const sampleData = {
        ...formData,
        initial_volume_ml: formData.initial_volume_ml ? parseFloat(formData.initial_volume_ml) : null,
        current_volume_ml: formData.initial_volume_ml ? parseFloat(formData.initial_volume_ml) : null,
        initial_weight_mg: formData.initial_weight_mg ? parseFloat(formData.initial_weight_mg) : null,
        current_weight_mg: formData.initial_weight_mg ? parseFloat(formData.initial_weight_mg) : null,
        collection_date: formData.collection_date.toISOString()
      };

      if (isEditMode) {
        await biologicalSamplesAPI.update(id, sampleData);
        toast.success('Biological sample updated successfully');
      } else {
        await biologicalSamplesAPI.create(sampleData);
        toast.success('Biological sample created successfully');
      }

      navigate('/biological-samples');
    } catch (error) {
      console.error('Error saving sample:', error);
      setError(error.response?.data?.message || 'Failed to save sample');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/biological-samples');
  };

  const selectedAnimal = animals.find(animal => animal.id === formData.animal_id);

  if (loading && isEditMode) {
    return (
      <Container>
        <Typography>Loading...</Typography>
      </Container>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper elevation={2} sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom>
            {isEditMode ? 'Edit Biological Sample' : 'Collect New Biological Sample'}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Subject Selection */}
              <Grid item xs={12}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Subject Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth required>
                          <InputLabel>Select Subject</InputLabel>
                          <Select
                            value={formData.animal_id}
                            onChange={handleInputChange('animal_id')}
                            label="Select Subject"
                          >
                            {animals.map((animal) => (
                              <MenuItem key={animal.id} value={animal.id}>
                                {animal.animal_number} - {animal.species} ({animal.strain || 'N/A'})
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      
                      {selectedAnimal && (
                        <Grid item xs={12} md={6}>
                          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="body2">
                              <strong>Species:</strong> {selectedAnimal.species}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Strain:</strong> {selectedAnimal.strain || 'N/A'}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Sex:</strong> {selectedAnimal.sex}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Age:</strong> {selectedAnimal.age_weeks ? `${selectedAnimal.age_weeks} weeks` : 'N/A'}
                            </Typography>
                          </Box>
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Sample Details */}
              <Grid item xs={12}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Sample Details
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth required>
                          <InputLabel>Sample Type</InputLabel>
                          <Select
                            value={formData.sample_type}
                            onChange={handleInputChange('sample_type')}
                            label="Sample Type"
                          >
                            {sampleTypes.map((type) => (
                              <MenuItem key={type} value={type}>
                                {type.replace('_', ' ').toUpperCase()}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth>
                          <InputLabel>Anatomical Site</InputLabel>
                          <Select
                            value={formData.anatomical_site}
                            onChange={handleInputChange('anatomical_site')}
                            label="Anatomical Site"
                          >
                            {anatomicalSites.map((site) => (
                              <MenuItem key={site} value={site}>
                                {site.replace('_', ' ').toUpperCase()}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth>
                          <InputLabel>Collection Method</InputLabel>
                          <Select
                            value={formData.collection_method}
                            onChange={handleInputChange('collection_method')}
                            label="Collection Method"
                          >
                            {collectionMethods.map((method) => (
                              <MenuItem key={method} value={method}>
                                {method.replace('_', ' ').toUpperCase()}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Initial Volume (mL)"
                          type="number"
                          value={formData.initial_volume_ml}
                          onChange={handleInputChange('initial_volume_ml')}
                          InputProps={{ inputProps: { min: 0, step: 0.001 } }}
                        />
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Initial Weight (mg)"
                          type="number"
                          value={formData.initial_weight_mg}
                          onChange={handleInputChange('initial_weight_mg')}
                          InputProps={{ inputProps: { min: 0, step: 0.001 } }}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Collection & Storage */}
              <Grid item xs={12}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Collection & Storage
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <DateTimePicker
                          label="Collection Date & Time"
                          value={formData.collection_date}
                          onChange={handleDateChange}
                          renderInput={(params) => <TextField {...params} fullWidth />}
                        />
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Collected By"
                          value={formData.collected_by}
                          onChange={handleInputChange('collected_by')}
                        />
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth>
                          <InputLabel>Preservation Method</InputLabel>
                          <Select
                            value={formData.preservation_method}
                            onChange={handleInputChange('preservation_method')}
                            label="Preservation Method"
                          >
                            {preservationMethods.map((method) => (
                              <MenuItem key={method} value={method}>
                                {method.replace('_', ' ').toUpperCase()}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          label="Storage Location"
                          value={formData.storage_location}
                          onChange={handleInputChange('storage_location')}
                          placeholder="e.g., Freezer A, Shelf 2, Box 15"
                        />
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth>
                          <InputLabel>Storage Temperature</InputLabel>
                          <Select
                            value={formData.storage_temperature}
                            onChange={handleInputChange('storage_temperature')}
                            label="Storage Temperature"
                          >
                            {storageConditions.map((condition) => (
                              <MenuItem key={condition} value={condition}>
                                {condition.replace('_', ' ').toUpperCase()}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Study Association */}
              <Grid item xs={12}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Study Association
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <FormControl fullWidth>
                          <InputLabel>Associated Study</InputLabel>
                          <Select
                            value={formData.study_id}
                            onChange={handleInputChange('study_id')}
                            label="Associated Study"
                          >
                            <MenuItem value="">
                              <em>None</em>
                            </MenuItem>
                            {studies.map((study) => (
                              <MenuItem key={study.id} value={study.id}>
                                {study.study_name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          label="Treatment Group"
                          value={formData.treatment_group}
                          onChange={handleInputChange('treatment_group')}
                          placeholder="e.g., Control, Treatment A, High Dose"
                        />
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          label="IACUC Protocol"
                          value={formData.iacuc_protocol}
                          onChange={handleInputChange('iacuc_protocol')}
                          placeholder="e.g., IACUC-2024-001"
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Notes */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Notes"
                  value={formData.notes}
                  onChange={handleInputChange('notes')}
                  placeholder="Additional observations, special handling requirements, etc."
                />
              </Grid>

              {/* Action Buttons */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    startIcon={<CancelIcon />}
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<SaveIcon />}
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : (isEditMode ? 'Update Sample' : 'Save Sample')}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Paper>
      </Container>
    </LocalizationProvider>
  );
};

export default BiologicalSampleForm;