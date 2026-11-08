/* eslint-disable react-hooks/exhaustive-deps */
import React from "react";

import CssBaseline from "@mui/material/CssBaseline";
import { GameBoard } from "./components/GameBoard";
import { getMyGameId, handleApiError, isLoggedIn, logOut, redirectToHomeIfGameNotFound, setCurrSessionInfo, tryToRedirectToGame } from './helpers';
import {
  Routes, Route, Navigate, useNavigate, useLocation, Link
} from "react-router-dom";
import { JoinGame } from "./join/JoinGame";
import { StaticBoard } from "./join/StaticBoard";
import { SocketService } from "./sockets/SocketService";
import { DisplayAllGames } from "./join/DisplayAllGames";
import { DisplayAllPlayers } from "./join/DisplayAllPlayers";
import { PageType } from "../core/enums/PageType";
import { CreateGame } from "./join/CreateGame";
import { Button, Container } from "@mui/material";
import { SignUpPage } from "./auth/SignUpPage";
import { LoginPage } from "./auth/LoginPage";
import API from "./api";
import queryString from "query-string";
import { HelpPageContent } from "./HelpPageContent";
import { ContactUsPage } from "./ContactUsPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export const App: React.FC = () => {

  const navigate = useNavigate();
  const location = useLocation();





  const getGameId = () => {
    if (location.search) {
      const parsed = queryString.parse(location.search);
      if (parsed && parsed.gid) {
        return parsed.gid as string;
      }
    }
    return getMyGameId();
  };

  // Pages that read the current game from session storage must wait until
  // the session check has run, otherwise a fresh tab opened straight on
  // /gameinstance asks the API for a game with no id.
  const [sessionChecked, setSessionChecked] = React.useState(false);

  React.useEffect(() => {

    const publicPages = ["/help", "/newuser", "/login", "/contact"];
    if (location && publicPages.includes(location.pathname)) {
      setSessionChecked(true);
      return;
    }

    API.post("current-session")
      .then(function (response) {
        setCurrSessionInfo(response.data);
        tryToRedirectToGame(PageType.Home, getGameId(), (redirectUrl: string) => {
          if (redirectUrl && redirectUrl.length > 0) {
            navigate(redirectUrl);
          }
        });
      })
      .catch(function (error) {
        // handle error
        logOut();
        navigate("/auth");
      })
      .finally(() => {
        setSessionChecked(true);
      });
  }, []);




  const btnClasses = "MuiButtonBase-root MuiButton-root MuiButton-contained MuiButton-containedPrimary MuiButton-fullWidth dashboard-btn";


  const GameDisplay = () => {

    const myGameId = getMyGameId();
    if (!myGameId) {
      // no current game for this session: don't mount the board at all
      return <Navigate to={isLoggedIn() ? "/dashboard" : "/auth"} replace />;
    }

    redirectToHomeIfGameNotFound((redirectUrl: string) => {
      if (redirectUrl && redirectUrl.length > 0) {
        navigate(redirectUrl);
      }
    });

    const socket = new SocketService(PageType.Game, myGameId);

    return (
      <React.Fragment>
        <CssBaseline />
        <GameBoard socketService={socket} />
      </React.Fragment>
    );
  };


  const Home = () => {
    return <Navigate to={isLoggedIn() ? "/dashboard" : "/auth"} replace />;
  };


  const DashboardDisplay = () => {

    if (!isLoggedIn()) {
      navigate("/auth");
      return null;
    }

    tryToRedirectToGame(PageType.Home, getGameId(), (redirectUrl: string) => {
      if (redirectUrl && redirectUrl.length > 0) {
        navigate(redirectUrl);
      }
    });

    const onLogout = async () => {

      API.post("logout")
        .then(function (response) {
          logOut();
          navigate("/auth");
        })
        .catch(handleApiError);
    };

    return (
      <React.Fragment>
        <CssBaseline />
        <StaticBoard>          

          <div className="home-page-cont">
            
            <Container maxWidth="xs" className="home-page-options">
              <div>
                <img src="/logo_transparent_small.png" alt="Fat Cats"></img>
              </div>

              <Link to="/create" className={btnClasses} color="primary">CREATE NEW GAME</Link>
              <Link to="/find" className={btnClasses} color="primary">JOIN GAME</Link>
              <Link to="/players" className={btnClasses} color="primary">PLAYERS</Link>
              <Link to="/help" className={btnClasses} color="primary">HELP / RULES</Link>
              <Link to="/contact" className={btnClasses} color="primary">CONTACT US</Link>

              <Button fullWidth variant="contained" sx={{ my: "10px", backgroundColor: "green" }} color="primary" 
                  onClick={() => {
                      window.location.href = "https://www.coderdreams.com/fatcats/";
                  }}> FORUMS</Button>

              <Button fullWidth variant="contained" sx={{ my: "10px" }} color="primary" onClick={onLogout}> LOG OUT</Button>
              <div className="fat-cat-logo">
                <img src="/fat-cat1.png" alt="Fat Cats"></img>
              </div>
            </Container>
            
            <Container maxWidth="xs" className="home-page-options home-page-left">                
              <p><strong>A new take on a familiar game loved by millions</strong>, play with up to 5 others, buy properties, build houses, manage your finances, and become the fattest cat!</p>
              <hr />
              <p>Choose from <strong>4 player classes</strong> suited to different play styles.  Distribute skill points across 3 abilities to further customize your playstyle. </p>           
              <hr />
              <p>No more lucky dice rolls, you must use your financial witts to bid smartly <strong>in the new silent auction system.</strong> </p>
              <hr />
              <p>Manage your finances carefully, you must now <strong>think about the tax implications of your decisions.</strong></p>
            </Container>
        </div>
                    
        </StaticBoard>
      </React.Fragment>
    );
  };


  const AuthDisplay = () => {

    if (isLoggedIn()) {
      navigate("/dashboard");
      return null;
    }

    return (
      <React.Fragment>
        <CssBaseline />
        <StaticBoard>

          <div className="home-page-cont">
          
              <Container maxWidth="xs" className="home-page-options">
                <div>
                  <img src="/logo_transparent_small.png" alt="Fat Cats"></img>
                </div>

                <Button fullWidth variant="contained" sx={{ my: "10px" }} color="primary" 
                  onClick={() => {
                      navigate("/newuser");
                  }}> CREATE Account</Button>

                <Button fullWidth variant="contained" sx={{ my: "10px" }} color="primary" 
                  onClick={() => {
                      navigate("/login");
                  }}> LOG IN</Button>

                <Button fullWidth variant="contained" sx={{ my: "10px" }} color="primary" 
                  onClick={() => {
                      navigate("/help");
                  }}> HELP / RULES</Button>

                <Button fullWidth variant="contained" sx={{ my: "10px" }} color="primary" 
                  onClick={() => {
                      navigate("/contact");
                  }}> CONTACT US</Button>


                <Button fullWidth variant="contained" sx={{ my: "10px", backgroundColor: "green" }} color="primary" 
                  onClick={() => {
                      window.location.href = "https://www.coderdreams.com/fatcats/";
                  }}> FORUMS</Button>

                <div className="fat-cat-logo">
                  <img src="/fat-cat1.png" alt="Fat Cats"></img>
                </div>
              </Container>
              
              <Container maxWidth="xs" className="home-page-options home-page-left">                
                <p><strong>A new take on a familiar game loved by millions</strong>, play with up to 5 others, buy properties, build houses, manage your finances, and become the fattest cat!</p>
                <hr />
                <p>Choose from <strong>4 player classes</strong> suited to different play styles.  Distribute skill points across 3 abilities to further customize your playstyle. </p>           
                <hr />
                <p>No more lucky dice rolls, you must use your financial witts to bid smartly <strong>in the new silent auction system.</strong> </p>
                <hr />
                <p>Manage your finances carefully, you must now <strong>think about the tax implications of your decisions.</strong></p>
              </Container>
          </div>

        </StaticBoard>
      </React.Fragment>
    );
  };

  const DisplayJoinGamePage = () => {

    const socket = new SocketService(PageType.Join, getGameId());
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
        navigate(redirectUrl);
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
        navigate(redirectUrl);
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
        navigate(redirectUrl);
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


  if (!sessionChecked) {
    return null;
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />

      <Route path="/auth" element={<AuthDisplay />} />
      <Route path="/dashboard" element={<DashboardDisplay />} />

      <Route path="/gameinstance" element={<GameDisplay />} />
      <Route path="/join" element={<DisplayJoinGamePage />} />
      <Route path="/players" element={<DisplayPlayersPage />} />
      <Route path="/find" element={<FindGamesPage />} />
      <Route path="/create" element={<CreateGamePage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/contact" element={<ContactPage />} />

      <Route path="/newuser" element={<SignUp />} />
      <Route path="/login" element={<LogIn />} />
    </Routes>
  );
}

export default App;
