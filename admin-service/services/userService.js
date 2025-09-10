import kc, { authProvisioner } from '../config/keycloak.js';

const ALLOWED_REALM_ROLES = new Set(['patient','doctor','staff','app-admin']);

export async function createUser({ username, email, firstName, lastName, sendActionsEmail = true, realmRoles = [], groups = [] }) {
  await authProvisioner();

  // Crear usuario
  const { id } = await kc.users.create({
    username, email, firstName, lastName,
    enabled: true
  });

  // Acciones por email
  if (sendActionsEmail) {
    await kc.users.executeActionsEmail({
      id,
      actions: ['VERIFY_EMAIL', 'UPDATE_PASSWORD']
    });
  }

  // Asignar realm roles
  const wanted = realmRoles.filter(r => ALLOWED_REALM_ROLES.has(r));
  if (wanted.length) {
    const roleReps = await Promise.all(
      wanted.map(name => kc.roles.findOneByName({ name }))
    );
    await kc.users.addRealmRoleMappings({ id, roles: roleReps.filter(Boolean) });
  }

  // Agregar a grupos
  for (const path of groups) {
    const all = await kc.groups.find();
    const grp = all.find(g => g.path === path);
    if (grp) await kc.users.addToGroup({ id, groupId: grp.id });
  }

  return { id, username, email };
}

export async function getAllUsers() {
  await authProvisioner();
  const users = await kc.users.find();
  return users;
}

export async function deleteUser(id) {
  await authProvisioner();
  await kc.users.del({ id });
  return { deleted: true, id };
}

export async function getUserByEmail(email) {
  await authProvisioner();
  const users = await kc.users.find({ email });
  return users.length ? users[0] : null;
}

export async function updateUser(id, data) {
  await authProvisioner();
  await kc.users.update({ id }, data);
  return { updated: true, id };
}

export async function updateUserRoles(id, realmRoles = []) {
  await authProvisioner();
  const wanted = realmRoles.filter(r => ALLOWED_REALM_ROLES.has(r));
  if (wanted.length) {
    const roleReps = await Promise.all(
      wanted.map(name => kc.roles.findOneByName({ name }))
    );
    await kc.users.addRealmRoleMappings({ id, roles: roleReps.filter(Boolean) });
  }
  return { updatedRoles: wanted };
}

export async function updateUserGroups(id, groups = []) {
  await authProvisioner();
  for (const path of groups) {
    const all = await kc.groups.find();
    const grp = all.find(g => g.path === path);
    if (grp) await kc.users.addToGroup({ id, groupId: grp.id });
  }
  return { updatedGroups: groups };
}
