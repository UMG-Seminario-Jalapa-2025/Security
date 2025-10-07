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

export async function deleteRoleByName(roleName) {
  await authProvisioner();
  await kc.roles.delByName({
    name: roleName
  });
  return { message: `Role '${roleName}' deleted successfully` };
}

export async function updateRoleByName(roleName, { newName, description }) {
  await authProvisioner();
  
  // Primero obtenemos el rol actual
  const currentRole = await kc.roles.findOneByName({
    name: roleName
  });
  
  if (!currentRole) {
    throw new Error(`Role '${roleName}' not found`);
  }
  
  // Actualizamos el rol
  await kc.roles.updateByName(
    { name: roleName },
    {
      name: newName || currentRole.name,
      description: description !== undefined ? description : currentRole.description
    }
  );
  
  return { 
    message: `Role '${roleName}' updated successfully`,
    updatedRole: {
      name: newName || currentRole.name,
      description: description !== undefined ? description : currentRole.description
    }
  };
}
