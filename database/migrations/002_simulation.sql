BEGIN;
-- Replace the function without dropping its dependent trigger or any data.
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_incident_simulation_event
ON incidents ((metadata->>'eventId')) WHERE metadata ? 'eventId';
COMMIT;
