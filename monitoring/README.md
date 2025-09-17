# Instalación de Monitoreo en Kubernetes

## Requisitos previos
- Tener acceso a un clúster Kubernetes.
- Tener instalado Helm y kubectl.
- Tener instalado cert-manager en el clúster.

## Versiones utilizadas
- **kube-prometheus-stack**: v70.7.0
- **loki-stack**: v2.10.2
- **Loki imagen**: grafana/loki:2.9.3

## 1. Agregar repositorios Helm y actualizar
Primero agrega los repositorios necesarios:

```sh
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
```

## 2. Crear el namespace de monitoreo
Crea el namespace donde se instalará el stack de monitoreo:

```sh
kubectl create namespace monitoring
```

## 3. Crear el Issuer para certificados TLS
El archivo `issuer.yaml` crea un Issuer para Let's Encrypt:

```yaml
apiVersion: cert-manager.io/v1
kind: Issuer
metadata:
  name: letsencrypt-prod
  namespace: monitoring
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: umg.seminario.jalapa.2025@gmail.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

Aplica el Issuer:
```sh
kubectl apply -f issuer.yaml
```

## 4. Instalar kube-prometheus-stack con Helm
El archivo `grafana-prometheus-values.yaml` contiene la configuración personalizada para la instalación:

```sh
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring -f grafana-prometheus-values.yaml \
  --version=70.7.0
```

Esto instalará Prometheus, Grafana y alertas en el namespace `monitoring`.

**⚠️ IMPORTANTE - Configuración de Seguridad:**
Antes de aplicar la configuración, asegúrate de especificar una contraseña para el usuario admin en `grafana-prometheus-values.yaml`:

```yaml
adminUser: admin
adminPassword: "tu-password-aqui"
```

**Después de aplicar la configuración, por motivos de seguridad, cambia el valor de `adminPassword` a una cadena vacía:**

```yaml
adminUser: admin
adminPassword: ""
```

Esto evita que la contraseña quede expuesta en el repositorio de configuración.

## 5. Instalar Loki + Promtail para logs
Para el manejo de logs, instala Loki usando el archivo de configuración personalizado:

```sh
helm upgrade --install loki grafana/loki-stack \
  --namespace monitoring \
  -f loki-values.yaml \
  --version=2.10.2
```

## 6. Acceso y verificación
- Verifica que los pods estén corriendo:
  ```sh
  kubectl get pods -n monitoring
  ```
- Accede a Grafana y Prometheus según la configuración del Ingress.

## Archivos relevantes
- `issuer.yaml`: Configuración del Issuer para certificados TLS.
- `monitoring.yaml`: Configuración personalizada para kube-prometheus-stack.

## Recursos creados y estados óptimos

### Issuer y Certificados
```sh
# Verificar el estado del Issuer
kubectl get issuer -n monitoring
# Estado esperado: Ready = True

# Verificar certificados creados
kubectl get certificates -n monitoring
# Estado esperado: Ready = True

# Verificar secretos TLS
kubectl get secrets -n monitoring | grep tls
```

### Pods de kube-prometheus-stack
```sh
# Verificar todos los pods del stack
kubectl get pods -n monitoring
```

**Estados esperados:**
- `kube-prometheus-stack-grafana-*`: Running (1/1 Ready)
- `kube-prometheus-stack-kube-state-metrics-*`: Running (1/1 Ready)
- `kube-prometheus-stack-operator-*`: Running (1/1 Ready)
- `kube-prometheus-stack-prometheus-node-exporter-*`: Running (1/1 Ready)
- `prometheus-kube-prometheus-stack-prometheus-*`: Running (2/2 Ready)
- `alertmanager-kube-prometheus-stack-alertmanager-*`: Running (2/2 Ready)

### Servicios
```sh
# Verificar servicios creados
kubectl get svc -n monitoring
```

### Ingress
```sh
# Verificar configuración del Ingress
kubectl get ingress -n monitoring
# Verificar que tenga una IP/hostname asignado
```

## Troubleshooting - Problemas comunes

### 1. Error: `ERR_CERT_AUTHORITY_INVALID`
**Problema:** El certificado TLS no es válido.

**Solución:**
```sh
# 1. Verificar que cert-manager esté funcionando
kubectl get pods -n cert-manager

# 2. Verificar el estado del Issuer
kubectl describe issuer letsencrypt-prod -n monitoring

