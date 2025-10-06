import React from 'react';
import { Alert, Box, Button, Chip, Stack } from '@mui/material';
import { Science, Launch, ContactMail } from '@mui/icons-material';

const DemoBanner = ({ demoType = 'animal' }) => {
  const demoConfig = {
    animal: {
      title: 'LabLIMS for Animal Research Facilities',
      description: 'Exploring as Facility Manager',
      otherDemoUrl: process.env.REACT_APP_CLINICAL_DEMO_URL || '#',
      otherDemoLabel: 'View Clinical Demo'
    },
    clinical: {
      title: 'LabLIMS for Clinical Diagnostics',
      description: 'Exploring as Lab Manager',
      otherDemoUrl: process.env.REACT_APP_ANIMAL_DEMO_URL || '#',
      otherDemoLabel: 'View Animal Research Demo'
    }
  };

  const config = demoConfig[demoType];

  return (
    <Alert
      severity="info"
      sx={{
        borderRadius: 0,
        '& .MuiAlert-message': { width: '100%' }
      }}
      icon={<Science />}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Box>
            <strong>🎯 DEMO MODE</strong> - {config.title}
          </Box>
          <Chip
            label={config.description}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Launch />}
            href={config.otherDemoUrl}
            target="_blank"
            sx={{ textTransform: 'none' }}
          >
            {config.otherDemoLabel}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ContactMail />}
            href={process.env.REACT_APP_MAIN_SITE_URL || 'https://lablims.com'}
            target="_blank"
            sx={{ textTransform: 'none' }}
          >
            Learn More
          </Button>
        </Stack>
      </Box>
    </Alert>
  );
};

export default DemoBanner;
