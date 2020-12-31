/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { NextFunction, Request, Response } from "express";
import { check, validationResult } from "express-validator";
import passport from "passport";

export const createAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  await check("username", "Username missing")
    .notEmpty()
    .isLength({ min: 4, max: 10 })
    .isAlphanumeric()
    .run(req);
  await check("password", "Password missing").notEmpty().run(req);

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log(errors);
    return res.status(400).send(errors);
  }

  passport.authenticate("register", (err, user, info) => {
    if (err) {
      console.error("error: " + err);
    }
    if (info !== undefined) {
      console.error("error 2:" + info.message);
      res.status(403).send(info.message);
    } else {
      req.logIn(user, (error) => {
        res.status(200).send({ message: "user created" });
      });
    }
  })(req, res, next);

  return res.json({ gameId: "" });
};
