DROP TABLE IF EXISTS `puzzle_guess`;

DROP TABLE IF EXISTS `puzzle_result`;

DROP TABLE IF EXISTS `sermon_purchases`;

DROP TABLE IF EXISTS `prayer_requests`;

DROP TABLE IF EXISTS `notifications`;

ALTER TABLE `sermons` DROP COLUMN `pricing`;

ALTER TABLE `sermons` DROP COLUMN `price_xaf`;

ALTER TABLE `push_subscriptions` DROP FOREIGN KEY `push_subscriptions_ibfk_1`;

ALTER TABLE `push_subscriptions` DROP COLUMN `member_id`;
