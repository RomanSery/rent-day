export class DiceRoll {
  die1: number;
  die2: number;

  /** The server passes dice from the game's seeded generator. */
  constructor(die1?: number, die2?: number) {
    this.die1 = die1 ?? Math.floor(Math.random() * 6) + 1;
    this.die2 = die2 ?? Math.floor(Math.random() * 6) + 1;
  }

  prettyPrint() {
    return "Roll: " + this.die1 + ", " + this.die2;
  }

  sum(): number {
    return this.die1 + this.die2;
  }

  isDouble(): boolean {
    return this.die1 === this.die2;
  }
}
