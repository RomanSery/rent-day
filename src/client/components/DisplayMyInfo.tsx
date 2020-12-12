import React from "react";
import { GameState } from "../../core/types/GameState";
import { SocketService } from "../sockets/SocketService";

interface Props {
  gameInfo: GameState | undefined;
  socketService: SocketService;
}

export const DisplayMyInfo: React.FC<Props> = ({ gameInfo, socketService }) => {


  return (
    <React.Fragment>
      <div className="my-info">
        My info:
      </div>
    </React.Fragment>
  );

};
