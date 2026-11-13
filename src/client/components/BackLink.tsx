import React from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";

interface Props {
  to: string;
  label: string;
}

/** The way back from a lobby page, shown at the top so it's visible without scrolling. */
export const BackLink: React.FC<Props> = ({ to, label }) => (
  <Link to={to} className="back-link">
    <FontAwesomeIcon icon={faArrowLeft} /> {label}
  </Link>
);
