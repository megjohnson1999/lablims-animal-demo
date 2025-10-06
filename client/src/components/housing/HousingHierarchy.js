import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Badge,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Breadcrumbs,
  Link,
  CircularProgress
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Business as BusinessIcon,
  Room as RoomIcon,
  ViewModule as RackIcon,
  Home as CageIcon,
  Pets as PetsIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import housingAPI from '../../services/housingAPI';
import { toast } from 'react-toastify';

const HousingHierarchy = ({ onLocationSelect, selectedLocation }) => {
  const [hierarchy, setHierarchy] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    loadHierarchy();
  }, []);

  const loadHierarchy = async () => {
    try {
      setLoading(true);
      const response = await housingAPI.getHierarchy();
      setHierarchy(response.data.hierarchy);
      setSummary(response.data.summary);
    } catch (error) {
      console.error('Error loading housing hierarchy:', error);
      toast.error('Failed to load housing hierarchy');
    } finally {
      setLoading(false);
    }
  };

  const handleAccordionChange = (panelId) => (event, isExpanded) => {
    setExpanded(prev => ({
      ...prev,
      [panelId]: isExpanded
    }));
  };

  const handleLocationClick = (building, room = null, rack = null, cage = null) => {
    const location = {
      building,
      room,
      rack,
      cage,
      path: [building, room, rack, cage].filter(Boolean).join(' > ')
    };

    if (onLocationSelect) {
      onLocationSelect(location);
    }
  };

  const getOccupancyColor = (occupancy, capacity) => {
    const rate = capacity > 0 ? (occupancy / capacity) * 100 : 0;
    if (rate === 0) return 'default';
    if (rate < 70) return 'success';
    if (rate < 90) return 'warning';
    return 'error';
  };

  const getOccupancyText = (occupancy, capacity) => {
    return `${occupancy}/${capacity}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="center" py={4}>
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Loading housing hierarchy...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      {/* Summary Stats */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          <BusinessIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Housing Overview
        </Typography>
        <Box display="flex" gap={2} flexWrap="wrap">
          <Chip
            icon={<BusinessIcon />}
            label={`${summary.buildings || 0} Buildings`}
            variant="outlined"
          />
          <Chip
            icon={<RoomIcon />}
            label={`${summary.rooms || 0} Rooms`}
            variant="outlined"
          />
          <Chip
            icon={<RackIcon />}
            label={`${summary.racks || 0} Racks`}
            variant="outlined"
          />
          <Chip
            icon={<CageIcon />}
            label={`${summary.total_units || 0} Units`}
            variant="outlined"
          />
        </Box>
      </Paper>

      {/* Hierarchy Navigation */}
      <Box>
        {hierarchy.map((building) => (
          <Accordion
            key={building.building}
            expanded={expanded[building.building] || false}
            onChange={handleAccordionChange(building.building)}
            sx={{ mb: 1 }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              onClick={(e) => {
                e.stopPropagation();
                handleLocationClick(building.building);
              }}
              sx={{
                cursor: 'pointer',
                backgroundColor: selectedLocation?.building === building.building && !selectedLocation?.room ? 'primary.50' : 'inherit',
                '&:hover': { backgroundColor: 'action.hover' }
              }}
            >
              <Box display="flex" alignItems="center" width="100%">
                <BusinessIcon sx={{ mr: 2, color: 'primary.main' }} />
                <Box flexGrow={1}>
                  <Typography variant="h6">
                    {building.building}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Capacity: {building.building_capacity || 0} |
                    Occupancy: {building.building_occupancy || 0}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip
                    size="small"
                    label={getOccupancyText(building.building_occupancy || 0, building.building_capacity || 0)}
                    color={getOccupancyColor(building.building_occupancy || 0, building.building_capacity || 0)}
                  />
                  <LinearProgress
                    variant="determinate"
                    value={building.building_capacity > 0 ? (building.building_occupancy / building.building_capacity) * 100 : 0}
                    sx={{ width: 100, height: 8, borderRadius: 4 }}
                  />
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {building.rooms && building.rooms.length > 0 ? (
                building.rooms.map((room) => (
                  <Card key={room.room} variant="outlined" sx={{ mb: 1 }}>
                    <CardContent
                      sx={{
                        py: 1,
                        cursor: 'pointer',
                        backgroundColor: selectedLocation?.building === building.building && selectedLocation?.room === room.room && !selectedLocation?.rack ? 'primary.50' : 'inherit',
                        '&:hover': { backgroundColor: 'action.hover' }
                      }}
                      onClick={() => handleLocationClick(building.building, room.room)}
                    >
                      <Box display="flex" alignItems="center">
                        <RoomIcon sx={{ mr: 2, color: 'secondary.main' }} />
                        <Box flexGrow={1}>
                          <Typography variant="subtitle1">
                            {room.room}
                          </Typography>
                          {room.racks && room.racks.length > 0 && (
                            <Typography variant="body2" color="text.secondary">
                              {room.racks.length} rack(s)
                            </Typography>
                          )}
                        </Box>
                        <Tooltip title="Navigate to room">
                          <IconButton size="small">
                            <InfoIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>

                      {/* Racks within room */}
                      {room.racks && room.racks.length > 0 && (
                        <Box mt={2} ml={4}>
                          {room.racks.map((rack) => (
                            <Box key={rack.rack}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  py: 0.5,
                                  cursor: 'pointer',
                                  backgroundColor: selectedLocation?.building === building.building && selectedLocation?.room === room.room && selectedLocation?.rack === rack.rack ? 'primary.50' : 'inherit',
                                  '&:hover': { backgroundColor: 'action.hover' },
                                  borderRadius: 1
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLocationClick(building.building, room.room, rack.rack);
                                }}
                              >
                                <RackIcon sx={{ mr: 2, color: 'text.secondary', fontSize: 18 }} />
                                <Typography variant="body2" flexGrow={1}>
                                  {rack.rack}
                                </Typography>
                                {rack.cages && rack.cages.length > 0 && (
                                  <Chip
                                    size="small"
                                    label={`${rack.cages.length} cages`}
                                    variant="outlined"
                                  />
                                )}
                              </Box>

                              {/* Cages within rack */}
                              {rack.cages && rack.cages.length > 0 && (
                                <Box mt={1} ml={6}>
                                  {rack.cages.map((cage) => (
                                    <Box
                                      key={cage.cage}
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        py: 0.25,
                                        cursor: 'pointer',
                                        backgroundColor: selectedLocation?.building === building.building && selectedLocation?.room === room.room && selectedLocation?.rack === rack.rack && selectedLocation?.cage === cage.cage ? 'primary.50' : 'inherit',
                                        '&:hover': { backgroundColor: 'action.hover' },
                                        borderRadius: 1,
                                        fontSize: '0.875rem'
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleLocationClick(building.building, room.room, rack.rack, cage.cage);
                                      }}
                                    >
                                      <CageIcon sx={{ mr: 1.5, color: 'text.disabled', fontSize: 16 }} />
                                      <Typography variant="caption" flexGrow={1}>
                                        {cage.cage}
                                      </Typography>
                                      {cage.occupancy > 0 && (
                                        <Chip
                                          size="small"
                                          label={`${cage.occupancy}/${cage.capacity}`}
                                          color={cage.occupancy >= cage.capacity ? 'error' : 'default'}
                                          sx={{ height: 16, fontSize: '0.65rem' }}
                                        />
                                      )}
                                    </Box>
                                  ))}
                                </Box>
                              )}
                            </Box>
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  No rooms configured for this building
                </Typography>
              )}
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>

      {hierarchy.length === 0 && !loading && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <InfoIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Hierarchical Housing Data
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Housing units with hierarchy information will appear here.
            Create housing units with building/room structure to see the hierarchy.
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default HousingHierarchy;