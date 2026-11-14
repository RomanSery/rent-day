import React from "react";
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSmile, faFrownOpen } from "@fortawesome/free-regular-svg-icons";
import useGameStateStore from "../stores/gameStateStore";

interface Props {

}

/** The Chance card a player draws on landing on a Chance square (styles: .chance-* in index.css) */
export const ChanceEventDialog: React.FC<Props> = () => {

  const chanceOpen = useGameStateStore(state => state.chanceOpen);
  const chanceEvent = useGameStateStore(state => state.chanceEvent);
  const setChanceOpen = useGameStateStore(state => state.setChanceOpen);
  const mode = useTheme().palette.mode;

  const close = () => setChanceOpen(false);
  const tone = chanceEvent?.isGood ? "good" : "bad";

  return (
    <Dialog fullWidth={true} maxWidth="xs" onClose={close} aria-labelledby="chance-dialog-title" open={chanceOpen}
      className={`chance-dialog ${mode === "dark" ? "dark" : ""}`}>
      {chanceEvent &&
        // keyed by card so a new draw replays the entrance animation
        <div key={chanceEvent.chanceId} className={`chance-card ${tone}`}>
          <div className="chance-card-band">
            <span className="chance-card-mark" aria-hidden="true">?</span>
            <span className="chance-card-kind">Chance</span>
            <span className="chance-card-tone">{chanceEvent.isGood ? "Good news" : "Bad news"}</span>
          </div>
          <div className="chance-card-body">
            <div className="chance-card-icon" aria-hidden="true">
              <FontAwesomeIcon icon={chanceEvent.isGood ? faSmile : faFrownOpen} />
            </div>
            <h2 id="chance-dialog-title" className="chance-card-headline">{chanceEvent.headline}</h2>
            <p className="chance-card-text" dangerouslySetInnerHTML={{ __html: chanceEvent.subLine }}></p>
          </div>
          <div className="chance-card-actions">
            <Button onClick={close} variant="contained" disableElevation={true} className="chance-card-close">Close</Button>
          </div>
        </div>
      }
    </Dialog>
  );

};
