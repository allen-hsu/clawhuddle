-- Rename misleading key_encrypted column to key_value (it's base64, not encrypted)
ALTER TABLE api_keys RENAME COLUMN key_encrypted TO key_value;
