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
import { CreateGame } from "./join/CreateGame";
import { Button, Container, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/styles";


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

    //localStorage.setItem("debug", '*');

    tryToRedirectToGame(PageType.Home, (redirectUrl: string) => {
      if (redirectUrl && redirectUrl.length > 0) {
        history.push(redirectUrl);
      }
    });

    const homeStyles = makeStyles({
      opt: {
        marginTop: 10,
        marginBottom: 10
      },
    });

    const classes = homeStyles();

    return (
      <React.Fragment>
        <CssBaseline />
        <StaticBoard>
          <Container maxWidth="xs" className="home-page-options">
            <Typography component="h2" variant="h5">Rent Day</Typography>

            <Button fullWidth variant="contained" className={classes.opt} color="primary" onClick={() => { history.push("/create") }}> CREATE NEW GAME</Button>
            <Button fullWidth variant="contained" className={classes.opt} color="primary" onClick={() => { history.push("/find") }}> JOIN GAME</Button>

          </Container>
        </StaticBoard>
      </React.Fragment>
    );
  };

  const DisplayJoinGamePage = () => {

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
          <JoinGame socketService={socket} />
        </StaticBoard>
      </React.Fragment>
    );
  };


  const FindGamesPage = () => {

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

  const CreateGamePage = () => {

    tryToRedirectToGame(PageType.Find, (redirectUrl: string) => {
      if (redirectUrl && redirectUrl.length > 0) {
        history.push(redirectUrl);
      }
    });

    return (
      <React.Fragment>
        <CssBaseline />
        <StaticBoard>
          <Container maxWidth="xs" className="player-actions">
            <CreateGame />
          </Container>
        </StaticBoard>
      </React.Fragment>
    );
  };


  return (
    <Switch>
      <Route exact path="/" component={withRouter(Home)} />
      <Route path="/gameinstance" component={GameDisplay} />
      <Route path="/join" component={DisplayJoinGamePage} />
      <Route path="/find" component={FindGamesPage} />
      <Route path="/create" component={CreateGamePage} />
    </Switch>
  );
}

export default App;
