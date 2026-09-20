ALTER TABLE announcements ADD COLUMN expires_on DATE NULL DEFAULT NULL;
CREATE INDEX idx_announcements_expires_on ON announcements (expires_on);
