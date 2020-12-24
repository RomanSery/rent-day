import { faHome, faHotel } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import { config } from "process";
import React from "react";
import { GameState } from "../../core/types/GameState";
import { Player } from "../../core/types/Player";
import { SkillType } from "../../core/enums/SkillType";

interface Props {
  gameInfo: GameState | undefined;
  getPlayer: () => Player | undefined;
}

export const PlayerViewer: React.FC<Props> = ({ gameInfo, getPlayer }) => {

  const getPlayerName = () => {
    const p = getPlayer();
    if (p) {
      return p.name;
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
      return "$" + p.money;
    }
    return "";
  }

  const getSkill = (skillType: SkillType) => {
    const p = getPlayer();
    if (p) {
      if (skillType == SkillType.Negotiation) {
        return p.negotiation;
      } else if (skillType == SkillType.Speed) {
        return p.speed;
      } else if (skillType == SkillType.Intelligence) {
        return p.intelligence;
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
              <TableRow key={0}>
                <TableCell component="th" scope="row">Money</TableCell>
                <TableCell align="right">{getPlayerMoney()}</TableCell>
              </TableRow>
              <TableRow key={1}>
                <TableCell component="th" scope="row">Tax</TableCell>
                <TableCell align="right">$343</TableCell>
              </TableRow>
              <TableRow key={2}>
                <TableCell component="th" scope="row">Maintenance</TableCell>
                <TableCell align="right">$3454</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <TableContainer component={Paper} className="other-info">
          <Table size="small" aria-label="a dense table">
            <TableBody>
              <TableRow key={0}>
                <TableCell component="th" scope="row">Negotiation</TableCell>
                <TableCell align="right">{getSkill(SkillType.Negotiation)}</TableCell>
              </TableRow>
              <TableRow key={1}>
                <TableCell component="th" scope="row">Speed</TableCell>
                <TableCell align="right">{getSkill(SkillType.Speed)}</TableCell>
              </TableRow>
              <TableRow key={1}>
                <TableCell component="th" scope="row">Intelligence</TableCell>
                <TableCell align="right">{getSkill(SkillType.Intelligence)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </div>

    </React.Fragment>
  );

};