# Spec: Auth, Roles y Permisos

## Resumen

ForIO mantiene el catalogo, practica y examen como experiencia completamente publica, pero protege toda accion de carga, edicion y administracion de contenido mediante autenticacion local con roles. Este spec define el modelo de usuarios, estados de aprobacion, permisos por accion y reglas operativas del backoffice.

El objetivo es que la experiencia de estudio sea abierta y simple, mientras que el contenido institucional se gestione de manera controlada, auditable y escalable.

## Problema actual

- El producto ya necesita separar consumo publico de administracion interna.
- Sin reglas claras de roles, cualquier crecimiento del catalogo puede derivar en caos editorial.
- Necesitamos definir de forma estable:
  - quien puede entrar
  - quien puede editar
  - quien puede crear materias
  - quien puede aprobar usuarios
  - quien puede borrar o cambiar permisos

## Objetivos

- Mantener el uso del catalogo 100% publico.
- Implementar autenticacion local por `email + password`.
- Diferenciar claramente permisos editoriales y administrativos.
- Evitar que una cuenta nueva obtenga permisos de escritura automaticamente.
- Garantizar trazabilidad minima sobre quienes crean o modifican contenido.

## Modelo de usuarios

### Tipos de actor

#### `guest`

Usuario no autenticado.

Capacidades:

- ver catalogo
- entrar a practica
- entrar a examen
- navegar rutas publicas

Restricciones:

- no puede entrar al admin
- no puede importar
- no puede crear, editar ni borrar contenido
- no puede ver gestion de usuarios

#### `editor`

Usuario autenticado con permisos de contenido, una vez aprobado.

Capacidades:

- crear materias
- crear preguntas
- editar preguntas existentes
- importar capturas OCR
- usar herramientas de construccion de tablas

Restricciones:

- no puede borrar definitivamente preguntas si esa accion queda reservada a admin
- no puede cambiar roles
- no puede aprobar o pausar usuarios
- no puede gestionar politicas del sistema

#### `admin`

Usuario autenticado con control operativo total del backoffice.

Capacidades:

- todo lo de `editor`
- aprobar usuarios
- pausar o reactivar usuarios
- promover o degradar roles
- borrar definitivamente preguntas
- administrar el primer tramo del gobierno del catalogo

## Estados de cuenta

### `pending`

Cuenta creada pero no habilitada para escribir.

Reglas:

- puede iniciar sesion
- puede ver su estado
- no puede entrar efectivamente al admin operativo
- debe recibir un mensaje claro de cuenta pendiente

### `active`

Cuenta habilitada para operar segun su rol.

Reglas:

- si es `editor`, puede trabajar sobre contenido
- si es `admin`, puede trabajar sobre contenido y usuarios

## Modelo de autenticacion

### Metodo

- login local por `email + password`
- password hasheado con algoritmo fuerte
- sesion basada en cookie HTTP-only del backend

### Reglas de sesion

- la cookie es la fuente de verdad de autenticacion
- el frontend no guarda token manual en `localStorage`
- el frontend consulta `GET /api/auth/me` para hidratar sesion
- en produccion la cookie debe ser `Secure`
- `SameSite=Lax` por default

## Reglas de registro

- el registro esta abierto
- todo usuario nuevo se crea como:
  - `role = editor`
  - `status = pending`
- una cuenta recien creada no obtiene permisos operativos hasta aprobacion admin

## Reglas del primer admin

- debe existir una forma explicita de bootstrap
- puede crearse por variables de entorno o script administrativo
- en un entorno vacio, esa via es obligatoria para no bloquear la administracion del sistema

## Permisos por accion

### Acciones publicas

Permitidas para `guest`, `editor` y `admin`:

- listar materias publicas
- listar preguntas publicas
- navegar catalogo
- practicar
- rendir examen
- consultar estado basico de OCR si se decide mantener publico

### Acciones editoriales

Permitidas para `editor active` y `admin active`:

