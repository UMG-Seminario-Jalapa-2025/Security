import kc, { authProvisioner } from '../config/keycloak.js';

export async function createRole({ name, description }) {
  await authProvisioner();
  const role = await kc.roles.create({
    name,
    description
  });
  return role;
}

export async function getAllRoles() {
  await authProvisioner();
  const roles = await kc.roles.find();
  return roles;
}
