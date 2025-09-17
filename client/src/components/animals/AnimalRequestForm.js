import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Card,
  CardContent,
  Chip,
  Alert,
  Autocomplete,
  FormControlLabel,
  Checkbox,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Tooltip,
  IconButton,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Science as ScienceIcon,
  Pets as PetsIcon,
  Schedule as ScheduleIcon,
  Home as HomeIcon,
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Info as InfoIcon,
  Search as SearchIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

const AnimalRequestForm = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Form state
  const [activeStep, setActiveStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [availabilityCheck, setAvailabilityCheck] = useState(null);
  const [checking, setChecking] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    // Basic Information
    title: '',
    description: '',
    justification: '',
    study_id: '',

    // Animal Specifications
    species: 'Mus musculus',
    strain: '',
    strain_alternatives: [],
    sex: 'any',
    genotype: '',
    genotype_alternatives: [],

    // Quantity and Age
    quantity_requested: 10,
    min_age_days: '',
    max_age_days: '',
    age_flexibility: false,

    // Timeline
    needed_by_date: null,
    flexible_date: false,
    duration_days: '',

    // Housing and Special Requirements
    housing_requirements: '',
    group_housing: true,

    // Priority
    priority: 'normal'
  });

  // Reference data
  const [studies, setStudies] = useState([]);
  const [commonStrains, setCommonStrains] = useState([]);
  const [commonGenotypes, setCommonGenotypes] = useState([]);

  const steps = [
    {
      label: 'Study & Purpose',
      description: 'Define the research purpose and requirements'
    },
    {
      label: 'Animal Specifications',
      description: 'Specify the type of animals needed'
    },
    {
      label: 'Quantity & Timeline',
      description: 'Define how many animals and when needed'
    },
    {
      label: 'Review & Submit',
      description: 'Review request and check availability'
    }
  ];

  // Load reference data
  useEffect(() => {
    loadStudies();
    loadReferenceData();
  }, []);

  const loadStudies = async () => {
    try {
      const response = await axios.get('/api/studies');
      setStudies(response.data.studies || []);
    } catch (error) {
      console.error('Error loading studies:', error);
    }
  };

  const loadReferenceData = async () => {
    // Common lab strains
    setCommonStrains([
      'C57BL/6J',
      'C57BL/6NJ',
      'BALB/cJ',
      'DBA/2J',
      'CBA/J',
      '129S1/SvImJ',
      'FVB/NJ',
      'NOD/ShiLtJ',
      'C3H/HeJ',
      'AKR/J'
    ]);

    // Common genotypes
    setCommonGenotypes([
      'Wild type',
      'Knockout',
      'Transgenic',
      'Cre recombinase',
      'floxed',
      'GFP reporter',
      'LacZ reporter'
    ]);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const checkAvailability = async () => {
    try {
      setChecking(true);
      const params = {
        species: formData.species,
        strain: formData.strain,
        sex: formData.sex === 'any' ? undefined : formData.sex,
        genotype: formData.genotype || undefined,
        min_age_days: formData.min_age_days || undefined,
        max_age_days: formData.max_age_days || undefined,
        quantity_needed: formData.quantity_requested
      };

      // Remove undefined values
      Object.keys(params).forEach(key => {
        if (params[key] === undefined || params[key] === '') {
          delete params[key];
        }
      });

      const response = await axios.get('/api/animal-requests/check-availability', { params });
      setAvailabilityCheck(response.data);
    } catch (error) {
      console.error('Error checking availability:', error);
      toast.error('Failed to check availability');
    } finally {
      setChecking(false);
    }
  };

  const validateStep = (step) => {
    switch (step) {
      case 0:
        return formData.title.trim() && formData.justification.trim();
      case 1:
        return formData.species && formData.strain;
      case 2:
        return formData.quantity_requested > 0 && formData.needed_by_date;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep(prev => prev + 1);
      if (activeStep === 2) {
        // Check availability when reaching review step
        checkAvailability();
      }
    } else {
      toast.error('Please complete all required fields');
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const submitRequest = async () => {
    try {
      setSubmitting(true);

      const requestData = {
        ...formData,
        requested_by: currentUser.id,
        needed_by_date: formData.needed_by_date?.toISOString().split('T')[0]
      };

      const response = await axios.post('/api/animal-requests', requestData);

      toast.success(`Animal request submitted successfully! Request #${response.data.request_number}`);
      navigate('/animal-requests');

    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error('Failed to submit request: ' + (error.response?.data?.message || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  const getAgeRangeLabel = () => {
    if (!formData.min_age_days && !formData.max_age_days) return 'Any age';
    if (formData.min_age_days && formData.max_age_days) {
      const minWeeks = Math.floor(formData.min_age_days / 7);
      const maxWeeks = Math.floor(formData.max_age_days / 7);
      return `${minWeeks}-${maxWeeks} weeks old`;
    }
    if (formData.min_age_days) {
      const minWeeks = Math.floor(formData.min_age_days / 7);
      return `At least ${minWeeks} weeks old`;
    }
    if (formData.max_age_days) {
      const maxWeeks = Math.floor(formData.max_age_days / 7);
      return `Up to ${maxWeeks} weeks old`;
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Request Title *"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="e.g., Treatment Group - Cardiac Function Study"
                  helperText="Brief descriptive title for this animal request"
                />
              </Grid>

              <Grid item xs={12}>
                <Autocomplete
                  options={studies}
                  getOptionLabel={(option) => `${option.study_name} (${option.principal_investigator})`}
                  value={studies.find(s => s.id === formData.study_id) || null}
                  onChange={(event, newValue) => {
                    handleInputChange('study_id', newValue?.id || '');
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Associated Study (Optional)"
                      helperText="Link this request to an existing study protocol"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Detailed description of how these animals will be used..."
                  helperText="Optional: Provide additional context about the research"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Scientific Justification *"
                  value={formData.justification}
                  onChange={(e) => handleInputChange('justification', e.target.value)}
                  placeholder="Explain the scientific necessity for these specific animals, including IACUC protocol references..."
                  helperText="Required: Explain why these animals are necessary for your research"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                  >
                    <MenuItem value="low">Low - Can wait if needed</MenuItem>
                    <MenuItem value="normal">Normal - Standard timeline</MenuItem>
                    <MenuItem value="high">High - Important for timeline</MenuItem>
                    <MenuItem value="urgent">Urgent - Critical deadline</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        );

      case 1:
        return (
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Species *</InputLabel>
                  <Select
                    value={formData.species}
                    onChange={(e) => handleInputChange('species', e.target.value)}
                  >
                    <MenuItem value="Mus musculus">Mouse (Mus musculus)</MenuItem>
                    <MenuItem value="Rattus norvegicus">Rat (Rattus norvegicus)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Sex</InputLabel>
                  <Select
                    value={formData.sex}
                    onChange={(e) => handleInputChange('sex', e.target.value)}
                  >
                    <MenuItem value="any">Any sex</MenuItem>
                    <MenuItem value="M">Male only</MenuItem>
                    <MenuItem value="F">Female only</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Autocomplete
                  freeSolo
                  options={commonStrains}
                  value={formData.strain}
                  onChange={(event, newValue) => {
                    handleInputChange('strain', newValue || '');
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Primary Strain *"
                      placeholder="e.g., C57BL/6J"
                      helperText="Main strain required for your research"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Autocomplete
                  multiple
                  freeSolo
                  options={commonStrains.filter(s => s !== formData.strain)}
                  value={formData.strain_alternatives}
                  onChange={(event, newValue) => {
                    handleInputChange('strain_alternatives', newValue);
                  }}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip variant="outlined" label={option} {...getTagProps({ index })} />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Alternative Strains (Optional)"
                      placeholder="Add acceptable alternative strains..."
                      helperText="Strains you would accept if primary strain is unavailable"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Autocomplete
                  freeSolo
                  options={commonGenotypes}
                  value={formData.genotype}
                  onChange={(event, newValue) => {
                    handleInputChange('genotype', newValue || '');
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Genotype (Optional)"
                      placeholder="e.g., Wild type, Knockout, etc."
                      helperText="Specific genotype requirements"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Autocomplete
                  multiple
                  freeSolo
                  options={commonGenotypes.filter(g => g !== formData.genotype)}
                  value={formData.genotype_alternatives}
                  onChange={(event, newValue) => {
                    handleInputChange('genotype_alternatives', newValue);
                  }}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip variant="outlined" label={option} {...getTagProps({ index })} />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Alternative Genotypes (Optional)"
                      placeholder="Add acceptable alternative genotypes..."
                      helperText="Genotypes you would accept if primary is unavailable"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Box>
        );

      case 2:
        return (
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Number of Animals Needed *"
                  value={formData.quantity_requested}
                  onChange={(e) => handleInputChange('quantity_requested', parseInt(e.target.value) || 0)}
                  inputProps={{ min: 1, max: 1000 }}
                  helperText="Total number of animals required"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Expected Duration (days)"
                  value={formData.duration_days}
                  onChange={(e) => handleInputChange('duration_days', e.target.value)}
                  placeholder="30"
                  helperText="How long will you use these animals?"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Minimum Age (days)"
                  value={formData.min_age_days}
                  onChange={(e) => handleInputChange('min_age_days', e.target.value)}
                  placeholder="56"
                  helperText="56 days = 8 weeks"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Maximum Age (days)"
                  value={formData.max_age_days}
                  onChange={(e) => handleInputChange('max_age_days', e.target.value)}
                  placeholder="84"
                  helperText="84 days = 12 weeks"
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.age_flexibility}
                      onChange={(e) => handleInputChange('age_flexibility', e.target.checked)}
                    />
                  }
                  label="I can accept animals slightly outside the age range if needed"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Needed By Date *"
                    value={formData.needed_by_date}
                    onChange={(newValue) => handleInputChange('needed_by_date', newValue)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        fullWidth
                        helperText="When do you need these animals?"
                      />
                    )}
                    minDate={new Date()}
                  />
                </LocalizationProvider>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.flexible_date}
                      onChange={(e) => handleInputChange('flexible_date', e.target.checked)}
                    />
                  }
                  label="Date is flexible if needed"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Housing Requirements (Optional)"
                  value={formData.housing_requirements}
                  onChange={(e) => handleInputChange('housing_requirements', e.target.value)}
                  placeholder="Special housing needs, temperature requirements, etc."
                  helperText="Any special housing or environmental requirements"
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.group_housing}
                      onChange={(e) => handleInputChange('group_housing', e.target.checked)}
                    />
                  }
                  label="Animals can be group housed"
                />
              </Grid>
            </Grid>
          </Box>
        );

      case 3:
        return (
          <Box sx={{ mt: 2 }}>
            {/* Request Summary */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Request Summary
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Title:</strong> {formData.title}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Priority:</strong> {formData.priority}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Quantity:</strong> {formData.quantity_requested} animals
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Species:</strong> {formData.species === 'Mus musculus' ? 'Mouse' : 'Rat'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Strain:</strong> {formData.strain}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Sex:</strong> {formData.sex === 'any' ? 'Any' : formData.sex === 'M' ? 'Male' : 'Female'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Age Range:</strong> {getAgeRangeLabel()}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Needed By:</strong> {formData.needed_by_date?.toLocaleDateString()}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Availability Check */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <SearchIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">
                    Availability Check
                  </Typography>
                  <Button
                    size="small"
                    onClick={checkAvailability}
                    disabled={checking}
                    sx={{ ml: 'auto' }}
                  >
                    Refresh
                  </Button>
                </Box>

                {checking ? (
                  <Alert severity="info">Checking current availability...</Alert>
                ) : availabilityCheck ? (
                  <Box>
                    {availabilityCheck.available_now >= formData.quantity_requested ? (
                      <Alert severity="success" sx={{ mb: 2 }}>
                        <strong>Great news!</strong> {availabilityCheck.available_now} animals matching your criteria are currently available.
                        Your request can be fulfilled immediately.
                      </Alert>
                    ) : availabilityCheck.available_now > 0 ? (
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        <strong>Partial availability:</strong> {availabilityCheck.available_now} of {formData.quantity_requested} animals are currently available.
                        {availabilityCheck.estimated_additional && (
                          <span> An additional {availabilityCheck.estimated_additional} may be available within {availabilityCheck.estimated_days} days.</span>
                        )}
                      </Alert>
                    ) : (
                      <Alert severity="error" sx={{ mb: 2 }}>
                        <strong>No animals currently available</strong> matching your exact criteria.
                        {availabilityCheck.alternatives && availabilityCheck.alternatives.length > 0 && (
                          <span> However, similar animals are available - see alternatives below.</span>
                        )}
                      </Alert>
                    )}

                    {availabilityCheck.alternatives && availabilityCheck.alternatives.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Alternative Options:
                        </Typography>
                        {availabilityCheck.alternatives.map((alt, index) => (
                          <Chip
                            key={index}
                            label={`${alt.count} ${alt.strain || 'Unknown strain'} (${alt.difference})`}
                            variant="outlined"
                            size="small"
                            sx={{ mr: 1, mb: 1 }}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Alert severity="info">Click "Refresh" to check current availability</Alert>
                )}
              </CardContent>
            </Card>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box className="page-container">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Request Animals
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Submit a request for animals based on your research requirements
        </Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Stepper activeStep={activeStep} orientation={isMobile ? 'vertical' : 'horizontal'}>
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel>{step.label}</StepLabel>
              {isMobile && (
                <StepContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {step.description}
                  </Typography>
                  {renderStepContent(index)}
                  <Box sx={{ mt: 3 }}>
                    <Button
                      variant="contained"
                      onClick={index === steps.length - 1 ? submitRequest : handleNext}
                      disabled={!validateStep(index) || (index === steps.length - 1 && submitting)}
                      sx={{ mr: 1 }}
                    >
                      {index === steps.length - 1 ? 'Submit Request' : 'Next'}
                    </Button>
                    {index > 0 && (
                      <Button onClick={handleBack}>
                        Back
                      </Button>
                    )}
                  </Box>
                </StepContent>
              )}
            </Step>
          ))}
        </Stepper>

        {!isMobile && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              {steps[activeStep].label}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {steps[activeStep].description}
            </Typography>

            {renderStepContent(activeStep)}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <Button
                onClick={handleBack}
                disabled={activeStep === 0}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={activeStep === steps.length - 1 ? submitRequest : handleNext}
                disabled={!validateStep(activeStep) || (activeStep === steps.length - 1 && submitting)}
              >
                {activeStep === steps.length - 1 ? 'Submit Request' : 'Next'}
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default AnimalRequestForm;