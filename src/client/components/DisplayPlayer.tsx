import React from "react";
import { Button } from "@material-ui/core";
import { GameState } from "../../core/types/GameState";
import { Player } from "../../core/types/Player";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getIconProp, getMyPlayerId } from "../helpers";

interface Props {
  gameInfo: GameState | undefined;
  player: Player;
  getPing: (playerId: string | undefined) => string;
}

export const DisplayPlayer: React.FC<Props> = ({ gameInfo, player, getPing }) => {

  const getColorStyle = (): React.CSSProperties => {
    if (isPlayersTurn()) {
      return { borderColor: player.color };
    }
    return { borderWidth: 0 };
  };

  const isMe = () => {
    return getMyPlayerId() == player._id;
  }

  const isPlayersTurn = () => {
    return player._id == gameInfo?.nextPlayerToAct;
  }

  return (
    <React.Fragment>
      <div className="player-info" style={getColorStyle()}>
        <div className="container">
          <div className="name">
            <FontAwesomeIcon icon={getIconProp(player.type)} size="2x" color={player.color} />
            <div className="ping">{getPing(player._id)}</div>
          </div>
          <div className="name">
            {player.name}
          </div>

          <div className="money">
            ${player.money}
          </div>

          {!isMe() &&
            <div className="actions">
              <Button variant="contained" color="primary" size="small">
                Trade
              </Button>
            </div>
          }

        </div>

      </div>
    </React.Fragment>
  );

};
