import axios from 'axios';

// Set default base URL
axios.defaults.baseURL = process.env.REACT_APP_API_URL || '';

// Initialize token from localStorage on import
const storedToken = localStorage.getItem('token');
if (storedToken) {
  axios.defaults.headers.common['x-auth-token'] = storedToken;
}

// Add token to requests if available
const setAuthToken = (token) => {
  if (token) {
    axios.defaults.headers.common['x-auth-token'] = token;
  } else {
    delete axios.defaults.headers.common['x-auth-token'];
  }
};

// Response interceptor to handle authentication errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear stored token and redirect
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['x-auth-token'];
      
      // Redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Legacy APIs removed for streamlined animal research:
// - collaboratorAPI (now handled within studies)
// - projectAPI (consolidated into studiesAPI)

// Specimens API
const specimenAPI = {
  getAll: (params) => {
    if (typeof params === 'string') {
      return axios.get(`/api/specimens${params}`);
    }
    const page = params?.page || 1;
    const limit = params?.limit || 50;
    return axios.get(`/api/specimens?page=${page}&limit=${limit}`);
  },
  search: (term, field) => {
    let url = `/api/specimens/search?term=${term}`;
    if (field) url += `&field=${field}`;
    return axios.get(url);
  },
  bulkSearch: (data) => axios.post('/api/specimens/bulk-search', data),
  getById: (id) => axios.get(`/api/specimens/${id}`),
  create: (specimenData) => axios.post('/api/specimens', specimenData),
  update: (id, specimenData) => axios.put(`/api/specimens/${id}`, specimenData),
  delete: (id) => axios.delete(`/api/specimens/${id}`),
  bulkImport: (data) => axios.post('/api/specimens/bulk-import', data),
  // Metadata operations
  getMetadataFields: (projectId) => axios.get(`/api/specimens/metadata-fields/${projectId}`),
  getMetadataSummary: (projectId) => axios.get(`/api/specimens/metadata-summary/${projectId}`),
  getMetadataAnalytics: (projectId) => axios.get(`/api/specimens/metadata-analytics/${projectId}`),
  getMetadataSuggestions: (projectId) => axios.get(`/api/specimens/metadata-suggestions?project_id=${projectId}`),
  searchByMetadata: (criteria) => axios.post('/api/specimens/metadata-search', criteria),
  updateMetadata: (id, metadata) => axios.put(`/api/specimens/${id}/metadata`, { metadata }),
  bulkUpdateMetadata: (data) => axios.post('/api/specimens/bulk-metadata-update', data),
};

// Labels API
const labelAPI = {
  generateLabels: (specimen_ids) => axios.post('/api/labels/generate', { specimen_ids }),
  generateProjectLabels: (project_id) => axios.post(`/api/labels/project/${project_id}`),
  downloadLabel: (filename) => axios.get(`/api/labels/download/${filename}`),
  generatePDF: (specimen_ids) => axios.post('/api/labels/generate-pdf', { specimen_ids }),
  downloadPDF: (filename) => axios.get(`/api/labels/download-pdf/${filename}`, { responseType: 'blob' }),
};

// Auth API
const authAPI = {
  login: (credentials) => axios.post('/api/auth/login', credentials),
  register: (userData) => axios.post('/api/auth/register', userData),
  getUser: () => axios.get('/api/auth/user'),
};

// Audit API
const auditAPI = {
  getRecent: () => axios.get('/api/audit'),
  getByUser: (userId) => axios.get(`/api/audit/user/${userId}`),
  getByRecord: (table, recordId) => axios.get(`/api/audit/${table}/${recordId}`),
};

// Export API
const exportAPI = {
  exportSpecimensCSV: (filters) => {
    const params = new URLSearchParams();
    
    // Add filters to query params
    if (filters.searchTerm) params.append('searchTerm', filters.searchTerm);
    if (filters.searchField) params.append('searchField', filters.searchField);
    if (filters.dateStart) params.append('dateStart', filters.dateStart);
    if (filters.dateEnd) params.append('dateEnd', filters.dateEnd);
    if (filters.collaboratorId) params.append('collaboratorId', filters.collaboratorId);
    if (filters.projectId) params.append('projectId', filters.projectId);
    if (filters.disease) params.append('disease', filters.disease);
    if (filters.specimenType) params.append('specimenType', filters.specimenType);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.selectedColumns) params.append('selectedColumns', filters.selectedColumns);
    if (filters.selectedSpecimens) params.append('selectedSpecimens', filters.selectedSpecimens);
    if (filters.bulkIdText) params.append('bulkIdText', filters.bulkIdText);
    
    return axios.get(`/api/export/specimens/csv?${params.toString()}`, {
      responseType: 'blob'
    });
  },
  exportSpecimensExcel: (filters) => {
    const params = new URLSearchParams();
    
    // Add filters to query params
    if (filters.searchTerm) params.append('searchTerm', filters.searchTerm);
    if (filters.searchField) params.append('searchField', filters.searchField);
    if (filters.dateStart) params.append('dateStart', filters.dateStart);
    if (filters.dateEnd) params.append('dateEnd', filters.dateEnd);
    if (filters.collaboratorId) params.append('collaboratorId', filters.collaboratorId);
    if (filters.projectId) params.append('projectId', filters.projectId);
    if (filters.disease) params.append('disease', filters.disease);
    if (filters.specimenType) params.append('specimenType', filters.specimenType);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.selectedColumns) params.append('selectedColumns', filters.selectedColumns);
    if (filters.selectedSpecimens) params.append('selectedSpecimens', filters.selectedSpecimens);
    if (filters.bulkIdText) params.append('bulkIdText', filters.bulkIdText);
    
    return axios.get(`/api/export/specimens/excel?${params.toString()}`, {
      responseType: 'blob'
    });
  },
};

