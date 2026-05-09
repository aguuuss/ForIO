# Spec: Frontend Architecture con Tailwind

## Resumen

Este spec define la arquitectura del frontend de ForIO para pasar de una app monolitica con CSS global crudo a una base SaaS mantenible con Tailwind, componentes reutilizables y separacion clara entre shell, paginas, dominio y primitives de UI.

## Objetivos

- Reducir el tamaño y responsabilidad de `App.tsx`
- Eliminar dependencia de una hoja global gigante como fuente unica de estilos
- Reutilizar componentes visuales y de dominio
- Mantener el look definido en `DESIGN.md`
- Facilitar nuevas pantallas y cambios sin duplicacion

## Principios

- Tailwind como sistema principal de estilos
- primitives de UI reutilizables como base
- componentes de dominio para bloques de negocio
- paginas como composicion de componentes
- `App.tsx` como orquestador, no como contenedor de toda la interfaz

## Estructura objetivo

### `src/app/`

Responsabilidad:

- shell global
- footer
- topbar
- wrappers de layout
- resolucion de estado global de navegacion

### `src/pages/`

Responsabilidad:

- componer cada pantalla principal

Paginas esperadas:

- `CatalogPage`
- `AuthPage`
- `PracticePage`
- `ExamPage`
- `AdminPage`
- `ImportPage`

### `src/components/ui/`

Responsabilidad:

- primitives reutilizables

Componentes base esperados:

- `Button`
- `Input`
- `Textarea`
- `Card`
- `Badge`
- `Separator`

### `src/components/domain/`

Responsabilidad:

- bloques del producto

Ejemplos:

- `SubjectHero`
- `QuestionCard`
- `UsersAdminPanel`
- `QuestionForm`
- `QuestionList`
- `PracticePicker`

### `src/lib/`

Responsabilidad:

- utilidades puras
- helpers de clases
- helpers de rutas
- helpers de dominio

## Responsabilidades de `App.tsx`

Debe quedar limitado a:

- carga inicial
- estado global de auth/data
- parseo de ruta actual
- guards de acceso
- render de pagina principal

No debe contener:

- markup masivo de pantallas
- formularios completos de dominio
- CSS-style decisions repetidas

## Estrategia visual

- usar Tailwind como fuente principal de estilos
- conservar variables CSS solo para tokens necesarios
- reflejar tipografias, colores y espaciados de `DESIGN.md`
- evitar clases semanticas gigantes cuando el componente pueda resolverlo inline o con helpers

## Reglas de componentes

- si un bloque aparece en 2 o mas pantallas, se extrae
- si una variante visual se repite, se modela con helper o variante
- componentes UI no conocen negocio
- componentes de dominio si conocen tipos del producto

## Criterio para DnD y quiz UI

- `DragDropAnswer` y `TableDragDropAnswer` siguen siendo componentes de dominio
- pueden usar primitives internas, pero no deben forzarse a entrar en un componente generico que complique su logica
- la prioridad es mantener intacta la logica de respuesta y validacion

## Reglas de pagina

### Catalogo

- orientado a descubrimiento
- cards por materia y bloques por año

### Auth

- enfocada en acceso al panel
- login y registro en una sola experiencia

### Practica y Examen

- layout enfocado
- sidebar de progreso
- bajo nivel de distraccion

### Admin e Import

- orientado a productividad
- formularios, listados, acciones y mensajes claros

## Reglas de navegacion

- se mantiene el router actual con `history.pushState` en v1
- no se introduce `react-router` en esta fase
- las rutas publicas y admin deben seguir siendo las mismas

## Criterios de aceptacion

- el frontend compila sin `styles.css`
- `App.tsx` reduce su responsabilidad a coordinacion
- las paginas principales viven separadas
- existen primitives reutilizables de UI
- el diseño sigue alineado con `DESIGN.md`
- cambios visuales nuevos pueden hacerse sin tocar una sola hoja global gigante

## Dependencias con otros specs

- `catalogo-publico-y-estructura-academica`
- `backoffice-admin-y-gestion-de-contenido`
- `auth-roles-y-permisos`

## Defaults elegidos

- Tailwind como sistema principal
- router actual preservado
- componentes UI pequeños y reutilizables
- componentes de dominio para quiz, admin e importacion
