import axios from "axios";
import queryString from "query-string";
import { GameContext } from "../core/types/GameContext";

export default axios.create({
  baseURL: "/api/",
  timeout: 5000,
});

export const getGameContextFromUrl = (search: string): GameContext => {
  const parsed = queryString.parse(search);
  const gid: any = parsed.gid;
  const pid: any = parsed.pid;

  return { gameId: gid, playerId: pid };
};
