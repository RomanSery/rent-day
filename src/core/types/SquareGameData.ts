export interface SquareGameData {
  _id?: string;
  squareId: number;
  owner?: string;
  color?: string;
  numHouses: number;
  isMortgaged: boolean;
  purchasePrice?: number;
  mortgageValue?: number;

  houseCost?: number;
  tax?: number;
  rent0?: number;
  rent1?: number;
  rent2?: number;
  rent3?: number;
  rent4?: number;
  rent5?: number;
}
