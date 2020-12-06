import React from "react";
import { Button, Chip } from "@material-ui/core";
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
    return { borderColor: player.color };
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
            <Chip clickable={false} className="player-chip" color="primary" size="medium" variant={isPlayersTurn() ? "default" : "outlined"}
              icon={<FontAwesomeIcon icon={getIconProp(player.type)} size="2x" color={player.color} />}
              label={player.name} />

            <div className="ping">{getPing(player._id)}</div>
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
