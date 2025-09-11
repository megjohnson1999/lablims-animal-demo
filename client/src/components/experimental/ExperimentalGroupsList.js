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
  Group as GroupIcon
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { experimentalGroupsAPI, experimentalStudiesAPI } from '../../services/api';

const ExperimentalGroupsList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [groups, setGroups] = useState([]);
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [studyFilter, setStudyFilter] = useState(searchParams.get('study_id') || '');
  const [treatmentFilter, setTreatmentFilter] = useState('');

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search,
        study_id: studyFilter,
        treatment_type: treatmentFilter
      };

      const response = await experimentalGroupsAPI.getAll(`?${new URLSearchParams(params).toString()}`);
      setGroups(response.data.groups);
      setTotalCount(response.data.pagination.total);
    } catch (error) {
      console.error('Error fetching experimental groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudies = async () => {
    try {
      const response = await experimentalStudiesAPI.getAll('?limit=1000');
      setStudies(response.data.studies || []);
    } catch (error) {
      console.error('Error fetching studies:', error);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [page, rowsPerPage, search, studyFilter, treatmentFilter]);

  useEffect(() => {
    fetchStudies();
  }, []);

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

  const handleStudyFilter = (event) => {
    setStudyFilter(event.target.value);
    setPage(0);
  };

  const handleTreatmentFilter = (event) => {
    setTreatmentFilter(event.target.value);
    setPage(0);
  };

  const handleView = (groupId) => {
    navigate(`/groups/${groupId}`);
  };

  const handleEdit = (groupId) => {
    navigate(`/groups/${groupId}/edit`);
  };

  const handleDelete = async (groupId) => {
    if (window.confirm('Are you sure you want to delete this group?')) {
      try {
        await experimentalGroupsAPI.delete(groupId);
        fetchGroups();
      } catch (error) {
        console.error('Error deleting group:', error);
      }
    }
  };

  const getStudyName = (studyId) => {
    const study = studies.find(s => s.id === studyId);
    return study ? study.study_name : 'Unknown Study';
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center' }}>
          <GroupIcon sx={{ mr: 1 }} />
          Groups
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/groups/new')}
        >
          New Group
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Search groups..."
              value={search}
              onChange={handleSearch}
              placeholder="Group name, treatment type..."
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Study</InputLabel>
              <Select
                value={studyFilter}
                onChange={handleStudyFilter}
                label="Study"
              >
                <MenuItem value="">All Studies</MenuItem>
                {studies.map((study) => (
                  <MenuItem key={study.id} value={study.id}>
                    Study #{study.study_number}: {study.study_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Treatment Type"
              value={treatmentFilter}
              onChange={handleTreatmentFilter}
              placeholder="Filter by treatment type..."
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Groups Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Group #</TableCell>
                <TableCell>Group Name</TableCell>
                <TableCell>Study</TableCell>
                <TableCell>Treatment Type</TableCell>
                <TableCell>Planned Size</TableCell>
                <TableCell>Current Animals</TableCell>
                <TableCell>Control</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {group.group_number}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{group.group_name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      Study #{group.study_number}: {group.study_name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {group.treatment_type || 'Not specified'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{group.planned_size}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{group.animal_count || 0}</Typography>
                  </TableCell>
                  <TableCell>
                    {group.control_group ? (
                      <Chip label="Control" size="small" color="primary" />
                    ) : (
                      <Chip label="Treatment" size="small" color="default" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View Details">
                      <IconButton size="small" onClick={() => handleView(group.id)}>
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleEdit(group.id)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton 
                        size="small" 
                        onClick={() => handleDelete(group.id)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {groups.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="textSecondary" sx={{ py: 3 }}>
                      No experimental groups found
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

export default ExperimentalGroupsList;