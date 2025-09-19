-- ================================================================================
-- NOTIFICATIONS SYSTEM MIGRATION
-- ================================================================================

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    related_request_id UUID REFERENCES animal_requests(id) ON DELETE CASCADE,
    action_url VARCHAR(500),
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_related_request ON notifications(related_request_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread_user ON notifications(user_id, read_at) WHERE read_at IS NULL;

-- Add notification preferences to users table (optional)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
    "email_notifications": true,
    "browser_notifications": true,
    "request_status_changes": true,
    "animal_assignments": true,
    "system_announcements": true
}'::jsonb;

-- Create function to automatically clean up old notifications
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
    -- Delete read notifications older than 30 days
    DELETE FROM notifications
    WHERE read_at IS NOT NULL
    AND read_at < CURRENT_TIMESTAMP - INTERVAL '30 days';

    -- Delete unread notifications older than 90 days
    DELETE FROM notifications
    WHERE read_at IS NULL
    AND created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled cleanup job (if pg_cron is available)
-- This will run daily at 2 AM to clean up old notifications
-- SELECT cron.schedule('cleanup-notifications', '0 2 * * *', 'SELECT cleanup_old_notifications();');

-- Insert a welcome notification for existing users (optional)
INSERT INTO notifications (user_id, title, message, type, created_at)
SELECT
    id as user_id,
    'Welcome to the Enhanced Animal LIMS!' as title,
    'The system now includes a request-assignment workflow managed by facility managers. You''ll receive notifications about your animal request status changes and assignments.' as message,
    'info' as type,
    CURRENT_TIMESTAMP as created_at
FROM users
WHERE id NOT IN (SELECT DISTINCT user_id FROM notifications WHERE title = 'Welcome to the Enhanced Animal LIMS!')
ON CONFLICT DO NOTHING;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO postgres;
GRANT USAGE ON SCHEMA public TO postgres;