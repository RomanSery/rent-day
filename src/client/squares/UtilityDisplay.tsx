import React from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLightbulb, faTrain } from '@fortawesome/free-solid-svg-icons'
import { GameState } from "../../core/types/GameState";
import { motion } from "framer-motion";
import { SquareGameData } from "../../core/types/SquareGameData";
import { getIconProp } from "../helpers";

interface Props {
    id: number;
    gameInfo: GameState | undefined;
}

export const UtilityDisplay: React.FC<Props> = ({ id, gameInfo }) => {

    const getIcon = () => {
        if (gameInfo && gameInfo.theme) {
            return gameInfo.theme[id].icon;
        }
        return "";
    }

    const getTxt = () => {
        if (gameInfo && gameInfo.theme) {
            return gameInfo.theme[id].name;
        }
        return "";
    }

    const getOwnerIcon = () => {
        if (gameInfo && gameInfo.squareState && gameInfo.squareState[id]) {
            const data: SquareGameData = gameInfo.squareState[id];
            if (data && data.owner && data.color) {
                const ownerPlayer = gameInfo.players.find(
                    (p) => p._id && p._id.toString() == data.owner
                );
                if (ownerPlayer) {
                    return (<FontAwesomeIcon icon={getIconProp(ownerPlayer.type)} color={ownerPlayer.color} />);
                }
            }
        }
        return null;
    }

    const getColorStyle = (): React.CSSProperties => {
        if (gameInfo && gameInfo.squareState && gameInfo.squareState[id]) {
            const data: SquareGameData = gameInfo.squareState[id];
            if (data && data.owner && data.color) {
                return { color: data.color, textDecoration: "underline" };
            }
        }

        return {};
    };

    const getSubwayCompany = () => {
        return (<React.Fragment>
            <div className="blank"></div>
            <div className="icon">
                <FontAwesomeIcon icon={faTrain} size="3x" color="blue" />
            </div>
            <motion.div whileHover={{ scale: 1.1 }} className="square-name" style={getColorStyle()}>
                {getTxt()} {getOwnerIcon()}
            </motion.div>
        </React.Fragment>);
    };

    const getElectricCompany = () => {
        return (<React.Fragment>
            <div className="blank"></div>
            <div className="icon">
                <FontAwesomeIcon icon={faLightbulb} size="3x" color="blue" />
            </div>
            <motion.div whileHover={{ scale: 1.1 }} className="square-name" style={getColorStyle()}>
                {getTxt()} {getOwnerIcon()}
            </motion.div>
        </React.Fragment>);
    };


    return (
        getIcon() === "subway" ? getSubwayCompany() : getElectricCompany()
    );

};