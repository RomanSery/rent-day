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

/** what players see for the Chance squares and cards (code names keep "Chance") */
export const chanceName: string = "Word on the Street";

export const muggingChance: number = 15;
export const muggingAmount: number = 200;

/**
 * The lotto draw: the bar runs for lottoDrawMs, then the result stays up for
 * lottoResultHoldMs before the panel closes. The server waits out the same
 * time after a computer player picks, so everyone sees the draw.
 */
export const lottoDrawMs: number = 8000;
export const lottoResultHoldMs: number = 3000;

export const turnTimeLimit: number = 80;
export const auctionTimeLimit: number = 70;
export const maxTimeoutsAllowed: number = 3;

/**
 * Player colours, handed out in this order when a game starts, so the first
 * two (the commonest game) are the most different. An owner's colour sits
 * right beside a square's group colour bar (board.css), so each one is chosen
 * to stay clear of all nine group colours: at least 15 CIEDE2000 apart (the
 * old pink-purple was 6 from the purple group and read as the same colour).
 * They are also at least 16 apart from each other, still distinct under
 * simulated red-green and blue-yellow colour blindness, and read as text on
 * the page (4.5:1+). Ownership on the board also shows the owner's piece, so
 * colour is never the only cue.
 */
export const player_colors = [
  "#3730A3", // indigo
  "#A16207", // amber
  "#047857", // emerald
  "#9F1239", // crimson
  "#1D2126", // charcoal
  "#7C2D12", // rust
];

/**
 * Report a citizen (ReportProcessor): on your turn, once per turn, spend one
 * Corruption point to report another player. The Ministry believes you with
 * this chance, in percent, counting the Corruption you had before spending:
 * base + perCorruption × Corruption, at most max. Believed, they go to
 * quarantine; not believed, you pay the false-report fine.
 */
export const reportBaseChance: number = 30;
export const reportChancePerCorruption: number = 10;
export const reportMaxChance: number = 80;
export const falseReportFine: number = 100;

/** the chance, in percent, that a report by someone with this much Corruption is believed */
export const reportSuccessChance = (corruption: number): number =>
  Math.min(reportMaxChance, reportBaseChance + reportChancePerCorruption * Math.max(0, corruption));

/** a hardship plea (1 Negotiation) multiplies the rent you pay that turn by this */
export const hardshipRentFactor: number = 0.5;
