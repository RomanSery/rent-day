import { BoardSection } from "../enums/BoardSection";
import { SquareType } from "../enums/SquareType";
import { SquareConfigData } from "../types/SquareConfigData";

const squareGroupColorMap = new Map<number, string>([
  [1, "dark-purple"],
  [2, "light-blue"],
  [3, "purple"],
  [4, "orange"],
  [5, "red"],
  [6, "yellow"],
  [7, "green"],
  [8, "dark-blue"],
  [15, "island-color"],
]);

const SquareConfigDataMap = new Map<number, SquareConfigData>();
SquareConfigDataMap.set(1, {
  type: SquareType.Go,
  section: BoardSection.Bottom,
});
SquareConfigDataMap.set(2, {
  type: SquareType.Property,
  section: BoardSection.Bottom,
  groupId: 1,
});
SquareConfigDataMap.set(3, {
  type: SquareType.Chance,
  section: BoardSection.Bottom,
});
SquareConfigDataMap.set(4, {
  type: SquareType.Property,
  section: BoardSection.Bottom,
  groupId: 1,
});
SquareConfigDataMap.set(5, {
  type: SquareType.Property,
  section: BoardSection.Bottom,
  groupId: 15,
});

SquareConfigDataMap.set(6, {
  type: SquareType.Airport,
  section: BoardSection.Bottom,
  groupId: 10,
});

SquareConfigDataMap.set(7, {
  type: SquareType.Property,
  section: BoardSection.Bottom,
  groupId: 2,
});
SquareConfigDataMap.set(8, {
  type: SquareType.Chance,
  section: BoardSection.Bottom,
});
SquareConfigDataMap.set(9, {
  type: SquareType.Property,
  section: BoardSection.Bottom,
  groupId: 2,
});
SquareConfigDataMap.set(10, {
  type: SquareType.Property,
  section: BoardSection.Bottom,
  groupId: 2,
});

SquareConfigDataMap.set(11, {
  type: SquareType.Jail,
  section: BoardSection.Bottom,
});

SquareConfigDataMap.set(12, {
  type: SquareType.Property,
  section: BoardSection.Left,
  groupId: 3,
});
SquareConfigDataMap.set(13, {
  type: SquareType.Chance,
  section: BoardSection.Left,
});
SquareConfigDataMap.set(14, {
  type: SquareType.Property,
  section: BoardSection.Left,
  groupId: 3,
});
SquareConfigDataMap.set(15, {
  type: SquareType.Property,
  section: BoardSection.Left,
  groupId: 3,
});

SquareConfigDataMap.set(16, {
  type: SquareType.Airport,
  section: BoardSection.Left,
  groupId: 10,
});

SquareConfigDataMap.set(17, {
  type: SquareType.Property,
  section: BoardSection.Left,
  groupId: 4,
});
SquareConfigDataMap.set(18, {
  type: SquareType.Utility,
  section: BoardSection.Left,
});
SquareConfigDataMap.set(19, {
  type: SquareType.Property,
  section: BoardSection.Left,
  groupId: 4,
});
SquareConfigDataMap.set(20, {
  type: SquareType.Property,
  section: BoardSection.Left,
  groupId: 4,
});

SquareConfigDataMap.set(21, {
  type: SquareType.CentralPark,
  section: BoardSection.Top,
});

SquareConfigDataMap.set(22, {
  type: SquareType.Property,
  section: BoardSection.Top,
  groupId: 5,
});
SquareConfigDataMap.set(23, {
  type: SquareType.Chance,
  section: BoardSection.Top,
});
SquareConfigDataMap.set(24, {
  type: SquareType.Property,
  section: BoardSection.Top,
  groupId: 5,
});
SquareConfigDataMap.set(25, {
  type: SquareType.Property,
  section: BoardSection.Top,
  groupId: 5,
});

SquareConfigDataMap.set(26, {
  type: SquareType.Airport,
  section: BoardSection.Top,
  groupId: 10,
});

SquareConfigDataMap.set(27, {
  type: SquareType.Property,
  section: BoardSection.Top,
  groupId: 6,
});
SquareConfigDataMap.set(28, {
  type: SquareType.Chance,
  section: BoardSection.Top,
});
SquareConfigDataMap.set(29, {
  type: SquareType.Property,
  section: BoardSection.Top,
  groupId: 6,
});
SquareConfigDataMap.set(30, {
  type: SquareType.Property,
  section: BoardSection.Top,
  groupId: 6,
});

SquareConfigDataMap.set(31, {
  type: SquareType.GoToJail,
  section: BoardSection.Top,
});

SquareConfigDataMap.set(32, {
  type: SquareType.Property,
  section: BoardSection.Right,
  groupId: 7,
});
SquareConfigDataMap.set(33, {
  type: SquareType.Chance,
  section: BoardSection.Right,
});
SquareConfigDataMap.set(34, {
  type: SquareType.Property,
  section: BoardSection.Right,
  groupId: 7,
});
SquareConfigDataMap.set(35, {
  type: SquareType.Property,
  section: BoardSection.Right,
  groupId: 7,
});

SquareConfigDataMap.set(36, {
  type: SquareType.Airport,
  section: BoardSection.Right,
  groupId: 10,
});

SquareConfigDataMap.set(37, {
  type: SquareType.Utility,
  section: BoardSection.Right,
});

SquareConfigDataMap.set(38, {
  type: SquareType.Property,
  section: BoardSection.Right,
  groupId: 8,
});
SquareConfigDataMap.set(39, {
  type: SquareType.Chance,
  section: BoardSection.Right,
});
SquareConfigDataMap.set(40, {
  type: SquareType.Property,
  section: BoardSection.Right,
  groupId: 8,
});

export { squareGroupColorMap, SquareConfigDataMap };
