import React from "react";
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faStar } from "@fortawesome/free-solid-svg-icons";
import { SkillType } from "../../core/enums/SkillType";
import { Player } from "../../core/types/Player";
import { GameEvent } from "../../core/types/GameEvent";
import { GameContext } from "../../core/types/GameContext";
import { areObjectIdsEqual, getGameContextFromLocalStorage } from "../helpers";
import { getSkillDescription } from "../uiHelpers";
import API from "../api";
import { SocketService } from "../sockets/SocketService";
import useGameStateStore from "../stores/gameStateStore";

interface Props {
  socketService: SocketService;
  me: Player;
}

const SKILLS: Array<{ type: SkillType; value: (p: Player) => number }> = [
  { type: SkillType.Negotiation, value: (p) => p.negotiation },
  { type: SkillType.Luck, value: (p) => p.luck },
  { type: SkillType.Corruption, value: (p) => p.corruption },
];

/**
 * "N points to spend" badge for the turn bar, shown only while you have
 * unspent skill points. Opens a small dialog to spend them on your turn.
 */
export const SkillPointsButton: React.FC<Props> = ({ socketService, me }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const gameState = useGameStateStore(state => state.data);
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState<SkillType | null>(null);
  const [justAdded, setJustAdded] = React.useState<SkillType | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const points = me.numAbilityPoints;
  // same rule as the server: only on your turn (auctions and the lotto don't matter)
  const myTurn = !!(gameState?.nextPlayerToAct && areObjectIdsEqual(gameState.nextPlayerToAct, me._id));

  React.useEffect(() => {
    if (points <= 0) {
      setOpen(false);
    }
  }, [points]);

  React.useEffect(() => {
    if (!justAdded) {
      return;
    }
    const t = setTimeout(() => setJustAdded(null), 1500);
    return () => clearTimeout(t);
  }, [justAdded]);

  if (points <= 0) {
    return null;
  }

  const upgradeSkill = (skillType: SkillType) => {
    setPending(skillType);
    setError(null);
    API.post("actions/upgradeSkill", { skillType, context })
      .then(function () {
        setJustAdded(skillType);
        if (socketService && gameState) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameState._id);
        }
      })
      .catch((err) => {
        const msg = err?.response?.data;
        setError(typeof msg === "string" && msg ? msg : "That didn't work. Please try again.");
      })
      .finally(() => setPending(null));
  };

  const close = () => {
    setOpen(false);
    setError(null);
  };

  return (
    <React.Fragment>
      <Button size="small" variant="outlined" color="warning" onClick={() => setOpen(true)}
        startIcon={<FontAwesomeIcon icon={faStar} />} className="skill-points-btn">
        {points} {points === 1 ? "point" : "points"} to spend
      </Button>

      <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
        <DialogTitle>Spend skill points</DialogTitle>
        <DialogContent>
          <div className="skill-points-left">
            <strong>{points}</strong> {points === 1 ? "point" : "points"} left
          </div>

          {!myTurn &&
            <Alert severity="info" sx={{ mb: 1 }}>You can spend points when it's your turn.</Alert>}
          {error &&
            <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>{error}</Alert>}

          {SKILLS.map((s) => (
            <div key={s.type} className="skill-row">
              <div className="skill-row-text">
                <div className="skill-row-name">
                  {s.type} <span className={"skill-row-level" + (justAdded === s.type ? " bumped" : "")}>{s.value(me)}</span>
                </div>
                <div className="skill-row-desc">{getSkillDescription(s.type)}</div>
              </div>
              <Button variant="contained" size="small" disabled={!myTurn || pending !== null}
                onClick={() => upgradeSkill(s.type)} aria-label={"Add a point to " + s.type}
                startIcon={pending === s.type ? <CircularProgress size={14} color="inherit" /> : <FontAwesomeIcon icon={faPlus} />}
                sx={{ minWidth: 64, flex: "none" }}>
                1
              </Button>
            </div>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>Done</Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
};
