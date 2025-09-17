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
  Fab,
  Alert,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  Pets as PetsIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canEditLabData } from '../utils/roleUtils';
import axios from 'axios';
import { toast } from 'react-toastify';
import { formatDate } from '../utils/helpers';

const AnimalRequests = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const canManage = ['facility_manager', 'admin'].includes(currentUser?.role);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});

  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    species: 'all',
    search: ''
  });

  // Load data
  useEffect(() => {
    loadRequests();
    if (canManage) {
      loadStats();
    }
  }, [filters]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const params = {
        ...filters,
        limit: 50
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
      toast.error('Failed to load animal requests');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await axios.get('/api/animal-requests/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
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

  const handleStatusUpdate = async (requestId, newStatus) => {
    try {
      await axios.put(`/api/animal-requests/${requestId}/status`, {
        status: newStatus,
        review_notes: `Status updated to ${newStatus}`
      });
      toast.success('Request status updated');
      loadRequests();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update request status');
    }
  };

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
            Animal Requests
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Submit and manage animal requests for research studies
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/animal-requests/new')}
          size={isMobile ? 'small' : 'medium'}
        >
          New Request
        </Button>
      </Box>

      {/* Stats Cards */}
      {canManage && stats.total_requests && (
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
              <Typography variant="h4" color="info.main">
                {stats.waitlisted || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Waitlisted
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="error.main">
                {stats.urgent_requests || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Urgent
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
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search requests..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
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
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="submitted">Submitted</MenuItem>
                <MenuItem value="reviewing">Reviewing</MenuItem>
                <MenuItem value="partially_fulfilled">Partially Fulfilled</MenuItem>
                <MenuItem value="fulfilled">Fulfilled</MenuItem>
                <MenuItem value="waitlisted">Waitlisted</MenuItem>
                <MenuItem value="denied">Denied</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Priority</InputLabel>
              <Select
                value={filters.priority}
                onChange={(e) => setFilters({...filters, priority: e.target.value})}
              >
                <MenuItem value="all">All Priority</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="low">Low</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3} md={2}>
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
          <Grid item xs={12} sm={12} md={3}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadRequests}
              fullWidth={isMobile}
            >
              Refresh
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Requests List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          Loading...
        </Box>
      ) : requests.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <AssignmentIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Animal Requests Found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {Object.values(filters).some(v => v !== 'all' && v !== '')
              ? 'Try adjusting your filters'
              : 'Create your first animal request'}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/animal-requests/new')}
          >
            New Request
          </Button>
        </Paper>
      ) : isMobile ? (
        // Mobile card view
        <Grid container spacing={2}>
          {requests.map((request) => (
            <Grid item xs={12} key={request.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6" component="div">
                      #{request.request_number}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        label={formatStatus(request.status)}
                        color={getStatusColor(request.status)}
                        size="small"
                      />
                      <Chip
                        label={request.priority}
                        color={getPriorityColor(request.priority)}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  </Box>

                  <Typography variant="body1" gutterBottom>
                    {request.title}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Requested by:</strong> {request.requester_name}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Species:</strong> {request.species === 'Mus musculus' ? 'Mouse' : 'Rat'} ({request.strain})
                  </Typography>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Quantity:</strong> {request.quantity_allocated}/{request.quantity_requested} animals
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    <strong>Needed by:</strong> {formatDate(request.needed_by_date)}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    startIcon={<ViewIcon />}
                    onClick={() => navigate(`/animal-requests/${request.id}`)}
                  >
                    View
                  </Button>
                  {canManage && request.status === 'submitted' && (
                    <Button
                      size="small"
                      onClick={() => handleStatusUpdate(request.id, 'reviewing')}
                    >
                      Review
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        // Desktop table view
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Request #</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Requester</TableCell>
                <TableCell>Species/Strain</TableCell>
                <TableCell>Quantity</TableCell>
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
                    {request.study_name && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Study: {request.study_name}
                      </Typography>
                    )}
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
                      {request.quantity_allocated}/{request.quantity_requested}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      animals
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
                      {canManage && request.status === 'submitted' && (
                        <Tooltip title="Start Review">
                          <IconButton
                            size="small"
                            onClick={() => handleStatusUpdate(request.id, 'reviewing')}
                          >
                            <EditIcon />
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
      )}
    </Box>
  );
};

export default AnimalRequests;