import React from "react";
import { DisplayPlayers } from "./DisplayPlayers";
import { GameState } from "../../core/types/GameState";
import { DisplayActions } from "./DisplayActions";
import { SocketService } from "../sockets/SocketService";

interface Props {
  gameInfo: GameState | undefined;
  socketService: SocketService;
  getPing: (playerId: string | undefined) => string;
}

export const CenterDisplay: React.FC<Props> = ({ gameInfo, socketService, getPing }) => {

  return (
    <React.Fragment>
      <div className="center-square square">
        <DisplayActions gameInfo={gameInfo} socketService={socketService} />
        <DisplayPlayers gameInfo={gameInfo} getPing={getPing} />

      </div>
    </React.Fragment>
  );

};
