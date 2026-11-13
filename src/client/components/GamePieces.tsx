import React from "react";
import { PlayerState } from "../../core/enums/PlayerState";
import { Player } from "../../core/types/Player";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { PiecePosition } from "../../core/types/PiecePosition";
import { getMovementKeyFrames, getNumPlayersOnSquare, getPiecePosition } from "../uiHelpers";
import { motion, useReducedMotion } from "framer-motion";
import { GameEvent } from "../../core/types/GameEvent";
import { getObjectIdAsHexString, getIconProp } from "../helpers";
import { SocketService } from "../sockets/SocketService";
import useGameStateStore from "../stores/gameStateStore";

interface Props {
  socketService: SocketService;
}

/** seconds per square; long walks speed up so none takes much over MAX_TRIP */
const STEP_SECONDS = 0.45;
const MAX_TRIP_SECONDS = 10;
/** how high a piece lifts between neighbouring squares, in px */
const HOP_HEIGHT = 12;
/** a leap between squares that aren't neighbours (a subway ride) */
const JUMP_SECONDS = 1.1;
const JUMP_HEIGHT = 56;

type Ease = "easeOut" | "easeIn" | "linear";

/** next to each other on the board (either direction, wrapping at 40) */
const areNeighbours = (a: number, b: number) => {
  const d = (b - a + 40) % 40;
  return d === 1 || d === 39;
};

/**
 * Keyframes for a piece moving along the server's path (every square passed,
 * the start included). Neighbouring squares are a small hop each; a square
 * repeated in a row is a pause (the beat on a Chance square before a card
 * moves the piece); two squares that aren't neighbours, like the two stations
 * of a subway ride, are one big leap across the board.
 */
const buildHopAnimation = (positions: PiecePosition[], squares: number[], reduceMotion: boolean) => {
  if (positions.length < 2) {
    const p = positions[0];
    return {
      animate: p ? { top: [p.top], left: [p.left] } : {},
      transition: { duration: 0.1 },
    };
  }

  const steps = positions.length - 1;
  const kinds = Array.from({ length: steps }, (_, i) =>
    squares[i] === squares[i + 1] ? "pause" : areNeighbours(squares[i], squares[i + 1]) ? "hop" : "jump");
  const walkSteps = kinds.filter((k) => k !== "jump").length;
  const step = walkSteps > 0 ? Math.min(STEP_SECONDS, MAX_TRIP_SECONDS / walkSteps) : STEP_SECONDS;
  const durations = kinds.map((k) => (k === "jump" ? JUMP_SECONDS : step));
  const total = durations.reduce((a, b) => a + b, 0);

  const top: number[] = [positions[0].top];
  const left: number[] = [positions[0].left];
  const y: number[] = [0];
  const scale: number[] = [1];
  const times: number[] = [0];
  const yEase: Ease[] = [];
  const posEase: Ease[] = [];

  let elapsed = 0;
  for (let i = 0; i < steps; i++) {
    const from = positions[i];
    const to = positions[i + 1];
    const kind = kinds[i];
    const lift = kind !== "pause" && !reduceMotion;
    const height = kind === "jump" ? JUMP_HEIGHT : HOP_HEIGHT;
    const grow = kind === "jump" ? 1.45 : 1.2;

    // midpoint: halfway there, in the air
    top.push((from.top + to.top) / 2);
    left.push((from.left + to.left) / 2);
    y.push(lift ? -height : 0);
    scale.push(lift ? grow : 1);
    times.push((elapsed + durations[i] / 2) / total);
    yEase.push(lift ? "easeOut" : "linear");
    // a leap speeds up and slows down along the way; hops move evenly
    posEase.push(kind === "jump" ? "easeIn" : "linear");

    // landed on the next square
    elapsed += durations[i];
    top.push(to.top);
    left.push(to.left);
    y.push(0);
    scale.push(1);
    times.push(elapsed / total);
    yEase.push(lift ? "easeIn" : "linear");
    posEase.push(kind === "jump" ? "easeOut" : "linear");
  }

  return {
    animate: { top, left, y, scale },
    transition: {
      top: { duration: total, times, ease: posEase },
      left: { duration: total, times, ease: posEase },
      y: { duration: total, times, ease: yEase },
      scale: { duration: total, times, ease: yEase },
    },
  };
};

export const GamePieces: React.FC<Props> = ({ socketService }) => {

  const num_squares: Array<number> = Array.from(Array(40));

  const reduceMotion = useReducedMotion();
  const clearMovement = useGameStateStore(state => state.clearMovement);
  const gameState = useGameStateStore(state => state.data);
  const frames = useGameStateStore(state => state.frames);
  const playerIdToMove = useGameStateStore(state => state.playerIdToMove);


  const getPieceId = (p: Player) => {
    return "player-" + p._id;
  }

  const onFinishPieceMovement = () => {
    clearMovement();

    if (socketService && gameState) {
      socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameState._id);
    }
  }



  const displayGamePieces = () => {
    if (!gameState) {
      return null;
    }
    return (
      <React.Fragment>
        {num_squares.map((n, index) => {
          const id: number = index + 1;
          const numOnSquare = getNumPlayersOnSquare(gameState, id);
          if (numOnSquare > 0) {
            return displayPiecesForSquare(id);
          }
          return null;
        })}
      </React.Fragment>
    );
  }

  const displayPiecesForSquare = (squareId: number) => {
    return (
      gameState!.players.filter((p) => p.state !== PlayerState.BANKRUPT && p.position === squareId).map((p: Player, index) => {
        return getPieceDisplay(squareId, p, index);
      })
    );
  };

  const getPieceDisplay = (squareId: number, p: Player, index: number) => {

    const pos: PiecePosition = getPiecePosition(gameState!, squareId, index);
    const animate = playerIdToMove.length > 0 && playerIdToMove === p._id;

    if (gameState && animate) {

      const hop = buildHopAnimation(getMovementKeyFrames(gameState, frames), frames, !!reduceMotion);

      return (
        <motion.div className="single-piece moving" id={getPieceId(p)} key={getObjectIdAsHexString(p._id)}
          style={{ top: pos.top, left: pos.left }}
          animate={hop.animate}
          transition={hop.transition}
          onAnimationComplete={onFinishPieceMovement}
        >
          <FontAwesomeIcon icon={getIconProp(p.type)} color={p.color} size="2x" />
        </motion.div>);
    }

    return (
      <div className="single-piece" id={getPieceId(p)} key={getObjectIdAsHexString(p._id)}
        style={{ top: pos.top, left: pos.left, bottom: pos.bottom, right: pos.right }}>
        <FontAwesomeIcon icon={getIconProp(p.type)} color={p.color} size="2x" />
      </div>);
  };

  return (
    displayGamePieces()
  );


};
