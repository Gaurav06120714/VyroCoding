/**
 * Centralized environment configuration for VyroCoding API.
 *
 * All process.env access MUST go through this module.
 * Never read process.env directly in route/service files — import from here.
 *
 * Validates required variables at startup so the server fails fast with a
 * clear message rather than crashing with an obscure runtime error later.
 *
 * Usage:
 *   import { env } from '../config/env.js';
 *   const db = new Pool({ connectionString: env.DATABASE_URL });
 */

import 'dotenv/config';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Env {
  // Runtime
  NODE_ENV: 'development' | 'staging' | 'production' | 'test';
  LOG_LEVEL: string;

  // Server
  API_PORT: number;
  API_HOST: string;
  CORS_ORIGIN: string[];  // parsed from comma-separated string

  // Database
  DATABASE_URL: string;

  // Redis
  REDIS_URL: string;

  // Auth / JWT
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;

  // Proxy / Rate limiting
  PROXY_DEPTH: number;
  IP_HASH_SALT: string;

  // Judge0 (code execution)
  JUDGE0_API_URL: string;
  JUDGE0_API_KEY: string;

  // Collab (Y.js WebSocket)
  COLLAB_PORT: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[env] Required environment variable "${name}" is not set.\n` +
      `Copy .env.example to .env and fill in the value.`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function optionalInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`[env] "${name}" must be an integer, got: "${v}"`);
  return n;
}

function parseOrigins(raw: string | undefined): string[] {
  if (!raw) return ['http://localhost:3000', 'http://localhost:5173'];
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

// ── Production-safety checks ─────────────────────────────────────────────────

function validateProductionConfig(parsed: Env): void {
  if (parsed.NODE_ENV !== 'production') return;

  const errors: string[] = [];

  if (parsed.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters in production');
  }
  if (parsed.JWT_SECRET.includes('REPLACE') || parsed.JWT_SECRET.includes('change')) {
    errors.push('JWT_SECRET appears to be a placeholder — set a real random secret');
  }
  if (parsed.IP_HASH_SALT.includes('change-this-salt')) {
    errors.push('IP_HASH_SALT must be changed from the default in production');
  }
  if (!parsed.DATABASE_URL || parsed.DATABASE_URL.includes('localhost')) {
    errors.push('DATABASE_URL should not point to localhost in production');
  }

  if (errors.length > 0) {
    throw new Error(
      `[env] Production startup blocked — fix these issues:\n  - ${errors.join('\n  - ')}`,
    );
  }
}

// ── Parse and export ──────────────────────────────────────────────────────────

function buildEnv(): Env {
  const nodeEnv = optional('NODE_ENV', 'development') as Env['NODE_ENV'];

  // In production, JWT_SECRET is required.
  // In dev/test, we warn but allow missing (using the random-per-boot fallback set in index.ts).
  const jwtSecret =
    nodeEnv === 'production'
      ? required('JWT_SECRET')
      : optional('JWT_SECRET', '');

  const parsed: Env = {
    NODE_ENV: nodeEnv,
    LOG_LEVEL: optional('LOG_LEVEL', nodeEnv === 'production' ? 'warn' : 'info'),

    API_PORT: optionalInt('API_PORT', 3003),
    API_HOST: optional('API_HOST', '0.0.0.0'),
    CORS_ORIGIN: parseOrigins(process.env['CORS_ORIGIN']),

    DATABASE_URL: required('DATABASE_URL'),
    REDIS_URL: optional('REDIS_URL', 'redis://localhost:6379'),

    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '7d'),

    PROXY_DEPTH: optionalInt('PROXY_DEPTH', 1),
    IP_HASH_SALT: optional('IP_HASH_SALT', 'vyrocoding-change-this-salt-in-prod'),

    JUDGE0_API_URL: optional('JUDGE0_API_URL', 'https://ce.judge0.com'),
    JUDGE0_API_KEY: optional('JUDGE0_API_KEY', ''),

    COLLAB_PORT: optionalInt('COLLAB_PORT', 1234),
  };

  validateProductionConfig(parsed);
  return parsed;
}

export const env: Readonly<Env> = buildEnv();
