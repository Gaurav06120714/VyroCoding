-- Migration 001: Add password reset columns to users table
-- Run this once against your PostgreSQL database:
--   psql $DATABASE_URL -f apps/api/src/db/migrations/001_password_reset.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reset_token_hash    VARCHAR(64),
  ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token_hash)
  WHERE reset_token_hash IS NOT NULL;
