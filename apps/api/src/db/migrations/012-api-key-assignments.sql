-- api_key_assignments: many-to-many between api_keys and org_members
-- One member can only have ONE key per provider (enforced by UNIQUE constraint)
CREATE TABLE IF NOT EXISTS api_key_assignments (
    id TEXT PRIMARY KEY,
    api_key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(member_id, api_key_id)
);

-- Remove the old member_id column usage (we keep the column for now, just unused)
-- New logic: is_company_default=1 => default key, is_company_default=0 + no member_id => user-specific pool
