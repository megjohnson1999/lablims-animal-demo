import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Autocomplete,
  Divider,
  Chip,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Pets as AnimalIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { animalAPI, housingAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const AnimalForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentUser } = useAuth();
  const isEdit = Boolean(id);

  // Form state
  const [formData, setFormData] = useState({
    species: '',
    strain: '',
    sex: 'Unknown',
    birth_date: '',
    death_date: '',
    source: '',
    genotype: '',
    housing_id: '',
    status: 'active',
    notes: '',
    dam_id: '',
    sire_id: '',
    identification_method: 'ear_tag',
    identification_number: '',
    vendor: '',
    arrival_date: ''
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [speciesSuggestions, setSpeciesSuggestions] = useState([]);
  const [loadingSpecies, setLoadingSpecies] = useState(false);
  const [strainSuggestions, setStrainSuggestions] = useState([]);
  const [loadingStrains, setLoadingStrains] = useState(false);
  const [housingOptions, setHousingOptions] = useState([]);
  const [parentAnimals, setParentAnimals] = useState([]);

  // Options
  const sexOptions = [
    { value: 'M', label: 'Male' },
    { value: 'F', label: 'Female' },
    { value: 'Unknown', label: 'Unknown' }
  ];

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'deceased', label: 'Deceased' },
    { value: 'transferred', label: 'Transferred' },
    { value: 'retired', label: 'Retired' }
  ];

  const identificationMethods = [
    { value: 'ear_tag', label: 'Ear Tag' },
    { value: 'tattoo', label: 'Tattoo' },
    { value: 'microchip', label: 'Microchip' },
    { value: 'toe_clip', label: 'Toe Clip' },
    { value: 'other', label: 'Other' }
  ];

  // Load species suggestions
  const loadSpeciesSuggestions = async (searchTerm = '') => {
    try {
      setLoadingSpecies(true);
      const response = await animalAPI.getSpeciesSuggestions(searchTerm);
      setSpeciesSuggestions(response.data.map(item => item.species));
    } catch (err) {
      console.error('Error loading species suggestions:', err);
    } finally {
      setLoadingSpecies(false);
    }
  };

  // Load strain suggestions based on species
  const loadStrainSuggestions = async (species, searchTerm = '') => {
    if (!species) return;
    try {
      setLoadingStrains(true);
      const response = await animalAPI.getAll(`?species=${encodeURIComponent(species)}&limit=100`);
      const strains = [...new Set(response.data.animals
        .filter(animal => animal.strain && animal.strain.trim())
        .map(animal => animal.strain)
      )];
      if (searchTerm) {
        setStrainSuggestions(strains.filter(strain => 
          strain.toLowerCase().includes(searchTerm.toLowerCase())
        ));
      } else {
        setStrainSuggestions(strains);
      }
    } catch (err) {
      console.error('Error loading strain suggestions:', err);
    } finally {
      setLoadingStrains(false);
    }
  };

  // Load housing options
  const loadHousingOptions = async () => {
    try {
      const response = await housingAPI.getAll();
      setHousingOptions(response.data.filter(housing => 
        housing.current_occupancy < housing.capacity || !housing.capacity
      ));
    } catch (err) {
      console.error('Error loading housing options:', err);
    }
  };

  // Load potential parent animals (same species)
  const loadParentAnimals = async (species) => {
    if (!species) return;
    try {
      const response = await animalAPI.getAll(`?species=${encodeURIComponent(species)}&status=active&limit=200`);
      setParentAnimals(response.data.animals || []);
    } catch (err) {
      console.error('Error loading parent animals:', err);
    }
  };

  // Load animal data for editing
  const loadAnimal = async () => {
    if (!isEdit) return;
    
    try {
      setLoading(true);
      const response = await animalAPI.getById(id);
      const animal = response.data.animal;
      
      setFormData({
        species: animal.species || '',
        strain: animal.strain || '',
        sex: animal.sex || 'Unknown',
        birth_date: animal.birth_date ? animal.birth_date.split('T')[0] : '',
        death_date: animal.death_date ? animal.death_date.split('T')[0] : '',
        source: animal.source || '',
        genotype: animal.genotype || '',
        housing_id: animal.housing_id || '',
        status: animal.status || 'active',
        notes: animal.notes || '',
        dam_id: animal.dam_id || '',
        sire_id: animal.sire_id || '',
        identification_method: animal.identification_method || 'ear_tag',
        identification_number: animal.identification_number || '',
        vendor: animal.vendor || '',
        arrival_date: animal.arrival_date ? animal.arrival_date.split('T')[0] : ''
      });

      if (animal.species) {
        await loadParentAnimals(animal.species);
      }
    } catch (err) {
      console.error('Error loading animal:', err);
      setError('Failed to load animal data');
    } finally {
      setLoading(false);
    }
  };

  // Initialize data on component mount
  useEffect(() => {
    loadAnimal();
    loadHousingOptions();
    loadSpeciesSuggestions();
  }, [id]);

  // Load parent animals when species changes
  useEffect(() => {
    if (formData.species) {
      loadParentAnimals(formData.species);
      loadStrainSuggestions(formData.species);
    }
  }, [formData.species]);

  // Handle form input changes
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setError('');

      // Prepare data for submission
      const submitData = {
        ...formData,
        birth_date: formData.birth_date || null,
        death_date: formData.death_date || null,
        arrival_date: formData.arrival_date || null,
        housing_id: formData.housing_id || null,
        dam_id: formData.dam_id || null,
        sire_id: formData.sire_id || null
      };

      if (isEdit) {
        await animalAPI.update(id, submitData);
      } else {
        await animalAPI.create(submitData);
      }

      navigate('/animals');
    } catch (err) {
      console.error('Error saving animal:', err);
      setError(err.response?.data?.message || 'Failed to save animal');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const canEdit = currentUser && ['admin', 'facility_manager', 'technician'].includes(currentUser.role);

  if (!canEdit) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        You do not have permission to {isEdit ? 'edit' : 'create'} animals.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <AnimalIcon color="primary" />
        <Typography variant="h4" component="h1">
          {isEdit ? 'Edit Animal' : 'Add New Animal'}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Basic Information Card */}
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Basic Information" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Autocomplete
                      freeSolo
                      options={speciesSuggestions}
                      value={formData.species}
                      onInputChange={(event, newValue) => {
                        handleChange('species', newValue || '');
                        if (newValue && newValue.length > 0) {
                          loadSpeciesSuggestions(newValue);
                        }
                      }}
                      loading={loadingSpecies}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Species *"
                          required
                          InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {loadingSpecies ? <CircularProgress color="inherit" size={20} /> : null}
                                {params.InputProps.endAdornment}
                              </>
                            ),
                          }}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Autocomplete
                      freeSolo
                      options={strainSuggestions}
                      value={formData.strain}
                      onInputChange={(event, newValue) => handleChange('strain', newValue || '')}
                      loading={loadingStrains}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Strain"
                          InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {loadingStrains ? <CircularProgress color="inherit" size={20} /> : null}
                                {params.InputProps.endAdornment}
                              </>
                            ),
                          }}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth>
                      <InputLabel>Sex</InputLabel>
                      <Select
                        value={formData.sex}
                        onChange={(e) => handleChange('sex', e.target.value)}
                        label="Sex"
                      >
                        {sexOptions.map(option => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={formData.status}
                        onChange={(e) => handleChange('status', e.target.value)}
                        label="Status"
                      >
                        {statusOptions.map(option => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Genotype"
                      value={formData.genotype}
                      onChange={(e) => handleChange('genotype', e.target.value)}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Identification Card */}
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Identification" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Identification Method</InputLabel>
                      <Select
                        value={formData.identification_method}
                        onChange={(e) => handleChange('identification_method', e.target.value)}
                        label="Identification Method"
                      >
                        {identificationMethods.map(method => (
                          <MenuItem key={method.value} value={method.value}>
                            {method.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Identification Number"
                      value={formData.identification_number}
                      onChange={(e) => handleChange('identification_number', e.target.value)}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Breeding Information Card */}
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Breeding Information" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Dam (Mother)</InputLabel>
                      <Select
                        value={formData.dam_id}
                        onChange={(e) => handleChange('dam_id', e.target.value)}
                        label="Dam (Mother)"
                      >
                        <MenuItem value="">None</MenuItem>
                        {parentAnimals
                          .filter(animal => animal.sex === 'F' && animal.id !== id)
                          .map(animal => (
                            <MenuItem key={animal.id} value={animal.id}>
                              {animal.animal_number} - {animal.strain || 'No strain'}
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Sire (Father)</InputLabel>
                      <Select
                        value={formData.sire_id}
                        onChange={(e) => handleChange('sire_id', e.target.value)}
                        label="Sire (Father)"
                      >
                        <MenuItem value="">None</MenuItem>
                        {parentAnimals
                          .filter(animal => animal.sex === 'M' && animal.id !== id)
                          .map(animal => (
                            <MenuItem key={animal.id} value={animal.id}>
                              {animal.animal_number} - {animal.strain || 'No strain'}
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Dates Card */}
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Important Dates" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Birth Date"
                      value={formData.birth_date}
                      onChange={(e) => handleChange('birth_date', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Arrival Date"
                      value={formData.arrival_date}
                      onChange={(e) => handleChange('arrival_date', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Death Date"
                      value={formData.death_date}
                      onChange={(e) => handleChange('death_date', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      disabled={formData.status !== 'deceased'}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Housing and Source Card */}
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Housing & Source" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth>
                      <InputLabel>Housing Location</InputLabel>
                      <Select
                        value={formData.housing_id}
                        onChange={(e) => handleChange('housing_id', e.target.value)}
                        label="Housing Location"
                      >
                        <MenuItem value="">None</MenuItem>
                        {housingOptions.map(housing => (
                          <MenuItem key={housing.id} value={housing.id}>
                            {housing.location} - {housing.housing_number || 'No number'} 
                            {housing.capacity && ` (${housing.current_occupancy}/${housing.capacity})`}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Source/Vendor"
                      value={formData.vendor || formData.source}
                      onChange={(e) => {
                        handleChange('source', e.target.value);
                        handleChange('vendor', e.target.value);
                      }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Notes Card */}
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Additional Notes" />
              <CardContent>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Notes"
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Any additional information about this animal..."
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Form Actions */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={() => navigate('/animals')}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={saving}
              >
                {saving ? 'Saving...' : (isEdit ? 'Update Animal' : 'Create Animal')}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

export default AnimalForm;