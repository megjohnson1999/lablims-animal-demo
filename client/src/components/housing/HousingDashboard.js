import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  LinearProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Tooltip,
  Badge,
  Paper
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Pets as PetsIcon,
  Home as HomeIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { canEditLabData } from '../../utils/roleUtils';
import housingAPI from '../../services/housingAPI';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const HousingDashboard = () => {
  const { currentUser } = useAuth();
  const canEdit = canEditLabData(currentUser);
  const navigate = useNavigate();
  
  const [housing, setHousing] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedHousing, setSelectedHousing] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const [newHousingData, setNewHousingData] = useState({
    location: '',
    cage_type: '',
    capacity: '',
    environmental_conditions: '',
    notes: ''
  });

  useEffect(() => {
    loadHousingData();
  }, []);

  const loadHousingData = async () => {
    try {
      setLoading(true);
      const [housingResponse, statsResponse] = await Promise.all([
        housingAPI.getAll('?limit=100'),
        housingAPI.getStats()
      ]);
      
      setHousing(housingResponse.data.housing || housingResponse.data);
      setStats(statsResponse.data);
    } catch (err) {
      toast.error('Failed to load housing data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getOccupancyColor = (occupancy) => {
    if (occupancy === 'empty') return 'default';
    if (occupancy === 'partial') return 'warning';
    if (occupancy === 'full') return 'error';
    return 'default';
  };

  const getOccupancyIcon = (occupancy) => {
    if (occupancy === 'empty') return <HomeIcon />;
    if (occupancy === 'partial') return <WarningIcon />;
    if (occupancy === 'full') return <PetsIcon />;
    return <InfoIcon />;
  };

  const calculateUtilization = (current, capacity) => {
    if (capacity === 0) return 0;
    return Math.round((current / capacity) * 100);
  };

  const handleCreateHousing = async () => {
    try {
      const housingData = {
        ...newHousingData,
        capacity: parseInt(newHousingData.capacity),
        environmental_conditions: newHousingData.environmental_conditions ? 
          JSON.stringify({ conditions: newHousingData.environmental_conditions }) : null
      };
      
      const response = await housingAPI.create(housingData);
      toast.success('Housing unit created successfully');
      setCreateDialogOpen(false);
      setNewHousingData({
        location: '',
        cage_type: '',
        capacity: '',
        environmental_conditions: '',
        notes: ''
      });
      loadHousingData();
    } catch (err) {
      toast.error('Failed to create housing unit: ' + err.message);
    }
  };

  const handleEditHousing = (house) => {
    setSelectedHousing(house);
    setEditDialogOpen(true);
  };

  if (loading) {
    return (
      <Box className="page-container">
        <Typography variant="h4" gutterBottom>Housing Management</Typography>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box className="page-container">
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Housing Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={() => navigate('/housing/cards')}
          >
            Print Cards
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadHousingData}
          >
            Refresh
          </Button>
          {canEdit && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Add Housing Unit
            </Button>
          )}
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="primary">
              {stats.active_housing_units || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Active Housing Units
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="secondary">
              {stats.total_occupancy || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Subjects Housed
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="success.main">
              {stats.utilization_rate || 0}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Facility Utilization
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="warning.main">
              {stats.empty_units || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Empty Units
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Housing Units Grid */}
      <Grid container spacing={2}>
        {housing.map((house) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={house.id}>
            <Card 
              sx={{ 
                height: '100%',
                border: house.occupancy_status === 'full' ? 2 : 1,
                borderColor: house.occupancy_status === 'full' ? 'error.main' : 'divider'
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="h6" component="div">
                    {house.housing_number || `Unit ${house.id.substring(0, 8)}`}
                  </Typography>
                  <Chip
                    icon={getOccupancyIcon(house.occupancy_status)}
                    label={house.occupancy_status}
                    color={getOccupancyColor(house.occupancy_status)}
                    size="small"
                  />
                </Box>
                
                <Typography color="text.secondary" gutterBottom>
                  <strong>Location:</strong> {house.location}
                </Typography>
                
                {house.cage_type && (
                  <Typography color="text.secondary" gutterBottom>
                    <strong>Type:</strong> {house.cage_type}
                  </Typography>
                )}
                
                <Box sx={{ mt: 2, mb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2">
                      Occupancy: {house.current_occupancy}/{house.capacity}
                    </Typography>
                    <Typography variant="body2">
                      {calculateUtilization(house.current_occupancy, house.capacity)}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={calculateUtilization(house.current_occupancy, house.capacity)}
                    color={
                      house.occupancy_status === 'full' ? 'error' :
                      house.occupancy_status === 'partial' ? 'warning' : 'primary'
                    }
                  />
                </Box>

                {house.available_spaces > 0 && (
                  <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                    {house.available_spaces} spaces available
                  </Typography>
                )}

                {house.notes && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                    {house.notes.length > 60 ? `${house.notes.substring(0, 60)}...` : house.notes}
                  </Typography>
                )}
              </CardContent>
              
              <CardActions>
                <Button 
                  size="small" 
                  startIcon={<PetsIcon />}
                  disabled={house.current_occupancy === 0}
                >
                  View Subjects ({house.total_animals_assigned})
                </Button>
                {canEdit && (
                  <IconButton 
                    size="small"
                    onClick={() => handleEditHousing(house)}
                  >
                    <EditIcon />
                  </IconButton>
                )}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Create Housing Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Housing Unit</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Location"
                  value={newHousingData.location}
                  onChange={(e) => setNewHousingData({...newHousingData, location: e.target.value})}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Housing Type</InputLabel>
                  <Select
                    value={newHousingData.cage_type}
                    onChange={(e) => setNewHousingData({...newHousingData, cage_type: e.target.value})}
                  >
                    <MenuItem value="standard">Standard Housing</MenuItem>
                    <MenuItem value="breeding">Breeding Housing</MenuItem>
                    <MenuItem value="isolation">Isolation Housing</MenuItem>
                    <MenuItem value="quarantine">Quarantine Housing</MenuItem>
                    <MenuItem value="rack_system">Rack System</MenuItem>
                    <MenuItem value="aquarium">Aquarium</MenuItem>
                    <MenuItem value="terrarium">Terrarium</MenuItem>
                    <MenuItem value="enclosure">Large Enclosure</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Capacity"
                  type="number"
                  value={newHousingData.capacity}
                  onChange={(e) => setNewHousingData({...newHousingData, capacity: e.target.value})}
                  required
                  inputProps={{ min: 1 }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Environmental Conditions"
                  multiline
                  rows={2}
                  value={newHousingData.environmental_conditions}
                  onChange={(e) => setNewHousingData({...newHousingData, environmental_conditions: e.target.value})}
                  placeholder="Temperature, humidity, lighting schedule, etc."
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  rows={2}
                  value={newHousingData.notes}
                  onChange={(e) => setNewHousingData({...newHousingData, notes: e.target.value})}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateHousing}
            variant="contained"
            disabled={!newHousingData.location || !newHousingData.capacity}
          >
            Create Housing Unit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Housing Dialog - Placeholder */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Housing Unit</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mt: 2 }}>
            Edit functionality will be implemented next. For now, use the animal management interface to assign animals to housing units.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HousingDashboard;