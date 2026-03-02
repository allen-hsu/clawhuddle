ALTER TABLE org_members DROP COLUMN gateway_port;
ALTER TABLE org_members DROP COLUMN gateway_subdomain;
ALTER TABLE org_members ADD COLUMN gateway_link TEXT;
