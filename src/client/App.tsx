import React from "react";

import CssBaseline from "@material-ui/core/CssBaseline";
import { GameBoard } from "./components/GameBoard";
import API from './api';
import { StorageConstants, tryToRedirectToGame } from './helpers';
import {
  Switch, Route, withRouter, useHistory, Link
} from "react-router-dom";
import { JoinGame } from "./join/JoinGame";
import { StaticBoard } from "./join/StaticBoard";
import { SocketService } from "./sockets/SocketService";
import { DisplayAllGames } from "./join/DisplayAllGames";
import { PageType } from "../core/enums/PageType";


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

    localStorage.setItem("debug", '*');

    tryToRedirectToGame(PageType.Home, (redirectUrl: string) => {
      if (redirectUrl && redirectUrl.length > 0) {
        history.push(redirectUrl);
      }
    });

    return (
      <React.Fragment>
        <CssBaseline />
        <StaticBoard>
          <div>
            <h2>Welcome</h2>
            <p>
              <button onClick={CreateGame}>Create test game</button>
              <Link to="/find">Join game</Link>
            </p>
          </div>
        </StaticBoard>
      </React.Fragment>
    );
  };

  const DisplayJoinGame = () => {

    const socket = new SocketService();
    tryToRedirectToGame(PageType.Join, (redirectUrl: string) => {
      if (redirectUrl && redirectUrl.length > 0) {
        history.push(redirectUrl);
      }
    });


    return (
      <React.Fragment>
        <CssBaseline />
        <StaticBoard>
          <JoinGame socket={socket} />
        </StaticBoard>
      </React.Fragment>
    );
  };


  const FindGames = () => {

    tryToRedirectToGame(PageType.Find, (redirectUrl: string) => {
      if (redirectUrl && redirectUrl.length > 0) {
        history.push(redirectUrl);
      }
    });

    return (
      <React.Fragment>
        <CssBaseline />
        <StaticBoard>
          <DisplayAllGames />
        </StaticBoard>
      </React.Fragment>
    );
  };


  const CreateGame = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();

    API.get("initTestGame")
      .then(function (response) {
        localStorage.setItem(StorageConstants.GAME_ID, response.data.gameId);
        history.push("/join");
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
      <Route path="/find" component={FindGames} />
    </Switch>
  );
}

export default App;
