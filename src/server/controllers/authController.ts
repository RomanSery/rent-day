/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { NextFunction, Request, Response } from "express";
import { check, validationResult } from "express-validator";
import passport from "passport";
import { UserDocument } from "../../core/schema/UserSchema";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../util/secrets";

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
        const token = jwt.sign({ id: user.id }, JWT_SECRET, {
          expiresIn: 60 * 60,
        });
        res.status(200).send({
          auth: true,
          token,
          username: user.username,
          gameId: user.currGameId,
        });
      });
    }
  })(req, res, next);
};
