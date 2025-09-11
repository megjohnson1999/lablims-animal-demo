const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { check, validationResult } = require('express-validator');
const db = require('../db');
const logger = require('../utils/logger');
const { buildSearchClause } = require('../utils/searchUtils');
const { createErrorResponse } = require('../utils/errorHandling');

// @route   GET /api/housing
// @desc    Get all housing with search, filtering, and pagination
// @access  Private (all roles)
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search = '', 
      location,
      status = 'active',
      cage_type,
      availability = 'all', // 'available', 'occupied', 'full', 'all'
      sort = 'housing_number',
      order = 'ASC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 0;

    // Search functionality
    if (search && search.trim()) {
      const searchCondition = buildSearchClause(search.trim(), [
        'housing_number', 'location', 'cage_type', 'notes'
      ]);
      whereClause += ` AND (${searchCondition})`;
      values.push(`%${search.trim()}%`);
      paramCount++;
    }

    // Filter by location
    if (location) {
      paramCount++;
      whereClause += ` AND h.location ILIKE $${paramCount}`;
      values.push(`%${location}%`);
    }

    // Filter by status
    if (status && status !== 'all') {
      paramCount++;
      whereClause += ` AND h.status = $${paramCount}`;
      values.push(status);
    }

    // Filter by cage type
    if (cage_type) {
      paramCount++;
      whereClause += ` AND h.cage_type = $${paramCount}`;
      values.push(cage_type);
    }

    // Filter by availability
    if (availability !== 'all') {
      switch (availability) {
        case 'available':
          whereClause += ` AND h.current_occupancy < h.capacity`;
          break;
        case 'occupied':
          whereClause += ` AND h.current_occupancy > 0`;
          break;
        case 'full':
          whereClause += ` AND h.current_occupancy >= h.capacity`;
          break;
      }
    }

    // Validate sort column
    const allowedSortColumns = ['housing_number', 'location', 'cage_type', 'capacity', 'current_occupancy', 'status', 'created_at'];
    const sortColumn = allowedSortColumns.includes(sort) ? `h.${sort}` : 'h.housing_number';
    const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const query = `
      SELECT 
        h.*,
        (h.capacity - h.current_occupancy) as available_spaces,
        CASE 
          WHEN h.current_occupancy = 0 THEN 'empty'
          WHEN h.current_occupancy >= h.capacity THEN 'full'
          ELSE 'partial'
        END as occupancy_status,
        COUNT(a.id) as total_animals_assigned
      FROM housing h
      LEFT JOIN animals a ON h.id = a.housing_id AND a.status = 'active'
      ${whereClause}
      GROUP BY h.id
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    values.push(parseInt(limit), offset);

    const countQuery = `
      SELECT COUNT(DISTINCT h.id) as total
      FROM housing h
      ${whereClause}
    `;

    const [housingResult, countResult] = await Promise.all([
      db.query(query, values),
      db.query(countQuery, values.slice(0, paramCount))
    ]);

    res.json({
      housing: housingResult.rows,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        total_pages: Math.ceil(countResult.rows[0].total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error loading housing:', err);
    res.status(500).json(createErrorResponse('Failed to load housing'));
  }
});

// @route   POST /api/housing
// @desc    Create new housing unit
// @access  Private (admin, facility_manager, technician)
router.post('/', [
  auth,
  roleCheck(['admin', 'facility_manager', 'technician']),
  [
    check('location', 'Location is required').notEmpty(),
    check('capacity', 'Capacity must be a positive integer').isInt({ min: 1 }),
    check('status', 'Invalid status').optional().isIn(['active', 'maintenance', 'quarantine']),
    check('environmental_conditions', 'Environmental conditions must be valid JSON').optional().isJSON()
  ]
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', errors.array()));
    }

    const {
      location,
      cage_type,
      capacity,
      environmental_conditions,
      status = 'active',
      notes
    } = req.body;

    const query = `
      INSERT INTO housing (
        location, cage_type, capacity, current_occupancy, 
        environmental_conditions, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const parsedConditions = environmental_conditions ? JSON.parse(environmental_conditions) : null;
    const values = [location, cage_type, capacity, 0, parsedConditions, status, notes];
    const result = await db.query(query, values);

    logger.info(`Housing unit created: ${result.rows[0].housing_number} by user ${req.user.id}`);

    res.status(201).json({
      message: 'Housing unit created successfully',
      housing: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating housing:', err);
    res.status(500).json(createErrorResponse('Failed to create housing unit'));
  }
});

// @route   GET /api/housing/stats/summary
// @desc    Get housing statistics summary
// @access  Private (all roles)
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const queries = {
      total: 'SELECT COUNT(*) as count FROM housing',
      active: 'SELECT COUNT(*) as count FROM housing WHERE status = \'active\'',
      occupancy: `
        SELECT 
          COUNT(*) as total_units,
          SUM(capacity) as total_capacity,
          SUM(current_occupancy) as total_occupancy,
          COUNT(CASE WHEN current_occupancy = 0 THEN 1 END) as empty_units,
          COUNT(CASE WHEN current_occupancy >= capacity THEN 1 END) as full_units
        FROM housing 
        WHERE status = 'active'
      `,
      by_location: `
        SELECT 
          location,
          COUNT(*) as units,
          SUM(capacity) as total_capacity,
          SUM(current_occupancy) as total_occupancy
        FROM housing
        WHERE status = 'active'
        GROUP BY location
        ORDER BY total_occupancy DESC
      `,
      by_cage_type: `
        SELECT 
          cage_type,
          COUNT(*) as units,
          SUM(current_occupancy) as animals
        FROM housing
        WHERE status = 'active'
        GROUP BY cage_type
        ORDER BY animals DESC
      `
    };

    const [totalResult, activeResult, occupancyResult, locationResult, cageTypeResult] = await Promise.all([
      db.query(queries.total),
      db.query(queries.active),
      db.query(queries.occupancy),
      db.query(queries.by_location),
      db.query(queries.by_cage_type)
    ]);

    const occupancy = occupancyResult.rows[0];

    res.json({
      total_housing_units: parseInt(totalResult.rows[0].count),
      active_housing_units: parseInt(activeResult.rows[0].count),
      total_capacity: parseInt(occupancy.total_capacity || 0),
      total_occupancy: parseInt(occupancy.total_occupancy || 0),
      utilization_rate: occupancy.total_capacity > 0 ? 
        ((occupancy.total_occupancy / occupancy.total_capacity) * 100).toFixed(1) : '0.0',
      empty_units: parseInt(occupancy.empty_units || 0),
      full_units: parseInt(occupancy.full_units || 0),
      by_location: locationResult.rows,
      by_cage_type: cageTypeResult.rows
    });
  } catch (err) {
    console.error('Error loading housing stats:', err);
    res.status(500).json(createErrorResponse('Failed to load housing statistics'));
  }
});

module.exports = router;