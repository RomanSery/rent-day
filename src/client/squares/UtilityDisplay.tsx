import React from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLightbulb, faTrain } from '@fortawesome/free-solid-svg-icons'
import { getSquareIcon, getSquareTxt } from "./squareHelpers";
import useGameStateStore from "../stores/gameStateStore";

interface Props {
    id: number;
}

export const UtilityDisplay: React.FC<Props> = ({ id }) => {

    const gameState = useGameStateStore(state => state.data);

    const getUtilityIcon = () =>
        getSquareIcon(gameState, id) === "subway" ? faTrain : faLightbulb;

    return (
        <React.Fragment>
            <div className="blank"></div>
            <div className="icon">
                <FontAwesomeIcon icon={getUtilityIcon()} size="3x" color="blue" />
            </div>
            <div className="square-name">
                {getSquareTxt(gameState, id)}
            </div>
        </React.Fragment>
    );

};