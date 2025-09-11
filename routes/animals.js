const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { check, validationResult } = require('express-validator');
const db = require('../db');
const logger = require('../utils/logger');
const { buildSearchClause } = require('../utils/searchUtils');
const { createErrorResponse } = require('../utils/errorHandling');

// @route   GET /api/animals
// @desc    Get all animals with search, filtering, and pagination
// @access  Private (all roles)
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search = '', 
      species, 
      status = 'active',
      housing_location,
      sort = 'animal_number',
      order = 'ASC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 0;

    // Search functionality
    if (search && search.trim()) {
      const searchCondition = buildSearchClause(search.trim(), [
        'animal_number', 'species', 'strain', 'genotype', 'source', 'notes'
      ]);
      whereClause += ` AND (${searchCondition})`;
      values.push(`%${search.trim()}%`);
      paramCount++;
    }

    // Filter by species
    if (species) {
      paramCount++;
      whereClause += ` AND a.species = $${paramCount}`;
      values.push(species);
    }

    // Filter by status
    if (status && status !== 'all') {
      paramCount++;
      whereClause += ` AND a.status = $${paramCount}`;
      values.push(status);
    }

    // Filter by housing location
    if (housing_location) {
      paramCount++;
      whereClause += ` AND h.location ILIKE $${paramCount}`;
      values.push(`%${housing_location}%`);
    }

    // Validate sort column
    const allowedSortColumns = ['animal_number', 'species', 'strain', 'status', 'birth_date', 'created_at'];
    const sortColumn = allowedSortColumns.includes(sort) ? `a.${sort}` : 'a.animal_number';
    const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const query = `
      SELECT 
        a.*,
        h.housing_number,
        h.location as housing_location,
        h.cage_type,
        COALESCE(specimen_count.count, 0) as specimen_count
      FROM animals a
      LEFT JOIN housing h ON a.housing_id = h.id
      LEFT JOIN (
        SELECT animal_id, COUNT(*) as count
        FROM specimens
        WHERE animal_id IS NOT NULL
        GROUP BY animal_id
      ) specimen_count ON a.id = specimen_count.animal_id
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    values.push(parseInt(limit), offset);

    const countQuery = `
      SELECT COUNT(DISTINCT a.id) as total
      FROM animals a
      LEFT JOIN housing h ON a.housing_id = h.id
      ${whereClause}
    `;

    const [animalsResult, countResult] = await Promise.all([
      db.query(query, values),
      db.query(countQuery, values.slice(0, paramCount))
    ]);

    res.json({
      animals: animalsResult.rows,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        total_pages: Math.ceil(countResult.rows[0].total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error loading animals:', err);
    res.status(500).json(createErrorResponse('Failed to load animals'));
  }
});

// @route   GET /api/animals/:id
// @desc    Get single animal by ID with related data
// @access  Private (all roles)
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const animalQuery = `
      SELECT 
        a.*,
        h.housing_number,
        h.location as housing_location,
        h.cage_type,
        h.capacity,
        h.current_occupancy,
        h.environmental_conditions
      FROM animals a
      LEFT JOIN housing h ON a.housing_id = h.id
      WHERE a.id = $1
    `;

    const specimenQuery = `
      SELECT 
        s.id,
        s.specimen_number,
        s.collection_timepoint,
        s.anatomical_site,
        s.date_collected,
        s.activity_status,
        p.project_number,
        p.disease
      FROM specimens s
      LEFT JOIN projects p ON s.project_id = p.id
      WHERE s.animal_id = $1
      ORDER BY s.date_collected DESC, s.specimen_number DESC
    `;

    const [animalResult, specimenResult] = await Promise.all([
      db.query(animalQuery, [id]),
      db.query(specimenQuery, [id])
    ]);

    if (animalResult.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Animal not found'));
    }

    res.json({
      animal: animalResult.rows[0],
      specimens: specimenResult.rows
    });
  } catch (err) {
    console.error('Error loading animal:', err);
    res.status(500).json(createErrorResponse('Failed to load animal'));
  }
});

// @route   POST /api/animals
// @desc    Create new animal
// @access  Private (admin, lab_manager, lab_technician)
router.post('/', [
  auth,
  roleCheck(['admin', 'lab_manager', 'lab_technician']),
  [
    check('species', 'Species is required').notEmpty(),
    check('sex', 'Sex must be M, F, or Unknown').optional().isIn(['M', 'F', 'Unknown']),
    check('status', 'Invalid status').optional().isIn(['active', 'deceased', 'transferred', 'retired']),
    check('birth_date', 'Birth date must be valid').optional().isISO8601(),
    check('death_date', 'Death date must be valid').optional().isISO8601()
  ]
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', errors.array()));
    }

    const {
      species,
      strain,
      sex = 'Unknown',
      birth_date,
      death_date,
      source,
      genotype,
      housing_id,
      status = 'active',
      notes
    } = req.body;

    // Validate housing exists if provided
    if (housing_id) {
      const housingCheck = await db.query('SELECT id FROM housing WHERE id = $1', [housing_id]);
      if (housingCheck.rows.length === 0) {
        return res.status(400).json(createErrorResponse('Housing not found'));
      }
    }

    const query = `
      INSERT INTO animals (
        species, strain, sex, birth_date, death_date, source, 
        genotype, housing_id, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [species, strain, sex, birth_date, death_date, source, genotype, housing_id, status, notes];
    const result = await db.query(query, values);

    // Update housing occupancy if assigned
    if (housing_id && status === 'active') {
      await db.query(`
        UPDATE housing 
        SET current_occupancy = current_occupancy + 1 
        WHERE id = $1
      `, [housing_id]);
    }

    logger.info(`Animal created: ${result.rows[0].animal_number} by user ${req.user.id}`);

    res.status(201).json({
      message: 'Animal created successfully',
      animal: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating animal:', err);
    res.status(500).json(createErrorResponse('Failed to create animal'));
  }
});

