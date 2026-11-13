export const last_pos = 40;

export const isolation_position: number = 11;
export const goToIsolationPosition: number = 31;
export const mta_position: number = 18;
export const conEd_position: number = 37;
export const island_position: number = 5;

export const defaultStartSkillPoints: number = 5;

export const payToGetOutFee: number = 100;

export const luckAdjustment: number = 5;
export const negotiationAdjustment: number = 3;
export const corruptionAdjustment: number = 5;

export const muggingChance: number = 15;
export const muggingAmount: number = 200;

export const turnTimeLimit: number = 80;
export const auctionTimeLimit: number = 70;
export const maxTimeoutsAllowed: number = 3;

/**
 * Player colours, handed out when a game starts. Based on the Okabe-Ito
 * colour-blind-safe palette, darkened so each reads as text on white (4.5:1+),
 * and kept apart from each other rather than echoing the property group
 * colours. Ownership on the board also shows the owner's piece, so colour is
 * never the only cue.
 */
export const player_colors = [
  "#0072B2", // blue
  "#C2410C", // vermillion
  "#007A5A", // green
  "#A3478F", // pink-purple
  "#8A6100", // ochre
  "#1D2126", // charcoal
];
