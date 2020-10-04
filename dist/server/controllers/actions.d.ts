import { Request, Response } from "express";
export declare const getLogin: (req: Request, res: Response) => void;
export declare const initTestGame: (req: Request, res: Response) => Promise<void>;
export declare const getGame: (req: Request, res: Response) => Promise<Response<any> | undefined>;
