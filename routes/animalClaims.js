const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { check, validationResult } = require('express-validator');
const db = require('../db');
const logger = require('../utils/logger');
const { buildSearchClause } = require('../utils/searchUtils');
const { createErrorResponse } = require('../utils/errorHandling');

// @route   GET /api/animal-claims/available
// @desc    Get available animals for claiming (optimized for claiming interface)
// @access  Private (all roles)
router.get('/available', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 100, 
      search = '', 
      species,
      strain,
      sex,
      age_range,
      housing_location,
      sort = 'species,strain,animal_number',
      order = 'ASC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = "WHERE a.availability_status = 'available' AND a.status = 'active'";
    const values = [];
    let paramCount = 0;

    // Search functionality
    if (search && search.trim()) {
      const searchCondition = buildSearchClause(search.trim(), [
        'a.animal_number::text', 'a.strain', 'a.genotype', 'a.identification_number', 'a.notes'
      ]);
      whereClause += ` AND (${searchCondition})`;
      values.push(`%${search.trim()}%`);
      paramCount++;
    }

    // Filter by species
    if (species && species !== 'all') {
      paramCount++;
      whereClause += ` AND a.species = $${paramCount}`;
      values.push(species);
    }

    // Filter by strain
    if (strain && strain !== 'all') {
      paramCount++;
      whereClause += ` AND a.strain ILIKE $${paramCount}`;
      values.push(`%${strain}%`);
    }

    // Filter by sex
    if (sex && sex !== 'all') {
      paramCount++;
      whereClause += ` AND a.sex = $${paramCount}`;
      values.push(sex);
    }

    // Filter by age range (simplified for MVP)
    if (age_range && age_range !== 'all') {
      switch (age_range) {
        case 'young':
          whereClause += ` AND a.birth_date > CURRENT_DATE - INTERVAL '3 months'`;
          break;
        case 'adult':
          whereClause += ` AND a.birth_date BETWEEN CURRENT_DATE - INTERVAL '12 months' AND CURRENT_DATE - INTERVAL '3 months'`;
          break;
        case 'mature':
          whereClause += ` AND a.birth_date < CURRENT_DATE - INTERVAL '12 months'`;
          break;
      }
    }

    // Filter by housing location
    if (housing_location && housing_location !== 'all') {
      paramCount++;
      whereClause += ` AND h.location ILIKE $${paramCount}`;
      values.push(`%${housing_location}%`);
    }

    // Build sort clause
    const allowedSortColumns = ['species', 'strain', 'animal_number', 'birth_date', 'arrival_date'];
    const sortColumns = sort.split(',').filter(col => allowedSortColumns.includes(col.trim()));
    const sortClause = sortColumns.length > 0 ? 
      `ORDER BY ${sortColumns.map(col => `a.${col.trim()}`).join(', ')} ${order}` :
      'ORDER BY a.species, a.strain, a.animal_number';

    const query = `
      SELECT 
        a.*,
        h.location as housing_location,
        h.housing_number,
        -- Calculate age in days for sorting/filtering
        CASE
          WHEN a.birth_date IS NOT NULL
          THEN (CURRENT_DATE - a.birth_date)::integer
          ELSE NULL
        END as age_days,
        -- Format for display
        CASE
          WHEN a.birth_date IS NOT NULL THEN
            CASE
              WHEN (CURRENT_DATE - a.birth_date) < 30
              THEN (CURRENT_DATE - a.birth_date)::text || ' days'
              WHEN (CURRENT_DATE - a.birth_date) < 365
              THEN ((CURRENT_DATE - a.birth_date) / 30)::integer::text || ' months'
              ELSE ((CURRENT_DATE - a.birth_date) / 365)::integer::text || ' years'
            END
          ELSE 'Unknown'
        END as age_display
      FROM animals a
      LEFT JOIN housing h ON a.housing_id = h.id
      ${whereClause}
      ${sortClause}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    values.push(parseInt(limit), offset);

    // Count query for pagination
    const countQuery = `
      SELECT COUNT(*) as total
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
    console.error('Error loading available animals:', err);
    res.status(500).json(createErrorResponse('Failed to load available animals'));
  }
});

