# Cuestionario — Unidad 4: Programación No Lineal

> Respuestas validadas y corregidas. Las opciones marcadas con ✅ son las correctas.
> Se eliminaron los enunciados duplicados.

---

## Preguntas de opción múltiple (Multiple Choice)

### 1. La programación separable usa:
- ✅ a. Aproximación lineal por intervalos
- b. Transformadas Z
- c. Series de Fourier
- d. Árboles

---

### 2. Una función convexa posee:
- ✅ a. Un mínimo global potencial
- b. Un máximo global garantizado
- c. Un punto de silla obligatorio
- d. Solo óptimos locales

> *Corrección: en la captura se marcó "Un máximo global garantizado" (❌). En una función convexa el óptimo local es global y corresponde a un mínimo, no a un máximo.*

---

### 3. El gradiente indica:
- ✅ a. Dirección de máximo crecimiento
- b. Dirección mínima
- c. Curvatura
- d. Factibilidad

---

### 4. El método Newton-Raphson es:
- ✅ a. Iterativo
- b. Gráfico exclusivamente
- c. Exacto en una iteración siempre
- d. No derivativo

---

### 5. La programación geométrica utiliza:
- ✅ a. Productos y potencias
- b. Derivadas parciales exclusivamente
- c. Variables binarias
- d. Método simplex

> *Corrección: la programación geométrica trabaja con posinomios (sumas de términos formados por productos de variables elevadas a potencias reales), no con el método simplex.*

---

### 6. SUMT transforma el problema en:
- ✅ a. No restringido
- b. Lineal entero
- c. Transporte
- d. Asignación

> *Corrección: SUMT (Sequential Unconstrained Minimization Technique) incorpora las restricciones como funciones de penalización/barrera en la función objetivo, convirtiendo el problema restringido en una secuencia de problemas no restringidos.*

---

### 7. El método dicotómico reduce:
- ✅ a. El intervalo de incertidumbre
- b. La derivada
- c. La convexidad
- d. Las restricciones

---

### 8. Newton-Raphson utiliza:
- ✅ a. Derivadas
- b. Solo valores tabulados
- c. Matrices identidad
- d. Programación dinámica

---

### 9. La matriz Jacobiana contiene:
- ✅ a. Derivadas parciales
- b. Variables básicas
- c. Coeficientes simplex
- d. Probabilidades

---

### 10. En KKT una restricción activa:
- ✅ a. Se cumple como igualdad
- b. Se ignora
- c. Es redundante
- d. No afecta

---

### 11. El método del gradiente también se llama:
- ✅ a. Pendiente más pronunciada
- b. Método dual
- c. Método simplex
- d. Ramificación

---

### 12. SUMT requiere un punto inicial:
- ✅ a. Interior
- b. En la frontera
- c. No factible
- d. Óptimo

---

### 13. Si D es negativa definida, la función es:
- ✅ a. Cóncava
- b. Convexa
- c. Discontinua
- d. Lineal

> *Corrección: una matriz Hessiana negativa definida implica concavidad estricta de la función (máximo local). La convexidad corresponde a Hessiana positiva definida.*

---

### 14. El método de Lagrange maneja:
- ✅ a. Restricciones de igualdad
- b. Solo desigualdades
- c. Variables binarias
- d. Problemas lineales

---

## Preguntas Verdadero / Falso

### 15. KKT puede ser suficiente bajo convexidad.
- ✅ **Verdadero**
- Falso

---

### 16. La sección dorada reutiliza evaluaciones previas.
- ✅ **Verdadero**
- Falso

---

### 17. Una matriz Hessiana positiva definida garantiza un mínimo local.
- ✅ **Verdadero**
- Falso

---

### 18. El gradiente siempre encuentra el óptimo global.
- Verdadero
- ✅ **Falso**

---

### 19. La programación estocástica elimina la incertidumbre real.
- Verdadero
- ✅ **Falso**

---

### 20. La programación separable aproxima funciones no lineales.
- ✅ **Verdadero**
- Falso

---

### 21. Todo punto estacionario es óptimo global.
- Verdadero
- ✅ **Falso**

---

### 22. Newton-Raphson puede divergir.
- ✅ **Verdadero**
- Falso

---

## Preguntas de relación (Matching)

### 23. Relacione método y característica
| Método | Característica |
|---|---|
| KKT | ✅ Desigualdades |
| Lagrange | ✅ Multiplicadores |
| Jacobiano | ✅ Derivadas restringidas |
| Gradiente | ✅ Máxima pendiente |

---

### 24. Relacione algoritmo y aplicación
| Algoritmo | Aplicación correcta |
|---|---|
| SUMT | ✅ Transformación no restringida |
| Dicotómico | ✅ Intervalo de incertidumbre |
| Newton-Raphson | ✅ Derivadas / búsqueda con derivadas |
| Sección dorada | ✅ Función unimodal |

> *Corrección: el método dicotómico se aplica para reducir el intervalo de incertidumbre en búsqueda unidimensional, mientras que Newton-Raphson es un método basado en derivadas. La sección dorada opera sobre funciones unimodales reutilizando evaluaciones.*

---

## Preguntas de cálculo

### 25. Calcule f(x) = 7x² + 3 para x = 10
**Respuesta: 703** ✅
> 7·(10)² + 3 = 700 + 3 = **703**

---

### 26. Calcule f(x) = 8x² + 4 para x = 10
**Respuesta correcta: 804** ✅
> 8·(10)² + 4 = 800 + 4 = **804** *(la respuesta marcada "700" era incorrecta)*

---

### 27. Calcule f(x) = 3x² + 3 para x = 4
**Respuesta correcta: 51** ✅
> 3·(4)² + 3 = 48 + 3 = **51** *(la respuesta marcada "3000" era incorrecta)*
