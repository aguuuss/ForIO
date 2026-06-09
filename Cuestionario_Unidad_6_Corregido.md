# Cuestionario — Unidad 6: Teoría de Stocks (Inventarios)

> Respuestas validadas y corregidas con base en el material del proyecto (Taha, cap. 13 y 16; Unidad 6 Stocks).
> Las opciones marcadas con ✅ son las correctas. Se eliminaron los enunciados duplicados.

---

## Preguntas de relación (Matching)

### 1. Relacionar conceptos vinculados a Modelo probabilístico
| Concepto | Relación |
|---|---|
| ABC | ✅ Clasificación de inventarios |
| EOQ | ✅ Lote económico |
| K | ✅ Costo de pedido |

---

### 2. Relacionar conceptos vinculados a Método Boodman y Magee
| Concepto | Relación |
|---|---|
| ABC | ✅ Clasificación de inventarios |
| K | ✅ Costo de pedido |
| EOQ | ✅ Lote económico |

> *Corrección: la captura asignaba K → Lote económico (incorrecto). K es siempre el costo de preparación o pedido.*

---

### 3. Relacionar conceptos vinculados a Inventario de contingencia
| Concepto | Relación |
|---|---|
| EOQ | ✅ Lote económico |
| K | ✅ Costo de pedido |
| ABC | ✅ Clasificación de inventarios |

---

### 4. Relacionar conceptos vinculados a Costo mínimo
| Concepto | Relación |
|---|---|
| ABC | ✅ Clasificación de inventarios |
| EOQ | ✅ Lote económico |
| K | ✅ Costo de pedido |

> *Corrección: la captura tenía las tres asignaciones cruzadas (ABC→Costo de pedido, EOQ→Clasificación, K→Lote económico). El significado simbólico de los tres es estándar e invariable.*

---

### 5. Relacionar conceptos vinculados a Costo de escasez
| Concepto | Relación |
|---|---|
| ABC | ✅ Clasificación de inventarios |
| K | ✅ Costo de pedido |
| EOQ | ✅ Lote económico |

> *Corrección: la captura tenía nuevamente las tres asignaciones cruzadas. Los símbolos no cambian con el contexto del concepto que se relaciona.*

---

### 6. Relacionar conceptos vinculados a Número de órdenes
| Concepto | Relación |
|---|---|
| K | ✅ Costo de pedido |
| ABC | ✅ Clasificación de inventarios |
| EOQ | ✅ Lote económico |

---

## Preguntas de opción múltiple

### 7. ¿Cuál de las siguientes afirmaciones describe mejor el concepto de Número de órdenes?
- ✅ a. Número de órdenes se relaciona con la optimización de inventarios.
- b. Número de órdenes elimina totalmente la demanda.
- c. Número de órdenes reemplaza la clasificación ABC.
- d. Número de órdenes solo se usa en programación lineal.

---

### 8. ¿Cuál de las siguientes afirmaciones describe mejor el concepto de Sensibilidad?
- a. Sensibilidad elimina totalmente la demanda.
- b. Sensibilidad solo se usa en programación lineal.
- c. Sensibilidad reemplaza la clasificación ABC.
- ✅ d. Sensibilidad se relaciona con la optimización de inventarios.

---

### 9. ¿Cuál de las siguientes afirmaciones describe mejor el concepto de Modelo triangular?
- a. Modelo triangular reemplaza la clasificación ABC.
- ✅ b. Modelo triangular se relaciona con la optimización de inventarios.
- c. Modelo triangular elimina totalmente la demanda.
- d. Modelo triangular solo se usa en programación lineal.

---

### 10. Para determinar el stock de seguridad en los casos de demanda aleatoria, se selecciona:
- ✅ a. Aquel que tenga el menor costo de almacenamiento y faltante esperado
- b. Aquel que tenga el mayor costo de almacenamiento y faltante esperado
- c. Aquel que tenga el igual costo de almacenamiento y faltante esperado
- d. Aquel que tenga el menor costo de faltante esperado

---

