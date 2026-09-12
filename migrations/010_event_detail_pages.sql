ALTER TABLE events ADD COLUMN detail_page_status ENUM('off', 'not_started', 'draft', 'published') NOT NULL DEFAULT 'off', ADD COLUMN detail_page_path VARCHAR(240) NULL;
