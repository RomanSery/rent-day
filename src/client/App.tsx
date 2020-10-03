import React, { useState } from "react";


import CssBaseline from "@material-ui/core/CssBaseline";
import { GameBoard } from "./components/GameBoard";
import { GameState } from "../core/types/GameState";
import axios from "axios";
import {
  BrowserRouter, Switch, Route, useHistory
} from "react-router-dom";



function App() {

  //get game id from url.  when player joins game, the id will be in the url.  then load game state using id
  //const [initialGameState, setInitialGameState] = useState<GameState>(() => 0);
  let history = useHistory();


  async function CreateGame() {
    axios.get("/api/initTestGame")
      .then(function (response) {
        // handle success      
        console.log("redirecting");
        history.push("/gameinstance/" + response.data.gameId);
      })
      .catch(function (error) {
        // handle error
        console.log(error);
      })
      .then(function () {
        // always executed
      });
  }

  function GameDisplay() {
    return (
      <React.Fragment>
        <CssBaseline />

        <GameBoard />
      </React.Fragment>
    );
  }

  function Home() {
    return (
      <div>
        <h2>Home</h2>
        <p>
          <button onClick={() => CreateGame()}>Create test game</button>
        </p>
      </div>
    );
  }


  return (
    <BrowserRouter>
      <CssBaseline />

      <Switch>
        <Route exact path="/">
          <Home />
        </Route>
        <Route path="/gameinstance">
          <GameDisplay />
        </Route>
      </Switch>

    </BrowserRouter>
  );
}

export default App;
