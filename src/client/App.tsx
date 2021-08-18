/* eslint-disable react-hooks/exhaustive-deps */
import React from "react";

import CssBaseline from "@material-ui/core/CssBaseline";
import { GameBoard } from "./components/GameBoard";
import { getMyGameId, handleApiError, isLoggedIn, logOut, redirectToHomeIfGameNotFound, setCurrSessionInfo, tryToRedirectToGame } from './helpers';
import {
  Switch, Route, withRouter, useHistory, useLocation, Link
} from "react-router-dom";
import { JoinGame } from "./join/JoinGame";
import { StaticBoard } from "./join/StaticBoard";
import { SocketService } from "./sockets/SocketService";
import { DisplayAllGames } from "./join/DisplayAllGames";
import { DisplayAllPlayers } from "./join/DisplayAllPlayers";
import { PageType } from "../core/enums/PageType";
import { CreateGame } from "./join/CreateGame";
import { Button, Container } from "@material-ui/core";
import { makeStyles } from "@material-ui/styles";
import { SignUpPage } from "./auth/SignUpPage";
import { LoginPage } from "./auth/LoginPage";
import API from "./api";
import queryString from "query-string";
import { HelpPageContent } from "./HelpPageContent";
import { ContactUsPage } from "./ContactUsPage";
import { QueryClient, QueryClientProvider } from "react-query";


