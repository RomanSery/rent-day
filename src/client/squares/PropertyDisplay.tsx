import { motion } from "framer-motion";
import React from "react";
import useGameStateStore from "../stores/gameStateStore";
import { ColorBar } from "./ColorBar";
import { getSquareStyle, getSquareTxt, isBeingAuctioned } from "./squareHelpers";

interface Props {
    id: number;
}

export const PropertyDisplay: React.FC<Props> = ({ id }) => {

    const gameState = useGameStateStore(state => state.data);

    const getNormalSquare = () => {
        return (
            <div className="square-name">
                <div className="square-title" style={getSquareStyle(gameState, id)}>
                    {getSquareTxt(gameState, id)}
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
                <div className="square-title" style={getSquareStyle(gameState, id)}>
                    {getSquareTxt(gameState, id)}
                </div>
            </motion.div>
        );
    }


    return (
        <React.Fragment>
            <ColorBar id={id} />
            {isBeingAuctioned(gameState, id) ? getAnimatedSquare() : getNormalSquare()}
        </React.Fragment>
    );

};