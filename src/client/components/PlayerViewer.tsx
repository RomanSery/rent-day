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
import { dollarFormatter } from '../helpers';

interface Props {
  gameInfo: GameState | undefined;
  getPlayer: () => Player | undefined;
}

export const PlayerViewer: React.FC<Props> = ({ gameInfo, getPlayer }) => {

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
                <TableCell component="th" scope="row">Tax</TableCell>
                <TableCell align="right">{getPlayerTaxes()}</TableCell>
              </TableRow>
              <TableRow key="playerViewer3">
                <TableCell component="th" scope="row">Electricity</TableCell>
                <TableCell align="right">{getPlayerElectricityCosts()}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <TableContainer component={Paper} className="other-info">
          <Table size="small" aria-label="a dense table">
            <TableBody>
              <TableRow key="playerViewer4">
                <TableCell component="th" scope="row">Negotiation</TableCell>
                <TableCell align="right">{getSkill(SkillType.Negotiation)}</TableCell>
              </TableRow>
              <TableRow key="playerViewer5">
                <TableCell component="th" scope="row">Luck</TableCell>
                <TableCell align="right">{getSkill(SkillType.Luck)}</TableCell>
              </TableRow>
              <TableRow key="playerViewer6">
                <TableCell component="th" scope="row">Corruption</TableCell>
                <TableCell align="right">{getSkill(SkillType.Corruption)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </div>

    </React.Fragment>
  );

};