- crear pregunta
- editar pregunta
- crear varias preguntas via importacion
- crear materia al asociar contenido nuevo
- usar OCR de importacion

Denegadas para:

- `guest`
- `pending`

### Acciones administrativas

Permitidas solo para `admin active`:

- listar usuarios reales del sistema
- aprobar usuarios
- pasar usuario a `pending`
- cambiar rol entre `editor` y `admin`
- borrar definitivamente preguntas

## Reglas del backoffice

### Acceso a `/admin`

- `guest`: redireccion a `/auth`
- `pending`: pantalla de cuenta pendiente
- `editor active`: acceso permitido
- `admin active`: acceso permitido

### Acceso a `/admin/import`

- `guest`: redireccion a `/auth`
- `pending`: bloqueo con mensaje de cuenta pendiente
- `editor active`: acceso permitido
- `admin active`: acceso permitido

### Vista de usuarios

- solo visible para `admin`
- debe listar:
  - nombre visible
  - email
  - rol
  - estado
  - fecha de alta
- debe permitir:
  - aprobar o pausar
  - promover a admin
  - degradar a editor

## Ownership y auditoria

Toda mutacion relevante de contenido debe dejar trazabilidad minima:

- `subjects.createdBy`
- `subjects.updatedBy`
- `questions.createdBy`
- `questions.updatedBy`

Reglas:

- una creacion asigna autor
- una edicion actualiza `updatedBy`
- en UI publica no es obligatorio exponer esta metadata
- en admin puede mostrarse si aporta valor operativo

## API esperada

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Contratos minimos esperados:

- `GET /api/auth/me` devuelve `user` o `null`
- `POST /api/auth/login` devuelve `user` autenticado
- `POST /api/auth/register` devuelve confirmacion de alta y mensaje de pendiente

### Admin usuarios

- `GET /api/admin/users`
- `PATCH /api/admin/users/:id/status`
- `PATCH /api/admin/users/:id/role`

### Reglas HTTP

- `401`: no autenticado
- `403`: autenticado pero sin permisos o sin estado activo

## Reglas de UI

### Publico

- no debe exigir login para estudiar
- debe dejar claro que el panel es solo para gestion de contenido

### Auth

- login y registro en una misma pantalla
- feedback claro para errores de credenciales
- feedback claro de cuenta pendiente

### Admin

- `editor` ve gestion de contenido
- `admin` ve gestion de contenido + gestion de usuarios

## Casos borde

- usuario autenticado pero `pending`: puede loguearse y quedar bloqueado en admin
- admin intentando bajarse a si mismo de rol: debe bloquearse o requerir otra via segura
- editor intentando borrar contenido: debe recibir `403`
- usuario aprobado y luego pausado: pierde acceso operativo en la siguiente validacion de sesion
- primer admin inexistente: el sistema queda operativamente incompleto hasta bootstrap

## Criterios de aceptacion

- un invitado puede usar todo el catalogo sin login
- una cuenta nueva puede registrarse pero no editar hasta aprobacion
- un editor activo puede crear y editar contenido
- un editor activo no puede administrar usuarios ni roles
- un admin activo puede aprobar usuarios y gestionar roles
- el frontend refleja correctamente `guest`, `pending`, `editor` y `admin`
- cada mutacion de contenido puede asociarse a un usuario autenticado

## Fuera de alcance

- OAuth o login social
- recuperacion de contraseña por email
- permisos por materia o por carrera
- flujos de invitacion
- organizaciones multi-tenant
- MFA

## Dependencias con otros specs

Este spec depende de:

- `catalogo-publico-y-estructura-academica`

Y alimenta:

- `backoffice-admin-y-gestion-de-contenido`
- `modelo-de-datos-y-migraciones`
- `api-publica-y-admin`

## Defaults elegidos

- registro abierto
- cuentas nuevas entran como `editor pending`
- practica y examen siguen completamente publicos
- permisos editoriales globales, no por materia
- borrado definitivo reservado a `admin`
- autenticacion local con cookie HTTP-only
