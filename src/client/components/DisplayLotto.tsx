/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { LottoState } from "../../core/types/LottoState";
import { GameContext } from "../../core/types/GameContext";
import { GameState } from "../../core/types/GameState";
import { areObjectIdsEqual, getGameContextFromLocalStorage, getMyUserId, handleApiError } from "../helpers";
import { SocketService } from "../sockets/SocketService";
import API from '../api';
import { Container } from "@material-ui/core";
import { faDollarSign } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { GameEvent } from "../../core/types/GameEvent";

import { useIsMountedRef } from "./useIsMountedRef";
import { motion } from "framer-motion";
import { AnimatedLottoResult } from "./AnimatedLottoResult";

interface Props {
  gameInfo: GameState | undefined;
  socketService: SocketService;
}

export const DisplayLotto: React.FC<Props> = ({ gameInfo, socketService }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const [lottoState, setLottoState] = useState<LottoState>();
  const isMountedRef = useIsMountedRef();


  useEffect(() => {
    if (!isMountedRef.current) {
      return;
    }
    API.post("getLotto", { lottoId: gameInfo?.lottoId, context })
      .then(function (response) {
        setLottoState(response.data.lotto);
      })
      .catch(handleApiError);
  }, []);

  useEffect(() => {
    if (isMountedRef.current) {
      socketService.listenForEvent(GameEvent.LOTTO_UPDATE, (data: LottoState) => {
        setLottoState(data);
      });
    }
  }, []);



  const getPrizeAmount = (optNum: number): number => {
    if (lottoState) {
      if (optNum === 1) {
        return lottoState.option1Amount;
      }
      if (optNum === 2) {
        return lottoState.option2Amount;
      }
      if (optNum === 3) {
        return lottoState.option3Amount;
      }
    }
    return 0;
  };

  const getPrizeChance = (optNum: number): number => {
    if (lottoState) {
      if (optNum === 1) {
        return lottoState.option1Percent;
      }
      if (optNum === 2) {
        return lottoState.option2Percent;
      }
      if (optNum === 3) {
        return lottoState.option3Percent;
      }
    }
    return 0;
  };

  const isMyLotto = () => {
    if (lottoState) {
      const uid = getMyUserId();
      return areObjectIdsEqual(lottoState.playerId, uid);
    }
    return false;
  }

  const isLottoFinished = () => {
    return lottoState?.optionPicked;
  }


  const onPickOption = async (optNum: number) => {
    if (!isMyLotto()) {
      return;
    }

    API.post("actions/pickLotto", { opt: optNum, context })
      .then(function (response) {
        if (socketService) {
          socketService.socket.emit(GameEvent.LOTTO_UPDATE, context.gameId, lottoState?._id);
        }
      })
      .catch(handleApiError);
  };

  const getNameStyle = (): React.CSSProperties => {
    return { color: lottoState?.playerColor };
  };
  const getOptionClassName = (optNum: number): string => {
    if (lottoState && lottoState.optionPicked) {
      const wasPicked = optNum === lottoState?.optionPicked;
      if (wasPicked) {
        return "lotto-option picked";
      }
    }
    return "lotto-option";
  };


  const getLottoOption = (optNum: number) => {
    if (isMyLotto() && !isLottoFinished()) {
      return (
        <motion.div whileHover={{ scale: 1.3 }} className="loto-option" onClick={() => onPickOption(optNum)}>
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



  const getLottoResults = () => {
    if (lottoState && isLottoFinished()) {
      return (
        <AnimatedLottoResult socketService={socketService} lottoState={lottoState}
          randomNum={lottoState.randomNum} chanceToWin={getPrizeChance(lottoState.optionPicked)} />
      );
    }

    return null;
  };



  return (
    <React.Fragment>
      <Container maxWidth="sm" className="lotto-container">
        <div className="header">
          <div style={getNameStyle()}>{lottoState?.playerName}</div> Pick a lottery ticket for a chance to win the prize
        </div>

        <div className="lotto-options">
          {getLottoOption(1)}
          {getLottoOption(2)}
          {getLottoOption(3)}
        </div>

        {getLottoResults()}

      </Container>

    </React.Fragment>
  );

};
