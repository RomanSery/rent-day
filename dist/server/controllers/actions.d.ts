import { Request, Response } from "express";
export declare const roll: (req: Request, res: Response) => Promise<void>;
export declare const initTestGame: (req: Request, res: Response) => Promise<void>;
export declare const getGame: (req: Request, res: Response) => Promise<Response<any> | undefined>;
