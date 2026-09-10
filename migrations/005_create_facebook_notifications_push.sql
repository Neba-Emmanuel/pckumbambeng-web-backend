-- Migration: Create Facebook, Notification, and PushSubscription tables
-- Requirements: 7.1, 7.4, 11.1, 11.5

CREATE TABLE IF NOT EXISTS `facebook_page_sources` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `page_id` VARCHAR(255) NOT NULL,
  `page_name` VARCHAR(255) NOT NULL,
  `access_token` VARCHAR(500) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `facebook_post_cache` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `source_id` INT NOT NULL,
  `fb_post_id` VARCHAR(255) NOT NULL UNIQUE,
  `content` TEXT NOT NULL,
  `posted_at` DATETIME NOT NULL,
  `fetched_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`source_id`) REFERENCES `facebook_page_sources`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `member_id` INT NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `message` TEXT NOT NULL,
  `type` ENUM('announcement', 'event', 'prayer_request') NOT NULL,
  `reference_id` INT NOT NULL,
  `is_read` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `push_subscriptions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `member_id` INT NOT NULL,
  `endpoint` TEXT NOT NULL,
  `p256dh_key` VARCHAR(255) NOT NULL,
  `auth_key` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
