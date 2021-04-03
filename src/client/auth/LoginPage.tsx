import React from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import API from '../api';
import { Button, makeStyles, TextField, Typography } from "@material-ui/core";
import { Link, useHistory } from "react-router-dom";
import { handleApiError, setCurrSessionInfo } from "../helpers";
import _ from "lodash/fp";

interface Props {

}

type Inputs = {
  username: string;
  password: string;
};

export const LoginPage: React.FC<Props> = () => {

  const history = useHistory();
  const { register, handleSubmit, errors } = useForm<Inputs>();


  const onSubmit: SubmitHandler<Inputs> = (data) => {
    API.post("logIn", { username: data.username, password: data.password })
      .then(function (response) {
        setCurrSessionInfo(response.data);
        history.push("/dashboard");
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

      <Typography component="h2" variant="h5">Log In</Typography>

      <form onSubmit={handleSubmit(onSubmit)}>

        <TextField label="Email" fullWidth={true} name="username" id="username" required={true}
          inputRef={register({ required: true })} />
        {_.get("username.type", errors) === "required" && (
          <p className="field-error">Email is required</p>
        )}

        <TextField label="Password" type="password" fullWidth={true} name="password" id="password" required={true}
          inputRef={register({ required: true })} />
        {_.get("password.type", errors) === "required" && (
          <p className="field-error">Password is required</p>
        )}


        <Button variant="contained" className={classes.opt} color="primary" type="submit">Log In</Button>
      </form>

      <br />

      <Link to="/auth">GO BACK</Link>

    </React.Fragment>
  );
}
