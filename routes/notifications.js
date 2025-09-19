const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Initialize database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ================================================================================
// NOTIFICATION ROUTES
// ================================================================================

/**
 * GET /api/notifications
 * Get notifications for current user
 */
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 50, unread_only = false } = req.query;

    let whereClause = 'WHERE user_id = $1';
    const values = [req.user.id];

    if (unread_only === 'true') {
      whereClause += ' AND read_at IS NULL';
    }

    const query = `
      SELECT
        n.*,
        CASE
          WHEN n.related_request_id IS NOT NULL THEN (
            SELECT jsonb_build_object(
              'request_number', ar.request_number,
              'title', ar.title,
              'status', ar.status
            )
            FROM animal_requests ar WHERE ar.id = n.related_request_id
          )
          ELSE NULL
        END as request_details
      FROM notifications n
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT $${values.length + 1}
    `;

    values.push(parseInt(limit));

    const result = await db.query(query, values);

    // Get unread count
    const unreadCountQuery = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read_at IS NULL';
    const unreadResult = await db.query(unreadCountQuery, [req.user.id]);

    res.json({
      notifications: result.rows,
      unread_count: parseInt(unreadResult.rows[0].count)
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
router.put('/:id/read', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const updateQuery = `
      UPDATE notifications
      SET read_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2 AND read_at IS NULL
      RETURNING *
    `;

    const result = await db.query(updateQuery, [id, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Notification not found or already read' });
    }

    res.json({
      message: 'Notification marked as read',
      notification: result.rows[0]
    });

  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
});

/**
 * PUT /api/notifications/mark-all-read
 * Mark all notifications as read for current user
 */
router.put('/mark-all-read', auth, async (req, res) => {
  try {
    const updateQuery = `
      UPDATE notifications
      SET read_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND read_at IS NULL
      RETURNING id
    `;

    const result = await db.query(updateQuery, [req.user.id]);

    res.json({
      message: `Marked ${result.rows.length} notifications as read`,
      marked_count: result.rows.length
    });

  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      message: 'Failed to mark all notifications as read',
      error: error.message
    });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete notification
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const deleteQuery = 'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING *';
    const result = await db.query(deleteQuery, [id, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({
      message: 'Notification deleted',
      notification: result.rows[0]
    });

  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      message: 'Failed to delete notification',
      error: error.message
    });
  }
});

/**
 * POST /api/notifications/create
 * Create notification (internal use, admin/facility managers only)
 */
router.post('/create', auth, roleCheck(['facility_manager', 'admin']), async (req, res) => {
  try {
    const {
      user_id,
      title,
      message,
      type = 'info',
      related_request_id = null,
      action_url = null
    } = req.body;

    if (!user_id || !title || !message) {
      return res.status(400).json({
        message: 'user_id, title, and message are required'
      });
    }

    const insertQuery = `
      INSERT INTO notifications (user_id, title, message, type, related_request_id, action_url, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [user_id, title, message, type, related_request_id, action_url, req.user.id];
    const result = await db.query(insertQuery, values);

    res.status(201).json({
      message: 'Notification created',
      notification: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      message: 'Failed to create notification',
      error: error.message
    });
  }
});

// ================================================================================
// NOTIFICATION HELPER FUNCTIONS
// ================================================================================

/**
 * Create notification for animal request status change
 */
const createRequestStatusNotification = async (requestId, newStatus, reviewerId, notes = '') => {
  try {
    // Get request details
    const requestQuery = `
      SELECT ar.*, u.first_name || ' ' || u.last_name as requester_name
      FROM animal_requests ar
      JOIN users u ON ar.requested_by = u.id
      WHERE ar.id = $1
    `;
    const requestResult = await db.query(requestQuery, [requestId]);

    if (requestResult.rows.length === 0) return;

    const request = requestResult.rows[0];

    // Determine notification details based on status
    let title, message, type;

    switch (newStatus) {
      case 'reviewing':
        title = 'Request Under Review';
        message = `Your animal request #${request.request_number} "${request.title}" is now being reviewed by the facility manager.`;
        type = 'info';
        break;

      case 'fulfilled':
        title = 'Request Fulfilled';
        message = `Great news! Your animal request #${request.request_number} "${request.title}" has been fulfilled. Animals have been assigned to your request.`;
        type = 'success';
        break;

      case 'partially_fulfilled':
        title = 'Request Partially Fulfilled';
        message = `Your animal request #${request.request_number} "${request.title}" has been partially fulfilled. Some animals have been assigned.`;
        type = 'info';
        break;

      case 'waitlisted':
        title = 'Request Waitlisted';
        message = `Your animal request #${request.request_number} "${request.title}" has been placed on the waitlist. You'll be notified when animals become available.`;
        type = 'warning';
        break;

      case 'denied':
        title = 'Request Denied';
        message = `Your animal request #${request.request_number} "${request.title}" has been denied. ${notes ? 'Reason: ' + notes : 'Please contact the facility manager for more information.'}`;
        type = 'error';
        break;

      default:
        return; // Don't create notification for other statuses
    }

    // Create notification
    const insertQuery = `
      INSERT INTO notifications (user_id, title, message, type, related_request_id, action_url, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    const values = [
      request.requested_by,
      title,
      message,
      type,
      requestId,
      `/animal-requests/${requestId}`,
      reviewerId
    ];

    await db.query(insertQuery, values);
    console.log(`Notification created for request ${request.request_number} status change to ${newStatus}`);

  } catch (error) {
    console.error('Error creating request status notification:', error);
  }
};

/**
 * Create notification for animal assignment
 */
const createAnimalAssignmentNotification = async (requestId, assignedAnimalIds, assignedBy) => {
  try {
    // Get request details
    const requestQuery = `
      SELECT ar.*, u.first_name || ' ' || u.last_name as requester_name
      FROM animal_requests ar
      JOIN users u ON ar.requested_by = u.id
      WHERE ar.id = $1
    `;
    const requestResult = await db.query(requestQuery, [requestId]);

    if (requestResult.rows.length === 0) return;

    const request = requestResult.rows[0];

    // Get animal details
    const animalsQuery = `
      SELECT array_agg(animal_number ORDER BY animal_number) as animal_numbers
      FROM animals
      WHERE id = ANY($1)
    `;
    const animalsResult = await db.query(animalsQuery, [assignedAnimalIds]);
    const animalNumbers = animalsResult.rows[0].animal_numbers || [];

    const title = 'Animals Assigned';
    const message = `${assignedAnimalIds.length} animals have been assigned to your request #${request.request_number} "${request.title}". Animal numbers: ${animalNumbers.join(', ')}.`;

    // Create notification
    const insertQuery = `
      INSERT INTO notifications (user_id, title, message, type, related_request_id, action_url, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    const values = [
      request.requested_by,
      title,
      message,
      'success',
      requestId,
      `/animal-requests/${requestId}`,
      assignedBy
    ];

    await db.query(insertQuery, values);
    console.log(`Animal assignment notification created for request ${request.request_number}`);

  } catch (error) {
    console.error('Error creating animal assignment notification:', error);
  }
};

// Export helper functions
router.createRequestStatusNotification = createRequestStatusNotification;
router.createAnimalAssignmentNotification = createAnimalAssignmentNotification;

module.exports = router;