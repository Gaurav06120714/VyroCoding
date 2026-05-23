-- Vyro Coding Database Schema
-- PostgreSQL 15+

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(50)  UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rating        INTEGER DEFAULT 1200,
  problems_solved INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_rating   ON users(rating DESC);

-- ─── Problems ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS problems (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          VARCHAR(100) UNIQUE NOT NULL,
  title         VARCHAR(255) NOT NULL,
  difficulty    VARCHAR(10)  NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  description   TEXT NOT NULL,
  examples      JSONB NOT NULL DEFAULT '[]',
  constraints   JSONB NOT NULL DEFAULT '[]',
  starter_code  JSONB NOT NULL DEFAULT '{}',
  test_cases    JSONB NOT NULL DEFAULT '[]',
  tags          TEXT[] DEFAULT '{}',
  acceptance_rate NUMERIC(5,2) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problems_slug       ON problems(slug);
CREATE INDEX IF NOT EXISTS idx_problems_difficulty ON problems(difficulty);
CREATE INDEX IF NOT EXISTS idx_problems_tags       ON problems USING GIN(tags);

-- ─── Submissions ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS submissions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id  UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  room_id     UUID,
  language_id INTEGER NOT NULL,
  code        TEXT NOT NULL,
  status      VARCHAR(30) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','processing','accepted','wrong_answer',
                                  'time_limit_exceeded','memory_limit_exceeded',
                                  'runtime_error','compile_error')),
  stdout      TEXT,
  stderr      TEXT,
  time_ms     INTEGER,
  memory_kb   INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_user    ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_problem ON submissions(problem_id);
CREATE INDEX IF NOT EXISTS idx_submissions_room    ON submissions(room_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status  ON submissions(status);

-- ─── Rooms ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rooms (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             VARCHAR(100) NOT NULL,
  host_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id       UUID REFERENCES problems(id) ON DELETE SET NULL,
  is_public        BOOLEAN DEFAULT TRUE,
  max_participants INTEGER DEFAULT 4,
  status           VARCHAR(10) DEFAULT 'waiting'
                     CHECK (status IN ('waiting','active','ended')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_host_id   ON rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status    ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_is_public ON rooms(is_public);

-- ─── Room Participants ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS room_participants (
  room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  language_id INTEGER DEFAULT 93,
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_participants_user ON room_participants(user_id);

-- ─── Contests ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contests (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       VARCHAR(255) NOT NULL,
  start_time  TIMESTAMPTZ NOT NULL,
  end_time    TIMESTAMPTZ NOT NULL,
  status      VARCHAR(10) DEFAULT 'upcoming'
                CHECK (status IN ('upcoming','active','ended')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contests_status     ON contests(status);
CREATE INDEX IF NOT EXISTS idx_contests_start_time ON contests(start_time);

-- ─── Contest Problems ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contest_problems (
  contest_id   UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  problem_id   UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  points       INTEGER NOT NULL DEFAULT 100,
  order_index  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (contest_id, problem_id)
);

-- ─── Contest Submissions ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contest_submissions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id   UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id   UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  score        INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cs_contest ON contest_submissions(contest_id);
CREATE INDEX IF NOT EXISTS idx_cs_user    ON contest_submissions(user_id);
