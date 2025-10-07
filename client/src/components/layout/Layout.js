import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Container,
  Menu,
  MenuItem,
  Avatar
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Folder as FolderIcon,
  Science as ScienceIcon,
  Label as LabelIcon,
  Settings as SettingsIcon,
  ExitToApp as LogoutIcon,
  Help as HelpIcon,
  Inventory as InventoryIcon,
  Assignment as ProtocolIcon,
  AssignmentInd as AssignmentIcon,
  Biotech as ExperimentIcon,
  Storage as MetadataIcon,
  Description as DocumentIcon,
  AdminPanelSettings as AdminIcon,
  Pets as AnimalIcon,
  Psychology as StudyIcon,
  Group as GroupIcon,
  Home as HousingIcon,
  Search as SearchIcon,
  RequestPage as RequestIcon,
  Timeline as TimelineIcon,
  Assessment as MeasurementIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';
import { useKeyboardShortcutsHelp } from '../common/KeyboardShortcutsHelp';
import NotificationBell from '../notifications/NotificationBell';
import DemoBanner from '../common/DemoBanner';

const drawerWidth = 240;

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  
  // Initialize keyboard shortcuts
  const { shortcuts } = useKeyboardShortcuts();
  const { showHelp, HelpComponent } = useKeyboardShortcutsHelp();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
  };

  const handleSettings = () => {
    handleMenuClose();
    navigate('/settings');
  };

  const handleShowHelp = () => {
    handleMenuClose();
    showHelp();
  };

  // Check user permissions
  const canManageUsers = currentUser?.role === 'admin' || currentUser?.role === 'facility_manager';
  const isFacilityManager = currentUser?.role === 'admin' || currentUser?.role === 'facility_manager';

  const menuSections = [
    {
      title: '',
      items: [
        { text: 'Dashboard', icon: <DashboardIcon />, path: '/' }
      ]
    },
    {
      title: 'Animal Colony',
      items: [
        { text: 'Animals', icon: <AnimalIcon />, path: '/animals' },
        { text: 'Housing', icon: <HousingIcon />, path: '/housing' },
        { text: 'Available Animals', icon: <SearchIcon />, path: '/animals/available' }
        // Facility Manager dashboard temporarily disabled for demo
        // ...(isFacilityManager ? [
        //   { text: 'Facility Manager', icon: <AdminIcon />, path: '/facility-manager' }
        // ] : [])
      ]
    },
    {
      title: 'Research Operations',
      items: [
        { text: 'Studies', icon: <StudyIcon />, path: '/studies' },
        { text: 'Groups', icon: <GroupIcon />, path: '/groups' },
        { text: 'Measurements', icon: <MeasurementIcon />, path: '/bulk-measurements' }
      ]
    }
  ];

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Animal Research LIMS
        </Typography>
      </Toolbar>
      <Divider />
      {menuSections.map((section, sectionIndex) => (
        <div key={sectionIndex}>
          {section.title && (
            <Typography
              variant="overline"
              sx={{
                px: 2,
                pt: 2,
                pb: 1,
                display: 'block',
                color: 'text.secondary',
                fontWeight: 600,
                fontSize: '0.75rem'
              }}
            >
              {section.title}
            </Typography>
          )}
          <List sx={{ py: section.title ? 0 : 1 }}>
            {section.items.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  onClick={() => {
                    navigate(item.path);
                    if (mobileOpen) setMobileOpen(false);
                  }}
                  sx={{ px: 2 }}
                >
                  <ListItemIcon>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          {sectionIndex < menuSections.length - 1 && <Divider sx={{ mx: 1 }} />}
        </div>
      ))}
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            LabLIMS Animal Research
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ mr: 2 }}>
              {currentUser?.username}
            </Typography>
            <NotificationBell />
            <IconButton
              size="large"
              edge="end"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              color="inherit"
            >
              <Avatar sx={{ width: 32, height: 32 }}>
                {currentUser?.first_name?.[0] || currentUser?.username?.[0] || 'U'}
              </Avatar>
            </IconButton>
          </Box>
          
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleShowHelp}>
              <ListItemIcon>
                <HelpIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Keyboard Shortcuts</ListItemText>
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Logout</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` } }}
      >
        <Toolbar />
        <DemoBanner demoType="animal" />
        <Container maxWidth="xl" sx={{ mt: 2 }}>
          <Outlet />
        </Container>
      </Box>
      
      {/* Keyboard Shortcuts Help Dialog */}
      <HelpComponent />
    </Box>
  );
};

export default Layout;