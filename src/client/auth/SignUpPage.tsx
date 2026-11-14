import React from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import API from '../api';
import { Button, Checkbox, FormControlLabel, TextField, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { BackLink } from "../components/BackLink";
import { handleApiError, hasPendingInvite, setCurrSessionInfo, takeReturnTo } from "../helpers";
import { InviteNote } from "./InviteNote";
import { Turnstile, TurnstileHandle } from "./Turnstile";
import _ from "lodash/fp";


interface Props {

}

type Inputs = {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  remember: boolean;
};

export const SignUpPage: React.FC<Props> = () => {

  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<Inputs>();
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);
  const [captchaMissing, setCaptchaMissing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const turnstile = React.useRef<TurnstileHandle>(null);
  const onTurnstileToken = React.useCallback((token: string | null) => {
    setTurnstileToken(token);
    if (token) {
      setCaptchaMissing(false);
    }
  }, []);

  // react-hook-form 7: wire register() into MUI TextField via inputRef
  const field = (name: keyof Inputs, rules?: Parameters<typeof register>[1]) => {
    const { ref, ...rest } = register(name, rules);
    return { inputRef: ref, ...rest };
  };


  const onSubmit: SubmitHandler<Inputs> = (data) => {
    if (!turnstileToken) {
      setCaptchaMissing(true);
      return;
    }
    setSubmitting(true);
    API.post("createAccount", { username: data.username, password: data.password, confirmPassword: data.confirmPassword, email: data.email, remember: !!data.remember, turnstileToken })
      .then(function (response) {
        setCurrSessionInfo(response.data);
        navigate(takeReturnTo());
      })
      .catch((error) => {
        // the token was spent on this attempt; get a fresh one for the retry
        turnstile.current?.reset();
        handleApiError(error);
      })
      .finally(() => setSubmitting(false));
  };


  return (
    <React.Fragment>

      <BackLink to="/auth" label="Back" />

      {hasPendingInvite() && <InviteNote />}

      <Typography component="h2" variant="h5">Create Account</Typography>
      
      <p>
        <strong>Start playing for free!</strong> - No need to validate your email address
      </p>

      <form onSubmit={handleSubmit(onSubmit)}>

        <TextField label="Email" fullWidth={true} id="email" required={true}
          {...field("email", { required: true })} />
        {_.get("email.type", errors) === "required" && (
          <p className="field-error">Email is required</p>
        )}

        <TextField label="User name" fullWidth={true} id="username" required={true}
          {...field("username", { required: true, maxLength: 10, minLength: 4 })} />
        {_.get("username.type", errors) === "required" && (
          <p className="field-error">User name is required</p>
        )}
        {_.get("username.type", errors) === "maxLength" && (
          <p className="field-error">User name must be 10 or less characters</p>
        )}
        {_.get("username.type", errors) === "minLength" && (
          <p className="field-error">User name must be at least 4 characters</p>
        )}

        <TextField label="Password" type="password" fullWidth={true} id="password" required={true}
          helperText="At least 8 characters"
          {...field("password", { required: true, minLength: 8, maxLength: 128 })} />
        {_.get("password.type", errors) === "required" && (
          <p className="field-error">Password is required</p>
        )}
        {_.get("password.type", errors) === "minLength" && (
          <p className="field-error">Password must be at least 8 characters</p>
        )}
        {_.get("password.type", errors) === "maxLength" && (
          <p className="field-error">Password must be 128 characters or less</p>
        )}

        <TextField label="Confirm Password" type="password" fullWidth={true} id="confirmPassword" required={true}
          {...field("confirmPassword", { required: true })} />
        {_.get("confirmPassword.type", errors) === "required" && (
          <p className="field-error">Password is required</p>
        )}

        <FormControlLabel
          control={<Checkbox {...register("remember")} defaultChecked={false} />}
          label="Remember me"
        />

        <Turnstile ref={turnstile} action="signup" onToken={onTurnstileToken} />
        {captchaMissing && (
          <p className="field-error">Please complete the "verify you are human" check</p>
        )}

        <Button variant="contained" sx={{ my: "15px" }} color="primary" type="submit" disabled={submitting}>Create</Button>
      </form>

    </React.Fragment>
  );
}
