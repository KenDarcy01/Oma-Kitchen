/** A single family passcode unlocks adding recipes and the photo studio. Works in edge and node runtimes. */
export const AUTH_COOKIE = "oma_key";

export async function passcodeToken(passcode: string): Promise<string> {
  const bytes = new TextEncoder().encode("oma-kitchen:" + passcode);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isValidToken(token: string | undefined): Promise<boolean> {
  const pass = process.env.OMA_PASSCODE;
  if (!pass) return process.env.NODE_ENV !== "production"; // open in local dev until a passcode is set
  if (!token) return false;
  return token === (await passcodeToken(pass));
}
