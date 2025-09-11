import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  TextField,
  Autocomplete,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Divider,
  CircularProgress,
  Skeleton
} from '@mui/material';
import {
  Add as AddIcon,
  Business as BusinessIcon,
  Science as ScienceIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { studiesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { formatProjectDisplay, sortProjects, filterProjects } from '../../utils/projectUtils';

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

const ProjectSelector = ({ 
  selectedProject, 
  onProjectChange, 
  label = "Select Project",
  helperText = "Choose a project for specimen management",
  showCreateButton = true,
  filterActive = true,
  required = false,
  onValidationChange = null, // Callback for validation state changes
  simplified = false // Hide search controls and filters for clean interface
}) => {
  const [projects, setProjects] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [filterCollaborator, setFilterCollaborator] = useState('');
  const [filterStatus, setFilterStatus] = useState(filterActive ? 'active' : 'all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Debounce search term to avoid too many filter operations
  const debouncedSearchTerm = useDebounce(searchTerm, 200);
  
  // New study form state (simplified for animal research)
  const [newProject, setNewProject] = useState({
    study_name: '',
    principal_investigator: '',
    species_required: '',
    description: '',
    iacuc_protocol_number: '',
    total_animals_planned: 1,
    status: 'planning'
  });
  
  const { currentUser } = useAuth();
  const isEditor = currentUser?.role === 'editor' || currentUser?.role === 'admin';

  useEffect(() => {
    fetchProjects();
  }, []);

  // Validation logic
  useEffect(() => {
    if (onValidationChange) {
      const isValid = !required || (selectedProject && selectedProject.id);
      const validationMessage = required && !selectedProject ? 'Please select a project' : '';
      onValidationChange(isValid, validationMessage);
    }
  }, [selectedProject, required, onValidationChange]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      // For project selector, we want all studies (no pagination)
      const response = await studiesAPI.getAll('?limit=1000');
      
      // Handle both old and new API response formats
      const projectData = response.data.studies || response.data.projects || response.data;
      
      // Sort projects using the utility function
      const sortedProjects = sortProjects(projectData, {
        sortBy: 'number_then_disease',
        direction: 'asc',
        prioritizeRecent: filterStatus === 'recent'
      });
      
      setProjects(sortedProjects);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  // Collaborators are now handled within studies - simplified for animal research

  // Filter and search projects using memoization to avoid recalculating on every render
  const filteredProjects = useMemo(() => {
    // In simplified mode, don't apply the old filter logic - let Autocomplete handle it
    if (simplified) {
      return projects;
    }
    
    let filtered = projects.filter(project => {
      if (filterCollaborator && project.principal_investigator !== filterCollaborator) {
        return false;
      }
      
      // Apply status filter
      if (filterStatus === 'active') {
        // Could add more logic here for active projects
        return true;
      } else if (filterStatus === 'recent') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const createdDate = new Date(project.created_at);
        return createdDate > thirtyDaysAgo;
      }
      
      return true;
    });

    // Enhanced search functionality for non-simplified mode
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase().trim();
      const isNumericSearch = /^\d+$/.test(searchLower); // Check if search is purely numeric
      
      filtered = filtered.filter(project => {
        // If search is purely numeric, ONLY show exact matches
        if (isNumericSearch) {
          return (
            (project.project_id && project.project_id.toString() === searchLower) ||
            (project.project_number && project.project_number.toString() === searchLower)
          );
        }
        
        // For non-numeric searches, use the full search logic
        // Priority 1: Exact study_number match
        if (project.study_number && project.study_number.toString() === searchLower) {
          return true;
        }
        
        // Priority 2: Study name contains search term
        if (project.study_name && project.study_name.toLowerCase().includes(searchLower)) {
          return true;
        }
        
        // Priority 3: PI name contains search term
        if (project.principal_investigator && project.principal_investigator.toLowerCase().includes(searchLower)) {
          return true;
        }
        
        // Priority 4: Species contains search term
        if (project.species_required && project.species_required.toLowerCase().includes(searchLower)) {
          return true;
        }
        
        // Priority 5: IACUC protocol contains search term
        if (project.iacuc_protocol_number && project.iacuc_protocol_number.toLowerCase().includes(searchLower)) {
          return true;
        }
        
        // Priority 6: Other fields
        return (
          (project.description && project.description.toLowerCase().includes(searchLower))
        );
      });

      // Sort results to prioritize exact project ID matches
      filtered.sort((a, b) => {
        const aId = a.project_id?.toString().toLowerCase() || '';
        const bId = b.project_id?.toString().toLowerCase() || '';
        const aNumber = a.project_number?.toString().toLowerCase() || '';
        const bNumber = b.project_number?.toString().toLowerCase() || '';
        
        // Exact project_id matches first
        if (aId === searchLower && bId !== searchLower) return -1;
        if (bId === searchLower && aId !== searchLower) return 1;
        
        // Then exact project_number matches
        if (aNumber === searchLower && bNumber !== searchLower) return -1;
        if (bNumber === searchLower && aNumber !== searchLower) return 1;
        
        // Then project_id prefix matches
        if (aId.startsWith(searchLower) && !bId.startsWith(searchLower)) return -1;
        if (bId.startsWith(searchLower) && !aId.startsWith(searchLower)) return 1;
        
        // Then project_number prefix matches
        if (aNumber.startsWith(searchLower) && !bNumber.startsWith(searchLower)) return -1;
        if (bNumber.startsWith(searchLower) && !aNumber.startsWith(searchLower)) return 1;
        
        // Finally, sort by project_id numerically
        return (a.project_id || 0) - (b.project_id || 0);
      });
    }

    return filtered;
  }, [projects, filterCollaborator, filterStatus, debouncedSearchTerm, simplified]);

  // Format study option for display
  const formatProjectOption = (study) => {
    let display = '';
    
    // Show study_number first if available
    if (study.study_number) {
      display += `Study #${study.study_number}`;
    }
    
    // Add study name
    if (study.study_name) {
      display += display ? ` - ${study.study_name}` : study.study_name;
    }
    
    // Add PI name
    if (study.principal_investigator) {
      display += ` - ${study.principal_investigator}`;
    }
    
    // Add species if available
    if (study.species_required) {
      display += ` (${study.species_required})`;
    }
    
    return display || 'Unnamed Study';
  };

  const handleCreateProject = async () => {
    try {
      if (!newProject.study_name || !newProject.principal_investigator) {
        setError('Please fill in required fields (Study Name and Principal Investigator)');
        return;
      }

      const response = await studiesAPI.create(newProject);
      
      // Update projects list
      setProjects([...projects, response.data]);
      
      // Select the new project
      if (onProjectChange) {
        onProjectChange(response.data);
      }
      
      // Reset form and close dialog
      setNewProject({
        study_name: '',
        principal_investigator: '',
        species_required: '',
        description: '',
        iacuc_protocol_number: '',
        total_animals_planned: 1,
        status: 'planning'
      });
      setCreateDialogOpen(false);
      setError('');
      
      toast.success('Project created successfully!');
    } catch (err) {
      console.error('Error creating project:', err);
      setError(err.response?.data?.msg || 'Failed to create project');
    }
  };

  const renderProjectOption = (props, study) => (
    <Box component="li" {...props} key={study.id}>
      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <ScienceIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {study.study_number && (
              <Chip 
                label={`Study #${study.study_number}`} 
                size="small" 
                color="primary"
                sx={{ fontWeight: 'bold' }}
              />
            )}
            {study.species_required && (
              <Chip 
                label={study.species_required} 
                size="small" 
                color="secondary"
                variant="outlined"
                sx={{ fontWeight: 'bold' }}
              />
            )}
            <Typography component="span" variant="body1">
              {study.study_name || 'Unnamed Study'}
            </Typography>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <BusinessIcon sx={{ fontSize: 14, mr: 0.5 }} />
            {study.principal_investigator}
            {study.iacuc_protocol_number && ` - IACUC: ${study.iacuc_protocol_number}`}
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  const CreateProjectDialog = () => (
    <Dialog 
      open={createDialogOpen} 
      onClose={() => setCreateDialogOpen(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Create New Animal Research Study</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <TextField
          fullWidth
          margin="normal"
          label="Study Name"
          value={newProject.study_name}
          onChange={(e) => setNewProject({...newProject, study_name: e.target.value})}
          required
          helperText="Name of the research study"
        />

        <TextField
          fullWidth
          margin="normal"
          label="Principal Investigator"
          value={newProject.principal_investigator}
          onChange={(e) => setNewProject({...newProject, principal_investigator: e.target.value})}
          required
          helperText="Lead researcher for this study"
        />

        <TextField
          fullWidth
          margin="normal"
          label="Species Required"
          value={newProject.species_required}
          onChange={(e) => setNewProject({...newProject, species_required: e.target.value})}
          helperText="Animal species for this study (e.g., Mouse, Rat, Rabbit)"
        />

        <TextField
          fullWidth
          margin="normal"
          label="IACUC Protocol Number"
          value={newProject.iacuc_protocol_number}
          onChange={(e) => setNewProject({...newProject, iacuc_protocol_number: e.target.value})}
          helperText="Institutional Animal Care and Use Committee protocol number"
        />

        <TextField
          fullWidth
          margin="normal"
          label="Total Animals Planned"
          type="number"
          value={newProject.total_animals_planned}
          onChange={(e) => setNewProject({...newProject, total_animals_planned: parseInt(e.target.value) || 1})}
          helperText="Expected total number of animals for this study"
          inputProps={{ min: 1 }}
        />

        <TextField
          fullWidth
          margin="normal"
          label="Study Description"
          value={newProject.description}
          onChange={(e) => setNewProject({...newProject, description: e.target.value})}
          multiline
          rows={3}
          helperText="Brief description of the study objectives and methods"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
        <Button onClick={handleCreateProject} variant="contained">
          Create Study
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box>
      {/* Search and Filter Controls - Hidden in simplified mode */}
      {!simplified && (
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="Quick Search Projects"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type exact project ID (35) for exact match only..."
            helperText="💡 Tip: Numeric search (35) = exact match only. Text search = fuzzy matching"
            sx={{ mb: 1 }}
          />
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Principal Investigator</InputLabel>
              <Select
                value={filterCollaborator}
                onChange={(e) => setFilterCollaborator(e.target.value)}
                label="Principal Investigator"
              >
                <MenuItem value="">All PIs</MenuItem>
                {/* Extract unique PIs from studies */}
                {[...new Set(projects.map(p => p.principal_investigator).filter(Boolean))].map(pi => (
                  <MenuItem key={pi} value={pi}>
                    {pi}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All Projects</MenuItem>
                <MenuItem value="active">Active Only</MenuItem>
                <MenuItem value="recent">Recent</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>
      )}

      {/* Project Selection */}
      <Autocomplete
        value={selectedProject}
        onChange={(event, newValue) => {
          setError(''); // Clear any previous errors
          if (onProjectChange) {
            onProjectChange(newValue);
          }
        }}
        options={filteredProjects}
        getOptionLabel={formatProjectOption}
        renderOption={renderProjectOption}
        loading={loading}
        filterOptions={(options, { inputValue }) => {
          const searchTerm = inputValue?.toLowerCase().trim() || '';
          
          // If no search term, return all options
          if (!searchTerm) {
            return options;
          }
          
          // Check if search is purely numeric
          const isNumericSearch = /^\d+$/.test(searchTerm);
          
          return options.filter(project => {
            // If search is purely numeric, ONLY show exact matches
            if (isNumericSearch) {
              return (
                (project.project_id && project.project_id.toString() === searchTerm) ||
                (project.project_number && project.project_number.toString() === searchTerm)
              );
            }
            
            // For text searches, use fuzzy matching
            const projectLabel = formatProjectOption(project).toLowerCase();
            return projectLabel.includes(searchTerm);
          });
        }}
        noOptionsText={
          projects.length === 0 ? "No projects available" : 
          filteredProjects.length === 0 ? "No projects match your search" : 
          "No options"
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder="Type exact project ID (35) for exact match, or disease name for search..."
            required={required}
            helperText={error || helperText}
            error={!!error}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        renderTags={(value, getTagProps) => (
          <Chip 
            label={formatProjectOption(value)} 
            {...getTagProps({ index: 0 })}
          />
        )}
        isOptionEqualToValue={(option, value) => option.id === value?.id}
        clearOnBlur
        handleHomeEndKeys
        sx={{ mb: 1 }}
      />

      {/* Create New Project Button */}
      {showCreateButton && isEditor && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ textTransform: 'none' }}
          >
            Create New Project
          </Button>
        </Box>
      )}

      {/* Selected Project Details */}
      {selectedProject && (
        <Paper sx={{ p: 2, mt: 2, bgcolor: 'primary.50' }}>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            Selected Project Details
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
            {selectedProject.project_id && (
              <Chip 
                label={`Project #${selectedProject.project_id}`} 
                size="small" 
                color="primary"
              />
            )}
            {selectedProject.project_number && selectedProject.project_number !== selectedProject.project_id?.toString() && (
              <Chip 
                label={`${selectedProject.project_number}`} 
                size="small" 
                color="secondary"
                variant="outlined"
              />
            )}
            <Chip 
              label={selectedProject.disease || 'No disease specified'} 
              size="small" 
              variant="outlined"
            />
            {selectedProject.specimen_type && (
              <Chip 
                label={selectedProject.specimen_type} 
                size="small" 
                variant="outlined"
              />
            )}
          </Box>
          <Typography variant="body2" color="text.secondary">
            <BusinessIcon sx={{ fontSize: 14, mr: 0.5 }} />
            {selectedProject.pi_name} - {selectedProject.pi_institute}
          </Typography>
          {selectedProject.source && (
            <Typography variant="body2" color="text.secondary">
              Source: {selectedProject.source}
            </Typography>
          )}
        </Paper>
      )}

      {error && !createDialogOpen && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}

      <CreateProjectDialog />
    </Box>
  );
};

export default ProjectSelector;