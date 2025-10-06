import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip
} from '@mui/material';
import {
  Pets as AnimalsIcon,
  Home as HousingIcon,
  Psychology as StudyIcon,
  Assessment as MeasurementIcon,
  RequestPage as ClaimIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';

const WelcomeModal = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Check if user has visited before
    const hasVisited = localStorage.getItem('lablims_demo_visited');
    if (!hasVisited) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('lablims_demo_visited', 'true');
    setOpen(false);
  };

  const features = [
    {
      icon: <AnimalsIcon color="primary" />,
      title: 'Animal Inventory',
      description: 'Browse 21 sample animals with strain and availability tracking'
    },
    {
      icon: <HousingIcon color="secondary" />,
      title: 'Housing Dashboard',
      description: 'Explore hierarchical cage organization (Building → Room → Rack → Cage)'
    },
    {
      icon: <StudyIcon color="success" />,
      title: 'Research Studies',
      description: 'View 4 active studies with IACUC protocols and animal assignments'
    },
    {
      icon: <MeasurementIcon color="info" />,
      title: 'Measurements & Charts',
      description: 'Track weight and observation data over time with visualizations'
    },
    {
      icon: <ClaimIcon color="warning" />,
      title: 'Animal Claims System',
      description: 'Experience the approval workflow for requesting and assigning animals'
    }
  ];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }
      }}
    >
      <DialogTitle>
        <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', mb: 1 }}>
          Welcome to LabLIMS Animal Research Demo! 🎯
        </Typography>
        <Chip
          label="Logged in as Facility Manager"
          size="small"
          sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 'bold' }}
        />
      </DialogTitle>

      <DialogContent>
        <Box sx={{ bgcolor: 'white', color: 'text.primary', borderRadius: 2, p: 3, mb: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
            What You Can Explore:
          </Typography>
          <List>
            {features.map((feature, index) => (
              <React.Fragment key={index}>
                <ListItem>
                  <ListItemIcon>{feature.icon}</ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        {feature.title}
                      </Typography>
                    }
                    secondary={feature.description}
                  />
                </ListItem>
                {index < features.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Box>

        <Box sx={{ bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2, p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckIcon /> Quick Tips:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 2, mt: 1 }}>
            <li>All data is pre-populated with realistic research scenarios</li>
            <li>This is a read-only demo - explore all features freely!</li>
            <li>Want to test creating your own data? Click any "Add" button to request a personalized demo</li>
            <li>Use the banner at the top to visit our clinical diagnostics demo</li>
            <li>Navigate between sections using the sidebar</li>
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button
          onClick={handleClose}
          variant="contained"
          size="large"
          fullWidth
          sx={{
            bgcolor: 'white',
            color: 'primary.main',
            fontWeight: 'bold',
            '&:hover': { bgcolor: 'grey.100' }
          }}
        >
          Start Exploring
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WelcomeModal;
