import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Alert,
  Tabs,
  Tab
} from '@mui/material';
import {
  Edit as EditIcon,
  Add as AddIcon,
  Group as GroupIcon,
  Science as ScienceIcon,
  Visibility as ViewIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { experimentalStudiesAPI } from '../../services/api';
import StudyDataAnalysis from './StudyDataAnalysis';

const ExperimentalStudyDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [study, setStudy] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  const statusColors = {
    planning: 'default',
    active: 'primary',
    completed: 'success',
    cancelled: 'error'
  };

  useEffect(() => {
    const fetchStudyData = async () => {
      try {
        setLoading(true);
        const response = await experimentalStudiesAPI.getById(id);
        setStudy(response.data.study);
        setGroups(response.data.groups || []);
      } catch (error) {
        console.error('Error fetching study:', error);
        setError('Failed to load study data');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchStudyData();
    }
  }, [id]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleEditStudy = () => {
    navigate(`/studies/${id}/edit`);
  };

  const handleCreateGroup = () => {
    navigate(`/groups/new?study_id=${id}`);
  };

  const handleViewGroup = (groupId) => {
    navigate(`/groups/${groupId}`);
  };

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  if (!study) {
    return (
      <Alert severity="warning" sx={{ mb: 3 }}>
        Study not found
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <ScienceIcon sx={{ mr: 1 }} />
            Study #{study.study_number}: {study.study_name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              label={study.status}
              color={statusColors[study.status] || 'default'}
            />
            <Typography variant="body2" color="textSecondary">
              Principal Investigator: {study.principal_investigator}
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={handleEditStudy}
        >
          Edit Study
        </Button>
      </Box>

      {/* Study Overview */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Study Overview
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  IACUC Protocol
                </Typography>
                <Typography variant="body1">
                  {study.iacuc_protocol_number || 'Not specified'}
                </Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Species Required
                </Typography>
                <Typography variant="body1">{study.species_required}</Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Total Animals Planned
                </Typography>
                <Typography variant="body1">{study.total_animals_planned}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Description
                </Typography>
                <Typography variant="body1">
                  {study.description || 'No description provided'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Timeline
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Start Date
                </Typography>
                <Typography variant="body1">
                  {study.start_date ? new Date(study.start_date).toLocaleDateString() : 'TBD'}
                </Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Expected End Date
                </Typography>
                <Typography variant="body1">
                  {study.expected_end_date ? new Date(study.expected_end_date).toLocaleDateString() : 'TBD'}
                </Typography>
              </Box>
              {study.actual_end_date && (
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Actual End Date
                  </Typography>
                  <Typography variant="body1">
                    {new Date(study.actual_end_date).toLocaleDateString()}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs for detailed information */}
      <Box sx={{ mt: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Experimental Groups" icon={<GroupIcon />} iconPosition="start" />
          <Tab label="Data & Analysis" icon={<TimelineIcon />} iconPosition="start" />
          <Tab label="Objectives" />
          <Tab label="Study Design" />
        </Tabs>

        {/* Experimental Groups Tab */}
        {activeTab === 0 && (
          <Paper sx={{ mt: 2 }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">
                Experimental Groups ({groups.length})
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateGroup}
              >
                Add Group
              </Button>
            </Box>
            
            {groups.length > 0 ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Group #</TableCell>
                      <TableCell>Group Name</TableCell>
                      <TableCell>Treatment Type</TableCell>
                      <TableCell>Planned Size</TableCell>
                      <TableCell>Current Animals</TableCell>
                      <TableCell>Control Group</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {groups.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            {group.group_number}
                          </Typography>
                        </TableCell>
                        <TableCell>{group.group_name}</TableCell>
                        <TableCell>{group.treatment_type || 'Not specified'}</TableCell>
                        <TableCell>{group.planned_size}</TableCell>
                        <TableCell>{group.animal_count || 0}</TableCell>
                        <TableCell>
                          {group.control_group ? (
                            <Chip label="Control" size="small" color="primary" />
                          ) : (
                            <Chip label="Treatment" size="small" color="default" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Tooltip title="View Group">
                            <IconButton
                              size="small"
                              onClick={() => handleViewGroup(group.id)}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <GroupIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body1" color="textSecondary" gutterBottom>
                  No experimental groups yet
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  Create groups to organize animals for this study
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleCreateGroup}
                >
                  Create First Group
                </Button>
              </Box>
            )}
          </Paper>
        )}

        {/* Data & Analysis Tab */}
        {activeTab === 1 && (
          <Paper sx={{ mt: 2, p: 3 }}>
            <StudyDataAnalysis studyId={id} studyInfo={study} />
          </Paper>
        )}

        {/* Objectives Tab */}
        {activeTab === 2 && (
          <Paper sx={{ mt: 2, p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Study Objectives
            </Typography>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {study.objectives || 'No objectives specified for this study.'}
            </Typography>
          </Paper>
        )}

        {/* Study Design Tab */}
        {activeTab === 3 && (
          <Paper sx={{ mt: 2, p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Study Design
            </Typography>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {study.study_design || 'No study design description provided.'}
            </Typography>
          </Paper>
        )}
      </Box>
    </Box>
  );
};

export default ExperimentalStudyDetail;