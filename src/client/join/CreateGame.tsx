import React from "react";
import { useHistory } from "react-router-dom";
import { useForm, SubmitHandler } from "react-hook-form";
import { Button, makeStyles, TextField, Typography } from "@material-ui/core";
import API from '../api';
import { getGameContextFromLocalStorage, handleApiError } from "../helpers";
import { GameContext } from "../../core/types/GameContext";
import _ from "lodash/fp";

interface Props {

}

type Inputs = {
  gameName: string;
  maxPlayers: number;
  initialMoney: number;
};

export const CreateGame: React.FC<Props> = () => {

  const context: GameContext = getGameContextFromLocalStorage();
  const history = useHistory();
  const { register, handleSubmit, errors } = useForm<Inputs>();


  const onCreateGame: SubmitHandler<Inputs> = (data) => {
    API.post("createGame", { data, context: context })
      .then(function (response) {
        history.push("/join?gid=" + response.data.gameId);
      })
      .catch(handleApiError);
  };

  const createStyles = makeStyles({
    opt: {
      marginTop: 15,
      marginBottom: 15
    },
  });

  const classes = createStyles();

  return (
    <React.Fragment>

      <Typography component="h2" variant="h5">Create Game</Typography>

      <form onSubmit={handleSubmit(onCreateGame)}>

        <TextField label="Name" fullWidth={true} name="gameName" id="gameName" required={true}
          inputRef={register({ required: true, maxLength: 30, minLength: 4 })} />
        {_.get("gameName.type", errors) === "required" && (
          <p className="field-error">Game name is required</p>
        )}
        {_.get("gameName.type", errors) === "maxLength" && (
          <p className="field-error">Game name must be less than 30 characters</p>
        )}
        {_.get("gameName.type", errors) === "minLength" && (
          <p className="field-error">Game name must be at least 4 characters</p>
        )}

        <TextField label="Num Players" fullWidth={true} type="number" inputProps={{ min: 2, max: 6 }} defaultValue={2} required={true} id="maxPlayers" name="maxPlayers"
          inputRef={register({ required: true, min: 2, max: 6 })} />
        {_.get("maxPlayers.type", errors) === "required" && (
          <p className="field-error">Max players is required</p>
        )}
        {_.get("maxPlayers.type", errors) === "min" && (
          <p className="field-error">Max players must be at least 2</p>
        )}
        {_.get("maxPlayers.type", errors) === "max" && (
          <p className="field-error">Max players must be at most 6</p>
        )}

        <TextField label="Starting amount" fullWidth={true} id="initialMoney" name="initialMoney" defaultValue={2000} required={true}
          inputRef={register({ required: true, min: 500, max: 5000 })} />
        {_.get("initialMoney.type", errors) === "required" && (
          <p className="field-error">Starting amount is required</p>
        )}
        {_.get("initialMoney.type", errors) === "min" && (
          <p className="field-error">Starting amount must be at least $500</p>
        )}
        {_.get("initialMoney.type", errors) === "max" && (
          <p className="field-error">Starting amount must be no more than $5000</p>
        )}

        <Button variant="contained" className={classes.opt} color="primary" type="submit">Create</Button>
      </form>

    </React.Fragment>
  );
}
