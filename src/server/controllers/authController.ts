/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { NextFunction, Request, Response } from "express";
import { check, validationResult } from "express-validator";
import passport from "passport";
import { UserDocument } from "../../core/schema/UserSchema";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../util/secretConstants";
import { PlayerProcessor } from "./PlayerProcessor";
import mongoose from "mongoose";

export const createAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  await check("email", "Email is not valid").isEmail().run(req);
  await check("username", "Username missing")
    .notEmpty()
    .isLength({ min: 4, max: 10 })
    .isAlphanumeric()
    .run(req);
  await check("password", "Password missing").notEmpty().run(req);
  await check("confirmPassword", "Passwords do not match")
    .equals(req.body.password)
    .run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send(errors);
  }

  passport.authenticate("register", (err, user, info) => {
    if (err) {
      console.error("error: " + err);
    }

    if (info !== undefined) {
      res.status(403).send(info.message);
    } else {
      req.logIn(user, (error) => {
        res.status(200).send({ message: "user created" });
      });
    }
  })(req, res, next);
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  await check("username", "Username missing").isEmail().run(req);
  await check("password", "Password missing").notEmpty().run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send(errors);
  }

  passport.authenticate("login", (err, user: UserDocument, info) => {
    if (err) {
      console.error(`error ${err}`);
    }
    if (info !== undefined) {
      return res.status(400).send("Invalid username/password");
    } else {
      req.logIn(user, () => {
        const payload = {
          id: user.id,
          userName: user.username,
          currGameId: user.currGameId,
        };
        const token = jwt.sign(payload, JWT_SECRET, {
          expiresIn: 60 * 60,
        });

        req.session!.rentDayToken = token;

        res.status(200).send(payload);
      });
    }
  })(req, res, next);
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  req.session = null;
  req.logOut();

  res.status(200).send({});
};

export const getCurrentSession = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authToken: string = req.session!.rentDayToken;
    if (authToken && authToken.length > 0) {
      const verified: any = jwt.verify(authToken, JWT_SECRET, {
        ignoreExpiration: true,
      });

      if (verified) {
        const currGame = await PlayerProcessor.getUserGame(
          new mongoose.Types.ObjectId(verified.id)
        );
        if (currGame) {
          verified.currGameId = currGame.id;
        }

        res.status(200).send(verified);
      }
    }
  } catch (error) {
    console.log(error);
    res.status(401).send();
  }

  res.status(401).send();
};

export const sayHello = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.json({
    status: new Date().toISOString(),
  });
};
