-- 002_schema_v2.sql
-- Enforce constraints, canonical statuses, and indexes required by Phase 5

-- 1. Services table updates
ALTER TABLE services ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ NULL;

-- Convert legacy display statuses to canonical UP / DOWN / UNKNOWN
UPDATE services SET status = 'UP' WHERE status IN ('Healthy', 'Collecting', 'Connected');
UPDATE services SET status = 'DOWN' WHERE status = 'Down';
UPDATE services SET status = 'UNKNOWN' WHERE status NOT IN ('UP', 'DOWN');

ALTER TABLE services ALTER COLUMN status SET DEFAULT 'UNKNOWN';

-- 2. Column NOT NULL assurances
ALTER TABLE users ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE incidents ALTER COLUMN active SET NOT NULL;
ALTER TABLE incidents ALTER COLUMN created_at SET NOT NULL;

-- 3. Constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_services_status') THEN
    ALTER TABLE services ADD CONSTRAINT chk_services_status CHECK (status IN ('UP', 'DOWN', 'UNKNOWN'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_services_name') THEN
    ALTER TABLE services ADD CONSTRAINT uq_services_name UNIQUE (name);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_incidents_severity') THEN
    ALTER TABLE incidents ADD CONSTRAINT chk_incidents_severity CHECK (severity IN ('warning', 'critical'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_alert_config_cpu') THEN
    ALTER TABLE alert_config ADD CONSTRAINT chk_alert_config_cpu CHECK (cpu_threshold >= 0 AND cpu_threshold <= 100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_alert_config_memory') THEN
    ALTER TABLE alert_config ADD CONSTRAINT chk_alert_config_memory CHECK (memory_threshold >= 0 AND memory_threshold <= 100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_alert_config_error_rate') THEN
    ALTER TABLE alert_config ADD CONSTRAINT chk_alert_config_error_rate CHECK (error_rate_threshold >= 0 AND error_rate_threshold <= 100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_alert_config_response_time') THEN
    ALTER TABLE alert_config ADD CONSTRAINT chk_alert_config_response_time CHECK (response_time_threshold > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_alert_config_duration') THEN
    ALTER TABLE alert_config ADD CONSTRAINT chk_alert_config_duration CHECK (duration_minutes >= 1);
  END IF;
END $$;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_incidents_active_created ON incidents (active, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_active_title ON incidents (title) WHERE active = true;
