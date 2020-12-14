import { motion } from "framer-motion";
import _ from "lodash";
import React from "react";
import { GameState } from "../../core/types/GameState";
import { SquareGameData } from "../../core/types/SquareGameData";
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
                <div className="square-title" style={getColorStyle()}>{getTxt()}</div>
            </motion.div>
        </React.Fragment>
    );

};