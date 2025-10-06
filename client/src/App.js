import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layout Components
import Layout from './components/layout/Layout';

// Auth Components
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ForcedPasswordChangeDialog from './components/auth/ForcedPasswordChangeDialog';

// Dashboard
import Dashboard from './components/dashboard/Dashboard';

// Legacy collaborator and project components removed - consolidated into Studies

// Patient components removed - not needed for animal research LIMS

// Specimen Components
import SpecimenList from './components/specimens/SpecimenList';
import SpecimenDetail from './components/specimens/SpecimenDetail';
import SpecimenForm from './components/specimens/SpecimenForm';
import BulkImport from './components/specimens/BulkImport';

// Biological Samples Components
import BiologicalSamplesList from './components/biologicalSamples/BiologicalSamplesList';
import BiologicalSampleForm from './components/biologicalSamples/BiologicalSampleForm';
import BiologicalSampleDetail from './components/biologicalSamples/BiologicalSampleDetail';

// Animal Components
import AnimalList from './components/animals/AnimalList';
import AnimalForm from './components/animals/AnimalForm';
import AnimalDetail from './components/animals/AnimalDetail';
import AvailableAnimalsList from './components/animals/AvailableAnimalsList';
import AnimalRequestForm from './components/animals/AnimalRequestForm';
import BulkMeasurementEntry from './components/measurements/BulkMeasurementEntry';

// Animal Request Pages
import AnimalRequests from './pages/AnimalRequests';

// Facility Manager Components
import FacilityManagerDashboard from './components/facility/FacilityManagerDashboard';

// Housing Components
import HousingDashboard from './components/housing/HousingDashboard';
import HousingCardGenerator from './components/housing/HousingCardGenerator';

// Experimental Components
import { 
  ExperimentalStudiesList, 
  ExperimentalStudyForm, 
  ExperimentalStudyDetail,
  ExperimentalGroupsList,
  ExperimentalGroupDetail
} from './components/experimental';

// Inventory Components
import InventoryList from './components/inventory/InventoryList';
import InventoryForm from './components/inventory/InventoryForm';

// Protocol Components
import ProtocolList from './components/protocols/ProtocolList';
import ProtocolDetail from './components/protocols/ProtocolDetail';
import ProtocolForm from './components/protocols/ProtocolForm';
import DocumentLibrary from './components/protocols/DocumentLibrary';

// Experiment Components
import ExperimentList from './components/experiments/ExperimentList';
import ExperimentForm from './components/experiments/ExperimentForm';
import ExperimentView from './components/experiments/ExperimentView';

// Complex import components removed - keeping basic specimen import only

// Label Components
import LabelGenerator from './components/labels/LabelGenerator';

// Metadata components removed - simplified for animal research

// Settings
import UserSettings from './components/settings/UserSettings';

// Admin Components
import UserManagement from './components/admin/UserManagement';

// Context
import { useAuth } from './context/AuthContext';
import { LoadingProvider } from './context/LoadingContext';
import { DemoProvider } from './context/DemoContext';

// Demo Components
import DemoContactModal from './components/common/DemoContactModal';

