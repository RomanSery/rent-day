import React from "react";
import { SquareConfigDataMap, squareGroupColorMap } from "../../core/config/SquareData";
import { faHome, faHotel } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { SquareGameData } from "../../core/types/SquareGameData";
import useGameStateStore from "../gameStateStore";

interface Props {
    id: number;
}

export const ColorBar: React.FC<Props> = ({ id }) => {

    const groupId: number = SquareConfigDataMap.get(id)?.groupId!;
    const gameState = useGameStateStore(state => state.data);

    const getClassName = () => {
        return "square-color-bar " + squareGroupColorMap.get(groupId);
    };

    const getNumHouses = (): number => {
        if (gameState && gameState.squareState) {
            const data = gameState.squareState.find((p: SquareGameData) => p.squareId === id);
            if (data && data.numHouses > 0) {
                return data.numHouses;
            }
        }
        return 0;
    };

    return (
        <div className={getClassName()}>
            {getNumHouses() >= 1 && getNumHouses() < 5 ? <FontAwesomeIcon icon={faHome} color="black" className="house" /> : null}
            {getNumHouses() >= 2 && getNumHouses() < 5 ? <FontAwesomeIcon icon={faHome} color="black" className="house" /> : null}
            {getNumHouses() >= 3 && getNumHouses() < 5 ? <FontAwesomeIcon icon={faHome} color="black" className="house" /> : null}
            {getNumHouses() >= 4 && getNumHouses() < 5 ? <FontAwesomeIcon icon={faHome} color="black" className="house" /> : null}
            {getNumHouses() === 5 ? <FontAwesomeIcon icon={faHotel} color="black" size="2x" className="house" /> : null}
        </div>
    );

};