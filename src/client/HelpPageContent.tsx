import { Typography } from "@mui/material";
import React from "react";
import { Link } from "react-router-dom";
import { getHelpContent } from "./uiHelpers";



interface Props {

}

export const HelpPageContent: React.FC<Props> = () => {

  return (
    <div className="help-page-cont">

      <Typography component="h2" variant="h2">Help</Typography>

      <Link to="/dashboard">GO BACK</Link>

      {getHelpContent()}

      <Link to="/dashboard">GO BACK</Link>

    </div>
  );
}
