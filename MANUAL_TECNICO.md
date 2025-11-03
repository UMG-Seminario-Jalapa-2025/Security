# MANUAL TÉCNICO - SISTEMA DE AUTENTICACIÓN Y AUTORIZACIÓN DISTRIBUIDO

## 1. INTRODUCCIÓN

### 1.1 Objetivo del Sistema
Sistema distribuido que implementa Single Sign-On (SSO) y Control de Acceso Basado en Roles (RBAC) utilizando Keycloak como proveedor de identidad y Redis como sistema de caché centralizado.

### 1.2 Alcance
Este manual técnico describe la arquitectura, componentes, configuración y despliegue del sistema de autenticación y autorización basado en microservicios.

---

## 2. ARQUITECTURA DEL SISTEMA

### 2.1 Componentes Principales

#### 2.1.1 API Gateway (Puerto 8081)
- **Función**: Punto de entrada único para todas las solicitudes
- **Tecnología**: Node.js 14, Express 4.18.2
- **Características**:
  - Rate limiting (100 solicitudes por minuto por IP)
  - Autenticación mediante tokens JWT
  - Proxy inverso hacia microservicios
  - Caché de datos de usuario en Redis
  - CORS habilitado

#### 2.1.2 Auth Service (Puerto 8083)
- **Función**: Gestión de autenticación y tokens
- **Tecnología**: Node.js 14, Express 4.13.3
- **Características**:
  - Login de usuarios
  - Renovación de tokens
  - Verificación de tokens
  - Cierre de sesión
  - Suspensión de usuarios (admin)

#### 2.1.3 Admin Service (Puerto 8084)
- **Función**: Administración de usuarios y roles
- **Tecnología**: Node.js 18, Express 5.1.0
- **Características**:
  - CRUD de usuarios
  - CRUD de roles
  - Asignación de roles a usuarios
  - Gestión de grupos de usuarios
  - Registro público de usuarios

#### 2.1.4 Keycloak (Puerto 8080)
- **Versión**: 23.0.6
- **Base de datos**: PostgreSQL 16.2
- **Función**: Servidor de identidad y gestión de acceso

#### 2.1.5 Redis/Dragonfly
- **Puerto**: 6379
- **Función**: Caché centralizado para datos de sesión y usuarios

#### 2.1.6 Servicios de Negocio
- Business Partners Service (Puerto 8082)
- Employee Service (Puerto 8085)
- Customer Service (Puerto 8086)
- Ticket Service (Puerto 8087)

---

## 3. CONFIGURACIÓN DEL SISTEMA

### 3.1 Variables de Entorno Requeridas

#### Configuración de Keycloak
```
POSTGRES_DB=nombre_base_datos
POSTGRES_USER=usuario_postgres
POSTGRES_PASSWORD=contraseña_postgres
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=contraseña_admin
KEYCLOAK_HOSTNAME=localhost
KEYCLOAK_PORT=8080
KEYCLOAK_AUTH_SERVER_URL=http://keycloak:8080
KEYCLOAK_REALM=nombre_realm
KEYCLOAK_CLIENT_ID_APP=id_cliente
KEYCLOAK_CLIENT_SECRET=secreto_cliente
```

#### Configuración de Redis
```
REDIS_HOST=redis
REDIS_PORT=6379
```

#### URLs de Servicios
```
AUTH_URL=http://auth-service:8083
ADMIN_URL=http://admin-service:8084
BUSINESS_PARTNERS_URL=http://business-partners-service:8082
EMPLOYEES_URL=http://employee-service:8085
CUSTOMERS_URL=http://customer-service:8086
TICKETS_URL=http://ticket-service:8087
```

### 3.2 Configuración de Admin Service

**Variables específicas:**
```
KC_BASE_URL=URL_base_keycloak
KC_REALM=nombre_realm
KC_PROV_ID=id_cliente_proveedor
KC_PROV_SECRET=secreto_proveedor
```

**Roles permitidos en el sistema:**
- patient
- doctor
- staff
- app-admin
- client

---

## 4. DESPLIEGUE

### 4.1 Despliegue Local con Docker Compose

**Iniciar servicios:**
```bash
docker-compose up --build -d
```

**Detener servicios:**
```bash
docker-compose down
```

