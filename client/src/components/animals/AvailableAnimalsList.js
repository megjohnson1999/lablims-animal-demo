import React, { useState, useEffect } from 'react';
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
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  useMediaQuery
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
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canEditLabData } from '../../utils/roleUtils';
import { animalAPI } from '../../services/api';
import axios from 'axios';
import { toast } from 'react-toastify';
import { formatDate } from '../../utils/helpers';

const AvailableAnimalsList = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const canClaim = canEditLabData(currentUser); // researchers and above can claim
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State management
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(null); // ID of animal being claimed
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  
  // Filters and search
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    species: 'all',
    strain: 'all',
    sex: 'all',
    age_range: 'all',
    housing_location: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Claim form data
  const [claimData, setClaimData] = useState({
    justification: '',
    study_id: '',
    approved_until: ''
  });

  // Statistics
  const [stats, setStats] = useState({});

  useEffect(() => {
    loadAvailableAnimals();
    loadStats();
  }, []);

  useEffect(() => {
    loadAvailableAnimals();
  }, [search, filters]);

  const loadAvailableAnimals = async () => {
    try {
      setLoading(true);
      console.log('Loading available animals...');
      
      const params = {
        search,
        ...filters,
        sort: 'species,strain,animal_number',
        limit: 100 // Show more animals for claiming interface
      };

      // Remove 'all' values and empty strings
      Object.keys(params).forEach(key => {
        if (params[key] === 'all' || params[key] === '') {
          delete params[key];
        }
      });

      const response = await axios.get('/api/animal-claims/available', { params });
      console.log('Available animals response:', response);
      
      setAnimals(response.data.animals || []);
    } catch (err) {
      console.error('Error loading available animals:', err);
      toast.error('Failed to load available animals');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await axios.get('/api/animal-claims/stats');
      setStats(response.data || {});
    } catch (err) {
      console.error('Error loading stats:', err);
    }
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
      loadAvailableAnimals(); // Refresh the list
      
    } catch (error) {
      console.error('Error claiming animal:', error);
      toast.error('Failed to claim animal: ' + (error.response?.data?.message || error.message));
    } finally {
      setClaiming(null);
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

  const clearFilters = () => {
    setFilters({
      species: 'all',
      strain: 'all',
      sex: 'all',
      age_range: 'all',
      housing_location: 'all'
    });
    setSearch('');
  };

  const hasActiveFilters = search || Object.values(filters).some(v => v !== 'all');

  return (
    <Box className="page-container">
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 2 : 0
      }}>
        <Box>
          <Typography variant="h4" component="h1">
            Available Animals
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Browse and claim animals for your research studies
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadAvailableAnimals}
            disabled={loading}
            size={isMobile ? 'small' : 'medium'}
          >
            Refresh
          </Button>
          {canClaim && (
            <Button
              variant="text"
              onClick={() => navigate('/animals')}
              size={isMobile ? 'small' : 'medium'}
            >
              All Animals
            </Button>
          )}
        </Box>
      </Box>

      {/* Quick Stats */}
      {stats.available_animals && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {animals.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Available Now
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {stats.by_species?.length || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Species Types
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="info.main">
                {stats.by_strain?.length || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Strains
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">
                {stats.recently_arrived || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                New Arrivals
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search by strain, genotype, or animal number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flexGrow: 1, minWidth: isMobile ? '100%' : '300px' }}
            size="small"
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
            }}
          />
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={() => setShowFilters(!showFilters)}
            size="small"
            color={hasActiveFilters ? 'primary' : 'inherit'}
          >
            Filters
            {hasActiveFilters && <Badge color="primary" variant="dot" sx={{ ml: 1 }} />}
          </Button>
          {hasActiveFilters && (
            <IconButton size="small" onClick={clearFilters}>
              <ClearIcon />
            </IconButton>
          )}
        </Box>

        {/* Advanced Filters */}
        <Accordion expanded={showFilters} onChange={() => setShowFilters(!showFilters)}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2">Advanced Filters</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Species</InputLabel>
                  <Select
                    value={filters.species}
                    onChange={(e) => setFilters({...filters, species: e.target.value})}
                  >
                    <MenuItem value="all">All Species</MenuItem>
                    <MenuItem value="Mus musculus">Mouse</MenuItem>
                    <MenuItem value="Rattus norvegicus">Rat</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Sex</InputLabel>
                  <Select
                    value={filters.sex}
                    onChange={(e) => setFilters({...filters, sex: e.target.value})}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="M">Male</MenuItem>
                    <MenuItem value="F">Female</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Age Range</InputLabel>
                  <Select
                    value={filters.age_range}
                    onChange={(e) => setFilters({...filters, age_range: e.target.value})}
                  >
                    <MenuItem value="all">All Ages</MenuItem>
                    <MenuItem value="young">Young (&lt; 3 months)</MenuItem>
                    <MenuItem value="adult">Adult (3-12 months)</MenuItem>
                    <MenuItem value="mature">Mature (&gt; 12 months)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Strain"
                  value={filters.strain}
                  onChange={(e) => setFilters({...filters, strain: e.target.value})}
                  placeholder="e.g. C57BL/6J"
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Paper>

      {/* Animals Grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {animals.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <PetsIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Available Animals Found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {hasActiveFilters ? 'Try adjusting your filters' : 'Check back later for new arrivals'}
              </Typography>
              {hasActiveFilters && (
                <Button onClick={clearFilters} variant="outlined" size="small">
                  Clear Filters
                </Button>
              )}
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {animals.map((animal) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={animal.id}>
                  <Card 
                    sx={{ 
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      '&:hover': {
                        boxShadow: 4
                      }
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                      {/* Animal Number & Status */}
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

                      {/* Species & Strain */}
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        <strong>{animal.species === 'Mus musculus' ? 'Mouse' : 'Rat'}</strong>
                      </Typography>
                      
                      {animal.strain && (
                        <Typography variant="body2" color="primary" gutterBottom>
                          {animal.strain}
                        </Typography>
                      )}

                      {/* Sex, Age, Housing */}
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

                      {/* Genotype */}
                      {animal.genotype && (
                        <Typography variant="caption" color="text.secondary" sx={{ 
                          display: 'block',
                          fontStyle: 'italic',
                          mb: 1 
                        }}>
                          {animal.genotype}
                        </Typography>
                      )}

                      {/* Housing */}
                      {animal.housing_location && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                          <HomeIcon fontSize="small" color="action" />
                          <Typography variant="caption" color="text.secondary">
                            {animal.housing_location}
                          </Typography>
                        </Box>
                      )}

                      {/* Notes */}
                      {animal.notes && (
                        <Typography variant="caption" color="text.secondary" sx={{
                          display: 'block',
                          fontStyle: 'italic',
                          maxHeight: '3em',
                          overflow: 'hidden'
                        }}>
                          {animal.notes.length > 80 ? `${animal.notes.substring(0, 80)}...` : animal.notes}
                        </Typography>
                      )}
                    </CardContent>
                    
                    <CardActions sx={{ pt: 0 }}>
                      <Button
                        size="small"
                        startIcon={<ScienceIcon />}
                        onClick={() => navigate(`/animals/${animal.id}`)}
                      >
                        View Details
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
          
          <Alert severity="info" sx={{ mb: 3 }}>
            <strong>Note:</strong> This is a simplified claiming process. 
            In the full system, claims will require facility manager approval.
          </Alert>

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
            helperText="Required: Describe the purpose and necessity for claiming this animal"
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
            helperText="Optional: When do you expect to release this animal?"
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
    </Box>
  );
};

export default AvailableAnimalsList;