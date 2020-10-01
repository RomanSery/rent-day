import React, { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@material-ui/core";

interface Props {

}

export const CenterDisplay: React.FC<Props> = () => {

  const [serverResult, setServerResult] = useState<string | null>(null);


  const onRollDice = async () => {

    axios.get("api/hello")
      .then(function (response) {
        // handle success
        console.log(response);
        setServerResult(response.data);
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
    <React.Fragment>
      <div className="center-square square">
        <Button variant="contained" color="primary" onClick={onRollDice}>
          Roll dice
        </Button>

        <p>Server result {serverResult}</p>

      </div>
    </React.Fragment>
  );

};
