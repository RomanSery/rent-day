/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Request, Response } from "express";

export const getLogin = (req: Request, res: Response) => {
  res.send("Hello World!");
};
