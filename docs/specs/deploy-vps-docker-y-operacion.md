# Spec: Deploy en VPS, Docker y Operacion

## Resumen

Este spec define como operar ForIO en produccion sobre una VPS usando Docker y Postgres. El objetivo es estandarizar despliegue, persistencia, configuracion, backup y recuperacion para que el producto pueda sostenerse como SaaS liviano sin depender de un entorno manual fragil.

## Objetivos

- tener un despliegue reproducible
- usar el mismo stack conceptual de local y produccion
- asegurar persistencia de Postgres
- dejar claro backup y restore

## Topologia base

Servicios esperados:

- `client`
- `server`
- `postgres`

Recomendacion:

- frontend y backend bajo el mismo host si es posible
- base con volumen persistente

## Variables de entorno minimas

- `DATABASE_URL`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_PORT`
- `AUTH_COOKIE_SECRET`
- `AUTH_SESSION_TTL_DAYS`
- `INITIAL_ADMIN_EMAIL`
- `INITIAL_ADMIN_PASSWORD`
- `INITIAL_ADMIN_DISPLAY_NAME`
- `OCR_PROVIDER`

## Reglas de produccion

- no usar secretos hardcodeados
- cookie `Secure` en produccion
- volumen persistente para Postgres
- logs accesibles para backend
- restore probado al menos una vez

## Bootstrap inicial

Un deploy nuevo debe poder:

1. levantar Postgres
2. levantar backend
3. inicializar schema
4. bootstrapear primer admin
5. seedear contenido inicial si corresponde

## Backup

Se debe respaldar al menos:

- base de datos Postgres
- `.env` o equivalente seguro fuera del repo

Frecuencia minima recomendada:

- diario para DB

## Restore

Debe existir procedimiento claro para:

- bajar servicios si hace falta
- restaurar dump
- relanzar servicios
- validar login admin y lectura publica

## Observabilidad operativa minima

- logs del backend
- estado de arranque de Postgres
- confirmacion de OCR provider activo
- confirmacion de inicializacion admin

## Criterios de aceptacion

- un entorno nuevo puede levantarse solo con Docker, `.env` y los scripts del repo
- Postgres persiste datos entre reinicios
- el admin inicial puede crearse de forma deterministica
- existe una forma clara de backup y restore

## Dependencias con otros specs

- `modelo-de-datos-y-migraciones`
- `auth-roles-y-permisos`
- `api-publica-y-admin`

## Defaults elegidos

- VPS propia
- Docker como estandar de despliegue
- Postgres como unica base
- mismo modelo conceptual entre local y produccion