#### Servicios incluidos en Docker Compose:
1. **PostgreSQL** - Base de datos para Keycloak
2. **MySQL** - Base de datos de prueba (puerto 3306)
3. **Keycloak** - Servidor de identidad
4. **Redis** - Caché
5. **API Gateway** - Punto de entrada
6. **Auth Service** - Servicio de autenticación
7. **Admin Service** - Servicio de administración
8. **Business Partners Service** - Microservicio de negocio
9. **Customer Service** - Microservicio de clientes
10. **Employee Service** - Microservicio de empleados
11. **Ticket Service** - Microservicio de tickets

### 4.2 Despliegue en Kubernetes

El sistema utiliza Helm Charts para despliegue en Kubernetes con las siguientes características:

#### API Gateway
- **Imagen**: `seminariojalapa/api-gateway:latest`
- **Réplicas**: 1
- **Puerto contenedor**: 3000
- **Recursos solicitados**: CPU 30m, Memoria 100Mi
- **Ingress**: Habilitado en dominio `one21.app` con TLS
- **Dragonfly Cache**: Integrado como StatefulSet con persistencia de 2Gi

**Probes configurados:**
- Liveness: TCP socket en puerto 3000
- Readiness: TCP socket en puerto 3000, 5s intervalo
- Startup: TCP socket en puerto 3000, 6s delay inicial

#### Auth Service
- **Imagen**: `seminariojalapa/auth-service:prod`
- **Réplicas**: 1
- **Puerto contenedor**: 8083
- **Recursos solicitados**: CPU 30m, Memoria 100Mi
- **Ingress**: Habilitado con TLS
- **Keycloak integrado**: Versión 23.0.6 con MySQL

**Probes Keycloak:**
- Liveness: HTTP GET /health/live, 30s delay
- Readiness: HTTP GET /health/ready, 30s delay
- Startup: HTTP GET /health/ready, 60s delay, 60 intentos

#### Admin Service
- **Imagen**: `seminariojalapa/admin-service:1`
- **Réplicas**: 1
- **Puerto contenedor**: 3000
- **Puerto servicio**: 3004
- **Recursos solicitados**: CPU 30m, Memoria 100Mi

**Configuración de seguridad común:**
```yaml
securityContext:
  seccompProfile:
    type: RuntimeDefault
  capabilities:
    drop:
      - ALL
    add:
      - SETPCAP
      - MKNOD
      - AUDIT_WRITE
      - CHOWN
      - DAC_OVERRIDE
      - FOWNER
      - FSETID
      - KILL
      - SETGID
      - SETUID
      - NET_BIND_SERVICE
      - SYS_CHROOT
      - SETFCAP
      - SYS_PTRACE
```

#### Estrategia de distribución de pods:
```yaml
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: ScheduleAnyway

affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        topologyKey: kubernetes.io/hostname
```

---

## 5. CI/CD CON GITHUB ACTIONS

### 5.1 Workflows Implementados

Cada servicio tiene dos workflows:
- Despliegue a producción (rama `main`)
- Despliegue a desarrollo (rama específica de desarrollo)

#### Fases del Pipeline:

**1. Build**
- Runner: Ubuntu-latest
- Node.js: Versión 18.x
- Acciones:
  - Checkout del código
  - Instalación de dependencias con `npm ci`
  - Build del proyecto
  - Upload de artefactos

**2. Test** (Auth Service y Admin Service)
- Descarga de artefactos de build
- Ejecución de tests con `npm test`

**3. Docker Build & Push**
- Ambiente: ONE21
- Login a DockerHub con credenciales secretas
- Build de imagen Docker con tag basado en `github.run_number`
- Push a DockerHub

**4. Deploy to Kubernetes**
- Ambiente: ONE21
- Instalación de kubectl (versión estable)
- Instalación de Helm 3
- Configuración de kubeconfig desde secreto
- Despliegue con Helm upgrade --install

### 5.2 Triggers de Workflows

#### API Gateway
```yaml
on:
  push:
    branches: ['main']
    paths:
      - 'api-gateway/**'
  workflow_dispatch:
```

#### Auth Service
```yaml
on:
  push:
    branches: ['main']
    paths:
      - 'auth-service/**'
  workflow_dispatch:
```

#### Admin Service
```yaml
on:
  push:
    branches: ['main']
    paths:
      - 'admin-service/**'
  workflow_dispatch:
```

### 5.3 Secretos Requeridos en GitHub

- `DOCKERHUB_TOKEN`: Token de autenticación de DockerHub
- `DOCKERHUB_USERNAME`: Usuario de DockerHub
- `KUBECONFIG`: Configuración de acceso al cluster de Kubernetes

