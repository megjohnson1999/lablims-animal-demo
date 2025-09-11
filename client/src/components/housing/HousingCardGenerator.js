import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Tabs,
  Tab,
  Divider,
  Grid,
  TextField,
  MenuItem,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Switch
} from '@mui/material';
import {
  Print as PrintIcon,
  Search as SearchIcon,
  GetApp as DownloadIcon,
  Refresh as RefreshIcon,
  PreviewIcon
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { canEditLabData } from '../../utils/roleUtils';
import housingAPI from '../../services/housingAPI';
import { animalAPI } from '../../services/api';
import { toast } from 'react-toastify';
import HousingCard from './HousingCard';

const HousingCardGenerator = () => {
  const { currentUser } = useAuth();
  const canEdit = canEditLabData(currentUser);
  
  const [tabValue, setTabValue] = useState(0);
  const [housing, setHousing] = useState([]);
  const [selectedHousing, setSelectedHousing] = useState([]);
  const [housingSubjects, setHousingSubjects] = useState({});
  
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [occupancyFilter, setOccupancyFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [cardSize, setCardSize] = useState('standard');
  const [showSubjectDetails, setShowSubjectDetails] = useState(true);
  const [includeEmpty, setIncludeEmpty] = useState(true);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedForPreview, setSelectedForPreview] = useState(null);

  useEffect(() => {
    loadHousing();
  }, []);

  const loadHousing = async () => {
    try {
      setLoading(true);
      const response = await housingAPI.getAll('?limit=200');
      const housingData = response.data.housing || response.data;
      setHousing(housingData);
      
      // Load subjects for each housing unit
      const subjectsData = {};
      for (const house of housingData) {
        if (house.current_occupancy > 0) {
          try {
            const subjectsResponse = await animalAPI.getAll(`?housing_id=${house.id}&limit=50`);
            subjectsData[house.id] = subjectsResponse.data.animals || [];
          } catch (err) {
            console.warn(`Failed to load subjects for housing ${house.id}:`, err);
            subjectsData[house.id] = [];
          }
        } else {
          subjectsData[house.id] = [];
        }
      }
      setHousingSubjects(subjectsData);
    } catch (err) {
      setError('Failed to load housing data: ' + err.message);
      toast.error('Failed to load housing data');
    } finally {
      setLoading(false);
    }
  };

  const filteredHousing = housing.filter(house => {
    // Search filter
    if (searchTerm && !house.housing_number?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !house.location?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !house.id?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    // Location filter
    if (locationFilter && !house.location?.toLowerCase().includes(locationFilter.toLowerCase())) {
      return false;
    }
    
    // Type filter
    if (typeFilter && house.cage_type !== typeFilter) {
      return false;
    }
    
    // Occupancy filter
    if (occupancyFilter !== 'all') {
      if (occupancyFilter === 'occupied' && house.current_occupancy === 0) return false;
      if (occupancyFilter === 'empty' && house.current_occupancy > 0) return false;
      if (occupancyFilter === 'full' && house.current_occupancy < house.capacity) return false;
    }
    
    return true;
  });

  const handleSelectAll = () => {
    const filtered = includeEmpty ? filteredHousing : filteredHousing.filter(h => h.current_occupancy > 0);
    if (selectedHousing.length === filtered.length) {
      setSelectedHousing([]);
    } else {
      setSelectedHousing(filtered);
    }
  };

  const handleHousingSelect = (house) => {
    setSelectedHousing(prev => {
      const exists = prev.find(h => h.id === house.id);
      if (exists) {
        return prev.filter(h => h.id !== house.id);
      } else {
        return [...prev, house];
      }
    });
  };

  const handlePreview = (house) => {
    setSelectedForPreview(house);
    setPreviewDialogOpen(true);
  };

  const handlePrintCards = () => {
    if (selectedHousing.length === 0) {
      toast.error('Please select at least one housing unit');
      return;
    }

    // Create print content
    const printContent = selectedHousing.map((house, index) => (
      `<div key="${house.id}" style="page-break-after: ${index < selectedHousing.length - 1 ? 'always' : 'auto'};">
        <div id="housing-card-${house.id}"></div>
      </div>`
    )).join('');

    // Open print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Housing Cards</title>
          <style>
            @page { 
              size: auto; 
              margin: 0.5in; 
            }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 0;
            }
            .page-break {
              page-break-before: always;
            }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            // Auto-print when ready
            window.onload = function() {
              setTimeout(() => {
                window.print();
                window.close();
              }, 1000);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();

    toast.success(`Print dialog opened for ${selectedHousing.length} housing cards`);
  };

  const getOccupancyChip = (house) => {
    const occupancy = house.current_occupancy;
    const capacity = house.capacity;
    
    if (occupancy === 0) {
      return <Chip label="Empty" color="default" size="small" />;
    } else if (occupancy >= capacity) {
      return <Chip label="Full" color="error" size="small" />;
    } else {
      return <Chip label="Partial" color="warning" size="small" />;
    }
  };

  return (
    <Box className="page-container">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Housing Card Generator
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadHousing}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrintCards}
            disabled={selectedHousing.length === 0}
          >
            Print Selected ({selectedHousing.length})
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Card Settings */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Card Settings</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Card Size</InputLabel>
              <Select
                value={cardSize}
                onChange={(e) => setCardSize(e.target.value)}
              >
                <MenuItem value="small">Small (3×2 in)</MenuItem>
                <MenuItem value="standard">Standard (4×3 in)</MenuItem>
                <MenuItem value="large">Large (5×4 in)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={showSubjectDetails}
                  onChange={(e) => setShowSubjectDetails(e.target.checked)}
                />
              }
              label="Show Subject Details"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={includeEmpty}
                  onChange={(e) => setIncludeEmpty(e.target.checked)}
                />
              }
              label="Include Empty Units"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Filters</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Unit ID, location..."
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Location"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              placeholder="Filter by location..."
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Housing Type</InputLabel>
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="standard">Standard</MenuItem>
                <MenuItem value="breeding">Breeding</MenuItem>
                <MenuItem value="isolation">Isolation</MenuItem>
                <MenuItem value="quarantine">Quarantine</MenuItem>
                <MenuItem value="aquarium">Aquarium</MenuItem>
                <MenuItem value="terrarium">Terrarium</MenuItem>
                <MenuItem value="enclosure">Enclosure</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Occupancy</InputLabel>
              <Select
                value={occupancyFilter}
                onChange={(e) => setOccupancyFilter(e.target.value)}
              >
                <MenuItem value="all">All Units</MenuItem>
                <MenuItem value="occupied">Occupied Only</MenuItem>
                <MenuItem value="empty">Empty Only</MenuItem>
                <MenuItem value="full">Full Only</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Housing Selection Table */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Select Housing Units ({filteredHousing.length} available)
          </Typography>
          <Button 
            onClick={handleSelectAll}
            variant="outlined"
            size="small"
          >
            {selectedHousing.length === (includeEmpty ? filteredHousing : filteredHousing.filter(h => h.current_occupancy > 0)).length 
              ? 'Deselect All' : 'Select All'}
          </Button>
        </Box>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedHousing.length > 0 && selectedHousing.length === (includeEmpty ? filteredHousing : filteredHousing.filter(h => h.current_occupancy > 0)).length}
                      indeterminate={selectedHousing.length > 0 && selectedHousing.length < (includeEmpty ? filteredHousing : filteredHousing.filter(h => h.current_occupancy > 0)).length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell>Unit ID</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Occupancy</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(includeEmpty ? filteredHousing : filteredHousing.filter(h => h.current_occupancy > 0))
                  .map((house) => (
                  <TableRow key={house.id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedHousing.some(h => h.id === house.id)}
                        onChange={() => handleHousingSelect(house)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {house.housing_number || `HSG-${house.id.substring(0, 6)}`}
                      </Typography>
                    </TableCell>
                    <TableCell>{house.location}</TableCell>
                    <TableCell>{house.cage_type || 'Standard'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getOccupancyChip(house)}
                        <Typography variant="body2">
                          {house.current_occupancy}/{house.capacity}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={house.status || 'active'} 
                        color={house.status === 'active' ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        onClick={() => handlePreview(house)}
                      >
                        Preview
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Preview Dialog */}
      <Dialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Housing Card Preview</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            {selectedForPreview && (
              <HousingCard
                housing={selectedForPreview}
                subjects={housingSubjects[selectedForPreview.id] || []}
                showDetails={showSubjectDetails}
                cardSize={cardSize}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
          {selectedForPreview && (
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={() => {
                setSelectedHousing([selectedForPreview]);
                setPreviewDialogOpen(false);
                setTimeout(handlePrintCards, 100);
              }}
            >
              Print This Card
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HousingCardGenerator;