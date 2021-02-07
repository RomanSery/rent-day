import React from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import API from '../api';
import { Button, makeStyles, TextField, Typography } from "@material-ui/core";
import { useHistory } from "react-router-dom";
import { handleApiError } from "../helpers";


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
  const { register, handleSubmit } = useForm<Inputs>();


  const onSubmit: SubmitHandler<Inputs> = (data) => {
    API.post("createAccount", { username: data.username, password: data.password, confirmPassword: data.confirmPassword, email: data.email })
      .then(function (response) {
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

      <form onSubmit={handleSubmit(onSubmit)}>

        <TextField label="Email" fullWidth={true} name="email" id="email" required={true}
          inputRef={register({ required: true })} />

        <TextField label="User name" fullWidth={true} name="username" id="username" required={true}
          inputRef={register({ required: true, maxLength: 10, minLength: 4 })} />

        <TextField label="Password" type="password" fullWidth={true} name="password" id="password" required={true}
          inputRef={register({ required: true })} />

        <TextField label="Confirm Password" type="password" fullWidth={true} name="confirmPassword" id="confirmPassword" required={true}
          inputRef={register({ required: true })} />




        <Button variant="contained" className={classes.opt} color="primary" type="submit">Create</Button>
      </form>

    </React.Fragment>
  );
}
