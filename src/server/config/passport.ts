import passport from "passport";
import passportLocal from "passport-local";
import { UserDocument, UserInstance } from "../../core/schema/UserSchema";

export const initPassportConfig = () => {
  const LocalStrategy = passportLocal.Strategy;
  passport.use(
    "register",
    new LocalStrategy(
      {
        usernameField: "username",
        passwordField: "password",
        passReqToCallback: true,
        session: false,
      },
      (req, username, password, done) => {
        try {
          UserInstance.findOne({ username: username }).then(
            (user: UserDocument) => {
              if (user != null) {
                console.log("username already taken");
                return done(null, false, {
                  message: "username already taken",
                });
              }

              UserInstance.create({
                username: username,
                password: password,
              }).then((user) => {
                console.log("user created");
                return done(null, user);
              });
            }
          );
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.use(
    "login",
    new LocalStrategy(
      {
        usernameField: "username",
        passwordField: "password",
        session: false,
      },
      (username, password, done) => {
        try {
          UserInstance.findOne({ username: username }).then(
            (user: UserDocument) => {
              if (user === null) {
                return done(null, false, { message: "bad username" });
              }

              if (password != user.password) {
                console.log("passwords do not match");
                return done(null, false, { message: "passwords do not match" });
              } else {
                console.log("user found & authenticated");
                return done(null, user);
              }
            }
          );
        } catch (err) {
          done(err);
        }
      }
    )
  );
};
