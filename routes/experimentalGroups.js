const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { check, validationResult } = require('express-validator');
const db = require('../db');
const logger = require('../utils/logger');
const { buildSearchClause } = require('../utils/searchUtils');
const { createErrorResponse } = require('../utils/errorHandling');

// @route   GET /api/experimental-groups
// @desc    Get all experimental groups with search, filtering, and pagination
// @access  Private (all roles)
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search = '', 
      study_id,
      treatment_type,
      sort = 'group_number',
      order = 'ASC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 0;

    // Search functionality
    if (search && search.trim()) {
      const searchCondition = buildSearchClause(search.trim(), [
        'eg.group_name', 'eg.treatment_description', 'es.study_name'
      ]);
      whereClause += ` AND (${searchCondition})`;
      values.push(`%${search.trim()}%`);
      paramCount++;
    }

    // Filter by study
    if (study_id) {
      paramCount++;
      whereClause += ` AND eg.study_id = $${paramCount}`;
      values.push(study_id);
    }

    // Filter by treatment type
    if (treatment_type) {
      paramCount++;
      whereClause += ` AND eg.treatment_type ILIKE $${paramCount}`;
      values.push(`%${treatment_type}%`);
    }

    // Validate sort column
    const allowedSortColumns = ['group_number', 'group_name', 'treatment_type', 'created_at'];
    const sortColumn = allowedSortColumns.includes(sort) ? `eg.${sort}` : 'eg.group_number';
    const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const query = `
      SELECT 
        eg.*,
        es.study_name,
        es.study_number,
        es.principal_investigator,
        (SELECT COUNT(*) FROM animal_group_assignments WHERE group_id = eg.id) as animal_count
      FROM experimental_groups eg
      LEFT JOIN experimental_studies es ON eg.study_id = es.id
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    values.push(parseInt(limit), offset);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM experimental_groups eg
      LEFT JOIN experimental_studies es ON eg.study_id = es.id
      ${whereClause}
    `;

    const [groupsResult, countResult] = await Promise.all([
      db.query(query, values),
      db.query(countQuery, values.slice(0, paramCount))
    ]);

    res.json({
      groups: groupsResult.rows,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        total_pages: Math.ceil(countResult.rows[0].total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error loading experimental groups:', err);
    res.status(500).json(createErrorResponse('Failed to load experimental groups'));
  }
});

// @route   GET /api/experimental-groups/:id
// @desc    Get single experimental group by ID with related data
// @access  Private (all roles)
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const groupQuery = `
      SELECT 
        eg.*,
        es.study_name,
        es.study_number,
        es.principal_investigator
      FROM experimental_groups eg
      LEFT JOIN experimental_studies es ON eg.study_id = es.id
      WHERE eg.id = $1
    `;

    const animalsQuery = `
      SELECT
        aga.*,
        a.animal_number,
        a.species,
        a.strain,
        a.sex,
        a.status as animal_status,
        h.location as housing_location
      FROM animal_group_assignments aga
      LEFT JOIN animals a ON aga.animal_id = a.id
      LEFT JOIN housing h ON a.housing_id = h.id
      WHERE aga.group_id = $1
      ORDER BY aga.assignment_date DESC
    `;

    const [groupResult, animalsResult] = await Promise.all([
      db.query(groupQuery, [id]),
      db.query(animalsQuery, [id])
    ]);

    if (groupResult.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Experimental group not found'));
    }

    res.json({
      group: groupResult.rows[0],
      animals: animalsResult.rows
    });
  } catch (err) {
    console.error('Error loading experimental group:', err);
    res.status(500).json(createErrorResponse('Failed to load experimental group'));
  }
});

