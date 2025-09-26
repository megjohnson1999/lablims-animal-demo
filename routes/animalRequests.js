const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const notificationRoutes = require('./notifications');

// Initialize database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ================================================================================
// ANIMAL REQUEST ROUTES
// ================================================================================

/**
 * POST /api/animal-requests
 * Create a new animal request
 */
router.post('/', auth, async (req, res) => {
  try {
    const {
      title,
      description,
      justification,
      study_id,
      species,
      strain,
      strain_alternatives,
      sex,
      genotype,
      genotype_alternatives,
      quantity_requested,
      min_age_days,
      max_age_days,
      age_flexibility,
      needed_by_date,
      flexible_date,
      duration_days,
      housing_requirements,
      group_housing,
      priority
    } = req.body;

    const requested_by = req.user.id;

    // Validate required fields
    if (!title || !justification || !species || !strain || !quantity_requested || !needed_by_date) {
      return res.status(400).json({
        message: 'Missing required fields: title, justification, species, strain, quantity_requested, needed_by_date'
      });
    }

    if (quantity_requested <= 0) {
      return res.status(400).json({
        message: 'Quantity requested must be greater than 0'
      });
    }

    // Insert the request
    const insertQuery = `
      INSERT INTO animal_requests (
        requested_by, study_id, title, description, justification,
        species, strain, strain_alternatives, sex, genotype, genotype_alternatives,
        quantity_requested, min_age_days, max_age_days, age_flexibility,
        needed_by_date, flexible_date, duration_days,
        housing_requirements, group_housing, priority
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21
      ) RETURNING *
    `;

    const values = [
      requested_by,
      study_id || null,
      title,
      description,
      justification,
      species,
      strain,
      strain_alternatives || [],
      sex,
      genotype,
      genotype_alternatives || [],
      quantity_requested,
      min_age_days ? parseInt(min_age_days) : null,
      max_age_days ? parseInt(max_age_days) : null,
      age_flexibility || false,
      needed_by_date,
      flexible_date || false,
      duration_days ? parseInt(duration_days) : null,
      housing_requirements,
      group_housing !== false, // Default to true
      priority || 'normal'
    ];

    const result = await db.query(insertQuery, values);
    const newRequest = result.rows[0];

    // Log the creation
    console.log(`Animal request created: #${newRequest.request_number} by user ${requested_by}`);

    res.status(201).json({
      message: 'Animal request created successfully',
      request: newRequest,
      request_number: newRequest.request_number
    });

  } catch (error) {
    console.error('Error creating animal request:', error);
    res.status(500).json({
      message: 'Failed to create animal request',
      error: error.message
    });
  }
});

/**
 * GET /api/animal-requests
 * Get animal requests with filtering and pagination
 */
