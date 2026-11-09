export interface Settings {
  initialMoney: number;
  initialSkillPoints: number;
  maxPlayers: number;
  password: string | null;
  useTimers?: boolean;
  /** development simulation: a game played entirely by computer players */
  botsOnly?: boolean;
}
