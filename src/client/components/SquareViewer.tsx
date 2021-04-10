import { faBiohazard, faDollarSign, faEye, faHandHoldingUsd, faHome, faHotel, faLightbulb, faQuestion, faTrain } from "@fortawesome/free-solid-svg-icons";
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
import { SquareGameData } from "../../core/types/SquareGameData";
import { areObjectIdsEqual, dollarFormatter } from "../helpers";

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

    const squareData = getSquareGameData();
    if (squareData == null) {
      return null;
    }

    if (config.type === SquareType.Property) {
      return getPropertyView(squareData);
    } else if (config.type === SquareType.TrainStation) {
      return getTrainStationView(squareData);
    } else if (config.type === SquareType.Utility) {
      return getUtilityView();
    } else if (config.type === SquareType.Chance) {
      return getChanceView();
    } else if (config.type === SquareType.Lotto) {
      return getLottoView();
    } else if (config.type === SquareType.CentralPark) {
      return getCentralParkView();
    } else if (config.type === SquareType.PayDay) {
      return getPayDayView();
    } else if (config.type === SquareType.Isolation) {
      return getIsolationView();
    } else if (config.type === SquareType.GoToIsolation) {
      return getGoToIsolationView();
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
    const data = getSquareGameData();
    if (data && gameInfo && data.owner) {
      const player = gameInfo.players.find((p) => areObjectIdsEqual(p._id, data.owner));
      return player != null ? player.name : "";
    }

    return "";
  };


  const getNameColorStyle = (): React.CSSProperties => {
    const data = getSquareGameData();
    if (data && gameInfo && data.owner) {
      const player = gameInfo.players.find((p) => areObjectIdsEqual(p._id, data.owner));
      return player != null ? { color: player.color } : {};
    }

    return {};
  };

  const getPurchasePrice = (): string => {
    const data = getSquareGameData();
    if (data && data.owner && data.purchasePrice) {
      return dollarFormatter.format(data.purchasePrice);
    }

    return "";
  };

  const getMortgageValue = (): string => {
    const data = getSquareGameData();
    if (data && data.owner && data.mortgageValue) {
      return dollarFormatter.format(data.mortgageValue);
    }
    return "";
  };

  const getRedeemCost = (): string => {
    const data = getSquareGameData();
    if (data && data.owner && data.mortgageValue) {
      return dollarFormatter.format(Math.round(data.mortgageValue + data.mortgageValue * 0.1));
    }
    return "";
  };

  const isMortgaged = (): boolean => {
    const data = getSquareGameData();
    return data && data.isMortgaged ? true : false;
  };

  const getIcon = () => {
    const squareId = getSquareId();
    if (squareId && gameInfo && gameInfo.theme) {
      return gameInfo.theme[squareId].icon;
    }
    return "";
  }


  const getSquareGameData = (): SquareGameData | undefined => {
    const squareId = getSquareId();
    if (squareId && gameInfo && gameInfo.squareState) {
      return gameInfo.squareState.find((p: SquareGameData) => p.squareId === squareId);
    }
    return undefined;
  };


  const getSquareTaxAmount = () => {
    const data = getSquareGameData();
    if (data && data.owner && data.purchasePrice && data.purchasePrice > 0 && data.tax && data.tax > 0) {
      const taxRate = data.tax / 100.0;
      const tax = data.purchasePrice * taxRate;
      return " (" + dollarFormatter.format(tax) + ")";
    }
    return "";
  }

  const getPropertyView = (config: SquareGameData) => {
    return (
      <React.Fragment>
        <div className={getClassName()}>{getSquareTxt()} {isMortgaged() ? " (Mortgaged)" : ""}</div>
        <div className="info-tables">
          <TableContainer component={Paper} className="rent-info">
            <Table size="small" aria-label="a dense table">
              <TableBody>
                <TableRow key="propertyViewer1">
                  <TableCell component="th" scope="row" colSpan={2}>
                    <div className="row-small-name">Base</div> {config.rent0 ? dollarFormatter.format(config.rent0) : ""}
                  </TableCell>
                </TableRow>
                <TableRow key="propertyViewer2">
                  <TableCell component="th" scope="row">
                    <div className="row-small-name"><FontAwesomeIcon icon={faHome} /></div> {config.rent1 ? dollarFormatter.format(config.rent1) : ""}
                  </TableCell>
                  <TableCell component="th" scope="row">
                    <div className="row-small-name"><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /></div> {config.rent2 ? dollarFormatter.format(config.rent2) : ""}
                  </TableCell>
                </TableRow>

                <TableRow key="propertyViewer4">
                  <TableCell component="th" scope="row">
                    <div className="row-small-name"><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /></div> {config.rent3 ? dollarFormatter.format(config.rent3) : ""}
                  </TableCell>
                  <TableCell component="th" scope="row">
                    <div className="row-small-name"><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /></div>
                    {config.rent4 ? dollarFormatter.format(config.rent4) : ""}
                  </TableCell>
                </TableRow>
                <TableRow key="propertyViewer6">
                  <TableCell component="th" scope="row" colSpan={2}>
                    <div className="row-small-name"><FontAwesomeIcon icon={faHotel} /></div>
                    {config.rent5 ? dollarFormatter.format(config.rent5) : ""}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <TableContainer component={Paper} className="other-info">
            <Table size="small" aria-label="a dense table">
              <TableBody>
                <TableRow key="propertyViewer11">
                  <TableCell component="th" scope="row">
                    <div className="row-small-name">House</div> {config.houseCost ? dollarFormatter.format(config.houseCost) : ""}
                  </TableCell>
                  <TableCell component="th" scope="row">
                    <div className="row-small-name">Electric</div> {config.electricityCost ? dollarFormatter.format(config.electricityCost) : "$0"}
                  </TableCell>
                </TableRow>
                <TableRow key="propertyViewer12">
                  <TableCell component="th" scope="row">
                    <div className="row-small-name">Tax</div> {config.tax ? config.tax + "%" : ""} {getSquareTaxAmount()}
                  </TableCell>
                  <TableCell component="th" scope="row" style={getNameColorStyle()}>
                    <div className="row-small-name">Owner</div> {getowner()}
                  </TableCell>
                </TableRow>
                <TableRow key="propertyViewer14">
                  <TableCell component="th" scope="row">
                    <div className="row-small-name">Purchase Price</div> {getPurchasePrice()}
                  </TableCell>
                  <TableCell component="th" scope="row">
                    <div className="row-small-name">{isMortgaged() ? "To Redeem" : "Mortgage Value"}</div> {isMortgaged() ? getRedeemCost() : getMortgageValue()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      </React.Fragment>
    );
  };


  const getTrainStationView = (config: SquareGameData) => {
    return (
      <React.Fragment>
        <div className="train-station-name square-color-bar">{getSquareTxt()} {isMortgaged() ? " (Mortgaged)" : ""}</div>
        <div className="info-tables">
          <TableContainer component={Paper} className="rent-info">
            <Table size="small" aria-label="a dense table">
              <TableBody>
                <TableRow key="stationViewer1">
                  <TableCell component="th" scope="row" colSpan={2}>
                    <div className="row-small-name">Base</div> {config.rent0 ? dollarFormatter.format(config.rent0) : ""}
                  </TableCell>
                </TableRow>
                <TableRow key="stationViewer2">
                  <TableCell component="th" scope="row" colSpan={2}>
                    <div className="row-small-name">2 Stations</div> {config.rent1 ? dollarFormatter.format(config.rent1) : ""}
                  </TableCell>
                </TableRow>
                <TableRow key="stationViewer3">
                  <TableCell component="th" scope="row" colSpan={2}>
                    <div className="row-small-name">3 Stations</div> {config.rent2 ? dollarFormatter.format(config.rent2) : ""}
                  </TableCell>
                </TableRow>
                <TableRow key="stationViewer4">
                  <TableCell component="th" scope="row" colSpan={2}>
                    <div className="row-small-name">All 4 stations</div> {config.rent3 ? dollarFormatter.format(config.rent3) : ""}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <TableContainer component={Paper} className="other-info">
            <Table size="small" aria-label="a dense table">
              <TableBody>
                <TableRow key="stationViewer6">
                  <TableCell component="th" scope="row" colSpan={2}>
                    <div className="row-small-name">Tax</div> {config.tax ? config.tax + "%" : ""} {getSquareTaxAmount()}
                  </TableCell>
                </TableRow>
                <TableRow key="stationViewer7">
                  <TableCell component="th" scope="row" colSpan={2} style={getNameColorStyle()}>
                    <div className="row-small-name">Owner</div> {getowner()}
                  </TableCell>
                </TableRow>
                <TableRow key="stationViewer8">
                  <TableCell component="th" scope="row" colSpan={2}>
                    <div className="row-small-name">Purchase Price</div> {getPurchasePrice()}
                  </TableCell>
                </TableRow>
                <TableRow key="stationViewer5">
                  <TableCell component="th" scope="row" colSpan={2}>
                    <div className="row-small-name">{isMortgaged() ? "To Redeem" : "Mortgage Value"}</div> {isMortgaged() ? getRedeemCost() : getMortgageValue()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      </React.Fragment>
    );
  };


  const getUtilityView = () => {
    return (
      <React.Fragment>
        <div className="utility-name square-color-bar">{getSquareTxt()}</div>
        <div className="utility-icon">
          <FontAwesomeIcon icon={getIcon() === "subway" ? faTrain : faLightbulb} size="3x" color="blue" />
        </div>
        <div className="utility-description">
          {getDescription()}
        </div>
        <div className="info-tables">
          <TableContainer component={Paper} className="other-info">
            <Table size="small" aria-label="a dense table">
              <TableBody>
                <TableRow key="propertyViewer13">
                  <TableCell component="th" scope="row" colSpan={2} style={getNameColorStyle()}>
                    <div className="row-small-name">Owner</div> {getowner()}
                  </TableCell>
                </TableRow>
                <TableRow key="propertyViewer14">
                  <TableCell component="th" scope="row" colSpan={2}>
                    <div className="row-small-name">Purchase Price</div> {getPurchasePrice()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      </React.Fragment>
    );
  };

  const getChanceView = () => {
    return (
      <React.Fragment>
        <div className="utility-name square-color-bar">Chance</div>
        <div className="utility-icon">
          <FontAwesomeIcon icon={faQuestion} size="3x" color="orange" />
        </div>
        <div className="utility-description">
          Take a chance.  <br />Maybe something good will happen.  <br />Or you might regret coming here.
        </div>
      </React.Fragment>
    );
  };

  const getLottoView = () => {
    return (
      <React.Fragment>
        <div className="utility-name square-color-bar">NY Lotto</div>
        <div className="utility-icon">
          <FontAwesomeIcon icon={faDollarSign} size="3x" color="green" />
        </div>
        <div className="utility-description">
          Play the lotto for a chance to win great prizes!
          <br />
          But be careful, it can be very addicting.
        </div>
      </React.Fragment>
    );
  };

  const getCentralParkView = () => {
    return (
      <React.Fragment>
        <div className="utility-name square-color-bar">Central park</div>
        <div className="utility-description">
          Enjoy a relaxing rent-free day strolling around in the park!
        </div>
      </React.Fragment>
    );
  };

  const getPayDayView = () => {
    return (
      <React.Fragment>
        <div className="utility-name square-color-bar">Pay Day</div>
        <div className="utility-icon">
          <FontAwesomeIcon icon={faHandHoldingUsd} size="3x" color="green" />
        </div>
        <div className="utility-description">
          It's pay day!
          <br />
          Collect your salary plus an additional skill point.
        </div>
      </React.Fragment>
    );
  };

  const getIsolationView = () => {
    return (
      <React.Fragment>
        <div className="utility-name square-color-bar">Quarantine</div>
        <div className="utility-icon">
          <FontAwesomeIcon icon={faBiohazard} size="4x" color="red" />
        </div>
        <div className="utility-description">
          You don't want to end up here.
          <br />
          Unless you are just visiting a friend.
        </div>
      </React.Fragment>
    );
  };

  const getGoToIsolationView = () => {
    return (
      <React.Fragment>
        <div className="utility-name square-color-bar">Big Brother</div>
        <div className="utility-icon">
          <FontAwesomeIcon icon={faEye} size="3x" color="black" />
        </div>
        <div className="utility-description">
          You've been caught violating lockdown rules.
          <br />
          If you land here, be ready for forced quarantine.
        </div>
      </React.Fragment>
    );
  };


  return (
    getInfo()
  );

};
