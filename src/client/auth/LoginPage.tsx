import React from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import API from '../api';
import { Button, makeStyles, TextField, Typography } from "@material-ui/core";
import { useHistory } from "react-router-dom";
import { setAuthToken, setPlayerName } from "../helpers";


interface Props {

}

type Inputs = {
  username: string;
  password: string;
};

export const LoginPage: React.FC<Props> = () => {

  const history = useHistory();
  const { register, handleSubmit } = useForm<Inputs>();


  const onSubmit: SubmitHandler<Inputs> = (data) => {
    API.post("logIn", { username: data.username, password: data.password })
      .then(function (response) {
        setAuthToken(response.data.token);
        setPlayerName(response.data.username);
        history.push("/");
      })
      .catch(function (error) {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          alert(error.response.data);
        } else if (error.request) {
          // The request was made but no response was received
          // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
          // http.ClientRequest in node.js
          console.log(error.request);
        } else {
          // Something happened in setting up the request that triggered an Error
          console.log('Error', error.message);
        }
      });
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

        <TextField label="User name" fullWidth={true} name="username" id="username" required={true}
          inputRef={register({ required: true, maxLength: 10, minLength: 4 })} />

        <TextField label="Password" type="password" fullWidth={true} name="password" id="password" required={true}
          inputRef={register({ required: true })} />


        <Button variant="contained" className={classes.opt} color="primary" type="submit">Log In</Button>
      </form>

    </React.Fragment>
  );
}
