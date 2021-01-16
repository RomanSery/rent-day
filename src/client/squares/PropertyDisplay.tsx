import { motion } from "framer-motion";
import React from "react";
import { GameState } from "../../core/types/GameState";
import { ColorBar } from "./ColorBar";
import { getSquareStyle, getSquareTxt, isBeingAuctioned } from "./squareHelpers";

interface Props {
    id: number;
    gameInfo: GameState | undefined;
}

export const PropertyDisplay: React.FC<Props> = ({ id, gameInfo }) => {

    const getNormalSquare = () => {
        return (
            <div className="square-name">
                <div className="square-title" style={getSquareStyle(gameInfo, id)}>
                    {getSquareTxt(gameInfo, id)}
                </div>
            </div>
        );
    }

    const getAnimatedSquare = () => {
        return (
            <motion.div animate={{ scale: 1.1 }} transition={{
                duration: 1.0,
                loop: Infinity,
                repeatDelay: 0
            }} className="square-name">
                <div className="square-title" style={getSquareStyle(gameInfo, id)}>
                    {getSquareTxt(gameInfo, id)}
                </div>
            </motion.div>
        );
    }


    return (
        <React.Fragment>
            <ColorBar id={id} />
            {isBeingAuctioned(gameInfo, id) ? getAnimatedSquare() : getNormalSquare()}
        </React.Fragment>
    );

};