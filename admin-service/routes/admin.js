import express from 'express';
import { requireAppAdmin } from '../middleware/auth.js';
import { createUser, getAllUsers, deleteUser, getUserByEmail, updateUser, updateUserRoles, updateUserGroups } from '../services/userService.js';
import { createRole, getAllRoles } from '../services/roleService.js';

const router = express.Router();
// Endpoint público para registro de usuario (sin token)
router.post('/register', async (req, res) => {
  try {
    const { email, firstName, lastName } = req.body;
    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: 'email, firstName y lastName son requeridos' });
    }
    // Solo permite el rol 'client', requiere nombre y apellido
    const realmRoles = ['client'];
    const newUser = await createUser({
      username: email,
      email,
      firstName,
      lastName,
      realmRoles,
      groups: [],
      sendActionsEmail: true
    });
    return res.status(201).json(newUser);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'keycloak_error', detail: err.message });
  }
});

router.post('/users', requireAppAdmin, async (req, res) => {
  try {
    const result = await createUser(req.body);
    return res.status(201).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'keycloak_error', detail: err.message });
  }
});

router.get('/users', requireAppAdmin, async (req, res) => {
  try {
    const users = await getAllUsers();
    return res.status(200).json(users);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'keycloak_error', detail: err.message });
  }
});

router.delete('/users/:id', requireAppAdmin, async (req, res) => {
  try {
    const result = await deleteUser(req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'keycloak_error', detail: err.message });
  }
});

router.post('/roles', requireAppAdmin, async (req, res) => {
  try {
    const result = await createRole(req.body);
    return res.status(201).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'keycloak_error', detail: err.message });
  }
});

router.get('/roles', requireAppAdmin, async (req, res) => {
  try {
    const roles = await getAllRoles();
    return res.status(200).json(roles);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'keycloak_error', detail: err.message });
  }
});

router.get('/users/email/:email', requireAppAdmin, async (req, res) => {
  try {
    const user = await getUserByEmail(req.params.email);
    if (!user) return res.status(404).json({ error: 'not_found' });
    return res.status(200).json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'keycloak_error', detail: err.message });
  }
});

router.put('/users/:id', requireAppAdmin, async (req, res) => {
  try {
    const result = await updateUser(req.params.id, req.body);
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'keycloak_error', detail: err.message });
  }
});

// Editar roles por email
router.put('/users/by-email/roles', requireAppAdmin, async (req, res) => {
  try {
    const { email, realmRoles } = req.body;
    const usuario = await getUserByEmail(email);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    const result = await updateUserRoles(usuario.id, realmRoles);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Error en /users/by-email/roles:', err);
    return res.status(500).json({ error: 'keycloak_error', detail: err.message });
  }
});

// Editar grupos por email
router.put('/users/by-email/groups', requireAppAdmin, async (req, res) => {
  try {
    const { email, groups } = req.body;
    const usuario = await getUserByEmail(email);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    const result = await updateUserGroups(usuario.id, groups);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Error en /users/by-email/groups:', err);
    return res.status(500).json({ error: 'keycloak_error', detail: err.message });
  }
});

router.put('/users/:id/roles', requireAppAdmin, async (req, res) => {
  try {
    const result = await updateUserRoles(req.params.id, req.body.realmRoles);
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'keycloak_error', detail: err.message });
  }
});

router.put('/users/:id/groups', requireAppAdmin, async (req, res) => {
  try {
    const result = await updateUserGroups(req.params.id, req.body.groups);
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'keycloak_error', detail: err.message });
  }
});

export default router;
