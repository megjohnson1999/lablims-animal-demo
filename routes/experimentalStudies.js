const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { check, validationResult } = require('express-validator');
const db = require('../db');
const logger = require('../utils/logger');
const { buildSearchClause } = require('../utils/searchUtils');
const { createErrorResponse } = require('../utils/errorHandling');

// @route   GET /api/experimental-studies
// @desc    Get all experimental studies with search, filtering, and pagination
// @access  Private (all roles)
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search = '', 
      status,
      species,
      principal_investigator,
      sort = 'study_number',
      order = 'ASC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 0;

    // Search functionality
    if (search && search.trim()) {
      const searchCondition = buildSearchClause(search.trim(), [
        'study_name', 'principal_investigator', 'description', 'iacuc_protocol_number'
      ]);
      whereClause += ` AND (${searchCondition})`;
      values.push(`%${search.trim()}%`);
      paramCount++;
    }

    // Filter by status
    if (status && status !== 'all') {
      paramCount++;
      whereClause += ` AND status = $${paramCount}`;
      values.push(status);
    }

    // Filter by species
    if (species) {
      paramCount++;
      whereClause += ` AND species_required ILIKE $${paramCount}`;
      values.push(`%${species}%`);
    }

    // Filter by PI
    if (principal_investigator) {
      paramCount++;
      whereClause += ` AND principal_investigator ILIKE $${paramCount}`;
      values.push(`%${principal_investigator}%`);
    }

    // Validate sort column
    const allowedSortColumns = ['study_number', 'study_name', 'principal_investigator', 'status', 'start_date', 'created_at'];
    const sortColumn = allowedSortColumns.includes(sort) ? sort : 'study_number';
    const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const query = `
      SELECT 
        es.*,
        (SELECT COUNT(*) FROM experimental_groups WHERE study_id = es.id) as group_count,
        (SELECT COUNT(*) FROM animal_group_assignments aga 
         JOIN experimental_groups eg ON aga.group_id = eg.id 
         WHERE eg.study_id = es.id) as total_animals
      FROM experimental_studies es
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    values.push(parseInt(limit), offset);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM experimental_studies es
      ${whereClause}
    `;

    const [studiesResult, countResult] = await Promise.all([
      db.query(query, values),
      db.query(countQuery, values.slice(0, paramCount))
    ]);

    res.json({
      studies: studiesResult.rows,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        total_pages: Math.ceil(countResult.rows[0].total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error loading experimental studies:', err);
    res.status(500).json(createErrorResponse('Failed to load experimental studies'));
  }
});

// @route   GET /api/experimental-studies/:id
// @desc    Get single experimental study by ID with related data
// @access  Private (all roles)
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const studyQuery = `
      SELECT es.*
      FROM experimental_studies es
      WHERE es.id = $1
    `;

    const groupsQuery = `
      SELECT 
        eg.*,
        (SELECT COUNT(*) FROM animal_group_assignments WHERE group_id = eg.id) as animal_count
      FROM experimental_groups eg
      WHERE eg.study_id = $1
      ORDER BY eg.group_number ASC
    `;

    const [studyResult, groupsResult] = await Promise.all([
      db.query(studyQuery, [id]),
      db.query(groupsQuery, [id])
    ]);

    if (studyResult.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Experimental study not found'));
    }

    res.json({
      study: studyResult.rows[0],
      groups: groupsResult.rows
    });
  } catch (err) {
    console.error('Error loading experimental study:', err);
    res.status(500).json(createErrorResponse('Failed to load experimental study'));
  }
});

