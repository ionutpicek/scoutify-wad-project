CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR(191) PRIMARY KEY,
  team_id VARCHAR(64) NULL,
  name VARCHAR(255) NULL,
  slug VARCHAR(255) NULL,
  coach VARCHAR(255) NULL,
  coach_url TEXT NULL,
  source_payload JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_teams_team_id (team_id),
  KEY idx_teams_name (name)
);

CREATE TABLE IF NOT EXISTS players (
  id VARCHAR(191) PRIMARY KEY,
  player_id BIGINT NULL,
  team_id VARCHAR(64) NULL,
  team_name VARCHAR(255) NULL,
  name VARCHAR(255) NULL,
  abbr_name VARCHAR(255) NULL,
  position VARCHAR(100) NULL,
  nationality VARCHAR(120) NULL,
  birthdate DATE NULL,
  photo_url TEXT NULL,
  source_payload JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_players_team_id (team_id),
  KEY idx_players_player_id (player_id),
  KEY idx_players_name (name)
);

CREATE TABLE IF NOT EXISTS stats (
  id VARCHAR(191) PRIMARY KEY,
  player_id BIGINT NULL,
  minutes DECIMAL(10,2) NULL,
  season_role VARCHAR(120) NULL,
  season_grade_overall DECIMAL(5,2) NULL,
  scout_snapshot MEDIUMTEXT NULL,
  source_payload JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_stats_player_id (player_id)
);

CREATE TABLE IF NOT EXISTS matches (
  id VARCHAR(191) PRIMARY KEY,
  match_date VARCHAR(64) NULL,
  round_no INT NULL,
  home_team_id VARCHAR(64) NULL,
  away_team_id VARCHAR(64) NULL,
  home_team VARCHAR(255) NULL,
  away_team VARCHAR(255) NULL,
  score VARCHAR(32) NULL,
  home_goals INT NULL,
  away_goals INT NULL,
  team_stats JSON NULL,
  gps_metrics JSON NULL,
  best_performers JSON NULL,
  players_json JSON NULL,
  source_payload JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_matches_date (match_date),
  KEY idx_matches_home_team_id (home_team_id),
  KEY idx_matches_away_team_id (away_team_id)
);

CREATE TABLE IF NOT EXISTS app_users (
  uid VARCHAR(191) PRIMARY KEY,
  email VARCHAR(255) NULL,
  username VARCHAR(255) NULL,
  full_name VARCHAR(255) NULL,
  role_name VARCHAR(64) NULL,
  team_name VARCHAR(255) NULL,
  verify_user TINYINT(1) NULL,
  player_doc_id VARCHAR(191) NULL,
  player_id BIGINT NULL,
  matched_player_name VARCHAR(255) NULL,
  source_payload JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_app_users_email (email),
  KEY idx_app_users_role (role_name),
  KEY idx_app_users_player_doc_id (player_doc_id)
);