### 11. ¿Cuál de las siguientes afirmaciones describe mejor el concepto de Probabilidad acumulada?
- a. Probabilidad acumulada solo se usa en programación lineal.
- b. Probabilidad acumulada elimina totalmente la demanda.
- ✅ c. Probabilidad acumulada se relaciona con la optimización de inventarios.
- d. Probabilidad acumulada reemplaza la clasificación ABC.

> *Corrección: la probabilidad acumulada es central en el modelo de período único (newsvendor) para hallar el lote óptimo, no elimina la demanda.*

---

### 12. En el modelo de un período con preparación (política s-S) está garantizada la optimalidad de la política s-S porque:
- a. La función correspondiente de costo es cóncava.
- ✅ b. La función correspondiente de costo es convexa.
- c. La función correspondiente de costo es no lineal.
- d. La función correspondiente de costo es positiva.

> *Corrección: Taha (sección 16.2.2) afirma explícitamente: "La optimalidad de la política s-S está garantizada porque la función de costo asociada es convexa."*

---

### 13. ¿Cuál de las siguientes afirmaciones describe mejor el concepto de Costo de agotamiento?
- a. Costo de agotamiento elimina totalmente la demanda.
- b. Costo de agotamiento solo se usa en programación lineal.
- ✅ c. Costo de agotamiento se relaciona con la optimización de inventarios.
- d. Costo de agotamiento reemplaza la clasificación ABC.

> *Corrección: el costo de agotamiento (faltante) es una de las cuatro componentes del costo total del inventario en Taha.*

---

### 14. ¿Cuál de los supuestos siguientes no pertenece al modelo sin costo de preparación?
- a. La función de costo unitario de producción en cualquier periodo es constante o tiene costos marginales crecientes (es decir, es convexa).
- b. No se incurre costo de preparación en ningún periodo.
- c. No se permiten faltantes.
- ✅ d. El costo unitario de almacenamiento en cualquier periodo no es constante.

> *Corrección: Taha (sección 13.4.1) lista los cuatro supuestos del modelo sin costo de preparación: (1) no hay costo de preparación, (2) no se permiten faltantes, (3) función de costo de producción convexa, y (4) **el costo de retención unitario en cualquier periodo es constante**. El supuesto que NO pertenece es por tanto su negación: "el costo unitario de almacenamiento no es constante".*

---

### 15. ¿Cuál de las siguientes afirmaciones describe mejor el concepto de Stock de seguridad?
- a. Stock de seguridad reemplaza la clasificación ABC.
- b. Stock de seguridad solo se usa en programación lineal.
- c. Stock de seguridad elimina totalmente la demanda.
- ✅ d. Stock de seguridad se relaciona con la optimización de inventarios.

> *Corrección: el stock de seguridad es una variable de decisión típica en modelos EOQ probabilísticos para protegerse contra la incertidumbre de la demanda.*

---

### 16. ¿Cuál de las siguientes afirmaciones describe mejor el concepto de Costo de escasez?
- ✅ a. Costo de escasez se relaciona con la optimización de inventarios.
- b. Costo de escasez solo se usa en programación lineal.
- c. Costo de escasez reemplaza la clasificación ABC.
- d. Costo de escasez elimina totalmente la demanda.

> *Corrección: el costo de escasez es uno de los cuatro costos básicos del modelo general de inventario (Taha cap. 13).*

---

### 17. ¿Cuál de las siguientes afirmaciones describe mejor el concepto de Importancia del inventario?
- a. Importancia del inventario elimina totalmente la demanda.
- b. Importancia del inventario solo se usa en programación lineal.
- c. Importancia del inventario reemplaza la clasificación ABC.
- ✅ d. Importancia del inventario se relaciona con la optimización de inventarios.

> *Corrección: la importancia del inventario radica precisamente en su optimización, no elimina la demanda.*

---

## Preguntas Verdadero / Falso

### 18. El concepto de Costo de pedido es utilizado en teoría de stocks.
- ✅ **Verdadero**
- Falso

---

