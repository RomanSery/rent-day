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
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
};

export const SignUpPage: React.FC<Props> = () => {

  const history = useHistory();
  const { register, handleSubmit, errors } = useForm<Inputs>();


  const onSubmit: SubmitHandler<Inputs> = (data) => {
    API.post("createAccount", { username: data.username, password: data.password, confirmPassword: data.confirmPassword, email: data.email })
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

      <Typography component="h2" variant="h5">Create Account</Typography>
      
      <p>
        <strong>Start playing for free!</strong> - No need to validate your email address
      </p>

      <form onSubmit={handleSubmit(onSubmit)}>

        <TextField label="Email" fullWidth={true} name="email" id="email" required={true}
          inputRef={register({ required: true })} />
        {_.get("email.type", errors) === "required" && (
          <p className="field-error">Email is required</p>
        )}

        <TextField label="User name" fullWidth={true} name="username" id="username" required={true}
          inputRef={register({ required: true, maxLength: 10, minLength: 4 })} />
        {_.get("username.type", errors) === "required" && (
          <p className="field-error">User name is required</p>
        )}
        {_.get("username.type", errors) === "maxLength" && (
          <p className="field-error">User name must be 10 or less characters</p>
        )}
        {_.get("username.type", errors) === "minLength" && (
          <p className="field-error">User name must be at least 4 characters</p>
        )}

        <TextField label="Password" type="password" fullWidth={true} name="password" id="password" required={true}
          inputRef={register({ required: true })} />
        {_.get("password.type", errors) === "required" && (
          <p className="field-error">Password is required</p>
        )}

        <TextField label="Confirm Password" type="password" fullWidth={true} name="confirmPassword" id="confirmPassword" required={true}
          inputRef={register({ required: true })} />
        {_.get("confirmPassword.type", errors) === "required" && (
          <p className="field-error">Password is required</p>
        )}




        <Button variant="contained" className={classes.opt} color="primary" type="submit">Create</Button>
      </form>

      <br />

      <Link to="/auth">GO BACK</Link>

    </React.Fragment>
  );
}
