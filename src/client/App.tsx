import React from "react";

import CssBaseline from "@material-ui/core/CssBaseline";
import { GameBoard } from "./components/GameBoard";
import API from './api';
import {
  Switch, Route, withRouter, useHistory
} from "react-router-dom";
import { CenterDisplay } from "./components/CenterDisplay";


export const App: React.FC = () => {

  const history = useHistory();

  const GameDisplay = () => {
    return (
      <React.Fragment>
        <CssBaseline />
        <GameBoard>
          <CenterDisplay />
        </GameBoard>
      </React.Fragment>
    );
  };

  /*
  const getGameState = (gameId) => {

    API.post("getGame", { gameId: gameId })
      .then(function (response) {
        setGameState(response.data.game);
      })
      .catch(function (error) {
        console.log(error);
      });
  };
*/

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
        history.push("/gameinstance?gid=" + response.data.gameId + "&pid=" + response.data.playerId);
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
