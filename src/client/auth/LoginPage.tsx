import React from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import API from '../api';
import { Button, TextField, Typography } from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import { handleApiError, setCurrSessionInfo } from "../helpers";
import _ from "lodash/fp";

interface Props {

}

type Inputs = {
  username: string;
  password: string;
};

export const LoginPage: React.FC<Props> = () => {

  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<Inputs>();

  // react-hook-form 7: wire register() into MUI TextField via inputRef
  const field = (name: keyof Inputs, rules?: Parameters<typeof register>[1]) => {
    const { ref, ...rest } = register(name, rules);
    return { inputRef: ref, ...rest };
  };


  const onSubmit: SubmitHandler<Inputs> = (data) => {
    API.post("logIn", { username: data.username, password: data.password })
      .then(function (response) {
        setCurrSessionInfo(response.data);
        navigate("/dashboard");
      })
      .catch(handleApiError);
  };


  return (
    <React.Fragment>

      <Typography component="h2" variant="h5">Log In</Typography>

      <form onSubmit={handleSubmit(onSubmit)}>

        <TextField label="Email" fullWidth={true} id="username" required={true}
          {...field("username", { required: true })} />
        {_.get("username.type", errors) === "required" && (
          <p className="field-error">Email is required</p>
        )}

        <TextField label="Password" type="password" fullWidth={true} id="password" required={true}
          {...field("password", { required: true })} />
        {_.get("password.type", errors) === "required" && (
          <p className="field-error">Password is required</p>
        )}


        <Button variant="contained" sx={{ my: "15px" }} color="primary" type="submit">Log In</Button>
      </form>

      <br />

      <Link to="/auth">GO BACK</Link>

    </React.Fragment>
  );
}
