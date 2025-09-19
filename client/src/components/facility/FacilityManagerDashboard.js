import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Alert,
  Badge,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Tabs,
  Tab
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Search as SearchIcon,
  Pets as PetsIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Visibility as ViewIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import { formatDate } from '../../utils/helpers';

const FacilityManagerDashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State
  const [activeTab, setActiveTab] = useState(0);
  const [requests, setRequests] = useState([]);
  const [availableAnimals, setAvailableAnimals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});

  // Assignment dialog state
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [compatibleAnimals, setCompatibleAnimals] = useState([]);
  const [selectedAnimals, setSelectedAnimals] = useState([]);
  const [assigning, setAssigning] = useState(false);

  // Filters
  const [requestFilters, setRequestFilters] = useState({
    status: 'all',
    priority: 'all',
    search: ''
  });

  const [animalFilters, setAnimalFilters] = useState({
    species: 'all',
    strain: '',
    sex: 'all',
    search: ''
  });

  // Load data
  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (activeTab === 0) {
      loadRequests();
    } else if (activeTab === 1) {
      loadAvailableAnimals();
    }
  }, [activeTab, requestFilters, animalFilters]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsResponse] = await Promise.all([
        axios.get('/api/animal-requests/stats')
      ]);
      setStats(statsResponse.data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    try {
      const params = {
        ...requestFilters,
        limit: 100,
        sort: 'created_at',
        order: 'DESC'
      };

      // Remove 'all' values
      Object.keys(params).forEach(key => {
        if (params[key] === 'all' || params[key] === '') {
          delete params[key];
        }
      });

      const response = await axios.get('/api/animal-requests', { params });
      setRequests(response.data.requests || []);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error('Failed to load requests');
    }
  };

  const loadAvailableAnimals = async () => {
    try {
      const params = {
        ...animalFilters,
        limit: 100
      };

      // Remove 'all' values
      Object.keys(params).forEach(key => {
        if (params[key] === 'all' || params[key] === '') {
          delete params[key];
        }
      });

      const response = await axios.get('/api/animal-claims/available', { params });
      setAvailableAnimals(response.data.animals || []);
    } catch (error) {
      console.error('Error loading available animals:', error);
      toast.error('Failed to load available animals');
    }
  };

  const handleStartAssignment = async (request) => {
    setSelectedRequest(request);
    setSelectedAnimals([]);

    try {
      // Find compatible animals for this request
      const params = {
        species: request.species,
        strain: request.strain,
        sex: request.sex !== 'any' ? request.sex : undefined,
        genotype: request.genotype,
        min_age_days: request.min_age_days,
        max_age_days: request.max_age_days,
        quantity_needed: request.quantity_requested - (request.quantity_allocated || 0)
      };

      const response = await axios.get('/api/animal-claims/available', { params });
      setCompatibleAnimals(response.data.animals || []);
      setAssignmentDialogOpen(true);

      // Update request status to reviewing if submitted
      if (request.status === 'submitted') {
        await handleStatusUpdate(request.id, 'reviewing');
      }
    } catch (error) {
      console.error('Error finding compatible animals:', error);
      toast.error('Failed to find compatible animals');
    }
  };

  const handleStatusUpdate = async (requestId, newStatus, notes = '') => {
    try {
      await axios.put(`/api/animal-requests/${requestId}/status`, {
        status: newStatus,
        review_notes: notes
      });
      loadRequests();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update request status');
    }
  };

  const handleAssignAnimals = async () => {
    if (selectedAnimals.length === 0) {
      toast.error('Please select at least one animal to assign');
      return;
    }

    try {
      setAssigning(true);

      await axios.post(`/api/animal-requests/${selectedRequest.id}/allocate`, {
        animal_ids: selectedAnimals.map(a => a.id)
      });

      toast.success(`Successfully assigned ${selectedAnimals.length} animals to request #${selectedRequest.request_number}`);
      setAssignmentDialogOpen(false);
      loadRequests();
      loadAvailableAnimals();
    } catch (error) {
      console.error('Error assigning animals:', error);
      toast.error('Failed to assign animals: ' + (error.response?.data?.message || error.message));
    } finally {
      setAssigning(false);
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'submitted': return 'warning';
      case 'reviewing': return 'info';
      case 'partially_fulfilled': return 'secondary';
      case 'fulfilled': return 'success';
      case 'waitlisted': return 'default';
      case 'denied': return 'error';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'normal': return 'primary';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const formatStatus = (status) => {
    return status.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getUrgentRequests = () => requests.filter(r =>
    r.priority === 'urgent' && ['submitted', 'reviewing'].includes(r.status)
  );

  const getOverdueRequests = () => requests.filter(r => {
    const neededDate = new Date(r.needed_by_date);
    const today = new Date();
    return neededDate < today && ['submitted', 'reviewing', 'partially_fulfilled'].includes(r.status);
  });

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
            Facility Manager Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Manage animal requests and assignments
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadDashboardData}
          size={isMobile ? 'small' : 'medium'}
        >
          Refresh
        </Button>
      </Box>

      {/* Stats Overview */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="warning.main">
              {stats.pending_review || 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Pending Review
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="error.main">
              {getUrgentRequests().length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Urgent Requests
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="warning.main">
              {getOverdueRequests().length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Overdue
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="success.main">
              {Math.round(stats.avg_fulfillment_days || 0)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Avg Days to Fulfill
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Main Content Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            icon={<AssignmentIcon />}
            label="Requests"
            iconPosition="start"
          />
          <Tab
            icon={<PetsIcon />}
            label="Available Animals"
            iconPosition="start"
          />
        </Tabs>

        {/* Requests Tab */}
        {activeTab === 0 && (
          <Box sx={{ p: 2 }}>
            {/* Request Filters */}
            <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search requests..."
                  value={requestFilters.search}
                  onChange={(e) => setRequestFilters({...requestFilters, search: e.target.value})}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={6} sm={3} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={requestFilters.status}
                    onChange={(e) => setRequestFilters({...requestFilters, status: e.target.value})}
                  >
                    <MenuItem value="all">All Status</MenuItem>
                    <MenuItem value="submitted">Submitted</MenuItem>
                    <MenuItem value="reviewing">Reviewing</MenuItem>
                    <MenuItem value="partially_fulfilled">Partially Fulfilled</MenuItem>
                    <MenuItem value="waitlisted">Waitlisted</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={3} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={requestFilters.priority}
                    onChange={(e) => setRequestFilters({...requestFilters, priority: e.target.value})}
                  >
                    <MenuItem value="all">All Priority</MenuItem>
                    <MenuItem value="urgent">Urgent</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="normal">Normal</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Requests List */}
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Request #</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Requester</TableCell>
                    <TableCell>Species/Strain</TableCell>
                    <TableCell>Progress</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Needed By</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          #{request.request_number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {request.title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {request.requester_name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {request.species === 'Mus musculus' ? 'Mouse' : 'Rat'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {request.strain}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {request.quantity_allocated || 0}/{request.quantity_requested}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={formatStatus(request.status)}
                          color={getStatusColor(request.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={request.priority}
                          color={getPriorityColor(request.priority)}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(request.needed_by_date)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/animal-requests/${request.id}`)}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          {['submitted', 'reviewing', 'partially_fulfilled'].includes(request.status) && (
                            <Tooltip title="Assign Animals">
                              <IconButton
                                size="small"
                                onClick={() => handleStartAssignment(request)}
                                color="primary"
                              >
                                <AssignmentTurnedInIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Available Animals Tab */}
        {activeTab === 1 && (
          <Box sx={{ p: 2 }}>
            {/* Animal Filters */}
            <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search animals..."
                  value={animalFilters.search}
                  onChange={(e) => setAnimalFilters({...animalFilters, search: e.target.value})}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={6} sm={3} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Species</InputLabel>
                  <Select
                    value={animalFilters.species}
                    onChange={(e) => setAnimalFilters({...animalFilters, species: e.target.value})}
                  >
                    <MenuItem value="all">All Species</MenuItem>
                    <MenuItem value="Mus musculus">Mouse</MenuItem>
                    <MenuItem value="Rattus norvegicus">Rat</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={3} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Sex</InputLabel>
                  <Select
                    value={animalFilters.sex}
                    onChange={(e) => setAnimalFilters({...animalFilters, sex: e.target.value})}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="M">Male</MenuItem>
                    <MenuItem value="F">Female</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={3} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Strain"
                  value={animalFilters.strain}
                  onChange={(e) => setAnimalFilters({...animalFilters, strain: e.target.value})}
                  placeholder="e.g. C57BL/6J"
                />
              </Grid>
            </Grid>

            {/* Animals Grid */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {availableAnimals.length} available animals
            </Typography>
            <Grid container spacing={2}>
              {availableAnimals.map((animal) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={animal.id}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" component="div">
                        #{animal.animal_number}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {animal.species === 'Mus musculus' ? 'Mouse' : 'Rat'}
                      </Typography>
                      <Typography variant="body2" color="primary">
                        {animal.strain}
                      </Typography>
                      <Typography variant="body2">
                        {animal.sex === 'M' ? 'Male' : animal.sex === 'F' ? 'Female' : 'Unknown'}
                      </Typography>
                      {animal.genotype && (
                        <Typography variant="caption" color="text.secondary">
                          {animal.genotype}
                        </Typography>
                      )}
                    </CardContent>
                    <CardActions>
                      <Button
                        size="small"
                        onClick={() => navigate(`/animals/${animal.id}`)}
                      >
                        View Details
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Paper>

      {/* Assignment Dialog */}
      <Dialog
        open={assignmentDialogOpen}
        onClose={() => setAssignmentDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          Assign Animals to Request #{selectedRequest?.request_number}
        </DialogTitle>
        <DialogContent>
          {selectedRequest && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Request Details:
              </Typography>
              <Typography variant="body2">
                <strong>Species:</strong> {selectedRequest.species} ({selectedRequest.strain})
              </Typography>
              <Typography variant="body2">
                <strong>Quantity:</strong> {selectedRequest.quantity_requested - (selectedRequest.quantity_allocated || 0)} more needed
              </Typography>
              <Typography variant="body2">
                <strong>Sex:</strong> {selectedRequest.sex || 'Any'}
              </Typography>
              {selectedRequest.genotype && (
                <Typography variant="body2">
                  <strong>Genotype:</strong> {selectedRequest.genotype}
                </Typography>
              )}
            </Box>
          )}

          <Typography variant="subtitle1" gutterBottom>
            Compatible Animals ({compatibleAnimals.length} found):
          </Typography>

          {compatibleAnimals.length === 0 ? (
            <Alert severity="warning">
              No compatible animals found. Try adjusting the request criteria or check for alternatives.
            </Alert>
          ) : (
            <List sx={{ maxHeight: 400, overflow: 'auto' }}>
              {compatibleAnimals.map((animal) => (
                <ListItem
                  key={animal.id}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1
                  }}
                >
                  <ListItemIcon>
                    <Checkbox
                      checked={selectedAnimals.some(a => a.id === animal.id)}
                      onChange={() => toggleAnimalSelection(animal)}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={`#${animal.animal_number} - ${animal.strain}`}
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          {animal.sex === 'M' ? 'Male' : animal.sex === 'F' ? 'Female' : 'Unknown'}
                          {animal.genotype && ` • ${animal.genotype}`}
                        </Typography>
                        {animal.housing_location && (
                          <Typography variant="caption" color="text.secondary">
                            Housing: {animal.housing_location}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}

          {selectedAnimals.length > 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {selectedAnimals.length} animals selected for assignment
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignmentDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssignAnimals}
            variant="contained"
            disabled={selectedAnimals.length === 0 || assigning}
          >
            {assigning ? (
              <CircularProgress size={20} />
            ) : (
              `Assign ${selectedAnimals.length} Animals`
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FacilityManagerDashboard;