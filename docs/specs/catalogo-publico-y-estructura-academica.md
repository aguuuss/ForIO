# Spec: Catalogo Publico y Estructura Academica

## Resumen

ForIO pasa de ser una app de preguntas para una sola materia a un catalogo academico publico, escalable por año, carrera y materia. Este spec define la estructura base del dominio academico, las rutas publicas, las reglas de visibilidad y los criterios para crecer el contenido sin mezclar materias ni romper URLs.

El objetivo es que cualquier persona pueda navegar el catalogo y practicar sin login, mientras que la carga y administracion de contenido queda en el backoffice autenticado.

## Problema actual

- La app nacio con foco en una sola materia y un banco de preguntas pequeño.
- El concepto de materia ya existe en base de datos, pero todavia no esta formalizado como parte del producto con reglas claras de crecimiento.
- No hay una especificacion cerrada sobre como representar años, carreras, materias y sus rutas publicas.
- Necesitamos una base consistente para seguir sumando materias sin tener que rediscutir estructura en cada alta nueva.

## Objetivos

- Definir una jerarquia academica clara y simple para v1.
- Mantener el catalogo completamente publico.
- Permitir alta de nuevas materias sin tocar codigo.
- Generar rutas estables y compartibles.
- Evitar colisiones de slugs y mezcla de contenido entre materias.
- Dejar el modelo listo para crecer luego a unidades, temas o comisiones.

## Modelo de dominio

### Entidades visibles en producto

#### Carrera

Agrupa materias dentro de un contexto academico. En v1 no se administra como entidad separada con CRUD propio; se guarda como atributo descriptivo de la materia.

Campos necesarios:

- `careerName`

Reglas:

- Es texto visible al usuario.
- Se usa para contexto visual, filtros y consistencia academica.
- En v1 no tiene slug propio ni pantalla propia.

#### Año academico

Representa el nivel dentro del recorrido de la carrera.

Campos necesarios:

- `yearNumber`

Reglas:

- Es entero positivo.
- En UI se muestra como `1er año`, `2do año`, `3er año`, `4to año`, etc.
- En rutas se serializa como slug derivado, por ejemplo `4to`.

#### Materia

Es la unidad principal de navegacion publica y agrupacion de preguntas.

Campos necesarios:

- `id`
- `slug`
- `name`
- `careerName`
- `yearNumber`
- `isPublic`
- `createdBy`
- `updatedBy`
- `createdAt`
- `updatedAt`

Reglas:

- `slug` debe ser unico globalmente en v1.
- Cada materia pertenece a un unico año academico.
- Cada materia muestra una unica carrera visible.
- Toda pregunta debe pertenecer a una materia.
- `isPublic` arranca en `true` por default.

## Jerarquia funcional

La jerarquia del producto en v1 queda asi:

`Año -> Materias -> Modos de estudio`

Ejemplo:

- `4to año`
- `Investigacion Operativa`
- `Practica` y `Examen`

No se incorpora en este spec:

- comisiones
- catedras
- docentes
- unidades tematicas
- correlatividades
- campus o sedes

Eso queda para una fase futura y no bloquea el catalogo SaaS inicial.

## Rutas publicas

### Home del catalogo

- `/`

Comportamiento:

- Muestra años disponibles.
- Dentro de cada año muestra materias publicas.
- Cada card de materia expone CTA a practica y examen.

### Materia en modo practica

- `/:yearSlug/:subjectSlug`

Ejemplo:

- `/4to/investigacion-operativa`

Comportamiento:

- Carga solo preguntas de esa materia.
- Muestra contexto de carrera, año y cantidad de preguntas.
- Si la materia no existe o no es publica, responde con estado visual de no encontrada.

### Materia en modo examen

- `/:yearSlug/:subjectSlug/exam`

Ejemplo:

- `/4to/investigacion-operativa/exam`

Comportamiento:

- Misma resolucion de materia que practica.
- Inicia flujo de examen usando solo preguntas de esa materia.

## Reglas de slugs

