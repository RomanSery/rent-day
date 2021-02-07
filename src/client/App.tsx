import React from "react";

import CssBaseline from "@material-ui/core/CssBaseline";
import { GameBoard } from "./components/GameBoard";
import { handleApiError, isLoggedIn, logOut, redirectToHomeIfGameNotFound, tryToRedirectToGame } from './helpers';
import {
  Switch, Route, withRouter, useHistory
} from "react-router-dom";
import { JoinGame } from "./join/JoinGame";
import { StaticBoard } from "./join/StaticBoard";
import { SocketService } from "./sockets/SocketService";
import { DisplayAllGames } from "./join/DisplayAllGames";
import { DisplayAllPlayers } from "./join/DisplayAllPlayers";
import { PageType } from "../core/enums/PageType";
import { CreateGame } from "./join/CreateGame";
import { Button, Container, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/styles";
import { SignUpPage } from "./auth/SignUpPage";
import { LoginPage } from "./auth/LoginPage";
import API from "./api";

export const App: React.FC = () => {

  const history = useHistory();

  React.useEffect(() => {
    API.post("current-session")
      .then(function (response) {
        console.log(response.data);
      })
      .catch(handleApiError);
  }, []);


  const GameDisplay = () => {

    redirectToHomeIfGameNotFound((redirectUrl: string) => {
      if (redirectUrl && redirectUrl.length > 0) {
        history.push(redirectUrl);
      }
    });

    const socket = new SocketService(PageType.Game);

    return (
      <React.Fragment>
        <CssBaseline />
        <GameBoard socketService={socket} />
      </React.Fragment>
    );
  };


  const Home = () => {


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

    const getLoggedInButtons = () => {
      return (
        <React.Fragment>
          <Button fullWidth variant="contained" className={classes.opt} color="primary" onClick={() => { history.push("/create") }}> CREATE NEW GAME</Button>
          <Button fullWidth variant="contained" className={classes.opt} color="primary" onClick={() => { history.push("/find") }}> JOIN GAME</Button>
          <Button fullWidth variant="contained" className={classes.opt} color="primary" onClick={() => { history.push("/players") }}> PlAYERS</Button>
          <Button fullWidth variant="contained" className={classes.opt} color="primary" onClick={() => { logOut(); history.push("/") }}> LOG OUT</Button>
        </React.Fragment>
      );
    };

    const getLoggedOutButtons = () => {
      return (
        <React.Fragment>
          <Button fullWidth variant="contained" className={classes.opt} color="primary" onClick={() => { history.push("/newuser") }}> CREATE Account</Button>
          <Button fullWidth variant="contained" className={classes.opt} color="primary" onClick={() => { history.push("/login") }}> LOG IN</Button>
        </React.Fragment>
      );
    };

    const classes = homeStyles();

    return (
      <React.Fragment>
        <CssBaseline />
        <StaticBoard>
          <Container maxWidth="xs" className="home-page-options">
            <Typography component="h2" variant="h5">Rent Day</Typography>
            {isLoggedIn() ? getLoggedInButtons() : getLoggedOutButtons()}
          </Container>
        </StaticBoard>
      </React.Fragment>
    );
  };

  const DisplayJoinGamePage = () => {

    const socket = new SocketService(PageType.Join);
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

  const DisplayPlayersPage = () => {

    tryToRedirectToGame(PageType.Find, (redirectUrl: string) => {
      if (redirectUrl && redirectUrl.length > 0) {
        history.push(redirectUrl);
      }
    });

    return (
      <React.Fragment>
        <CssBaseline />
        <StaticBoard>
          <DisplayAllPlayers />
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
          <Container maxWidth="xs">
            <CreateGame />
          </Container>
        </StaticBoard>
      </React.Fragment>
    );
  };

  const SignUp = () => {

    return (
      <React.Fragment>
        <CssBaseline />
        <StaticBoard>
          <Container maxWidth="xs">
            <SignUpPage />
          </Container>
        </StaticBoard>
      </React.Fragment>
    );
  };

  const LogIn = () => {

    return (
      <React.Fragment>
        <CssBaseline />
        <StaticBoard>
          <Container maxWidth="xs">
            <LoginPage />
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
      <Route path="/players" component={DisplayPlayersPage} />
      <Route path="/find" component={FindGamesPage} />
      <Route path="/create" component={CreateGamePage} />

      <Route path="/newuser" component={SignUp} />
      <Route path="/login" component={LogIn} />
    </Switch>
  );
}

export default App;
