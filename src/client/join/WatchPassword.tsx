import React, { useState } from "react";
import { Alert, Button, Stack, TextField } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faLock } from "@fortawesome/free-solid-svg-icons";
import API from '../api';
import { BackLink } from "../components/BackLink";

interface Props {
  gameId: string;
  /** called once the server accepts the password */
  onUnlocked: () => void;
}

/**
 * Asked before watching a game that has a password. The server remembers a
 * right answer for this user and game, so they are asked only once.
 */
export const WatchPassword: React.FC<Props> = ({ gameId, onUnlocked }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Enter the game password");
      return;
    }
    setSending(true);
    setError(null);
    API.post("unlockWatch", { gameId, gamePwd: password })
      .then(() => onUnlocked())
      .catch((err) => {
        const data = err?.response?.data;
        setError(typeof data === "string" && data ? data : "Couldn't check the password. Try again.");
        setSending(false);
      });
  };

  return (
    <div className="game-list watch-password">
      <BackLink to="/find?tab=watch" label="Games" />
      <h1><FontAwesomeIcon icon={faLock} className="watch-password-icon" /> This game has a password</h1>
      <p className="gl-sub">Enter it to watch. You'll only be asked once for this game.</p>
      <form onSubmit={onSubmit} noValidate>
        <Stack spacing={1.5} sx={{ maxWidth: 360, mt: 1 }}>
          <TextField size="small" type="password" label="Game password" autoFocus fullWidth
            autoComplete="off" value={password} error={!!error}
            onChange={(e) => { setPassword(e.target.value); setError(null); }} />
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" color="secondary" disabled={sending}
            startIcon={<FontAwesomeIcon icon={faEye} />}>
            {sending ? "Checking…" : "Watch"}
          </Button>
        </Stack>
      </form>
    </div>
  );
};
