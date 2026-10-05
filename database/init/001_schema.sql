CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    role VARCHAR(40) NOT NULL DEFAULT 'OPERATOR' CHECK (role IN ('ADMIN', 'SUPERVISOR', 'OPERATOR')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cameras (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    location VARCHAR(255),
    stream_url TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS detections (
    id BIGSERIAL PRIMARY KEY,
    camera_id BIGINT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    asset_type VARCHAR(80) NOT NULL,
    confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    bounding_box JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incidents (
    id BIGSERIAL PRIMARY KEY,
    camera_id BIGINT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
    incident_type VARCHAR(40) NOT NULL CHECK (incident_type IN ('THREAT', 'HEALTH', 'ACCESS', 'OTHER')),
    priority VARCHAR(20) NOT NULL DEFAULT 'LOW' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
    asset_type VARCHAR(80) NOT NULL,
    confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    summary TEXT NOT NULL,
    snapshot_url TEXT,
    bounding_box JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS alerts (
    id BIGSERIAL PRIMARY KEY,
    incident_id BIGINT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
    channel VARCHAR(30) NOT NULL DEFAULT 'SYSTEM',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id BIGINT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cameras_project_id ON cameras(project_id);
CREATE INDEX IF NOT EXISTS idx_detections_camera_detected_at ON detections(camera_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_status_created_at ON incidents(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_priority ON incidents(priority);
CREATE INDEX IF NOT EXISTS idx_alerts_pending ON alerts(status, created_at) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_incidents_metadata ON incidents USING GIN(metadata);

CREATE OR REPLACE FUNCTION assign_priority(
    p_incident_type VARCHAR,
    p_asset_type VARCHAR,
    p_confidence NUMERIC
) RETURNS VARCHAR AS $$
BEGIN
    IF UPPER(p_incident_type) = 'THREAT' AND UPPER(p_asset_type) IN ('WEAPON', 'KNIFE', 'GUN') AND p_confidence >= 0.80 THEN
        RETURN 'CRITICAL';
    ELSIF UPPER(p_incident_type) = 'HEALTH' AND p_confidence >= 0.80 THEN
        RETURN 'HIGH';
    ELSIF p_confidence >= 0.85 THEN
        RETURN 'HIGH';
    ELSIF p_confidence >= 0.60 THEN
        RETURN 'MEDIUM';
    END IF;
    RETURN 'LOW';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION incidents_set_priority() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.metadata->>'detectedPriority' IN ('LOW','MEDIUM','HIGH','CRITICAL') THEN
        NEW.priority := NEW.metadata->>'detectedPriority';
    ELSE
        NEW.priority := assign_priority(NEW.incident_type, NEW.asset_type, NEW.confidence::numeric);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_incidents_set_priority ON incidents;
CREATE TRIGGER trg_incidents_set_priority
BEFORE INSERT OR UPDATE OF incident_type, asset_type, confidence ON incidents
FOR EACH ROW EXECUTE FUNCTION incidents_set_priority();

CREATE OR REPLACE FUNCTION incidents_create_alert() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO alerts (incident_id, alert_type, channel, payload)
    VALUES (
        NEW.id,
        CASE WHEN NEW.incident_type = 'THREAT' THEN 'THREAT_DETECTED'
             WHEN NEW.incident_type = 'HEALTH' THEN 'MEDICAL_DISPATCH'
             ELSE 'INCIDENT_CREATED' END,
        'SYSTEM',
        jsonb_build_object('priority', NEW.priority, 'camera_id', NEW.camera_id, 'summary', NEW.summary)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_incidents_create_alert ON incidents;
CREATE TRIGGER trg_incidents_create_alert
AFTER INSERT ON incidents
FOR EACH ROW EXECUTE FUNCTION incidents_create_alert();

INSERT INTO projects (name, description)
SELECT 'Main Campus', 'Default Project Cypher monitoring area'
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'Main Campus');

INSERT INTO cameras (project_id, name, location, stream_url)
SELECT p.id, 'North Corridor', 'Building A / Level 1', 'demo://north-corridor'
FROM projects p
WHERE p.name = 'Main Campus'
  AND NOT EXISTS (SELECT 1 FROM cameras c WHERE c.name = 'North Corridor');

INSERT INTO cameras (project_id, name, location, stream_url)
SELECT p.id, 'Lab Entrance', 'Building A / Level 2', 'demo://lab-entrance'
FROM projects p
WHERE p.name = 'Main Campus'
  AND NOT EXISTS (SELECT 1 FROM cameras c WHERE c.name = 'Lab Entrance');
