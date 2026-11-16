import React from "react";
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleExclamation, faGavel, faXmark } from "@fortawesome/free-solid-svg-icons";
import { areObjectIdsEqual, getIconProp, getMyUserId, ordinal } from "../helpers";
import { ServerMsg } from "../../core/types/ServerMsg";
import useGameStateStore from "../stores/gameStateStore";

/**
 * A message the server pushes to everyone at the table: an elimination or a
 * subway mugging. Drawn as a card like the Chance card (it reuses the
 * .chance-* styles in index.css; .notice recolours them).
 */
export const ServerMsgDialog: React.FC = () => {

  const serverMsgModalOpen = useGameStateStore(state => state.serverMsgModalOpen);
  const serverMsg = useGameStateStore(state => state.serverMsg);
  const setServerMsgModalOpen = useGameStateStore(state => state.setServerMsgModalOpen);
  const mode = useTheme().palette.mode;

  const close = () => setServerMsgModalOpen(false);

  return (
    <Dialog fullWidth={true} maxWidth="xs" onClose={close} aria-labelledby="server-dialog-title" open={serverMsgModalOpen && !!serverMsg}
      className={`chance-dialog notice ${mode === "dark" ? "dark" : ""}`}>
      {serverMsg &&
        <div className="chance-card bad">
          {serverMsg.bankruptcy ? <BankruptcyNotice msg={serverMsg} /> : <PlainNotice msg={serverMsg} />}
          <div className="chance-card-actions">
            <Button onClick={close} variant="contained" disableElevation={true} className="chance-card-close">Close</Button>
          </div>
        </div>
      }
    </Dialog>
  );
};

const PlainNotice: React.FC<{ msg: ServerMsg }> = ({ msg }) => (
  <React.Fragment>
    <div className="chance-card-band">
      <span className="chance-card-mark" aria-hidden="true"><FontAwesomeIcon icon={faCircleExclamation} /></span>
      <span className="chance-card-kind" id="server-dialog-title">{msg.title}</span>
    </div>
    <div className="chance-card-body">
      <p className="notice-text">{msg.body}</p>
    </div>
  </React.Fragment>
);

const BankruptcyNotice: React.FC<{ msg: ServerMsg }> = ({ msg }) => {
  const gameState = useGameStateStore(state => state.data);
  const { playerId, finishedRank, numPlayers } = msg.bankruptcy!;
  const player = gameState?.players.find((p) => areObjectIdsEqual(p._id, playerId));
  const isMe = areObjectIdsEqual(playerId, getMyUserId());
  const name = player?.name ?? msg.body.replace(/ has (filed for bankruptcy protection|been declared a non-essential business)$/, "");
  const stillIn = Math.max(0, finishedRank - 1);

  return (
    <React.Fragment>
      <div className="chance-card-band">
        <span className="chance-card-mark" aria-hidden="true"><FontAwesomeIcon icon={faGavel} /></span>
        <span className="chance-card-kind">Bankrupt</span>
        <span className="chance-card-tone">Out of the game</span>
      </div>
      <div className="chance-card-body">
        {player &&
          <div className="notice-piece" style={{ color: player.color }} aria-hidden="true">
            <FontAwesomeIcon icon={getIconProp(player.type)} />
            <span className="notice-piece-out"><FontAwesomeIcon icon={faXmark} /></span>
          </div>
        }
        <h2 id="server-dialog-title" className="chance-card-headline">
          {isMe ? "You're out" : <><span style={{ color: player?.color }}>{name}</span> is out</>}
        </h2>
        <p className="chance-card-text">
          {isMe ? "Your business has" : "Their business has"} been declared <b>non-essential</b> and shut down.
          {" "}{isMe ? "You" : "They"} finished <b>{ordinal(finishedRank)}</b> of {numPlayers}.
          {" "}{isMe ? "Your" : "Their"} properties go back to the bank, unowned.
        </p>
        {stillIn > 1 &&
          <p className="notice-still-in">{stillIn} players still in the game</p>
        }
      </div>
    </React.Fragment>
  );
};
