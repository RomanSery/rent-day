import { Typography } from "@mui/material";
import React from "react";
import { BackLink } from "./components/BackLink";
import { getHelpContent } from "./uiHelpers";



interface Props {

}

export const HelpPageContent: React.FC<Props> = () => {

  return (
    <div className="help-page-cont">

      <BackLink to="/dashboard" label="Lobby" />

      <Typography component="h2" variant="h2">Help</Typography>

      {getHelpContent()}

    </div>
  );
}
