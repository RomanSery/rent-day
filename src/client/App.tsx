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

// Route components live at module level so that a navigation re-rendering
// App does not give them a new identity (which would remount them and, for
// the game pages, reopen the WebSocket).

const queryClient = new QueryClient();

/** Dashboard menu entry: a router link drawn as a full-width MUI button. */
const MenuLink: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <Button component={Link} to={to} fullWidth variant="contained" color="primary" sx={{ my: "10px" }}>{children}</Button>
);

/** Game id from the ?gid query parameter, falling back to the stored one. */
const useGameIdFromQuery = (): string | null => {
  const location = useLocation();
  if (location.search) {
    const parsed = queryString.parse(location.search);
    if (parsed && parsed.gid) {
      return parsed.gid as string;
    }
  }
  return getMyGameId();
};

/** Sends the player back into their current game, if they have one. */
const useRedirectToGame = (pageType: PageType): void => {
  const navigate = useNavigate();
  const gameId = useGameIdFromQuery();

  React.useEffect(() => {
    tryToRedirectToGame(pageType, gameId, (redirectUrl: string) => {
      if (redirectUrl && redirectUrl.length > 0) {
        navigate(redirectUrl);
      }
    });
  }, [pageType, gameId, navigate]);
};

const Page: React.FC<{ maxWidth?: "xs" | "sm" | "md" | "lg"; children?: React.ReactNode }> = ({ maxWidth, children }) => (
  <React.Fragment>
    <CssBaseline />
    <StaticBoard>
      {maxWidth ? <Container maxWidth={maxWidth}>{children}</Container> : children}
    </StaticBoard>
  </React.Fragment>
);

const Blurb: React.FC = () => (
  <Container maxWidth="xs" className="home-page-options home-page-left">
    <p><strong>A new take on a familiar game loved by millions</strong>, play with up to 5 others, buy properties, build houses, manage your finances, and become the top baron in town!</p>
    <hr />
    <p>Choose from <strong>4 player classes</strong> suited to different play styles.  Distribute skill points across 3 abilities to further customize your playstyle. </p>
    <hr />
    <p>No more lucky dice rolls, you must use your financial witts to bid smartly <strong>in the new silent auction system.</strong> </p>
    <hr />
    <p>Manage your finances carefully, you must now <strong>think about the tax implications of your decisions.</strong></p>
  </Container>
);

const Home: React.FC = () => {
  return <Navigate to={isLoggedIn() ? "/dashboard" : "/auth"} replace />;
};

const GameDisplay: React.FC = () => {
  const navigate = useNavigate();
  const myGameId = getMyGameId();

  // one socket per game for the lifetime of this page
  const socket = React.useMemo(
    () => (myGameId ? new SocketService(PageType.Game, myGameId) : null),
    [myGameId]
  );

  React.useEffect(() => {
    if (!myGameId) {
      return;
    }
    redirectToHomeIfGameNotFound((redirectUrl: string) => {
      if (redirectUrl && redirectUrl.length > 0) {
        navigate(redirectUrl);
      }
    });
  }, [myGameId, navigate]);

  if (!myGameId || !socket) {
    // no current game for this session: don't mount the board at all
    return <Navigate to={isLoggedIn() ? "/dashboard" : "/auth"} replace />;
  }

  return (
    <React.Fragment>
      <CssBaseline />
      <GameBoard socketService={socket} />
    </React.Fragment>
  );
};

const DashboardDisplay: React.FC = () => {
  const navigate = useNavigate();
  useRedirectToGame(PageType.Home);

  if (!isLoggedIn()) {
    return <Navigate to="/auth" replace />;
  }

  const onLogout = async () => {
    API.post("logout")
      .then(function (response) {
        logOut();
        navigate("/auth");
      })
      .catch(handleApiError);
  };

  return (
    <Page>
      <div className="home-page-cont">

        <Container maxWidth="xs" className="home-page-options">
          <div>
            <img src="/logo_transparent_small.png" alt="Block Barons"></img>
          </div>

          <MenuLink to="/create">CREATE NEW GAME</MenuLink>
          <MenuLink to="/find">JOIN GAME</MenuLink>
          <MenuLink to="/players">PLAYERS</MenuLink>
          <MenuLink to="/help">HELP / RULES</MenuLink>
          <MenuLink to="/contact">CONTACT US</MenuLink>

          <Button fullWidth variant="contained" sx={{ my: "10px" }} color="primary" onClick={onLogout}> LOG OUT</Button>
          <div className="fat-cat-logo">
            <img src="/fat-cat1.png" alt="Block Barons"></img>
          </div>
        </Container>

        <Blurb />
      </div>
    </Page>
  );
};

const AuthDisplay: React.FC = () => {
  const navigate = useNavigate();

  if (isLoggedIn()) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Page>
      <div className="home-page-cont">

        <Container maxWidth="xs" className="home-page-options">
          <div>
            <img src="/logo_transparent_small.png" alt="Block Barons"></img>
          </div>

          <Button fullWidth variant="contained" sx={{ my: "10px" }} color="primary"
            onClick={() => navigate("/newuser")}> CREATE Account</Button>

          <Button fullWidth variant="contained" sx={{ my: "10px" }} color="primary"
            onClick={() => navigate("/login")}> LOG IN</Button>

          <Button fullWidth variant="contained" sx={{ my: "10px" }} color="primary"
            onClick={() => navigate("/help")}> HELP / RULES</Button>

          <Button fullWidth variant="contained" sx={{ my: "10px" }} color="primary"
            onClick={() => navigate("/contact")}> CONTACT US</Button>

          <div className="fat-cat-logo">
            <img src="/fat-cat1.png" alt="Block Barons"></img>
          </div>
        </Container>

        <Blurb />
      </div>
    </Page>
  );
};

const DisplayJoinGamePage: React.FC = () => {
  const gameId = useGameIdFromQuery();
  const socket = React.useMemo(() => new SocketService(PageType.Join, gameId), [gameId]);

  return (
    <Page maxWidth="sm">
      <QueryClientProvider client={queryClient}>
        <JoinGame socketService={socket} />
      </QueryClientProvider>
    </Page>
  );
};

const DisplayPlayersPage: React.FC = () => {
  useRedirectToGame(PageType.Find);

  return (
    <Page>
      <QueryClientProvider client={queryClient}>
        <DisplayAllPlayers />
      </QueryClientProvider>
    </Page>
  );
};

const FindGamesPage: React.FC = () => {
  useRedirectToGame(PageType.Find);

  return (
    <Page>
      <QueryClientProvider client={queryClient}>
        <DisplayAllGames />
      </QueryClientProvider>
    </Page>
  );
};

const CreateGamePage: React.FC = () => {
  useRedirectToGame(PageType.Find);

  return (
    <Page maxWidth="xs">
      <CreateGame />
    </Page>
  );
};

const SignUp: React.FC = () => (
  <Page maxWidth="xs">
    <SignUpPage />
  </Page>
);

const LogIn: React.FC = () => (
  <Page maxWidth="xs">
    <LoginPage />
  </Page>
);

const HelpPage: React.FC = () => (
  <Page maxWidth="lg">
    <HelpPageContent />
  </Page>
);

const ContactPage: React.FC = () => (
  <Page maxWidth="md">
    <ContactUsPage />
  </Page>
);

export const App: React.FC = () => {

  const navigate = useNavigate();
  const location = useLocation();
  const gameIdFromQuery = useGameIdFromQuery();

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
        tryToRedirectToGame(PageType.Home, gameIdFromQuery, (redirectUrl: string) => {
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
    // runs once on load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