export const App: React.FC = () => {

  const history = useHistory();
  const location = useLocation();
  const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development";
  const wsUri = isDev ? "ws://localhost:4000" : "https://rentday.coderdreams.com";


  const getGameId = () => {
    if (location.search) {
      const parsed = queryString.parse(location.search);
      if (parsed && parsed.gid) {
        return parsed.gid as string;
      }
    }
    return getMyGameId();
  };

  React.useEffect(() => {

    if (location && location.pathname === "/help") {
      return;
    }
    if (location && location.pathname === "/newuser") {
      return;
    }
    if (location && location.pathname === "/login") {
      return;
    }
    if (location && location.pathname === "/contact") {
      return;
    }


    API.post("current-session")
      .then(function (response) {
        setCurrSessionInfo(response.data);
        tryToRedirectToGame(PageType.Home, getGameId(), (redirectUrl: string) => {
          if (redirectUrl && redirectUrl.length > 0) {
            history.push(redirectUrl);
          }
        });
      })
      .catch(function (error) {
        // handle error
        logOut();
        history.push("/auth");
      });
  }, []);




  const homeStyles = makeStyles({
    opt: {
      marginTop: 10,
      marginBottom: 10,
    },
  });


  const classes = homeStyles();
  const btnClasses = "MuiButtonBase-root MuiButton-root MuiButton-contained MuiButton-containedPrimary MuiButton-fullWidth dashboard-btn";


  const GameDisplay = () => {

    redirectToHomeIfGameNotFound((redirectUrl: string) => {
      if (redirectUrl && redirectUrl.length > 0) {
        history.push(redirectUrl);
      }
    });

    const socket = new SocketService(PageType.Game, getMyGameId(), wsUri);

    return (
      <React.Fragment>
        <CssBaseline />
        <GameBoard socketService={socket} />
      </React.Fragment>
    );
  };


  const Home = () => {

    if (!isLoggedIn()) {
      history.push("/auth");
    } else {
      history.push("/dashboard");
    }

    return null;
  };


  const DashboardDisplay = () => {

    if (!isLoggedIn()) {
      history.push("/auth");
      return null;
    }

    tryToRedirectToGame(PageType.Home, getGameId(), (redirectUrl: string) => {
      if (redirectUrl && redirectUrl.length > 0) {
        history.push(redirectUrl);
      }
    });

    const onLogout = async () => {

      API.post("logout")
        .then(function (response) {
          logOut();
          history.push("/auth");
        })
        .catch(handleApiError);
    };

    return (
      <React.Fragment>
        <CssBaseline />
        <StaticBoard>          
          
          
          <Container maxWidth="xs" className="home-page-options">                        
            <div>
              <img src="/logo_transparent_small.png" alt="Fat Cats"></img>
            </div>

            <Link to="/create" className={btnClasses} color="primary">CREATE NEW GAME</Link>
            <Link to="/find" className={btnClasses} color="primary">JOIN GAME</Link>
            <Link to="/players" className={btnClasses} color="primary">PLAYERS</Link>
            <Link to="/help" className={btnClasses} color="primary">HELP / RULES</Link>
            <Link to="/contact" className={btnClasses} color="primary">CONTACT US</Link>
            <Button fullWidth variant="contained" className={classes.opt} color="primary" onClick={onLogout}> LOG OUT</Button>
            <div>
              <img src="/fat-cat1.png" alt="Fat Cats"></img>
            </div>
          </Container>          
          
        </StaticBoard>
      </React.Fragment>
    );
  };


  const AuthDisplay = () => {

    if (isLoggedIn()) {
      history.push("/dashboard");
      return null;
    }

    return (
      <React.Fragment>
        <CssBaseline />
        <StaticBoard>
          <Container maxWidth="xs" className="home-page-options">
            <div>
              <img src="/logo_transparent_small.png" alt="Fat Cats"></img>
            </div>

            <Button fullWidth variant="contained" className={classes.opt} color="primary" onClick={() => { history.push("/newuser") }}> CREATE Account</Button>
            <Button fullWidth variant="contained" className={classes.opt} color="primary" onClick={() => { history.push("/login") }}> LOG IN</Button>
            <Button fullWidth variant="contained" className={classes.opt} color="primary" onClick={() => { history.push("/help") }}> HELP / RULES</Button>
            <Button fullWidth variant="contained" className={classes.opt} color="primary" onClick={() => { history.push("/contact") }}> CONTACT US</Button>
            <div>
              <img src="/fat-cat1.png" alt="Fat Cats"></img>
            </div>
          </Container>
        </StaticBoard>
      </React.Fragment>
    );
  };

  const DisplayJoinGamePage = () => {

    const socket = new SocketService(PageType.Join, getGameId(), wsUri);
    const queryClient = new QueryClient();

    return (
      <React.Fragment>
        <CssBaseline />
        <StaticBoard>
          <QueryClientProvider client={queryClient}>                
            <JoinGame socketService={socket} />
          </QueryClientProvider>
        </StaticBoard>
      </React.Fragment>
    );
  };

  const DisplayPlayersPage = () => {

    tryToRedirectToGame(PageType.Find, getGameId(), (redirectUrl: string) => {
      if (redirectUrl && redirectUrl.length > 0) {
        history.push(redirectUrl);
      }
    });

    const queryClient = new QueryClient();

    return (
      <React.Fragment>
        <CssBaseline />
        <StaticBoard>
          <QueryClientProvider client={queryClient}>
            <DisplayAllPlayers />
          </QueryClientProvider>
        </StaticBoard>
      </React.Fragment>
    );
  };


  const FindGamesPage = () => {

    tryToRedirectToGame(PageType.Find, getGameId(), (redirectUrl: string) => {
      if (redirectUrl && redirectUrl.length > 0) {
        history.push(redirectUrl);
      }
    });


    const queryClient = new QueryClient();

    return (
      <React.Fragment>
        <CssBaseline />
        <StaticBoard>
          <QueryClientProvider client={queryClient}>
            <DisplayAllGames />
          </QueryClientProvider>

        </StaticBoard>
      </React.Fragment>
    );
  };

  const CreateGamePage = () => {

    tryToRedirectToGame(PageType.Find, getGameId(), (redirectUrl: string) => {
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

  const HelpPage = () => {

    return (
      <React.Fragment>
        <CssBaseline />
        <StaticBoard>
          <Container maxWidth="lg">
            <HelpPageContent />
          </Container>
        </StaticBoard>
      </React.Fragment>
    );
  };

  const ContactPage = () => {

    return (
      <React.Fragment>
        <CssBaseline />
        <StaticBoard>
          <Container maxWidth="md">
            <ContactUsPage />
          </Container>
        </StaticBoard>
      </React.Fragment>
    );
  };


  return (
    <Switch>
      <Route exact path="/" component={withRouter(Home)} />

      <Route path="/auth" component={AuthDisplay} />
      <Route path="/dashboard" component={DashboardDisplay} />

      <Route path="/gameinstance" component={GameDisplay} />
      <Route path="/join" component={DisplayJoinGamePage} />
      <Route path="/players" component={DisplayPlayersPage} />
      <Route path="/find" component={FindGamesPage} />
      <Route path="/create" component={CreateGamePage} />
      <Route path="/help" component={HelpPage} />
      <Route path="/contact" component={ContactPage} />

      <Route path="/newuser" component={SignUp} />
      <Route path="/login" component={LogIn} />
    </Switch>
  );
}

export default App;
