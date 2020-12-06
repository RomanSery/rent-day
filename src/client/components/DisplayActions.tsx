import React, { useState, useEffect } from "react";
import API from '../api';
import { Button } from "@material-ui/core";
import { getGameContextFromLocalStorage, leaveCurrentGameIfJoined } from "../helpers";
import { GameState } from "../../core/types/GameState";
import { GameContext } from "../../core/types/GameContext";
import { useHistory } from "react-router-dom";

interface Props {
  gameInfo: GameState | undefined;
  onChangeGameState: (newGameState: GameState) => void;
}

export const DisplayActions: React.FC<Props> = ({ gameInfo, onChangeGameState }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const history = useHistory();

  const onRollDice = async () => {
    API.post("actions/roll", { context })
      .then(function (response) {
        onChangeGameState(response.data.game);
      })
      .catch(function (error) {
        // handle error
        console.log(error);
      });
  };

  const onLeaveGame = async () => {
    leaveCurrentGameIfJoined(() => {
      history.push("/");
    });
  };

  return (
    <React.Fragment>
      <div className="player-actions">
        <Button variant="contained" color="primary" onClick={onRollDice}>
          Roll dice
        </Button>

        <Button variant="contained" color="secondary" onClick={onLeaveGame}>
          Leave Game
        </Button>

      </div>
    </React.Fragment>
  );

};
