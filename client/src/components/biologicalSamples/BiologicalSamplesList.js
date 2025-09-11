import React, { useState, useEffect } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  FormControl,
  InputLabel,
  Select,
  Card,
  CardContent,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Science as ScienceIcon,
  Biotech as BiotechIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  Storage as StorageIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canEditLabData } from '../../utils/roleUtils';
import biologicalSamplesAPI from '../../services/biologicalSamplesAPI';
import { animalAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { formatDate } from '../../utils/helpers';

const BiologicalSamplesList = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const canEdit = canEditLabData(currentUser);

  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({});
  
  // Search and filters
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    sample_type: 'all',
    anatomical_site: 'all',
    status: 'all',
    storage_location: '',
    treatment_group: '',
    timepoint: '',
    collection_date_from: '',
    collection_date_to: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // Sample type options
  const sampleTypes = [
    { value: 'blood_whole', label: 'Whole Blood' },
    { value: 'blood_serum', label: 'Serum' },
    { value: 'blood_plasma', label: 'Plasma' },
    { value: 'tissue_liver', label: 'Liver Tissue' },
    { value: 'tissue_brain', label: 'Brain Tissue' },
    { value: 'tissue_heart', label: 'Heart Tissue' },
    { value: 'tissue_kidney', label: 'Kidney Tissue' },
    { value: 'tissue_lung', label: 'Lung Tissue' },
    { value: 'tissue_spleen', label: 'Spleen Tissue' },
    { value: 'tissue_muscle', label: 'Muscle Tissue' },
    { value: 'tissue_fat', label: 'Adipose Tissue' },
    { value: 'bone', label: 'Bone' },
    { value: 'bone_marrow', label: 'Bone Marrow' },
    { value: 'urine', label: 'Urine' },
    { value: 'feces', label: 'Feces' },
    { value: 'tissue_other', label: 'Other Tissue' },
    { value: 'fluid_other', label: 'Other Fluid' }
  ];

  const statusColors = {
    available: 'success',
    in_use: 'warning',
    depleted: 'error',
    contaminated: 'error',
    discarded: 'default'
  };

  useEffect(() => {
    loadSamples();
    loadStats();
  }, [page, rowsPerPage]);

  useEffect(() => {
    if (page === 0) {
      loadSamples();
    } else {
      setPage(0);
    }
  }, [search, filters]);

  const loadSamples = async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search,
        ...filters
      };

      // Remove 'all' values and empty strings
      Object.keys(params).forEach(key => {
        if (params[key] === 'all' || params[key] === '') {
          delete params[key];
        }
      });

      const response = await biologicalSamplesAPI.getAll(params);
      setSamples(response.data.samples);
      setTotalCount(response.data.pagination.total);
    } catch (err) {
      console.error('Error loading biological samples:', err);
      toast.error('Failed to load biological samples');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await biologicalSamplesAPI.getStats();
      setStats(response.data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const handleSearchChange = (event) => {
    setSearch(event.target.value);
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      sample_type: 'all',
      anatomical_site: 'all',
      status: 'all',
      storage_location: '',
      treatment_group: '',
      timepoint: '',
      collection_date_from: '',
      collection_date_to: ''
    });
    setSearch('');
  };

  const getSampleTypeLabel = (value) => {
    const type = sampleTypes.find(t => t.value === value);
    return type ? type.label : value;
  };

  const getVolumeBar = (current, initial) => {
    if (!initial || initial === 0) return null;
    const percentage = Math.round((current / initial) * 100);
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
        <LinearProgress
          variant="determinate"
          value={percentage}
          sx={{ 
            width: 80, 
            height: 6,
            '& .MuiLinearProgress-bar': {
              backgroundColor: percentage > 50 ? 'success.main' : percentage > 20 ? 'warning.main' : 'error.main'
            }
          }}
        />
        <Typography variant="caption">{percentage}%</Typography>
      </Box>
    );
  };

  const formatVolume = (volume) => {
    if (!volume) return 'N/A';
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}L`;
    return `${volume}mL`;
  };

  const formatWeight = (weight) => {
    if (!weight) return 'N/A';
    if (weight >= 1000) return `${(weight / 1000).toFixed(1)}g`;
    return `${weight}mg`;
  };

  return (
    <Box className="page-container">
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Biological Samples
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadSamples}
            disabled={loading}
          >
            Refresh
          </Button>
          {canEdit && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/biological-samples/new')}
            >
              Collect Sample
            </Button>
          )}
        </Box>
      </Box>

      {/* Statistics Cards */}
      {stats.total_samples && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {stats.total_samples}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Samples
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {stats.by_status?.find(s => s.status === 'available')?.count || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Available Samples
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main">
                  {stats.by_status?.find(s => s.status === 'in_use')?.count || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  In Use
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="error.main">
                  {stats.by_status?.find(s => s.status === 'depleted')?.count || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Depleted
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
          <TextField
            label="Search samples..."
            value={search}
            onChange={handleSearchChange}
            sx={{ flexGrow: 1 }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
            }}
            placeholder="Sample barcode, animal ID, anatomical site, notes..."
          />
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters
          </Button>
          <Button
            variant="text"
            onClick={clearFilters}
            disabled={!search && Object.values(filters).every(v => v === 'all' || v === '')}
          >
            Clear
          </Button>
        </Box>

        {/* Advanced Filters */}
        <Accordion expanded={showFilters} onChange={() => setShowFilters(!showFilters)}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Advanced Filters</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Sample Type</InputLabel>
                  <Select
                    value={filters.sample_type}
                    onChange={(e) => handleFilterChange('sample_type', e.target.value)}
                  >
                    <MenuItem value="all">All Types</MenuItem>
                    {sampleTypes.map(type => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                  >
                    <MenuItem value="all">All Status</MenuItem>
                    <MenuItem value="available">Available</MenuItem>
                    <MenuItem value="in_use">In Use</MenuItem>
                    <MenuItem value="depleted">Depleted</MenuItem>
                    <MenuItem value="contaminated">Contaminated</MenuItem>
                    <MenuItem value="discarded">Discarded</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="Storage Location"
                  value={filters.storage_location}
                  onChange={(e) => handleFilterChange('storage_location', e.target.value)}
                  placeholder="Freezer, room, etc."
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="Treatment Group"
                  value={filters.treatment_group}
                  onChange={(e) => handleFilterChange('treatment_group', e.target.value)}
                  placeholder="Control, Treatment A, etc."
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="Collection From"
                  type="date"
                  value={filters.collection_date_from}
                  onChange={(e) => handleFilterChange('collection_date_from', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="Collection To"
                  type="date"
                  value={filters.collection_date_to}
                  onChange={(e) => handleFilterChange('collection_date_to', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Paper>

      {/* Samples Table */}
      <Paper>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Sample Info</TableCell>
                    <TableCell>Animal</TableCell>
                    <TableCell>Sample Type</TableCell>
                    <TableCell>Collection</TableCell>
                    <TableCell>Storage</TableCell>
                    <TableCell>Quantity</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {samples.map((sample) => (
                    <TableRow key={sample.id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            Sample #{sample.sample_number}
                          </Typography>
                          {sample.sample_barcode && (
                            <Typography variant="caption" color="text.secondary">
                              {sample.sample_barcode}
                            </Typography>
                          )}
                          {sample.timepoint && (
                            <Chip 
                              label={sample.timepoint} 
                              size="small" 
                              variant="outlined" 
                              sx={{ mt: 0.5, display: 'block', width: 'fit-content' }} 
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            #{sample.animal_number}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {sample.species} {sample.strain && `(${sample.strain})`}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">
                            {getSampleTypeLabel(sample.sample_type)}
                          </Typography>
                          {sample.anatomical_site && (
                            <Typography variant="caption" color="text.secondary">
                              {sample.anatomical_site}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">
                            {formatDate(sample.collection_date)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            by {sample.collected_by}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {sample.full_storage_location || 'Not specified'}
                        </Typography>
                        {sample.storage_temperature && (
                          <Typography variant="caption" color="text.secondary">
                            {sample.storage_temperature}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ minWidth: 120 }}>
                          {sample.current_volume_ml && (
                            <Box>
                              <Typography variant="body2">
                                {formatVolume(sample.current_volume_ml)}
                                {sample.initial_volume_ml && ` / ${formatVolume(sample.initial_volume_ml)}`}
                              </Typography>
                              {getVolumeBar(sample.current_volume_ml, sample.initial_volume_ml)}
                            </Box>
                          )}
                          {sample.current_weight_mg && !sample.current_volume_ml && (
                            <Typography variant="body2">
                              {formatWeight(sample.current_weight_mg)}
                              {sample.initial_weight_mg && ` / ${formatWeight(sample.initial_weight_mg)}`}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={sample.status}
                          color={statusColors[sample.status] || 'default'}
                          size="small"
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/biological-samples/${sample.id}`)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        {canEdit && (
                          <Tooltip title="Edit Sample">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/biological-samples/${sample.id}/edit`)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {samples.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body1" color="text.secondary">
                          No biological samples found
                        </Typography>
                        {canEdit && (
                          <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => navigate('/biological-samples/new')}
                            sx={{ mt: 2 }}
                          >
                            Collect Your First Sample
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[25, 50, 100]}
              component="div"
              count={totalCount}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(event, newPage) => setPage(newPage)}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(parseInt(event.target.value, 10));
                setPage(0);
              }}
            />
          </>
        )}
      </Paper>
    </Box>
  );
};

export default BiologicalSamplesList;