-- Migrate existing data into multi-org structure

-- Create default organization from existing company
INSERT OR IGNORE INTO organizations (id, name, slug)
SELECT 'default', name, 'default' FROM company WHERE id = 'default';

-- If no company row exists, create a fallback default org
INSERT OR IGNORE INTO organizations (id, name, slug)
VALUES ('default', 'Default Organization', 'default');

-- Copy existing users into org_members (preserving gateway fields)
-- Map old role: 'admin' -> 'owner', else keep as-is
INSERT OR IGNORE INTO org_members (id, org_id, user_id, role, status, gateway_port, gateway_status, gateway_token)
SELECT
    'om-' || id,
    'default',
    id,
    CASE WHEN role = 'admin' THEN 'owner' ELSE role END,
    status,
    gateway_port,
    gateway_status,
    gateway_token
FROM users;

-- Ensure at least one owner exists in the default org (promote earliest user)
UPDATE org_members SET role = 'owner'
WHERE id = (
    SELECT om.id FROM org_members om
    JOIN users u ON u.id = om.user_id
    WHERE om.org_id = 'default'
    ORDER BY u.created_at ASC
    LIMIT 1
) AND (SELECT COUNT(*) FROM org_members WHERE org_id = 'default' AND role = 'owner') = 0;

-- Set org_id on existing skills
UPDATE skills SET org_id = 'default' WHERE org_id IS NULL;

-- Set org_id on existing api_keys
UPDATE api_keys SET org_id = 'default' WHERE org_id IS NULL;

-- Set org_id on existing usage_logs
UPDATE usage_logs SET org_id = 'default' WHERE org_id IS NULL;
