ALTER TABLE api_keys ADD COLUMN member_id TEXT REFERENCES org_members(id);
