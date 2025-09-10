import KcAdminClient from '@keycloak/keycloak-admin-client';

const KC_BASE_URL = process.env.KC_BASE_URL;
const KC_REALM = process.env.KC_REALM;
const PROV_CLIENT_ID = process.env.KC_PROV_ID;
const PROV_SECRET = process.env.KC_PROV_SECRET;

const kc = new KcAdminClient({ baseUrl: KC_BASE_URL, realmName: KC_REALM });

export async function authProvisioner() {
  await kc.auth({
    grantType: 'client_credentials',
    clientId: PROV_CLIENT_ID,
    clientSecret: PROV_SECRET,
  });
}

export default kc;
