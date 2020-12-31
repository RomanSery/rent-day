export class DiceRoll {
  die1: number;
  die2: number;

  constructor() {
    this.die1 = Math.floor(Math.random() * 6) + 1;
    this.die2 = Math.floor(Math.random() * 6) + 1;
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
