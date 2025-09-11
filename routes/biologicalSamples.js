const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { check, validationResult } = require('express-validator');
const db = require('../db');
const logger = require('../utils/logger');
const { buildSearchClause } = require('../utils/searchUtils');
const { createErrorResponse } = require('../utils/errorHandling');

// @route   GET /api/biological-samples
// @desc    Get all biological samples with search, filtering, and pagination
// @access  Private (all roles)
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search = '', 
      animal_id,
      study_id,
      sample_type,
      anatomical_site,
      status = 'all',
      collection_date_from,
      collection_date_to,
      storage_location,
      treatment_group,
      timepoint,
      sort = 'collection_date',
      order = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 0;

    // Search functionality
    if (search && search.trim()) {
      const searchCondition = buildSearchClause(search.trim(), [
        'bs.sample_barcode', 'bs.anatomical_site', 'bs.sample_description',
        'bs.collected_by', 'bs.notes', 'a.animal_number'
      ]);
      whereClause += ` AND (${searchCondition})`;
      values.push(`%${search.trim()}%`);
      paramCount++;
    }

    // Filter by animal
    if (animal_id) {
      paramCount++;
      whereClause += ` AND bs.animal_id = $${paramCount}`;
      values.push(animal_id);
    }

    // Filter by study
    if (study_id) {
      paramCount++;
      whereClause += ` AND bs.study_id = $${paramCount}`;
      values.push(study_id);
    }

    // Filter by sample type
    if (sample_type && sample_type !== 'all') {
      paramCount++;
      whereClause += ` AND bs.sample_type = $${paramCount}`;
      values.push(sample_type);
    }

    // Filter by anatomical site
    if (anatomical_site && anatomical_site !== 'all') {
      paramCount++;
      whereClause += ` AND bs.anatomical_site ILIKE $${paramCount}`;
      values.push(`%${anatomical_site}%`);
    }

    // Filter by status
    if (status && status !== 'all') {
      paramCount++;
      whereClause += ` AND bs.status = $${paramCount}`;
      values.push(status);
    }

    // Filter by collection date range
    if (collection_date_from) {
      paramCount++;
      whereClause += ` AND bs.collection_date >= $${paramCount}`;
      values.push(collection_date_from);
    }

    if (collection_date_to) {
      paramCount++;
      whereClause += ` AND bs.collection_date <= $${paramCount}`;
      values.push(collection_date_to);
    }

    // Filter by storage location
    if (storage_location) {
      paramCount++;
      whereClause += ` AND bs.storage_location ILIKE $${paramCount}`;
      values.push(`%${storage_location}%`);
    }

    // Filter by treatment group
    if (treatment_group) {
      paramCount++;
      whereClause += ` AND bs.treatment_group ILIKE $${paramCount}`;
      values.push(`%${treatment_group}%`);
    }

    // Filter by timepoint
    if (timepoint) {
      paramCount++;
      whereClause += ` AND bs.timepoint ILIKE $${paramCount}`;
      values.push(`%${timepoint}%`);
    }

    // Validate sort column
    const allowedSortColumns = [
      'collection_date', 'sample_number', 'sample_type', 'anatomical_site', 
      'status', 'animal_number', 'study_name', 'created_at'
    ];
    const sortColumn = allowedSortColumns.includes(sort) ? 
      (sort === 'animal_number' ? 'a.animal_number' : 
       sort === 'study_name' ? 'es.study_name' : 
       `bs.${sort}`) : 'bs.collection_date';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const query = `
      SELECT 
        bs.*,
        a.animal_number,
        a.species,
        a.strain,
        a.sex,
        es.study_name,
        es.principal_investigator,
        u.username as created_by_username,
        -- Calculate storage summary
        CONCAT_WS(' / ', bs.storage_location, bs.storage_container, bs.storage_position) as full_storage_location,
        -- Calculate remaining percentages
        CASE 
          WHEN bs.initial_volume_ml > 0 
          THEN ROUND((bs.current_volume_ml / bs.initial_volume_ml * 100)::numeric, 1)
          ELSE NULL 
        END as volume_remaining_percent,
        CASE 
          WHEN bs.initial_weight_mg > 0 
          THEN ROUND((bs.current_weight_mg / bs.initial_weight_mg * 100)::numeric, 1)
          ELSE NULL 
        END as weight_remaining_percent
      FROM biological_samples bs
      LEFT JOIN animals a ON bs.animal_id = a.id
      LEFT JOIN experimental_studies es ON bs.study_id = es.id  
      LEFT JOIN users u ON bs.created_by = u.id
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    values.push(parseInt(limit), offset);

    const countQuery = `
      SELECT COUNT(DISTINCT bs.id) as total
      FROM biological_samples bs
      LEFT JOIN animals a ON bs.animal_id = a.id
      LEFT JOIN experimental_studies es ON bs.study_id = es.id  
      ${whereClause}
    `;

    const [samplesResult, countResult] = await Promise.all([
      db.query(query, values),
      db.query(countQuery, values.slice(0, paramCount))
    ]);

    res.json({
      samples: samplesResult.rows,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        total_pages: Math.ceil(countResult.rows[0].total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error loading biological samples:', err);
    res.status(500).json(createErrorResponse('Failed to load biological samples'));
  }
});

// @route   GET /api/biological-samples/:id
// @desc    Get single biological sample with full details
// @access  Private (all roles)
router.get('/:id', auth, async (req, res) => {
  try {
    const query = `
      SELECT 
        bs.*,
        a.animal_number,
        a.species,
        a.strain,
        a.sex,
        a.birth_date,
        es.study_name,
        es.principal_investigator,
        u.username as created_by_username,
        -- Calculate age at collection
        CASE 
          WHEN a.birth_date IS NOT NULL 
          THEN EXTRACT(days FROM bs.collection_date - a.birth_date)
          ELSE NULL 
        END as age_at_collection_days,
        -- Storage summary
        CONCAT_WS(' / ', bs.storage_location, bs.storage_container, bs.storage_position) as full_storage_location
      FROM biological_samples bs
      LEFT JOIN animals a ON bs.animal_id = a.id
      LEFT JOIN experimental_studies es ON bs.study_id = es.id  
      LEFT JOIN users u ON bs.created_by = u.id
      WHERE bs.id = $1
    `;
    
    const result = await db.query(query, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Biological sample not found'));
    }

    // Get related aliquots
    const aliquotsQuery = `
      SELECT sa.*, bs.sample_barcode as aliquot_barcode
      FROM sample_aliquots sa
      JOIN biological_samples bs ON sa.aliquot_sample_id = bs.id
      WHERE sa.parent_sample_id = $1
      ORDER BY sa.aliquot_number
    `;
    const aliquotsResult = await db.query(aliquotsQuery, [req.params.id]);

    // Get usage history
    const usageQuery = `
      SELECT * FROM sample_usage 
      WHERE sample_id = $1 
      ORDER BY usage_date DESC
    `;
    const usageResult = await db.query(usageQuery, [req.params.id]);

    res.json({
      sample: result.rows[0],
      aliquots: aliquotsResult.rows,
      usage_history: usageResult.rows
    });
  } catch (err) {
    console.error('Error loading biological sample:', err);
    res.status(500).json(createErrorResponse('Failed to load biological sample'));
  }
});

// @route   POST /api/biological-samples
// @desc    Create new biological sample
// @access  Private (admin, facility_manager, technician, veterinarian)
router.post('/', [
  auth,
  roleCheck(['admin', 'facility_manager', 'technician', 'veterinarian']),
  [
    check('animal_id', 'Animal ID is required').notEmpty(),
    check('sample_type', 'Sample type is required').notEmpty(),
    check('collection_date', 'Collection date is required').isISO8601(),
    check('collected_by', 'Collector name is required').notEmpty(),
    check('initial_volume_ml', 'Initial volume must be positive').optional({ nullable: true }).isFloat({ min: 0 }),
    check('initial_weight_mg', 'Initial weight must be positive').optional({ nullable: true }).isFloat({ min: 0 })
  ]
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', JSON.stringify(errors.array(), null, 2));
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      animal_id,
      study_id,
      protocol_id,
      sample_barcode,
      sample_type,
      anatomical_site,
      sample_description,
      collection_date,
      collection_method,
      collected_by,
      collection_protocol,
      processing_date,
      processing_method,
      preservation_method,
      processed_by,
      storage_location,
      storage_container,
      storage_position,
      storage_temperature,
      initial_volume_ml,
      current_volume_ml,
      initial_weight_mg,
      current_weight_mg,
      concentration_mg_ml,
      quality_score,
      treatment_group,
      timepoint,
      collection_order,
      iacuc_protocol,
      collection_approved_by,
      metadata = {},
      notes
    } = req.body;

    const query = `
      INSERT INTO biological_samples (
        animal_id, study_id, protocol_id, sample_barcode, sample_type,
        anatomical_site, sample_description, collection_date, collection_method,
        collected_by, collection_protocol, processing_date, processing_method,
        preservation_method, processed_by, storage_location, storage_container,
        storage_position, storage_temperature, initial_volume_ml, current_volume_ml,
        initial_weight_mg, current_weight_mg, concentration_mg_ml, quality_score,
        treatment_group, timepoint, collection_order, iacuc_protocol,
        collection_approved_by, metadata, notes, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33
      ) RETURNING *
    `;

    const values = [
      animal_id, study_id, protocol_id, sample_barcode, sample_type,
      anatomical_site, sample_description, collection_date, collection_method,
      collected_by, collection_protocol, processing_date, processing_method,
      preservation_method, processed_by, storage_location, storage_container,
      storage_position, storage_temperature, 
      initial_volume_ml, current_volume_ml || initial_volume_ml,
      initial_weight_mg, current_weight_mg || initial_weight_mg,
      concentration_mg_ml, quality_score, treatment_group, timepoint,
      collection_order, iacuc_protocol, collection_approved_by,
      JSON.stringify(metadata), notes, req.user.id
    ];

    const result = await db.query(query, values);

    logger.info(`Biological sample created: ${result.rows[0].sample_number} by user ${req.user.id}`);

    res.status(201).json({
      message: 'Biological sample created successfully',
      sample: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating biological sample:', err);
    if (err.code === '23505') { // Unique constraint violation
      if (err.constraint === 'biological_samples_sample_barcode_key') {
        return res.status(400).json(createErrorResponse('Sample barcode already exists'));
      }
    }
    res.status(500).json(createErrorResponse('Failed to create biological sample'));
  }
});

// @route   PUT /api/biological-samples/:id
// @desc    Update biological sample
// @access  Private (admin, facility_manager, technician, veterinarian)
router.put('/:id', [
  auth,
  roleCheck(['admin', 'facility_manager', 'technician', 'veterinarian'])
], async (req, res) => {
  try {
    const sampleId = req.params.id;
    
    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramCount = 0;

    const allowedFields = [
      'sample_barcode', 'sample_type', 'anatomical_site', 'sample_description',
      'collection_method', 'collected_by', 'collection_protocol', 'processing_date',
      'processing_method', 'preservation_method', 'processed_by', 'storage_location',
      'storage_container', 'storage_position', 'storage_temperature', 'current_volume_ml',
      'current_weight_mg', 'concentration_mg_ml', 'quality_score', 'status',
      'treatment_group', 'timepoint', 'iacuc_protocol', 'metadata', 'notes'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        paramCount++;
        updateFields.push(`${field} = $${paramCount}`);
        values.push(field === 'metadata' ? JSON.stringify(req.body[field]) : req.body[field]);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json(createErrorResponse('No valid fields to update'));
    }

    paramCount++;
    values.push(sampleId);

    const query = `
      UPDATE biological_samples 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Biological sample not found'));
    }

    logger.info(`Biological sample updated: ${result.rows[0].sample_number} by user ${req.user.id}`);

    res.json({
      message: 'Biological sample updated successfully',
      sample: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating biological sample:', err);
    res.status(500).json(createErrorResponse('Failed to update biological sample'));
  }
});

