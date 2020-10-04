import React, { useState, useEffect } from "react";
import API from '../api';
import { Button } from "@material-ui/core";

interface Props {

}

export const CenterDisplay: React.FC<Props> = () => {

  const [serverResult, setServerResult] = useState<string | null>(null);


  const onRollDice = async () => {

    API.get("hello")
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
