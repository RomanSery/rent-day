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
  type: SquareType.PayDay,
  section: BoardSection.Bottom,
});
SquareConfigDataMap.set(2, {
  type: SquareType.Property,
  section: BoardSection.Bottom,
  groupId: 1,

  houseCost: 50,
  electricityCost: 0,
  tax: 0.5,
  rent: new Map<number, number>([
    [0, 10],
    [1, 18],
    [2, 30],
    [3, 90],
    [4, 160],
    [5, 250],
  ]),
});
SquareConfigDataMap.set(3, {
  type: SquareType.Chance,
  section: BoardSection.Bottom,
});
SquareConfigDataMap.set(4, {
  type: SquareType.Property,
  section: BoardSection.Bottom,
  groupId: 1,

  houseCost: 50,
  electricityCost: 0,
  tax: 0.5,
  rent: new Map<number, number>([
    [0, 15],
    [1, 30],
    [2, 60],
    [3, 180],
    [4, 320],
    [5, 450],
  ]),
});
SquareConfigDataMap.set(5, {
  type: SquareType.Property,
  section: BoardSection.Bottom,
  groupId: 15,

  houseCost: 100,
  electricityCost: 2,
  tax: 2.0,
  rent: new Map<number, number>([
    [0, 22],
    [1, 44],
    [2, 88],
    [3, 555],
    [4, 666],
    [5, 777],
  ]),
});

SquareConfigDataMap.set(6, {
  type: SquareType.TrainStation,
  section: BoardSection.Bottom,
  groupId: 10,

  tax: 1.8,
  rent: new Map<number, number>([
    [0, 25],
    [1, 50],
    [2, 100],
    [3, 200],
  ]),
});

SquareConfigDataMap.set(7, {
  type: SquareType.Property,
  section: BoardSection.Bottom,
  groupId: 2,

  houseCost: 50,
  electricityCost: 1,
  tax: 1.0,
  rent: new Map<number, number>([
    [0, 15],
    [1, 40],
    [2, 90],
    [3, 270],
    [4, 400],
    [5, 550],
  ]),
});
SquareConfigDataMap.set(8, {
  type: SquareType.Chance,
  section: BoardSection.Bottom,
});
SquareConfigDataMap.set(9, {
  type: SquareType.Property,
  section: BoardSection.Bottom,
  groupId: 2,

  houseCost: 50,
  electricityCost: 1,
  tax: 1.0,
  rent: new Map<number, number>([
    [0, 15],
    [1, 40],
    [2, 90],
    [3, 270],
    [4, 400],
    [5, 550],
  ]),
});
SquareConfigDataMap.set(10, {
  type: SquareType.Property,
  section: BoardSection.Bottom,
  groupId: 2,

  houseCost: 50,
  electricityCost: 1,
  tax: 1.0,
  rent: new Map<number, number>([
    [0, 20],
    [1, 50],
    [2, 100],
    [3, 300],
    [4, 450],
    [5, 600],
  ]),
});

SquareConfigDataMap.set(11, {
  type: SquareType.Isolation,
  section: BoardSection.Bottom,
});

SquareConfigDataMap.set(12, {
  type: SquareType.Property,
  section: BoardSection.Left,
  groupId: 3,

  houseCost: 100,
  electricityCost: 1,
  tax: 1.3,
  rent: new Map<number, number>([
    [0, 20],
    [1, 50],
    [2, 150],
    [3, 450],
    [4, 625],
    [5, 750],
  ]),
});
SquareConfigDataMap.set(13, {
  type: SquareType.Lotto,
  section: BoardSection.Left,
});
SquareConfigDataMap.set(14, {
  type: SquareType.Property,
  section: BoardSection.Left,
  groupId: 3,

  houseCost: 100,
  electricityCost: 1,
  tax: 1.3,
  rent: new Map<number, number>([
    [0, 20],
    [1, 50],
    [2, 150],
    [3, 450],
    [4, 625],
    [5, 750],
  ]),
});
SquareConfigDataMap.set(15, {
  type: SquareType.Property,
  section: BoardSection.Left,
  groupId: 3,

  houseCost: 100,
  electricityCost: 1,
  tax: 1.3,
  rent: new Map<number, number>([
    [0, 25],
    [1, 60],
    [2, 180],
    [3, 500],
    [4, 700],
    [5, 900],
  ]),
});

