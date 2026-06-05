# Quiz Practica Simplex

Proyecto fullstack rapido para estudiar con preguntas tipo Quizizz. Incluye practica de multiple choice, preguntas con drag and drop, panel admin sin login y persistencia simple en JSON local.

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Drag and Drop: `@dnd-kit/core`
- OCR local: `tesseract.js`
- OCR opcional: AWS Textract con AWS SDK v3
- Persistencia: `server/data/questions.json`

## Requisitos

- Node.js 20 o superior
- npm

## Instalacion

Desde la raiz del proyecto:

```bash
npm install
```

Copiá `.env.example` a `.env` si querés configurar OCR o puerto:

```bash
cp .env.example .env
```

## Correr en desarrollo

```bash
npm run dev
```

Esto levanta:

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

Vite proxya `/api` hacia el backend, asi que desde el frontend alcanza con pedir `/api/questions`.

Si desplegas frontend y backend como servicios separados, configura en el frontend:

```bash
VITE_API_URL=https://url-de-tu-backend
```

Sin `VITE_API_URL`, el frontend usa rutas relativas `/api`, que sirven para desarrollo local o despliegues con proxy al backend.

## Scripts utiles

```bash
npm run dev
npm run build
npm run start
```

Tambien se pueden correr por separado:

```bash
npm run dev --workspace server
npm run dev --workspace client
```

## Pantallas

- `/`: modo practica.
- `/admin`: panel para crear, editar y eliminar preguntas.
- `/admin/import`: importar capturas con OCR y revisar antes de guardar.

## API

```http
GET /api/questions
POST /api/questions
PUT /api/questions/:id
DELETE /api/questions/:id
POST /api/questions/bulk
POST /api/ocr/upload
POST /api/ocr/parse-question
```

## Importar capturas con OCR

Entra a `/admin/import`, subi una o varias imagenes, arrastralas al area de importacion o pega una captura con `Ctrl+V`. El backend va a:

1. Leer el texto con el proveedor configurado en `OCR_PROVIDER`.
2. Mostrar el texto OCR original.
3. Proponer una pregunta editable.
4. Permitir corregir tipo, enunciado, opciones, respuesta correcta, blanks y tablas.
5. Guardar una o varias preguntas con `POST /api/questions/bulk`.

El texto OCR original se guarda en cada pregunta como `ocrText` para revisar errores despues.

Si el OCR detecta palabras como `tabla`, `simplex`, `fila`, `columna`, `Vector Base`, `By` o `slack`, intenta proponer una pregunta `table_drag_and_drop`. La deteccion de coordenadas no es perfecta: la pantalla de revision permite reconstruir la tabla manualmente rapido.

### Proveedores OCR

La abstraccion esta en `server/src/ocrProvider.ts`. Por defecto usa `tesseract.js`, sin servicios externos.

Proveedor local:

```bash
OCR_PROVIDER=tesseract
```

Proveedor AWS Textract:

```bash
OCR_PROVIDER=aws-textract
AWS_ACCESS_KEY_ID=tu_access_key
AWS_SECRET_ACCESS_KEY=tu_secret_key
AWS_REGION=us-east-1
OCR_ACCESS_TOKEN=token_que_generas_para_usuarios
```

Cuando `OCR_PROVIDER=aws-textract`, el backend exige el header `X-OCR-Token` en `POST /api/ocr/upload`. La pantalla `/admin/import` tiene un campo "Token OCR"; lo guarda en `localStorage` del navegador y lo envia automaticamente al procesar capturas.

Fallback opcional a Tesseract si falla AWS Textract:

```bash
OCR_FALLBACK_TO_TESSERACT=true
```

El endpoint `POST /api/ocr/upload` devuelve texto completo, lineas detectadas, bloques de Textract cuando existan y confidence promedio si esta disponible.

Para verificar que proveedor esta usando el backend:

```http
GET /api/ocr/status
```

Cuando subis o pegas una imagen, la consola del backend muestra logs como:

```text
[OCR] Procesando captura.png con provider=aws-textract
[OCR] captura.png listo provider=aws-textract lineas=12 confidence=98.4
```

No se usa AWS Rekognition ni variables relacionadas a reconocimiento facial; la app solo necesita OCR para leer capturas de preguntas.

## Formato de preguntas

### Multiple choice

```json
{
  "id": "1",
  "type": "multiple_choice",
  "statement": "El costo de oportunidad se visualiza en...",
  "options": [
    "la línea del cálculo de la condición de optimalidad",
    "la función objetivo",
    "las restricciones",
    "el recurso"
  ],
  "correctAnswer": "la línea del cálculo de la condición de optimalidad"
}
```

### Drag and drop

```json
{
  "id": "2",
  "type": "drag_and_drop",
  "statement": "Completar la frase:",
  "textParts": [
    "El",
    "__blank__",
    "se visualiza en la línea del cálculo de la condición de optimalidad y me permite decidir cuánto",
    "__blank__",
    "el coeficiente en la",
    "__blank__"
  ],
  "draggableOptions": [
    "costo de oportunidad",
    "aumentar",
    "función objetivo",
    "valor marginal",
    "recurso",
    "disminuir"
  ],
  "correctAnswers": [
    "costo de oportunidad",
    "aumentar",
    "función objetivo"
  ]
}
```

En el admin, para crear una frase drag and drop, separa las partes con `|` y escribi `__blank__` donde quieras un espacio:

```text
El | __blank__ | se visualiza en la linea de optimalidad y permite | __blank__ | el coeficiente en la | __blank__
```

La cantidad de `__blank__` tiene que coincidir con la cantidad de respuestas correctas.

### Tabla con drag and drop

```json
{
  "id": "4",
  "type": "table_drag_and_drop",
  "statement": "La tabla óptima del simplex dual de un problema primal de maximización se arma con:",
  "table": {
    "rows": 5,
    "columns": 6,
    "cells": [
      {
        "row": 0,
        "col": 0,
        "content": "",
        "isBlank": true,
        "correctAnswer": "By"
      },
      {
        "row": 0,
        "col": 1,
        "content": "",
        "isBlank": true,
        "correctAnswer": "Coeficientes de Var.Base"
      }
    ]
  },
  "draggableOptions": ["By", "Vector Base", "costo de oportunidad", "valor marginal"]
}
```

En `/admin` se puede crear manualmente una tabla indicando filas, columnas, contenido fijo, celdas vacias y respuesta correcta para cada celda. En modo practica, cada celda vacia se valida contra su `correctAnswer` y se marca visualmente como correcta o incorrecta.

## Datos de ejemplo

El archivo `server/data/questions.json` ya trae preguntas de Programacion Lineal / Simplex:

- 1 multiple choice
- 2 drag and drop
- 1 tabla con drag and drop

Podés editar ese JSON a mano o usar `/admin`.

## Backups y comandos útiles

El servidor guarda automáticamente backups cuando se sobrescribe `server/data/questions.json` y los coloca en `server/data/backups/`.

Comando para crear un backup manualmente (rápido):

```bash
# desde la raíz del repo
npm --prefix server run backup
```

Comando para restaurar el backup más reciente:

```bash
npm --prefix server run restore-latest
```

Comando para crear el archivo activo a partir del ejemplo (si existe `questions.example.json`):

```bash
# Unix / macOS
cp server/data/questions.example.json server/data/questions.json

# Windows PowerShell
Copy-Item server/data/questions.example.json server/data/questions.json
```

Si querés que automatice además la creación de `server/data/questions.example.json` desde el estado actual o agrege `seed` en `server/package.json`, avisame y lo dejo listo.
