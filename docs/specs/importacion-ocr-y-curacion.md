# Spec: Importacion OCR y Curacion de Preguntas

## Resumen

La importacion OCR es la via rapida para cargar contenido academico en ForIO. Este spec define el flujo de captura a draft editable, la curacion humana obligatoria, el tratamiento especial de tablas y las reglas para minimizar errores de clasificacion antes de guardar preguntas al banco.

## Objetivos

- acelerar carga de preguntas desde capturas
- mantener control humano antes del guardado
- soportar multiple choice, frases y tablas
- reducir falsos positivos, especialmente tablas mal detectadas

## Principios

- OCR asiste, no decide en forma final
- toda pregunta importada pasa por revision humana
- el texto OCR original se preserva
- la importacion debe priorizar velocidad sin perder consistencia

## Flujo principal

1. el usuario sube, pega o arrastra una o varias imagenes
2. el backend ejecuta OCR con el provider configurado
3. el sistema devuelve:
   - texto OCR
   - lineas detectadas
   - metadata de provider
   - draft de pregunta sugerido
4. el usuario corrige el draft
5. el usuario guarda una o varias preguntas

## Tipos soportados

- `multiple_choice`
- `drag_and_drop`
- `table_drag_and_drop`

## Reglas de parseo

### Multiple choice

Debe priorizarse cuando el OCR detecta:

- opciones cortas
- patrones tipo `a)`, `b)`, `c)` o similares
- estructura lineal de consigna + respuestas

### Drag and drop

Debe proponerse cuando:

- hay frase o texto continuo
- se detectan fragmentos que pueden convertirse en blanks
- no hay evidencia fuerte de tabla

### Tabla

Debe proponerse solo cuando hay evidencia estructural suficiente.

Reglas:

- no alcanza con palabras sueltas como `simplex`, `slack` o `By`
- debe existir señal combinada de:
  - vocabulario tabular
  - patrones de tabla
  - repeticion de celdas/respuestas
  - estructura visual compatible

## Curacion humana

Antes de guardar, el usuario debe poder:

- cambiar el tipo de pregunta
- editar el enunciado
- corregir opciones
- corregir respuestas correctas
- corregir blanks
- derivar una captura a constructor de tablas

## Texto OCR original

Cada pregunta guardada desde OCR debe poder conservar:

- `ocrText`

Objetivos:

- auditoria posterior
- reprocesamiento manual
- deteccion de patrones de error del OCR

## Constructor de tablas

Existe para casos donde OCR:

- detecta mal la estructura
- divide una tabla en varias capturas
- mezcla tabla vacia y respuestas correctas

El constructor debe permitir:

- armar una tabla base
- definir dimensiones
- marcar blanks
- cargar contenido fijo
- detectar o asignar respuestas en orden
- guardar como pregunta tabular

## Reglas de guardado

- no se guarda directo tras OCR
- el guardado puede ser individual o masivo
- todas las preguntas se guardan asociadas a una materia
- la importacion debe respetar reglas de permisos editoriales

## Casos borde

- OCR vacio o irrelevante: mostrar error claro y no crear draft invalido
- draft ambiguo entre multiple choice y tabla: priorizar multiple choice o draft editable generico
- captura de respuestas sin consigna: debe poder alimentar constructor de tablas
- mezcla de varias preguntas en una sola imagen: en v1 queda a revision manual

## Criterios de aceptacion

- el flujo soporta cargar varias imagenes
- el OCR devuelve draft editable
- las preguntas no se guardan sin revision
- las tablas pueden reconstruirse aunque el OCR falle
- los falsos positivos de tabla se reducen frente al comportamiento original

## Dependencias con otros specs

- `backoffice-admin-y-gestion-de-contenido`
- `api-publica-y-admin`
- `modelo-de-datos-y-migraciones`

## Defaults elegidos

- OCR local por default, con AWS opcional
- revision humana obligatoria
- `ocrText` persistido
- constructor de tablas como fallback oficial
