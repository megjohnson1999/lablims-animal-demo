import axios from 'axios';

const biologicalSamplesAPI = {
  // Get all biological samples with search and filtering
  getAll: (params = '') => {
    if (typeof params === 'object') {
      const queryString = new URLSearchParams(params).toString();
      return axios.get(`/api/biological-samples?${queryString}`);
    }
    return axios.get(`/api/biological-samples${params}`);
  },

  // Get single biological sample with full details
  getById: (id) => axios.get(`/api/biological-samples/${id}`),

  // Create new biological sample
  create: (sampleData) => axios.post('/api/biological-samples', sampleData),

  // Update biological sample
  update: (id, sampleData) => axios.put(`/api/biological-samples/${id}`, sampleData),

  // Delete biological sample
  delete: (id) => axios.delete(`/api/biological-samples/${id}`),

  // Record sample usage
  recordUsage: (id, usageData) => axios.post(`/api/biological-samples/${id}/use`, usageData),

  // Get statistics
  getStats: () => axios.get('/api/biological-samples/stats/summary'),

  // Search samples by animal
  getByAnimal: (animalId) => axios.get(`/api/biological-samples?animal_id=${animalId}`),

  // Search samples by study
  getByStudy: (studyId) => axios.get(`/api/biological-samples?study_id=${studyId}`),

  // Get samples by storage location
  getByStorage: (location) => axios.get(`/api/biological-samples?storage_location=${encodeURIComponent(location)}`),

  // Advanced search with multiple criteria
  search: (criteria) => {
    const params = new URLSearchParams();
    
    Object.keys(criteria).forEach(key => {
      if (criteria[key] !== null && criteria[key] !== undefined && criteria[key] !== '') {
        params.append(key, criteria[key]);
      }
    });
    
    return axios.get(`/api/biological-samples?${params.toString()}`);
  }
};

export default biologicalSamplesAPI;