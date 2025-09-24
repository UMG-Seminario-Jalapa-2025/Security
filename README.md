# Single Sign-On (SSO) and Role-Based Access Control (RBAC) in a Distributed System

This document provides an overview of a distributed system that implements Single Sign-On (SSO) and Role-Based Access Control (RBAC) using Keycloak and Redis.

## System Components
#### 1. API Gateway
- **Rate Limiting**: Limits the number of requests from a single IP address within a specific time window to prevent abuse.
- **Authentication**: Validates user access tokens before forwarding requests to backend services.
- **Proxying Requests**: Routes requests to the appropriate backend services based on the request path.
- **Data Caching**: Caches user data, such as user roles, in a centralized cache with a Time-To-Live (TTL) equal to or less than the token's expiration time.

#### 2. Authentication Service
- **User Login**: Authenticates users with their username and password, generating access and refresh tokens via Keycloak.
- **Token Refreshing**: Allows clients to refresh access tokens using refresh tokens.
- **Token Verification**: Validates access tokens using Keycloak’s introspection endpoint to ensure correct signing and active user status.
- **Admin Routes**: Provides routes for administrative tasks, such as fetching and suspending users.

#### 3. Service A
- **Authentication**: Retrieves user data from Redis using the access token as the key.
- **Authorization**: Uses middleware to verify if the user has the required role to access specific routes.

#### 4. Keycloak Server
- **User Authentication**: Verifies user credentials and generates access tokens.
- **User Management**: Handles user accounts, roles, and permissions.
- **Role Management**: Manages user roles and permissions.
- **Multiple Login Strategies**: Supports various login methods.

#### 5. Redis Cache
- **Centralized Cache Management**: Manages cached user data centrally to improve performance.

## Request-Response Flow
### 1. User Login:

- User logs in via username/password or Google OAuth. The API Gateway routes the request to the Authentication Service.
- For username/password, the Authentication Service generates tokens using Keycloak. For Google OAuth, the Authentication Service exchanges the Google token for Keycloak tokens.
- Tokens are returned to the API Gateway, which stores user data in the cache.

### 2. Accessing Service A:

- The API Gateway checks for the access token and routes the request to Service A if valid.
- Service A retrieves user data from the cache and applies RBAC as necessary.

### 3. Subsequent Requests:
- Users can continue using their existing access token for subsequent requests, with the same flow as above.

### 4. Additional Auth Service Routes:
- Refresh Token: Issues new access tokens using a refresh token.
- Verify Token: Verifies the validity of a token if it is not found in the cache.

## User Suspension
### Suspension Process:
- An admin suspends a user using the “suspend user” route.
- The Authentication Service disables the user account in Keycloak and evicts the token from the cache.
- If a suspended user attempts to access protected resources, the API Gateway verifies the token with the Authentication Service.
- The Authentication Service confirms the token’s invalidity with Keycloak, resulting in the API Gateway rejecting the request.

## Design Decisions
1. **Cache Reading in API Gateway**: Reduces latency by avoiding an extra hop to the Authentication Service.
2. **Service-Specific RBAC**: Implements RBAC tailored to each service’s requirements.
3. **Security**: Immediate reflection of user suspension and caching of tokens for reduced latency.
4. **Stateless Authentication**: Ensures scalability and stateless authentication using Keycloak.
5. **Centralized Cache Management**: Enhances performance and simplifies user data management with Redis.

## Ports

- **Keycloak**: 8080
- **Api-Gateway**: 8081
- **Auth-Service App**: 8083
- **Redis**: 6379
- **Apps**: 8090

# How to run it

### up
```
docker-compose up --build -d
```

### down
```
docker-compose down 
```

### Example .env File

Below is an example of the `.env` file configuration for this project. Replace the placeholder values with your actual credentials and settings:

```properties
# Keycloak configuration
POSTGRES_DB=example_db
POSTGRES_USER=example_user
POSTGRES_PASSWORD=example_password
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin_password
KEYCLOAK_HOSTNAME=localhost
KEYCLOAK_PORT=8080
KEYCLOAK_AUTH_SERVER_URL=http://keycloak:8080

KEYCLOAK_REALM=example_realm
KEYCLOAK_CLIENT_ID_APP=example_client_id
KEYCLOAK_CLIENT_SECRET=example_client_secret

# Redis configuration
REDIS_HOST=redis
REDIS_PORT=6379

# CRM configuration
AUTH_URL=http://auth-service:8083
SERVICE_CRM_URL=http://crm:8090

# Gatemaster CONFIGURATION
AUTH_URL=http://auth-service:8083
SERVICE_GATEMASTER_URL=http://gatemaster:8091

# MySQL configuration
SQL_SA_PASSWORD=example_sql_password
SQL_PORT=1433
```

## Ejemplos de uso de endpoints

### 1. Crear usuario
```sh
curl -X POST http://localhost:8081/api/admin/users \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "usuario_demo",
    "email": "usuario.demo@example.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "realmRoles": ["patient"],
    "groups": ["/pacientes"]
  }'
```

### 2. Obtener todos los usuarios
```sh
curl -X GET http://localhost:8081/api/admin/users \
  -H "Authorization: Bearer TU_TOKEN_JWT"
```

### 3. Obtener usuario por email
```sh
curl -X GET http://localhost:8081/api/admin/users/email/usuario.demo@example.com \
  -H "Authorization: Bearer TU_TOKEN_JWT"
```

### 4. Editar usuario por ID
```sh
curl -X PUT http://localhost:8081/api/admin/users/{id} \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"firstName": "NuevoNombre"}'
```

### 5. Eliminar usuario por ID
```sh
curl -X DELETE http://localhost:8081/api/admin/users/{id} \
  -H "Authorization: Bearer TU_TOKEN_JWT"
```

### 6. Editar roles por ID
```sh
curl -X PUT http://localhost:8081/api/admin/users/{id}/roles \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"realmRoles": ["doctor"]}'
```

### 7. Editar grupos por ID
```sh
curl -X PUT http://localhost:8081/api/admin/users/{id}/groups \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"groups": ["/pacientes"]}'
```

### 8. Editar roles por email
```sh
curl -X PUT http://localhost:8081/api/admin/users/by-email/roles \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"email": "usuario.demo@example.com", "realmRoles": ["doctor"]}'
```

### 9. Editar grupos por email
```sh
curl -X PUT http://localhost:8081/api/admin/users/by-email/groups \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"email": "usuario.demo@example.com", "groups": ["/pacientes"]}'
```

### 10. Crear rol
```sh
curl -X POST http://localhost:8081/api/admin/roles \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"name": "doctor", "description": "Doctor role"}'
```

### 11. Obtener todos los roles
```sh
curl -X GET http://localhost:8081/api/admin/roles \
  -H "Authorization: Bearer TU_TOKEN_JWT"
```