- `subjectSlug` identifica la materia en rutas publicas y API.
- Debe ser estable y no cambiar salvo decision administrativa explicita.
- Debe usar kebab-case ASCII.
- Debe evitar prefijos por año o carrera en v1.

Decisiones de v1:

- El slug es unico globalmente.
- Si dos materias de distintas carreras pudieran chocar, se resuelve al momento del alta con un slug mas especifico.
- No se permite crear dos materias con el mismo slug.

Ejemplos validos:

- `investigacion-operativa`
- `disenio-de-sistemas`
- `analisis-matematico-2`

## Reglas de visibilidad

- El catalogo es publico sin autenticacion.
- Solo se listan materias con `isPublic = true`.
- Solo las materias publicas pueden resolverse por ruta.
- Las preguntas de una materia publica son accesibles en practica y examen sin login.
- Usuarios invitados no ven capacidades de administracion de contenido.

## Reglas de crecimiento del catalogo

- Nuevas materias se cargan desde admin o importacion asociadas a una materia.
- Si la materia ya existe por `slug`, se reutiliza.
- Si no existe, se crea con `name`, `careerName` y `yearNumber`.
- El frontend no debe depender de una lista hardcodeada de materias o años.
- El orden de años en catalogo es ascendente.
- El orden de materias dentro del año en v1 es alfabetico por `name`.

## API esperada

Este spec no cambia el contrato general, pero fija el comportamiento esperado de las lecturas publicas:

### `GET /api/subjects`

Debe devolver:

- solo materias publicas
- `id`
- `slug`
- `name`
- `careerName`
- `yearNumber`

Orden esperado:

- `yearNumber ASC`
- `name ASC`

### `GET /api/questions`

Filtros esperados:

- `subjectSlug`
- `yearNumber`

Reglas:

- si se filtra por materia, solo devuelve preguntas de esa materia
- si la materia no existe, devuelve lista vacia
- no mezcla preguntas entre materias con el mismo nombre visible

## UI esperada

### Catalogo

- Hero de entrada con propuesta de valor del producto.
- Bloques por año.
- Cards de materias con:
  - carrera
  - nombre
  - cantidad de preguntas
  - CTA `Practicar`
  - CTA `Examen`

### Materia

- Hero contextual con carrera, año y cantidad de preguntas.
- Rutas claras y compartibles.
- CTA y layouts consistentes entre practica y examen.

## Casos borde

- Año sin materias publicas: no se muestra en catalogo.
- Materia existente sin preguntas: puede mostrarse en catalogo, pero su vista de materia informa que todavia no hay preguntas.
- Cambio de nombre visible de materia: no debe cambiar la URL si el slug sigue igual.
- Cambio de año de una materia: requiere revisar links existentes porque cambia `yearSlug`.
- Materia privada en el futuro: debe desaparecer del catalogo y no resolver por ruta publica.

## Criterios de aceptacion

- El catalogo puede listar multiples años y multiples materias sin tocar codigo frontend.
- Cada materia tiene una URL publica estable basada en año y slug.
- Practica y examen muestran solo preguntas de la materia seleccionada.
- No es necesario login para navegar ni practicar.
- La estructura soporta sumar nuevas materias desde admin/import sin mezclar contenido.
- El diseño y la navegacion reflejan claramente la jerarquia `año -> materia -> modo`.

## Fuera de alcance

- Unidades, temas y etiquetas internas.
- Historial de usuario.
- Progreso persistido.
- Catedras o comisiones.
- SEO avanzado o sitemap.
- Multi-idioma.

## Dependencias con otros specs

Este spec sirve como base para:

- `auth-roles-y-permisos`
- `backoffice-admin-y-gestion-de-contenido`
- `modelo-de-datos-y-migraciones`
- `frontend-architecture-tailwind`

## Defaults elegidos

- Catalogo completamente publico.
- Materia como unidad central del producto.
- `careerName` como atributo de materia, no como entidad separada en v1.
- `slug` de materia unico globalmente.
- Rutas publicas con formato `/:yearSlug/:subjectSlug`.
- Años ordenados ascendente y materias alfabeticamente.
