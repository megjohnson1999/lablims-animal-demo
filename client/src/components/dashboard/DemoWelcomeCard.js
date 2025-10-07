import React from 'react';
import { Card, CardContent, Typography, Grid, Button, Box, Chip, Stack } from '@mui/material';
import {
  Pets as AnimalsIcon,
  Science as StudyIcon,
  Home as HousingIcon,
  Assessment as MeasurementsIcon,
  RequestPage as RequestsIcon,
  ArrowForward
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const DemoWelcomeCard = ({ stats }) => {
  const navigate = useNavigate();

  const features = [
    {
      title: 'Animal Inventory',
      description: 'Track animals, strains, and availability',
      icon: <AnimalsIcon fontSize="large" color="primary" />,
      path: '/animals',
      stat: `${stats.animals || 0} animals`
    },
    {
      title: 'Housing Management',
      description: 'Hierarchical cage organization',
      icon: <HousingIcon fontSize="large" color="secondary" />,
      path: '/housing',
      stat: 'Building → Room → Cage'
    },
    {
      title: 'Research Studies',
      description: 'Link animals to research protocols',
      icon: <StudyIcon fontSize="large" color="success" />,
      path: '/studies',
      stat: `${stats.studies || 0} active studies`
    },
    {
      title: 'Measurements & Charts',
      description: 'Track weights and observations',
      icon: <MeasurementsIcon fontSize="large" color="info" />,
      path: '/measurements',
      stat: 'Time-series data'
    },
    {
      title: 'Animal Claims',
      description: 'Request and approve animal assignments',
      icon: <RequestsIcon fontSize="large" color="warning" />,
      path: '/facility-manager',
      stat: 'Approval workflow'
    }
  ];

  return (
    <Card sx={{ mb: 3, background: '#0f172a', color: 'white' }}>
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 'bold' }}>
            Welcome to LabLIMS Animal Research Demo
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9 }}>
            Managing {stats.animals || 0} animals across {stats.studies || 0} active research studies
          </Typography>
        </Box>

        <Typography variant="body1" sx={{ mb: 3, opacity: 0.95 }}>
          This interactive demo showcases a complete animal facility management system.
          Explore the features below to see how LabLIMS streamlines your research workflow.
        </Typography>

        <Grid container spacing={2}>
          {features.map((feature) => (
            <Grid item xs={12} sm={6} md={4} key={feature.title}>
              <Card
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 6
                  }
                }}
                onClick={() => navigate(feature.path)}
              >
                <CardContent>
                  <Stack spacing={1.5}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {feature.icon}
                      <ArrowForward color="action" />
                    </Box>
                    <Typography variant="h6" component="h3" sx={{ fontWeight: 'bold' }}>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {feature.description}
                    </Typography>
                    <Chip
                      label={feature.stat}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/animals')}
            sx={{
              bgcolor: 'white',
              color: 'primary.main',
              '&:hover': { bgcolor: 'grey.100' }
            }}
          >
            Start with Animals
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate('/housing')}
            sx={{
              borderColor: 'white',
              color: 'white',
              '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
            }}
          >
            View Housing Dashboard
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default DemoWelcomeCard;