// @route   POST /api/experimental-groups
// @desc    Create new experimental group
// @access  Private (admin, facility_manager, veterinarian)
router.post('/', [
  auth,
  roleCheck(['admin', 'facility_manager', 'veterinarian']),
  [
    check('study_id', 'Study ID is required').notEmpty(),
    check('group_name', 'Group name is required').notEmpty(),
    check('planned_size', 'Planned size must be a positive number').isInt({ min: 1 }),
    check('treatment_type', 'Treatment type is required').optional().notEmpty()
  ]
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', errors.array()));
    }

    const {
      study_id,
      group_name,
      treatment_type,
      treatment_description,
      planned_size,
      control_group,
      randomization_method,
      notes
    } = req.body;

    // Validate study exists
    const studyCheck = await db.query('SELECT id FROM experimental_studies WHERE id = $1', [study_id]);
    if (studyCheck.rows.length === 0) {
      return res.status(400).json(createErrorResponse('Study not found'));
    }

    const query = `
      INSERT INTO experimental_groups (
        study_id, group_name, treatment_type, treatment_description,
        planned_size, control_group, randomization_method, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      study_id, group_name, treatment_type, treatment_description,
      planned_size, control_group || false, randomization_method, notes
    ];

    const result = await db.query(query, values);

    logger.info(`Experimental group created: ${result.rows[0].group_number} by user ${req.user.id}`);

    res.status(201).json({
      message: 'Experimental group created successfully',
      group: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating experimental group:', err);
    res.status(500).json(createErrorResponse('Failed to create experimental group'));
  }
});

// @route   PUT /api/experimental-groups/:id
// @desc    Update experimental group
// @access  Private (admin, facility_manager, veterinarian)
router.put('/:id', [
  auth,
  roleCheck(['admin', 'facility_manager', 'veterinarian']),
  [
    check('group_name', 'Group name is required').notEmpty(),
    check('planned_size', 'Planned size must be a positive number').isInt({ min: 1 })
  ]
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', errors.array()));
    }

    const { id } = req.params;
    const {
      group_name,
      treatment_type,
      treatment_description,
      planned_size,
      control_group,
      randomization_method,
      notes
    } = req.body;

    const query = `
      UPDATE experimental_groups 
      SET 
        group_name = $1, treatment_type = $2, treatment_description = $3,
        planned_size = $4, control_group = $5, randomization_method = $6,
        notes = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `;

    const values = [
      group_name, treatment_type, treatment_description, planned_size,
      control_group || false, randomization_method, notes, id
    ];

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Experimental group not found'));
    }

    logger.info(`Experimental group updated: ${result.rows[0].group_number} by user ${req.user.id}`);

    res.json({
      message: 'Experimental group updated successfully',
      group: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating experimental group:', err);
    res.status(500).json(createErrorResponse('Failed to update experimental group'));
  }
});

// @route   DELETE /api/experimental-groups/:id
// @desc    Delete experimental group
// @access  Private (admin, facility_manager)
router.delete('/:id', [
  auth,
  roleCheck(['admin', 'facility_manager'])
], async (req, res) => {
  try {
    const { id } = req.params;

    // Check if group has any animal assignments
    const assignmentCheck = await db.query('SELECT COUNT(*) as count FROM animal_group_assignments WHERE group_id = $1', [id]);
    if (parseInt(assignmentCheck.rows[0].count) > 0) {
      return res.status(400).json(createErrorResponse('Cannot delete group with assigned animals'));
    }

    const result = await db.query('DELETE FROM experimental_groups WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Experimental group not found'));
    }

    logger.info(`Experimental group deleted: ${result.rows[0].group_number} by user ${req.user.id}`);

    res.json({ message: 'Experimental group deleted successfully' });
  } catch (err) {
    console.error('Error deleting experimental group:', err);
    res.status(500).json(createErrorResponse('Failed to delete experimental group'));
  }
});

// @route   POST /api/experimental-groups/:id/animals
// @desc    Assign animal to experimental group
// @access  Private (admin, facility_manager, technician)
router.post('/:id/animals', [
  auth,
  roleCheck(['admin', 'facility_manager', 'technician']),
  [
    check('animal_id', 'Animal ID is required').notEmpty(),
    check('assignment_date', 'Assignment date must be valid').optional().isISO8601()
  ]
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', errors.array()));
    }

    const { id: group_id } = req.params;
    const { animal_id, assignment_date, notes } = req.body;

    // Check if group exists
    const groupCheck = await db.query('SELECT id FROM experimental_groups WHERE id = $1', [group_id]);
    if (groupCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Experimental group not found'));
    }

    // Check if animal exists and is active
    const animalCheck = await db.query('SELECT id, status FROM animals WHERE id = $1', [animal_id]);
    if (animalCheck.rows.length === 0) {
      return res.status(400).json(createErrorResponse('Animal not found'));
    }
    if (animalCheck.rows[0].status !== 'active') {
      return res.status(400).json(createErrorResponse('Animal must be active to assign to experimental group'));
    }

    // Check if animal is already assigned to this group
    const existingAssignment = await db.query(
      'SELECT id FROM animal_group_assignments WHERE animal_id = $1 AND group_id = $2 AND removed_date IS NULL',
      [animal_id, group_id]
    );
    if (existingAssignment.rows.length > 0) {
      return res.status(400).json(createErrorResponse('Animal is already assigned to this group'));
    }

    const query = `
      INSERT INTO animal_group_assignments (
        animal_id, group_id, assignment_date, assigned_by, notes
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      animal_id, group_id, 
      assignment_date || new Date().toISOString().split('T')[0],
      req.user.username, notes
    ];

    const result = await db.query(query, values);

    logger.info(`Animal assigned to experimental group: Animal ${animal_id} to Group ${group_id} by user ${req.user.id}`);

    res.status(201).json({
      message: 'Animal assigned to experimental group successfully',
      assignment: result.rows[0]
    });
  } catch (err) {
    console.error('Error assigning animal to group:', err);
    res.status(500).json(createErrorResponse('Failed to assign animal to group'));
  }
});