// @route   GET /api/animals/stats/summary
// @desc    Get animal statistics summary
// @access  Private (all roles)
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const queries = {
      total: 'SELECT COUNT(*) as count FROM animals',
      active: 'SELECT COUNT(*) as count FROM animals WHERE status = \'active\'',
      by_species: `
        SELECT species, COUNT(*) as count 
        FROM animals 
        WHERE status = 'active'
        GROUP BY species 
        ORDER BY count DESC
      `,
      by_housing: `
        SELECT h.location, COUNT(a.id) as count
        FROM housing h
        LEFT JOIN animals a ON h.id = a.housing_id AND a.status = 'active'
        GROUP BY h.location
        ORDER BY count DESC
      `,
      recent_additions: `
        SELECT COUNT(*) as count
        FROM animals
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      `
    };

    const [totalResult, activeResult, speciesResult, housingResult, recentResult] = await Promise.all([
      db.query(queries.total),
      db.query(queries.active),
      db.query(queries.by_species),
      db.query(queries.by_housing),
      db.query(queries.recent_additions)
    ]);

    res.json({
      total_animals: parseInt(totalResult.rows[0].count),
      active_animals: parseInt(activeResult.rows[0].count),
      by_species: speciesResult.rows,
      by_housing: housingResult.rows,
      recent_additions: parseInt(recentResult.rows[0].count)
    });
  } catch (err) {
    console.error('Error loading stats:', err);
    res.status(500).json(createErrorResponse('Failed to load statistics'));
  }
});

// @route   GET /api/animals/:id/weights
// @desc    Get weight history for an animal
// @access  Private (all roles)
router.get('/:id/weights', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        w.*,
        EXTRACT(DAYS FROM (CURRENT_DATE - w.measurement_date)) as days_ago
      FROM animal_weights w
      WHERE w.animal_id = $1
      ORDER BY w.measurement_date DESC
      LIMIT 50
    `;
    
    const result = await db.query(query, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error loading animal weights:', err);
    res.status(500).json(createErrorResponse('Failed to load weight history'));
  }
});

// @route   POST /api/animals/:id/weights
// @desc    Add weight record for an animal
// @access  Private (admin, lab_manager, lab_technician)
router.post('/:id/weights', [
  auth,
  roleCheck(['admin', 'lab_manager', 'lab_technician']),
  [
    check('weight_grams', 'Weight is required').notEmpty().isNumeric(),
    check('body_condition_score', 'Body condition score must be between 1 and 5').optional().isInt({ min: 1, max: 5 }),
    check('measurement_date', 'Invalid measurement date').optional().isDate()
  ]
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', errors.array()));
    }

    const { id } = req.params;
    const { weight_grams, body_condition_score, measurement_date, notes } = req.body;

    const query = `
      INSERT INTO animal_weights (
        animal_id, weight_grams, body_condition_score, 
        measurement_date, measured_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      id, 
      weight_grams, 
      body_condition_score, 
      measurement_date || new Date().toISOString().split('T')[0],
      req.user.username,
      notes
    ];

    const result = await db.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding weight record:', err);
    res.status(500).json(createErrorResponse('Failed to add weight record'));
  }
});