// @route   POST /api/animal-claims/claim
// @desc    Claim an animal (simplified for MVP - direct claim)
// @access  Private (researchers and above)
router.post('/claim', [
  auth,
  [
    check('animal_id', 'Animal ID is required').isUUID(),
    check('justification', 'Justification is required').notEmpty()
  ]
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', errors.array()));
    }

    const { animal_id, justification, study_id, approved_until } = req.body;
    const userId = req.user.id;

    // Check if animal exists and is available
    const animalCheck = await db.query(
      'SELECT id, animal_number, availability_status FROM animals WHERE id = $1',
      [animal_id]
    );

    if (animalCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Animal not found'));
    }

    const animal = animalCheck.rows[0];
    if (animal.availability_status !== 'available') {
      return res.status(400).json(createErrorResponse('Animal is no longer available for claiming'));
    }

    // Begin transaction
    await db.query('BEGIN');

    try {
      // For MVP: Direct claim (skip approval workflow)
      // Update animal availability status
      await db.query(
        'UPDATE animals SET availability_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['claimed', animal_id]
      );

      // Create claim record
      const claimResult = await db.query(`
        INSERT INTO animal_claims (
          animal_id, requested_by, study_id, status, justification, 
          reviewed_by, reviewed_at, review_notes, approved_until
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, $8)
        RETURNING id, requested_at
      `, [
        animal_id, userId, study_id, 'approved', justification,
        userId, 'Auto-approved (MVP mode)', approved_until
      ]);

      await db.query('COMMIT');

      logger.info('Animal claimed successfully', {
        animal_id,
        animal_number: animal.animal_number,
        claimed_by: userId,
        claim_id: claimResult.rows[0].id
      });

      res.json({
        success: true,
        message: `Animal #${animal.animal_number} claimed successfully`,
        claim_id: claimResult.rows[0].id,
        claimed_at: claimResult.rows[0].requested_at
      });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (err) {
    console.error('Error claiming animal:', err);
    res.status(500).json(createErrorResponse('Failed to claim animal'));
  }
});

// @route   POST /api/animal-claims/bulk-claim
// @desc    Claim multiple animals at once
// @access  Private (researchers and above)
router.post('/bulk-claim', [
  auth,
  [
    check('animal_ids', 'Animal IDs array is required').isArray({ min: 1 }),
    check('animal_ids.*', 'Each animal ID must be a valid UUID').isUUID(),
    check('justification', 'Justification is required').notEmpty()
  ]
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(createErrorResponse('Validation failed', errors.array()));
    }

    const { animal_ids, justification, study_id, approved_until } = req.body;
    const userId = req.user.id;

    // Limit bulk claims to prevent abuse
    if (animal_ids.length > 50) {
      return res.status(400).json(createErrorResponse('Cannot claim more than 50 animals at once'));
    }

    // Check if all animals exist and are available
    const animalCheck = await db.query(
      'SELECT id, animal_number, availability_status FROM animals WHERE id = ANY($1)',
      [animal_ids]
    );

    if (animalCheck.rows.length !== animal_ids.length) {
      return res.status(404).json(createErrorResponse('One or more animals not found'));
    }

    const unavailableAnimals = animalCheck.rows.filter(a => a.availability_status !== 'available');
    if (unavailableAnimals.length > 0) {
      return res.status(400).json(createErrorResponse(
        `Animals no longer available: ${unavailableAnimals.map(a => `#${a.animal_number}`).join(', ')}`
      ));
    }

    // Begin transaction
    await db.query('BEGIN');

    try {
      // Update all animals' availability status
      await db.query(
        'UPDATE animals SET availability_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2)',
        ['claimed', animal_ids]
      );

      // Create claim records for all animals using individual inserts
      const claimResults = [];
      for (const animal_id of animal_ids) {
        const claimResult = await db.query(`
          INSERT INTO animal_claims (
            animal_id, requested_by, study_id, status, justification,
            reviewed_by, reviewed_at, review_notes, approved_until
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, $8)
          RETURNING id, requested_at
        `, [
          animal_id, userId, study_id, 'approved', justification,
          userId, 'Auto-approved (MVP mode)', approved_until
        ]);
        claimResults.push(...claimResult.rows);
      }

      await db.query('COMMIT');

      logger.info('Bulk animal claim successful', {
        animal_count: animal_ids.length,
        animal_numbers: animalCheck.rows.map(a => a.animal_number),
        claimed_by: userId,
        claim_ids: claimResults.map(r => r.id)
      });

      res.json({
        success: true,
        message: `Successfully claimed ${animal_ids.length} animals`,
        claims_created: claimResults.length,
        claimed_animals: animalCheck.rows.map(a => ({
          id: a.id,
          animal_number: a.animal_number
        }))
      });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (err) {
    console.error('Error bulk claiming animals:', err);
    res.status(500).json(createErrorResponse('Failed to claim animals'));
  }
});

