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