### 5.4 Variables de Entorno en GitHub

- `NAMESPACE`: Namespace de Kubernetes para despliegue
- `API_GATEWAY_DEPLOY_NAME`: Nombre del release de Helm para API Gateway
- `AUTH_SERVICE_DEPLOY_NAME`: Nombre del release de Helm para Auth Service
- `ADMIN_SERVICE_DEPLOY_NAME`: Nombre del release de Helm para Admin Service

### 5.5 Concurrencia

Cada workflow implementa control de concurrencia:
```yaml
concurrency:
  group: <service-name>-deploy-one21
  cancel-in-progress: true
```

---

## 6. FLUJOS DE OPERACIÓN

### 6.1 Flujo de Autenticación

1. **Usuario inicia sesión**
   - Endpoint: `POST /apis/auth/login`
   - Body: `{ "username": "usuario", "password": "contraseña" }`
   - API Gateway enruta a Auth Service
   - Auth Service valida credenciales con Keycloak
   - Keycloak genera access_token y refresh_token
   - Respuesta incluye tokens y datos adicionales

2. **Caché de token**
   - API Gateway extrae TTL del JWT (campo `exp`)
   - Calcula tiempo de vida: `ttl = exp - now`
   - Almacena datos en Redis con comando: `SET token datos EX ttl`
   - TTL por defecto: 300 segundos si no se puede extraer

### 6.2 Flujo de Autorización

1. **Solicitud a servicio protegido**
   - Cliente envía header: `Authorization: Bearer <token>`
   - API Gateway intercepta con `authMiddleware`

2. **Verificación en authMiddleware**
   ```javascript
   // Verifica header Authorization
   const token = authHeader.split(" ")[1];
   
   // Busca en caché
   let cachedData = await redisClient.get(token);
   if (cachedData) return next();
   
   // Si no está en caché, verifica con Auth Service
   const response = await axios.get(`${authUrl}/verifyToken`, {
     headers: { Authorization: `Bearer ${token}` }
   });
   
   // Extrae TTL del JWT
   const jwtPayload = JSON.parse(Buffer.from(token.split('.')[1], 'base64'));
   const ttl = jwtPayload.exp - Math.floor(Date.now() / 1000);
   
   // Almacena en caché
   await redisClient.set(token, JSON.stringify(data), 'EX', ttl);
   ```

3. **Verificación en Auth Service**
   - Endpoint: `GET /verifyToken`
   - Llama al endpoint de introspección de Keycloak
   - URL: `{KEYCLOAK_URL}/realms/{REALM}/protocol/openid-connect/token/introspect`
   - Valida campo `active` en respuesta
   - Retorna datos del token si es válido

### 6.3 Flujo de Renovación de Token

1. **Cliente solicita renovación**
   - Endpoint: `POST /apis/auth/refreshToken`
   - Body: `{ "refreshToken": "refresh_token_actual" }`

2. **Auth Service procesa renovación**
   - Llama a Keycloak con grant_type=refresh_token
   - Keycloak valida refresh_token
   - Genera nuevo access_token
   - Retorna nuevo access_token y refresh_token

### 6.4 Rutas Públicas (Sin Autenticación)

#### API Gateway rutas públicas para partners:
- `/apis/partners/municipalities`
- `/apis/partners/departments`
- `/apis/partners/countries`
- `/apis/partners/register`

#### Admin Service rutas públicas:
- `GET /check-email/:email` - Verificar si un correo existe
- `POST /register` - Registro de nuevos usuarios con rol 'client'

### 6.5 Rate Limiting

**Configuración en API Gateway:**
```javascript
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,    // 1 minuto
  max: 100,                // 100 solicitudes
  message: "Too many requests, please try again later."
});
```

---

## 7. API ENDPOINTS

### 7.1 Auth Service Endpoints

#### Login
```http
POST /login
Content-Type: application/json

{
  "username": "usuario",
  "password": "contraseña"
}
```

**Respuesta exitosa (200):**
```json
{
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token",
  "expires_in": 300,
  "token_type": "Bearer"
}
```

#### Refresh Token
```http
POST /refreshToken
Content-Type: application/json

{
  "refreshToken": "refresh_token_actual"
}
```

#### Verify Token
```http
GET /verifyToken
Authorization: Bearer <access_token>
```

**Respuesta exitosa (200):**
```json
{
  "active": true,
  "exp": 1234567890,
  "iat": 1234567890,
  "realm_access": {
    "roles": ["app-admin"]
  }
}
```

