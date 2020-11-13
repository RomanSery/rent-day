import React from "react";

import CssBaseline from "@material-ui/core/CssBaseline";
import { GameBoard } from "./components/GameBoard";
import API, { hasJoinedGame, StorageConstants } from './api';
import {
  Switch, Route, withRouter, useHistory, Link
} from "react-router-dom";
import { JoinGame } from "./join/JoinGame";
import { StaticBoard } from "./join/StaticBoard";
import { SocketService } from "./sockets/SocketService";


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

    if (hasJoinedGame()) {
      const myGameId = localStorage.getItem(StorageConstants.GAME_ID);
      const myPlayerId = localStorage.getItem(StorageConstants.PLAYER_ID);
      history.push("/join?gid=" + myGameId + "&pid=" + myPlayerId);
    }

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

    const socket = new SocketService();

    return (
      <React.Fragment>
        <CssBaseline />
        <StaticBoard>
          <JoinGame socket={socket} />
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
