import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Paper,
  Divider,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  CloudUpload as UploadIcon,
  AutoAwesome as AIIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-toastify';

const ProtocolReagentCSVUpload = ({ onReagentsLoaded, existingReagents = [], disabled = false }) => {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [parsedReagents, setParsedReagents] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // AI Prompt template for external AI tools
  const aiPromptTemplate = `Please extract reagents from the following protocol document and format them as a CSV with these exact columns:

reagent_name,quantity_per_sample,unit

IMPORTANT: Please specify how many samples this protocol is designed for, then calculate per-sample quantities accordingly.

Requirements:
- Include ONLY reagents, chemicals, buffers, enzymes, and biological materials
- For "quantity_per_sample": extract or calculate the amount needed per individual sample/reaction
- For "unit": use standard laboratory units (µL, mL, L, µg, mg, g, kg, mM, µM, U, etc.)
- If quantity is not specified or varies, use "As needed"
- Handle master mixes by dividing total volume by number of samples
- Include stock concentrations in reagent names when relevant (e.g., "5X RT Buffer", "10mg/ml Lysozyme")

EXCLUDE these consumables:
- Tubes, tips, plates, containers, adaptors
- Pipette tips, syringes, filters  
- Equipment, instruments, timers
- Safety supplies (gloves, lab coats, waste containers)
- General lab supplies (markers, ice, racks)

INCLUDE these reagents:
- All buffers and solutions (RT Buffer, PCR Buffer, SM Buffer, EDTA, etc.)
- All enzymes (DNA polymerase, RT enzyme, Sequenase, DNase, Lysozyme, etc.)
- Nucleotides and primers (dNTP mix, primers, controls)
- Chemical reagents and biological materials
- Water (nuclease-free H2O)

For complex protocols with multiple rounds/phases:
- Extract reagents from ALL protocol steps and rounds
- Calculate per-sample amounts even from master mix recipes
- Preserve important reagent specifications (concentrations, enzyme units)

Example format based on real lab protocols:
reagent_name,quantity_per_sample,unit
5X RT Buffer,4,µL
12.5mM dNTP mix,0.8,µL
RT enzyme Promega,2,µL
Nuclease-free H2O,3.2,µL
10X PCR Buffer,10,µL
50mM MgCl2,4,µL
Accuprime Taq Hot Start,1,µL
SM buffer,1200,µL
Lysozyme 10mg/ml,80,µL
TurboDNaseI 2U/µL,20,µL

Protocol to process: [PASTE YOUR PROTOCOL HERE]

Please analyze the protocol and return only the CSV data:`;

  const csvFormatExample = [
    { name: '5X RT Buffer', quantity: '4', unit: 'µL' },
    { name: '12.5mM dNTP mix', quantity: '0.8', unit: 'µL' },
    { name: 'RT enzyme Promega', quantity: '2', unit: 'µL' },
    { name: 'Nuclease-free H2O', quantity: '3.2', unit: 'µL' },
    { name: '10X PCR Buffer', quantity: '10', unit: 'µL' },
    { name: 'SM buffer', quantity: '1200', unit: 'µL' },
    { name: 'Lysozyme 10mg/ml', quantity: '80', unit: 'µL' },
    { name: 'TurboDNaseI 2U/µL', quantity: '20', unit: 'µL' }
  ];

  const copyPromptToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(aiPromptTemplate);
      toast.success('AI prompt copied to clipboard!');
    } catch (err) {
      toast.error('Failed to copy prompt');
    }
  };

  const parseCSV = (csvText) => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    // Validate required columns (flexible matching for backward compatibility)
    const requiredColumns = ['reagent_name', 'quantity_per_sample', 'unit'];
    const nameIndex = headers.findIndex(h => 
      h === 'reagent_name' || h.toLowerCase().includes('reagent') || h.toLowerCase().includes('name')
    );
    const quantityIndex = headers.findIndex(h => 
      h === 'quantity_per_sample' || h.toLowerCase().includes('quantity')
    );
    const unitIndex = headers.findIndex(h => 
      h === 'unit' || h.toLowerCase() === 'unit'
    );
    
    if (nameIndex === -1 || quantityIndex === -1 || unitIndex === -1) {
      throw new Error('CSV must contain columns for reagent name, quantity per sample, and unit');
    }

    const reagents = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      
      if (values.length > Math.max(nameIndex, quantityIndex, unitIndex) && values[nameIndex]) {
        const quantityValue = values[quantityIndex] || 'As needed';
        // Try to parse as number, keep as string if it's a valid non-numeric value
        let parsedQuantity = quantityValue;
        const numericValue = parseFloat(quantityValue);
        if (!isNaN(numericValue) && isFinite(numericValue)) {
          parsedQuantity = numericValue;
        } else if (quantityValue.toLowerCase() === 'as needed') {
          parsedQuantity = 'As needed';
        }
        
        reagents.push({
          name: values[nameIndex],
          quantity_per_sample: parsedQuantity,
          unit: values[unitIndex] || ''
        });
      }
    }

    return reagents;
  };

  const onDrop = async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    
    // Validate file type
    const isValidType = file.name.endsWith('.csv') || 
                       file.name.endsWith('.txt') || 
                       file.type === 'text/csv' || 
                       file.type === 'text/plain';
    
    if (!isValidType) {
      setError('Please select a CSV or TXT file with comma-separated values');
      return;
    }

    setUploadedFile(file);
    setError('');
    setLoading(true);

    try {
      const text = await file.text();
      const reagents = parseCSV(text);
      
      if (reagents.length === 0) {
        throw new Error('No valid reagents found in CSV');
      }

      setParsedReagents(reagents);
      
      // Call parent callback with parsed reagents
      if (onReagentsLoaded) {
        onReagentsLoaded(reagents);
      }
      
      toast.success(`Successfully loaded ${reagents.length} reagents from CSV`);
    } catch (err) {
      setError(err.message);
      setParsedReagents([]);
      setUploadedFile(null);
    } finally {
      setLoading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'application/vnd.ms-excel': ['.csv']
    },
    maxFiles: 1,
    disabled: disabled || loading
  });

  const downloadTemplate = () => {
    const csvContent = 'reagent_name,quantity_per_sample,unit\n5X RT Buffer,4,µL\n12.5mM dNTP mix,0.8,µL\nRT enzyme Promega,2,µL\nNuclease-free H2O,3.2,µL\n10X PCR Buffer,10,µL\nSM buffer,1200,µL\nLysozyme 10mg/ml,80,µL\nTurboDNaseI 2U/µL,20,µL';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reagent_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <Box>
      {/* Reagent Extraction Helper Section */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3, bgcolor: 'primary.50' }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <AIIcon sx={{ mr: 1 }} />
          Reagent Extraction Helper
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Use this prompt with ChatGPT, Claude, or any AI tool to extract reagents from your protocol document:
        </Typography>

        <Paper 
          variant="outlined" 
          sx={{ 
            p: 2, 
            bgcolor: 'grey.50', 
            fontFamily: 'monospace', 
            fontSize: '0.85rem',
            maxHeight: 200,
            overflow: 'auto',
            mb: 2
          }}
        >
          {aiPromptTemplate}
        </Paper>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<CopyIcon />}
            onClick={copyPromptToClipboard}
          >
            Copy Prompt
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={downloadTemplate}
          >
            Download Template
          </Button>
        </Box>
      </Paper>

      {/* CSV Upload Section */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Upload Reagent CSV
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box
          {...getRootProps()}
          sx={{
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'grey.300',
            borderRadius: 2,
            padding: 4,
            textAlign: 'center',
            cursor: disabled || loading ? 'not-allowed' : 'pointer',
            backgroundColor: isDragActive ? 'primary.50' : disabled ? 'grey.50' : 'transparent',
            mb: 2,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              borderColor: disabled || loading ? 'grey.300' : 'primary.main',
              backgroundColor: disabled || loading ? 'grey.50' : 'primary.50'
            }
          }}
        >
          <input {...getInputProps()} />
          <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          
          {uploadedFile ? (
            <Box>
              <Typography variant="body1" color="success.main">
                ✓ {uploadedFile.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {parsedReagents.length} reagents loaded
              </Typography>
            </Box>
          ) : (
            <Box>
              <Typography variant="body1" gutterBottom>
                {isDragActive
                  ? 'Drop the file here...'
                  : 'Drag and drop a CSV or TXT file here, or click to select'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Supports CSV and TXT files with comma-separated reagent data
              </Typography>
            </Box>
          )}
        </Box>

        {/* Expected Format Example */}
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" gutterBottom>
          Expected CSV Format:
        </Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>reagent_name</strong></TableCell>
                <TableCell><strong>quantity_per_sample</strong></TableCell>
                <TableCell><strong>unit</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {csvFormatExample.map((reagent, index) => (
                <TableRow key={index}>
                  <TableCell>{reagent.name}</TableCell>
                  <TableCell>{reagent.quantity}</TableCell>
                  <TableCell>{reagent.unit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Loaded Reagents Preview */}
        {parsedReagents.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Loaded Reagents ({parsedReagents.length}):
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              {parsedReagents.slice(0, 10).map((reagent, index) => (
                <Chip
                  key={index}
                  label={`${reagent.name} (${reagent.quantity_per_sample} ${reagent.unit})`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              ))}
              {parsedReagents.length > 10 && (
                <Chip
                  label={`+${parsedReagents.length - 10} more`}
                  size="small"
                  color="default"
                />
              )}
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default ProtocolReagentCSVUpload;