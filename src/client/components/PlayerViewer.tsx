import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRobot } from "@fortawesome/free-solid-svg-icons";
import { Player } from "../../core/types/Player";
import { SkillType } from "../../core/enums/SkillType";
import { dollarFormatter, getIconProp } from "../helpers";
import { getElectricityTooltip, getSkillTypeTooltip, getTaxTooltip, getTotalAssetsTooltip } from "../uiHelpers";
import useGameStateStore from "../stores/gameStateStore";

interface Props {
  player: Player;
}

/** One label/value cell of an info card. */
export const InfoItem: React.FC<{ label: React.ReactNode; children: React.ReactNode; wide?: boolean }> = ({ label, children, wide }) => (
  <div className={wide ? "info-item wide" : "info-item"}>
    <div className="info-label">{label}</div>
    <div className="info-value">{children}</div>
  </div>
);

/** A player's money, costs and skills, shown in the game screen's info card. */
export const PlayerViewer: React.FC<Props> = ({ player }) => {

  const gameState = useGameStateStore(state => state.data);

  return (
    <div className="info-card-body">
      <div className="info-card-header" style={{ borderColor: player.color }}>
        <FontAwesomeIcon icon={getIconProp(player.type)} color={player.color} />
        <span className="info-card-title">{player.name}</span>
        <span className="info-card-sub">{player.playerClass}{player.isBot ? <> · <FontAwesomeIcon icon={faRobot} /> computer</> : null}</span>
      </div>

      <div className="info-grid">
        <InfoItem label="Money">{dollarFormatter.format(player.money)}</InfoItem>
        <InfoItem label={getTotalAssetsTooltip()}>{dollarFormatter.format(player.totalAssets)}</InfoItem>
        <InfoItem label={getTaxTooltip(gameState, player, "Tax / turn")}>
          {getTaxTooltip(gameState, player, dollarFormatter.format(player.taxesPerTurn))}
        </InfoItem>
        <InfoItem label={getElectricityTooltip(gameState, player, "Electricity / turn")}>
          {getElectricityTooltip(gameState, player, dollarFormatter.format(player.electricityCostsPerTurn))}
        </InfoItem>
        <InfoItem label={getSkillTypeTooltip(SkillType.Negotiation)}>{player.negotiation}</InfoItem>
        <InfoItem label={getSkillTypeTooltip(SkillType.Luck)}>{player.luck}</InfoItem>
        <InfoItem label={getSkillTypeTooltip(SkillType.Corruption)}>{player.corruption}</InfoItem>
        {player.numAbilityPoints > 0 && <InfoItem label="Unspent points">{player.numAbilityPoints}</InfoItem>}
      </div>
    </div>
  );

};
