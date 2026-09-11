import crypto from "crypto";

const secret = () => process.env.DASHBOARD_SESSION_SECRET || "dev-only-change-me";

export function makeSession(username: string) {
  const payload = `${username}.${Date.now()}`;
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifySession(token?: string | null) {
  if (!token) return false;
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const parts = raw.split(".");
    if (parts.length !== 3) return false;
    const [username, stamp, sig] = parts;
    const expected = crypto.createHmac("sha256", secret()).update(`${username}.${stamp}`).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    return Date.now() - Number(stamp) < 1000 * 60 * 60 * 12;
  } catch {
    return false;
  }
}
