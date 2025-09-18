const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { body, validationResult, query } = require('express-validator');
const auth = require('../middleware/auth');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ================================================================================
// MEASUREMENT DATA ROUTES
// ================================================================================

// Get measurements for an animal
router.get('/animal/:animalId', auth, async (req, res) => {
  try {
    const { animalId } = req.params;
    const {
      measurement_type,
      start_date,
      end_date,
      limit = 100,
      offset = 0
    } = req.query;

    let query = `
      SELECT
        m.*,
        mt.category,
        mt.description as type_description,
        u.first_name || ' ' || u.last_name as measured_by_name,
        es.study_name
      FROM animal_measurements m
      LEFT JOIN measurement_types mt ON m.measurement_type = mt.name
      LEFT JOIN users u ON m.measured_by = u.id
      LEFT JOIN experimental_studies es ON m.study_id = es.id
      WHERE m.animal_id = $1
    `;

    const params = [animalId];
    let paramIndex = 2;

    if (measurement_type) {
      query += ` AND m.measurement_type = $${paramIndex}`;
      params.push(measurement_type);
      paramIndex++;
    }

    if (start_date) {
      query += ` AND m.measurement_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND m.measurement_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    query += ` ORDER BY m.measurement_date DESC, m.measurement_type`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*)
      FROM animal_measurements m
      WHERE animal_id = $1
    `;
    const countParams = [animalId];
    let countParamIndex = 2;

    if (measurement_type) {
      countQuery += ` AND measurement_type = $${countParamIndex}`;
      countParams.push(measurement_type);
      countParamIndex++;
    }

    if (start_date) {
      countQuery += ` AND measurement_date >= $${countParamIndex}`;
      countParams.push(start_date);
      countParamIndex++;
    }

    if (end_date) {
      countQuery += ` AND measurement_date <= $${countParamIndex}`;
      countParams.push(end_date);
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      measurements: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Error fetching measurements:', error);
    res.status(500).json({ message: 'Failed to fetch measurements' });
  }
});

// Add a new measurement
router.post('/', auth, [
  body('animal_id').isUUID().withMessage('Valid animal ID is required'),
  body('measurement_type').notEmpty().withMessage('Measurement type is required'),
  body('value').optional().isNumeric().withMessage('Value must be numeric'),
  body('unit').optional().isString(),
  body('measurement_date').optional().isISO8601().withMessage('Invalid date format'),
  body('notes').optional().isString(),
  body('study_id').optional().isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      animal_id,
      measurement_type,
      value,
      unit,
      measurement_date,
      notes,
      study_id
    } = req.body;

    const query = `
      INSERT INTO animal_measurements
      (animal_id, measurement_type, value, unit, measurement_date, notes, measured_by, study_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await pool.query(query, [
      animal_id,
      measurement_type,
      value || null,
      unit || null,
      measurement_date || new Date(),
      notes || null,
      req.user.id,
      study_id || null
    ]);

    res.status(201).json({
      message: 'Measurement recorded successfully',
      measurement: result.rows[0]
    });

  } catch (error) {
    console.error('Error adding measurement:', error);

    if (error.constraint === 'unique_measurement_per_animal_type_date') {
      return res.status(409).json({
        message: 'A measurement of this type already exists for this animal on this date'
      });
    }

    res.status(500).json({ message: 'Failed to record measurement' });
  }
});

// Bulk add measurements
router.post('/bulk', auth, [
  body('measurements').isArray().withMessage('Measurements must be an array'),
  body('measurements.*.animal_id').isUUID().withMessage('Valid animal ID is required'),
  body('measurements.*.measurement_type').notEmpty().withMessage('Measurement type is required'),
  body('measurements.*.value').optional().isNumeric(),
  body('measurements.*.measurement_date').optional().isISO8601()
], async (req, res) => {
  const client = await pool.connect();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await client.query('BEGIN');

    const { measurements } = req.body;
    const results = [];

    for (const measurement of measurements) {
      const {
        animal_id,
        measurement_type,
        value,
        unit,
        measurement_date,
        notes,
        study_id
      } = measurement;

      const query = `
        INSERT INTO animal_measurements
        (animal_id, measurement_type, value, unit, measurement_date, notes, measured_by, study_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const result = await client.query(query, [
        animal_id,
        measurement_type,
        value || null,
        unit || null,
        measurement_date || new Date(),
        notes || null,
        req.user.id,
        study_id || null
      ]);

      results.push(result.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: `Successfully recorded ${results.length} measurements`,
      measurements: results
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error bulk adding measurements:', error);
    res.status(500).json({ message: 'Failed to record measurements' });
  } finally {
    client.release();
  }
});

// Update a measurement
router.put('/:id', auth, [
  body('value').optional().isNumeric(),
  body('unit').optional().isString(),
  body('notes').optional().isString()
], async (req, res) => {
  try {
    const { id } = req.params;
    const { value, unit, notes } = req.body;

    const query = `
      UPDATE animal_measurements
      SET value = COALESCE($1, value),
          unit = COALESCE($2, unit),
          notes = COALESCE($3, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND measured_by = $5
      RETURNING *
    `;

    const result = await pool.query(query, [
      value,
      unit,
      notes,
      id,
      req.user.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Measurement not found or not authorized to edit' });
    }

    res.json({
      message: 'Measurement updated successfully',
      measurement: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating measurement:', error);
    res.status(500).json({ message: 'Failed to update measurement' });
  }
});

// Delete a measurement
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      DELETE FROM animal_measurements
      WHERE id = $1 AND measured_by = $2
      RETURNING *
    `;

    const result = await pool.query(query, [id, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Measurement not found or not authorized to delete' });
    }

    res.json({ message: 'Measurement deleted successfully' });

  } catch (error) {
    console.error('Error deleting measurement:', error);
    res.status(500).json({ message: 'Failed to delete measurement' });
  }
});

// ================================================================================
// MEASUREMENT TYPES ROUTES
// ================================================================================

// Get all measurement types
router.get('/types', auth, async (req, res) => {
  try {
    const { category } = req.query;

    let query = `
      SELECT * FROM measurement_types
      WHERE is_active = true
    `;

    const params = [];
    if (category) {
      query += ` AND category = $1`;
      params.push(category);
    }

    query += ` ORDER BY sort_order, name`;

    const result = await pool.query(query, params);

    // Group by category
    const grouped = result.rows.reduce((acc, type) => {
      if (!acc[type.category]) {
        acc[type.category] = [];
      }
      acc[type.category].push(type);
      return acc;
    }, {});

    res.json({
      measurement_types: result.rows,
      by_category: grouped
    });

  } catch (error) {
    console.error('Error fetching measurement types:', error);
    res.status(500).json({ message: 'Failed to fetch measurement types' });
  }
});

// ================================================================================
// MEASUREMENT SCHEDULES ROUTES
// ================================================================================

// Get measurement schedules for an animal
router.get('/schedules/animal/:animalId', auth, async (req, res) => {
  try {
    const { animalId } = req.params;
    const { active_only = 'true' } = req.query;

    let query = `
      SELECT
        ms.*,
        mt.category,
        mt.default_unit,
        mt.description as type_description,
        u.first_name || ' ' || u.last_name as created_by_name,
        es.study_name
      FROM measurement_schedules ms
      LEFT JOIN measurement_types mt ON ms.measurement_type = mt.name
      LEFT JOIN users u ON ms.created_by = u.id
      LEFT JOIN experimental_studies es ON ms.study_id = es.id
      WHERE ms.animal_id = $1
    `;

    const params = [animalId];

    if (active_only === 'true') {
      query += ` AND ms.active = true`;
    }

    query += ` ORDER BY ms.next_due_date, ms.measurement_type`;

    const result = await pool.query(query, params);

    res.json({ schedules: result.rows });

  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ message: 'Failed to fetch measurement schedules' });
  }
});

// Create a measurement schedule
router.post('/schedules', auth, [
  body('animal_id').isUUID().withMessage('Valid animal ID is required'),
  body('measurement_type').notEmpty().withMessage('Measurement type is required'),
  body('frequency_days').isInt({ min: 1 }).withMessage('Frequency must be at least 1 day'),
  body('start_date').optional().isISO8601(),
  body('end_date').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      animal_id,
      measurement_type,
      frequency_days,
      start_date,
      end_date,
      reminder_enabled,
      study_id,
      notes
    } = req.body;

    const startDate = start_date || new Date().toISOString().split('T')[0];
    const nextDueDate = startDate;

    const query = `
      INSERT INTO measurement_schedules
      (animal_id, measurement_type, frequency_days, start_date, end_date,
       next_due_date, reminder_enabled, created_by, study_id, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const result = await pool.query(query, [
      animal_id,
      measurement_type,
      frequency_days,
      startDate,
      end_date || null,
      nextDueDate,
      reminder_enabled !== false,
      req.user.id,
      study_id || null,
      notes || null
    ]);

    res.status(201).json({
      message: 'Measurement schedule created successfully',
      schedule: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ message: 'Failed to create measurement schedule' });
  }
});

// Get overdue measurements across all animals
router.get('/schedules/overdue', auth, async (req, res) => {
  try {
    const query = `
      SELECT
        ms.*,
        a.animal_number,
        a.species,
        a.strain,
        mt.category,
        mt.default_unit,
        es.study_name,
        (CURRENT_DATE - ms.next_due_date) as days_overdue
      FROM measurement_schedules ms
      JOIN animals a ON ms.animal_id = a.id
      LEFT JOIN measurement_types mt ON ms.measurement_type = mt.name
      LEFT JOIN experimental_studies es ON ms.study_id = es.id
      WHERE ms.active = true
        AND ms.next_due_date < CURRENT_DATE
        AND (ms.end_date IS NULL OR ms.end_date >= CURRENT_DATE)
      ORDER BY days_overdue DESC, a.animal_number
    `;

    const result = await pool.query(query);

    res.json({ overdue_measurements: result.rows });

  } catch (error) {
    console.error('Error fetching overdue measurements:', error);
    res.status(500).json({ message: 'Failed to fetch overdue measurements' });
  }
});

module.exports = router;