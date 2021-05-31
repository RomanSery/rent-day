import React from "react";
import { motion, Transition } from "framer-motion";
import { SocketService } from "../sockets/SocketService";
import { GameEvent } from "../../core/types/GameEvent";
import useGameStateStore from "../stores/gameStateStore";


interface Props {
  socketService: SocketService;
}

export const CircleLoader: React.FC<Props> = ({ socketService }) => {

  const gameState = useGameStateStore(state => state.data);

  const containerStyle: React.CSSProperties = {
    width: "3rem",
    height: "3rem",
    boxSizing: "border-box",
    margin: "auto"

  };

  const circleStyle: React.CSSProperties = {
    display: "block",
    width: "3rem",
    height: "3rem",
    border: "0.5rem solid black",
    borderTop: "0.5rem solid #3498db",
    borderRadius: "50%",
    boxSizing: "border-box",
  };

  const spinTransition: Transition = {
    loop: 5,
    ease: "linear",
    duration: 1
  };

  const onFinishAnimation = () => {
    if (socketService && gameState) {
      socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameState._id);
    }
  };

  return (
    <div style={containerStyle}>
      <motion.span
        style={circleStyle}
        animate={{ rotate: 360 }}
        transition={spinTransition}
        onAnimationComplete={() => onFinishAnimation()}
      />
    </div>
  );

};
