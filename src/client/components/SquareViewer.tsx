import { faBiohazard, faDollarSign, faHandHoldingUsd, faHome, faHotel, faLightbulb, faQuestion, faTrain } from "@fortawesome/free-solid-svg-icons";
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
import { areObjectIdsEqual, dollarFormatter, getGameContextFromLocalStorage, getMyGameId, getMyPlayerName, getMyUserId, handleApiError } from "../helpers";
import { ButtonGroup, Button } from "@material-ui/core";
import API from '../api';
import { GameContext } from "../../core/types/GameContext";
import { GameEvent } from "../../core/types/GameEvent";
import { SocketService } from "../sockets/SocketService";
import { faEye } from "@fortawesome/free-regular-svg-icons";

interface Props {
  gameInfo: GameState | undefined;
  getSquareId: () => number | undefined;
  socketService: SocketService;
}

export const SquareViewer: React.FC<Props> = ({ gameInfo, getSquareId, socketService }) => {

  const context: GameContext = getGameContextFromLocalStorage();

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

  const isOwnedByMe = (): boolean => {
    const data = getSquareGameData();
    if (data && gameInfo && data.owner && areObjectIdsEqual(getMyUserId(), data.owner)) {
      return true;
    }
    return false;
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

  const isMyTurn = () => {
    const uid = getMyUserId();
    return uid && gameInfo && gameInfo.nextPlayerToAct && areObjectIdsEqual(uid, gameInfo.nextPlayerToAct) && gameInfo.auctionId == null;
  }


  const getSquareGameData = (): SquareGameData | undefined => {
    const squareId = getSquareId();
    if (squareId && gameInfo && gameInfo.squareState) {
      return gameInfo.squareState.find((p: SquareGameData) => p.squareId === squareId);
    }
    return undefined;
  };


  const onMortgageProperty = async () => {
    API.post("actions/mortgage", { squareId: getSquareId(), context })
      .then(function (response) {
        if (socketService) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, getMyGameId());
          socketService.socket.emit(GameEvent.SHOW_SNACK_MSG, getMyGameId(), getMyPlayerName() + " mortaged " + getSquareTxt());
        }
      })
      .catch(handleApiError);
  };

  const onRedeemProperty = async () => {
    API.post("actions/redeem", { squareId: getSquareId(), context })
      .then(function (response) {
        if (socketService) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, getMyGameId());
          socketService.socket.emit(GameEvent.SHOW_SNACK_MSG, getMyGameId(), getMyPlayerName() + " redeemed " + getSquareTxt());
        }
      })
      .catch(handleApiError);
  };

  const onBuildHouse = async () => {
    API.post("actions/buildHouse", { squareId: getSquareId(), context })
      .then(function (response) {
        if (socketService) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, getMyGameId());
          socketService.socket.emit(GameEvent.SHOW_SNACK_MSG, getMyGameId(), getMyPlayerName() + " built house on " + getSquareTxt());
        }
      })
      .catch(handleApiError);
  };

  const onSellHouse = async () => {
    API.post("actions/sellHouse", { squareId: getSquareId(), context })
      .then(function (response) {
        if (socketService) {
          socketService.socket.emit(GameEvent.UPDATE_GAME_STATE, getMyGameId());
          socketService.socket.emit(GameEvent.SHOW_SNACK_MSG, getMyGameId(), getMyPlayerName() + " sold house on " + getSquareTxt());
        }
      })
      .catch(handleApiError);
  };

  const getPropertyActions = () => {
    if (!isMyTurn() || !isOwnedByMe()) {
      return null;
    }

    const squareId = getSquareId();
    const config = squareId ? SquareConfigDataMap.get(squareId) : undefined;
    if (config == null) {
      return null;
    }

    const showMortgageRedeemOptions = config.type === SquareType.Property || config.type === SquareType.TrainStation;
    const showBuildingOptions = config.type === SquareType.Property;
    if (!showMortgageRedeemOptions && !showBuildingOptions) {
      return null;
    }

    return (
      <ButtonGroup variant="contained" color="primary" aria-label="contained primary button group">
        {showMortgageRedeemOptions && !isMortgaged() ? <Button color="primary" size="small" onClick={onMortgageProperty}>Mortgage</Button> : null}
        {showMortgageRedeemOptions && isMortgaged() ? <Button color="primary" size="small" onClick={onRedeemProperty}>Redeem</Button> : null}

        {showBuildingOptions ? <Button color="primary" size="small" onClick={onBuildHouse}>Build</Button> : null}
        {showBuildingOptions ? <Button color="primary" size="small" onClick={onSellHouse}>Sell</Button> : null}
      </ButtonGroup>
    );
  }

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
                  <TableCell component="th" scope="row">Base</TableCell>
                  <TableCell align="right">{config.rent0 ? dollarFormatter.format(config.rent0) : ""}</TableCell>
                </TableRow>
                <TableRow key="propertyViewer2">
                  <TableCell component="th" scope="row"><FontAwesomeIcon icon={faHome} /></TableCell>
                  <TableCell align="right">{config.rent1 ? dollarFormatter.format(config.rent1) : ""}</TableCell>
                </TableRow>
                <TableRow key="propertyViewer3">
                  <TableCell component="th" scope="row"><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /></TableCell>
                  <TableCell align="right">{config.rent2 ? dollarFormatter.format(config.rent2) : ""}</TableCell>
                </TableRow>
                <TableRow key="propertyViewer4">
                  <TableCell component="th" scope="row"><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /></TableCell>
                  <TableCell align="right">{config.rent3 ? dollarFormatter.format(config.rent3) : ""}</TableCell>
                </TableRow>
                <TableRow key="propertyViewer5">
                  <TableCell component="th" scope="row"><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /><FontAwesomeIcon icon={faHome} /></TableCell>
                  <TableCell align="right">{config.rent4 ? dollarFormatter.format(config.rent4) : ""}</TableCell>
                </TableRow>
                <TableRow key="propertyViewer6">
                  <TableCell component="th" scope="row"><FontAwesomeIcon icon={faHotel} /></TableCell>
                  <TableCell align="right">{config.rent5 ? dollarFormatter.format(config.rent5) : ""}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <TableContainer component={Paper} className="other-info">
            <Table size="small" aria-label="a dense table">
              <TableBody>
                <TableRow key="propertyViewer11">
                  <TableCell component="th" className="square-viewer-header-row" scope="row">House Cost</TableCell>
                </TableRow>
                <TableRow key="propertyViewer11a">
                  <TableCell>{config.houseCost ? dollarFormatter.format(config.houseCost) : ""}</TableCell>
                </TableRow>
                <TableRow key="propertyViewer12">
                  <TableCell component="th" className="square-viewer-header-row" scope="row">Tax</TableCell>
                </TableRow>
                <TableRow key="propertyViewer12a">
                  <TableCell>{config.tax ? config.tax + "%" : ""} {getSquareTaxAmount()}</TableCell>
                </TableRow>

                <TableRow key="propertyViewer13">
                  <TableCell component="th" className="square-viewer-header-row" scope="row">Owner</TableCell>
                </TableRow>
                <TableRow key="propertyViewer13a">
                  <TableCell style={getNameColorStyle()}>{getowner()}</TableCell>
                </TableRow>
                <TableRow key="propertyViewer14">
                  <TableCell component="th" className="square-viewer-header-row" scope="row">Purchase Price</TableCell>
                </TableRow>
                <TableRow key="propertyViewer14a">
                  <TableCell>{getPurchasePrice()}</TableCell>
                </TableRow>
                <TableRow key="propertyViewer10">
                  <TableCell component="th" className="square-viewer-header-row" scope="row">Mortgage Value</TableCell>
                </TableRow>
                <TableRow key="propertyViewer10a">
                  <TableCell>{getMortgageValue()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </div>
        <div className="actions">
          {getPropertyActions()}
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
                  <TableCell component="th" scope="row">Base</TableCell>
                  <TableCell align="right">{config.rent0 ? dollarFormatter.format(config.rent0) : ""}</TableCell>
                </TableRow>
                <TableRow key="stationViewer2">
                  <TableCell component="th" scope="row">2 stations</TableCell>
                  <TableCell align="right">{config.rent1 ? dollarFormatter.format(config.rent1) : ""}</TableCell>
                </TableRow>
                <TableRow key="stationViewer3">
                  <TableCell component="th" scope="row">3 stations</TableCell>
                  <TableCell align="right">{config.rent2 ? dollarFormatter.format(config.rent2) : ""}</TableCell>
                </TableRow>
                <TableRow key="stationViewer4">
                  <TableCell component="th" scope="row">All 4 stations</TableCell>
                  <TableCell align="right">{config.rent3 ? dollarFormatter.format(config.rent3) : ""}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <TableContainer component={Paper} className="other-info">
            <Table size="small" aria-label="a dense table">
              <TableBody>
                <TableRow key="stationViewer6">
                  <TableCell component="th" className="square-viewer-header-row" scope="row">Tax</TableCell>
                </TableRow>
                <TableRow key="stationViewer6a">
                  <TableCell>{config.tax ? config.tax + "%" : ""} {getSquareTaxAmount()}</TableCell>
                </TableRow>

                <TableRow key="stationViewer7">
                  <TableCell component="th" className="square-viewer-header-row" scope="row">Owner</TableCell>
                </TableRow>
                <TableRow key="stationViewer7a">
                  <TableCell style={getNameColorStyle()}>{getowner()}</TableCell>
                </TableRow>

                <TableRow key="stationViewer8">
                  <TableCell component="th" className="square-viewer-header-row" scope="row">Purchase Price</TableCell>
                </TableRow>
                <TableRow key="stationViewer8a">
                  <TableCell>{getPurchasePrice()}</TableCell>
                </TableRow>

                <TableRow key="stationViewer5">
                  <TableCell component="th" className="square-viewer-header-row" scope="row">Mortgage Value</TableCell>
                </TableRow>
                <TableRow key="stationViewer5a">
                  <TableCell>{getMortgageValue()}</TableCell>
                </TableRow>



              </TableBody>
            </Table>
          </TableContainer>
        </div>
        <div className="actions">
          {getPropertyActions()}
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
                  <TableCell component="th" className="square-viewer-header-row" scope="row">Owner</TableCell>
                </TableRow>
                <TableRow key="propertyViewer13a">
                  <TableCell style={getNameColorStyle()}>{getowner()}</TableCell>
                </TableRow>
                <TableRow key="propertyViewer14">
                  <TableCell component="th" className="square-viewer-header-row" scope="row">Purchase Price</TableCell>
                </TableRow>
                <TableRow key="propertyViewer14a">
                  <TableCell>{getPurchasePrice()}</TableCell>
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
          Enjoy a relaxing rent-free day strolling in the park!
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