// @route   GET /api/animals/:id/observations
// @desc    Get observations for an animal
// @access  Private (all roles)
router.get('/:id/observations', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;
    
    const query = `
      SELECT 
        o.*,
        EXTRACT(DAYS FROM (CURRENT_DATE - o.observation_date)) as days_ago
      FROM animal_observations o
      WHERE o.animal_id = $1
      ORDER BY o.observation_date DESC, o.created_at DESC
      LIMIT $2
    `;
    
    const result = await db.query(query, [id, limit]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error loading animal observations:', err);
    res.status(500).json(createErrorResponse('Failed to load observations'));
  }
});

// @route   POST /api/animals/:id/observations
// @desc    Add observation for an animal
// @access  Private (admin, lab_manager, lab_technician)
router.post('/:id/observations', [
  auth,
  roleCheck(['admin', 'lab_manager', 'lab_technician']),
  [
    check('observation_type', 'Observation type is required').notEmpty(),
    check('finding', 'Finding is required').notEmpty(),
    check('observed_by', 'Observer name is required').notEmpty(),
    check('observation_date', 'Invalid observation date').optional().isDate()
  ]
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', errors.array()));
    }

    const { id } = req.params;
    const { 
      observation_type, finding, severity, description, 
      action_taken, follow_up_required, observation_date 
    } = req.body;

    const query = `
      INSERT INTO animal_observations (
        animal_id, observation_type, finding, severity, description,
        action_taken, follow_up_required, observation_date, observed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      id, observation_type, finding, severity, description,
      action_taken, follow_up_required || false,
      observation_date || new Date().toISOString().split('T')[0],
      req.user.username
    ];

    const result = await db.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding observation:', err);
    res.status(500).json(createErrorResponse('Failed to add observation'));
  }
});

// @route   GET /api/animals/:id/breeding
// @desc    Get breeding information for an animal
// @access  Private (all roles)
router.get('/:id/breeding', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const queries = {
      offspring: `
        SELECT a.*, h.location as housing_location
        FROM animals a
        LEFT JOIN housing h ON a.housing_id = h.id
        WHERE a.dam_id = $1 OR a.sire_id = $1
        ORDER BY a.birth_date DESC
      `,
      parents: `
        SELECT 
          dam.animal_number as dam_number, dam.strain as dam_strain,
          sire.animal_number as sire_number, sire.strain as sire_strain
        FROM animals a
        LEFT JOIN animals dam ON a.dam_id = dam.id
        LEFT JOIN animals sire ON a.sire_id = sire.id
        WHERE a.id = $1
      `
    };

    const [offspringResult, parentsResult] = await Promise.all([
      db.query(queries.offspring, [id]),
      db.query(queries.parents, [id])
    ]);

    res.json({
      offspring: offspringResult.rows,
      parents: parentsResult.rows[0] || {}
    });
  } catch (err) {
    console.error('Error loading breeding info:', err);
    res.status(500).json(createErrorResponse('Failed to load breeding information'));
  }
});

// @route   GET /api/animals/species/suggestions
// @desc    Get species suggestions based on existing animals
// @access  Private (all roles)
router.get('/species/suggestions', auth, async (req, res) => {
  try {
    const { search = '' } = req.query;
    
    let query = `
      SELECT species, COUNT(*) as usage_count
      FROM animals 
      WHERE species IS NOT NULL AND species != ''
    `;
    
    const values = [];
    
    if (search && search.trim()) {
      query += ` AND species ILIKE $1`;
      values.push(`%${search.trim()}%`);
    }
    
    query += `
      GROUP BY species 
      ORDER BY usage_count DESC, species ASC
      LIMIT 20
    `;
    
    const result = await db.query(query, values);
    res.json(result.rows.map(row => ({
      species: row.species,
      count: parseInt(row.usage_count)
    })));
  } catch (err) {
    console.error('Error loading species suggestions:', err);
    res.status(500).json(createErrorResponse('Failed to load species suggestions'));
  }
});

module.exports = router;