import React from "react";
import { GameState } from "../../core/types/GameState";
import { SocketService } from "../sockets/SocketService";

interface Props {
  gameInfo: GameState | undefined;
}

export const PlayerViewer: React.FC<Props> = ({ gameInfo }) => {


  return (
    <React.Fragment>
      <div>
        My info:
     </div>

    </React.Fragment>
  );

};
