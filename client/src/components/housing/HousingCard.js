import React from 'react';
import { 
  Box, 
  Typography, 
  Paper,
  Grid,
  Divider,
  Chip
} from '@mui/material';
import Barcode from '../common/Barcode';

const HousingCard = ({ 
  housing,
  subjects = [],
  showDetails = true,
  cardSize = 'standard', // 'standard', 'small', 'large'
  ...props 
}) => {
  const barcodeText = housing?.housing_number || housing?.id?.substring(0, 8);
  
  const cardSizes = {
    small: {
      width: '3in',
      height: '2in',
      barcodeHeight: 50,
      fontSize: '0.6rem',
      titleSize: '0.8rem',
      padding: 1
    },
    standard: {
      width: '4in',
      height: '3in', 
      barcodeHeight: 60,
      fontSize: '0.7rem',
      titleSize: '1rem',
      padding: 2
    },
    large: {
      width: '5in',
      height: '4in',
      barcodeHeight: 80,
      fontSize: '0.8rem',
      titleSize: '1.1rem',
      padding: 2
    }
  };

  const size = cardSizes[cardSize] || cardSizes.standard;

  if (!housing) {
    return (
      <Paper 
        sx={{ 
          width: size.width,
          height: size.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid #ddd',
          backgroundColor: '#f5f5f5'
        }}
      >
        <Typography variant="body2">No housing data</Typography>
      </Paper>
    );
  }

  const getOccupancyColor = () => {
    if (housing.current_occupancy === 0) return 'default';
    if (housing.current_occupancy >= housing.capacity) return 'error';
    return 'warning';
  };

  const getHousingTypeDisplay = (type) => {
    const types = {
      'standard': 'Standard',
      'breeding': 'Breeding',
      'isolation': 'Isolation',
      'quarantine': 'Quarantine',
      'rack_system': 'Rack',
      'aquarium': 'Aquarium',
      'terrarium': 'Terrarium',
      'enclosure': 'Enclosure'
    };
    return types[type] || type;
  };

  return (
    <Paper 
      sx={{ 
        width: size.width,
        height: size.height,
        padding: size.padding,
        border: '2px solid #000',
        backgroundColor: '#fff',
        display: 'flex',
        flexDirection: 'column',
        pageBreakInside: 'avoid',
        margin: '0.5in'
      }}
      {...props}
    >
      {/* Header Section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography 
          variant="h6" 
          sx={{ 
            fontSize: size.titleSize, 
            fontWeight: 'bold',
            textTransform: 'uppercase'
          }}
        >
          Housing Unit
        </Typography>
        <Chip
          label={`${housing.current_occupancy}/${housing.capacity}`}
          color={getOccupancyColor()}
          size="small"
          sx={{ fontSize: size.fontSize }}
        />
      </Box>

      {/* Barcode Section */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
        <Barcode 
          value={barcodeText} 
          height={size.barcodeHeight}
          width={1.5}
          fontSize={12}
          displayValue={true}
        />
      </Box>

      {/* Housing Details */}
      <Grid container spacing={0.5} sx={{ flexGrow: 1 }}>
        <Grid item xs={12}>
          <Typography 
            variant="body2" 
            sx={{ fontSize: size.fontSize, fontWeight: 'bold' }}
          >
            Unit ID: {housing.housing_number || `HSG-${housing.id?.substring(0, 6)}`}
          </Typography>
        </Grid>
        
        <Grid item xs={12}>
          <Typography 
            variant="body2" 
            sx={{ fontSize: size.fontSize }}
          >
            <strong>Location:</strong> {housing.location}
          </Typography>
        </Grid>

        {housing.cage_type && (
          <Grid item xs={12}>
            <Typography 
              variant="body2" 
              sx={{ fontSize: size.fontSize }}
            >
              <strong>Type:</strong> {getHousingTypeDisplay(housing.cage_type)}
            </Typography>
          </Grid>
        )}

        <Grid item xs={12}>
          <Typography 
            variant="body2" 
            sx={{ fontSize: size.fontSize }}
          >
            <strong>Capacity:</strong> {housing.capacity} subjects
          </Typography>
        </Grid>

        {showDetails && subjects.length > 0 && (
          <>
            <Grid item xs={12}>
              <Divider sx={{ my: 0.5 }} />
            </Grid>
            <Grid item xs={12}>
              <Typography 
                variant="body2" 
                sx={{ fontSize: size.fontSize, fontWeight: 'bold' }}
              >
                Current Subjects:
              </Typography>
              <Box sx={{ maxHeight: '1in', overflow: 'hidden' }}>
                {subjects.slice(0, 6).map((subject, index) => (
                  <Typography 
                    key={subject.id || index}
                    variant="body2" 
                    sx={{ fontSize: size.fontSize }}
                  >
                    • {subject.animal_number || subject.id?.substring(0, 8)} 
                    {subject.species && ` (${subject.species})`}
                    {subject.sex && ` - ${subject.sex}`}
                  </Typography>
                ))}
                {subjects.length > 6 && (
                  <Typography 
                    variant="body2" 
                    sx={{ fontSize: size.fontSize, fontStyle: 'italic' }}
                  >
                    ... and {subjects.length - 6} more
                  </Typography>
                )}
              </Box>
            </Grid>
          </>
        )}

        {housing.environmental_conditions && showDetails && (
          <>
            <Grid item xs={12}>
              <Divider sx={{ my: 0.5 }} />
            </Grid>
            <Grid item xs={12}>
              <Typography 
                variant="body2" 
                sx={{ fontSize: size.fontSize }}
              >
                <strong>Environment:</strong>
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontSize: size.fontSize, 
                  fontStyle: 'italic',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {typeof housing.environmental_conditions === 'string' 
                  ? housing.environmental_conditions 
                  : JSON.stringify(housing.environmental_conditions).slice(0, 50) + '...'
                }
              </Typography>
            </Grid>
          </>
        )}
      </Grid>

      {/* Footer */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
        <Typography 
          variant="body2" 
          sx={{ fontSize: size.fontSize, color: 'text.secondary' }}
        >
          Generated: {new Date().toLocaleDateString()}
        </Typography>
        <Typography 
          variant="body2" 
          sx={{ fontSize: size.fontSize, color: 'text.secondary' }}
        >
          Status: {housing.status || 'active'}
        </Typography>
      </Box>
    </Paper>
  );
};

export default HousingCard;