const theme = createTheme({
  palette: {
    primary: {
      main: '#0077b6',
    },
    secondary: {
      main: '#48cae4',
    },
    background: {
      default: '#f8f9fa',
    },
  },
  typography: {
    fontFamily: [
      'Roboto',
      'Arial',
      'sans-serif',
    ].join(','),
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});

function App() {
  const { 
    isAuthenticated, 
    loading, 
    currentUser, 
    showPasswordChangeDialog, 
    handlePasswordChanged 
  } = useAuth();

  // Debug: Rendering App component

  if (loading) {
    // Debug: App loading
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '20px',
        backgroundColor: '#f5f5f5'
      }}>
        <h2>Loading Animal Research LIMS...</h2>
        <div style={{ 
          border: '4px solid #0077b6', 
          borderRadius: '50%', 
          borderTopColor: 'transparent',
          width: '40px', 
          height: '40px',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Debug: App loaded
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <DemoProvider>
        <LoadingProvider>
          <DemoContactModal />
          <ToastContainer position="top-right" autoClose={5000} />
        <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" />} />
        
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          
          {/* Studies Routes (combines Projects + Experimental Studies) */}
          <Route path="studies">
            <Route index element={<ExperimentalStudiesList />} />
            <Route path=":id" element={<ExperimentalStudyDetail />} />
            <Route path="new" element={<ExperimentalStudyForm />} />
            <Route path="edit/:id" element={<ExperimentalStudyForm />} />
          </Route>
          
          {/* Patient routes removed - replaced by animal management */}
          
          {/* Biological Samples Routes (replaces old specimens system) */}
          <Route path="biological-samples">
            <Route index element={<BiologicalSamplesList />} />
            <Route path="new" element={<BiologicalSampleForm />} />
            <Route path=":id" element={<BiologicalSampleDetail />} />
            <Route path=":id/edit" element={<BiologicalSampleForm />} />
          </Route>
          
          {/* Legacy Specimen Routes (kept for transition) */}
          <Route path="specimens">
            <Route index element={<SpecimenList />} />
            <Route path="new" element={<SpecimenForm />} />
            <Route path="import" element={<BulkImport />} />
            {/* Complex import routes removed - keeping basic import only */}
            <Route path="edit/:id" element={<SpecimenForm />} />
            <Route path=":id" element={<SpecimenDetail />} />
          </Route>
          
          {/* Animal Routes */}
          <Route path="animals">
            <Route index element={<AnimalList />} />
            <Route path="available" element={<AvailableAnimalsList />} />
            <Route path="new" element={<AnimalForm />} />
            <Route path=":id" element={<AnimalDetail />} />
            <Route path=":id/edit" element={<AnimalForm />} />
          </Route>

          {/* Animal Request Routes */}
          <Route path="animal-requests">
            <Route index element={<AnimalRequests />} />
            <Route path="new" element={<AnimalRequestForm />} />
          </Route>

          {/* Facility Manager Routes */}
          <Route path="facility-manager" element={<FacilityManagerDashboard />} />
          {/* Bulk Measurement Entry */}
          <Route path="bulk-measurements" element={<BulkMeasurementEntry />} />
          
          {/* Housing Routes */}
          <Route path="housing">
            <Route index element={<HousingDashboard />} />
            <Route path="cards" element={<HousingCardGenerator />} />
          </Route>
          
          {/* Groups Routes (Experimental Groups) */}
          <Route path="groups">
            <Route index element={<ExperimentalGroupsList />} />
            <Route path=":id" element={<ExperimentalGroupDetail />} />
          </Route>
          
          
          {/* Inventory Routes */}
          <Route path="inventory">
            <Route index element={<InventoryList />} />
            <Route path="new" element={<InventoryForm />} />
            <Route path="edit/:id" element={<InventoryForm />} />
          </Route>
          
          {/* Procedures Routes (combines Protocols + Experiments) */}
          <Route path="procedures">
            <Route index element={<ProtocolList />} />
            <Route path=":id" element={<ProtocolDetail />} />
            <Route path="new" element={<ProtocolForm />} />
            <Route path=":id/edit" element={<ProtocolForm />} />
            <Route path="documents" element={<DocumentLibrary />} />
          </Route>
          
          {/* Label Routes */}
          <Route path="labels" element={<LabelGenerator />} />
          
          {/* Settings Routes */}
          <Route path="settings" element={<UserSettings />} />
          
          {/* Admin Routes */}
          <Route path="admin">
            <Route path="users" element={<UserManagement />} />
          </Route>
        </Route>
        </Routes>
        
        {/* Forced Password Change Dialog */}
        <ForcedPasswordChangeDialog 
          open={showPasswordChangeDialog}
          onSuccess={(message) => {
            handlePasswordChanged();
            console.log(message);
          }}
          onError={(error) => {
            console.error('Password change failed:', error);
          }}
        />
        </LoadingProvider>
      </DemoProvider>
    </ThemeProvider>
  );
}

export default App;