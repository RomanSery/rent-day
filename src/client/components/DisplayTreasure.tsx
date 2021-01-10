/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { TreasureState } from "../../core/types/TreasureState";
import { GameContext } from "../../core/types/GameContext";
import { GameState } from "../../core/types/GameState";
import { areObjectIdsEqual, getGameContextFromLocalStorage, getMyUserId } from "../helpers";
import { SocketService } from "../sockets/SocketService";
import API from '../api';
import { Container } from "@material-ui/core";
import { faDollarSign } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { GameEvent } from "../../core/types/GameEvent";

import { useIsMountedRef } from "./useIsMountedRef";
import { motion } from "framer-motion";
import { AnimatedTreasureResult } from "./AnimatedTreasureResult";

interface Props {
  gameInfo: GameState | undefined;
  socketService: SocketService;
}

export const DisplayTreasure: React.FC<Props> = ({ gameInfo, socketService }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const [treasureState, setTreasureState] = useState<TreasureState>();
  const isMountedRef = useIsMountedRef();


  useEffect(() => {
    if (!isMountedRef.current) {
      return;
    }
    API.post("getTreasure", { treasureId: gameInfo?.treasureId, context })
      .then(function (response) {
        setTreasureState(response.data.treasure);
      })
      .catch(function (error) {
        console.log(error);
      });
  }, []);

  useEffect(() => {
    if (isMountedRef.current) {
      socketService.listenForEvent(GameEvent.TREASURE_UPDATE, (data: TreasureState) => {
        setTreasureState(data);
      });
    }
  }, []);



  const getPrizeAmount = (optNum: number): number => {
    if (treasureState) {
      if (optNum === 1) {
        return treasureState.option1Amount;
      }
      if (optNum === 2) {
        return treasureState.option2Amount;
      }
      if (optNum === 3) {
        return treasureState.option3Amount;
      }
    }
    return 0;
  };

  const getPrizeChance = (optNum: number): number => {
    if (treasureState) {
      if (optNum === 1) {
        return treasureState.option1Percent;
      }
      if (optNum === 2) {
        return treasureState.option2Percent;
      }
      if (optNum === 3) {
        return treasureState.option3Percent;
      }
    }
    return 0;
  };

  const isMyTreasure = () => {
    if (treasureState) {
      const uid = getMyUserId();
      return areObjectIdsEqual(treasureState.playerId, uid);
    }
    return false;
  }

  const isTreasureFinished = () => {
    return treasureState?.optionPicked;
  }


  const onPickOption = async (optNum: number) => {
    if (!isMyTreasure()) {
      return;
    }

    API.post("actions/pickTreasure", { opt: optNum, context })
      .then(function (response) {
        if (socketService) {
          socketService.socket.emit(GameEvent.TREASURE_UPDATE, context.gameId, treasureState?._id);
        }
      })
      .catch(function (error) {
        if (error.response) {
          alert(error.response.data);
        } else if (error.request) {
          console.log(error.request);
        } else {
          console.log('Error', error.message);
        }
      });
  };

  const getNameStyle = (): React.CSSProperties => {
    return { color: treasureState?.playerColor };
  };
  const getOptionClassName = (optNum: number): string => {
    if (treasureState && treasureState.optionPicked) {
      const wasPicked = optNum === treasureState?.optionPicked;
      if (wasPicked) {
        return "treasure-option picked";
      }
    }
    return "treasure-option";
  };


  const getTreasureOption = (optNum: number) => {
    if (isMyTreasure() && !isTreasureFinished()) {
      return (
        <motion.div whileHover={{ scale: 1.3 }} className="treasure-option" onClick={() => onPickOption(optNum)}>
          <FontAwesomeIcon icon={faDollarSign} size="3x" color="green" />
          <div className="prize-amount">${getPrizeAmount(optNum)}</div>
          <div className="prize-percentage">{getPrizeChance(optNum)}% to win</div>
        </motion.div>
      );
    } else {
      return (
        <div className={getOptionClassName(optNum)}>
          <FontAwesomeIcon icon={faDollarSign} size="3x" color="green" />
          <div className="prize-amount">${getPrizeAmount(optNum)}</div>
          <div className="prize-percentage">{getPrizeChance(optNum)}% to win</div>
        </div>
      );
    }
  };



  const getTreasureResults = () => {
    if (treasureState && isTreasureFinished()) {
      return (
        <AnimatedTreasureResult socketService={socketService} treasureState={treasureState}
          randomNum={treasureState.randomNum} chanceToWin={getPrizeChance(treasureState.optionPicked)} />
      );
    }

    return null;
  };



  return (
    <React.Fragment>
      <Container maxWidth="sm" className="treasure-container">
        <div className="header">
          <div style={getNameStyle()}>{treasureState?.playerName}</div> Pick a lottery ticket for a chance to win the prize
        </div>

        <div className="treasure-options">
          {getTreasureOption(1)}
          {getTreasureOption(2)}
          {getTreasureOption(3)}
        </div>

        {getTreasureResults()}

      </Container>

    </React.Fragment>
  );

};
