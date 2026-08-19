// Google OAuth helpers — sin dependencia externa; usamos fetch directo.

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export interface GoogleEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  WEB_URL: string;
}

export interface AuthRedirectEnv extends GoogleEnv {
  // URL absoluta al endpoint de callback en este Worker.
  // Provista por el caller (request.url + c.req.path) o fija en deploy.
  CALLBACK_URL?: string;
}

function requireEnv(env: GoogleEnv): { clientId: string; clientSecret: string } {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET son requeridos");
  }
  return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
}

export function buildAuthRedirectUrl(env: AuthRedirectEnv, callbackUrl: string): string {
  const { clientId } = requireEnv(env);
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", callbackUrl);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "select_account");
  u.searchParams.set("state", cryptoRandomState());
  return u.toString();
}

export async function exchangeCodeForToken(
  env: GoogleEnv,
  code: string,
  callbackUrl: string,
): Promise<{ accessToken: string }> {
  const { clientId, clientSecret } = requireEnv(env);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return { accessToken: data.access_token };
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google userinfo failed: ${res.status}`);
  }
  const d = (await res.json()) as {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
  };
  return {
    sub: d.sub,
    email: d.email,
    name: d.name ?? null,
    picture: d.picture ?? null,
  };
}

function cryptoRandomState(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
