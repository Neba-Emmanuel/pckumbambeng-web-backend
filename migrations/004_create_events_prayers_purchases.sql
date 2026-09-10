-- Migration: Create events, prayer_requests, and sermon_purchases tables
-- Requirements: 6.2, 9.2, 10.1

CREATE TABLE IF NOT EXISTS `events` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(200) NOT NULL,
  `event_date` DATETIME NOT NULL,
  `location` VARCHAR(300) NOT NULL,
  `description` TEXT NOT NULL,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_events_created_by` FOREIGN KEY (`created_by`) REFERENCES `members`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `prayer_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `member_id` INT NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `description` TEXT NOT NULL,
  `is_anonymous` BOOLEAN NOT NULL DEFAULT FALSE,
  `status` ENUM('active', 'answered') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_prayer_requests_member` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sermon_purchases` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `member_id` INT NOT NULL,
  `sermon_id` INT NOT NULL,
  `transaction_id` VARCHAR(255) NOT NULL UNIQUE,
  `amount_xaf` INT NOT NULL,
  `payment_method` ENUM('mtn_momo', 'orange_money') NOT NULL,
  `status` ENUM('pending', 'completed', 'failed') NOT NULL DEFAULT 'pending',
  `purchased_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_sermon_purchases_member` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`),
  CONSTRAINT `fk_sermon_purchases_sermon` FOREIGN KEY (`sermon_id`) REFERENCES `sermons`(`id`),
  UNIQUE KEY `uq_member_sermon` (`member_id`, `sermon_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
