CREATE TABLE IF NOT EXISTS `puzzle_guess` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `member_id` INT NOT NULL,
  `puzzle_date` DATE NOT NULL,
  `guess` VARCHAR(15) NOT NULL,
  `guess_index` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_puzzle_guess_member` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`),
  UNIQUE KEY `uq_guess_slot` (`member_id`, `puzzle_date`, `guess_index`),
  INDEX `idx_puzzle_guess_lookup` (`member_id`, `puzzle_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