// @route   POST /api/biological-samples/:id/use
// @desc    Record usage of a biological sample
// @access  Private (admin, facility_manager, technician, veterinarian, researcher)
router.post('/:id/use', [
  auth,
  roleCheck(['admin', 'facility_manager', 'technician', 'veterinarian', 'researcher']),
  [
    check('used_by', 'User name is required').notEmpty(),
    check('analysis_type', 'Analysis type is required').notEmpty(),
    check('volume_used_ml', 'Volume used must be positive').optional().isFloat({ min: 0 }),
    check('weight_used_mg', 'Weight used must be positive').optional().isFloat({ min: 0 })
  ]
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', JSON.stringify(errors.array(), null, 2));
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { used_by, analysis_type, volume_used_ml, weight_used_mg, purpose, results_location, notes } = req.body;

    const query = `
      INSERT INTO sample_usage (
        sample_id, usage_date, used_by, analysis_type, volume_used_ml,
        weight_used_mg, purpose, results_location, notes
      ) VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      req.params.id, used_by, analysis_type, volume_used_ml, 
      weight_used_mg, purpose, results_location, notes
    ];

    const result = await db.query(query, values);

    logger.info(`Sample usage recorded for sample ${req.params.id} by user ${req.user.id}`);

    res.status(201).json({
      message: 'Sample usage recorded successfully',
      usage: result.rows[0]
    });
  } catch (err) {
    console.error('Error recording sample usage:', err);
    res.status(500).json(createErrorResponse('Failed to record sample usage'));
  }
});

// @route   GET /api/biological-samples/stats/summary
// @desc    Get biological samples statistics
// @access  Private (all roles)
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const queries = {
      total: 'SELECT COUNT(*) as count FROM biological_samples',
      by_type: `
        SELECT sample_type, COUNT(*) as count
        FROM biological_samples 
        GROUP BY sample_type 
        ORDER BY count DESC
      `,
      by_status: `
        SELECT status, COUNT(*) as count
        FROM biological_samples 
        GROUP BY status
      `,
      by_storage: `
        SELECT storage_location, COUNT(*) as count
        FROM biological_samples
        WHERE storage_location IS NOT NULL
        GROUP BY storage_location
        ORDER BY count DESC
      `,
      recent_collections: `
        SELECT DATE(collection_date) as collection_date, COUNT(*) as count
        FROM biological_samples
        WHERE collection_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(collection_date)
        ORDER BY collection_date DESC
      `
    };

    const [totalResult, typeResult, statusResult, storageResult, recentResult] = await Promise.all([
      db.query(queries.total),
      db.query(queries.by_type),
      db.query(queries.by_status),
      db.query(queries.by_storage),
      db.query(queries.recent_collections)
    ]);

    res.json({
      total_samples: parseInt(totalResult.rows[0].count),
      by_type: typeResult.rows,
      by_status: statusResult.rows,
      by_storage: storageResult.rows,
      recent_collections: recentResult.rows
    });
  } catch (err) {
    console.error('Error loading biological samples stats:', err);
    res.status(500).json(createErrorResponse('Failed to load biological samples statistics'));
  }
});

module.exports = router;