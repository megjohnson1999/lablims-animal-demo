import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  MenuItem,
  IconButton,
  CircularProgress,
  Alert,
  Pagination,
  Select,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  InputAdornment,
  Card,
  CardContent,
  CardHeader,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  GetApp as ExportIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FilterList as FilterIcon,
  Home as HousingIcon,
  Pets as AnimalIcon,
  Science as SpecimenIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { animalAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const AnimalList = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // State management
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    species: '',
    status: 'active',
    housing_location: ''
  });
  const [pagination, setPagination] = useState({
    current_page: 1,
    per_page: 50,
    total: 0,
    total_pages: 0
  });
  const [selectedAnimals, setSelectedAnimals] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [animalToDelete, setAnimalToDelete] = useState(null);
  const [stats, setStats] = useState(null);
  const [speciesSuggestions, setSpeciesSuggestions] = useState([]);
  const [loadingSpecies, setLoadingSpecies] = useState(false);

  // Load species suggestions from database
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
  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'deceased', label: 'Deceased' },
    { value: 'transferred', label: 'Transferred' },
    { value: 'retired', label: 'Retired' }
  ];

  // Load animals
  const loadAnimals = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = {
        page: pagination.current_page,
        limit: pagination.per_page,
        search: searchTerm,
        ...filters
      };

      const response = await animalAPI.getAll(`?${new URLSearchParams(params).toString()}`);
      setAnimals(response.data.animals);
      setPagination(response.data.pagination);
    } catch (err) {
      console.error('Error loading animals:', err);
      setError('Failed to load animals. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filters, pagination.current_page, pagination.per_page]);

  // Load statistics
  const loadStats = useCallback(async () => {
    try {
      const response = await animalAPI.getStats();
      setStats(response.data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }, []);

  useEffect(() => {
    loadAnimals();
  }, [loadAnimals]);

  useEffect(() => {
    loadStats();
    loadSpeciesSuggestions(); // Load initial species suggestions
  }, [loadStats]);

  // Handle search
  const handleSearch = (event) => {
    if (event.key === 'Enter' || event.type === 'click') {
      setPagination(prev => ({ ...prev, current_page: 1 }));
      loadAnimals();
    }
  };

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, current_page: 1 }));
  };

  // Handle page change
  const handlePageChange = (event, value) => {
    setPagination(prev => ({ ...prev, current_page: value }));
  };

  // Handle animal actions
  const handleViewAnimal = (animalId) => {
    navigate(`/animals/${animalId}`);
  };

  const handleEditAnimal = (animalId) => {
    navigate(`/animals/${animalId}/edit`);
  };

  const handleDeleteAnimal = (animal) => {
    setAnimalToDelete(animal);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteAnimal = async () => {
    try {
      await animalAPI.delete(animalToDelete.id);
      setDeleteDialogOpen(false);
      setAnimalToDelete(null);
      loadAnimals();
      loadStats();
    } catch (err) {
      console.error('Error deleting animal:', err);
      setError('Failed to delete animal. Check if it has associated specimens.');
    }
  };

  // Get status chip color
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'deceased': return 'error';
      case 'transferred': return 'warning';
      case 'retired': return 'info';
      default: return 'default';
    }
  };

  const canEdit = currentUser && ['admin', 'facility_manager', 'technician'].includes(currentUser.role);
  const canDelete = currentUser && ['admin', 'facility_manager'].includes(currentUser.role);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AnimalIcon color="primary" />
          Animal Management
        </Typography>
        {canEdit && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/animals/new')}
          >
            Add Animal
          </Button>
        )}
      </Box>

      {/* Statistics Cards */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Animals
                </Typography>
                <Typography variant="h4">
                  {stats.total_animals}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Active Animals
                </Typography>
                <Typography variant="h4" color="success.main">
                  {stats.active_animals}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Species Types
                </Typography>
                <Typography variant="h4">
                  {stats.by_species ? stats.by_species.length : 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Recent Additions (7d)
                </Typography>
                <Typography variant="h4" color="info.main">
                  {stats.recent_additions}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search animals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleSearch}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleSearch} size="small">
                      <SearchIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Autocomplete
              freeSolo
              options={speciesSuggestions}
              value={filters.species}
              onInputChange={(event, newInputValue) => {
                handleFilterChange('species', newInputValue || '');
                if (newInputValue && newInputValue.length > 0) {
                  loadSpeciesSuggestions(newInputValue);
                } else {
                  setSpeciesSuggestions([]);
                }
              }}
              loading={loadingSpecies}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Species"
                  placeholder="Type or select species..."
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
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
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
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label="Housing Location"
              value={filters.housing_location}
              onChange={(e) => handleFilterChange('housing_location', e.target.value)}
              placeholder="Room/facility..."
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="outlined"
              startIcon={<ExportIcon />}
              onClick={() => navigate('/animals/export')}
              fullWidth
            >
              Export
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Animals Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Animal #</TableCell>
              <TableCell>Species</TableCell>
              <TableCell>Strain</TableCell>
              <TableCell>Sex</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Housing</TableCell>
              <TableCell>Specimens</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : animals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No animals found
                </TableCell>
              </TableRow>
            ) : (
              animals.map((animal) => (
                <TableRow key={animal.id} hover>
                  <TableCell>{animal.animal_number}</TableCell>
                  <TableCell>{animal.species}</TableCell>
                  <TableCell>{animal.strain || '-'}</TableCell>
                  <TableCell>{animal.sex}</TableCell>
                  <TableCell>
                    <Chip
                      label={animal.status}
                      color={getStatusColor(animal.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {animal.housing_location ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <HousingIcon fontSize="small" />
                        <Typography variant="body2">
                          {animal.housing_location}
                          {animal.housing_number && ` (${animal.housing_number})`}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Unassigned
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SpecimenIcon fontSize="small" />
                      <Typography variant="body2">
                        {animal.specimen_count || 0}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => handleViewAnimal(animal.id)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      {canEdit && (
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => handleEditAnimal(animal.id)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canDelete && (
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteAnimal(animal)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {!loading && animals.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={pagination.total_pages}
            page={pagination.current_page}
            onChange={handlePageChange}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete animal #{animalToDelete?.animal_number}?
            This action cannot be undone.
          </Typography>
          {animalToDelete?.specimen_count > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This animal has {animalToDelete.specimen_count} associated specimens.
              Deletion may fail if specimens exist.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDeleteAnimal} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AnimalList;