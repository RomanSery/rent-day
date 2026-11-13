import React from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faStar } from "@fortawesome/free-solid-svg-icons";
import { SkillType } from "../../core/enums/SkillType";
import { Player } from "../../core/types/Player";
import { GameEvent } from "../../core/types/GameEvent";
import { GameContext } from "../../core/types/GameContext";
import { getGameContextFromLocalStorage, handleApiError } from "../helpers";
import { getSkillDescription } from "../uiHelpers";
import API from "../api";
import { SocketService } from "../sockets/SocketService";
import useGameStateStore from "../stores/gameStateStore";

interface Props {
  socketService: SocketService;
  me: Player;
  myTurn: boolean;
}

const SKILLS: Array<{ type: SkillType; value: (p: Player) => number }> = [
  { type: SkillType.Negotiation, value: (p) => p.negotiation },
  { type: SkillType.Luck, value: (p) => p.luck },
  { type: SkillType.Corruption, value: (p) => p.corruption },
];

/**
 * "N points to spend" badge for the turn bar, shown only while you have
 * unspent skill points. Opens a small dialog to spend them (on your turn).
 */
export const SkillPointsButton: React.FC<Props> = ({ socketService, me, myTurn }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const gameState = useGameStateStore(state => state.data);
  const [open, setOpen] = React.useState(false);

  const points = me.numAbilityPoints;

  React.useEffect(() => {
    if (points <= 0) {
      setOpen(false);
    }
  }, [points]);

  if (points <= 0) {
    return null;
  }

  const upgradeSkill = (skillType: SkillType) => {
    API.post("actions/upgradeSkill", { skillType, context })
      .then(function () {
        if (socketService && gameState) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameState._id);
        }
      })
      .catch(handleApiError);
  };

  return (
    <React.Fragment>
      <Button size="small" variant="outlined" color="warning" onClick={() => setOpen(true)}
        startIcon={<FontAwesomeIcon icon={faStar} />} className="skill-points-btn">
        {points} {points === 1 ? "point" : "points"} to spend
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Spend skill points</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {myTurn ? `${points} left to spend.` : `${points} left. You can spend them on your turn.`}
          </Typography>
          {SKILLS.map((s) => (
            <div key={s.type} className="skill-row">
              <div className="skill-row-text">
                <div className="skill-row-name">{s.type} <span className="skill-row-level">{s.value(me)}</span></div>
                <div className="skill-row-desc">{getSkillDescription(s.type)}</div>
              </div>
              <IconButton color="primary" disabled={!myTurn} onClick={() => upgradeSkill(s.type)}
                aria-label={"Add a point to " + s.type}>
                <FontAwesomeIcon icon={faPlus} />
              </IconButton>
            </div>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
};