#### Signout
```http
GET /signout
Session: session_con_refresh_token
```

#### Suspend User (Admin)
```http
PATCH /suspend
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "userId": "id_usuario"
}
```

### 7.2 Admin Service Endpoints

#### Verificar Email (Público)
```http
GET /check-email/:email
```

**Respuesta:**
```json
{
  "exists": true,
  "email": "usuario@example.com"
}
```

#### Registro de Usuario (Público)
```http
POST /register
Content-Type: application/json

{
  "email": "usuario@example.com",
  "firstName": "Nombre",
  "lastName": "Apellido"
}
```

**Nota**: Solo asigna el rol 'client' y envía email de verificación

#### Crear Usuario (Admin)
```http
POST /users
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "username": "usuario_demo",
  "email": "usuario.demo@example.com",
  "firstName": "Juan",
  "lastName": "Pérez",
  "realmRoles": ["patient"],
  "groups": ["/pacientes"],
  "sendActionsEmail": true
}
```

#### Listar Usuarios (Admin)
```http
GET /users
Authorization: Bearer <admin_token>
```

#### Obtener Usuario por Email (Admin)
```http
GET /users/email/:email
Authorization: Bearer <admin_token>
```

#### Actualizar Usuario (Admin)
```http
PUT /users/:id
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "firstName": "NuevoNombre",
  "lastName": "NuevoApellido"
}
```

#### Eliminar Usuario (Admin)
```http
DELETE /users/:id
Authorization: Bearer <admin_token>
```

#### Actualizar Roles de Usuario (Admin)
```http
PUT /users/:id/roles
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "realmRoles": ["doctor", "staff"]
}
```

#### Actualizar Grupos de Usuario (Admin)
```http
PUT /users/:id/groups
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "groups": ["/pacientes", "/medicos"]
}
```

#### Actualizar Roles por Email (Admin)
```http
PUT /users/by-email/roles
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "email": "usuario@example.com",
  "realmRoles": ["doctor"]
}
```

#### Actualizar Grupos por Email (Admin)
```http
PUT /users/by-email/groups
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "email": "usuario@example.com",
  "groups": ["/medicos"]
}
```

#### Crear Rol (Admin)
```http
POST /roles
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "doctor",
  "description": "Doctor role"
}
```

#### Listar Roles (Admin)
```http
GET /roles
Authorization: Bearer <admin_token>
```

#### Actualizar Rol (Admin)
```http
PUT /roles/:name
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "newName": "senior-doctor",
  "description": "Senior doctor with extended privileges"
}
```

#### Eliminar Rol (Admin)
```http
DELETE /roles/:name
Authorization: Bearer <admin_token>
```

### 7.3 Middleware de Autenticación Admin

**Verificación en Admin Service:**
```javascript
// Requiere rol 'app-admin' en realm_access
// Verifica firma JWT contra JWKS de Keycloak
// Valida issuer contra múltiples valores:
// - ${KC_BASE_URL}/realms/${KC_REALM}
// - http://localhost:8080/realms/${KC_REALM}
// - http://keycloak:8080/realms/${KC_REALM}
```

---

## 8. INTEGRACIÓN CON KEYCLOAK

### 8.1 Configuración de Admin Service

**Autenticación como cliente proveedor:**
```javascript
await kc.auth({
  grantType: 'client_credentials',
  clientId: PROV_CLIENT_ID,
  clientSecret: PROV_SECRET
});
```

### 8.2 Operaciones Implementadas

#### Crear Usuario
1. Crear usuario básico en Keycloak
2. Enviar acciones por email (VERIFY_EMAIL, UPDATE_PASSWORD)
3. Asignar roles del realm permitidos
4. Agregar a grupos especificados

#### Gestión de Roles
- Filtro de roles permitidos: `ALLOWED_REALM_ROLES`
- Solo roles en la whitelist pueden ser asignados
- Búsqueda de roles por nombre
- Mapeo de roles a usuarios

#### Gestión de Grupos
- Búsqueda de grupos por path
- Asignación de usuarios a grupos por groupId

---

## 9. MANEJO DE ERRORES

### 9.1 Códigos de Error Comunes

**Auth Service:**
- 401: Credenciales inválidas, token inválido o expirado
- 500: Error de servidor, fallo en comunicación con Keycloak

**Admin Service:**
- 400: Parámetros faltantes o inválidos
- 401: Token faltante o inválido
- 403: Permisos insuficientes (requiere rol app-admin)
- 404: Usuario o recurso no encontrado
- 500: Error en operación con Keycloak

