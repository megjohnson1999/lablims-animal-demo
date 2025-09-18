import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Paper,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Autocomplete,
  FormControlLabel,
  Checkbox,
  useTheme,
  useMediaQuery,
  Fade,
  Collapse,
  Stack
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Pets as PetsIcon,
  Male as MaleIcon,
  Female as FemaleIcon,
  Science as ScienceIcon,
  Home as HomeIcon,
  CalendarToday as CalendarIcon,
  ExpandMore as ExpandMoreIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
  Assignment as AssignmentIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canEditLabData } from '../../utils/roleUtils';
import axios from 'axios';
import { toast } from 'react-toastify';
import { formatDate } from '../../utils/helpers';
import { debounce } from 'lodash';

const UnifiedAnimalInterface = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const canClaim = canEditLabData(currentUser);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State management
  const [availableAnimals, setAvailableAnimals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Search criteria
  const [searchCriteria, setSearchCriteria] = useState({
    species: 'Mus musculus',
    strain: '',
    sex: 'any',
    genotype: '',
    quantity_needed: 1,
    min_age_days: '',
    max_age_days: '',
    housing_location: ''
  });

  // Dialogs
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);

  // Claim form data
  const [claimData, setClaimData] = useState({
    justification: '',
    study_id: '',
    approved_until: ''
  });

  // Request form data
  const [requestData, setRequestData] = useState({
    title: '',
    justification: '',
    description: '',
    study_id: '',
    priority: 'normal',
    needed_by_date: null,
    duration_days: '',
    housing_requirements: '',
    flexible_date: false,
    age_flexibility: false
  });

  // Reference data
  const [commonStrains] = useState([
    'C57BL/6J', 'C57BL/6NJ', 'BALB/cJ', 'DBA/2J', 'CBA/J',
    '129S1/SvImJ', 'FVB/NJ', 'NOD/ShiLtJ', 'C3H/HeJ', 'AKR/J'
  ]);
  const [studies, setStudies] = useState([]);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((criteria) => {
      searchAvailableAnimals(criteria);
    }, 500),
    []
  );

  useEffect(() => {
    loadStudies();
  }, []);

  // Trigger search when criteria change
  useEffect(() => {
    if (hasSearched && (searchCriteria.species || searchCriteria.strain)) {
      debouncedSearch(searchCriteria);
    }
  }, [searchCriteria, debouncedSearch, hasSearched]);

  const loadStudies = async () => {
    try {
      const response = await axios.get('/api/studies');
      setStudies(response.data.studies || []);
    } catch (error) {
      console.error('Error loading studies:', error);
    }
  };

  const searchAvailableAnimals = async (criteria = searchCriteria) => {
    try {
      setLoading(true);
      setHasSearched(true);

      const params = {
        ...criteria,
        sort: 'species,strain,animal_number',
        limit: 50
      };

      // Remove empty values
      Object.keys(params).forEach(key => {
        if (params[key] === 'any' || params[key] === '' || params[key] === 0) {
          delete params[key];
        }
      });

      const response = await axios.get('/api/animal-claims/available', { params });
      setAvailableAnimals(response.data.animals || []);

    } catch (err) {
      console.error('Error searching animals:', err);
      toast.error(`Failed to search animals: ${err.response?.data?.message || err.message}`);
      setAvailableAnimals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchClick = () => {
    if (!searchCriteria.species) {
      toast.error('Please select a species to search');
      return;
    }
    searchAvailableAnimals();
  };

  const handleCriteriaChange = (field, value) => {
    setSearchCriteria(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearCriteria = () => {
    setSearchCriteria({
      species: 'Mus musculus',
      strain: '',
      sex: 'any',
      genotype: '',
      quantity_needed: 1,
      min_age_days: '',
      max_age_days: '',
      housing_location: ''
    });
    setAvailableAnimals([]);
    setHasSearched(false);
  };

  const handleClaimAnimal = (animal) => {
    setSelectedAnimal(animal);
    setClaimData({
      justification: '',
      study_id: '',
      approved_until: ''
    });
    setClaimDialogOpen(true);
  };

  const submitClaim = async () => {
    if (!claimData.justification.trim()) {
      toast.error('Please provide justification for claiming this animal');
      return;
    }

    try {
      setClaiming(selectedAnimal.id);

      const claimRequest = {
        animal_id: selectedAnimal.id,
        justification: claimData.justification,
        study_id: claimData.study_id || null,
        approved_until: claimData.approved_until || null
      };

      const response = await axios.post('/api/animal-claims/claim', claimRequest);

      toast.success(response.data.message || `Successfully claimed ${selectedAnimal.species} #${selectedAnimal.animal_number}!`);
      setClaimDialogOpen(false);
      searchAvailableAnimals(); // Refresh results

    } catch (error) {
      console.error('Error claiming animal:', error);
      toast.error('Failed to claim animal: ' + (error.response?.data?.message || error.message));
    } finally {
      setClaiming(null);
    }
  };

  const handleRequestAnimals = () => {
    // Pre-fill request form with search criteria
    const qty = parseInt(searchCriteria.quantity_needed) || 1;
    setRequestData(prev => ({
      ...prev,
      title: `${qty} ${searchCriteria.species === 'Mus musculus' ? 'Mice' : 'Rats'}${searchCriteria.strain ? ` (${searchCriteria.strain})` : ''}`,
      description: `Requesting ${qty} ${searchCriteria.species === 'Mus musculus' ? 'mice' : 'rats'}${searchCriteria.strain ? ` of strain ${searchCriteria.strain}` : ''}${searchCriteria.sex !== 'any' ? `, ${searchCriteria.sex === 'M' ? 'male' : 'female'} only` : ''}.`
    }));
    setRequestDialogOpen(true);
  };

  const submitRequest = async () => {
    if (!requestData.title.trim() || !requestData.justification.trim()) {
      toast.error('Please provide title and justification for your request');
      return;
    }

    try {
      const requestPayload = {
        // Basic info
        title: requestData.title,
        description: requestData.description,
        justification: requestData.justification,
        study_id: requestData.study_id || null,
        priority: requestData.priority,

        // Animal specifications from search criteria
        species: searchCriteria.species,
        strain: searchCriteria.strain,
        sex: searchCriteria.sex === 'any' ? null : searchCriteria.sex,
        genotype: searchCriteria.genotype || null,
        quantity_requested: parseInt(searchCriteria.quantity_needed) || 1,
        min_age_days: searchCriteria.min_age_days || null,
        max_age_days: searchCriteria.max_age_days || null,

        // Timeline and housing
        needed_by_date: requestData.needed_by_date?.toISOString().split('T')[0],
        duration_days: requestData.duration_days || null,
        housing_requirements: requestData.housing_requirements || null,
        flexible_date: requestData.flexible_date,
        age_flexibility: requestData.age_flexibility,

        // Submitter
        requested_by: currentUser.id
      };

      const response = await axios.post('/api/animal-requests', requestPayload);

      toast.success(`Animal request submitted successfully! Request #${response.data.request_number}`);
      setRequestDialogOpen(false);
      navigate('/animal-requests');

    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error('Failed to submit request: ' + (error.response?.data?.message || error.message));
    }
  };

  const getAgeDisplay = (birthDate) => {
    if (!birthDate) return 'Unknown';
    const birth = new Date(birthDate);
    const now = new Date();
    const ageInDays = Math.floor((now - birth) / (1000 * 60 * 60 * 24));

    if (ageInDays < 30) return `${ageInDays} days`;
    if (ageInDays < 365) return `${Math.floor(ageInDays / 30)} months`;
    return `${Math.floor(ageInDays / 365)} years`;
  };

  const getSexIcon = (sex) => {
    switch (sex) {
      case 'M': return <MaleIcon color="primary" />;
      case 'F': return <FemaleIcon color="secondary" />;
      default: return <PetsIcon color="action" />;
    }
  };

  const getSexColor = (sex) => {
    switch (sex) {
      case 'M': return 'primary';
      case 'F': return 'secondary';
      default: return 'default';
    }
  };

  const hasMatchingAnimals = availableAnimals.length > 0;
  const quantityNeeded = parseInt(searchCriteria.quantity_needed) || 1;
  const hasEnoughAnimals = availableAnimals.length >= quantityNeeded;

  return (
    <Box className="page-container">
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Find Animals
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Search for available animals or submit a request for what you need
        </Typography>
      </Box>

      {/* Search Criteria */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          What animals do you need?
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Species *</InputLabel>
              <Select
                value={searchCriteria.species}
                onChange={(e) => handleCriteriaChange('species', e.target.value)}
              >
                <MenuItem value="Mus musculus">Mouse</MenuItem>
                <MenuItem value="Rattus norvegicus">Rat</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Autocomplete
              freeSolo
              options={commonStrains}
              value={searchCriteria.strain}
              onChange={(event, newValue) => handleCriteriaChange('strain', newValue || '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Strain"
                  placeholder="e.g., C57BL/6J"
                  helperText="Leave blank for any strain"
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth>
              <InputLabel>Sex</InputLabel>
              <Select
                value={searchCriteria.sex}
                onChange={(e) => handleCriteriaChange('sex', e.target.value)}
              >
                <MenuItem value="any">Any</MenuItem>
                <MenuItem value="M">Male</MenuItem>
                <MenuItem value="F">Female</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              type="number"
              label="Quantity Needed"
              value={searchCriteria.quantity_needed}
              onChange={(e) => {
                const value = e.target.value;
                // Allow empty value temporarily, default to 1 only when empty and field loses focus
                handleCriteriaChange('quantity_needed', value === '' ? '' : parseInt(value) || 1);
              }}
              onBlur={(e) => {
                // Set to 1 if empty when user leaves the field
                if (e.target.value === '' || parseInt(e.target.value) < 1) {
                  handleCriteriaChange('quantity_needed', 1);
                }
              }}
              onFocus={(e) => {
                // Select all text when user focuses on the field
                e.target.select();
              }}
              inputProps={{ min: 1, max: 100 }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<SearchIcon />}
              onClick={handleSearchClick}
              disabled={loading}
            >
              {loading ? <CircularProgress size={20} /> : 'Search'}
            </Button>
          </Grid>
        </Grid>

        {/* Advanced Options */}
        <Accordion sx={{ mt: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2">Advanced Options</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="Genotype"
                  value={searchCriteria.genotype}
                  onChange={(e) => handleCriteriaChange('genotype', e.target.value)}
                  placeholder="e.g., Wild type"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  type="number"
                  label="Min Age (days)"
                  value={searchCriteria.min_age_days}
                  onChange={(e) => handleCriteriaChange('min_age_days', e.target.value)}
                  placeholder="e.g., 56"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  type="number"
                  label="Max Age (days)"
                  value={searchCriteria.max_age_days}
                  onChange={(e) => handleCriteriaChange('max_age_days', e.target.value)}
                  placeholder="e.g., 84"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  startIcon={<ClearIcon />}
                  onClick={clearCriteria}
                  disabled={loading}
                >
                  Clear All
                </Button>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Paper>

      {/* Results Section */}
      {hasSearched && (
        <Fade in={hasSearched}>
          <Box>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {/* Results Summary */}
                <Paper sx={{ p: 2, mb: 3 }}>
                  {hasMatchingAnimals ? (
                    <Box>
                      <Alert
                        severity={hasEnoughAnimals ? "success" : "warning"}
                        sx={{ mb: 2 }}
                        icon={hasEnoughAnimals ? <CheckCircleIcon /> : <ErrorIcon />}
                      >
                        <Typography variant="body1">
                          {hasEnoughAnimals ? (
                            <strong>Great! Found {availableAnimals.length} available animals matching your criteria.</strong>
                          ) : (
                            <strong>Found {availableAnimals.length} available animals, but you need {quantityNeeded}.</strong>
                          )}
                        </Typography>
                        <Typography variant="body2">
                          {hasEnoughAnimals ?
                            "You can claim the animals you need from the list below." :
                            "You can claim some now and request the rest, or submit a request for all animals."
                          }
                        </Typography>
                      </Alert>

                      <Stack direction="row" spacing={2} flexWrap="wrap">
                        {!hasEnoughAnimals && (
                          <Button
                            variant="contained"
                            color="primary"
                            startIcon={<AssignmentIcon />}
                            onClick={handleRequestAnimals}
                          >
                            Request {quantityNeeded} Animals
                          </Button>
                        )}
                        <Button
                          variant="outlined"
                          startIcon={<RefreshIcon />}
                          onClick={() => searchAvailableAnimals()}
                          disabled={loading}
                        >
                          Refresh Results
                        </Button>
                      </Stack>
                    </Box>
                  ) : (
                    <Box>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="body1">
                          <strong>No animals currently available matching your criteria.</strong>
                        </Typography>
                        <Typography variant="body2">
                          You can submit a request and we'll notify you when suitable animals become available.
                        </Typography>
                      </Alert>

                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AssignmentIcon />}
                        onClick={handleRequestAnimals}
                      >
                        Request These Animals
                      </Button>
                    </Box>
                  )}
                </Paper>

                {/* Available Animals Grid */}
                {hasMatchingAnimals && (
                  <Grid container spacing={2}>
                    {availableAnimals.map((animal) => (
                      <Grid item xs={12} sm={6} md={4} lg={3} key={animal.id}>
                        <Card
                          sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            '&:hover': { boxShadow: 4 }
                          }}
                        >
                          <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                              <Typography variant="h6" component="div">
                                #{animal.animal_number}
                              </Typography>
                              <Chip
                                icon={<PetsIcon />}
                                label="Available"
                                color="success"
                                size="small"
                              />
                            </Box>

                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              <strong>{animal.species === 'Mus musculus' ? 'Mouse' : 'Rat'}</strong>
                            </Typography>

                            {animal.strain && (
                              <Typography variant="body2" color="primary" gutterBottom>
                                {animal.strain}
                              </Typography>
                            )}

                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                              <Chip
                                icon={getSexIcon(animal.sex)}
                                label={animal.sex === 'M' ? 'Male' : animal.sex === 'F' ? 'Female' : 'Unknown'}
                                color={getSexColor(animal.sex)}
                                size="small"
                                variant="outlined"
                              />
                              {animal.birth_date && (
                                <Chip
                                  icon={<CalendarIcon />}
                                  label={getAgeDisplay(animal.birth_date)}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                            </Box>

                            {animal.genotype && (
                              <Typography variant="caption" color="text.secondary" sx={{
                                display: 'block', fontStyle: 'italic', mb: 1
                              }}>
                                {animal.genotype}
                              </Typography>
                            )}

                            {animal.housing_location && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                                <HomeIcon fontSize="small" color="action" />
                                <Typography variant="caption" color="text.secondary">
                                  {animal.housing_location}
                                </Typography>
                              </Box>
                            )}
                          </CardContent>

                          <CardActions sx={{ pt: 0 }}>
                            <Button
                              size="small"
                              startIcon={<ScienceIcon />}
                              onClick={() => navigate(`/animals/${animal.id}`)}
                            >
                              Details
                            </Button>
                            {canClaim && (
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => handleClaimAnimal(animal)}
                                disabled={claiming === animal.id}
                                sx={{ ml: 'auto' }}
                              >
                                {claiming === animal.id ? <CircularProgress size={16} /> : 'Claim'}
                              </Button>
                            )}
                          </CardActions>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </>
            )}
          </Box>
        </Fade>
      )}

      {/* Claim Animal Dialog */}
      <Dialog
        open={claimDialogOpen}
        onClose={() => setClaimDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          Claim Animal #{selectedAnimal?.animal_number}
        </DialogTitle>
        <DialogContent>
          {selectedAnimal && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Species:</strong> {selectedAnimal.species} ({selectedAnimal.strain})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Sex:</strong> {selectedAnimal.sex === 'M' ? 'Male' : selectedAnimal.sex === 'F' ? 'Female' : 'Unknown'}
              </Typography>
              {selectedAnimal.genotype && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Genotype:</strong> {selectedAnimal.genotype}
                </Typography>
              )}
            </Box>
          )}

          <TextField
            fullWidth
            multiline
            rows={4}
            label="Justification *"
            placeholder="Explain why you need this animal for your research..."
            value={claimData.justification}
            onChange={(e) => setClaimData({...claimData, justification: e.target.value})}
            sx={{ mb: 2 }}
            required
          />

          <TextField
            fullWidth
            label="Study ID (Optional)"
            placeholder="Enter study or protocol ID"
            value={claimData.study_id}
            onChange={(e) => setClaimData({...claimData, study_id: e.target.value})}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            type="date"
            label="Expected Release Date (Optional)"
            value={claimData.approved_until}
            onChange={(e) => setClaimData({...claimData, approved_until: e.target.value})}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClaimDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={submitClaim}
            variant="contained"
            disabled={!claimData.justification.trim() || claiming}
          >
            {claiming ? <CircularProgress size={20} /> : 'Claim Animal'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Request Animals Dialog */}
      <Dialog
        open={requestDialogOpen}
        onClose={() => setRequestDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          Request Animals
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Submit a request for{' '}
            <strong>
              {parseInt(searchCriteria.quantity_needed) || 1} {searchCriteria.species === 'Mus musculus' ? 'mice' : 'rats'}
              {searchCriteria.strain ? ` (${searchCriteria.strain})` : ''}
            </strong>
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Request Title *"
                value={requestData.title}
                onChange={(e) => setRequestData({...requestData, title: e.target.value})}
                placeholder="Brief title for this request"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Scientific Justification *"
                value={requestData.justification}
                onChange={(e) => setRequestData({...requestData, justification: e.target.value})}
                placeholder="Explain why you need these animals for your research..."
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Autocomplete
                options={studies}
                getOptionLabel={(option) => `${option.study_name} (${option.principal_investigator})`}
                value={studies.find(s => s.id === requestData.study_id) || null}
                onChange={(event, newValue) => {
                  setRequestData({...requestData, study_id: newValue?.id || ''});
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Associated Study (Optional)"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={requestData.priority}
                  onChange={(e) => setRequestData({...requestData, priority: e.target.value})}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="normal">Normal</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Needed By Date"
                  value={requestData.needed_by_date}
                  onChange={(newValue) => setRequestData({...requestData, needed_by_date: newValue})}
                  renderInput={(params) => (
                    <TextField {...params} fullWidth />
                  )}
                  minDate={new Date()}
                />
              </LocalizationProvider>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Expected Duration (days)"
                value={requestData.duration_days}
                onChange={(e) => setRequestData({...requestData, duration_days: e.target.value})}
                placeholder="30"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Additional Notes"
                value={requestData.description}
                onChange={(e) => setRequestData({...requestData, description: e.target.value})}
                placeholder="Any additional details or requirements..."
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={requestData.flexible_date}
                    onChange={(e) => setRequestData({...requestData, flexible_date: e.target.checked})}
                  />
                }
                label="Date is flexible if needed"
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={requestData.age_flexibility}
                    onChange={(e) => setRequestData({...requestData, age_flexibility: e.target.checked})}
                  />
                }
                label="I can accept animals slightly outside the age range if needed"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRequestDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={submitRequest}
            variant="contained"
            disabled={!requestData.title.trim() || !requestData.justification.trim()}
          >
            Submit Request
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UnifiedAnimalInterface;