import { Typography } from "@mui/material";
import React from "react";
import { BackLink } from "./components/BackLink";
import { HelpContent } from "./HelpContent";

export const HelpPageContent: React.FC = () => {

  return (
    <div className="help-page-cont">

      <BackLink to="/dashboard" label="Lobby" />

      <Typography component="h2" variant="h2">How to play</Typography>

      <HelpContent syncHash />

    </div>
  );
}
