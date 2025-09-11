import React, { useState, useEffect } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  TextField,
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Science as ScienceIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { experimentalStudiesAPI } from '../../services/api';

const ExperimentalStudiesList = () => {
  const navigate = useNavigate();
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('');

  const statusColors = {
    planning: 'default',
    active: 'primary',
    completed: 'success',
    cancelled: 'error'
  };

  const fetchStudies = async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search,
        status: statusFilter,
        species: speciesFilter
      };

      const response = await experimentalStudiesAPI.getAll(`?${new URLSearchParams(params).toString()}`);
      setStudies(response.data.studies);
      setTotalCount(response.data.pagination.total);
    } catch (error) {
      console.error('Error fetching experimental studies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudies();
  }, [page, rowsPerPage, search, statusFilter, speciesFilter]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearch = (event) => {
    setSearch(event.target.value);
    setPage(0);
  };

  const handleStatusFilter = (event) => {
    setStatusFilter(event.target.value);
    setPage(0);
  };

  const handleSpeciesFilter = (event) => {
    setSpeciesFilter(event.target.value);
    setPage(0);
  };

  const handleView = (studyId) => {
    navigate(`/studies/${studyId}`);
  };

  const handleEdit = (studyId) => {
    navigate(`/studies/${studyId}/edit`);
  };

  const handleDelete = async (studyId) => {
    if (window.confirm('Are you sure you want to delete this study?')) {
      try {
        await experimentalStudiesAPI.delete(studyId);
        fetchStudies();
      } catch (error) {
        console.error('Error deleting study:', error);
      }
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center' }}>
          <ScienceIcon sx={{ mr: 1 }} />
          Studies
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/studies/new')}
        >
          New Study
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Search studies..."
              value={search}
              onChange={handleSearch}
              placeholder="Study name, PI, protocol number..."
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={handleStatusFilter}
                label="Status"
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="planning">Planning</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Species"
              value={speciesFilter}
              onChange={handleSpeciesFilter}
              placeholder="Filter by species..."
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Studies Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Study #</TableCell>
                <TableCell>Study Name</TableCell>
                <TableCell>Principal Investigator</TableCell>
                <TableCell>Species</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Animals Planned</TableCell>
                <TableCell>Groups</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {studies.map((study) => (
                <TableRow key={study.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {study.study_number}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{study.study_name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{study.principal_investigator}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{study.species_required}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={study.status}
                      color={statusColors[study.status] || 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {study.total_animals || 0} / {study.total_animals_planned}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{study.group_count || 0}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {study.start_date ? new Date(study.start_date).toLocaleDateString() : 'TBD'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View Details">
                      <IconButton size="small" onClick={() => handleView(study.id)}>
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleEdit(study.id)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton 
                        size="small" 
                        onClick={() => handleDelete(study.id)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {studies.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" color="textSecondary" sx={{ py: 3 }}>
                      No experimental studies found
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[25, 50, 100]}
        />
      </Paper>
    </Box>
  );
};

export default ExperimentalStudiesList;