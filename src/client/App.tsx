import React, { useState } from "react";

import queryString from "query-string";
import CssBaseline from "@material-ui/core/CssBaseline";
import { GameBoard } from "./components/GameBoard";
import { GameState } from "../core/types/GameState";
import API from './api';
import {
  Switch, Route, withRouter, useHistory, useLocation
} from "react-router-dom";


export const App: React.FC = () => {

  const [gameState, setGameState] = useState<GameState | null>(null);
  const history = useHistory();
  const location = useLocation();

  const GameDisplay = () => {

    const parsed = queryString.parse(location.search);
    const gameId = parsed.gid;

    getGameState(gameId);

    return (
      <React.Fragment>
        <CssBaseline />
        <GameBoard />
      </React.Fragment>
    );
  };

  const getGameState = (gameId) => {

    API.post("getGame", { gameId: gameId })
      .then(function (response) {
        setGameState(response.data.game);
      })
      .catch(function (error) {
        console.log(error);
      });
  };


  const Home = () => {
    return (
      <div>
        <h2>Home</h2>
        <p>
          <button onClick={CreateGame}>Create test game</button>
        </p>
      </div>
    );
  };


  const CreateGame = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();

    API.get("initTestGame")
      .then(function (response) {
        history.push("/gameinstance?gid=" + response.data.gameId);
      })
      .catch(function (error) {
        console.log(error);
      });
  };


  return (
    <Switch>
      <Route exact path="/" component={withRouter(Home)} />
      <Route path="/gameinstance" component={GameDisplay} />
    </Switch>
  );
}

export default App;
