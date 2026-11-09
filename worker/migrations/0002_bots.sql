-- number of computer players in each game, for the lobby list
ALTER TABLE games ADD COLUMN bots INTEGER NOT NULL DEFAULT 0;
