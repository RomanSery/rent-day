export interface SquareGameData {
  _id?: string;
  squareId: number;
  owner: string;
  color: string;
  numHouses: number;
  isMortgaged: boolean;
  purchasePrice: number;
  mortgageValue: number;
}
