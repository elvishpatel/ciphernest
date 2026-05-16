-- Migration: Add recovery fields to users table
ALTER TABLE users 
ADD COLUMN recovery_auth_hash VARCHAR(255),
ADD COLUMN recovery_key_blob TEXT;
