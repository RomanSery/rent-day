import React from "react";
import { Player } from "../../core/types/Player";
import { DisplayPlayer } from "./DisplayPlayer";
import { getMyUserId, getObjectIdAsHexString } from "../helpers";
import useGameStateStore from "../stores/gameStateStore";

/**
 * The list of players with their money. Hovering or tapping one shows them in
 * the player viewer; leaving goes back to showing yourself. Rendered twice by
 * the game board (beside the controls, and in the middle of the board on
 * portrait phones) with CSS deciding which one is visible.
 */
export const DisplayPlayers: React.FC = () => {

  const gameState = useGameStateStore(state => state.data);
  const setPlayerToView = useGameStateStore(state => state.setPlayerToView);

  const viewPlayer = (player: Player) => {
    setPlayerToView(player._id);
  };

  const clearPlayer = () => {
    setPlayerToView(gameState?.players ? (getMyUserId() ?? undefined) : undefined);
  };

  return (
    <div className="players-display">
      {gameState?.players.map((p: Player) => {
        return (<DisplayPlayer player={p} key={getObjectIdAsHexString(p._id)} viewPlayer={viewPlayer} clearPlayer={clearPlayer} />)
      })}
    </div>
  );

};