**API Gateway:**
- 401: Header de autorización faltante, token inválido
- 429: Demasiadas solicitudes (rate limit excedido)

### 9.2 Middleware de Manejo de Errores

**Auth Service:**
```javascript
const errorHandlingMiddleware = (err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).send(err.message || "Internal server error");
};
```

**Admin Service:**
```javascript
export function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(500).json({ 
    error: 'internal_error', 
    detail: err.message 
  });
}
```

---

## 10. SEGURIDAD

### 10.1 Autenticación JWT

**Características:**
- Tokens firmados por Keycloak
- Validación de firma con JWKS
- Verificación de expiración (campo `exp`)
- Verificación de issuer
- Almacenamiento seguro en Redis con TTL

### 10.2 CORS

**API Gateway y Auth Service:**
```javascript
app.use(cors());  // Permite todos los orígenes en configuración actual
```

**Configuración comentada para producción:**
```javascript
app.use(cors({
  origin: 'http://localhost:5173',
  methods: 'GET,POST,PUT,PATCH,DELETE',
  credentials: true
}));
```

### 10.3 Trust Proxy

Ambos servicios configurados para confiar en proxies:
```javascript
app.set('trust proxy', 1);
```

### 10.4 Capacidades de Seguridad en Kubernetes

**Perfil Seccomp:** RuntimeDefault

**Capabilities eliminadas:**
- ALL (se eliminan todas por defecto)

**Capabilities permitidas:**
- SETPCAP, MKNOD, AUDIT_WRITE
- CHOWN, DAC_OVERRIDE, FOWNER
- FSETID, KILL, SETGID, SETUID
- NET_BIND_SERVICE, SYS_CHROOT
- SETFCAP, SYS_PTRACE

---

## 11. MONITOREO Y SALUD

### 11.1 Health Checks en Kubernetes

**Liveness Probe:**
- Verifica que el contenedor está vivo
- Reinicia el pod si falla
- Tipo: TCP Socket o HTTP GET

**Readiness Probe:**
- Verifica que el contenedor está listo para recibir tráfico
- Remueve del balanceo de carga si falla
- Intervalo: 5 segundos
- Timeout: 5 segundos

**Startup Probe:**
- Verifica el inicio exitoso de la aplicación
- Deshabilita otras probes hasta que tenga éxito
- Delay inicial variable por servicio

### 11.2 Logs

**Todos los servicios implementan logging de:**
- Errores de autenticación
- Operaciones en Keycloak
- Errores de conexión a Redis
- Solicitudes rechazadas por rate limiting

---

## 12. ESCALABILIDAD

### 12.1 Escalado Horizontal

**Configuración de Autoscaling:**
```yaml
autoscaling:
  enabled: false          # Deshabilitado por defecto
  minReplicas: 1
  maxReplicas: 100
  targetCPUUtilizationPercentage: 80
```

### 12.2 Distribución de Carga

**TopologySpreadConstraints:**
- Distribuye pods en diferentes nodos
- maxSkew: 1
- whenUnsatisfiable: ScheduleAnyway

**Pod AntiAffinity:**
- Preferencia para evitar colocación en mismo nodo
- Weight: 100

### 12.3 Redis como Caché Compartido

- Permite escalado horizontal de API Gateway
- Estado de sesión compartido entre instancias
- TTL automático basado en expiración de tokens

---

## 13. MANTENIMIENTO

### 13.1 Actualización de Servicios

**Mediante GitHub Actions:**
1. Push a rama `main` con cambios en directorio del servicio
2. Pipeline automático ejecuta build, test y despliegue
3. Helm realiza upgrade con estrategia rolling update

**Comando manual de Helm:**
```bash
helm upgrade --install <release-name> \
  -f ./charts/values.yaml \
  ./charts/ \
  --namespace <namespace> \
  --set image.tag=<nueva-version> \
  --wait --atomic --timeout 5m
```

### 13.2 Rollback

```bash
helm rollback <release-name> <revision>
```

### 13.3 Backup de Configuración

**Secretos de Kubernetes a respaldar:**
- `keycloak-secret`: Credenciales de Keycloak
- `keycloak-relm-auth-secret`: Configuración de realm
- `admin-service-secret`: Configuración de Admin Service
- Certificados TLS para ingress

**Base de datos PostgreSQL:**
- Realizar backup regular de la base de datos de Keycloak
- Volúmenes persistentes deben estar respaldados

