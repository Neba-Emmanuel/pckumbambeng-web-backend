-- Migration: Create announcements and sermons tables
-- Requirements: 4.1, 5.1, 8.2, 8.3

CREATE TABLE IF NOT EXISTS `announcements` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(200) NOT NULL,
  `body` TEXT NOT NULL,
  `attachment_path` VARCHAR(500) NULL,
  `attachment_type` VARCHAR(50) NULL,
  `published_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` INT NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_announcements_created_by` FOREIGN KEY (`created_by`) REFERENCES `members`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sermons` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(200) NOT NULL,
  `speaker` VARCHAR(100) NOT NULL,
  `sermon_date` DATE NOT NULL,
  `content_type` ENUM('audio', 'text') NOT NULL,
  `text_content` TEXT NULL,
  `audio_path` VARCHAR(500) NULL,
  `pricing` ENUM('free', 'paid') NOT NULL DEFAULT 'free',
  `price_xaf` INT NULL,
  `created_by` INT NOT NULL,
  `published_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_sermons_created_by` FOREIGN KEY (`created_by`) REFERENCES `members`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
