import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Paper,
  Chip,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  TextField,
  Button,
  IconButton
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  ShowChart as ShowChartIcon,
  TrendingUp as TrendingUpIcon,
  Science as ScienceIcon,
  CompareArrows as CompareArrowsIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  ErrorBar,
  ReferenceLine
} from 'recharts';
import { format, parseISO } from 'date-fns';
import axios from 'axios';
import { toast } from 'react-toastify';

const StudyDataAnalysis = ({ studyId, studyInfo }) => {
  // State
  const [measurements, setMeasurements] = useState([]);
  const [samples, setSamples] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [measurementType, setMeasurementType] = useState('weight');
  const [viewTab, setViewTab] = useState(0);

  // Sample filters
  const [sampleFilters, setSampleFilters] = useState({
    sampleType: 'all',
    group: 'all',
    status: 'all',
    animalSearch: ''
  });

  useEffect(() => {
    loadData();
  }, [studyId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load study animals, measurements, and samples
      const [animalsRes, measurementsRes, samplesRes] = await Promise.all([
        axios.get(`/api/studies/${studyId}/animals`),
        axios.get(`/api/studies/${studyId}/measurements`),
        axios.get(`/api/studies/${studyId}/samples`)
      ]);

      setAnimals(animalsRes.data.animals || []);
      setMeasurements(measurementsRes.data.measurements || []);
      setSamples(samplesRes.data.samples || []);

    } catch (error) {
      console.error('Error loading study data:', error);
      toast.error('Failed to load study data');
    } finally {
      setLoading(false);
    }
  };

  // Group animals by their experimental group
  const animalsByGroup = useMemo(() => {
    const grouped = {};
    animals.forEach(animal => {
      const groupName = animal.group_name || 'Unassigned';
      if (!grouped[groupName]) {
        grouped[groupName] = [];
      }
      grouped[groupName].push(animal);
    });
    return grouped;
  }, [animals]);

  // Calculate group statistics per timepoint (mean ± SEM)
  const groupStatsByTimepoint = useMemo(() => {
    if (!measurements.length) return {};

    const filteredMeasurements = measurements.filter(m =>
      m.measurement_type === measurementType && m.value !== null
    );

    // Group by date and group_name
    const dataByDateAndGroup = {};

    filteredMeasurements.forEach(m => {
      const date = format(parseISO(m.measurement_date), 'yyyy-MM-dd');
      const groupName = m.group_name || 'Unassigned';

      if (!dataByDateAndGroup[date]) {
        dataByDateAndGroup[date] = {};
      }
      if (!dataByDateAndGroup[date][groupName]) {
        dataByDateAndGroup[date][groupName] = [];
      }
      dataByDateAndGroup[date][groupName].push(Number(m.value));
    });

    // Calculate statistics for each date/group combination
    const result = {};
    Object.keys(dataByDateAndGroup).forEach(date => {
      result[date] = {};
      Object.keys(dataByDateAndGroup[date]).forEach(groupName => {
        const values = dataByDateAndGroup[date][groupName];
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        const sem = stdDev / Math.sqrt(values.length); // Standard Error of Mean

        result[date][groupName] = {
          mean,
          sem,
          stdDev,
          n: values.length,
          min: Math.min(...values),
          max: Math.max(...values)
        };
      });
    });

    return result;
  }, [measurements, measurementType]);

  // Format data for group comparison chart (mean ± SEM)
  const groupComparisonData = useMemo(() => {
    const dates = Object.keys(groupStatsByTimepoint).sort();

    return dates.map(date => {
      const entry = {
        date,
        displayDate: format(parseISO(date), 'MMM dd'),
        timestamp: new Date(date).getTime()
      };

      Object.keys(groupStatsByTimepoint[date]).forEach(groupName => {
        const stats = groupStatsByTimepoint[date][groupName];
        entry[`${groupName}_mean`] = stats.mean;
        entry[`${groupName}_sem`] = stats.sem;
        entry[`${groupName}_upper`] = stats.mean + stats.sem;
        entry[`${groupName}_lower`] = stats.mean - stats.sem;
      });

      return entry;
    }).sort((a, b) => a.timestamp - b.timestamp);
  }, [groupStatsByTimepoint]);

  // Get list of groups for rendering
  const groupNames = useMemo(() => {
    return Object.keys(animalsByGroup).sort();
  }, [animalsByGroup]);

  // Calculate change from baseline for each animal
  const changeFromBaselineData = useMemo(() => {
    if (!measurements.length) return [];

    const filteredMeasurements = measurements.filter(m =>
      m.measurement_type === measurementType && m.value !== null
    );

    // Get baseline (first measurement) for each animal
    const baselines = {};
    filteredMeasurements.forEach(m => {
      const animalId = m.animal_id;
      if (!baselines[animalId] || new Date(m.measurement_date) < new Date(baselines[animalId].date)) {
        baselines[animalId] = {
          value: Number(m.value),
          date: m.measurement_date
        };
      }
    });

    // Calculate % change for each measurement
    const changes = filteredMeasurements.map(m => {
      const baseline = baselines[m.animal_id];
      if (!baseline) return null;

      const percentChange = ((Number(m.value) - baseline.value) / baseline.value) * 100;

      return {
        date: format(parseISO(m.measurement_date), 'yyyy-MM-dd'),
        displayDate: format(parseISO(m.measurement_date), 'MMM dd'),
        timestamp: new Date(m.measurement_date).getTime(),
        groupName: m.group_name || 'Unassigned',
        animalNumber: m.animal_number,
        percentChange
      };
    }).filter(x => x !== null);

    // Group by date and group, calculate mean % change
    const grouped = {};
    changes.forEach(c => {
      const key = `${c.date}_${c.groupName}`;
      if (!grouped[key]) {
        grouped[key] = {
          date: c.date,
          displayDate: c.displayDate,
          timestamp: c.timestamp,
          groupName: c.groupName,
          values: []
        };
      }
      grouped[key].values.push(c.percentChange);
    });

    // Calculate mean for each group/date
    const result = {};
    Object.values(grouped).forEach(g => {
      if (!result[g.date]) {
        result[g.date] = {
          date: g.date,
          displayDate: g.displayDate,
          timestamp: g.timestamp
        };
      }
      const mean = g.values.reduce((sum, v) => sum + v, 0) / g.values.length;
      const sem = Math.sqrt(g.values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / g.values.length) / Math.sqrt(g.values.length);

      result[g.date][`${g.groupName}_mean`] = mean;
      result[g.date][`${g.groupName}_sem`] = sem;
    });

    return Object.values(result).sort((a, b) => a.timestamp - b.timestamp);
  }, [measurements, measurementType]);

  // Individual animal data
  const individualAnimalData = useMemo(() => {
    if (!measurements.length) return [];

    const filteredMeasurements = measurements.filter(m =>
      m.measurement_type === measurementType && m.value !== null
    );

    const dataMap = new Map();

    filteredMeasurements.forEach(measurement => {
      const date = format(parseISO(measurement.measurement_date), 'yyyy-MM-dd');
      if (!dataMap.has(date)) {
        dataMap.set(date, {
          date,
          displayDate: format(parseISO(measurement.measurement_date), 'MMM dd'),
          timestamp: new Date(measurement.measurement_date).getTime()
        });
      }
      const entry = dataMap.get(date);
      const key = `${measurement.group_name}_${measurement.animal_number}`;
      entry[key] = Number(measurement.value);
    });

    return Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [measurements, measurementType]);

  // Endpoint analysis - compare final measurements
  const endpointAnalysis = useMemo(() => {
    if (!measurements.length) return {};

    const filteredMeasurements = measurements.filter(m =>
      m.measurement_type === measurementType && m.value !== null
    );

    // Get last measurement for each animal
    const lastMeasurements = {};
    filteredMeasurements.forEach(m => {
      const animalId = m.animal_id;
      if (!lastMeasurements[animalId] || new Date(m.measurement_date) > new Date(lastMeasurements[animalId].date)) {
        lastMeasurements[animalId] = {
          value: Number(m.value),
          date: m.measurement_date,
          groupName: m.group_name || 'Unassigned',
          animalNumber: m.animal_number
        };
      }
    });

    // Group by experimental group
    const byGroup = {};
    Object.values(lastMeasurements).forEach(m => {
      if (!byGroup[m.groupName]) {
        byGroup[m.groupName] = [];
      }
      byGroup[m.groupName].push(m.value);
    });

    // Calculate statistics per group
    const stats = {};
    Object.keys(byGroup).forEach(groupName => {
      const values = byGroup[groupName];
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      const sem = stdDev / Math.sqrt(values.length);

      stats[groupName] = {
        mean,
        sem,
        stdDev,
        n: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        values
      };
    });

    return stats;
  }, [measurements, measurementType]);

  // Simple t-test calculation (for demonstration)
  const calculateTTest = (group1Values, group2Values) => {
    if (!group1Values || !group2Values || group1Values.length < 2 || group2Values.length < 2) {
      return null;
    }

    const mean1 = group1Values.reduce((sum, v) => sum + v, 0) / group1Values.length;
    const mean2 = group2Values.reduce((sum, v) => sum + v, 0) / group2Values.length;

    const var1 = group1Values.reduce((sum, v) => sum + Math.pow(v - mean1, 2), 0) / (group1Values.length - 1);
    const var2 = group2Values.reduce((sum, v) => sum + Math.pow(v - mean2, 0), 0) / (group2Values.length - 1);

    const pooledVar = ((group1Values.length - 1) * var1 + (group2Values.length - 1) * var2) / (group1Values.length + group2Values.length - 2);
    const se = Math.sqrt(pooledVar * (1 / group1Values.length + 1 / group2Values.length));

    const tStat = (mean1 - mean2) / se;

    return {
      tStat: tStat.toFixed(3),
      meanDiff: (mean1 - mean2).toFixed(2),
      significant: Math.abs(tStat) > 2.0 // Rough approximation for p < 0.05
    };
  };

  // Available measurement types
  const measurementTypes = useMemo(() => {
    const types = new Set(measurements.map(m => m.measurement_type));
    return Array.from(types).sort();
  }, [measurements]);

  // Extract unique sample types, statuses
  const sampleTypes = useMemo(() => {
    const types = new Set(samples.map(s => s.sample_type));
    return ['all', ...Array.from(types).sort()];
  }, [samples]);

  const sampleStatuses = useMemo(() => {
    const statuses = new Set(samples.map(s => s.status));
    return ['all', ...Array.from(statuses).sort()];
  }, [samples]);

  // Filtered samples based on user selection
  const filteredSamples = useMemo(() => {
    return samples.filter(sample => {
      // Filter by sample type
      if (sampleFilters.sampleType !== 'all' && sample.sample_type !== sampleFilters.sampleType) {
        return false;
      }

      // Filter by group
      if (sampleFilters.group !== 'all' && sample.group_name !== sampleFilters.group) {
        return false;
      }

      // Filter by status
      if (sampleFilters.status !== 'all' && sample.status !== sampleFilters.status) {
        return false;
      }

      // Filter by animal search
      if (sampleFilters.animalSearch &&
          !sample.animal_number?.toString().toLowerCase().includes(sampleFilters.animalSearch.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [samples, sampleFilters]);

  // Color palette for groups
  const groupColors = {
    'Control': '#82ca9d',
    'Treatment A': '#8884d8',
    'Wild Type': '#82ca9d',
    'Transgenic': '#ff7c7c',
    'Treatment': '#8884d8',
    'Unassigned': '#cccccc'
  };

  // Get color for group (with fallback)
  const getGroupColor = (groupName) => {
    return groupColors[groupName] || `#${Math.floor(Math.random()*16777215).toString(16)}`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!measurements.length && !samples.length) {
    return (
      <Alert severity="info">
        No measurement or sample data available for this study yet.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">Total Animals</Typography>
              <Typography variant="h5">{animals.length}</Typography>
              <Typography variant="caption" color="textSecondary">
                Across {groupNames.length} groups
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">Measurements</Typography>
              <Typography variant="h5">{measurements.length}</Typography>
              <Typography variant="caption" color="textSecondary">
                Data points collected
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">Samples</Typography>
              <Typography variant="h5">{samples.length}</Typography>
              <Typography variant="caption" color="textSecondary">
                Biological samples
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary">Study Duration</Typography>
              <Typography variant="h5">
                {measurements.length > 0
                  ? Math.ceil(
                      (new Date(Math.max(...measurements.map(m => new Date(m.measurement_date)))) -
                        new Date(Math.min(...measurements.map(m => new Date(m.measurement_date))))) /
                        (1000 * 60 * 60 * 24)
                    )
                  : 0}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Days active
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Measurement Type Selector */}
      {measurements.length > 0 && (
        <>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Measurement Type</InputLabel>
                  <Select
                    value={measurementType}
                    onChange={(e) => setMeasurementType(e.target.value)}
                    label="Measurement Type"
                  >
                    {measurementTypes.map(type => (
                      <MenuItem key={type} value={type}>
                        {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {groupNames.map(groupName => (
                    <Chip
                      key={groupName}
                      label={groupName}
                      sx={{
                        backgroundColor: getGroupColor(groupName),
                        color: 'white'
                      }}
                    />
                  ))}
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Analysis Tabs */}
          <Paper sx={{ mb: 3 }}>
            <Tabs value={viewTab} onChange={(e, v) => setViewTab(v)} variant="scrollable" scrollButtons="auto">
              <Tab icon={<CompareArrowsIcon />} iconPosition="start" label="Group Comparison" />
              <Tab icon={<TrendingUpIcon />} iconPosition="start" label="Change from Baseline" />
              <Tab icon={<ShowChartIcon />} iconPosition="start" label="Individual Animals" />
              <Tab icon={<TimelineIcon />} iconPosition="start" label="Endpoint Analysis" />
            </Tabs>
          </Paper>

          {/* Tab 1: Group Comparison (Mean ± SEM) */}
          {viewTab === 0 && groupComparisonData.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Group Comparison - Mean ± SEM
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  Lines show group means. Error bars represent Standard Error of the Mean (SEM).
                </Typography>
                <Box sx={{ width: '100%', height: 450 }}>
                  <ResponsiveContainer>
                    <LineChart data={groupComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="displayDate" />
                      <YAxis
                        label={{ value: measurementType.replace(/_/g, ' '), angle: -90, position: 'insideLeft' }}
                      />
                      <RechartsTooltip />
                      <Legend />
                      {groupNames.map(groupName => (
                        <Line
                          key={groupName}
                          type="monotone"
                          dataKey={`${groupName}_mean`}
                          stroke={getGroupColor(groupName)}
                          strokeWidth={3}
                          name={groupName}
                          dot={{ r: 5 }}
                        >
                          <ErrorBar dataKey={`${groupName}_sem`} width={4} strokeWidth={2} />
                        </Line>
                      ))}
                      <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Tab 2: Change from Baseline */}
          {viewTab === 1 && changeFromBaselineData.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Percent Change from Baseline
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  Shows percent change from each animal's baseline (Day 0) measurement.
                </Typography>
                <Box sx={{ width: '100%', height: 450 }}>
                  <ResponsiveContainer>
                    <LineChart data={changeFromBaselineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="displayDate" />
                      <YAxis label={{ value: '% Change', angle: -90, position: 'insideLeft' }} />
                      <RechartsTooltip />
                      <Legend />
                      {groupNames.map(groupName => (
                        <Line
                          key={groupName}
                          type="monotone"
                          dataKey={`${groupName}_mean`}
                          stroke={getGroupColor(groupName)}
                          strokeWidth={3}
                          name={groupName}
                          dot={{ r: 5 }}
                        >
                          <ErrorBar dataKey={`${groupName}_sem`} width={4} strokeWidth={2} />
                        </Line>
                      ))}
                      <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" label="Baseline" />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Tab 3: Individual Animals */}
          {viewTab === 2 && individualAnimalData.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Individual Animal Trajectories
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  Each line represents an individual animal, color-coded by group.
                </Typography>
                <Box sx={{ width: '100%', height: 450 }}>
                  <ResponsiveContainer>
                    <LineChart data={individualAnimalData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="displayDate" />
                      <YAxis label={{ value: measurementType.replace(/_/g, ' '), angle: -90, position: 'insideLeft' }} />
                      <RechartsTooltip />
                      <Legend />
                      {animals.map(animal => {
                        const key = `${animal.group_name}_${animal.animal_number}`;
                        return (
                          <Line
                            key={key}
                            type="monotone"
                            dataKey={key}
                            stroke={getGroupColor(animal.group_name)}
                            strokeWidth={1.5}
                            dot={false}
                            name={`${animal.animal_number}`}
                            strokeOpacity={0.6}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Tab 4: Endpoint Analysis */}
          {viewTab === 3 && Object.keys(endpointAnalysis).length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Endpoint Analysis - Final Measurements
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                  Comparison of final measurement values across groups.
                </Typography>

                {/* Bar chart of means */}
                <Box sx={{ width: '100%', height: 350, mb: 4 }}>
                  <ResponsiveContainer>
                    <BarChart data={Object.keys(endpointAnalysis).map(groupName => ({
                      groupName,
                      mean: endpointAnalysis[groupName].mean,
                      sem: endpointAnalysis[groupName].sem
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="groupName" />
                      <YAxis label={{ value: measurementType.replace(/_/g, ' '), angle: -90, position: 'insideLeft' }} />
                      <RechartsTooltip />
                      <Bar dataKey="mean" fill="#8884d8">
                        {Object.keys(endpointAnalysis).map((groupName, index) => (
                          <Bar key={groupName} dataKey="mean" fill={getGroupColor(groupName)} />
                        ))}
                        <ErrorBar dataKey="sem" width={4} strokeWidth={2} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>

                {/* Statistics table */}
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Group</strong></TableCell>
                        <TableCell align="right"><strong>N</strong></TableCell>
                        <TableCell align="right"><strong>Mean</strong></TableCell>
                        <TableCell align="right"><strong>SEM</strong></TableCell>
                        <TableCell align="right"><strong>Std Dev</strong></TableCell>
                        <TableCell align="right"><strong>Min</strong></TableCell>
                        <TableCell align="right"><strong>Max</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.keys(endpointAnalysis).map(groupName => {
                        const stats = endpointAnalysis[groupName];
                        return (
                          <TableRow key={groupName}>
                            <TableCell>
                              <Chip
                                label={groupName}
                                size="small"
                                sx={{ backgroundColor: getGroupColor(groupName), color: 'white' }}
                              />
                            </TableCell>
                            <TableCell align="right">{stats.n}</TableCell>
                            <TableCell align="right">{stats.mean.toFixed(2)}</TableCell>
                            <TableCell align="right">{stats.sem.toFixed(2)}</TableCell>
                            <TableCell align="right">{stats.stdDev.toFixed(2)}</TableCell>
                            <TableCell align="right">{stats.min.toFixed(2)}</TableCell>
                            <TableCell align="right">{stats.max.toFixed(2)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Simple statistical comparison */}
                {groupNames.length === 2 && (
                  <Paper sx={{ p: 2, mt: 3, bgcolor: 'info.light' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Statistical Comparison (t-test)
                    </Typography>
                    {(() => {
                      const ttest = calculateTTest(
                        endpointAnalysis[groupNames[0]].values,
                        endpointAnalysis[groupNames[1]].values
                      );
                      if (!ttest) return <Typography variant="body2">Insufficient data for t-test</Typography>;

                      return (
                        <Box>
                          <Typography variant="body2">
                            <strong>{groupNames[0]}</strong> vs <strong>{groupNames[1]}</strong>
                          </Typography>
                          <Typography variant="body2">
                            Mean difference: {ttest.meanDiff}
                          </Typography>
                          <Typography variant="body2">
                            t-statistic: {ttest.tStat}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            {ttest.significant ? (
                              <Chip label="Likely Significant (|t| > 2.0)" color="success" size="small" />
                            ) : (
                              <Chip label="Not Significant (|t| < 2.0)" color="default" size="small" />
                            )}
                          </Typography>
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>
                            Note: This is a simplified t-test for demonstration. Use statistical software for rigorous analysis.
                          </Typography>
                        </Box>
                      );
                    })()}
                  </Paper>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Sample Collection Timeline */}
      {samples.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ScienceIcon sx={{ mr: 1 }} />
                <Typography variant="h6">
                  Sample Collection Timeline
                </Typography>
              </Box>
              <Chip
                label={`${filteredSamples.length} of ${samples.length} samples`}
                color="primary"
                variant="outlined"
              />
            </Box>

            {/* Filter Controls */}
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <FilterListIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Filter Samples
                </Typography>
                {(sampleFilters.sampleType !== 'all' || sampleFilters.group !== 'all' ||
                  sampleFilters.status !== 'all' || sampleFilters.animalSearch) && (
                  <Button
                    size="small"
                    startIcon={<ClearIcon />}
                    onClick={() => setSampleFilters({
                      sampleType: 'all',
                      group: 'all',
                      status: 'all',
                      animalSearch: ''
                    })}
                    sx={{ ml: 'auto' }}
                  >
                    Clear Filters
                  </Button>
                )}
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Sample Type</InputLabel>
                    <Select
                      value={sampleFilters.sampleType}
                      onChange={(e) => setSampleFilters({ ...sampleFilters, sampleType: e.target.value })}
                      label="Sample Type"
                    >
                      {sampleTypes.map(type => (
                        <MenuItem key={type} value={type}>
                          {type === 'all' ? 'All Types' : type}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Group</InputLabel>
                    <Select
                      value={sampleFilters.group}
                      onChange={(e) => setSampleFilters({ ...sampleFilters, group: e.target.value })}
                      label="Group"
                    >
                      <MenuItem value="all">All Groups</MenuItem>
                      {groupNames.map(groupName => (
                        <MenuItem key={groupName} value={groupName}>
                          {groupName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={sampleFilters.status}
                      onChange={(e) => setSampleFilters({ ...sampleFilters, status: e.target.value })}
                      label="Status"
                    >
                      {sampleStatuses.map(status => (
                        <MenuItem key={status} value={status}>
                          {status === 'all' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Animal Number"
                    placeholder="Search..."
                    value={sampleFilters.animalSearch}
                    onChange={(e) => setSampleFilters({ ...sampleFilters, animalSearch: e.target.value })}
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* Sample Table */}
            {filteredSamples.length > 0 ? (
              <>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Sample Type</TableCell>
                        <TableCell>Animal</TableCell>
                        <TableCell>Group</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Storage Location</TableCell>
                        <TableCell>Notes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredSamples.slice(0, 20).map((sample) => (
                        <TableRow key={sample.id}>
                          <TableCell>
                            {format(parseISO(sample.collection_date), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Chip label={sample.sample_type} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>{sample.animal_number}</TableCell>
                          <TableCell>
                            <Chip
                              label={sample.group_name}
                              size="small"
                              sx={{ backgroundColor: getGroupColor(sample.group_name), color: 'white' }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={sample.status}
                              size="small"
                              color={sample.status === 'available' ? 'success' : sample.status === 'depleted' ? 'error' : 'default'}
                            />
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.875rem' }}>
                            {sample.storage_location || 'N/A'}
                          </TableCell>
                          <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {sample.notes}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {filteredSamples.length > 20 && (
                  <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                    Showing 20 of {filteredSamples.length} filtered samples
                  </Typography>
                )}
              </>
            ) : (
              <Alert severity="info" sx={{ mt: 2 }}>
                No samples match the selected filters. Try adjusting your filter criteria.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default StudyDataAnalysis;
