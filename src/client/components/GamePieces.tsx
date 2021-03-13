import React from "react";
import { GameState } from "../../core/types/GameState";
import { PlayerState } from "../../core/enums/PlayerState";
import { Player } from "../../core/types/Player";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { PiecePosition } from "../../core/types/PiecePosition";
import { getMovementKeyFrames, getNumPlayersOnSquare, getPiecePosition } from "../uiHelpers";
import { motion } from "framer-motion";
import { GameEvent } from "../../core/types/GameEvent";
import { getObjectIdAsHexString, getIconProp } from "../helpers";
import { SocketService } from "../sockets/SocketService";

interface Props {
  gameInfo: GameState | undefined;
  socketService: SocketService;
  setPlayerIdToMove: (playerId: string) => void;

  getPlayerIdToMove: string;
  frames: Array<number>;
}

export const GamePieces: React.FC<Props> = ({ gameInfo, socketService, setPlayerIdToMove, getPlayerIdToMove, frames }) => {

  const num_squares: Array<number> = Array.from(Array(40));


  const getPieceId = (p: Player) => {
    return "player-" + p._id;
  }

  const onFinishPieceMovement = () => {
    setPlayerIdToMove("");

    if (socketService && gameInfo) {
      socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameInfo._id, true);
    }
  }



  const displayGamePieces = () => {
    if (!gameInfo) {
      return null;
    }
    return (
      <React.Fragment>
        {num_squares.map((n, index) => {
          const id: number = index + 1;
          const numOnSquare = getNumPlayersOnSquare(gameInfo, id);
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
      gameInfo!.players.filter((p) => p.state !== PlayerState.BANKRUPT && p.position === squareId).map((p: Player, index) => {
        return getPieceDisplay(squareId, p, index);
      })
    );
  };

  const getPieceDisplay = (squareId: number, p: Player, index: number) => {

    const pos: PiecePosition = getPiecePosition(gameInfo!, squareId, index);
    const animate = getPlayerIdToMove.length > 0 && getPlayerIdToMove === p._id;

    if (gameInfo && animate) {

      const myFrames = getMovementKeyFrames(gameInfo, frames);
      const topFrames: Array<number> = myFrames.map((p) => p.top);
      const leftFrames: Array<number> = myFrames.map((p) => p.left);
      const bottomFrames: Array<number> = myFrames.map((p) => p.bottom);
      const rightFrames: Array<number> = myFrames.map((p) => p.right);

      return (
        <motion.div className="single-piece" id={getPieceId(p)} key={getObjectIdAsHexString(p._id)}
          style={{ top: pos.top, left: pos.left, bottom: pos.bottom, right: pos.right }}
          animate={{ top: topFrames, left: leftFrames, bottom: bottomFrames, right: rightFrames }}
          transition={{
            duration: 3, repeat: 0, type: "keyframes"
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
