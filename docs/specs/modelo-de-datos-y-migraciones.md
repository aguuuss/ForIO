# Spec: Modelo de Datos y Migraciones

## Resumen

Este spec define la base de datos operativa de ForIO para el enfoque SaaS inicial: materias, preguntas, usuarios, sesiones y auditoria. Tambien fija la estrategia de migracion y seeds para pasar de contenido heredado a una estructura durable sobre Postgres.

## Objetivos

- Tener un modelo relacional simple y escalable.
- Soportar catalogo publico multi-materia.
- Soportar auth, roles y sesiones.
- Mantener trazabilidad basica de contenido.
- Permitir bootstrap reproducible en local y VPS.

## Entidades principales

### `users`

Campos:

- `id`
- `email`
- `password_hash`
- `display_name`
- `role`
- `status`
- `created_at`
- `updated_at`

Reglas:

- `email` unico
- `role` restringido a `editor | admin`
- `status` restringido a `pending | active`

### `sessions`

Campos:

- `id`
- `user_id`
- `token_hash`
- `expires_at`
- `created_at`

Reglas:

- `user_id` referencia a `users`
- `token_hash` unico
- al borrar usuario, las sesiones se eliminan en cascada

### `subjects`

Campos:

- `id`
- `slug`
- `name`
- `career_name`
- `year_number`
- `is_public`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

Reglas:

- `slug` unico globalmente en v1
- `year_number` entero positivo
- `created_by` y `updated_by` referencian `users`

### `questions`

Campos:

- `id`
- `subject_id`
- `type`
- `statement`
- `content`
- `ocr_text`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

Reglas:

- `subject_id` obligatorio
- `content` guarda la parte especifica del tipo
- `ocr_text` opcional
- `created_by` y `updated_by` referencian `users`

## Shape de `content`

### Multiple choice

- `options`
- `correctAnswer`

### Drag and drop

- `textParts`
- `draggableOptions`
- `correctAnswers`

### Table drag and drop

- `table`
- `draggableOptions`

## Relaciones

- un `user` crea muchas `subjects`
- un `user` crea muchas `questions`
- una `subject` tiene muchas `questions`
- una `session` pertenece a un `user`

## Indices minimos

- `subjects.slug`
- `subjects.year_number`
- `questions.subject_id`
- `questions.type`
- `sessions.user_id`
- `sessions.expires_at`

## Estrategia de migracion

### Estado inicial

- el repo puede arrancar con schema creado automaticamente
- el seed migra `server/data/questions.json` a Postgres

### Reglas

- toda inicializacion de entorno nuevo debe:
  - crear schema
  - asegurar materia default
  - permitir bootstrap admin
- las migraciones futuras deben ser incrementales y reproducibles

### Recomendacion de evolucion

Para v1.1 conviene pasar de `initializeDatabase()` embebido a una carpeta formal de migraciones, pero no bloquea el arranque actual.

## Seeds y bootstrap

### Seed de preguntas

Debe:

- leer dataset legacy
- crear o reutilizar materia default
- insertar preguntas ligadas a esa materia

### Bootstrap admin

Debe poder hacerse por:

- variables de entorno
- script manual

Ambos caminos deben dejar:

- `role = admin`
- `status = active`

## Reglas de integridad

- no puede existir pregunta sin materia
- no puede existir sesion sin usuario
- no puede haber dos usuarios con mismo email
- no puede haber dos materias con mismo slug

## Casos borde

- seed repetido: no debe duplicar materias por slug
- cambio de nombre de materia: no debe requerir recrear preguntas
- borrado de usuario autor: `created_by` y `updated_by` pueden quedar `NULL`
- sesion vencida: no debe resolver usuario autenticado

## Criterios de aceptacion

- una base nueva puede inicializarse solo con `.env`, Postgres y scripts
- el contenido heredado puede cargarse a la materia default
- auth y sesiones funcionan sin tabla extra ad hoc fuera de este modelo
- toda pregunta queda asociada a una materia
- toda mutacion autenticada puede auditarse por usuario

## Dependencias con otros specs

- `catalogo-publico-y-estructura-academica`
- `auth-roles-y-permisos`
- `backoffice-admin-y-gestion-de-contenido`
- `api-publica-y-admin`

## Defaults elegidos

- Postgres como base unica
- `content` en JSONB por flexibilidad entre tipos de pregunta
- slugs de materia unicos globalmente
- auditoria minima por `created_by` y `updated_by`
- bootstrap admin soportado por env y script
