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
  // Generate a more barcode-friendly text
  const barcodeText = housing?.housing_number
    ? `HSG${String(housing.housing_number).padStart(6, '0')}`
    : `HSG${housing?.id?.substring(0, 6) || '000000'}`;
  
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
        margin: '0.5in',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}
      {...props}
    >
      {/* Header with Barcode */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5, gap: 1 }}>
        {/* Left side: Title and details */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="h6"
            sx={{
              fontSize: size.titleSize,
              fontWeight: 'bold',
              textTransform: 'uppercase',
              mb: 0.5
            }}
          >
            Housing Unit
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontSize: size.fontSize,
              fontWeight: 'bold',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {housing.housing_number || `HSG-${housing.id?.substring(0, 6)}`}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontSize: size.fontSize,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {housing.location}
          </Typography>
        </Box>

        {/* Right side: Barcode */}
        <Box sx={{ flexShrink: 0, maxWidth: '45%' }}>
          <Barcode
            value={barcodeText}
            height={size.barcodeHeight}
            showValue={true}
            options={{
              width: 1.2,
              fontSize: 10,
              displayValue: true,
              margin: 0
            }}
          />
        </Box>
      </Box>

      <Divider sx={{ my: 0.5 }} />

      {/* Compact Details Grid */}
      <Grid container spacing={0.5} sx={{ mb: 0.5 }}>
        <Grid item xs={6}>
          <Typography variant="body2" sx={{ fontSize: size.fontSize }}>
            <strong>Type:</strong> {getHousingTypeDisplay(housing.cage_type)}
          </Typography>
        </Grid>
        <Grid item xs={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
            <Typography variant="body2" sx={{ fontSize: size.fontSize }}>
              <strong>Occupancy:</strong>
            </Typography>
            <Chip
              label={`${housing.current_occupancy}/${housing.capacity}`}
              color={getOccupancyColor()}
              size="small"
              sx={{ fontSize: size.fontSize, height: 20 }}
            />
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Divider sx={{ my: 0.5 }} />
        </Grid>

        {/* Subjects and Environment in two columns */}
        {showDetails && subjects.length > 0 && (
          <Grid item xs={housing.environmental_conditions ? 7 : 12}>
            <Typography
              variant="body2"
              sx={{ fontSize: size.fontSize, fontWeight: 'bold', mb: 0.25 }}
            >
              Subjects:
            </Typography>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: subjects.length > 3 ? '1fr 1fr' : '1fr',
              gap: 0.25,
              fontSize: size.fontSize
            }}>
              {subjects.map((subject, index) => (
                <Typography
                  key={subject.id || index}
                  variant="body2"
                  sx={{
                    fontSize: size.fontSize,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2
                  }}
                >
                  • {subject.animal_number || subject.id?.substring(0, 8)} ({subject.sex || '?'})
                </Typography>
              ))}
            </Box>
          </Grid>
        )}

        {housing.environmental_conditions &&
         showDetails &&
         (typeof housing.environmental_conditions === 'string' ? housing.environmental_conditions.trim() : housing.environmental_conditions) &&
         (
          <Grid item xs={5}>
            <Typography
              variant="body2"
              sx={{ fontSize: size.fontSize, fontWeight: 'bold', mb: 0.25 }}
            >
              Environment:
            </Typography>
            <Box sx={{ fontSize: size.fontSize, lineHeight: 1.3 }}>
              {(() => {
                // Parse environmental conditions
                let envData = housing.environmental_conditions;
                if (typeof envData === 'string') {
                  try {
                    envData = JSON.parse(envData);
                  } catch {
                    return (
                      <Typography variant="body2" sx={{ fontSize: size.fontSize }}>
                        {envData}
                      </Typography>
                    );
                  }
                }

                // Format environmental parameters vertically for better space usage
                return (
                  <>
                    {envData.temperature && (
                      <Typography variant="body2" sx={{ fontSize: size.fontSize, lineHeight: 1.2 }}>
                        {envData.temperature}
                      </Typography>
                    )}
                    {envData.humidity && (
                      <Typography variant="body2" sx={{ fontSize: size.fontSize, lineHeight: 1.2 }}>
                        {envData.humidity} RH
                      </Typography>
                    )}
                    {envData.lighting && (
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: size.fontSize,
                          lineHeight: 1.2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {envData.lighting}
                      </Typography>
                    )}
                  </>
                );
              })()}
            </Box>
          </Grid>
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