// @route   DELETE /api/experimental-groups/:groupId/animals/:animalId
// @desc    Remove animal from experimental group
// @access  Private (admin, facility_manager, technician)
router.delete('/:groupId/animals/:animalId', [
  auth,
  roleCheck(['admin', 'facility_manager', 'technician'])
], async (req, res) => {
  try {
    const { groupId, animalId } = req.params;
    const { removal_reason } = req.body;

    const query = `
      UPDATE animal_group_assignments 
      SET 
        removed_date = CURRENT_DATE,
        removed_by = $1,
        removal_reason = $2
      WHERE animal_id = $3 AND group_id = $4 AND removed_date IS NULL
      RETURNING *
    `;

    const result = await db.query(query, [req.user.username, removal_reason, animalId, groupId]);

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Animal assignment not found'));
    }

    logger.info(`Animal removed from experimental group: Animal ${animalId} from Group ${groupId} by user ${req.user.id}`);

    res.json({
      message: 'Animal removed from experimental group successfully',
      assignment: result.rows[0]
    });
  } catch (err) {
    console.error('Error removing animal from group:', err);
    res.status(500).json(createErrorResponse('Failed to remove animal from group'));
  }
});

// @route   POST /api/experimental-groups/:id/treatments
// @desc    Add treatment record for experimental group
// @access  Private (admin, facility_manager, technician)
router.post('/:id/treatments', [
  auth,
  roleCheck(['admin', 'facility_manager', 'technician']),
  [
    check('treatment_name', 'Treatment name is required').notEmpty(),
    check('treatment_date', 'Treatment date must be valid').optional().isISO8601()
  ]
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', errors.array()));
    }

    const { id: group_id } = req.params;
    const { treatment_name, dose, route, treatment_date, administered_by, notes } = req.body;

    const query = `
      INSERT INTO group_treatments (
        group_id, treatment_name, dose, route, treatment_date, administered_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      group_id, treatment_name, dose, route,
      treatment_date || new Date().toISOString().split('T')[0],
      administered_by || req.user.username, notes
    ];

    const result = await db.query(query, values);

    res.status(201).json({
      message: 'Treatment record added successfully',
      treatment: result.rows[0]
    });
  } catch (err) {
    console.error('Error adding treatment record:', err);
    res.status(500).json(createErrorResponse('Failed to add treatment record'));
  }
});

// @route   POST /api/experimental-groups/:id/measurements
// @desc    Add measurement record for experimental group
// @access  Private (admin, facility_manager, technician, veterinarian)
router.post('/:id/measurements', [
  auth,
  roleCheck(['admin', 'facility_manager', 'technician', 'veterinarian']),
  [
    check('measurement_type', 'Measurement type is required').notEmpty(),
    check('measurement_date', 'Measurement date must be valid').optional().isISO8601()
  ]
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', errors.array()));
    }

    const { id: group_id } = req.params;
    const { measurement_type, value, unit, measurement_date, measured_by, notes } = req.body;

    const query = `
      INSERT INTO group_measurements (
        group_id, measurement_type, value, unit, measurement_date, measured_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      group_id, measurement_type, value, unit,
      measurement_date || new Date().toISOString().split('T')[0],
      measured_by || req.user.username, notes
    ];

    const result = await db.query(query, values);

    res.status(201).json({
      message: 'Measurement record added successfully',
      measurement: result.rows[0]
    });
  } catch (err) {
    console.error('Error adding measurement record:', err);
    res.status(500).json(createErrorResponse('Failed to add measurement record'));
  }
});

// @route   GET /api/groups/:id/animals
// @desc    Get all animals in a specific group
// @access  Private
router.get('/:id/animals', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        a.*,
        aga.assignment_date,
        aga.assigned_by
      FROM animals a
      JOIN animal_group_assignments aga ON a.id = aga.animal_id
      WHERE aga.group_id = $1
      ORDER BY a.animal_number
    `;

    const result = await db.query(query, [id]);

    res.json({
      animals: result.rows
    });
  } catch (err) {
    console.error('Error loading group animals:', err);
    res.status(500).json(createErrorResponse('Failed to load group animals'));
  }
});

module.exports = router;