import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { PieceType } from "../../core/enums/PieceType";
import { getIconProp } from "../helpers";

interface Props {
  color: string;
  type: PieceType;
}

export const GamePiece: React.FC<Props> = ({ color, type }) => {

  const getPiece = () => {
    return (<div className="piece">
      <FontAwesomeIcon icon={getIconProp(type)} color={color} size="2x" />
    </div>)
  };

  return (
    getPiece()
  );

};
