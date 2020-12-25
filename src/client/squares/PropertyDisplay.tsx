import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { motion } from "framer-motion";
import _ from "lodash";
import React from "react";
import { GameState } from "../../core/types/GameState";
import { SquareGameData } from "../../core/types/SquareGameData";
import { getIconProp } from "../helpers";
import { ColorBar } from "./ColorBar";

interface Props {
    id: number;
    gameInfo: GameState | undefined;
}

export const PropertyDisplay: React.FC<Props> = ({ id, gameInfo }) => {

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


    return (
        <React.Fragment>
            <ColorBar id={id} />
            <motion.div whileHover={{ scale: 1.1 }} className="square-name">
                <div className="square-title" style={getColorStyle()}>{getTxt()} {getOwnerIcon()}</div>
            </motion.div>
        </React.Fragment>
    );

};