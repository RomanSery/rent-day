import React from "react";
import { useHistory } from "react-router-dom";
import { useForm, SubmitHandler } from "react-hook-form";
import { Button, TextField } from "@material-ui/core";
import API from '../api';
import { StorageConstants } from "../helpers";

interface Props {

}

type Inputs = {
  gameName: string;
  maxPlayers: number;
  initialMoney: number;
};

export const CreateGame: React.FC<Props> = () => {

  const history = useHistory();
  const { register, handleSubmit, errors } = useForm<Inputs>();


  const onCreateGame: SubmitHandler<Inputs> = (data) => {
    API.post("createGame", { data })
      .then(function (response) {
        localStorage.setItem(StorageConstants.GAME_ID, response.data.gameId);
        history.push("/join");
      })
      .catch(function (error) {
        console.log(error);
      });
  };

  return (
    <React.Fragment>
      <div className="player-actions">

        <form onSubmit={handleSubmit(onCreateGame)}>

          <TextField label="Name" fullWidth={true} name="gameName" required={true}
            inputRef={register({ required: true, maxLength: 30, minLength: 4 })} />

          <TextField label="Num Players" fullWidth={true} type="number" inputProps={{ min: 2, max: 6 }} defaultValue={3} required={true} name="maxPlayers"
            inputRef={register({ required: true, min: 2, max: 6 })} />

          <TextField label="Starting amount" fullWidth={true} name="initialMoney" defaultValue={1500} required={true}
            inputRef={register({ required: true })} />

          <Button variant="contained" color="primary" type="submit">
            Create
          </Button>
        </form>


      </div>

    </React.Fragment>
  );
}
