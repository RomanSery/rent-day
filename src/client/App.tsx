import React from "react";

import GameBoard from "./components/GameBoard";
import CssBaseline from "@material-ui/core/CssBaseline";

function App() {
  return (
    <React.Fragment>
      <CssBaseline />

      <GameBoard />
    </React.Fragment>
  );
}

export default App;
