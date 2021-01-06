import jwt from "jsonwebtoken";
import mongoose from "mongoose";

export const getVerifiedUserId = (requestContext: any): string | null => {
  const authToken = requestContext.authToken;
  const userId = requestContext.userId;
  const uid = new mongoose.Types.ObjectId(userId);

  try {
    const verified: any = jwt.verify(authToken, "jwt-secret", {
      ignoreExpiration: true,
    });

    if (verified) {
      const verifiedUserId = verified.id;
      if (verifiedUserId) {
        const verifiedUid = new mongoose.Types.ObjectId(verifiedUserId);
        if (verifiedUid === uid) {
          return userId;
        }
      }
    }
  } catch (error) {
    console.log(error);
    return null;
  }

  return null;
};
