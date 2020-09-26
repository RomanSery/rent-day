import React from "react";
import { SquareConfigDataMap, squareGroupColorMap } from "../../core/config/SquareData";

interface Props {
    id: number;
}

export const ColorBar: React.FC<Props> = ({ id }) => {

    const groupId: number = SquareConfigDataMap.get(id)?.groupId!;

    const getClassName = () => {
        return "square-color-bar " + squareGroupColorMap.get(groupId);
    };

    return (
        <div className={getClassName()}></div>
    );

};