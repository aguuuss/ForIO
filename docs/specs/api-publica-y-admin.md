# Spec: API Publica y API Admin

## Resumen

Este spec define los contratos funcionales del backend de ForIO para consumo publico y administracion autenticada. Busca separar claramente lectura abierta del catalogo y escritura protegida del backoffice.

## Objetivos

- Mantener una API simple para frontend publico.
- Proteger mutaciones con auth por roles.
- Estandarizar respuestas y errores.
- Evitar ambiguedad sobre que endpoints son publicos y cuales son admin/editor.

## Endpoints publicos

### `GET /api/subjects`

Uso:

- listar materias publicas para el catalogo

Respuesta minima:

- `id`
- `slug`
- `name`
- `careerName`
- `yearNumber`

Reglas:

- solo materias publicas
- ordenadas por `yearNumber ASC`, `name ASC`

### `GET /api/questions`

Uso:

- cargar preguntas para practica o examen

Filtros soportados:

- `subjectSlug`
- `yearNumber`

Reglas:

- si no hay filtros, puede devolver banco completo publico
- si hay `subjectSlug`, debe devolver solo esa materia
- si la materia no existe, devuelve lista vacia

### `GET /api/ocr/status`

Uso:

- informar proveedor OCR y readiness basica

Reglas:

- se puede mantener publico en v1 porque no expone secretos

## Endpoints de auth

### `POST /api/auth/register`

Entrada:

- `email`
- `password`
- `displayName`

Salida esperada:

- mensaje de alta
- usuario creado sin sesion operativa de escritura

Reglas:

- crea `editor pending`
- valida email
- valida password minima

### `POST /api/auth/login`

Entrada:

- `email`
- `password`

Salida esperada:

- `user`
- cookie de sesion

### `POST /api/auth/logout`

Reglas:

- invalida sesion actual
- limpia cookie de sesion

### `GET /api/auth/me`

Salida esperada:

- `user` autenticado o `null`

## Endpoints editoriales

Disponibles para `editor active` y `admin active`.

### `POST /api/questions`

Uso:

- crear una pregunta

### `PUT /api/questions/:id`

Uso:

- editar una pregunta existente

### `POST /api/questions/bulk`

Uso:

- guardar varias preguntas desde importacion

### `POST /api/ocr/upload`

Uso:

- OCR de una o varias imagenes

### `POST /api/ocr/parse-question`

Uso:

- reinterpretar texto OCR como draft editable

## Endpoints administrativos

Disponibles solo para `admin active`.

### `DELETE /api/questions/:id`

Uso:

- borrado definitivo

### `GET /api/admin/users`

Uso:

- listar usuarios reales

### `PATCH /api/admin/users/:id/status`

Uso:

- aprobar, pausar o reactivar

### `PATCH /api/admin/users/:id/role`

Uso:

- promover o degradar

## Reglas de autorizacion

- `401` si no hay sesion valida
- `403` si hay sesion pero no rol o estado suficiente
- `guest` nunca muta
- `pending` nunca muta
- `editor active` muta contenido pero no usuarios
- `admin active` muta contenido y usuarios

## Contratos de errores

Respuesta minima esperada:

- `message`

No hace falta en v1 una taxonomia compleja de codigos de error, pero el mensaje debe ser claro para UI.

## Criterios de aceptacion

- el frontend publico puede vivir solo con `subjects`, `questions` y `auth/me`
- el frontend admin puede operar contenido con endpoints protegidos
- los permisos se reflejan igual en backend y UI
- OCR e importacion quedan protegidos por auth activa

## Dependencias con otros specs

- `catalogo-publico-y-estructura-academica`
- `auth-roles-y-permisos`
- `backoffice-admin-y-gestion-de-contenido`
- `modelo-de-datos-y-migraciones`

## Defaults elegidos

- lectura publica
- escritura protegida
- errores simples con `message`
- filtros iniciales minimos por `subjectSlug` y `yearNumber`
