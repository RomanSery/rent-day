import { faBiohazard, faDollarSign, faEye, faHandHoldingUsd, faHome, faHotel, faLightbulb, faQuestion, faTrain, faTree } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import React from "react";
import { SquareConfigDataMap, squareGroupColorMap } from "../../core/config/SquareData";
import { SquareType } from "../../core/enums/SquareType";
import { SquareGameData } from "../../core/types/SquareGameData";
import { areObjectIdsEqual, dollarFormatter, formatDollarsWithCents } from "../helpers";
import useGameStateStore from "../stores/gameStateStore";
import { InfoItem } from "./PlayerViewer";

const houses = (n: number) => (
  <span className="info-houses">{Array.from({ length: n }).map((_, i) => <FontAwesomeIcon key={i} icon={faHome} />)}</span>
);

/** The square last tapped or hovered on the board, shown in the game screen's info card. */
export const SquareViewer: React.FC = () => {

  const gameState = useGameStateStore(state => state.data);
  const squareToView = useGameStateStore(state => state.squareToView);

  if (!squareToView || !gameState) {
    return null;
  }

  const config = SquareConfigDataMap.get(squareToView);
  const data: SquareGameData | undefined = gameState.squareState?.find((s: SquareGameData) => s.squareId === squareToView);
  if (!config || !data) {
    return null;
  }

  // the theme only names properties, stations and utilities; the other
  // squares (chance, lotto, corners) have no entry
  const themeEntry = gameState.theme?.[squareToView];
  const name = themeEntry?.name ?? "";
  const themeIcon = themeEntry?.icon ?? "";
  const owner = data.owner ? gameState.players.find((p) => areObjectIdsEqual(p._id, data.owner)) : undefined;
  const money = (v: number | undefined | null) => (v ? dollarFormatter.format(v) : "–");

  const taxText = () => {
    if (!data.tax) {
      return "–";
    }
    if (data.owner && data.purchasePrice && data.purchasePrice > 0) {
      return `${data.tax}% (${dollarFormatter.format(data.purchasePrice * data.tax / 100)})`;
    }
    return `${data.tax}%`;
  };

  const ownerItems = () => (
    <React.Fragment>
      <InfoItem label="Owner">
        {owner ? <span style={{ color: owner.color, fontWeight: 600 }}>{owner.name}</span> : "For sale"}
      </InfoItem>
      <InfoItem label="Bought for">{data.owner ? money(data.purchasePrice) : "–"}</InfoItem>
      <InfoItem label={data.isMortgaged ? "To redeem" : "Mortgage value"}>
        {data.owner && data.mortgageValue
          ? dollarFormatter.format(data.isMortgaged ? Math.round(data.mortgageValue * 1.1) : data.mortgageValue)
          : "–"}
      </InfoItem>
    </React.Fragment>
  );

  /** coloured header bar; properties use their group colour */
  const header = (className: string, icon?: IconDefinition) => (
    <div className={"info-card-header square-header " + className}>
      {icon && <FontAwesomeIcon icon={icon} />}
      <span className="info-card-title">{name}</span>
      {data.isMortgaged && <span className="info-card-sub">mortgaged</span>}
    </div>
  );

  /** squares that are only a name, an icon and a line of text */
  const simple = (title: string, icon: IconDefinition, color: string, text: React.ReactNode) => (
    <div className="info-card-body">
      <div className="info-card-header square-header plain">
        <FontAwesomeIcon icon={icon} color={color} />
        <span className="info-card-title">{title}</span>
      </div>
      <p className="info-card-text">{text}</p>
    </div>
  );

  switch (config.type) {
    case SquareType.Property:
      return (
        <div className="info-card-body">
          {header(squareGroupColorMap.get(config.groupId!) ?? "")}
          <div className="info-grid">
            <InfoItem label="Rent">{money(data.rent0)}</InfoItem>
            <InfoItem label={houses(1)}>{money(data.rent1)}</InfoItem>
            <InfoItem label={houses(2)}>{money(data.rent2)}</InfoItem>
            <InfoItem label={houses(3)}>{money(data.rent3)}</InfoItem>
            <InfoItem label={houses(4)}>{money(data.rent4)}</InfoItem>
            <InfoItem label={<FontAwesomeIcon icon={faHotel} />}>{money(data.rent5)}</InfoItem>
            <InfoItem label="House cost">{money(data.houseCost)}</InfoItem>
            <InfoItem label="Electricity">{data.electricityCost ? formatDollarsWithCents(data.electricityCost) : "$0"}</InfoItem>
            <InfoItem label="Tax">{taxText()}</InfoItem>
            {ownerItems()}
          </div>
        </div>
      );

    case SquareType.TrainStation:
      return (
        <div className="info-card-body">
          {header("station", faTrain)}
          <div className="info-grid">
            <InfoItem label="Rent">{money(data.rent0)}</InfoItem>
            <InfoItem label="2 stations">{money(data.rent1)}</InfoItem>
            <InfoItem label="3 stations">{money(data.rent2)}</InfoItem>
            <InfoItem label="All 4">{money(data.rent3)}</InfoItem>
            <InfoItem label="Tax">{taxText()}</InfoItem>
            {ownerItems()}
          </div>
        </div>
      );

    case SquareType.Utility:
      return (
        <div className="info-card-body">
          {header("station", themeIcon === "subway" ? faTrain : faLightbulb)}
          <p className="info-card-text">{config.description}</p>
          <div className="info-grid">
            <InfoItem label="Owner">
              {owner ? <span style={{ color: owner.color, fontWeight: 600 }}>{owner.name}</span> : "For sale"}
            </InfoItem>
            <InfoItem label="Bought for">{data.owner ? money(data.purchasePrice) : "–"}</InfoItem>
          </div>
        </div>
      );

    case SquareType.Chance:
      return simple("Chance", faQuestion, "orange", "Take a chance. Maybe something good will happen, or you might regret coming here.");
    case SquareType.Lotto:
      return simple("NY Lotto", faDollarSign, "green", "Play the lotto for a chance to win great prizes. Careful, it can be addictive.");
    case SquareType.CentralPark:
      return simple("Central Park", faTree, "green", "Enjoy a relaxing rent-free day strolling around the park.");
    case SquareType.PayDay:
      return simple("Pay Day", faHandHoldingUsd, "green", "Collect your salary plus an extra skill point.");
    case SquareType.Isolation:
      return simple("Quarantine", faBiohazard, "red", "You don't want to end up here, unless you're just visiting a friend.");
    case SquareType.GoToIsolation:
      return simple("Big Brother", faEye, "black", "Caught breaking lockdown rules: land here and you're off to quarantine.");
    default:
      return null;
  }

};
