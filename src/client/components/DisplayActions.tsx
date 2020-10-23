import React, { useState, useEffect } from "react";
import API from '../api';
import { Button } from "@material-ui/core";
import { getGameContextFromUrl } from "../api";
import { GameState } from "../../core/types/GameState";
import { GameContext } from "../../core/types/GameContext";

interface Props {
  gameInfo: GameState | undefined;
}

export const DisplayActions: React.FC<Props> = ({ gameInfo }) => {

  //const [serverResult, setServerResult] = useState<string | null>(null);
  const context: GameContext = getGameContextFromUrl(location.search);


  const onRollDice = async () => {
    API.post("actions/roll", { context })
      .then(function (response) {
        // handle success
        console.log(response);
        //setServerResult(response.data);
      })
      .catch(function (error) {
        // handle error
        console.log(error);
      });
  };

  return (
    <React.Fragment>
      <div className="player-actions">
        <Button variant="contained" color="primary" onClick={onRollDice}>
          Roll dice
        </Button>

      </div>
    </React.Fragment>
  );

};