// @route   POST /api/experimental-studies
// @desc    Create new experimental study
// @access  Private (admin, facility_manager, veterinarian)
router.post('/', [
  auth,
  roleCheck(['admin', 'facility_manager', 'veterinarian']),
  [
    check('study_name', 'Study name is required').notEmpty(),
    check('principal_investigator', 'Principal investigator is required').notEmpty(),
    check('species_required', 'Species is required').notEmpty(),
    check('total_animals_planned', 'Total animals planned must be a positive number').isInt({ min: 1 }),
    check('status', 'Invalid status').optional().isIn(['planning', 'active', 'completed', 'cancelled']),
    check('start_date', 'Start date must be valid').optional().isISO8601(),
    check('planned_end_date', 'Planned end date must be valid').optional().isISO8601()
  ]
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', errors.array()));
    }

    const {
      study_name,
      principal_investigator,
      description,
      iacuc_protocol_number,
      species_required,
      total_animals_planned,
      status = 'planning',
      start_date,
      planned_end_date,
      objective,
      study_type,
      notes
    } = req.body;

    const query = `
      INSERT INTO experimental_studies (
        study_name, principal_investigator, description, iacuc_protocol_number,
        species_required, total_animals_planned, status, start_date, 
        planned_end_date, objective, study_type, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      study_name, principal_investigator, description, iacuc_protocol_number,
      species_required, total_animals_planned, status, start_date,
      planned_end_date, objective, study_type, notes, req.user.id
    ];

    const result = await db.query(query, values);

    logger.info(`Experimental study created: ${result.rows[0].study_number} by user ${req.user.id}`);

    res.status(201).json({
      message: 'Experimental study created successfully',
      study: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating experimental study:', err);
    res.status(500).json(createErrorResponse('Failed to create experimental study'));
  }
});

// @route   PUT /api/experimental-studies/:id
// @desc    Update experimental study
// @access  Private (admin, facility_manager, veterinarian)
router.put('/:id', [
  auth,
  roleCheck(['admin', 'facility_manager', 'veterinarian']),
  [
    check('study_name', 'Study name is required').notEmpty(),
    check('principal_investigator', 'Principal investigator is required').notEmpty(),
    check('species_required', 'Species is required').notEmpty(),
    check('total_animals_planned', 'Total animals planned must be a positive number').isInt({ min: 1 }),
    check('status', 'Invalid status').optional().isIn(['planning', 'active', 'completed', 'cancelled']),
    check('start_date', 'Start date must be valid').optional().isISO8601(),
    check('planned_end_date', 'Planned end date must be valid').optional().isISO8601()
  ]
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', errors.array()));
    }

    const { id } = req.params;
    const {
      study_name,
      principal_investigator,
      description,
      iacuc_protocol_number,
      species_required,
      total_animals_planned,
      status,
      start_date,
      planned_end_date,
      actual_end_date,
      objective,
      study_type,
      notes
    } = req.body;

    const query = `
      UPDATE experimental_studies 
      SET 
        study_name = $1, principal_investigator = $2, description = $3,
        iacuc_protocol_number = $4, species_required = $5, total_animals_planned = $6,
        status = $7, start_date = $8, planned_end_date = $9, actual_end_date = $10,
        objective = $11, study_type = $12, notes = $13, updated_at = CURRENT_TIMESTAMP
      WHERE id = $14
      RETURNING *
    `;

    const values = [
      study_name, principal_investigator, description, iacuc_protocol_number,
      species_required, total_animals_planned, status, start_date,
      planned_end_date, actual_end_date, objective, study_type, notes, id
    ];

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Experimental study not found'));
    }

    logger.info(`Experimental study updated: ${result.rows[0].study_number} by user ${req.user.id}`);

    res.json({
      message: 'Experimental study updated successfully',
      study: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating experimental study:', err);
    res.status(500).json(createErrorResponse('Failed to update experimental study'));
  }
});

// @route   DELETE /api/experimental-studies/:id
// @desc    Delete experimental study
// @access  Private (admin, facility_manager)
router.delete('/:id', [
  auth,
  roleCheck(['admin', 'facility_manager'])
], async (req, res) => {
  try {
    const { id } = req.params;

    // Check if study has any groups
    const groupCheck = await db.query('SELECT COUNT(*) as count FROM experimental_groups WHERE study_id = $1', [id]);
    if (parseInt(groupCheck.rows[0].count) > 0) {
      return res.status(400).json(createErrorResponse('Cannot delete study with existing experimental groups'));
    }

    const result = await db.query('DELETE FROM experimental_studies WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Experimental study not found'));
    }

    logger.info(`Experimental study deleted: ${result.rows[0].study_number} by user ${req.user.id}`);

    res.json({ message: 'Experimental study deleted successfully' });
  } catch (err) {
    console.error('Error deleting experimental study:', err);
    res.status(500).json(createErrorResponse('Failed to delete experimental study'));
  }
});

// @route   GET /api/experimental-studies/stats/summary
// @desc    Get experimental studies statistics summary
// @access  Private (all roles)
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const queries = {
      total: 'SELECT COUNT(*) as count FROM experimental_studies',
      active: 'SELECT COUNT(*) as count FROM experimental_studies WHERE status = \'active\'',
      by_status: `
        SELECT status, COUNT(*) as count 
        FROM experimental_studies 
        GROUP BY status 
        ORDER BY count DESC
      `,
      by_species: `
        SELECT species_required, COUNT(*) as count
        FROM experimental_studies
        GROUP BY species_required
        ORDER BY count DESC
      `,
      recent_additions: `
        SELECT COUNT(*) as count
        FROM experimental_studies
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      `
    };

    const [totalResult, activeResult, statusResult, speciesResult, recentResult] = await Promise.all([
      db.query(queries.total),
      db.query(queries.active),
      db.query(queries.by_status),
      db.query(queries.by_species),
      db.query(queries.recent_additions)
    ]);

    res.json({
      total_studies: parseInt(totalResult.rows[0].count),
      active_studies: parseInt(activeResult.rows[0].count),
      by_status: statusResult.rows,
      by_species: speciesResult.rows,
      recent_additions: parseInt(recentResult.rows[0].count)
    });
  } catch (err) {
    console.error('Error loading studies stats:', err);
    res.status(500).json(createErrorResponse('Failed to load statistics'));
  }
});

module.exports = router;