SquareConfigDataMap.set(16, {
  type: SquareType.TrainStation,
  section: BoardSection.Left,
  groupId: 10,

  tax: 1.8,
  rent: new Map<number, number>([
    [0, 25],
    [1, 50],
    [2, 100],
    [3, 200],
  ]),
});

SquareConfigDataMap.set(17, {
  type: SquareType.Property,
  section: BoardSection.Left,
  groupId: 4,

  houseCost: 100,
  electricityCost: 1,
  tax: 1.5,
  rent: new Map<number, number>([
    [0, 25],
    [1, 70],
    [2, 200],
    [3, 550],
    [4, 750],
    [5, 950],
  ]),
});
SquareConfigDataMap.set(18, {
  type: SquareType.Utility,
  section: BoardSection.Left,
  description: "Doubles rent for train stations that you own",
});
SquareConfigDataMap.set(19, {
  type: SquareType.Property,
  section: BoardSection.Left,
  groupId: 4,

  houseCost: 100,
  electricityCost: 1,
  tax: 1.5,
  rent: new Map<number, number>([
    [0, 25],
    [1, 70],
    [2, 200],
    [3, 550],
    [4, 750],
    [5, 950],
  ]),
});
SquareConfigDataMap.set(20, {
  type: SquareType.Property,
  section: BoardSection.Left,
  groupId: 4,

  houseCost: 100,
  electricityCost: 1,
  tax: 1.5,
  rent: new Map<number, number>([
    [0, 35],
    [1, 80],
    [2, 220],
    [3, 600],
    [4, 800],
    [5, 1000],
  ]),
});

SquareConfigDataMap.set(21, {
  type: SquareType.CentralPark,
  section: BoardSection.Top,
});

SquareConfigDataMap.set(22, {
  type: SquareType.Property,
  section: BoardSection.Top,
  groupId: 5,

  houseCost: 150,
  electricityCost: 2,
  tax: 1.7,
  rent: new Map<number, number>([
    [0, 35],
    [1, 90],
    [2, 250],
    [3, 700],
    [4, 875],
    [5, 1050],
  ]),
});
SquareConfigDataMap.set(23, {
  type: SquareType.Chance,
  section: BoardSection.Top,
});
SquareConfigDataMap.set(24, {
  type: SquareType.Property,
  section: BoardSection.Top,
  groupId: 5,

  houseCost: 150,
  electricityCost: 2,
  tax: 1.7,
  rent: new Map<number, number>([
    [0, 35],
    [1, 90],
    [2, 250],
    [3, 700],
    [4, 875],
    [5, 1050],
  ]),
});
SquareConfigDataMap.set(25, {
  type: SquareType.Property,
  section: BoardSection.Top,
  groupId: 5,

  houseCost: 150,
  electricityCost: 2,
  tax: 1.7,
  rent: new Map<number, number>([
    [0, 40],
    [1, 100],
    [2, 300],
    [3, 750],
    [4, 925],
    [5, 1100],
  ]),
});

SquareConfigDataMap.set(26, {
  type: SquareType.TrainStation,
  section: BoardSection.Top,
  groupId: 10,

  tax: 1.8,
  rent: new Map<number, number>([
    [0, 25],
    [1, 50],
    [2, 100],
    [3, 200],
  ]),
});

