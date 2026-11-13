import React from "react";
import { areObjectIdsEqual, getMyUserId } from "../helpers";
import useGameStateStore from "../stores/gameStateStore";
import { PlayerViewer } from "./PlayerViewer";
import { SquareViewer } from "./SquareViewer";

/**
 * Keeps a bug in the card from blanking the whole game: React unmounts the
 * entire page when a render throws and nothing above it catches the error.
 * Shows an empty card instead, and tries again when the card's subject changes.
 */
class CardErrorBoundary extends React.Component<{ resetKey: string; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Info card failed to render", error);
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

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
      <CardErrorBoundary resetKey={`${infoFocus}:${squareToView}:${playerToView}`}>
        {showSquare ? <SquareViewer /> : player ? <PlayerViewer player={player} /> : null}
      </CardErrorBoundary>
    </div>
  );
};
