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

/** seconds per square; long trips speed up so none takes much over MAX_TRIP */
const STEP_SECONDS = 0.45;
const MAX_TRIP_SECONDS = 10;
/** how high a piece lifts between squares, in px */
const HOP_HEIGHT = 12;

/**
 * Keyframes for a piece hopping square by square. `squares` is the server's
 * path (every square passed, the start included); a square repeated in a row
 * is a pause, e.g. the beat on a Chance square before a card moves the piece.
 * Each step has a midpoint keyframe where the piece is lifted and slightly
 * bigger, so it hops rather than slides.
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
  const step = Math.min(STEP_SECONDS, MAX_TRIP_SECONDS / steps);
  const top: number[] = [positions[0].top];
  const left: number[] = [positions[0].left];
  const y: number[] = [0];
  const scale: number[] = [1];
  const times: number[] = [0];
  const yEase: Array<"easeOut" | "easeIn" | "linear"> = [];

  for (let i = 0; i < steps; i++) {
    const from = positions[i];
    const to = positions[i + 1];
    const moves = squares[i] !== squares[i + 1];
    const lift = moves && !reduceMotion;

    // midpoint: halfway there, in the air
    top.push((from.top + to.top) / 2);
    left.push((from.left + to.left) / 2);
    y.push(lift ? -HOP_HEIGHT : 0);
    scale.push(lift ? 1.2 : 1);
    times.push((i + 0.5) / steps);
    yEase.push(lift ? "easeOut" : "linear");

    // landed on the next square
    top.push(to.top);
    left.push(to.left);
    y.push(0);
    scale.push(1);
    times.push((i + 1) / steps);
    yEase.push(lift ? "easeIn" : "linear");
  }

  const duration = steps * step;
  return {
    animate: { top, left, y, scale },
    transition: {
      default: { duration, times, ease: "linear" as const },
      y: { duration, times, ease: yEase },
      scale: { duration, times, ease: yEase },
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
