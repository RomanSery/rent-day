import React from "react";
import { useHistory } from "react-router-dom";
import { useForm, SubmitHandler } from "react-hook-form";
import { Button, makeStyles, TextField, Typography } from "@material-ui/core";
import API from '../api';
import { getGameContextFromLocalStorage, handleApiError } from "../helpers";
import { GameContext } from "../../core/types/GameContext";

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
  const { register, handleSubmit } = useForm<Inputs>();


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

        <TextField label="Name" fullWidth={true} name="gameName" required={true}
          inputRef={register({ required: true, maxLength: 30, minLength: 4 })} />

        <TextField label="Num Players" fullWidth={true} type="number" inputProps={{ min: 2, max: 6 }} defaultValue={2} required={true} name="maxPlayers"
          inputRef={register({ required: true, min: 2, max: 6 })} />

        <TextField label="Starting amount" fullWidth={true} name="initialMoney" defaultValue={1500} required={true}
          inputRef={register({ required: true })} />

        <Button variant="contained" className={classes.opt} color="primary" type="submit">Create</Button>
      </form>

    </React.Fragment>
  );
}
