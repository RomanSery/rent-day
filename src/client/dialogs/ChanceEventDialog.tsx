import React, { useEffect, useRef, useState } from "react";
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSmile, faFrownOpen } from "@fortawesome/free-regular-svg-icons";
import API from '../api';
import { areObjectIdsEqual, getGameContextFromLocalStorage, getMyUserId, handleApiError } from "../helpers";
import { GameEvent } from "../../core/types/GameEvent";
import { SocketService } from "../sockets/SocketService";
import useGameStateStore from "../stores/gameStateStore";

interface Props {
  socketService: SocketService;
}

/**
 * The Chance card a player draws on landing on a Chance square (styles:
 * .chance-* in index.css). On a choice card the player who drew it picks an
 * option here and can't dismiss the card until they do; everyone else sees
 * who is choosing.
 */
export const ChanceEventDialog: React.FC<Props> = ({ socketService }) => {

  const chanceOpen = useGameStateStore(state => state.chanceOpen);
  const chanceEvent = useGameStateStore(state => state.chanceEvent);
  const setChanceOpen = useGameStateStore(state => state.setChanceOpen);
  const setChanceEvent = useGameStateStore(state => state.setChanceEvent);
  const gameState = useGameStateStore(state => state.data);
  const mode = useTheme().palette.mode;
  const [choosing, setChoosing] = useState<string | null>(null);

  const myId = getMyUserId();
  const pending = gameState?.pendingChance ?? null;
  const pendingIsMine = !!pending && areObjectIdsEqual(pending.playerId, myId);
  const isChoiceCard = !!chanceEvent?.choices?.length;
  const myChoice = isChoiceCard && pendingIsMine && pending!.chanceId === chanceEvent!.chanceId;
  const chooserName = pending && !pendingIsMine
    ? gameState?.players.find((p) => areObjectIdsEqual(p._id, pending.playerId))?.name
    : undefined;

  // back from a reload with a choice still to make: show the card again
  const checkedOnLoad = useRef(false);
  useEffect(() => {
    if (!gameState || checkedOnLoad.current) {
      return;
    }
    checkedOnLoad.current = true;
    if (pending && pendingIsMine && !chanceOpen) {
      setChanceEvent(pending);
      setChanceOpen(true);
    }
  }, [gameState, pending, pendingIsMine, chanceOpen, setChanceEvent, setChanceOpen]);

  const close = () => {
    if (!myChoice) {
      setChanceOpen(false);
    }
  };

  const choose = (key: string) => {
    setChoosing(key);
    API.post("actions/chanceChoice", { context: getGameContextFromLocalStorage(), choice: key })
      .then(function (response) {
        if (response.data.needToAnimate && socketService && gameState) {
          socketService.socket.emit(GameEvent.STOP_ANIMATE_DICE, gameState._id, response.data.playerId, response.data.diceRoll, response.data.frames);
        }
        setChanceOpen(false);
      })
      .catch(handleApiError)
      .finally(() => setChoosing(null));
  };

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
            {isChoiceCard && !myChoice && chooserName &&
              <p className="chance-card-waiting">Waiting for {chooserName} to choose…</p>
            }
          </div>
          {myChoice ?
            <div className="chance-card-actions chance-card-choices">
              {chanceEvent.choices!.map((option) =>
                <Button key={option.key} onClick={() => choose(option.key)} variant="contained" disableElevation={true}
                  disabled={choosing !== null} className="chance-card-close">
                  {choosing === option.key ? "…" : option.label}
                </Button>
              )}
            </div>
            :
            <div className="chance-card-actions">
              <Button onClick={close} variant="contained" disableElevation={true} className="chance-card-close">Close</Button>
            </div>
          }
        </div>
      }
    </Dialog>
  );

};