// Metadata API
const metadataAPI = {
  uploadPreview: (csvData, specimenIdColumn, matchingStrategy = 'tube_id') => 
    axios.post('/api/metadata/upload-preview', { csvData, specimenIdColumn, matchingStrategy }),
  uploadApply: (csvData, specimenIdColumn, matchingStrategy = 'tube_id') => 
    axios.post('/api/metadata/upload-apply', { csvData, specimenIdColumn, matchingStrategy }),
  getTubeIds: (search = '', limit = 100) => 
    axios.get(`/api/metadata/tube-ids?search=${search}&limit=${limit}`),
  getSummary: () => axios.get('/api/metadata/summary'),
};

// Inventory API
const inventoryAPI = {
  getAll: (params = '') => axios.get(`/api/inventory${params}`),
  getById: (id) => axios.get(`/api/inventory/${id}`),
  create: (inventoryData) => axios.post('/api/inventory', inventoryData),
  update: (id, inventoryData) => axios.put(`/api/inventory/${id}`, inventoryData),
  delete: (id) => axios.delete(`/api/inventory/${id}`),
  updateQuantity: (id, quantityData) => axios.put(`/api/inventory/${id}/quantity`, quantityData),
  getCategories: () => axios.get('/api/inventory/categories'),
  getLowStock: () => axios.get('/api/inventory/low-stock'),
  getExpiring: (days = 30) => axios.get(`/api/inventory/expiring?days=${days}`),
  getTransactions: (id) => axios.get(`/api/inventory/${id}/transactions`),
  search: (query) => axios.get(`/api/inventory/search?q=${query}`),
  // Import/Export functionality
  exportCSV: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return axios.get(`/api/export/inventory/csv?${queryString}`, {
      responseType: 'blob'
    });
  },
  exportExcel: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return axios.get(`/api/export/inventory/excel?${queryString}`, {
      responseType: 'blob'
    });
  },
  import: (formData) => {
    return axios.post('/api/import/inventory', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  checkAvailability: (reagents) => axios.post('/api/inventory/check-availability', { reagents }),
  // Barcode lookup functionality
  lookupBarcode: (barcode) => axios.post('/api/inventory/lookup-barcode', { barcode }),
  getBarcodeStats: () => axios.get('/api/inventory/barcode-stats'),
  addProductToDatabase: (productData) => axios.post('/api/inventory/add-product-to-db', productData)
};

// IDs API
const idsAPI = {
  getNextCollaborator: () => axios.get('/api/ids/next-collaborator'),
  getNextProject: () => axios.get('/api/ids/next-project'),
  getNextSpecimen: () => axios.get('/api/ids/next-specimen'),
  getNextInventory: () => axios.get('/api/ids/next-inventory'),
  peekNext: (entityType) => axios.get(`/api/ids/peek/${entityType}`),
  checkAvailability: (entityType, id) => axios.post('/api/ids/check-availability', { entityType, id }),
  getHistory: (entityType, limit = 100) => axios.get(`/api/ids/history/${entityType}?limit=${limit}`),
};

// Procedures API - Unified (protocols part of procedures)
const proceduresAPI = {
  getAll: (params = '') => axios.get(`/api/procedures${params}`),
  getById: (id) => axios.get(`/api/procedures/${id}`),
  create: (protocolData) => axios.post('/api/procedures', protocolData),
  update: (id, protocolData) => axios.put(`/api/procedures/${id}`, protocolData),
  delete: (id) => axios.delete(`/api/procedures/${id}`),
  search: (term) => axios.get(`/api/procedures/search?term=${term}`),
  getUsageStats: () => axios.get('/api/procedures/usage-stats'),
  duplicate: (id, data) => axios.post(`/api/procedures/${id}/duplicate`, data),
  calculateReagents: (id, sampleCount) => axios.post(`/api/procedures/${id}/calculate-reagents`, { sample_count: sampleCount })
};

// Experiments API
const experimentsAPI = {
  getAll: (params = '') => axios.get(`/api/experiments${params}`),
  getById: (id) => axios.get(`/api/experiments/${id}`),
  create: (experimentData) => axios.post('/api/experiments', experimentData),
  update: (id, experimentData) => axios.put(`/api/experiments/${id}`, experimentData),
  delete: (id) => axios.delete(`/api/experiments/${id}`),
  search: (term) => axios.get(`/api/experiments/search?term=${term}`)
};

// Animals API
const animalAPI = {
  getAll: (params = '') => axios.get(`/api/animals${params}`),
  getById: (id) => axios.get(`/api/animals/${id}`),
  create: (animalData) => axios.post('/api/animals', animalData),
  update: (id, animalData) => axios.put(`/api/animals/${id}`, animalData),
  delete: (id) => axios.delete(`/api/animals/${id}`),
  getStats: () => axios.get('/api/animals/stats/summary'),
  getSpeciesSuggestions: (search = '') => axios.get(`/api/animals/species/suggestions?search=${encodeURIComponent(search)}`),
  getWeights: (id) => axios.get(`/api/animals/${id}/weights`),
  addWeight: (id, weightData) => axios.post(`/api/animals/${id}/weights`, weightData),
  getObservations: (id, limit = 20) => axios.get(`/api/animals/${id}/observations?limit=${limit}`),
  addObservation: (id, observationData) => axios.post(`/api/animals/${id}/observations`, observationData),
  getBreedingInfo: (id) => axios.get(`/api/animals/${id}/breeding`)
};

// Housing API  
const housingAPI = {
  getAll: (params = '') => axios.get(`/api/housing${params}`),
  getById: (id) => axios.get(`/api/housing/${id}`),
  create: (housingData) => axios.post('/api/housing', housingData),
  update: (id, housingData) => axios.put(`/api/housing/${id}`, housingData),
  delete: (id) => axios.delete(`/api/housing/${id}`),
  assignAnimal: (id, animalId) => axios.put(`/api/housing/${id}/assign-animal`, { animal_id: animalId }),
  removeAnimal: (id, animalId) => axios.put(`/api/housing/${id}/remove-animal`, { animal_id: animalId }),
  getStats: () => axios.get('/api/housing/stats/summary')
};

// Studies API - Unified (combines Projects + Experimental Studies)
const studiesAPI = {
  getAll: (params = '') => axios.get(`/api/studies${params}`),
  getById: (id) => axios.get(`/api/studies/${id}`),
  create: (studyData) => axios.post('/api/studies', studyData),
  update: (id, studyData) => axios.put(`/api/studies/${id}`, studyData),
  delete: (id) => axios.delete(`/api/studies/${id}`),
  getStats: () => axios.get('/api/studies/stats/summary')
};

// Groups API - Unified (was experimental-groups)
const groupsAPI = {
  getAll: (params = '') => axios.get(`/api/groups${params}`),
  getById: (id) => axios.get(`/api/groups/${id}`),
  create: (groupData) => axios.post('/api/groups', groupData),
  update: (id, groupData) => axios.put(`/api/groups/${id}`, groupData),
  delete: (id) => axios.delete(`/api/groups/${id}`),
  assignAnimal: (id, animalData) => axios.post(`/api/groups/${id}/animals`, animalData),
  removeAnimal: (groupId, animalId, removalData) => axios.delete(`/api/groups/${groupId}/animals/${animalId}`, { data: removalData }),
  addTreatment: (id, treatmentData) => axios.post(`/api/groups/${id}/treatments`, treatmentData),
  addMeasurement: (id, measurementData) => axios.post(`/api/groups/${id}/measurements`, measurementData)
};

// For backward compatibility during transition, alias new APIs to old names
const experimentalStudiesAPI = studiesAPI; // Temporary alias for existing components
const experimentalGroupsAPI = groupsAPI; // Temporary alias for existing components
const protocolAPI = proceduresAPI; // Temporary alias for existing components

export {
  setAuthToken,
  // Streamlined APIs for Animal Research LIMS
  studiesAPI,
  groupsAPI, 
  specimenAPI,
  proceduresAPI,
  experimentsAPI,
  animalAPI,
  housingAPI,
  inventoryAPI,
  labelAPI,
  // System APIs
  authAPI,
  auditAPI,
  exportAPI,
  metadataAPI,
  idsAPI,
  // Backward compatibility aliases (temporary)
  experimentalStudiesAPI,
  experimentalGroupsAPI,
  protocolAPI,
};
