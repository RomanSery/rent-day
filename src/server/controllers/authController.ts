/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { NextFunction, Request, Response } from "express";
import { check, validationResult } from "express-validator";
import passport from "passport";
import { UserInstance } from "../../core/schema/UserSchema";
import jwt from "jsonwebtoken";

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
};

export const login = async (
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
    return res.status(400).send(errors);
  }

  passport.authenticate("login", (err, users, info) => {
    if (err) {
      console.error(`error ${err}`);
    }
    if (info !== undefined) {
      console.error(info.message);
      if (info.message === "bad username") {
        res.status(401).send(info.message);
      } else {
        res.status(403).send(info.message);
      }
    } else {
      req.logIn(users, () => {
        UserInstance.findOne({ username: req.body.username }).then(
          (user: { id: any }) => {
            console.log("signing: " + user);
            const token = jwt.sign({ id: user.id }, "jwt-secret", {
              expiresIn: 60 * 60,
            });
            res.status(200).send({
              auth: true,
              token,
              message: "user found & logged in",
            });
          }
        );
      });
    }
  })(req, res, next);
};
