import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  Tab,
  Tabs,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
} from '@mui/material';
import {
  Edit as EditIcon,
  ArrowBack as BackIcon,
  Pets as AnimalIcon,
  Home as HousingIcon,
  Scale as WeightIcon,
  Visibility as ViewIcon,
  Add as AddIcon,
  FamilyRestroom as FamilyIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { animalAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const AnimalDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentUser } = useAuth();

  // State
  const [animal, setAnimal] = useState(null);
  const [specimens, setSpecimens] = useState([]);
  const [weights, setWeights] = useState([]);
  const [observations, setObservations] = useState([]);
  const [breeding, setBreeding] = useState({ offspring: [], parents: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  
  // Weight dialog state
  const [weightDialogOpen, setWeightDialogOpen] = useState(false);
  const [newWeight, setNewWeight] = useState({
    weight_grams: '',
    body_condition_score: '',
    measurement_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Observation dialog state
  const [observationDialogOpen, setObservationDialogOpen] = useState(false);
  const [newObservation, setNewObservation] = useState({
    observation_type: '',
    finding: '',
    severity: '',
    description: '',
    action_taken: '',
    follow_up_required: false,
    observation_date: new Date().toISOString().split('T')[0]
  });

  // Load animal data
  const loadAnimal = async () => {
    try {
      setLoading(true);
      const [animalResult, weightsResult, observationsResult, breedingResult] = await Promise.all([
        animalAPI.getById(id),
        animalAPI.getWeights(id),
        animalAPI.getObservations(id),
        animalAPI.getBreedingInfo(id)
      ]);

      setAnimal(animalResult.data.animal);
      setSpecimens(animalResult.data.specimens || []);
      setWeights(weightsResult.data || []);
      setObservations(observationsResult.data || []);
      setBreeding(breedingResult.data || { offspring: [], parents: {} });
    } catch (err) {
      console.error('Error loading animal:', err);
      setError('Failed to load animal data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnimal();
  }, [id]);

  // Add weight record
  const handleAddWeight = async () => {
    try {
      await animalAPI.addWeight(id, newWeight);
      setWeightDialogOpen(false);
      setNewWeight({
        weight_grams: '',
        body_condition_score: '',
        measurement_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      loadAnimal(); // Reload to get updated weights
    } catch (err) {
      console.error('Error adding weight:', err);
    }
  };

  // Add observation
  const handleAddObservation = async () => {
    try {
      await animalAPI.addObservation(id, {
        ...newObservation,
        observed_by: currentUser.username
      });
      setObservationDialogOpen(false);
      setNewObservation({
        observation_type: '',
        finding: '',
        severity: '',
        description: '',
        action_taken: '',
        follow_up_required: false,
        observation_date: new Date().toISOString().split('T')[0]
      });
      loadAnimal(); // Reload to get updated observations
    } catch (err) {
      console.error('Error adding observation:', err);
    }
  };

  // Get status chip color
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'deceased': return 'error';
      case 'transferred': return 'warning';
      case 'retired': return 'info';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !animal) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        {error || 'Animal not found'}
      </Alert>
    );
  }

  const canEdit = currentUser && ['admin', 'facility_manager', 'technician'].includes(currentUser.role);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/animals')}
          variant="outlined"
        >
          Back to Animals
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          <AnimalIcon color="primary" />
          <Typography variant="h4" component="h1">
            Animal #{animal.animal_number}
          </Typography>
          <Chip
            label={animal.status}
            color={getStatusColor(animal.status)}
            size="small"
          />
        </Box>
        {canEdit && (
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/animals/${id}/edit`)}
          >
            Edit Animal
          </Button>
        )}
      </Box>

      {/* Basic Information Card */}
      <Card sx={{ mb: 3 }}>
        <CardHeader title="Basic Information" />
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" color="textSecondary">
                Species
              </Typography>
              <Typography variant="body1">{animal.species}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" color="textSecondary">
                Strain
              </Typography>
              <Typography variant="body1">{animal.strain || 'Not specified'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" color="textSecondary">
                Sex
              </Typography>
              <Typography variant="body1">{animal.sex}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" color="textSecondary">
                Genotype
              </Typography>
              <Typography variant="body1">{animal.genotype || 'Not specified'}</Typography>
            </Grid>
            {animal.birth_date && (
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" color="textSecondary">
                  Birth Date
                </Typography>
                <Typography variant="body1">
                  {new Date(animal.birth_date).toLocaleDateString()}
                </Typography>
              </Grid>
            )}
            {animal.source && (
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" color="textSecondary">
                  Source
                </Typography>
                <Typography variant="body1">{animal.source}</Typography>
              </Grid>
            )}
            {animal.housing_location && (
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HousingIcon fontSize="small" />
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">
                      Housing
                    </Typography>
                    <Typography variant="body1">
                      {animal.housing_location}
                      {animal.housing_number && ` (${animal.housing_number})`}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs for different sections */}
      <Card>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label={`Specimens (${specimens.length})`} />
          <Tab label={`Weights (${weights.length})`} />
          <Tab label={`Observations (${observations.length})`} />
          <Tab label="Breeding" />
        </Tabs>

        <CardContent>
          {/* Specimens Tab */}
          {activeTab === 0 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Collected Specimens</Typography>
              </Box>
              {specimens.length === 0 ? (
                <Typography color="textSecondary" align="center">
                  No specimens collected from this animal
                </Typography>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Specimen #</TableCell>
                        <TableCell>Project</TableCell>
                        <TableCell>Anatomical Site</TableCell>
                        <TableCell>Collection Date</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {specimens.map((specimen) => (
                        <TableRow key={specimen.id}>
                          <TableCell>{specimen.specimen_number}</TableCell>
                          <TableCell>
                            {specimen.project_number ? `${specimen.project_number} - ${specimen.disease}` : 'No project'}
                          </TableCell>
                          <TableCell>{specimen.anatomical_site || 'Not specified'}</TableCell>
                          <TableCell>
                            {specimen.date_collected ? new Date(specimen.date_collected).toLocaleDateString() : 'Not specified'}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={specimen.activity_status || 'active'}
                              size="small"
                              color={specimen.activity_status === 'active' ? 'success' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              startIcon={<ViewIcon />}
                              onClick={() => navigate(`/specimens/${specimen.id}`)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {/* Weights Tab */}
          {activeTab === 1 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Weight History</Typography>
                {canEdit && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setWeightDialogOpen(true)}
                  >
                    Add Weight
                  </Button>
                )}
              </Box>
              {weights.length === 0 ? (
                <Typography color="textSecondary" align="center">
                  No weight records for this animal
                </Typography>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Weight (g)</TableCell>
                        <TableCell>Body Condition</TableCell>
                        <TableCell>Measured By</TableCell>
                        <TableCell>Notes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {weights.map((weight) => (
                        <TableRow key={weight.id}>
                          <TableCell>
                            {new Date(weight.measurement_date).toLocaleDateString()}
                            <Typography variant="caption" display="block" color="textSecondary">
                              {weight.days_ago} days ago
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <WeightIcon fontSize="small" />
                              {weight.weight_grams}g
                            </Box>
                          </TableCell>
                          <TableCell>
                            {weight.body_condition_score ? `${weight.body_condition_score}/5` : 'Not scored'}
                          </TableCell>
                          <TableCell>{weight.measured_by}</TableCell>
                          <TableCell>{weight.notes || 'No notes'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {/* Observations Tab */}
          {activeTab === 2 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Health Observations</Typography>
                {canEdit && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setObservationDialogOpen(true)}
                  >
                    Add Observation
                  </Button>
                )}
              </Box>
              {observations.length === 0 ? (
                <Typography color="textSecondary" align="center">
                  No observations recorded for this animal
                </Typography>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Finding</TableCell>
                        <TableCell>Severity</TableCell>
                        <TableCell>Action Taken</TableCell>
                        <TableCell>Observer</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {observations.map((obs) => (
                        <TableRow key={obs.id}>
                          <TableCell>
                            {new Date(obs.observation_date).toLocaleDateString()}
                            <Typography variant="caption" display="block" color="textSecondary">
                              {obs.days_ago} days ago
                            </Typography>
                          </TableCell>
                          <TableCell>{obs.observation_type}</TableCell>
                          <TableCell>{obs.finding}</TableCell>
                          <TableCell>
                            {obs.severity && (
                              <Chip
                                label={obs.severity}
                                size="small"
                                color={obs.severity === 'high' ? 'error' : obs.severity === 'medium' ? 'warning' : 'default'}
                              />
                            )}
                          </TableCell>
                          <TableCell>{obs.action_taken || 'None'}</TableCell>
                          <TableCell>{obs.observed_by}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {/* Breeding Tab */}
          {activeTab === 3 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <FamilyIcon />
                Breeding Information
              </Typography>
              
              <Grid container spacing={3}>
                {/* Parents */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardHeader title="Parents" subheader="Dam and sire of this animal" />
                    <CardContent>
                      {breeding.parents && (breeding.parents.dam_number || breeding.parents.sire_number) ? (
                        <Grid container spacing={2}>
                          {breeding.parents.dam_number && (
                            <Grid item xs={12}>
                              <Typography variant="subtitle2">Dam (Mother):</Typography>
                              <Typography variant="body1">
                                #{breeding.parents.dam_number}
                                {breeding.parents.dam_strain && ` - ${breeding.parents.dam_strain}`}
                              </Typography>
                            </Grid>
                          )}
                          {breeding.parents.sire_number && (
                            <Grid item xs={12}>
                              <Typography variant="subtitle2">Sire (Father):</Typography>
                              <Typography variant="body1">
                                #{breeding.parents.sire_number}
                                {breeding.parents.sire_strain && ` - ${breeding.parents.sire_strain}`}
                              </Typography>
                            </Grid>
                          )}
                        </Grid>
                      ) : (
                        <Typography color="textSecondary">No parent information available</Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* Offspring */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardHeader title="Offspring" subheader={`This animal has ${breeding.offspring.length} offspring`} />
                    <CardContent>
                      {breeding.offspring.length === 0 ? (
                        <Typography color="textSecondary">No offspring recorded</Typography>
                      ) : (
                        <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                          {breeding.offspring.map((offspring) => (
                            <Box key={offspring.id} sx={{ mb: 1, p: 1, border: 1, borderColor: 'grey.200', borderRadius: 1 }}>
                              <Typography variant="body2">
                                <strong>#{offspring.animal_number}</strong>
                                {offspring.strain && ` - ${offspring.strain}`}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {offspring.birth_date && `Born: ${new Date(offspring.birth_date).toLocaleDateString()}`}
                                {offspring.housing_location && ` | Housing: ${offspring.housing_location}`}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Weight Dialog */}
      <Dialog open={weightDialogOpen} onClose={() => setWeightDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Weight Record</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Weight (grams)"
                type="number"
                value={newWeight.weight_grams}
                onChange={(e) => setNewWeight(prev => ({ ...prev, weight_grams: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Body Condition Score"
                value={newWeight.body_condition_score}
                onChange={(e) => setNewWeight(prev => ({ ...prev, body_condition_score: e.target.value }))}
                SelectProps={{ native: true }}
              >
                <option value="">Select score</option>
                <option value="1">1 - Emaciated</option>
                <option value="2">2 - Thin</option>
                <option value="3">3 - Normal</option>
                <option value="4">4 - Overweight</option>
                <option value="5">5 - Obese</option>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="date"
                label="Measurement Date"
                value={newWeight.measurement_date}
                onChange={(e) => setNewWeight(prev => ({ ...prev, measurement_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes"
                value={newWeight.notes}
                onChange={(e) => setNewWeight(prev => ({ ...prev, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWeightDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddWeight} variant="contained" disabled={!newWeight.weight_grams}>
            Add Weight
          </Button>
        </DialogActions>
      </Dialog>

      {/* Observation Dialog */}
      <Dialog open={observationDialogOpen} onClose={() => setObservationDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Health Observation</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Observation Type"
                value={newObservation.observation_type}
                onChange={(e) => setNewObservation(prev => ({ ...prev, observation_type: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Finding"
                value={newObservation.finding}
                onChange={(e) => setNewObservation(prev => ({ ...prev, finding: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Severity"
                value={newObservation.severity}
                onChange={(e) => setNewObservation(prev => ({ ...prev, severity: e.target.value }))}
                SelectProps={{ native: true }}
              >
                <option value="">Select severity</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label="Observation Date"
                value={newObservation.observation_date}
                onChange={(e) => setNewObservation(prev => ({ ...prev, observation_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                value={newObservation.description}
                onChange={(e) => setNewObservation(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Action Taken"
                value={newObservation.action_taken}
                onChange={(e) => setNewObservation(prev => ({ ...prev, action_taken: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setObservationDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleAddObservation} 
            variant="contained" 
            disabled={!newObservation.observation_type || !newObservation.finding}
          >
            Add Observation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AnimalDetail;