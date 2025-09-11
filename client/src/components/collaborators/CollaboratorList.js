import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  CircularProgress,
  Alert,
  Pagination,
  Skeleton,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { collaboratorAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';

// Custom hook for debouncing values
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const CollaboratorList = () => {
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false
  });
  
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const isLabManager = currentUser?.role === 'lab_manager';
  const isLabTechnician = currentUser?.role === 'lab_technician';
  const canEdit = isAdmin || isLabManager || isLabTechnician;

  // Pagination component
  const PaginationControls = ({ className = '' }) => {
    if (pagination.totalPages <= 1) {
      return null;
    }

    return (
      <Box className={className} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, my: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Page {pagination.page} of {pagination.totalPages} ({pagination.total} total collaborators)
        </Typography>
        <Pagination
          count={pagination.totalPages}
          page={pagination.page}
          onChange={(event, page) => fetchCollaborators(page, debouncedSearchTerm)}
          disabled={loading || searchLoading}
          color="primary"
          showFirstButton
          showLastButton
        />
      </Box>
    );
  };
  
  // Debounce search term to avoid too many API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const fetchCollaborators = useCallback(async (page = 1, search = '') => {
    try {
      const loadingState = search !== debouncedSearchTerm ? 'search' : 'page';
      if (loadingState === 'search') {
        setSearchLoading(true);
      } else {
        setLoading(true);
      }
      
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString()
      });
      
      if (search?.trim()) {
        params.append('search', search.trim());
      }
      
      const response = await collaboratorAPI.getAll(`?${params.toString()}`);
      
      // Handle both old and new API response formats
      if (response.data.collaborators) {
        // New paginated format
        setCollaborators(response.data.collaborators);
        setPagination(response.data.pagination);
      } else {
        // Old format (fallback)
        setCollaborators(response.data);
      }
      setError('');
    } catch (err) {
      console.error('Error fetching collaborators', err);
      setError('Failed to load collaborators');
    } finally {
      setLoading(false);
      setSearchLoading(false);
    }
  }, [pagination.limit, debouncedSearchTerm]);

  // Initial fetch
  useEffect(() => {
    fetchCollaborators(1, '');
  }, []);

  // Fetch when debounced search term changes
  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) return; // Only trigger when debounce is complete
    fetchCollaborators(1, debouncedSearchTerm);
  }, [debouncedSearchTerm, fetchCollaborators]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    // Reset to page 1 when searching
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleDeleteCollaborator = async (id) => {
    if (!window.confirm('Are you sure you want to delete this collaborator? This will also delete all associated projects and specimens.')) {
      return;
    }

    try {
      await collaboratorAPI.delete(id);
      toast.success('Collaborator deleted successfully');
      // Refresh the current page
      fetchCollaborators(pagination.page, debouncedSearchTerm);
    } catch (err) {
      console.error('Error deleting collaborator', err);
      toast.error('Failed to delete collaborator');
    }
  };

  return (
    <Box className="collaborator-list page-container">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Collaborators
        </Typography>
        {canEdit && (
          <Button
            component={Link}
            to="/collaborators/new"
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
          >
            New Collaborator
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          label="Search Collaborators"
          variant="outlined"
          value={searchTerm}
          onChange={handleSearch}
          placeholder="Search by ID, PI name, institution, IRB ID, or email"
          InputProps={{
            endAdornment: searchLoading ? <CircularProgress size={20} /> : <SearchIcon color="action" />,
          }}
        />
        {searchLoading && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              Searching...
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Top Pagination */}
      <PaginationControls className="top-pagination" />

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Collaborator Number</TableCell>
              <TableCell>PI Name</TableCell>
              <TableCell>Institution</TableCell>
              <TableCell>IRB ID</TableCell>
              <TableCell>Contact</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              // Skeleton loading rows
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell><Skeleton animation="wave" width="40%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="80%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="90%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="60%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="70%" /></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Skeleton variant="circular" width={32} height={32} />
                      <Skeleton variant="circular" width={32} height={32} />
                      <Skeleton variant="circular" width={32} height={32} />
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            ) : collaborators.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  {searchTerm ? 'No collaborators match your search' : 'No collaborators found'}
                </TableCell>
              </TableRow>
            ) : (
              collaborators.map((collaborator) => (
                <TableRow key={collaborator.id} hover>
                  <TableCell>
                    {collaborator.collaborator_number === 0 
                      ? 'Unknown'
                      : collaborator.collaborator_number 
                        ? `#${collaborator.collaborator_number}`
                        : collaborator.id.substring(0, 8) + '...'}
                  </TableCell>
                  <TableCell>{collaborator.pi_name}</TableCell>
                  <TableCell>{collaborator.pi_institute}</TableCell>
                  <TableCell>{collaborator.irb_id || '—'}</TableCell>
                  <TableCell>
                    {collaborator.pi_email || collaborator.pi_phone || '—'}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      component={Link}
                      to={`/collaborators/${collaborator.id}`}
                      title="View"
                    >
                      <ViewIcon fontSize="small" />
                    </IconButton>
                    {canEdit && (
                      <>
                        <IconButton
                          size="small"
                          component={Link}
                          to={`/collaborators/edit/${collaborator.id}`}
                          title="Edit"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        {isAdmin && (
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteCollaborator(collaborator.id)}
                            title="Delete"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Bottom Pagination */}
      <PaginationControls className="bottom-pagination" />
    </Box>
  );
};

export default CollaboratorList;