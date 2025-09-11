import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { projectAPI } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { canEditLabData } from '../../utils/roleUtils';
import ProjectMetadataUpload from './ProjectMetadataUpload';

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

const ProjectList = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false
  });
  
  // Metadata upload dialog state
  const [metadataUploadOpen, setMetadataUploadOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const canEdit = canEditLabData(currentUser);

  // Pagination component
  const PaginationControls = ({ className = '' }) => {
    if (pagination.totalPages <= 1) {
      return null;
    }

    return (
      <Box className={className} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, my: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Page {pagination.page} of {pagination.totalPages} ({pagination.total} total projects)
        </Typography>
        <Pagination
          count={pagination.totalPages}
          page={pagination.page}
          onChange={(event, page) => fetchProjects(page, debouncedSearchTerm)}
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

  const fetchProjects = useCallback(async (page = 1, search = '') => {
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
        if (searchField?.trim()) {
          params.append('field', searchField.trim());
        }
      }
      
      const response = await projectAPI.getAll(`?${params.toString()}`);
      
      // Handle both old and new API response formats
      if (response.data.projects) {
        // New paginated format
        setProjects(response.data.projects);
        setPagination(response.data.pagination);
      } else {
        // Old format (fallback)
        setProjects(response.data);
      }
      setError('');
    } catch (err) {
      console.error('Error fetching projects', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
      setSearchLoading(false);
    }
  }, [pagination.limit, debouncedSearchTerm]);

  // Initial fetch
  useEffect(() => {
    fetchProjects(1, '');
  }, []);

  // Fetch when debounced search term or search field changes
  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) return; // Only trigger when debounce is complete
    fetchProjects(1, debouncedSearchTerm);
  }, [debouncedSearchTerm, searchField, fetchProjects]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    // Reset to page 1 when searching
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleDeleteProject = async (id) => {
    if (!window.confirm('Are you sure you want to delete this project? This will also delete all associated specimens.')) {
      return;
    }

    try {
      await projectAPI.delete(id);
      toast.success('Project deleted successfully');
      setProjects(projects.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Error deleting project', err);
      toast.error('Failed to delete project');
    }
  };

  const handleMetadataUpload = (project) => {
    setSelectedProject(project);
    setMetadataUploadOpen(true);
  };

  return (
    <Box className="project-list page-container">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Projects
        </Typography>
        {canEdit && (
          <Button
            component={Link}
            to="/projects/new"
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
          >
            New Project
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            label="Search Projects"
            variant="outlined"
            value={searchTerm}
            onChange={handleSearch}
            placeholder="Search projects..."
            sx={{ flexGrow: 1 }}
            size="small"
            InputProps={{
              endAdornment: searchLoading ? <CircularProgress size={20} /> : <SearchIcon color="action" />,
            }}
          />
          <FormControl sx={{ minWidth: 180 }} size="small">
            <InputLabel>Search Field</InputLabel>
            <Select
              value={searchField}
              label="Search Field"
              onChange={(e) => setSearchField(e.target.value)}
            >
              <MenuItem value="">All Fields</MenuItem>
              <MenuItem value="project_number">Project Number</MenuItem>
              <MenuItem value="disease">Disease</MenuItem>
              <MenuItem value="specimen_type">Specimen Type</MenuItem>
              <MenuItem value="source">Source</MenuItem>
              <MenuItem value="pi_name">PI Name</MenuItem>
              <MenuItem value="pi_institute">PI Institute</MenuItem>
              <MenuItem value="collaborator_number">Collaborator Number</MenuItem>
            </Select>
          </FormControl>
        </Box>
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
              <TableCell>Project Number</TableCell>
              <TableCell>Disease</TableCell>
              <TableCell>Specimen Type</TableCell>
              <TableCell>PI</TableCell>
              <TableCell>Date Received</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              // Skeleton loading rows
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell><Skeleton animation="wave" width="60%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="80%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="70%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="90%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="50%" /></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Skeleton variant="circular" width={32} height={32} />
                      <Skeleton variant="circular" width={32} height={32} />
                      <Skeleton variant="circular" width={32} height={32} />
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  {searchTerm ? 'No projects match your search' : 'No projects found'}
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project) => (
                <TableRow key={project.id} hover>
                  <TableCell>
                    {project.project_number 
                      ? `#${project.project_number}`
                      : project.id.substring(0, 8) + '...'}
                  </TableCell>
                  <TableCell>{project.disease || '—'}</TableCell>
                  <TableCell>{project.specimen_type || '—'}</TableCell>
                  <TableCell>{project.pi_name ? `${project.pi_name}, ${project.pi_institute}` : '—'}</TableCell>
                  <TableCell>{formatDate(project.date_received) || '—'}</TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      component={Link}
                      to={`/projects/${project.id}`}
                      title="View"
                    >
                      <ViewIcon fontSize="small" />
                    </IconButton>
                    {canEdit && (
                      <>
                        <IconButton
                          size="small"
                          component={Link}
                          to={`/projects/edit/${project.id}`}
                          title="Edit"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleMetadataUpload(project)}
                          title="Upload Metadata"
                        >
                          <UploadIcon fontSize="small" />
                        </IconButton>
                        {isAdmin && (
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteProject(project.id)}
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
      
      {/* Metadata Upload Dialog */}
      {metadataUploadOpen && (
        <ProjectMetadataUpload
          open={metadataUploadOpen}
          onClose={() => setMetadataUploadOpen(false)}
          project={selectedProject}
          onSuccess={() => {
            setMetadataUploadOpen(false);
            toast.success('Metadata uploaded successfully');
          }}
        />
      )}
    </Box>
  );
};

export default ProjectList;