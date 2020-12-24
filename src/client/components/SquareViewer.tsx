import { faHome, faHotel } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import React from "react";
import { SquareConfigDataMap, squareGroupColorMap } from "../../core/config/SquareData";
import { SquareType } from "../../core/enums/SquareType";
import { GameState } from "../../core/types/GameState";
import { SquareConfigData } from "../../core/types/SquareConfigData";
import { SquareGameData } from "../../core/types/SquareGameData";

interface Props {
  gameInfo: GameState | undefined;
  getSquareId: () => number | undefined;
}

export const SquareViewer: React.FC<Props> = ({ gameInfo, getSquareId }) => {

  const getSquareTxt = () => {
    const squareId = getSquareId();
    if (gameInfo && gameInfo.theme && squareId) {
      return gameInfo.theme[squareId].name;
    }
    return "";
  }

  const getInfo = () => {
    const squareId = getSquareId();
    const config = squareId ? SquareConfigDataMap.get(squareId) : undefined;

    if (config == null) {
      return null;
    }

    if (config.type === SquareType.Property) {
      return getPropertyView(config);
    }

    return null;
  };

  const getClassName = () => {
    const squareId = getSquareId();
    if (squareId == null) {
      return "";
    }
    const groupId: number = SquareConfigDataMap.get(squareId)?.groupId!;
    return "property-name square-color-bar " + squareGroupColorMap.get(groupId);
  };

  const getowner = (): string => {
    const squareId = getSquareId();
    if (squareId && gameInfo && gameInfo.squareState && gameInfo.squareState[squareId]) {
      const data: SquareGameData = gameInfo.squareState[squareId];
      if (data && data.owner) {
        const player = gameInfo.players.find(
          (p) => p._id && p._id.toString() === data.owner
        );
        return player != null ? player.name : "";
      }
    }

    return "";
  };

  const getNameColorStyle = (): React.CSSProperties => {
    const squareId = getSquareId();
    if (squareId && gameInfo && gameInfo.squareState && gameInfo.squareState[squareId]) {
      const data: SquareGameData = gameInfo.squareState[squareId];
      if (data && data.owner) {
        const player = gameInfo.players.find(
          (p) => p._id && p._id.toString() === data.owner
        );
        return player != null ? { color: player.color } : {};
      }
    }

    return {};
  };

  const getPurchasePrice = (): string => {
    const squareId = getSquareId();
    if (squareId && gameInfo && gameInfo.squareState && gameInfo.squareState[squareId]) {
      const data: SquareGameData = gameInfo.squareState[squareId];
      if (data && data.owner && data.purchasePrice) {
        return "$" + data.purchasePrice;
      }
    }

    return "";
  };


  const getPropertyView = (config: SquareConfigData) => {
    return (
      <React.Fragment>
        <div className={getClassName()}>{getSquareTxt()}</div>
        <div className="info-tables">
          <TableContainer component={Paper} className="rent-info">
            <Table size="small" aria-label="a dense table">
              <TableBody>
                <TableRow key={0}>
                  <TableCell component="th" scope="row">Base</TableCell>
                  <TableCell align="right">{config.rent ? "$" + config.rent.get(0) : ""}</TableCell>
                </TableRow>
                <TableRow key={1}>
                  <TableCell component="th" scope="row"><FontAwesomeIcon icon={faHome} /></TableCell>
                  <TableCell align="right">{config.rent ? "$" + config.rent.get(1) : ""}</TableCell>
                </TableRow>
                <TableRow key={2}>
                  <TableCell component="th" scope="row"><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /></TableCell>
                  <TableCell align="right">{config.rent ? "$" + config.rent.get(2) : ""}</TableCell>
                </TableRow>
                <TableRow key={3}>
                  <TableCell component="th" scope="row"><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /></TableCell>
                  <TableCell align="right">{config.rent ? "$" + config.rent.get(3) : ""}</TableCell>
                </TableRow>
                <TableRow key={4}>
                  <TableCell component="th" scope="row"><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /></TableCell>
                  <TableCell align="right">{config.rent ? "$" + config.rent.get(4) : ""}</TableCell>
                </TableRow>
                <TableRow key={4}>
                  <TableCell component="th" scope="row"><FontAwesomeIcon icon={faHotel} /></TableCell>
                  <TableCell align="right">{config.rent ? "$" + config.rent.get(5) : ""}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <TableContainer component={Paper} className="other-info">
            <Table size="small" aria-label="a dense table">
              <TableBody>
                <TableRow key={0}>
                  <TableCell component="th" scope="row">Mortgage Value</TableCell>
                  <TableCell align="right">{config.mortgageValue ? "$" + config.mortgageValue : ""}</TableCell>
                </TableRow>
                <TableRow key={1}>
                  <TableCell component="th" scope="row">House Cost</TableCell>
                  <TableCell align="right">{config.houseCost ? "$" + config.houseCost : ""}</TableCell>
                </TableRow>
                <TableRow key={1}>
                  <TableCell component="th" scope="row">Tax</TableCell>
                  <TableCell align="right">{config.tax ? config.tax + "%" : ""}</TableCell>
                </TableRow>
                <TableRow key={1}>
                  <TableCell component="th" scope="row">Owner</TableCell>
                  <TableCell align="right" style={getNameColorStyle()}>{getowner()}</TableCell>
                </TableRow>
                <TableRow key={1}>
                  <TableCell component="th" scope="row">Purchase Price</TableCell>
                  <TableCell align="right">{getPurchasePrice()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </div>


      </React.Fragment>
    );
  };


  return (
    getInfo()
  );

};