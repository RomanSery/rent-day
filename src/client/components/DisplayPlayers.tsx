import React from "react";
import { Player } from "../../core/types/Player";
import { DisplayPlayer } from "./DisplayPlayer";
import { getObjectIdAsHexString } from "../helpers";
import useGameStateStore from "../stores/gameStateStore";

/**
 * The list of players with their money. Hovering or tapping one shows them in
 * the info card; leaving goes back to what it showed before. Rendered twice by
 * the game board (beside the controls, and in the middle of the board on
 * portrait phones) with CSS deciding which one is visible.
 */
export const DisplayPlayers: React.FC = () => {

  const gameState = useGameStateStore(state => state.data);
  const setPlayerToView = useGameStateStore(state => state.setPlayerToView);

  const viewPlayer = (player: Player) => {
    setPlayerToView(player._id);
  };

  // the info card goes back to the square (or yourself) it showed before
  const clearPlayer = () => {
    setPlayerToView(undefined);
  };

  return (
    <div className="players-display">
      {gameState?.players.map((p: Player) => {
        return (<DisplayPlayer player={p} key={getObjectIdAsHexString(p._id)} viewPlayer={viewPlayer} clearPlayer={clearPlayer} />)
      })}
    </div>
  );

};