router.get('/', auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      species,
      requested_by,
      sort = 'created_at',
      order = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build dynamic WHERE clause
    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramCount = 0;

    // Filter by status
    if (status && status !== 'all') {
      paramCount++;
      whereClause += ` AND ar.status = $${paramCount}`;
      values.push(status);
    }

    // Filter by priority
    if (priority && priority !== 'all') {
      paramCount++;
      whereClause += ` AND ar.priority = $${paramCount}`;
      values.push(priority);
    }

    // Filter by species
    if (species && species !== 'all') {
      paramCount++;
      whereClause += ` AND ar.species = $${paramCount}`;
      values.push(species);
    }

    // Filter by requesting user
    if (requested_by) {
      paramCount++;
      whereClause += ` AND ar.requested_by = $${paramCount}`;
      values.push(requested_by);
    }

    // For non-admin users, only show their own requests unless they're facility managers
    if (req.user.role !== 'admin' && req.user.role !== 'facility_manager') {
      paramCount++;
      whereClause += ` AND ar.requested_by = $${paramCount}`;
      values.push(req.user.id);
    }

    // Build sort clause
    const allowedSortColumns = ['created_at', 'needed_by_date', 'quantity_requested', 'status', 'priority'];
    const sortColumn = allowedSortColumns.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const query = `
      SELECT
        ar.*,
        u.first_name || ' ' || u.last_name as requester_name,
        u.email as requester_email,
        es.study_name,
        es.principal_investigator,
        rb.first_name || ' ' || rb.last_name as reviewer_name
      FROM animal_requests ar
      LEFT JOIN users u ON ar.requested_by = u.id
      LEFT JOIN experimental_studies es ON ar.study_id = es.id
      LEFT JOIN users rb ON ar.reviewed_by = rb.id
      ${whereClause}
      ORDER BY ar.${sortColumn} ${sortOrder}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    values.push(parseInt(limit), offset);

    // Count query for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM animal_requests ar
      ${whereClause}
    `;

    const [requestsResult, countResult] = await Promise.all([
      db.query(query, values),
      db.query(countQuery, values.slice(0, paramCount))
    ]);

    res.json({
      requests: requestsResult.rows,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        total_pages: Math.ceil(countResult.rows[0].total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching animal requests:', error);
    res.status(500).json({
      message: 'Failed to fetch animal requests',
      error: error.message
    });
  }
});

/**
 * GET /api/animal-requests/stats
 * Get request statistics (facility managers only)
 */
router.get('/stats', auth, roleCheck(['facility_manager', 'admin']), async (req, res) => {
  try {
    const statsQuery = `
      SELECT
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE status = 'submitted') as pending_review,
        COUNT(*) FILTER (WHERE status = 'waitlisted') as waitlisted,
        COUNT(*) FILTER (WHERE status = 'fulfilled') as fulfilled,
        COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_requests,
        AVG(CASE WHEN fully_fulfilled_at IS NOT NULL
            THEN EXTRACT(days FROM fully_fulfilled_at - created_at)
            ELSE NULL END) as avg_fulfillment_days
      FROM animal_requests
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    `;

    const result = await db.query(statsQuery);
    const stats = result.rows[0];

    // Get top requested species/strains
    const topRequestsQuery = `
      SELECT
        species,
        strain,
        COUNT(*) as request_count,
        SUM(quantity_requested) as total_animals_requested
      FROM animal_requests
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY species, strain
      ORDER BY request_count DESC, total_animals_requested DESC
      LIMIT 10
    `;

    const topRequestsResult = await db.query(topRequestsQuery);

    res.json({
      ...stats,
      top_requests: topRequestsResult.rows
    });

  } catch (error) {
    console.error('Error fetching request stats:', error);
    res.status(500).json({
      message: 'Failed to fetch request statistics',
      error: error.message
    });
  }
});

/**
 * GET /api/animal-requests/:id
 * Get a specific animal request with details
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        ar.*,
        u.first_name || ' ' || u.last_name as requester_name,
        u.email as requester_email,
        es.study_name,
        es.principal_investigator,
        es.iacuc_protocol_number,
        rb.first_name || ' ' || rb.last_name as reviewer_name
      FROM animal_requests ar
      LEFT JOIN users u ON ar.requested_by = u.id
      LEFT JOIN experimental_studies es ON ar.study_id = es.id
      LEFT JOIN users rb ON ar.reviewed_by = rb.id
      WHERE ar.id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Animal request not found' });
    }

    const request = result.rows[0];

    // Check if user can view this request
    if (req.user.role !== 'admin' &&
        req.user.role !== 'facility_manager' &&
        request.requested_by !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get allocations for this request
    const allocationsQuery = `
      SELECT
        ara.*,
        a.animal_number,
        a.species,
        a.strain,
        a.sex,
        a.genotype,
        a.birth_date,
        h.location as housing_location
      FROM animal_request_allocations ara
      LEFT JOIN animals a ON ara.animal_id = a.id
      LEFT JOIN housing h ON a.housing_id = h.id
      WHERE ara.request_id = $1
      ORDER BY ara.allocated_at DESC
    `;

    const allocationsResult = await db.query(allocationsQuery, [id]);

    // Get status history
    const historyQuery = `
      SELECT
        arsh.*,
        u.first_name || ' ' || u.last_name as changed_by_name
      FROM animal_request_status_history arsh
      LEFT JOIN users u ON arsh.changed_by = u.id
      WHERE arsh.request_id = $1
      ORDER BY arsh.changed_at DESC
    `;

    const historyResult = await db.query(historyQuery, [id]);

    res.json({
      request,
      allocations: allocationsResult.rows,
      status_history: historyResult.rows
    });

  } catch (error) {
    console.error('Error fetching animal request:', error);
    res.status(500).json({
      message: 'Failed to fetch animal request',
      error: error.message
    });
  }
});

/**
 * GET /api/animal-requests/check-availability
 * Check availability of animals matching criteria
 */
router.get('/check-availability', auth, async (req, res) => {
  try {
    const {
      species,
      strain,
      sex,
      genotype,
      min_age_days,
      max_age_days,
      quantity_needed
    } = req.query;

    // Build base query for available animals
    let whereClause = `WHERE a.availability_status = 'available' AND a.status = 'active'`;
    const values = [];
    let paramCount = 0;

    if (species) {
      paramCount++;
      whereClause += ` AND a.species = $${paramCount}`;
      values.push(species);
    }

    if (strain) {
      paramCount++;
      whereClause += ` AND a.strain = $${paramCount}`;
      values.push(strain);
    }

    if (sex && sex !== 'any') {
      paramCount++;
      whereClause += ` AND a.sex = $${paramCount}`;
      values.push(sex);
    }

    if (genotype) {
      paramCount++;
      whereClause += ` AND a.genotype ILIKE $${paramCount}`;
      values.push(`%${genotype}%`);
    }

    // Age filtering
    if (min_age_days || max_age_days) {
      whereClause += ` AND a.birth_date IS NOT NULL`;

      if (min_age_days) {
        paramCount++;
        whereClause += ` AND (CURRENT_DATE - a.birth_date) >= $${paramCount}`;
        values.push(parseInt(min_age_days));
      }

      if (max_age_days) {
        paramCount++;
        whereClause += ` AND (CURRENT_DATE - a.birth_date) <= $${paramCount}`;
        values.push(parseInt(max_age_days));
      }
    }

    // Get exact matches
    const exactQuery = `
      SELECT COUNT(*) as available_now
      FROM animals a
      ${whereClause}
    `;

    const exactResult = await db.query(exactQuery, values);
    const availableNow = parseInt(exactResult.rows[0].available_now);

    // Get alternative options if exact matches are insufficient
    let alternatives = [];
    if (availableNow < parseInt(quantity_needed || 1)) {
      // Find similar strains
      if (strain) {
        const alternativesQuery = `
          SELECT
            a.strain,
            COUNT(*) as count,
            'Different strain' as difference
          FROM animals a
          WHERE a.availability_status = 'available'
          AND a.status = 'active'
          AND a.species = $1
          AND a.strain != $2
          ${sex && sex !== 'any' ? `AND a.sex = '${sex}'` : ''}
          GROUP BY a.strain
          ORDER BY count DESC
          LIMIT 5
        `;

        const altResult = await db.query(alternativesQuery, [species, strain]);
        alternatives = altResult.rows;
      }
    }

    res.json({
      available_now: availableNow,
      quantity_requested: parseInt(quantity_needed || 1),
      sufficient: availableNow >= parseInt(quantity_needed || 1),
      alternatives: alternatives.length > 0 ? alternatives : null,
      estimated_additional: availableNow > 0 && availableNow < parseInt(quantity_needed || 1)
        ? Math.max(0, parseInt(quantity_needed || 1) - availableNow)
        : null,
      estimated_days: 14 // Could be calculated based on historical data
    });

  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({
      message: 'Failed to check availability',
      error: error.message
    });
  }
});

/**
 * PUT /api/animal-requests/:id/status
 * Update request status (facility managers only)
 */
router.put('/:id/status', auth, roleCheck(['facility_manager', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, review_notes } = req.body;

    const validStatuses = ['submitted', 'reviewing', 'partially_fulfilled', 'fulfilled', 'waitlisted', 'cancelled', 'denied'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updateQuery = `
      UPDATE animal_requests
      SET
        status = $1,
        reviewed_by = $2,
        reviewed_at = CURRENT_TIMESTAMP,
        review_notes = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;

    const result = await db.query(updateQuery, [status, req.user.id, review_notes, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Animal request not found' });
    }

    // Create notification for status change
    try {
      await notificationRoutes.createRequestStatusNotification(id, status, req.user.id, review_notes);
    } catch (notificationError) {
      console.error('Error creating status notification:', notificationError);
      // Don't fail the main operation if notification fails
    }

    res.json({
      message: 'Request status updated successfully',
      request: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating request status:', error);
    res.status(500).json({
      message: 'Failed to update request status',
      error: error.message
    });
  }
});

/**
 * POST /api/animal-requests/:id/allocate
 * Allocate animals to a request (facility managers only)
 */
router.post('/:id/allocate', auth, roleCheck(['facility_manager', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { animal_ids } = req.body;

    if (!animal_ids || !Array.isArray(animal_ids) || animal_ids.length === 0) {
      return res.status(400).json({ message: 'Animal IDs array is required' });
    }

    // Start transaction
    await db.query('BEGIN');

    try {
      // Verify request exists
      const requestResult = await db.query('SELECT * FROM animal_requests WHERE id = $1', [id]);
      if (requestResult.rows.length === 0) {
        throw new Error('Animal request not found');
      }

      // Verify all animals are available
      const animalCheckQuery = `
        SELECT id, animal_number, availability_status
        FROM animals
        WHERE id = ANY($1)
        AND availability_status = 'available'
        AND status = 'active'
      `;
      const availableAnimals = await db.query(animalCheckQuery, [animal_ids]);

      if (availableAnimals.rows.length !== animal_ids.length) {
        const unavailableIds = animal_ids.filter(id =>
          !availableAnimals.rows.some(animal => animal.id === id)
        );
        throw new Error(`Some animals are not available: ${unavailableIds.join(', ')}`);
      }

      // Update animal availability status
      const updateAnimalsQuery = `
        UPDATE animals
        SET availability_status = 'claimed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($1)
      `;
      await db.query(updateAnimalsQuery, [animal_ids]);

      // Create allocations
      const allocationValues = animal_ids.map((animalId, index) =>
        `($1, $${index + 2}, $${animal_ids.length + 2})`
      ).join(', ');

      const insertAllocationsQuery = `
        INSERT INTO animal_request_allocations (request_id, animal_id, allocated_by)
        VALUES ${allocationValues}
        RETURNING *
      `;

      const allocationParams = [id, ...animal_ids, req.user.id];
      const allocationsResult = await db.query(insertAllocationsQuery, allocationParams);

      // Commit transaction
      await db.query('COMMIT');

      // Create notification for animal assignment
      try {
        await notificationRoutes.createAnimalAssignmentNotification(id, animal_ids, req.user.id);
      } catch (notificationError) {
        console.error('Error creating assignment notification:', notificationError);
        // Don't fail the main operation if notification fails
      }

      res.json({
        message: `Successfully allocated ${animal_ids.length} animals to request`,
        allocations: allocationsResult.rows
      });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error allocating animals:', error);
    res.status(500).json({
      message: 'Failed to allocate animals',
      error: error.message
    });
  }
});

/**
 * POST /api/animal-requests/:id/suggest-animals
 * Get intelligent animal suggestions for a request (facility managers only)
 */
router.post('/:id/suggest-animals', auth, roleCheck(['facility_manager', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;

    // Get request details
    const requestResult = await db.query('SELECT * FROM animal_requests WHERE id = $1', [id]);
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ message: 'Animal request not found' });
    }

    const request = requestResult.rows[0];
    const remainingQuantity = request.quantity_requested - (request.quantity_allocated || 0);

    if (remainingQuantity <= 0) {
      return res.json({
        suggestions: [],
        message: 'Request is already fully fulfilled'
      });
    }

    // Build query for exact matches
    let whereClause = `WHERE a.availability_status = 'available' AND a.status = 'active'`;
    const values = [];
    let paramCount = 0;

    // Primary criteria
    paramCount++;
    whereClause += ` AND a.species = $${paramCount}`;
    values.push(request.species);

    // Strain - check primary and alternatives
    const strainOptions = [request.strain, ...(request.strain_alternatives || [])];
    if (strainOptions.length > 0) {
      paramCount++;
      whereClause += ` AND a.strain = ANY($${paramCount})`;
      values.push(strainOptions);
    }

    // Sex
    if (request.sex && request.sex !== 'any') {
      paramCount++;
      whereClause += ` AND a.sex = $${paramCount}`;
      values.push(request.sex);
    }

    // Genotype - check primary and alternatives
    const genotypeOptions = [request.genotype, ...(request.genotype_alternatives || [])].filter(Boolean);
    if (genotypeOptions.length > 0) {
      paramCount++;
      whereClause += ` AND (a.genotype IS NULL OR a.genotype = ANY($${paramCount}))`;
      values.push(genotypeOptions);
    }

    // Age filtering
    if (request.min_age_days || request.max_age_days) {
      whereClause += ` AND a.birth_date IS NOT NULL`;

      if (request.min_age_days) {
        const minDays = request.age_flexibility ? request.min_age_days * 0.9 : request.min_age_days;
        paramCount++;
        whereClause += ` AND (CURRENT_DATE - a.birth_date) >= $${paramCount}`;
        values.push(minDays);
      }

      if (request.max_age_days) {
        const maxDays = request.age_flexibility ? request.max_age_days * 1.1 : request.max_age_days;
        paramCount++;
        whereClause += ` AND (CURRENT_DATE - a.birth_date) <= $${paramCount}`;
        values.push(maxDays);
      }
    }

    // Get suggested animals with housing info
    const suggestionsQuery = `
      SELECT
        a.*,
        h.location as housing_location,
        h.housing_number,
        CASE
          WHEN a.strain = $${paramCount + 1} THEN 'exact'
          WHEN a.strain = ANY($${paramCount + 2}) THEN 'alternative_strain'
          ELSE 'other'
        END as match_type,
        CASE
          WHEN a.birth_date IS NOT NULL
          THEN (CURRENT_DATE - a.birth_date)::integer
          ELSE NULL
        END as age_days
      FROM animals a
      LEFT JOIN housing h ON a.housing_id = h.id
      ${whereClause}
      ORDER BY
        match_type,
        CASE WHEN a.genotype = $${paramCount + 3} THEN 0 ELSE 1 END,
        ABS(COALESCE((CURRENT_DATE - a.birth_date)::integer, ${(request.min_age_days + request.max_age_days) / 2 || 60}) - ${(request.min_age_days + request.max_age_days) / 2 || 60}),
        a.animal_number
      LIMIT ${remainingQuantity + 10}
    `;

    values.push(request.strain, request.strain_alternatives || [], request.genotype || '');
    const suggestions = await db.query(suggestionsQuery, values);

    // Group suggestions by housing location for efficiency
    const groupedSuggestions = suggestions.rows.reduce((groups, animal) => {
      const location = animal.housing_location || 'Unknown';
      if (!groups[location]) groups[location] = [];
      groups[location].push(animal);
      return groups;
    }, {});

    res.json({
      suggestions: suggestions.rows,
      grouped_by_location: groupedSuggestions,
      remaining_quantity: remainingQuantity,
      total_suggested: suggestions.rows.length,
      exact_matches: suggestions.rows.filter(a => a.match_type === 'exact').length
    });

  } catch (error) {
    console.error('Error getting animal suggestions:', error);
    res.status(500).json({
      message: 'Failed to get animal suggestions',
      error: error.message
    });
  }
});

/**
 * POST /api/animal-requests/bulk-assign
 * Assign multiple animals to multiple requests efficiently (facility managers only)
 */
router.post('/bulk-assign', auth, roleCheck(['facility_manager', 'admin']), async (req, res) => {
  try {
    const { assignments } = req.body;
    // assignments: [{ request_id, animal_ids }]

    if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ message: 'Assignments array is required' });
    }

    // Start transaction
    await db.query('BEGIN');

    try {
      const results = [];
      const allAnimalIds = [];

      // Collect all animal IDs to check availability
      assignments.forEach(assignment => {
        allAnimalIds.push(...assignment.animal_ids);
      });

      // Verify all animals are available
      const animalCheckQuery = `
        SELECT id, animal_number, availability_status
        FROM animals
        WHERE id = ANY($1)
        AND availability_status = 'available'
        AND status = 'active'
      `;
      const availableAnimals = await db.query(animalCheckQuery, [allAnimalIds]);

      if (availableAnimals.rows.length !== allAnimalIds.length) {
        const unavailableIds = allAnimalIds.filter(id =>
          !availableAnimals.rows.some(animal => animal.id === id)
        );
        throw new Error(`Some animals are not available: ${unavailableIds.join(', ')}`);
      }

      // Process each assignment
      for (const assignment of assignments) {
        const { request_id, animal_ids } = assignment;

        // Verify request exists
        const requestResult = await db.query('SELECT * FROM animal_requests WHERE id = $1', [request_id]);
        if (requestResult.rows.length === 0) {
          throw new Error(`Request ${request_id} not found`);
        }

        // Update animal availability status
        await db.query(
          'UPDATE animals SET availability_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2)',
          ['claimed', animal_ids]
        );

        // Create allocations
        const allocationValues = animal_ids.map((animalId, index) =>
          `($1, $${index + 2}, $${animal_ids.length + 2})`
        ).join(', ');

        const insertAllocationsQuery = `
          INSERT INTO animal_request_allocations (request_id, animal_id, allocated_by)
          VALUES ${allocationValues}
          RETURNING *
        `;

        const allocationParams = [request_id, ...animal_ids, req.user.id];
        const allocationsResult = await db.query(insertAllocationsQuery, allocationParams);

        // Update request status if fully fulfilled
        const request = requestResult.rows[0];
        const newAllocatedCount = (request.quantity_allocated || 0) + animal_ids.length;

        let newStatus = request.status;
        if (newAllocatedCount >= request.quantity_requested) {
          newStatus = 'fulfilled';
          // Set fulfilled timestamp
          await db.query(
            'UPDATE animal_requests SET status = $1, fully_fulfilled_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newStatus, request_id]
          );
        } else if (newAllocatedCount > (request.quantity_allocated || 0)) {
          newStatus = 'partially_fulfilled';
          await db.query(
            'UPDATE animal_requests SET status = $1 WHERE id = $2',
            [newStatus, request_id]
          );
        }

        results.push({
          request_id,
          animals_assigned: animal_ids.length,
          new_status: newStatus,
          allocations: allocationsResult.rows
        });
      }

      // Commit transaction
      await db.query('COMMIT');

      res.json({
        message: `Successfully processed ${assignments.length} bulk assignments`,
        results,
        total_animals_assigned: allAnimalIds.length
      });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error in bulk assignment:', error);
    res.status(500).json({
      message: 'Failed to process bulk assignments',
      error: error.message
    });
  }
});

/**
 * POST /api/animal-requests/auto-fulfill
 * Automatically fulfill requests where exact matches are available (facility managers only)
 */
router.post('/auto-fulfill', auth, roleCheck(['facility_manager', 'admin']), async (req, res) => {
  try {
    const { max_requests = 10, priority_only = false } = req.body;

    // Get pending requests that could be auto-fulfilled
    let requestFilter = `WHERE ar.status IN ('submitted', 'reviewing') AND ar.quantity_allocated < ar.quantity_requested`;

    if (priority_only) {
      requestFilter += ` AND ar.priority IN ('urgent', 'high')`;
    }

    const pendingRequestsQuery = `
      SELECT ar.* FROM animal_requests ar
      ${requestFilter}
      ORDER BY
        CASE ar.priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END,
        ar.needed_by_date,
        ar.created_at
      LIMIT $1
    `;

    const pendingRequests = await db.query(pendingRequestsQuery, [max_requests]);
    const results = [];

    // Start transaction
    await db.query('BEGIN');

    try {
      for (const request of pendingRequests.rows) {
        const remainingQuantity = request.quantity_requested - (request.quantity_allocated || 0);

        // Find exact matches for this request
        let whereClause = `WHERE a.availability_status = 'available' AND a.status = 'active'`;
        const values = [request.species, request.strain];
        let paramCount = 2;

        whereClause += ` AND a.species = $1 AND a.strain = $2`;

        if (request.sex && request.sex !== 'any') {
          paramCount++;
          whereClause += ` AND a.sex = $${paramCount}`;
          values.push(request.sex);
        }

        if (request.genotype) {
          paramCount++;
          whereClause += ` AND a.genotype = $${paramCount}`;
          values.push(request.genotype);
        }

        // Age filtering
        if (request.min_age_days) {
          paramCount++;
          whereClause += ` AND (CURRENT_DATE - a.birth_date) >= $${paramCount}`;
          values.push(request.min_age_days);
        }

        if (request.max_age_days) {
          paramCount++;
          whereClause += ` AND (CURRENT_DATE - a.birth_date) <= $${paramCount}`;
          values.push(request.max_age_days);
        }

        const availableQuery = `
          SELECT id FROM animals a
          ${whereClause}
          ORDER BY a.animal_number
          LIMIT $${paramCount + 1}
        `;

        values.push(remainingQuantity);
        const availableAnimals = await db.query(availableQuery, values);

        if (availableAnimals.rows.length >= remainingQuantity) {
          // We can fulfill this request!
          const animalIds = availableAnimals.rows.slice(0, remainingQuantity).map(a => a.id);

          // Update animal availability
          await db.query(
            'UPDATE animals SET availability_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2)',
            ['claimed', animalIds]
          );

          // Create allocations
          const allocationValues = animalIds.map((animalId, index) =>
            `($1, $${index + 2}, $${animalIds.length + 2})`
          ).join(', ');

          const insertAllocationsQuery = `
            INSERT INTO animal_request_allocations (request_id, animal_id, allocated_by)
            VALUES ${allocationValues}
            RETURNING *
          `;

          const allocationParams = [request.id, ...animalIds, req.user.id];
          await db.query(insertAllocationsQuery, allocationParams);

          // Update request status to fulfilled
          await db.query(
            'UPDATE animal_requests SET status = $1, fully_fulfilled_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['fulfilled', request.id]
          );

          results.push({
            request_id: request.id,
            request_number: request.request_number,
            animals_assigned: animalIds.length,
            status: 'fulfilled'
          });
        }
      }

      // Commit transaction
      await db.query('COMMIT');

      res.json({
        message: `Auto-fulfilled ${results.length} requests`,
        fulfilled_requests: results,
        total_animals_assigned: results.reduce((sum, r) => sum + r.animals_assigned, 0)
      });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error in auto-fulfill:', error);
    res.status(500).json({
      message: 'Failed to auto-fulfill requests',
      error: error.message
    });
  }
});

module.exports = router;