import { SignJWT, jwtVerify } from "jose";

export interface AccessTokenPayload {
  sub: string;
  employeeId: string;
}

export async function signAccessToken(params: {
  userId: string;
  employeeId: string;
  secret: string;
  expiresInSeconds: number;
}): Promise<string> {
  const secret = new TextEncoder().encode(params.secret);
  return new SignJWT({
    employeeId: params.employeeId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(params.userId)
    .setIssuedAt()
    .setExpirationTime(`${params.expiresInSeconds}s`)
    .sign(secret);
}

export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<AccessTokenPayload> {
  const secretKey = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, secretKey, {
    algorithms: ["HS256"],
  });
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("Invalid token");
  }
  const employeeId = payload.employeeId;
  if (typeof employeeId !== "string") {
    throw new Error("Invalid token");
  }
  return { sub: payload.sub, employeeId };
}
