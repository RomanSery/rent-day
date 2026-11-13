/** Where a piece sits on the board: the centre point of the piece, in page pixels. */
export interface PiecePosition {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  /** size relative to a lone piece; below 1 when a crowded square is laid out as a grid */
  readonly scale?: number;
  /** too crowded to show every piece: only the first is drawn, with a count badge */
  readonly hidden?: boolean;
  readonly badge?: number;
}
