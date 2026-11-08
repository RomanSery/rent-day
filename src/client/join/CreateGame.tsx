import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm, SubmitHandler } from "react-hook-form";
import { Button, Checkbox, FormControlLabel, TextField, Typography } from "@mui/material";
import API from '../api';
import { getGameContextFromLocalStorage, handleApiError } from "../helpers";
import { GameContext } from "../../core/types/GameContext";
import _ from "lodash/fp";
import { defaultStartSkillPoints } from "../../core/constants";

interface Props {

}

type Inputs = {
  gameName: string;
  maxPlayers: number;
  initialMoney: number;
  initialSkillPoints: number;
  gamePwd: string;
  useTimers: boolean;
};

export const CreateGame: React.FC<Props> = () => {

  const context: GameContext = getGameContextFromLocalStorage();
  const navigate = useNavigate();
  const [useTimersVal, setUseTimesVal] = React.useState<boolean>(true);
  const { register, handleSubmit, formState: { errors } } = useForm<Inputs>();

  // react-hook-form 7: wire register() into MUI TextField via inputRef
  const field = (name: keyof Inputs, rules?: Parameters<typeof register>[1]) => {
    const { ref, ...rest } = register(name, rules);
    return { inputRef: ref, ...rest };
  };
  const useTimersField = register("useTimers");


  const onCreateGame: SubmitHandler<Inputs> = (data) => {
    API.post("createGame", { data, context: context })
      .then(function (response) {
        navigate("/join?gid=" + response.data.gameId);
      })
      .catch(handleApiError);
  };

  const handleTimerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUseTimesVal(event.target.checked);
  };

  return (
    <React.Fragment>

      <Typography component="h2" variant="h5">Create Game</Typography>

      <form onSubmit={handleSubmit(onCreateGame)}>

        <TextField label="Name" fullWidth={true} id="gameName" required={true}
          {...field("gameName", { required: true, maxLength: 30, minLength: 4 })} />
        {_.get("gameName.type", errors) === "required" && (
          <p className="field-error">Game name is required</p>
        )}
        {_.get("gameName.type", errors) === "maxLength" && (
          <p className="field-error">Game name must be less than 30 characters</p>
        )}
        {_.get("gameName.type", errors) === "minLength" && (
          <p className="field-error">Game name must be at least 4 characters</p>
        )}

        <TextField label="Num Players" fullWidth={true} type="number" slotProps={{ htmlInput: { min: 2, max: 6 } }} defaultValue={2} required={true} id="maxPlayers"
          {...field("maxPlayers", { required: true, min: 2, max: 6 })} />
        {_.get("maxPlayers.type", errors) === "required" && (
          <p className="field-error">Max players is required</p>
        )}
        {_.get("maxPlayers.type", errors) === "min" && (
          <p className="field-error">Max players must be at least 2</p>
        )}
        {_.get("maxPlayers.type", errors) === "max" && (
          <p className="field-error">Max players must be at most 6</p>
        )}

        <TextField label="Starting amount" fullWidth={true} id="initialMoney" defaultValue={2000} required={true}
          {...field("initialMoney", { required: true, min: 500, max: 5000 })} />
        {_.get("initialMoney.type", errors) === "required" && (
          <p className="field-error">Starting amount is required</p>
        )}
        {_.get("initialMoney.type", errors) === "min" && (
          <p className="field-error">Starting amount must be at least $500</p>
        )}
        {_.get("initialMoney.type", errors) === "max" && (
          <p className="field-error">Starting amount must be no more than $5000</p>
        )}

        <TextField label="Optional password" fullWidth={true} id="gamePwd" {...field("gamePwd", { required: false })} />


        <TextField label="Initial Skill Points" fullWidth={true} type="number" slotProps={{ htmlInput: { min: 0, max: 10 } }} defaultValue={defaultStartSkillPoints} required={true} id="initialSkillPoints"
          {...field("initialSkillPoints", { required: true, min: 2, max: 10 })} />
        {_.get("initialSkillPoints.type", errors) === "required" && (
          <p className="field-error">Initial Skill Points is required</p>
        )}
        {_.get("initialSkillPoints.type", errors) === "min" && (
          <p className="field-error">Initial Skill Points must be at least 0</p>
        )}
        {_.get("initialSkillPoints.type", errors) === "max" && (
          <p className="field-error">Initial Skill Points must be at most 10</p>
        )}


        <FormControlLabel
          control={
            <Checkbox id="useTimers" checked={useTimersVal} name="useTimers" slotProps={{ input: { ref: useTimersField.ref } }} onChange={(e) => { handleTimerChange(e); useTimersField.onChange(e); }} color="primary" />
          }
          label="Use turn timers?"
        />

        <br />

        <Button variant="contained" sx={{ my: "15px" }} color="primary" type="submit">Create</Button>
      </form>

      <br />
      <Link to="/dashboard">GO BACK</Link>

    </React.Fragment>
  );
}
