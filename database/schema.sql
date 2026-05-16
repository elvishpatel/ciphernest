-- ============================================================
-- CipherNest Database Schema
-- Run this in Supabase SQL Editor (Settings → SQL Editor)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS TABLE
-- Stores auth key hash + encrypted vault key blob
-- Server NEVER knows the master password
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  auth_key_hash TEXT NOT NULL,
  vault_key_blob TEXT NOT NULL,
  salt TEXT NOT NULL,
  recovery_blob TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login TIMESTAMPTZ,
  settings_encrypted TEXT
);

-- ============================================================
-- VAULTS TABLE
-- Each user can have multiple isolated encrypted vaults
-- visibility_mode: 'normal' | 'hidden' | 'decoy'
-- ============================================================
CREATE TABLE vaults (
  vault_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  encrypted_vault_key TEXT NOT NULL,
  vault_name_encrypted TEXT NOT NULL,
  vault_type TEXT DEFAULT 'personal',
  visibility_mode TEXT DEFAULT 'normal',
  icon_encrypted TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vaults_user ON vaults(user_id);

-- ============================================================
-- VAULT ENTRIES TABLE
-- Each password/credential is stored as an encrypted blob
-- encrypted_blob contains: platform, username, password, 
-- notes, urls, tags, recovery codes, TOTP secret, etc.
-- ============================================================
CREATE TABLE vault_entries (
  entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID REFERENCES vaults(vault_id) ON DELETE CASCADE,
  encrypted_blob TEXT NOT NULL,
  hmac TEXT NOT NULL,
  security_score INT DEFAULT 0,
  favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_entries_vault ON vault_entries(vault_id);

-- ============================================================
-- PASSWORD HISTORY TABLE
-- Keeps encrypted old password versions
-- ============================================================
CREATE TABLE password_history (
  history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES vault_entries(entry_id) ON DELETE CASCADE,
  encrypted_old_blob TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_history_entry ON password_history(entry_id);

-- ============================================================
-- SECURITY EVENTS TABLE
-- Tracks failed logins, suspicious activity, etc.
-- ============================================================
CREATE TABLE security_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  risk_score INT DEFAULT 0,
  metadata_encrypted TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_events_user ON security_events(user_id);
CREATE INDEX idx_events_type ON security_events(event_type);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Ensures users can only access their own data
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Note: Since we use a backend API (not direct Supabase client),
-- RLS policies are enforced at the API layer via JWT user_id verification.
-- If you want additional RLS policies for direct Supabase access:

-- CREATE POLICY "Users own data" ON users
--   FOR ALL USING (id = auth.uid());
-- CREATE POLICY "Users own vaults" ON vaults
--   FOR ALL USING (user_id = auth.uid());
-- CREATE POLICY "Users own entries" ON vault_entries
--   FOR ALL USING (vault_id IN (SELECT vault_id FROM vaults WHERE user_id = auth.uid()));
