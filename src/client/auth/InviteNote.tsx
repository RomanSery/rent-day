import React from "react";
import { Alert } from "@mui/material";

/** Shown on the sign-in screens to a visitor who followed an invite link. */
export const InviteNote: React.FC = () => (
  <Alert severity="info" sx={{ my: 1.5, textAlign: "left" }}>
    <strong>You've been invited to a game.</strong> Create an account or log in and you'll go straight to it.
  </Alert>
);
