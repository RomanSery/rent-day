import React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBullhorn } from "@fortawesome/free-solid-svg-icons";
import API from "../api";
import { areObjectIdsEqual, getGameContextFromLocalStorage, getIconProp, getMyUserId, handleApiError } from "../helpers";
import { GameEvent } from "../../core/types/GameEvent";
import { Player } from "../../core/types/Player";
import { PlayerState } from "../../core/enums/PlayerState";
import { falseReportFine, reportBaseChance, reportChancePerCorruption, reportMaxChance, reportSuccessChance } from "../../core/constants";
import { SocketService } from "../sockets/SocketService";
import useGameStateStore from "../stores/gameStateStore";

interface Props {
  open: boolean;
  onClose: () => void;
  socketService: SocketService;
}

/**
 * Report a citizen: pick another player to report to the Ministry. Costs one
 * Corruption point; believed, they go to quarantine; not, you pay the fine.
 * The server (ReportProcessor) has the same rules and the final say.
 */
export const ReportCitizenDialog: React.FC<Props> = ({ open, onClose, socketService }) => {
  const gameState = useGameStateStore((state) => state.data);
  const [sending, setSending] = React.useState(false);

  if (!gameState) {
    return null;
  }

  const me = gameState.players.find((p) => areObjectIdsEqual(p._id, getMyUserId()));
  const others = gameState.players.filter((p) => !areObjectIdsEqual(p._id, getMyUserId()) && p.state !== PlayerState.BANKRUPT);
  const chance = me ? reportSuccessChance(me.corruption) : 0;
  const alreadyReported = !!me && me.reportedOnTurn === (gameState.turnNumber ?? 0);
  const noCorruption = !me || me.corruption < 1;

  const onReport = (target: Player) => {
    if (sending) {
      return;
    }
    setSending(true);
    API.post("actions/reportCitizen", { targetId: target._id, context: getGameContextFromLocalStorage() })
      .then(() => {
        socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameState._id);
        onClose();
      })
      .catch(handleApiError)
      .finally(() => setSending(false));
  };

  const whyNot = (p: Player): string | null =>
    p.state === PlayerState.IN_ISOLATION ? "already in quarantine" : null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth className="report-dialog" aria-labelledby="report-dialog-title">
      <DialogTitle id="report-dialog-title">
        <FontAwesomeIcon icon={faBullhorn} /> Report a citizen
      </DialogTitle>
      <DialogContent>
        <p className="report-intro">
          See something, say something. Reporting costs <b>1 Corruption point</b>.
          The Ministry believes you <b>{chance}%</b> of the time
          ({reportBaseChance}%, plus {reportChancePerCorruption}% for each Corruption point you have, up to {reportMaxChance}%).
        </p>
        <ul className="report-terms">
          <li><b>Believed:</b> they go straight to quarantine, and collect no rent while they're there.</li>
          <li><b>Not believed:</b> you pay a <b>${falseReportFine}</b> fine for filing a false report.</li>
        </ul>

        {noCorruption
          ? <p className="report-blocked">You need at least 1 Corruption point to file a report.</p>
          : alreadyReported
            ? <p className="report-blocked">You already filed a report this turn.</p>
            : <div className="report-targets">
                {others.map((p) => {
                  const reason = whyNot(p);
                  return (
                    <Button key={p._id} variant="outlined" disabled={!!reason || sending} onClick={() => onReport(p)}
                      className="report-target" startIcon={<FontAwesomeIcon icon={getIconProp(p.type)} color={p.color} fixedWidth />}>
                      <span className="report-target-name" style={{ color: reason ? undefined : p.color }}>{p.name}</span>
                      {reason && <small className="report-target-why">{reason}</small>}
                    </Button>
                  );
                })}
              </div>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};
