import React, { useState } from "react";


import CssBaseline from "@material-ui/core/CssBaseline";
import { GameBoard } from "./components/GameBoard";
import { GameState } from "../core/types/GameState";
import axios from "axios";
import {
  Switch, Route, withRouter, useHistory
} from "react-router-dom";


export const App: React.FC = () => {

  //get game id from url.  when player joins game, the id will be in the url.  then load game state using id
  //const [initialGameState, setInitialGameState] = useState<GameState>(() => 0);
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
      <div>
        <h2>Home</h2>
        <p>
          <button onClick={CreateGame}>Create test game</button>
        </p>
      </div>
    );
  };


  const CreateGame = () => {

    axios.get("/api/initTestGame")
      .then(function (response) {
        history.push("/gameinstance/" + response.data.gameId);
      })
      .catch(function (error) {
        // handle error
        console.log(error);
      })
      .then(function () {
        // always executed
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
