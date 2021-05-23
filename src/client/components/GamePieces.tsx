import React from "react";
import { PlayerState } from "../../core/enums/PlayerState";
import { Player } from "../../core/types/Player";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { PiecePosition } from "../../core/types/PiecePosition";
import { getMovementKeyFrames, getNumPlayersOnSquare, getPiecePosition } from "../uiHelpers";
import { motion } from "framer-motion";
import { GameEvent } from "../../core/types/GameEvent";
import { getObjectIdAsHexString, getIconProp } from "../helpers";
import { SocketService } from "../sockets/SocketService";
import useGameStateStore from "../gameStateStore";

interface Props {
  socketService: SocketService;
}

export const GamePieces: React.FC<Props> = ({ socketService }) => {

  const num_squares: Array<number> = Array.from(Array(40));

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

      const myFrames = getMovementKeyFrames(gameState, frames);
      const topFrames: Array<number> = myFrames.map((p) => p.top);
      const leftFrames: Array<number> = myFrames.map((p) => p.left);
      const bottomFrames: Array<number> = myFrames.map((p) => p.bottom);
      const rightFrames: Array<number> = myFrames.map((p) => p.right);

      return (
        <motion.div className="single-piece" id={getPieceId(p)} key={getObjectIdAsHexString(p._id)}
          style={{ top: pos.top, left: pos.left, bottom: pos.bottom, right: pos.right }}
          animate={{ top: topFrames, left: leftFrames, bottom: bottomFrames, right: rightFrames }}
          transition={{
            duration: 5, type: "tween", ease: "easeInOut"
          }}
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
