-- Fix for "inconsistent types deduced for parameter" in leave requests
-- This trigger automatically handles the approved_at and updated_at columns

-- 1. Create function to manage approved_at
CREATE OR REPLACE FUNCTION set_leave_request_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    -- Set approved_at if status becomes 'approved' and it wasn't already set
    IF NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.approved_at IS NULL THEN
        NEW.approved_at = NOW();
    END IF;

    -- Clear approved_at if status is changed back to pending
    IF NEW.status = 'pending' THEN
        NEW.approved_at = NULL;
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS trg_leave_request_timestamps ON leave_requests;
CREATE TRIGGER trg_leave_request_timestamps
BEFORE UPDATE ON leave_requests
FOR EACH ROW
EXECUTE FUNCTION set_leave_request_timestamps();

-- 3. Also handle it for INSERT
CREATE OR REPLACE FUNCTION set_leave_request_insert_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND NEW.approved_at IS NULL THEN
        NEW.approved_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leave_request_insert_timestamps ON leave_requests;
CREATE TRIGGER trg_leave_request_insert_timestamps
BEFORE INSERT ON leave_requests
FOR EACH ROW
EXECUTE FUNCTION set_leave_request_insert_timestamps();
