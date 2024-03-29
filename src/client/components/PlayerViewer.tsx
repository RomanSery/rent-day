import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import React from "react";
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
import useGameStateStore from '../stores/gameStateStore';


interface Props {
  socketService: SocketService;
  getPlayer: () => Player | undefined;
}

export const PlayerViewer: React.FC<Props> = ({ getPlayer, socketService }) => {

  const context: GameContext = getGameContextFromLocalStorage();
  const gameState = useGameStateStore(state => state.data);

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

  const hasPointsAvailable = () => {
    const p = getPlayer();
    if (p && p.numAbilityPoints > 0) {
      return true;
    }
    return false;
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
    return uid && gameState && gameState.nextPlayerToAct && areObjectIdsEqual(uid, gameState.nextPlayerToAct) && gameState.auctionId == null;
  }

  const upgradeSkill = async (skillType: SkillType) => {
    API.post("actions/upgradeSkill", { skillType: skillType, context })
      .then(function (response) {
        if (socketService && gameState) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, gameState._id);
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
                <TableCell component="th" scope="row">
                  <div className="row-small-name">Money</div> {getPlayerMoney()}
                </TableCell>
                <TableCell component="th" scope="row">
                  <div className="row-small-name">{getTotalAssetsTooltip()}</div>
                  {getPlayerTotalAssets()}
                </TableCell>
              </TableRow>
              <TableRow key="playerViewer2">
                <TableCell component="th" scope="row">
                  <div className="row-small-name">{getTaxTooltip(gameState, getPlayer(), "Tax")}</div>
                  {getTaxTooltip(gameState, getPlayer(), getPlayerTaxes())}
                </TableCell>
                <TableCell component="th" scope="row">
                  <div className="row-small-name">{getElectricityTooltip(gameState, getPlayer(), "Electricity")}</div>
                  {getElectricityTooltip(gameState, getPlayer(), getPlayerElectricityCosts())}
                </TableCell>
              </TableRow>

              {hasPointsAvailable() && <TableRow key="playerViewer4">
                <TableCell component="th" scope="row" colSpan={2}>
                  <div><strong>Distribute your points!</strong></div>
                </TableCell>
              </TableRow>}

            </TableBody>
          </Table>
        </TableContainer>

        <TableContainer component={Paper} className="other-info">
          <Table size="small" aria-label="a dense table">
            <TableBody>

              <TableRow key="playerViewer4">
                <TableCell component="th" scope="row" colSpan={2}>
                  <div className="row-small-name">{getSkillTypeTooltip(SkillType.Negotiation)}</div>
                  {canUpgradeSkill() ? <FontAwesomeIcon className="upgrade-skill" size="2x" icon={faPlusSquare} onClick={() => upgradeSkill(SkillType.Negotiation)} /> : null}
                  {getSkill(SkillType.Negotiation)}
                </TableCell>
              </TableRow>

              <TableRow key="playerViewer5">
                <TableCell component="th" scope="row" colSpan={2}>
                  <div className="row-small-name">{getSkillTypeTooltip(SkillType.Luck)}</div>
                  {canUpgradeSkill() ? <FontAwesomeIcon className="upgrade-skill" size="2x" icon={faPlusSquare} onClick={() => upgradeSkill(SkillType.Luck)} /> : null}
                  {getSkill(SkillType.Luck)}
                </TableCell>
              </TableRow>

              <TableRow key="playerViewer6">
                <TableCell component="th" scope="row" colSpan={2}>
                  <div className="row-small-name">{getSkillTypeTooltip(SkillType.Corruption)}</div>
                  {canUpgradeSkill() ? <FontAwesomeIcon className="upgrade-skill" size="2x" icon={faPlusSquare} onClick={() => upgradeSkill(SkillType.Corruption)} /> : null}
                  {getSkill(SkillType.Corruption)}
                </TableCell>
              </TableRow>

              <TableRow key="playerViewer7">
                <TableCell component="th" scope="row" colSpan={2}>
                  <div className="row-small-name">Available</div>
                  {getPlayerPointsAvailable()}
                </TableCell>
              </TableRow>

            </TableBody>
          </Table>
        </TableContainer>
      </div>

    </React.Fragment>
  );

};
