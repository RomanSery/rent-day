import { faHome, faHotel, faLightbulb, faTrain } from "@fortawesome/free-solid-svg-icons";
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
    } else if (config.type === SquareType.TrainStation) {
      return getTrainStationView(config);
    } else if (config.type === SquareType.Utility) {
      return getUtilityView(config);
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

  const getDescription = () => {
    const squareId = getSquareId();
    if (squareId == null) {
      return "";
    }
    const description = SquareConfigDataMap.get(squareId)?.description;
    return description;
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

  const getIcon = () => {
    const squareId = getSquareId();
    if (squareId && gameInfo && gameInfo.theme) {
      return gameInfo.theme[squareId].icon;
    }
    return "";
  }


  const getPropertyView = (config: SquareConfigData) => {
    return (
      <React.Fragment>
        <div className={getClassName()}>{getSquareTxt()}</div>
        <div className="info-tables">
          <TableContainer component={Paper} className="rent-info">
            <Table size="small" aria-label="a dense table">
              <TableBody>
                <TableRow key="propertyViewer1">
                  <TableCell component="th" scope="row">Base</TableCell>
                  <TableCell align="right">{config.rent ? "$" + config.rent.get(0) : ""}</TableCell>
                </TableRow>
                <TableRow key="propertyViewer2">
                  <TableCell component="th" scope="row"><FontAwesomeIcon icon={faHome} /></TableCell>
                  <TableCell align="right">{config.rent ? "$" + config.rent.get(1) : ""}</TableCell>
                </TableRow>
                <TableRow key="propertyViewer3">
                  <TableCell component="th" scope="row"><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /></TableCell>
                  <TableCell align="right">{config.rent ? "$" + config.rent.get(2) : ""}</TableCell>
                </TableRow>
                <TableRow key="propertyViewer4">
                  <TableCell component="th" scope="row"><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /></TableCell>
                  <TableCell align="right">{config.rent ? "$" + config.rent.get(3) : ""}</TableCell>
                </TableRow>
                <TableRow key="propertyViewer5">
                  <TableCell component="th" scope="row"><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /></TableCell>
                  <TableCell align="right">{config.rent ? "$" + config.rent.get(4) : ""}</TableCell>
                </TableRow>
                <TableRow key="propertyViewer6">
                  <TableCell component="th" scope="row"><FontAwesomeIcon icon={faHotel} /></TableCell>
                  <TableCell align="right">{config.rent ? "$" + config.rent.get(5) : ""}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <TableContainer component={Paper} className="other-info">
            <Table size="small" aria-label="a dense table">
              <TableBody>
                <TableRow key="propertyViewer10">
                  <TableCell component="th" scope="row">Mortgage Value</TableCell>
                  <TableCell align="right">{config.mortgageValue ? "$" + config.mortgageValue : ""}</TableCell>
                </TableRow>
                <TableRow key="propertyViewer11">
                  <TableCell component="th" scope="row">House Cost</TableCell>
                  <TableCell align="right">{config.houseCost ? "$" + config.houseCost : ""}</TableCell>
                </TableRow>
                <TableRow key="propertyViewer12">
                  <TableCell component="th" scope="row">Tax</TableCell>
                  <TableCell align="right">{config.tax ? config.tax + "%" : ""}</TableCell>
                </TableRow>
                <TableRow key="propertyViewer13">
                  <TableCell component="th" scope="row">Owner</TableCell>
                  <TableCell align="right" style={getNameColorStyle()}>{getowner()}</TableCell>
                </TableRow>
                <TableRow key="propertyViewer14">
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


  const getTrainStationView = (config: SquareConfigData) => {
    return (
      <React.Fragment>
        <div className="train-station-name square-color-bar">{getSquareTxt()}</div>
        <div className="info-tables">
          <TableContainer component={Paper} className="rent-info">
            <Table size="small" aria-label="a dense table">
              <TableBody>
                <TableRow key="stationViewer1">
                  <TableCell component="th" scope="row">Base</TableCell>
                  <TableCell align="right">{config.rent ? "$" + config.rent.get(0) : ""}</TableCell>
                </TableRow>
                <TableRow key="stationViewer2">
                  <TableCell component="th" scope="row">If you have 2 stations</TableCell>
                  <TableCell align="right">{config.rent ? "$" + config.rent.get(1) : ""}</TableCell>
                </TableRow>
                <TableRow key="stationViewer3">
                  <TableCell component="th" scope="row">If you have 3 stations</TableCell>
                  <TableCell align="right">{config.rent ? "$" + config.rent.get(2) : ""}</TableCell>
                </TableRow>
                <TableRow key="stationViewer4">
                  <TableCell component="th" scope="row">If you all stations</TableCell>
                  <TableCell align="right">{config.rent ? "$" + config.rent.get(3) : ""}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <TableContainer component={Paper} className="other-info">
            <Table size="small" aria-label="a dense table">
              <TableBody>
                <TableRow key="stationViewer5">
                  <TableCell component="th" scope="row">Mortgage Value</TableCell>
                  <TableCell align="right">{config.mortgageValue ? "$" + config.mortgageValue : ""}</TableCell>
                </TableRow>
                <TableRow key="stationViewer6">
                  <TableCell component="th" scope="row">Tax</TableCell>
                  <TableCell align="right">{config.tax ? config.tax + "%" : ""}</TableCell>
                </TableRow>
                <TableRow key="stationViewer7">
                  <TableCell component="th" scope="row">Owner</TableCell>
                  <TableCell align="right" style={getNameColorStyle()}>{getowner()}</TableCell>
                </TableRow>
                <TableRow key="stationViewer8">
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


  const getUtilityView = (config: SquareConfigData) => {
    return (
      <React.Fragment>
        <div className="utility-name square-color-bar">{getSquareTxt()}</div>
        <div className="utility-icon">
          <FontAwesomeIcon icon={getIcon() === "subway" ? faTrain : faLightbulb} size="3x" color="blue" />
        </div>
        <div className="utility-description">
          {getDescription()}
        </div>
      </React.Fragment>
    );
  };

  return (
    getInfo()
  );

};
