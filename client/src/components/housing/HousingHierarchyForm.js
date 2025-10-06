import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Paper,
  Chip,
  Divider,
  Alert,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Business as BusinessIcon,
  Room as RoomIcon,
  ViewModule as RackIcon,
  Home as CageIcon
} from '@mui/icons-material';
import housingAPI from '../../services/housingAPI';

const HousingHierarchyForm = ({ formData, onChange, errors = {} }) => {
  const [buildings, setBuildings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [useHierarchy, setUseHierarchy] = useState(true);
  const [loadingBuildings, setLoadingBuildings] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);

  useEffect(() => {
    loadBuildings();
  }, []);

  useEffect(() => {
    if (formData.building) {
      loadRooms(formData.building);
    } else {
      setRooms([]);
    }
  }, [formData.building]);

  const loadBuildings = async () => {
    try {
      setLoadingBuildings(true);
      const response = await housingAPI.getBuildings();
      setBuildings(response.data || []);
    } catch (error) {
      console.error('Error loading buildings:', error);
    } finally {
      setLoadingBuildings(false);
    }
  };

  const loadRooms = async (building) => {
    try {
      setLoadingRooms(true);
      const response = await housingAPI.getRooms(building);
      setRooms(response.data || []);
    } catch (error) {
      console.error('Error loading rooms:', error);
      setRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleHierarchyToggle = (event) => {
    const enabled = event.target.checked;
    setUseHierarchy(enabled);

    if (!enabled) {
      // Clear hierarchy fields when disabled
      onChange({
        ...formData,
        building: '',
        room: '',
        rack: '',
        cage: ''
      });
    } else {
      // Clear location field when hierarchy is enabled
      onChange({
        ...formData,
        location: ''
      });
    }
  };

  const handleFieldChange = (field, value) => {
    const updates = { [field]: value };

    // Clear dependent fields when parent changes
    if (field === 'building') {
      updates.room = '';
      updates.rack = '';
      updates.cage = '';
    } else if (field === 'room') {
      updates.rack = '';
      updates.cage = '';
    } else if (field === 'rack') {
      updates.cage = '';
    }

    onChange({
      ...formData,
      ...updates
    });
  };

  const generateHierarchyPreview = () => {
    const parts = [formData.building, formData.room, formData.rack, formData.cage].filter(Boolean);
    return parts.length > 0 ? parts.join(' > ') : 'No hierarchy specified';
  };

  return (
    <Box>
      {/* Location Method Toggle */}
      <Paper sx={{ p: 2, mb: 2, backgroundColor: 'grey.50' }}>
        <FormControlLabel
          control={
            <Switch
              checked={useHierarchy}
              onChange={handleHierarchyToggle}
              color="primary"
            />
          }
          label="Use hierarchical location (Building > Room > Rack > Cage)"
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {useHierarchy
            ? 'Create structured housing with building/room organization'
            : 'Use free-text location field (legacy mode)'
          }
        </Typography>
      </Paper>

      {useHierarchy ? (
        <>
          {/* Hierarchy Preview */}
          <Paper sx={{ p: 2, mb: 3, border: '1px dashed', borderColor: 'primary.main' }}>
            <Typography variant="subtitle2" gutterBottom>
              Location Preview:
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Chip
                icon={<BusinessIcon />}
                label={generateHierarchyPreview()}
                color="primary"
                variant="outlined"
              />
            </Box>
          </Paper>

          {/* Hierarchical Fields */}
          <Grid container spacing={3}>
            {/* Building */}
            <Grid item xs={12} md={6}>
              <Autocomplete
                freeSolo
                options={buildings}
                value={formData.building || ''}
                onChange={(event, newValue) => handleFieldChange('building', newValue || '')}
                onInputChange={(event, newInputValue) => handleFieldChange('building', newInputValue || '')}
                loading={loadingBuildings}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Building"
                    placeholder="e.g., Building A, Vivarium 1"
                    error={!!errors.building}
                    helperText={errors.building || 'Enter or select a building'}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: <BusinessIcon sx={{ mr: 1, color: 'action.active' }} />
                    }}
                  />
                )}
              />
            </Grid>

            {/* Room */}
            <Grid item xs={12} md={6}>
              <Autocomplete
                freeSolo
                options={rooms}
                value={formData.room || ''}
                onChange={(event, newValue) => handleFieldChange('room', newValue || '')}
                onInputChange={(event, newInputValue) => handleFieldChange('room', newInputValue || '')}
                loading={loadingRooms}
                disabled={!formData.building}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Room"
                    placeholder="e.g., Room 101, Surgery Suite"
                    error={!!errors.room}
                    helperText={errors.room || (formData.building ? 'Enter or select a room' : 'Select building first')}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: <RoomIcon sx={{ mr: 1, color: 'action.active' }} />
                    }}
                  />
                )}
              />
            </Grid>

            {/* Rack */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Rack (Optional)"
                placeholder="e.g., Rack 1, West Wall"
                value={formData.rack || ''}
                onChange={(e) => handleFieldChange('rack', e.target.value)}
                disabled={!formData.room}
                error={!!errors.rack}
                helperText={errors.rack || (formData.room ? 'Optional rack identifier' : 'Select room first')}
                InputProps={{
                  startAdornment: <RackIcon sx={{ mr: 1, color: 'action.active' }} />
                }}
              />
            </Grid>

            {/* Cage */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Cage (Optional)"
                placeholder="e.g., Cage 5, A-101"
                value={formData.cage || ''}
                onChange={(e) => handleFieldChange('cage', e.target.value)}
                disabled={!formData.building}
                error={!!errors.cage}
                helperText={errors.cage || 'Optional cage identifier'}
                InputProps={{
                  startAdornment: <CageIcon sx={{ mr: 1, color: 'action.active' }} />
                }}
              />
            </Grid>
          </Grid>

          {/* Info Alert */}
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Hierarchy Tips:</strong>
              <br />• Building is required for hierarchical organization
              <br />• Room helps organize multiple housing units within a building
              <br />• Rack and Cage are optional for more specific location tracking
              <br />• You can type new values or select from existing ones
            </Typography>
          </Alert>
        </>
      ) : (
        /* Legacy Location Field */
        <TextField
          fullWidth
          label="Location"
          placeholder="e.g., Building A, Room 101"
          value={formData.location || ''}
          onChange={(e) => handleFieldChange('location', e.target.value)}
          error={!!errors.location}
          helperText={errors.location || 'Free-text location description'}
          sx={{ mb: 2 }}
        />
      )}
    </Box>
  );
};

export default HousingHierarchyForm;