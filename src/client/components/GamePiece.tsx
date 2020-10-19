import React from "react";
import { faBicycle } from '@fortawesome/free-solid-svg-icons'
import { faCar } from '@fortawesome/free-solid-svg-icons'
import { faChessPawn } from '@fortawesome/free-solid-svg-icons'
import { faHatWizard } from '@fortawesome/free-solid-svg-icons'
import { faCat } from '@fortawesome/free-solid-svg-icons'
import { faDog } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { PieceType } from "../../core/enums/PieceType";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";

interface Props {
  color: string;
  type: PieceType;
}

export const GamePiece: React.FC<Props> = ({ color, type }) => {

  const getIconProp = (): IconDefinition => {
    if (type == PieceType.Bicycle) {
      return faBicycle;
    } else if (type == PieceType.Car) {
      return faCar;
    } else if (type == PieceType.Hat) {
      return faHatWizard;
    } else if (type == PieceType.Pawn) {
      return faChessPawn;
    } else if (type == PieceType.Cat) {
      return faCat;
    } else if (type == PieceType.Dog) {
      return faDog;
    }
    return faChessPawn;
  }

  const getPiece = () => {
    return (<div className="piece">
      <FontAwesomeIcon icon={getIconProp()} color={color} size="2x" />
    </div>)
  };

  return (
    getPiece()
  );

};
