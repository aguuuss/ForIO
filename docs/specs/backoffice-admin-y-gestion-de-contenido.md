# Spec: Backoffice Admin y Gestion de Contenido

## Resumen

El backoffice de ForIO es el espacio autenticado desde donde se crea, edita, importa y administra el contenido academico. Este spec define la experiencia operativa del panel admin, la separacion entre gestion de contenido y gestion de usuarios, y las reglas para dar de alta materias y preguntas sin romper el catalogo publico.

## Objetivos

- Tener un panel unico para operar el contenido del producto.
- Permitir alta y edicion de preguntas de forma rapida.
- Permitir creacion de materias desde el mismo flujo de carga.
- Integrar OCR como via rapida de importacion con revision humana.
- Dar a `admin` herramientas de gobierno y a `editor` herramientas de produccion.

## Estructura funcional del backoffice

### `/admin`

Pantalla principal de gestion de contenido.

Bloques esperados:

- formulario de alta/edicion de preguntas
- selector del tipo de pregunta
- editor de contexto academico de la materia
- listado de preguntas existentes
- buscador y filtros basicos
- modulo de usuarios solo para `admin`

### `/admin/import`

Pantalla de importacion asistida.

Bloques esperados:

- dropzone para imagenes
- OCR provider status
- edicion de drafts detectados
- constructor de tablas
- guardado masivo de preguntas

## Reglas de acceso

- `guest`: sin acceso
- `pending`: sin acceso operativo
- `editor active`: acceso a gestion de contenido e importacion
- `admin active`: acceso a gestion de contenido, importacion y usuarios

## Flujos de contenido

### Crear pregunta

El editor debe poder:

- elegir tipo de pregunta
- redactar enunciado
- definir opciones/respuestas
- asociar a materia existente o nueva
- guardar sin salir de la pantalla

Tipos soportados en v1:

- `multiple_choice`
- `drag_and_drop`
- `table_drag_and_drop`

### Editar pregunta

El editor debe poder:

- abrir una pregunta del listado
- editar su contenido manteniendo la materia asociada
- cambiar el tipo si el caso lo requiere
- guardar sobre la misma entidad

### Buscar contenido

El panel debe permitir buscar por:

- enunciado
- nombre de materia
- carrera
- tipo de pregunta

En v1 no se exige filtro avanzado por unidades o tags.

### Eliminar pregunta

- solo `admin`
- la eliminacion es definitiva en v1
- debe estar claramente diferenciada de editar

## Gestion de materias

La materia no tiene CRUD independiente obligatorio en v1; nace o se reutiliza desde el contexto de carga de preguntas.

Reglas:

- si el `subjectSlug` existe, se reutiliza la materia
- si no existe, se crea con:
  - `subjectName`
  - `careerName`
  - `yearNumber`
- el panel debe mostrar si la materia es nueva o existente
- el slug debe poder editarse antes del alta inicial

## Reglas del editor de preguntas

### Multiple choice

Debe permitir:

- lista dinamica de opciones
- seleccion de respuesta correcta
- agregar y quitar opciones

### Drag and drop

Debe permitir:

- frase editable
- blanks definidos por `__blank__`
- lista de opciones arrastrables
- respuestas correctas en orden

### Tabla drag and drop

Debe permitir:

- definir filas y columnas
- marcar celdas blank
- definir contenido fijo
- definir respuesta correcta y alternativas por blank
- vista previa de la tabla resultante

## Importacion OCR

### Objetivo

Reducir tiempo de carga manual sin eliminar revision humana.

### Flujo

1. subir, pegar o arrastrar imagenes
2. obtener OCR y parseo preliminar
3. editar draft detectado
4. reparsear si hace falta
5. opcionalmente derivar al constructor de tablas
6. guardar una o varias preguntas al banco

### Reglas

- el OCR no guarda directo sin revision
- el texto OCR original debe preservarse en la pregunta
- el usuario puede reinterpretar una captura
- el usuario puede tomar una captura como:
  - tabla vacia
  - set de respuestas

## Constructor de tablas

El constructor existe para casos donde OCR detecta mal la estructura tabular o requiere combinacion de varias capturas.

Debe permitir:

- armar una tabla base
- asignar blanks manualmente
- detectar posibles respuestas
- asignar respuestas en orden
- guardar la tabla como pregunta independiente

## Gestion de usuarios dentro del admin

Visible solo para `admin`.

La vista debe permitir:

- ver usuarios reales
- ver rol y estado
- aprobar/pausar
- promover/degradar

No debe permitir:

- borrado de usuarios en v1
- edicion manual de password

## Reglas de UX

- el editor debe poder trabajar rapido sin navegar muchas pantallas
- el guardado debe confirmar exito o error claramente
- el panel debe diferenciar visualmente contenido, importacion y usuarios
- acciones destructivas deben verse como tales
- el panel debe ser usable tanto en desktop como en laptop

## Casos borde

- draft OCR sin tipo claro: entra editable como draft normal
- materia nueva mal escrita: se crea nueva entidad, por eso el slug visible debe ser revisable
- tabla parcialmente detectada: se resuelve en constructor de tablas
- editor intentando borrar: recibe `403`
- usuario `pending` con sesion activa intentando entrar por URL directa: ve pantalla de bloqueo

## Criterios de aceptacion

- un `editor active` puede crear y editar preguntas desde `/admin`
- un `editor active` puede importar preguntas desde `/admin/import`
- una pregunta nueva puede asociarse a materia existente o crear una nueva
- un `admin active` puede gestionar usuarios desde el mismo backoffice
- el OCR acelera carga pero siempre deja revision humana
- el panel no mezcla contenido de distintas materias al guardar

## Dependencias con otros specs

- `catalogo-publico-y-estructura-academica`
- `auth-roles-y-permisos`
- `api-publica-y-admin`
- `modelo-de-datos-y-migraciones`

## Defaults elegidos

- un solo backoffice web
- CRUD fuerte sobre preguntas, no sobre carreras
- materia gestionada embebida dentro del flujo de preguntas
- OCR asistido, nunca autonomo
- usuarios administrados desde el propio panel admin
