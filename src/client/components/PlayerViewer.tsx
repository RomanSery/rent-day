import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import React from "react";
import { GameState } from "../../core/types/GameState";
import { Player } from "../../core/types/Player";
import { SkillType } from "../../core/enums/SkillType";
import { PlayerClass } from "../../core/enums/PlayerClass";
import { areObjectIdsEqual, dollarFormatter, getGameContextFromLocalStorage, getMyUserId, handleApiError } from '../helpers';
import { faPlusSquare } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { GameContext } from '../../core/types/GameContext';
import API from '../api';
import { SocketService } from '../sockets/SocketService';
import { GameEvent } from '../../core/types/GameEvent';
import { getElectricityTooltip, getSkillTypeTooltip, getTaxTooltip, getTotalAssetsTooltip } from '../uiHelpers';


interface Props {
  gameInfo: GameState | undefined;
  socketService: SocketService;
  getPlayer: () => Player | undefined;
}

export const PlayerViewer: React.FC<Props> = ({ gameInfo, getPlayer, socketService }) => {

  const context: GameContext = getGameContextFromLocalStorage();

  const getPlayerName = () => {
    const p = getPlayer();
    if (p) {
      return p.name + " - " + PlayerClass[p.playerClass];
    }
    return "";
  }

  const getColorStyle = (): React.CSSProperties => {
    const p = getPlayer();
    if (p) {
      return { backgroundColor: p.color };
    }
    return {};
  };

  const getPlayerMoney = () => {
    const p = getPlayer();
    if (p) {
      return dollarFormatter.format(p.money);
    }
    return "";
  }

  const getPlayerTotalAssets = () => {
    const p = getPlayer();
    if (p) {
      return dollarFormatter.format(p.totalAssets);
    }
    return "";
  }

  const getPlayerPointsAvailable = () => {
    const p = getPlayer();
    if (p) {
      return p.numAbilityPoints;
    }
    return "";
  }

  const getPlayerTaxes = () => {
    const p = getPlayer();
    if (p) {
      return dollarFormatter.format(p.taxesPerTurn);
    }
    return "";
  }

  const getPlayerElectricityCosts = () => {
    const p = getPlayer();
    if (p) {
      return dollarFormatter.format(p.electricityCostsPerTurn);
    }
    return "";
  }

  const getSkill = (skillType: SkillType) => {
    const p = getPlayer();
    if (p) {
      if (skillType === SkillType.Negotiation) {
        return p.negotiation;
      } else if (skillType === SkillType.Luck) {
        return p.luck;
      } else if (skillType === SkillType.Corruption) {
        return p.corruption;
      }
    }
    return 0;
  }

  const isMyTurn = () => {
    const uid = getMyUserId();
    return uid && gameInfo && gameInfo.nextPlayerToAct && areObjectIdsEqual(uid, gameInfo.nextPlayerToAct) && gameInfo.auctionId == null;
  }

  const upgradeSkill = async (skillType: SkillType) => {
    API.post("actions/upgradeSkill", { skillType: skillType, context })
      .then(function (response) {
        if (socketService && gameInfo) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameInfo._id);
        }
      })
      .catch(handleApiError);
  };

  const canUpgradeSkill = () => {
    const p = getPlayer();
    return p && areObjectIdsEqual(p._id, getMyUserId()) && p.numAbilityPoints > 0 && isMyTurn() ? true : false;
  }


  return (
    <React.Fragment>
      <div className="player-name" style={getColorStyle()}>{getPlayerName()}</div>
      <div className="info-tables">
        <TableContainer component={Paper} className="rent-info">
          <Table size="small" aria-label="a dense table">
            <TableBody>
              <TableRow key="playerViewer1">
                <TableCell component="th" scope="row">Money</TableCell>
                <TableCell align="right">{getPlayerMoney()}</TableCell>
              </TableRow>
              <TableRow key="playerViewer2">
                <TableCell component="th" scope="row">{getTaxTooltip(gameInfo, getPlayer(), "Tax per Turn")}</TableCell>
                <TableCell align="right">{getTaxTooltip(gameInfo, getPlayer(), getPlayerTaxes())}</TableCell>
              </TableRow>
              <TableRow key="playerViewer3">
                <TableCell component="th" scope="row">{getElectricityTooltip(getPlayer(), "Electricity per Turn")}</TableCell>
                <TableCell align="right">{getElectricityTooltip(getPlayer(), getPlayerElectricityCosts())}</TableCell>
              </TableRow>
              <TableRow key="playerViewer1">
                <TableCell component="th" scope="row">{getTotalAssetsTooltip()}</TableCell>
                <TableCell align="right">{getPlayerTotalAssets()}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <TableContainer component={Paper} className="other-info">
          <Table size="small" aria-label="a dense table">
            <TableBody>
              <TableRow key="playerViewer4">
                <TableCell component="th" scope="row">{getSkillTypeTooltip(SkillType.Negotiation)}</TableCell>
                <TableCell align="right">
                  {canUpgradeSkill() ? <FontAwesomeIcon className="upgrade-skill" size="2x" icon={faPlusSquare} onClick={() => upgradeSkill(SkillType.Negotiation)} /> : null}
                  {getSkill(SkillType.Negotiation)}
                </TableCell>
              </TableRow>
              <TableRow key="playerViewer5">
                <TableCell component="th" scope="row">{getSkillTypeTooltip(SkillType.Luck)}</TableCell>
                <TableCell align="right">
                  {canUpgradeSkill() ? <FontAwesomeIcon className="upgrade-skill" size="2x" icon={faPlusSquare} onClick={() => upgradeSkill(SkillType.Luck)} /> : null}
                  {getSkill(SkillType.Luck)}
                </TableCell>
              </TableRow>
              <TableRow key="playerViewer6">
                <TableCell component="th" scope="row">{getSkillTypeTooltip(SkillType.Corruption)}</TableCell>
                <TableCell align="right">
                  {canUpgradeSkill() ? <FontAwesomeIcon className="upgrade-skill" size="2x" icon={faPlusSquare} onClick={() => upgradeSkill(SkillType.Corruption)} /> : null}
                  {getSkill(SkillType.Corruption)}
                </TableCell>
              </TableRow>
              <TableRow key="playerViewer7">
                <TableCell component="th" scope="row">Points available</TableCell>
                <TableCell align="right">{getPlayerPointsAvailable()}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </div>

    </React.Fragment>
  );

};
