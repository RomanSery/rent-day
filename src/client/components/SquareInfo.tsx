import React from "react";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareType } from "../../core/enums/SquareType";
import { TrainStationDisplay } from "../squares/TrainStationDisplay";
import { ChanceDisplay } from "../squares/ChanceDisplay";
import { PropertyDisplay } from "../squares/PropertyDisplay";
import { CentralParkDisplay } from "../squares/CentralParkDisplay";
import { PayDayDisplay } from "../squares/PayDayDisplay";
import { UtilityDisplay } from "../squares/UtilityDisplay";
import { LottoDisplay } from "../squares/LottoDisplay";
import { IsolationDisplay } from "../squares/IsolationDisplay";

interface Props {
    id: number;
}

export const SquareInfo: React.FC<Props> = ({ id }) => {

    const type: SquareType | undefined = SquareConfigDataMap.get(id)?.type;

    const getInfo = () => {
        if (type === SquareType.TrainStation) {
            return <TrainStationDisplay id={id} />
        }
        if (type === SquareType.Chance) {
            return <ChanceDisplay id={id} />
        }
        if (type === SquareType.Lotto) {
            return <LottoDisplay id={id} />
        }
        if (type === SquareType.CentralPark) {
            return <CentralParkDisplay id={id} />
        }
        if (type === SquareType.PayDay) {
            return <PayDayDisplay id={id} />
        }
        if (type === SquareType.Utility) {
            return <UtilityDisplay id={id} />
        }
        if (type === SquareType.Isolation) {
            return <IsolationDisplay id={id} />
        }

        if (type === SquareType.GoToIsolation) {
            return null;
        }

        return <PropertyDisplay id={id} />
    };


    return (
        getInfo()
    );

};