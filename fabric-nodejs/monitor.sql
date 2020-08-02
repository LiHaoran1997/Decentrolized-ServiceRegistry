/*
 Navicat MySQL Data Transfer

 Source Server         : qwewe
 Source Server Type    : MySQL
 Source Server Version : 80019
 Source Host           : localhost:3306
 Source Schema         : new_test

 Target Server Type    : MySQL
 Target Server Version : 80019
 File Encoding         : 65001

 Date: 16/06/2020 11:07:54
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for monitor
-- ----------------------------
DROP TABLE IF EXISTS `monitor`;
CREATE TABLE `monitor`  (
  `clickTime` timestamp(6) NOT NULL,
  `serviceTime` timestamp(0) NOT NULL,
  `blockchainTime` timestamp(0) NOT NULL,
  `service` varchar(128) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `ipaddr` varchar(128) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `host` varchar(128) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `port` varchar(128) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `serviceDelay` int(0) NOT NULL,
  `blockchainDelay` int(0) NOT NULL,
  `delay` int(0) NOT NULL,
  `serviceCompleted` varchar(128) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `blockchainCompleted` varchar(128) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  PRIMARY KEY (`host`, `service`, `ipaddr`, `blockchainTime`, `clickTime`, `serviceTime`, `port`, `blockchainDelay`, `delay`, `serviceDelay`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8 COLLATE = utf8_unicode_ci ROW_FORMAT = Dynamic;

SET FOREIGN_KEY_CHECKS = 1;
