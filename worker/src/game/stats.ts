import { Player } from "@core/types/Player";
import { PlayerStats, emptyPlayerStats } from "@core/types/PlayerStats";

/** Add to one of a player's running totals, starting them if the game predates them. */
export const addStat = (player: Player, key: keyof PlayerStats, amount: number): void => {
  if (!player.stats) {
    player.stats = emptyPlayerStats();
  }
  player.stats[key] = Math.round(player.stats[key] + amount);
};
