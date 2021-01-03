import jwt from "jsonwebtoken";

export const getVerifiedUserId = (requestContext: any): string | null => {
  const authToken = requestContext.authToken;
  const userId = requestContext.userId;

  try {
    const verified: any = jwt.verify(authToken, "jwt-secret", {
      ignoreExpiration: true,
    });

    if (verified) {
      const verifiedUserId = verified.id;
      if (verifiedUserId && verifiedUserId == userId) {
        return userId;
      }
    }
  } catch (error) {
    console.log(error);
    return null;
  }

  return null;
};