---

## 14. DEPENDENCIAS PRINCIPALES

### 14.1 Admin Service
```json
{
  "@keycloak/keycloak-admin-client": "^26.3.3",
  "express": "^5.1.0",
  "jose": "5"
}
```

### 14.2 Auth Service
```json
{
  "@keycloak/keycloak-admin-client": "^21.0.2",
  "axios": "^1.3.4",
  "express": "^4.13.3",
  "jsonwebtoken": "^9.0.0",
  "dotenv": "^16.0.3",
  "cors": "^2.8.5"
}
```

### 14.3 API Gateway
```json
{
  "axios": "^1.3.4",
  "express": "^4.18.2",
  "express-rate-limit": "^6.7.0",
  "http-proxy-middleware": "^2.0.6",
  "ioredis": "^5.3.1",
  "cors": "^2.8.5"
}
```

---

## 15. CONSIDERACIONES DE PRODUCCIÓN

### 15.1 Variables de Configuración Críticas

**Deben configurarse en secretos de Kubernetes:**
- Credenciales de Keycloak (admin, base de datos)
- Client secrets de aplicaciones
- Contraseñas de base de datos

### 15.2 TLS/SSL

**Ingress configurado con:**
- Cert-manager para emisión automática de certificados
- Let's Encrypt como CA
- Nombres de secretos TLS específicos por servicio

### 15.3 Límites de Recursos

**Producción debe configurar:**
```yaml
resources:
  limits:
    cpu: "1"
    memory: "1Gi"
  requests:
    cpu: "30m"
    memory: "100Mi"
```

### 15.4 Persistencia

**Dragonfly Cache:**
- Persistencia habilitada: 2Gi
- StorageClass configurable

**Keycloak:**
- Requiere PostgreSQL con volumen persistente

---

## 16. RESOLUCIÓN DE PROBLEMAS

### 16.1 Token Inválido

**Verificar:**
1. Token no expirado
2. Keycloak está operativo
3. Redis está respondiendo
4. Configuración de issuer es correcta

### 16.2 Usuario No Puede Acceder

**Verificar:**
1. Usuario tiene rol requerido
2. Token está en caché de Redis
3. Servicio de autenticación responde

### 16.3 Rate Limit Alcanzado

**Solución:**
- Esperar 1 minuto
- Configurar límite más alto si es legítimo
- Implementar retry con exponential backoff

### 16.4 Servicio No Responde

**Pasos de diagnóstico:**
```bash
# Verificar estado de pods
kubectl get pods -n <namespace>

# Ver logs
kubectl logs <pod-name> -n <namespace>

# Verificar configuración
kubectl describe pod <pod-name> -n <namespace>

# Verificar conectividad
kubectl exec -it <pod-name> -n <namespace> -- curl http://keycloak:8080
```

---

## 17. ANEXOS

### 17.1 Puertos Utilizados

| Servicio | Puerto | Protocolo |
|----------|--------|-----------|
| Keycloak | 8080 | HTTP |
| API Gateway | 8081 | HTTP |
| Auth Service | 8083 | HTTP |
| Admin Service | 8084 | HTTP |
| Redis/Dragonfly | 6379 | Redis Protocol |
| Business Partners | 8082 | HTTP |
| Employee Service | 8085 | HTTP |
| Customer Service | 8086 | HTTP |
| Ticket Service | 8087 | HTTP |
| PostgreSQL | 5432 | PostgreSQL |
| MySQL (Dev) | 3306 | MySQL |

### 17.2 Roles del Sistema

| Rol | Descripción |
|-----|-------------|
| app-admin | Administrador con acceso completo |
| patient | Rol de paciente |
| doctor | Rol de doctor |
| staff | Rol de personal |
| client | Rol de cliente (asignado en registro público) |

### 17.3 URLs de Acceso (Producción)

- API Gateway: `https://one21.app/apis`
- Keycloak: `https://keycloak.one21.app`
- Auth Service: `https://one21.app/apis/auth`
- Admin Service: `https://one21.app/apis/admin`

---

## CONTROL DE VERSIONES

| Versión | Fecha | Descripción |
|---------|-------|-------------|
| 1.0 | 2025-10-30 | Versión inicial del manual técnico |

---

**Documento generado basado en el análisis del código fuente del repositorio Security**
**Branch:** feature/add-github-actions
**Organización:** UMG-Seminario-Jalapa-2025
