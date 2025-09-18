import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
  Divider,
  useTheme,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ShowChart as ShowChartIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  Download as ExportIcon,
  Fullscreen as FullscreenIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon
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
  Area,
  AreaChart,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  ReferenceLine,
  Brush
} from 'recharts';
import { format, parseISO, differenceInDays } from 'date-fns';
import axios from 'axios';
import { toast } from 'react-toastify';

const MeasurementCharts = ({ animalId, animalInfo }) => {
  const theme = useTheme();

  // State
  const [measurements, setMeasurements] = useState([]);
  const [measurementTypes, setMeasurementTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Chart settings
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [chartType, setChartType] = useState('line');
  const [timeRange, setTimeRange] = useState('all');
  const [showTrend, setShowTrend] = useState(true);
  const [groupBy, setGroupBy] = useState('none');

  useEffect(() => {
    loadData();
  }, [animalId, timeRange]);

  const loadData = async () => {
    try {
      setLoading(true);

      const params = {};
      if (timeRange !== 'all') {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(timeRange));
        params.start_date = startDate.toISOString();
      }

      const [measurementsRes, typesRes] = await Promise.all([
        axios.get(`/api/measurements/animal/${animalId}`, { params }),
        axios.get('/api/measurements/types')
      ]);

      const rawMeasurements = measurementsRes.data.measurements || [];
      const types = typesRes.data.measurement_types || [];

      setMeasurements(rawMeasurements);
      setMeasurementTypes(types);

      // Auto-select common measurement types if none selected
      if (selectedTypes.length === 0 && rawMeasurements.length > 0) {
        const commonTypes = ['weight', 'body_condition_score', 'tumor_volume'];
        const availableTypes = [...new Set(rawMeasurements.map(m => m.measurement_type))];
        const autoSelect = commonTypes.filter(type => availableTypes.includes(type));

        if (autoSelect.length === 0 && availableTypes.length > 0) {
          // If no common types, select the first few available types
          setSelectedTypes(availableTypes.slice(0, 3));
        } else {
          setSelectedTypes(autoSelect);
        }
      }

    } catch (error) {
      console.error('Error loading measurement data:', error);
      toast.error('Failed to load measurement data');
    } finally {
      setLoading(false);
    }
  };

  // Process data for charts
  const chartData = useMemo(() => {
    if (!measurements.length || !selectedTypes.length) return [];

    // Filter measurements by selected types
    const filteredMeasurements = measurements.filter(m =>
      selectedTypes.includes(m.measurement_type) && m.value !== null
    );

    // Group by date and measurement type
    const dataMap = new Map();

    filteredMeasurements.forEach(measurement => {
      const date = format(parseISO(measurement.measurement_date), 'yyyy-MM-dd');
      const key = groupBy === 'daily' ? date : measurement.measurement_date;

      if (!dataMap.has(key)) {
        dataMap.set(key, {
          date: key,
          displayDate: format(parseISO(measurement.measurement_date), 'MMM dd, yyyy'),
          timestamp: new Date(measurement.measurement_date).getTime()
        });
      }

      const entry = dataMap.get(key);
      entry[measurement.measurement_type] = measurement.value;
      entry[`${measurement.measurement_type}_unit`] = measurement.unit;
      entry[`${measurement.measurement_type}_notes`] = measurement.notes;
    });

    // Convert to array and sort by date
    return Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [measurements, selectedTypes, groupBy]);

  // Calculate statistics
  const statistics = useMemo(() => {
    if (!chartData.length || !selectedTypes.length) return {};

    const stats = {};

    selectedTypes.forEach(type => {
      const values = chartData
        .map(d => d[type])
        .filter(v => v !== undefined && v !== null);

      if (values.length > 0) {
        const sorted = [...values].sort((a, b) => a - b);
        const latest = chartData[chartData.length - 1]?.[type];
        const first = chartData[0]?.[type];

        stats[type] = {
          count: values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          mean: values.reduce((sum, v) => sum + v, 0) / values.length,
          median: sorted[Math.floor(sorted.length / 2)],
          latest: latest,
          first: first,
          change: latest && first ? latest - first : null,
          changePercent: latest && first ? ((latest - first) / first * 100) : null
        };
      }
    });

    return stats;
  }, [chartData, selectedTypes]);

  // Color palette for different measurement types
  const getTypeColor = (type, index) => {
    const colors = [
      theme.palette.primary.main,
      theme.palette.secondary.main,
      theme.palette.success.main,
      theme.palette.warning.main,
      theme.palette.error.main,
      theme.palette.info.main,
      '#9c27b0', // Purple
      '#ff9800', // Orange
      '#4caf50', // Green
      '#f44336', // Red
    ];
    return colors[index % colors.length];
  };

  const formatTooltip = (value, name, props) => {
    const unit = props.payload?.[`${name}_unit`] || '';
    const notes = props.payload?.[`${name}_notes`];

    return [
      `${value} ${unit}`.trim(),
      name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      notes && `Notes: ${notes}`
    ].filter(Boolean);
  };

  const formatXAxisTick = (tickItem) => {
    return format(new Date(tickItem), 'MMM dd');
  };

  const availableTypes = useMemo(() => {
    return [...new Set(measurements.map(m => m.measurement_type))];
  }, [measurements]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (measurements.length === 0) {
    return (
      <Alert severity="info">
        No measurement data available for visualization. Start recording measurements to see charts.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Measurement Trends
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ExportIcon />}
          size="small"
          onClick={() => toast.info('Export functionality coming soon!')}
        >
          Export Charts
        </Button>
      </Box>

      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Measurement Types</InputLabel>
              <Select
                multiple
                value={selectedTypes}
                onChange={(e) => setSelectedTypes(e.target.value)}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip
                        key={value}
                        label={value.replace(/_/g, ' ')}
                        size="small"
                      />
                    ))}
                  </Box>
                )}
              >
                {availableTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Time Range</InputLabel>
              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <MenuItem value="7">Last Week</MenuItem>
                <MenuItem value="30">Last Month</MenuItem>
                <MenuItem value="90">Last 3 Months</MenuItem>
                <MenuItem value="365">Last Year</MenuItem>
                <MenuItem value="all">All Time</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <ToggleButtonGroup
              value={chartType}
              exclusive
              onChange={(e, value) => value && setChartType(value)}
              size="small"
            >
              <ToggleButton value="line">
                <Tooltip title="Line Chart">
                  <ShowChartIcon />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="area">
                <Tooltip title="Area Chart">
                  <TimelineIcon />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="bar">
                <Tooltip title="Bar Chart">
                  <BarChartIcon />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="scatter">
                <Tooltip title="Scatter Plot">
                  <PieChartIcon />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>
        </Grid>
      </Paper>

      {/* Statistics Cards */}
      {selectedTypes.length > 0 && Object.keys(statistics).length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {selectedTypes.map((type) => {
            const stat = statistics[type];
            if (!stat) return null;

            const typeInfo = measurementTypes.find(t => t.name === type) || {};
            const unit = typeInfo.default_unit || '';

            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={type}>
                <Card variant="outlined">
                  <CardContent sx={{ pb: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Typography>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">Latest:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {stat.latest ? `${stat.latest} ${unit}`.trim() : 'N/A'}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">Change:</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {stat.change !== null && (
                          <>
                            {stat.change > 0 ? (
                              <TrendingUpIcon fontSize="small" color="success" />
                            ) : stat.change < 0 ? (
                              <TrendingDownIcon fontSize="small" color="error" />
                            ) : null}
                            <Typography
                              variant="body2"
                              color={stat.change > 0 ? 'success.main' : stat.change < 0 ? 'error.main' : 'text.primary'}
                            >
                              {stat.change > 0 ? '+' : ''}{stat.change.toFixed(1)} {unit}
                            </Typography>
                          </>
                        )}
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">Range:</Typography>
                      <Typography variant="body2">
                        {stat.min.toFixed(1)} - {stat.max.toFixed(1)} {unit}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Points:</Typography>
                      <Typography variant="body2">{stat.count}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Main Chart */}
      {chartData.length > 0 && selectedTypes.length > 0 ? (
        <Card>
          <CardHeader
            title="Measurement Timeline"
            subheader={`${chartData.length} data points across ${selectedTypes.length} measurement type(s)`}
          />
          <CardContent>
            <Box sx={{ width: '100%', height: 400 }}>
              <ResponsiveContainer>
                {chartType === 'line' && (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="timestamp"
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={formatXAxisTick}
                    />
                    <YAxis />
                    <RechartsTooltip
                      labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy HH:mm')}
                      formatter={formatTooltip}
                    />
                    <Legend />
                    {selectedTypes.map((type, index) => (
                      <Line
                        key={type}
                        type="monotone"
                        dataKey={type}
                        stroke={getTypeColor(type, index)}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name={type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        connectNulls={false}
                      />
                    ))}
                    <Brush dataKey="timestamp" tickFormatter={formatXAxisTick} />
                  </LineChart>
                )}

                {chartType === 'area' && (
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="timestamp"
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={formatXAxisTick}
                    />
                    <YAxis />
                    <RechartsTooltip
                      labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy HH:mm')}
                      formatter={formatTooltip}
                    />
                    <Legend />
                    {selectedTypes.map((type, index) => (
                      <Area
                        key={type}
                        type="monotone"
                        dataKey={type}
                        stackId={index}
                        stroke={getTypeColor(type, index)}
                        fill={getTypeColor(type, index)}
                        fillOpacity={0.3}
                        name={type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      />
                    ))}
                  </AreaChart>
                )}

                {chartType === 'bar' && (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="timestamp"
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={formatXAxisTick}
                    />
                    <YAxis />
                    <RechartsTooltip
                      labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy HH:mm')}
                      formatter={formatTooltip}
                    />
                    <Legend />
                    {selectedTypes.map((type, index) => (
                      <Bar
                        key={type}
                        dataKey={type}
                        fill={getTypeColor(type, index)}
                        name={type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      />
                    ))}
                  </BarChart>
                )}

                {chartType === 'scatter' && (
                  <ScatterChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="timestamp"
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={formatXAxisTick}
                    />
                    <YAxis />
                    <RechartsTooltip
                      labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy HH:mm')}
                      formatter={formatTooltip}
                    />
                    <Legend />
                    {selectedTypes.map((type, index) => (
                      <Scatter
                        key={type}
                        dataKey={type}
                        fill={getTypeColor(type, index)}
                        name={type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      />
                    ))}
                  </ScatterChart>
                )}
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Alert severity="info">
          Select measurement types to view charts. Use the dropdown above to choose which measurements to visualize.
        </Alert>
      )}
    </Box>
  );
};

export default MeasurementCharts;