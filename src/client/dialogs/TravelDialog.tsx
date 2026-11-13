import React from "react";
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import { Alert, CircularProgress } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLocationDot, faTrain } from "@fortawesome/free-solid-svg-icons";
import API from '../api';
import { getGameContextFromLocalStorage, getMyUserId, handleApiError, areObjectIdsEqual, dollarFormatter } from "../helpers";
import { GameContext } from "../../core/types/GameContext";
import { SquareGameData } from "../../core/types/SquareGameData";
import { SquareConfigData } from "../../core/types/SquareConfigData";
import { getSquareTxt } from "../squares/squareHelpers";
import { GameEvent } from "../../core/types/GameEvent";
import { SocketService } from "../sockets/SocketService";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareType } from "../../core/enums/SquareType";
import { muggingAmount, muggingChance } from "../../core/constants";
import useGameStateStore from "../stores/gameStateStore";

interface Props {
  socketService: SocketService;
}

/** the board's train stations, in board order */
const STATION_IDS: number[] = Array.from(SquareConfigDataMap.entries())
  .filter(([, c]: [number, SquareConfigData]) => c.type === SquareType.TrainStation)
  .map(([id]) => id)
  .sort((a, b) => a - b);

/**
 * Subway travel: before rolling, a player standing on one of their stations
 * can ride to any other station they own (unmortgaged). Shows all four
 * stations, with the ones you can't ride to greyed out and the reason why.
 */
export const TravelDialog: React.FC<Props> = ({ socketService }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const gameState = useGameStateStore(state => state.data);
  const travelOpen = useGameStateStore(state => state.travelOpen);
  const setTravelOpen = useGameStateStore(state => state.setTravelOpen);
  const [going, setGoing] = React.useState<number | null>(null);

  const myId = getMyUserId();
  const me = gameState?.players.find((p) => areObjectIdsEqual(p._id, myId));

  const onTravel = (squareId: number) => {
    setGoing(squareId);
    API.post("actions/travel", { context, squareId: squareId })
      .then(function (response) {
        if (socketService && gameState) {
          socketService.socket.emit(GameEvent.STOP_ANIMATE_DICE, gameState._id, response.data.playerId, response.data.diceRoll, response.data.frames);
        }
        setTravelOpen(false);
      })
      .catch(handleApiError)
      .finally(() => setGoing(null));
  };

  const close = () => {
    if (going === null) {
      setTravelOpen(false);
    }
  };

  /** why a station can't be picked, or null when you can ride there */
  const blockedReason = (squareId: number, data: SquareGameData | undefined): string | null => {
    if (!me) {
      return "Not available";
    }
    if (squareId === me.position) {
      return "You are here";
    }
    if (!data?.owner) {
      return "For sale";
    }
    if (!areObjectIdsEqual(data.owner, me._id)) {
      const owner = gameState?.players.find((p) => areObjectIdsEqual(p._id, data.owner));
      return "Owned by " + (owner?.name ?? "another player");
    }
    if (data.isMortgaged) {
      return "Mortgaged";
    }
    return null;
  };

  const fromName = me ? getSquareTxt(gameState, me.position) : "";

  return (
    <Dialog fullWidth={true} maxWidth="sm" onClose={close} aria-labelledby="travel-dialog-title" open={travelOpen}>
      <DialogTitle id="travel-dialog-title" className="travel-title">
        <FontAwesomeIcon icon={faTrain} /> Take the subway
      </DialogTitle>
      <DialogContent>
        <p className="travel-intro">
          Leaving from <strong>{fromName}</strong>. Pick one of your stations; you still roll after you arrive.
        </p>

        <div className="travel-stations">
          {STATION_IDS.map((squareId) => {
            const data = gameState?.squareState.find((s) => s.squareId === squareId);
            const reason = blockedReason(squareId, data);
            const here = me?.position === squareId;
            const ahead = me ? (squareId - me.position + 40) % 40 : 0;

            return (
              <button key={squareId} type="button"
                className={"travel-station" + (reason ? " blocked" : "") + (here ? " here" : "")}
                disabled={!!reason || going !== null}
                onClick={() => onTravel(squareId)}>
                <span className="travel-station-icon">
                  {going === squareId
                    ? <CircularProgress size={18} color="inherit" />
                    : <FontAwesomeIcon icon={here ? faLocationDot : faTrain} />}
                </span>
                <span className="travel-station-text">
                  <span className="travel-station-name">{getSquareTxt(gameState, squareId)}</span>
                  <span className="travel-station-sub">
                    {reason ?? `${ahead} ${ahead === 1 ? "square" : "squares"} ahead`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <Alert severity="warning" sx={{ mt: 2 }}>
          The subway isn't safe: there's a <b>{muggingChance}%</b> chance you get mugged and lose <b>{dollarFormatter.format(muggingAmount)}</b>.
          {me && <> You have {dollarFormatter.format(me.money)}.</>}
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} color="inherit" disabled={going !== null}>Stay here</Button>
      </DialogActions>
    </Dialog>
  );

};