// @route   GET /api/animal-claims/my-claims
// @desc    Get current user's animal claims
// @access  Private
router.get('/my-claims', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status = 'all', page = 1, limit = 50 } = req.query;

    let whereClause = 'WHERE ac.requested_by = $1';
    const values = [userId];
    let paramCount = 1;

    if (status !== 'all') {
      paramCount++;
      whereClause += ` AND ac.status = $${paramCount}`;
      values.push(status);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const query = `
      SELECT 
        ac.*,
        a.animal_number,
        a.species,
        a.strain,
        a.sex,
        a.genotype,
        h.location as housing_location,
        u1.username as requested_by_name,
        u2.username as reviewed_by_name
      FROM animal_claims ac
      JOIN animals a ON ac.animal_id = a.id
      LEFT JOIN housing h ON a.housing_id = h.id
      LEFT JOIN users u1 ON ac.requested_by = u1.id
      LEFT JOIN users u2 ON ac.reviewed_by = u2.id
      ${whereClause}
      ORDER BY ac.requested_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    values.push(parseInt(limit), offset);

    const result = await db.query(query, values);

    res.json({
      claims: result.rows,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit)
      }
    });

  } catch (err) {
    console.error('Error loading user claims:', err);
    res.status(500).json(createErrorResponse('Failed to load claims'));
  }
});

// @route   GET /api/animal-claims/stats
// @desc    Get statistics for available animals
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const queries = {
      total_available: `
        SELECT COUNT(*) as count 
        FROM animals 
        WHERE availability_status = 'available' AND status = 'active'
      `,
      by_species: `
        SELECT 
          species,
          COUNT(*) as count
        FROM animals 
        WHERE availability_status = 'available' AND status = 'active'
        GROUP BY species
        ORDER BY count DESC
      `,
      by_strain: `
        SELECT 
          strain,
          COUNT(*) as count
        FROM animals 
        WHERE availability_status = 'available' AND status = 'active' AND strain IS NOT NULL
        GROUP BY strain
        ORDER BY count DESC
        LIMIT 10
      `,
      by_sex: `
        SELECT 
          sex,
          COUNT(*) as count
        FROM animals 
        WHERE availability_status = 'available' AND status = 'active'
        GROUP BY sex
      `,
      recent_arrivals: `
        SELECT COUNT(*) as count
        FROM animals 
        WHERE availability_status = 'available' 
        AND status = 'active'
        AND arrival_date >= CURRENT_DATE - INTERVAL '30 days'
      `,
      by_housing: `
        SELECT 
          h.location,
          COUNT(*) as count
        FROM animals a
        JOIN housing h ON a.housing_id = h.id
        WHERE a.availability_status = 'available' AND a.status = 'active'
        GROUP BY h.location
        ORDER BY count DESC
      `
    };

    const results = {};
    for (const [key, query] of Object.entries(queries)) {
      try {
        const result = await db.query(query);
        results[key] = result.rows;
      } catch (queryError) {
        console.error(`Error in stats query ${key}:`, queryError);
        results[key] = [];
      }
    }

    // Flatten single-value results
    results.available_animals = results.total_available[0]?.count || 0;
    results.recently_arrived = results.recent_arrivals[0]?.count || 0;

    res.json(results);

  } catch (err) {
    console.error('Error loading animal availability stats:', err);
    res.status(500).json(createErrorResponse('Failed to load statistics'));
  }
});

module.exports = router;