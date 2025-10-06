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
  Alert
} from '@mui/material';
import {
  Edit as EditIcon,
  ArrowBack as ArrowBackIcon,
  Group as GroupIcon,
  Science as ScienceIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { experimentalGroupsAPI } from '../../services/api';
import axios from 'axios';

const ExperimentalGroupDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const groupTypeColors = {
    control: 'success',
    treatment: 'primary',
    experimental: 'secondary'
  };

  useEffect(() => {
    const fetchGroupData = async () => {
      try {
        setLoading(true);
        const groupResponse = await experimentalGroupsAPI.getById(id);
        setGroup(groupResponse.data);

        // Fetch animals in this group
        const animalsResponse = await axios.get(`/api/groups/${id}/animals`);
        setAnimals(animalsResponse.data.animals || []);
      } catch (error) {
        console.error('Error fetching group:', error);
        setError('Failed to load group data');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchGroupData();
    }
  }, [id]);

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

  if (!group) {
    return (
      <Alert severity="warning" sx={{ mb: 3 }}>
        Group not found
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/groups')}
          sx={{ mb: 2 }}
        >
          Back to Groups
        </Button>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <GroupIcon sx={{ mr: 1 }} />
              Group {group.group_number}: {group.group_name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip
                label={group.group_type || 'Experimental'}
                color={groupTypeColors[group.group_type] || 'default'}
              />
              <Chip
                label={group.status}
                color={group.status === 'active' ? 'success' : 'default'}
                variant="outlined"
              />
            </Box>
          </Box>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/groups/${id}/edit`)}
          >
            Edit Group
          </Button>
        </Box>
      </Box>

      {/* Group Information */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Group Details
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Study
                </Typography>
                <Typography variant="body1">
                  {group.study_name || 'Not specified'}
                </Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Group Number
                </Typography>
                <Typography variant="body1">{group.group_number}</Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Target Animal Count
                </Typography>
                <Typography variant="body1">{group.target_animal_count}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Description
                </Typography>
                <Typography variant="body1">
                  {group.description || 'No description provided'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Treatment Information
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Treatment Description
                </Typography>
                <Typography variant="body1">
                  {group.treatment_description || 'Not specified'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Current Animals
                </Typography>
                <Typography variant="h4" color="primary">
                  {animals.length} / {group.target_animal_count}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Animals Table */}
      <Paper sx={{ mt: 3 }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Animals in Group ({animals.length})
          </Typography>
        </Box>

        {animals.length > 0 ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Animal Number</TableCell>
                  <TableCell>Species</TableCell>
                  <TableCell>Sex</TableCell>
                  <TableCell>Date of Birth</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Assignment Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {animals.map((animal) => (
                  <TableRow key={animal.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {animal.animal_number}
                      </Typography>
                    </TableCell>
                    <TableCell>{animal.species}</TableCell>
                    <TableCell>{animal.sex}</TableCell>
                    <TableCell>
                      {animal.date_of_birth
                        ? new Date(animal.date_of_birth).toLocaleDateString()
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={animal.status}
                        size="small"
                        color={animal.status === 'active' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {animal.assignment_date
                        ? new Date(animal.assignment_date).toLocaleDateString()
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View Animal">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/animals/${animal.id}`)}
                        >
                          <ScienceIcon fontSize="small" />
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
              No animals assigned to this group yet
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Animals can be assigned to this group from the Animals page
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default ExperimentalGroupDetail;
