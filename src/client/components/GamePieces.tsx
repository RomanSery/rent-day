import React from "react";
import { PlayerState } from "../../core/enums/PlayerState";
import { Player } from "../../core/types/Player";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { PiecePosition } from "../../core/types/PiecePosition";
import { getMovementKeyFrames, getNumPlayersOnSquare, getPiecePosition } from "../uiHelpers";
import { motion, useReducedMotion } from "framer-motion";
import { movementStepKinds, movementStepSeconds } from "../../core/movementTiming";
import { GameEvent } from "../../core/types/GameEvent";
import { getObjectIdAsHexString, getIconProp } from "../helpers";
import { SocketService } from "../sockets/SocketService";
import useGameStateStore from "../stores/gameStateStore";

interface Props {
  socketService: SocketService;
}

/** how high a piece lifts between neighbouring squares, in px */
const HOP_HEIGHT = 12;
/** how high it arcs on a leap between squares that aren't neighbours (a subway ride) */
const JUMP_HEIGHT = 56;

type Ease = "easeOut" | "easeIn" | "linear";

/**
 * Keyframes for a piece moving along the server's path (every square passed,
 * the start included). Step kinds and timings come from core/movementTiming,
 * which the server also uses to wait for a bot's piece to land: a small hop
 * per neighbouring square, a pause for a repeated square, one big leap
 * between squares that aren't neighbours.
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
  const kinds = movementStepKinds(squares);
  const durations = movementStepSeconds(squares);
  const total = durations.reduce((a, b) => a + b, 0);

  const top: number[] = [positions[0].top];
  const left: number[] = [positions[0].left];
  const y: number[] = [0];
  // each position has its own size (a crowded square shrinks pieces); hops grow on top of that
  const sizeAt = (p: PiecePosition) => p.scale ?? 1;
  const scale: number[] = [sizeAt(positions[0])];
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
    scale.push(((sizeAt(from) + sizeAt(to)) / 2) * (lift ? grow : 1));
    times.push((elapsed + durations[i] / 2) / total);
    yEase.push(lift ? "easeOut" : "linear");
    // a leap speeds up and slows down along the way; hops move evenly
    posEase.push(kind === "jump" ? "easeIn" : "linear");

    // landed on the next square
    elapsed += durations[i];
    top.push(to.top);
    left.push(to.left);
    y.push(0);
    scale.push(sizeAt(to));
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
    const icon = <FontAwesomeIcon icon={getIconProp(p.type)} color={p.color} size="2x" fixedWidth />;

    if (gameState && animate) {
      // land in the spot this piece will have among the players already there
      const dest = frames[frames.length - 1];
      const onDest = gameState.players.filter((pl) =>
        pl.state !== PlayerState.BANKRUPT && (pl._id === p._id || pl.position === dest));
      const end = { index: Math.max(0, onDest.findIndex((pl) => pl._id === p._id)), count: onDest.length };
      const hop = buildHopAnimation(getMovementKeyFrames(frames, pos, end), frames, !!reduceMotion);

      return (
        <motion.div className="single-piece moving" id={getPieceId(p)} key={getObjectIdAsHexString(p._id)}
          style={{ top: pos.top, left: pos.left, scale: pos.scale ?? 1 }}
          animate={hop.animate}
          transition={hop.transition}
          onAnimationComplete={onFinishPieceMovement}
        >
          <span className="piece-icon">{icon}</span>
        </motion.div>);
    }

    // too crowded to show everyone (phones): the first piece carries a count
    if (pos.hidden) {
      return null;
    }

    return (
      <div className="single-piece" id={getPieceId(p)} key={getObjectIdAsHexString(p._id)}
        style={{ top: pos.top, left: pos.left, transform: `scale(${pos.scale ?? 1})` }}>
        <span className="piece-icon">
          {icon}
          {pos.badge && <span className="piece-badge" title={pos.badge + " players on this square"}>×{pos.badge}</span>}
        </span>
      </div>);
  };

  return (
    <React.Fragment>
      {/* same styles as a piece, never shown: its size drives the board layout maths */}
      <div className="single-piece piece-probe" aria-hidden="true" />
      {displayGamePieces()}
    </React.Fragment>
  );


};
