import { createRemoteJWKSet, jwtVerify } from 'jose';

const KC_BASE_URL = process.env.KC_BASE_URL;
const KC_REALM = process.env.KC_REALM;
const jwks = createRemoteJWKSet(new URL(`${KC_BASE_URL}/realms/${KC_REALM}/protocol/openid-connect/certs`));

export async function requireAppAdmin(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'missing token' });

    const validIssuers = [
      `${KC_BASE_URL}/realms/${KC_REALM}`,
      `http://localhost:8080/realms/${KC_REALM}`,
      `http://keycloak:8080/realms/${KC_REALM}`
    ];
    const { payload } = await jwtVerify(token, jwks, {
      issuer: validIssuers
    });

    const realmRoles = payload.realm_access?.roles ?? [];
    if (!realmRoles.includes('app-admin')) return res.status(403).json({ error: 'forbidden' });

    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid token', detail: e.message });
  }
}
