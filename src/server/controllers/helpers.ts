import { Request } from "express";
import { GameContext } from "../../core/types/GameContext";

export const getGameContextFromUrl = (req: Request): GameContext => {
  const gid: any = req.body.context.gameId;
  const pid: any = req.body.context.playerId;

  return { gameId: gid, playerId: pid };
};
