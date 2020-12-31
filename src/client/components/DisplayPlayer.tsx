import React from "react";
import { GameState } from "../../core/types/GameState";
import { Player } from "../../core/types/Player";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getIconProp } from "../helpers";

interface Props {
  gameInfo: GameState | undefined;
  player: Player;
  getPing: (playerId: string | undefined) => string;
  viewPlayer: (player: Player) => void;
  clearPlayer: () => void;
}

export const DisplayPlayer: React.FC<Props> = ({ gameInfo, player, getPing, viewPlayer, clearPlayer }) => {

  const getColorStyle = (): React.CSSProperties => {
    if (isPlayersTurn()) {
      return { borderColor: player.color };
    }
    return { borderWidth: 0 };
  };

  const getNameColorStyle = (): React.CSSProperties => {
    return { color: player.color };
  };

  const isPlayersTurn = () => {
    return player._id === gameInfo?.nextPlayerToAct;
  }


  const setPlayerToView = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (player && player._id) {
      viewPlayer(player);
    }
  };
  const leavePlayer = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    clearPlayer();
  };


  return (
    <React.Fragment>
      <div className="player-info" style={getColorStyle()} onMouseEnter={setPlayerToView} onMouseLeave={leavePlayer}>
        <div className="container">
          <div className="name">
            <FontAwesomeIcon icon={getIconProp(player.type)} size="2x" color={player.color} />
            <div className="ping">{getPing(player._id)}</div>
          </div>
          <div className="sub-name" style={getNameColorStyle()}>
            {player.name}
            <div className="money">
              ${player.money}
            </div>
          </div>


        </div>

      </div>
    </React.Fragment>
  );

};
