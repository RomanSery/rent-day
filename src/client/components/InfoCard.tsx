import React from "react";
import { areObjectIdsEqual, getMyUserId } from "../helpers";
import useGameStateStore from "../stores/gameStateStore";
import { PlayerViewer } from "./PlayerViewer";
import { SquareViewer } from "./SquareViewer";

/**
 * The one info card on the game screen. Shows whatever was pointed at last:
 * a player (hovered or tapped in the player list) or a square on the board,
 * falling back to your own player before anything has been picked.
 */
export const InfoCard: React.FC = () => {

  const gameState = useGameStateStore(state => state.data);
  const infoFocus = useGameStateStore(state => state.infoFocus);
  const squareToView = useGameStateStore(state => state.squareToView);
  const playerToView = useGameStateStore(state => state.playerToView);

  if (!gameState) {
    return null;
  }

  const findPlayer = (id: string | null | undefined) =>
    id ? gameState.players.find((p) => areObjectIdsEqual(p._id, id)) : undefined;

  const focusedPlayer = infoFocus === "player" ? findPlayer(playerToView) : undefined;
  const showSquare = !focusedPlayer && squareToView != null;
  const player = focusedPlayer ?? (showSquare ? undefined : findPlayer(getMyUserId()));

  return (
    <div className="info-card">
      {showSquare ? <SquareViewer /> : player ? <PlayerViewer player={player} /> : null}
    </div>
  );
};