### 19. El concepto de Nivel máximo es utilizado en teoría de stocks.
- ✅ **Verdadero**
- Falso

---

### 20. El concepto de Curva de Pareto es utilizado en teoría de stocks.
- ✅ **Verdadero**
- Falso

---

### 21. El concepto de Modelo con escasez es utilizado en teoría de stocks.
- ✅ **Verdadero**
- Falso

---

### 22. El concepto de Número de órdenes es utilizado en teoría de stocks.
- ✅ **Verdadero**
- Falso

> *Corrección: la captura marcaba Falso. El número de órdenes (N = D/Q*) es un parámetro fundamental del modelo EOQ.*

---

### 23. El concepto de Costo de escasez es utilizado en teoría de stocks.
- ✅ **Verdadero**
- Falso

---

### 24. El concepto de Esperanza matemática es utilizado en teoría de stocks.
- ✅ **Verdadero**
- Falso

---

### 25. El concepto de Producción simultánea es utilizado en teoría de stocks.
- ✅ **Verdadero**
- Falso

---

### 26. El concepto de Sensibilidad es utilizado en teoría de stocks.
- ✅ **Verdadero**
- Falso

> *Corrección: la captura marcaba Falso. La sensibilidad analiza cómo varía el lote óptimo ante cambios en los parámetros D, K, c₁; es una herramienta estándar en EOQ.*

---

### 27. El concepto de Costo mínimo es utilizado en teoría de stocks.
- ✅ **Verdadero**
- Falso

> *Corrección: la captura marcaba Falso. El objetivo central de la teoría de inventarios es minimizar el costo total (preparación + retención + escasez + compra).*

---

## Preguntas de cálculo — EOQ

> **Fórmula utilizada:** $Q^* = \sqrt{\dfrac{2 \cdot D \cdot K}{c_1}}$

### 28. Calcule el lote óptimo EOQ para D=3828, K=100, c₁=9
**Respuesta: 292** ✅
> Q* = √(2·3828·100/9) = √85066,67 ≈ **291,66 ≈ 292**

---

### 29. Calcule el lote óptimo EOQ para D=2669, K=398, c₁=7
**Respuesta correcta: 551** ✅
> Q* = √(2·2669·398/7) = √303492 ≈ **550,9 ≈ 551** *(la respuesta marcada "3000" era incorrecta)*

---

### 30. Calcule el lote óptimo EOQ para D=1418, K=108, c₁=6
**Respuesta correcta: 226** ✅
> Q* = √(2·1418·108/6) = √51048 ≈ **225,94 ≈ 226** *(la respuesta marcada "30000" era incorrecta)*

---

### 31. Calcule el lote óptimo EOQ para D=1061, K=123, c₁=1
**Respuesta correcta: 511** ✅
> Q* = √(2·1061·123/1) = √261006 ≈ **510,89 ≈ 511** *(la respuesta marcada "10000" era incorrecta)*

---

### 32. Calcule el lote óptimo EOQ para D=4727, K=317, c₁=3
**Respuesta correcta: 999** ✅
> Q* = √(2·4727·317/3) = √998972,67 ≈ **999,49 ≈ 999** *(la respuesta marcada "3000" era incorrecta)*

---

### 33. Calcule el lote óptimo EOQ para D=4706, K=457, c₁=8
**Respuesta correcta: 733** ✅
> Q* = √(2·4706·457/8) = √537660,5 ≈ **733,25 ≈ 733** *(la respuesta marcada "30000" era incorrecta)*

---

### 34. Calcule el lote óptimo EOQ para D=2106, K=54, c₁=8
**Respuesta correcta: 169** ✅
> Q* = √(2·2106·54/8) = √28431 ≈ **168,62 ≈ 169** *(la respuesta marcada "30000" era incorrecta)*

---

### 35. Calcule el lote óptimo EOQ para D=4290, K=458, c₁=10
**Respuesta correcta: 627** ✅
> Q* = √(2·4290·458/10) = √392964 ≈ **626,87 ≈ 627** *(la respuesta marcada "5000" era incorrecta)*
