import React from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useForm, SubmitHandler, FieldErrors } from "react-hook-form";
import {
  Button, Divider, FormControlLabel, InputAdornment, Paper, Stack, Switch, TextField, Typography
} from "@mui/material";
import API from '../api';
import { getGameContextFromLocalStorage, handleApiError } from "../helpers";
import { GameContext } from "../../core/types/GameContext";
import { defaultStartSkillPoints } from "../../core/constants";

type Inputs = {
  gameName: string;
  maxPlayers: number;
  initialMoney: number;
  initialSkillPoints: number;
  gamePwd: string;
  useTimers: boolean;
  numBots: number;
  botLevel: string;
};

/** Error message per react-hook-form rule, shown as the field's helper text. */
const messages: Partial<Record<keyof Inputs, Record<string, string>>> = {
  gameName: {
    required: "Game name is required",
    maxLength: "Game name must be 30 characters or less",
    minLength: "Game name must be at least 4 characters",
  },
  maxPlayers: {
    required: "Required",
    min: "At least 2 players",
    max: "At most 6 players",
  },
  initialMoney: {
    required: "Required",
    min: "At least $500",
    max: "No more than $5,000",
  },
  initialSkillPoints: {
    required: "Required",
    min: "At least 0",
    max: "At most 10",
  },
  numBots: {
    min: "Can't be negative",
    max: "At most 5",
    fitsTable: "Leave at least one seat for you",
  },
};

const errorFor = (errors: FieldErrors<Inputs>, name: keyof Inputs): string | undefined => {
  const type = errors[name]?.type;
  return type ? messages[name]?.[String(type)] : undefined;
};

/**
 * Two fields side by side on wider screens, stacked on phones. Flexbox, not
 * CSS grid: the board's `.board div:nth-child(n)` grid placement rules would
 * also reposition the cells of any grid nested inside the board.
 */
const Pair: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ "& > *": { flex: 1 } }}>{children}</Stack>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.5, display: "block", textAlign: "left" }}>
    {children}
  </Typography>
);

export const CreateGame: React.FC = () => {

  const context: GameContext = getGameContextFromLocalStorage();
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Inputs>({
    defaultValues: {
      gameName: "",
      maxPlayers: 2,
      initialMoney: 2000,
      initialSkillPoints: defaultStartSkillPoints,
      gamePwd: "",
      useTimers: true,
      numBots: 0,
      botLevel: "Normal",
    },
  });

  // react-hook-form 7: wire register() into MUI inputs via inputRef
  const field = (name: keyof Inputs, rules?: Parameters<typeof register>[1]) => {
    const { ref, ...rest } = register(name, rules);
    return { inputRef: ref, ...rest };
  };

  const hasBots = Number(watch("numBots")) > 0;

  const onCreateGame: SubmitHandler<Inputs> = (data) =>
    API.post("createGame", { data, context: context })
      .then(function (response) {
        navigate("/join?gid=" + response.data.gameId);
      })
      .catch(handleApiError);

  return (
    <Paper elevation={2} sx={{ my: 1, p: { xs: 1.5, sm: 2.5 }, textAlign: "left" }}>
      <Typography component="h2" variant="h5" sx={{ textAlign: "center", mb: 1 }}>Create Game</Typography>

      <form onSubmit={handleSubmit(onCreateGame)} noValidate>
        <Stack spacing={1.5}>

          <SectionTitle>Game</SectionTitle>
          <TextField size="small" label="Game name" fullWidth required autoFocus id="gameName"
            error={!!errors.gameName} helperText={errorFor(errors, "gameName")}
            {...field("gameName", { required: true, maxLength: 30, minLength: 4 })} />
          <TextField size="small" label="Password" fullWidth id="gamePwd"
            helperText="Optional. Players need it to join."
            {...field("gamePwd", { required: false })} />

          <Divider />
          <SectionTitle>Players</SectionTitle>
          <Pair>
            <TextField size="small" label="Seats" type="number" fullWidth required id="maxPlayers"
              slotProps={{ htmlInput: { min: 2, max: 6 } }}
              error={!!errors.maxPlayers} helperText={errorFor(errors, "maxPlayers") ?? "2 to 6"}
              {...field("maxPlayers", { required: true, min: 2, max: 6 })} />
            <TextField size="small" label="Computer players" type="number" fullWidth id="numBots"
              slotProps={{ htmlInput: { min: 0, max: 5 } }}
              error={!!errors.numBots} helperText={errorFor(errors, "numBots") ?? "Fill the empty seats"}
              {...field("numBots", {
                min: 0, max: 5,
                validate: { fitsTable: (v, all) => Number(v) <= Number(all.maxPlayers) - 1 },
              })} />
          </Pair>
          <TextField size="small" select label="Computer skill" fullWidth id="botLevel" disabled={!hasBots}
            slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
            helperText={hasBots ? "The game starts as soon as the humans have joined" : "Add computer players to choose"}
            {...field("botLevel")}>
            <option value="Normal">Normal</option>
            <option value="Easy">Easy</option>
          </TextField>

          <Divider />
          <SectionTitle>Rules</SectionTitle>
          <Pair>
            <TextField size="small" label="Starting money" fullWidth required id="initialMoney" type="number"
              slotProps={{
                htmlInput: { min: 500, max: 5000, step: 100 },
                input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
              }}
              error={!!errors.initialMoney} helperText={errorFor(errors, "initialMoney") ?? "$500 to $5,000"}
              {...field("initialMoney", { required: true, min: 500, max: 5000 })} />
            <TextField size="small" label="Skill points" type="number" fullWidth required id="initialSkillPoints"
              slotProps={{ htmlInput: { min: 0, max: 10 } }}
              error={!!errors.initialSkillPoints} helperText={errorFor(errors, "initialSkillPoints") ?? "Per player, 0 to 10"}
              {...field("initialSkillPoints", { required: true, min: 0, max: 10 })} />
          </Pair>
          <FormControlLabel
            control={<Switch defaultChecked color="primary" id="useTimers" {...field("useTimers")} />}
            label="Turn timers"
          />

          <Button variant="contained" color="primary" type="submit" fullWidth disabled={isSubmitting}>
            Create game
          </Button>
          <Button component={RouterLink} to="/dashboard" fullWidth>Back</Button>
        </Stack>
      </form>
    </Paper>
  );
}
