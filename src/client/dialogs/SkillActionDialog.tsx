import React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconDefinition, faHandHoldingHeart, faIdCard, faSackDollar } from "@fortawesome/free-solid-svg-icons";
import API from "../api";
import { areObjectIdsEqual, getGameContextFromLocalStorage, getMyUserId, handleApiError } from "../helpers";
import { GameEvent } from "../../core/types/GameEvent";
import { GameState } from "../../core/types/GameState";
import { Player } from "../../core/types/Player";
import { PlayerState } from "../../core/enums/PlayerState";
import { payToGetOutFee } from "../../core/constants";
import { SocketService } from "../sockets/SocketService";
import useGameStateStore from "../stores/gameStateStore";

/** the actions that use up one skill point (the server's SkillActionProcessor) */
export type SkillAction = "forgeCard" | "hardshipPlea" | "bribeGuard";

interface ActionInfo {
  title: string;
  icon: IconDefinition;
  skill: "Luck" | "Negotiation" | "Corruption";
  points: (p: Player) => number;
  text: React.ReactNode;
  confirm: string;
  /** why not, mirroring the server's rules; null when it can be done */
  whyNot: (game: GameState, p: Player) => string | null;
}

export const SKILL_ACTIONS: Record<SkillAction, ActionInfo> = {
  forgeCard: {
    title: "Forged vaccine card",
    icon: faIdCard,
    skill: "Luck",
    points: (p) => p.luck,
    text: <>
      Get hold of a forged vaccine card and keep it on you. The next time you would go to quarantine
      (landing on Big Brother, rolling three doubles, or being reported) you don't. It also gets you through
      the vaccine passport check for free. Everyone can see you're carrying one.
    </>,
    confirm: "Forge the card",
    whyNot: (game, p) =>
      p.hasForgedCard ? "You already carry a forged vaccine card." : null,
  },
  hardshipPlea: {
    title: "Hardship plea",
    icon: faHandHoldingHeart,
    skill: "Negotiation",
    points: (p) => p.negotiation,
    text: <>Plead hardship with the Ministry: any rent you pay for the rest of this turn is <b>halved</b>.</>,
    confirm: "Plead hardship",
    whyNot: (game, p) =>
      p.hardshipTurn === (game.turnNumber ?? 0) ? "You already pleaded hardship this turn."
        : p.hasRolled ? "Plead hardship before you roll." : null,
  },
  bribeGuard: {
    title: "Bribe the guard",
    icon: faSackDollar,
    skill: "Corruption",
    points: (p) => p.corruption,
    text: <>Slip the guard something and walk out of quarantine now, instead of paying <b>${payToGetOutFee}</b>. Then roll as normal.</>,
    confirm: "Bribe the guard",
    whyNot: (game, p) =>
      p.state !== PlayerState.IN_ISOLATION ? "Only while you are in quarantine."
        : p.hasRolled ? "You already rolled this turn." : null,
  },
};

interface Props {
  action: SkillAction | null;
  onClose: () => void;
  socketService: SocketService;
}

/** Confirms one of the skill-point actions, with what it does and what it costs. */
export const SkillActionDialog: React.FC<Props> = ({ action, onClose, socketService }) => {
  const gameState = useGameStateStore((state) => state.data);
  const [sending, setSending] = React.useState(false);
  // keep showing the last action while the dialog fades out
  const [shown, setShown] = React.useState<SkillAction>("forgeCard");
  React.useEffect(() => {
    if (action) setShown(action);
  }, [action]);

  const me = gameState?.players.find((p) => areObjectIdsEqual(p._id, getMyUserId()));
  if (!gameState || !me) {
    return null;
  }
  const info = SKILL_ACTIONS[shown];
  const reason = info.points(me) < 1
    ? `You need at least 1 ${info.skill} point.`
    : info.whyNot(gameState, me);

  const onConfirm = () => {
    if (sending) {
      return;
    }
    setSending(true);
    API.post("actions/skillAction", { action: shown, context: getGameContextFromLocalStorage() })
      .then(() => {
        socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameState._id);
        onClose();
      })
      .catch(handleApiError)
      .finally(() => setSending(false));
  };

  return (
    <Dialog open={!!action} onClose={onClose} maxWidth="xs" fullWidth className="report-dialog" aria-labelledby="skill-action-title">
      <DialogTitle id="skill-action-title">
        <FontAwesomeIcon icon={info.icon} /> {info.title}
      </DialogTitle>
      <DialogContent>
        <p className="report-intro">{info.text}</p>
        <p>Costs <b>1 {info.skill} point</b> (you have {info.points(me)}).</p>
        {reason && <p className="report-blocked">{reason}</p>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="primary" onClick={onConfirm} disabled={!!reason || sending}>{info.confirm}</Button>
      </DialogActions>
    </Dialog>
  );
};