SquareConfigDataMap.set(27, {
  type: SquareType.Property,
  section: BoardSection.Top,
  groupId: 6,

  houseCost: 150,
  electricityCost: 2,
  tax: 1.9,
  rent: new Map<number, number>([
    [0, 40],
    [1, 110],
    [2, 330],
    [3, 800],
    [4, 975],
    [5, 1150],
  ]),
});
SquareConfigDataMap.set(28, {
  type: SquareType.Lotto,
  section: BoardSection.Top,
});
SquareConfigDataMap.set(29, {
  type: SquareType.Property,
  section: BoardSection.Top,
  groupId: 6,

  houseCost: 150,
  electricityCost: 2,
  tax: 1.9,
  rent: new Map<number, number>([
    [0, 40],
    [1, 110],
    [2, 330],
    [3, 800],
    [4, 975],
    [5, 1150],
  ]),
});
SquareConfigDataMap.set(30, {
  type: SquareType.Property,
  section: BoardSection.Top,
  groupId: 6,

  houseCost: 150,
  electricityCost: 2,
  tax: 1.9,
  rent: new Map<number, number>([
    [0, 50],
    [1, 120],
    [2, 360],
    [3, 850],
    [4, 1025],
    [5, 1200],
  ]),
});

SquareConfigDataMap.set(31, {
  type: SquareType.GoToIsolation,
  section: BoardSection.Top,
});

SquareConfigDataMap.set(32, {
  type: SquareType.Property,
  section: BoardSection.Right,
  groupId: 7,

  houseCost: 200,
  electricityCost: 2,
  tax: 2.2,
  rent: new Map<number, number>([
    [0, 50],
    [1, 130],
    [2, 390],
    [3, 900],
    [4, 1100],
    [5, 1275],
  ]),
});
SquareConfigDataMap.set(33, {
  type: SquareType.Chance,
  section: BoardSection.Right,
});
SquareConfigDataMap.set(34, {
  type: SquareType.Property,
  section: BoardSection.Right,
  groupId: 7,

  houseCost: 200,
  electricityCost: 2,
  tax: 2.2,
  rent: new Map<number, number>([
    [0, 50],
    [1, 130],
    [2, 390],
    [3, 900],
    [4, 1100],
    [5, 1275],
  ]),
});
SquareConfigDataMap.set(35, {
  type: SquareType.Property,
  section: BoardSection.Right,
  groupId: 7,

  houseCost: 200,
  electricityCost: 2,
  tax: 2.2,
  rent: new Map<number, number>([
    [0, 60],
    [1, 150],
    [2, 450],
    [3, 1000],
    [4, 1200],
    [5, 1400],
  ]),
});

SquareConfigDataMap.set(36, {
  type: SquareType.TrainStation,
  section: BoardSection.Right,
  groupId: 10,

  tax: 1.8,
  rent: new Map<number, number>([
    [0, 25],
    [1, 50],
    [2, 100],
    [3, 200],
  ]),
});

SquareConfigDataMap.set(37, {
  type: SquareType.Utility,
  section: BoardSection.Right,
  description: "You don't have to pay any electricity costs if you own this",
});

SquareConfigDataMap.set(38, {
  type: SquareType.Property,
  section: BoardSection.Right,
  groupId: 8,

  houseCost: 200,
  electricityCost: 3,
  tax: 2.5,
  rent: new Map<number, number>([
    [0, 60],
    [1, 175],
    [2, 500],
    [3, 1100],
    [4, 1300],
    [5, 1500],
  ]),
});
SquareConfigDataMap.set(39, {
  type: SquareType.Lotto,
  section: BoardSection.Right,
});
SquareConfigDataMap.set(40, {
  type: SquareType.Property,
  section: BoardSection.Right,
  groupId: 8,

  houseCost: 200,
  electricityCost: 3,
  tax: 2.5,
  rent: new Map<number, number>([
    [0, 80],
    [1, 200],
    [2, 600],
    [3, 1400],
    [4, 1700],
    [5, 2000],
  ]),
});

export { squareGroupColorMap, SquareConfigDataMap };
