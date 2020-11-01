import React from "react";

import CssBaseline from "@material-ui/core/CssBaseline";
import { GameBoard } from "./components/GameBoard";
import API from './api';
import {
  Switch, Route, withRouter, useHistory, Link
} from "react-router-dom";
import { JoinGame } from "./join/JoinGame";
import { StaticBoard } from "./join/StaticBoard";


export const App: React.FC = () => {

  const history = useHistory();

  const GameDisplay = () => {
    return (
      <React.Fragment>
        <CssBaseline />
        <GameBoard />
      </React.Fragment>
    );
  };


  const Home = () => {
    return (
      <React.Fragment>
        <CssBaseline />
        <StaticBoard>
          <div>
            <h2>Welcome</h2>
            <p>
              <button onClick={CreateGame}>Create test game</button>
              <Link to="/join">Join game</Link>
            </p>
          </div>
        </StaticBoard>
      </React.Fragment>
    );
  };

  const DisplayJoinGame = () => {
    return (
      <React.Fragment>
        <CssBaseline />
        <StaticBoard>
          <JoinGame />
        </StaticBoard>
      </React.Fragment>
    );
  };


  const CreateGame = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();

    API.get("initTestGame")
      .then(function (response) {
        //history.push("/gameinstance?gid=" + response.data.gameId + "&pid=" + response.data.playerId);
        history.push("/join?gid=" + response.data.gameId);
      })
      .catch(function (error) {
        console.log(error);
      });
  };


  return (
    <Switch>
      <Route exact path="/" component={withRouter(Home)} />
      <Route path="/gameinstance" component={GameDisplay} />
      <Route path="/join" component={DisplayJoinGame} />
    </Switch>
  );
}

export default App;