# 3. Verificar logs de cert-manager
kubectl logs -l app=cert-manager -n cert-manager

# 4. Eliminar y recrear el certificado si es necesario
kubectl delete certificate <certificate-name> -n monitoring
kubectl delete secret <tls-secret-name> -n monitoring
# Luego reaplica el Ingress para regenerar el certificado
```

### 2. Pods en estado `CrashLoopBackOff` o `Pending`
**Problema:** Recursos insuficientes o problemas de configuración.

**Solución:**
```sh
# Verificar eventos del pod
kubectl describe pod <pod-name> -n monitoring

# Verificar logs del pod
kubectl logs <pod-name> -n monitoring

# Verificar recursos del nodo
kubectl top nodes
kubectl top pods -n monitoring
```

### 3. No se puede acceder a Grafana/Prometheus
**Problema:** Configuración del Ingress o DNS.

**Solución:**
```sh
# 1. Verificar que el Ingress tenga IP asignada
kubectl get ingress -n monitoring

# 2. Verificar que el DNS apunte correctamente
nslookup monitoring.one21.app

# 3. Acceso temporal via port-forward
kubectl port-forward svc/kube-prometheus-stack-grafana 3000:80 -n monitoring
# Acceder a http://localhost:3000
```

### 4. Helm installation falló
**Problema:** Conflictos de versiones o CRDs.

**Solución:**
```sh
# 1. Verificar el release de Helm
helm list -n monitoring

# 2. Ver el historial de releases
helm history kube-prometheus-stack -n monitoring

# 3. Rollback si es necesario
helm rollback kube-prometheus-stack <revision> -n monitoring

# 4. Desinstalar completamente si es necesario
helm uninstall kube-prometheus-stack -n monitoring
kubectl delete namespace monitoring
```

### 5. Issuer no está en estado Ready
**Problema:** Configuración incorrecta del ACME o problemas de red.

**Solución:**
```sh
# 1. Verificar configuración del Issuer
kubectl describe issuer letsencrypt-prod -n monitoring

# 2. Verificar que el email sea válido en issuer.yaml
# 3. Verificar conectividad a Let's Encrypt
# 4. Recrear el Issuer si es necesario
kubectl delete issuer letsencrypt-prod -n monitoring
kubectl apply -f issuer.yaml
```

### 6. Loki no está funcionando
**Problema:** Pods de Loki en estado CrashLoopBackOff o no aparecen logs.

**Solución:**
```sh
# 1. Verificar pods de Loki
kubectl get pods -n monitoring | grep loki

# 2. Verificar logs de Loki
kubectl logs -l app=loki -n monitoring

# 3. Verificar configuración de Promtail
kubectl logs -l app=promtail -n monitoring

# 4. Reinstalar Loki si es necesario
helm uninstall loki -n monitoring
helm upgrade --install loki grafana/loki-stack --namespace monitoring
```

### 7. Problema con StorageClass
**Problema:** Error `spec.storageClassName: Invalid value`.

**Solución:**
```sh
# 1. Verificar StorageClasses disponibles
kubectl get storageclass

# 2. Eliminar StatefulSet y PVC problemáticos
kubectl delete statefulset <statefulset-name> -n monitoring
kubectl delete pvc <pvc-name> -n monitoring

# 3. Actualizar monitoring.yaml con StorageClass válido
# Ejemplo: storageClassName: "do-block-storage"

# 4. Reapliqar configuración
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack --namespace monitoring -f monitoring.yaml
```

### 8. Grafana no muestra datos de Loki
**Problema:** Datasource de Loki no configurado o no funciona.

**Solución:**
```sh
# 1. Verificar que Loki esté corriendo
kubectl get svc -n monitoring | grep loki

# 2. Verificar conectividad desde Grafana a Loki
kubectl exec -it <grafana-pod> -n monitoring -- wget -O- http://loki:3100/ready

# 3. Verificar configuración del datasource en Grafana UI
# Configuration > Data Sources > Loki
# URL debería ser: http://loki:3100
```

## Notas adicionales
- Asegúrate de que el Issuer esté en estado Ready antes de instalar el stack.
- Revisa los logs de cert-manager si hay problemas con los certificados.
- Los recursos de monitoreo pueden requerir varios GB de RAM, asegúrate de tener suficientes recursos en el cluster.
