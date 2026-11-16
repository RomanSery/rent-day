import { faBiohazard, faDollarSign, faSyringe, faEye, faHandHoldingUsd, faHome, faHotel, faComments, faGaugeHigh, faTrain, faTree } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import React from "react";
import { SquareConfigDataMap, squareGroupColorMap } from "../../core/config/SquareData";
import { SquareType } from "../../core/enums/SquareType";
import { SquareGameData } from "../../core/types/SquareGameData";
import { areObjectIdsEqual, dollarFormatter, formatDollarsWithCents } from "../helpers";
import useGameStateStore from "../stores/gameStateStore";
import { InfoItem } from "./PlayerViewer";
import { PlayerState } from "../../core/enums/PlayerState";
import { chanceName } from "../../core/constants";
import { NEIGHBORHOOD_EVENTS, eventOnSquare, eventRentMultiplier, eventRoundsLeft } from "../../core/config/NeighborhoodEvents";
import { NEIGHBORHOOD_EVENT_ICONS, eventTone, rentChangeText } from "./NeighborhoodNews";

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

  // a neighborhood event on the block changes every rent figure for now
  const cityEvent = eventOnSquare(gameState.neighborhoodEvents, squareToView);
  const multiplier = eventRentMultiplier(gameState.neighborhoodEvents, squareToView);
  const rent = (v: number | undefined | null) => {
    if (!v || multiplier === 1) {
      return money(v);
    }
    return (
      <span className={"event-rent " + (multiplier > 1 ? "up" : "down")} title={"Normally " + dollarFormatter.format(v)}>
        {dollarFormatter.format(Math.round(v * multiplier))}
      </span>
    );
  };
  const eventNote = cityEvent && (
    <p className={"info-card-text event-note " + eventTone(cityEvent)}>
      <FontAwesomeIcon icon={NEIGHBORHOOD_EVENT_ICONS[cityEvent.kind]} />{" "}
      <b>{NEIGHBORHOOD_EVENTS[cityEvent.kind].title}</b> ({rentChangeText(cityEvent)}
      {NEIGHBORHOOD_EVENTS[cityEvent.kind].freezesBuilding ? ", no new houses" : ""}
      {NEIGHBORHOOD_EVENTS[cityEvent.kind].travelFine ? ", $" + NEIGHBORHOOD_EVENTS[cityEvent.kind].travelFine + " fine for landing here unless you own it" : ""}) for{" "}
      {(() => {
        const playersIn = gameState.players.filter((p) => p.state !== PlayerState.BANKRUPT).length;
        const rounds = eventRoundsLeft(cityEvent, gameState.turnNumber ?? 0, playersIn);
        return rounds === 1 ? "the rest of this round" : rounds + " more rounds";
      })()}.
    </p>
  );

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
          {eventNote}
          <div className="info-grid">
            <InfoItem label="Rent">{rent(data.rent0)}</InfoItem>
            <InfoItem label={houses(1)}>{rent(data.rent1)}</InfoItem>
            <InfoItem label={houses(2)}>{rent(data.rent2)}</InfoItem>
            <InfoItem label={houses(3)}>{rent(data.rent3)}</InfoItem>
            <InfoItem label={houses(4)}>{rent(data.rent4)}</InfoItem>
            <InfoItem label={<FontAwesomeIcon icon={faHotel} />}>{rent(data.rent5)}</InfoItem>
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
          {eventNote}
          <div className="info-grid">
            <InfoItem label="Rent">{rent(data.rent0)}</InfoItem>
            <InfoItem label="2 stations">{rent(data.rent1)}</InfoItem>
            <InfoItem label="3 stations">{rent(data.rent2)}</InfoItem>
            <InfoItem label="All 4">{rent(data.rent3)}</InfoItem>
            <InfoItem label="Tax">{taxText()}</InfoItem>
            {ownerItems()}
          </div>
        </div>
      );

    case SquareType.Utility:
      return (
        <div className="info-card-body">
          {header("station", themeIcon === "subway" ? faTrain : faGaugeHigh)}
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
      return simple(chanceName, faComments, "orange", "Hear what the neighbors are saying. Maybe it's good news, or maybe you'll wish you hadn't stopped to listen.");
    case SquareType.Lotto:
      return simple("Vax Lottery", faSyringe, "green", "Roll up your sleeve and pick a ticket. The Ministry rewards compliance, sometimes.");
    case SquareType.CentralPark:
      return simple("Park Closed", faTree, "green", "The park is taped off until further notice. Nothing happens here, and loitering is discouraged.");
    case SquareType.PayDay:
      return simple("Stimulus Day", faHandHoldingUsd, "green", "Collect your relief payment plus an extra skill point.");
    case SquareType.Isolation:
      return simple("Quarantine", faBiohazard, "red", "You don't want to end up here, unless you're just visiting a friend.");
    case SquareType.GoToIsolation:
      return simple("Big Brother", faEye, "black", "Caught breaking lockdown rules: land here and you're off to quarantine.");
    default:
      return null;
  }

};
