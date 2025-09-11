import React, { useState, useEffect } from 'react';
import {
  Paper,
  TextField,
  Button,
  Box,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useNavigate, useParams } from 'react-router-dom';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { experimentalStudiesAPI } from '../../services/api';

const validationSchema = yup.object({
  study_name: yup.string().required('Study name is required'),
  principal_investigator: yup.string().required('Principal investigator is required'),
  species_required: yup.string().required('Species is required'),
  total_animals_planned: yup.number()
    .required('Total animals planned is required')
    .min(1, 'Must plan at least 1 animal'),
  iacuc_protocol_number: yup.string(),
  status: yup.string().oneOf(['planning', 'active', 'completed', 'cancelled']),
  description: yup.string(),
  objectives: yup.string(),
  study_design: yup.string()
});

const ExperimentalStudyForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formik = useFormik({
    initialValues: {
      study_name: '',
      principal_investigator: '',
      description: '',
      iacuc_protocol_number: '',
      species_required: '',
      total_animals_planned: 1,
      status: 'planning',
      start_date: null,
      expected_end_date: null,
      actual_end_date: null,
      objectives: '',
      study_design: ''
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true);
        setError('');

        // Format dates
        const formattedValues = {
          ...values,
          start_date: values.start_date ? values.start_date.toISOString().split('T')[0] : null,
          expected_end_date: values.expected_end_date ? values.expected_end_date.toISOString().split('T')[0] : null,
          actual_end_date: values.actual_end_date ? values.actual_end_date.toISOString().split('T')[0] : null
        };

        if (isEditing) {
          await experimentalStudiesAPI.update(id, formattedValues);
        } else {
          await experimentalStudiesAPI.create(formattedValues);
        }

        navigate('/studies');
      } catch (error) {
        console.error('Error saving study:', error);
        setError(error.response?.data?.message || 'Failed to save study');
      } finally {
        setLoading(false);
      }
    }
  });

  useEffect(() => {
    if (isEditing) {
      const fetchStudy = async () => {
        try {
          const response = await experimentalStudiesAPI.getById(id);
          const study = response.data.study;
          
          formik.setValues({
            study_name: study.study_name || '',
            principal_investigator: study.principal_investigator || '',
            description: study.description || '',
            iacuc_protocol_number: study.iacuc_protocol_number || '',
            species_required: study.species_required || '',
            total_animals_planned: study.total_animals_planned || 1,
            status: study.status || 'planning',
            start_date: study.start_date ? new Date(study.start_date) : null,
            expected_end_date: study.expected_end_date ? new Date(study.expected_end_date) : null,
            actual_end_date: study.actual_end_date ? new Date(study.actual_end_date) : null,
            objectives: study.objectives || '',
            study_design: study.study_design || ''
          });
        } catch (error) {
          console.error('Error fetching study:', error);
          setError('Failed to load study data');
        }
      };

      fetchStudy();
    }
  }, [id, isEditing]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
          {isEditing ? 'Edit Experimental Study' : 'New Experimental Study'}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={formik.handleSubmit}>
          <Grid container spacing={3}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Basic Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        name="study_name"
                        label="Study Name"
                        value={formik.values.study_name}
                        onChange={formik.handleChange}
                        error={formik.touched.study_name && Boolean(formik.errors.study_name)}
                        helperText={formik.touched.study_name && formik.errors.study_name}
                        required
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        name="principal_investigator"
                        label="Principal Investigator"
                        value={formik.values.principal_investigator}
                        onChange={formik.handleChange}
                        error={formik.touched.principal_investigator && Boolean(formik.errors.principal_investigator)}
                        helperText={formik.touched.principal_investigator && formik.errors.principal_investigator}
                        required
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        name="description"
                        label="Study Description"
                        multiline
                        rows={3}
                        value={formik.values.description}
                        onChange={formik.handleChange}
                        error={formik.touched.description && Boolean(formik.errors.description)}
                        helperText={formik.touched.description && formik.errors.description}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Study Details */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Study Details
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        name="iacuc_protocol_number"
                        label="IACUC Protocol Number"
                        value={formik.values.iacuc_protocol_number}
                        onChange={formik.handleChange}
                        error={formik.touched.iacuc_protocol_number && Boolean(formik.errors.iacuc_protocol_number)}
                        helperText={formik.touched.iacuc_protocol_number && formik.errors.iacuc_protocol_number}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Status</InputLabel>
                        <Select
                          name="status"
                          value={formik.values.status}
                          onChange={formik.handleChange}
                          label="Status"
                        >
                          <MenuItem value="planning">Planning</MenuItem>
                          <MenuItem value="active">Active</MenuItem>
                          <MenuItem value="completed">Completed</MenuItem>
                          <MenuItem value="cancelled">Cancelled</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        name="species_required"
                        label="Species Required"
                        value={formik.values.species_required}
                        onChange={formik.handleChange}
                        error={formik.touched.species_required && Boolean(formik.errors.species_required)}
                        helperText={formik.touched.species_required && formik.errors.species_required}
                        required
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        name="total_animals_planned"
                        label="Total Animals Planned"
                        type="number"
                        value={formik.values.total_animals_planned}
                        onChange={formik.handleChange}
                        error={formik.touched.total_animals_planned && Boolean(formik.errors.total_animals_planned)}
                        helperText={formik.touched.total_animals_planned && formik.errors.total_animals_planned}
                        required
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Timeline */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Timeline
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <DatePicker
                        label="Start Date"
                        value={formik.values.start_date}
                        onChange={(newValue) => formik.setFieldValue('start_date', newValue)}
                        renderInput={(params) => <TextField fullWidth {...params} />}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <DatePicker
                        label="Expected End Date"
                        value={formik.values.expected_end_date}
                        onChange={(newValue) => formik.setFieldValue('expected_end_date', newValue)}
                        renderInput={(params) => <TextField fullWidth {...params} />}
                      />
                    </Grid>
                    {formik.values.status === 'completed' && (
                      <Grid item xs={12} md={4}>
                        <DatePicker
                          label="Actual End Date"
                          value={formik.values.actual_end_date}
                          onChange={(newValue) => formik.setFieldValue('actual_end_date', newValue)}
                          renderInput={(params) => <TextField fullWidth {...params} />}
                        />
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Study Design */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Study Design
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        name="objectives"
                        label="Study Objectives"
                        multiline
                        rows={4}
                        value={formik.values.objectives}
                        onChange={formik.handleChange}
                        error={formik.touched.objectives && Boolean(formik.errors.objectives)}
                        helperText={formik.touched.objectives && formik.errors.objectives}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        name="study_design"
                        label="Study Design Description"
                        multiline
                        rows={4}
                        value={formik.values.study_design}
                        onChange={formik.handleChange}
                        error={formik.touched.study_design && Boolean(formik.errors.study_design)}
                        helperText={formik.touched.study_design && formik.errors.study_design}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Actions */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/studies')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : isEditing ? 'Update Study' : 'Create Study'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Box>
    </LocalizationProvider>
  );
};

export default ExperimentalStudyForm;