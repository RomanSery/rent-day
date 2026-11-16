import React from "react";
import { Button, Menu, MenuItem } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretDown } from "@fortawesome/free-solid-svg-icons";
import { areObjectIdsEqual } from "../helpers";
import { Player } from "../../core/types/Player";
import { PlayerState } from "../../core/enums/PlayerState";
import { GameState } from "../../core/types/GameState";
import { SKILL_ACTIONS, SkillAction } from "../dialogs/SkillActionDialog";
import useGameStateStore from "../stores/gameStateStore";

interface Props {
  me: Player;
  onReport: () => void;
  onSkillAction: (action: SkillAction) => void;
}

type Item = {
  key: SkillAction | "report";
  label: string;
  cost: string;
  /** why it can't be used right now; null when it can */
  why: string | null;
};

/**
 * The actions that use up a skill point. All of them are listed on your turn
 * (so players learn they exist), the ones that can't be used right now
 * greyed out with the reason. The server checks the same rules.
 */
const skillItems = (game: GameState, me: Player): Item[] => {
  const turn = game.turnNumber ?? 0;
  const someoneToReport = game.players.some(
    (p) => !areObjectIdsEqual(p._id, me._id) && p.state === PlayerState.ACTIVE
  );
  const report: Item = {
    key: "report",
    label: "Report a citizen",
    cost: "1 Corruption",
    why: me.corruption < 1 ? "Needs 1 Corruption point"
      : me.reportedOnTurn === turn ? "Already filed a report this turn"
        : !someoneToReport ? "No one to report right now" : null,
  };

  const others = (Object.keys(SKILL_ACTIONS) as SkillAction[]).map((action): Item => {
    const info = SKILL_ACTIONS[action];
    return {
      key: action,
      label: info.title,
      cost: "1 " + info.skill,
      why: info.points(me) < 1 ? `Needs 1 ${info.skill} point` : info.whyNot(game, me)?.replace(/\.$/, "") ?? null,
    };
  });
  return [report, ...others];
};

export const SkillActionsMenu: React.FC<Props> = ({ me, onReport, onSkillAction }) => {
  const gameState = useGameStateStore((state) => state.data);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  // only on your turn, with nothing open (auction, Vax Lottery)
  const myTurn = !!gameState && areObjectIdsEqual(me._id, gameState.nextPlayerToAct)
    && !gameState.auctionId && !gameState.lottoId && me.state !== PlayerState.BANKRUPT;
  if (!gameState || !myTurn) {
    return null;
  }
  const items = skillItems(gameState, me);
  const usable = items.filter((i) => !i.why).length;

  const pick = (item: Item) => {
    setAnchorEl(null);
    if (item.key === "report") {
      onReport();
    } else {
      onSkillAction(item.key);
    }
  };

  return (
    <React.Fragment>
      <Button endIcon={<FontAwesomeIcon icon={faCaretDown} />} variant="outlined" color="primary"
        aria-controls="skill-action-menu" aria-haspopup="true" onClick={(e) => setAnchorEl(e.currentTarget)}
        title={usable > 0 ? usable + " skill action" + (usable === 1 ? "" : "s") + " available" : "No skill actions available right now"}>
        Skills{usable > 0 ? ` (${usable})` : ""}
      </Button>
      <Menu id="skill-action-menu" anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {items.map((item) => (
          <MenuItem key={item.key} onClick={() => pick(item)} disabled={!!item.why} className="skill-menu-item">
            <span className="skill-menu-row">
              <span>{item.label}</span>
              <small className="skill-menu-cost">{item.cost}</small>
            </span>
            {item.why && <small className="skill-menu-why">{item.why}</small>}
          </MenuItem>
        ))}
      </Menu>
    </React.Fragment>
  );
};
