CREATE TABLE preachers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  kind ENUM('pastor', 'guest') NOT NULL DEFAULT 'guest',
  image_url VARCHAR(2048) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_preacher_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO preachers (name, kind) VALUES
  ('Rev. Dr. Mokoko Mbue Thomas', 'pastor'),
  ('Rev. Saihnom Read Fomufod', 'pastor');

INSERT IGNORE INTO preachers (name, kind, image_url)
SELECT TRIM(speaker), 'guest', MAX(NULLIF(preacher_image, '')) FROM sermons
WHERE TRIM(speaker) <> '' GROUP BY TRIM(speaker);

UPDATE preachers p JOIN (
  SELECT TRIM(speaker) AS name, MAX(NULLIF(preacher_image, '')) AS image_url
  FROM sermons GROUP BY TRIM(speaker)
) existing ON p.name = existing.name
SET p.image_url = existing.image_url WHERE p.image_url IS NULL;

ALTER TABLE sermons ADD COLUMN preacher_id INT NULL,
  ADD CONSTRAINT fk_sermon_preacher FOREIGN KEY (preacher_id) REFERENCES preachers(id);

UPDATE sermons s JOIN preachers p ON p.name = TRIM(s.speaker)
SET s.preacher_id = p.id WHERE s.preacher_id IS NULL;
