// Ministry bulletins: the game log, read out in the voice of the Ministry.
//
// The server keeps writing plain log lines ("<b>Dana</b> - (Roll: 3, 4) -
// Landed on Astoria - Paid Bob $50 in rent"), which the API tests and
// replays read. This rewrites each line for display only:
//
//   Citizen <b>Dana</b> rolled 3 and 4, was observed at Astoria and remitted
//   $50 in rent to citizen Bob.
//
// A part of a line it doesn't recognise is kept as written, so new log text
// still reads sensibly before a rule is added for it here.

import { chanceName } from "../core/constants";

type Rule = [RegExp, (...groups: string[]) => string];

const lcFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

/** one part of a player's line, as a clause that follows "Citizen <name>" */
const CLAUSES: Rule[] = [
  [/^\(Roll: (\d+), (\d+)\)$/, (a, b) => `rolled ${a} and ${b}`],
  [/^Landed on (.+)$/, (where) => `was observed at ${where}`],
  [/^Caught violating social distancing and put into quarantine$/,
    () => "has been relocated to quarantine for violating social distancing"],
  [/^Rolled a double to get out of quarantine$/, () => "was released from quarantine on a double"],
  [/^Left quarantine after (\d+) turns$/, (n) => `was released from quarantine after serving ${n} turns`],
  [/^Still in quarantine (\d+)\/(\d+) turns$/, (n, of) => `remains in quarantine (${n} of ${of} turns served)`],
  [/^Payday, collect your salary!$/, () => "collected their state-approved salary"],
  [/^Rolled a double so go again$/, () => "rolled a double and is permitted to move again"],
  [/^Lucky double: \+\$(\d+)$/, (n) => `received a $${n} lucky-double allowance`],
  [/^Paid (.+) (\$[\d,.]+) in rent$/, (owner, amount) => `remitted ${amount} in rent to citizen ${owner}`],
  [/^Paid (.+ city tax to .+)$/, (rest) => "paid " + rest.replace(/city tax to /g, "city tax to Governor ")],
  [/^Fined (\$[\d,.]+) for non-essential travel to a locked-down block$/,
    (amount) => `was fined ${amount} for non-essential travel to a locked-down block`],
  [/^\(TIMEOUT: #(\d+)\)$/, (n) => `failed to report in time (warning #${n})`],
  [new RegExp("^" + chanceName + ": Refused the vaccine passport check and was sent to quarantine$"),
    () => "refused the vaccine passport check and has been relocated to quarantine"],
  [new RegExp("^" + chanceName + ": (.+)$"), (picked) => `acted on ${chanceName}: ${lcFirst(picked)}`],
];

/** whole lines that aren't a player's turn */
const LINES: Rule[] = [
  [/^<b>City news<\/b> - (.+) is over$/, (what) => `<b>Ministry notice</b> - ${what} has been lifted.`],
  [/^<b>City news<\/b> - (.+)$/, (what) => `<b>Ministry notice</b> - ${what}`],
  [/^<b>([^<]+)<\/b> won the auction for (.+) and payed (\$[\d,.]+)$/,
    (name, where, amount) => `Citizen <b>${name}</b> was awarded ${where} at state auction for ${amount}.`],
  [/^<b>([^<]+)<\/b> starts their turn owing more than they can raise$/,
    (name) => `Citizen <b>${name}</b> owes more than they can raise. Their business is under review.`],
  [/^All players have left; the game is over\.$/, () => "All citizens have dispersed. The game is over."],
];

const applyRule = (rules: Rule[], text: string): string | null => {
  for (const [re, fn] of rules) {
    const m = re.exec(text);
    if (m) {
      return fn(...m.slice(1));
    }
  }
  return null;
};

/** "a", "a and b", "a, b and c" */
const joinClauses = (clauses: string[]): string =>
  clauses.length <= 1 ? clauses.join("") : clauses.slice(0, -1).join(", ") + " and " + clauses[clauses.length - 1];

/** One game log line (HTML, as the server wrote it) as a Ministry bulletin. */
export const toBulletin = (msg: string): string => {
  const line = msg.trim();
  const whole = applyRule(LINES, line);
  if (whole != null) {
    return whole;
  }

  // "<b>Dana</b> - part - part - ...": a player's turn
  const turn = /^<b>([^<]+)<\/b>\s+-\s+([\s\S]*)$/.exec(line);
  if (turn) {
    const parts = turn[2].split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean);
    const clauses = parts.map((p) => applyRule(CLAUSES, p) ?? lcFirst(p));
    return `Citizen <b>${turn[1]}</b> ${joinClauses(clauses)}.`.replace(/([.!?])\.$/, "$1");
  }

  // "<b>Dana</b> has been ...": already a sentence about one player
  const about = /^<b>([^<]+)<\/b>\s+([\s\S]+)$/.exec(line);
  if (about) {
    return `Citizen <b>${about[1]}</b> ${about[2]}`.replace(/([^.!?])$/, "$1.");
  }

  return line;
};
