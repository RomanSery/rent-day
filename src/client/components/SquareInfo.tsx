import React from "react";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareType } from "../../core/enums/SquareType";
import { TrainStationDisplay } from "../squares/TrainStationDisplay";
import { ChanceDisplay } from "../squares/ChanceDisplay";
import { PropertyDisplay } from "../squares/PropertyDisplay";
import { CentralParkDisplay } from "../squares/CentralParkDisplay";
import { GoDisplay } from "../squares/GoDisplay";
import { UtilityDisplay } from "../squares/UtilityDisplay";
import { GameState } from "../../core/types/GameState";


interface Props {
    id: number;
    gameInfo: GameState | undefined;
}

export const SquareInfo: React.FC<Props> = ({ id, gameInfo }) => {

    const type: SquareType | undefined = SquareConfigDataMap.get(id)?.type;

    const getInfo = () => {
        if (type === SquareType.TrainStation) {
            return <TrainStationDisplay id={id} gameInfo={gameInfo} />
        }
        if (type === SquareType.Chance) {
            return <ChanceDisplay id={id} />
        }
        if (type === SquareType.CentralPark) {
            return <CentralParkDisplay id={id} />
        }
        if (type === SquareType.Go) {
            return <GoDisplay id={id} />
        }
        if (type === SquareType.Utility) {
            return <UtilityDisplay id={id} gameInfo={gameInfo} />
        }

        if (type === SquareType.Jail || type === SquareType.GoToJail) {
            return null;
        }

        return <PropertyDisplay id={id} gameInfo={gameInfo} />
    };


    return (
        getInfo()
    );

};