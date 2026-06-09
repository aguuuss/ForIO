# Cuestionario — Unidad 5: Redes

> Transcripción de las capturas, con la respuesta correcta señalada con ✅.
> Donde la marca original era una cruz roja (incorrecta), se corrigió según la teoría de la unidad.
> Duplicados eliminados.

## Conceptos generales de redes

**1. Una red consiste en una serie de:**
- a. Nodos enlazados con arcos ✅
- b. Nodos enlazados con algún tipo de flujo
- c. Una sucesión de arcos distintos que unen ramas pasando por otras
- d. Ramas enlazadas con un flujo positivo

*(La marca original "b" era incorrecta: una red es un conjunto de nodos enlazados por arcos.)*

**2. Una red puede describirse mediante un conjunto de nodos y un conjunto de arcos.**
- ✅ Verdadero
- Falso

**3. Una red consiste en una serie de nodos enlazados con arcos (o ramas). La notación para describir una red es (X, Y), donde X es el conjunto de nodos y Y es el conjunto de arcos.**
- ✅ Verdadero
- Falso

**4. Una red consiste en una serie de nodos entrelazados mediante arcos. La notación para describir una red es (N, A), donde A es el conjunto de arcos y N es el conjunto de nodos.**
- ✅ Verdadero
- Falso

**5. Una red consiste en una serie de nodos y arcos (o ramas), que se entrelazan todos entre sí. La notación para describir una red es (N, A), donde A es el conjunto de nodos y N es el conjunto de arcos.**
- Verdadero
- ✅ Falso

*(Es falsa porque invierte la notación: N son los nodos y A los arcos, no al revés.)*

**6. Una red consiste en una serie de nodos enlazados con arcos (o ramas). La flotación para describir una red es (X, Y), donde X es el conjunto de nodos y Y es el conjunto de arcos.**
- ✅ Verdadero
- Falso

**7. Un arco es dirigido u orientado si permite un flujo positivo en una dirección, y flujo cero en la dirección opuesta.**
- ✅ Verdadero
- Falso

**8. Un arco es dirigido u orientado si permite un flujo negativo en una dirección, y flujo infinito en la dirección opuesta.**
- Verdadero
- ✅ Falso

*(Es falsa: un arco dirigido permite flujo positivo en una dirección y flujo cero en la opuesta, no flujo negativo ni infinito.)*

**9. Con cada red se asocia algún tipo de flujo (por ejemplo, flujo de productos petroleros en un oleoducto y flujos de tráfico de automóviles en carreteras). En general, el flujo en una red está limitado por la capacidad de sus arcos, que pueden ser finitos o infinitos.**
- ✅ Verdadero
- Falso

**10. En general, el flujo en una red está limitado por:**
- a. la cantidad de sus arcos, que pueden ser finitos o infinitos.
- b. la conectividad de sus arcos, que pueden ser finitos o infinitos.
- c. el coste de sus arcos, que pueden ser finitos o infinitos.
- d. la capacidad de sus arcos, que pueden ser finitos o infinitos. ✅

**11. Una ruta es:**
- a. Una variable de holgura
- b. Una restricción de demanda
- c. Una sucesión de arcos que conecta nodos ✅
- d. Un único nodo aislado

**12. Un ciclo aparece cuando:**
- a. La red no tiene arcos
- b. Todos los costos son cero
- c. Una ruta vuelve al nodo de partida ✅
- d. Hay una sola fuente

*(La marca original "d" era incorrecta: un ciclo se forma cuando una ruta vuelve sobre su nodo de partida.)*

**13. Una red conectada permite que existan nodos completamente aislados.**
- Verdadero
- ✅ Falso

**14. Un nodo con demanda neta positiva siempre se interpreta como fuente.**
- ✅ Verdadero
- Falso

*(Según el material de la cátedra: "El nodo j funciona como fuente si fj > 0 y como sumidero si fj < 0", donde fj es el flujo neto (salida − entrada). Por lo tanto, flujo/demanda neta positiva = fuente, y la afirmación es Verdadera.)*

## Árbol de expansión mínima

**15. El algoritmo del árbol de expansión mínima no enlaza los nodos de una red, en forma directa o indirecta, con la mínima longitud de las ramas enlazantes.**
- Verdadero
- ✅ Falso

*(Es falsa por la negación "no": el algoritmo sí enlaza los nodos con la mínima longitud de las ramas.)*

**16. El algoritmo de árbol de expansión mínima enlaza los nodos de una red,**
- a. en forma directa, con la mínima longitud de las ramas enlazantes
- b. en forma directa o indirecta, con la mínima longitud de las ramas enlazantes ✅
- c. en forma indirecta, con la mínima longitud de las ramas enlazantes
- d. en forma directa o indirecta, con la máxima longitud de las ramas enlazantes

**17. El algoritmo del árbol de expansión mínima enlaza los nodos de una red, en forma directa o indirecta, con la máxima longitud de las ramas enlazantes.**
- Verdadero
- ✅ Falso

*(Es falsa: la longitud total debe ser mínima, no máxima.)*

**18. En el algoritmo de árbol mínimo se elige en cada paso:**
- a. El arco más corto que conecta un nodo no conectado con el conjunto conectado ✅
- b. El arco de mayor capacidad
- c. El nodo sumidero
- d. La ruta crítica

**19. Si una red tiene n nodos, un árbol de expansión tiene:**
- a. n arcos
- b. n+1 ciclos
- c. 2n arcos
- d. n-1 arcos ✅

*(La marca original "2n arcos" era incorrecta: un árbol de expansión con n nodos tiene n-1 arcos.)*

**20. Si se desea conectar ciudades al menor costo total sin ciclos se usa:**
- a. Gantt
- b. PERT
- c. Árbol de expansión mínima ✅
- d. Flujo máximo

*(La marca original "PERT" era incorrecta: para conectar al menor costo sin ciclos se usa el árbol de expansión mínima.)*

**21. Relacione concepto con árbol de expansión mínima:**
- Árbol de expansión → Conecta todos los nodos ✅
- Criterio mínimo → Menor suma de longitudes ✅
- Árbol → Sin ciclos / red conexa sin ciclos ✅
- Cantidad de arcos → n − 1 ✅

*(En la captura original varias asociaciones estaban mal emparejadas; aquí se muestran correctamente.)*

## Ruta más corta

**22. Dijkstra calcula rutas más cortas desde:**
- a. Un nodo fuente hacia los demás nodos ✅
- b. Solo el nodo final
- c. Todos los pares simultáneamente
- d. Una ruta crítica CPM

**23. Si se desea calcular rutas mínimas entre todos los pares se usa:**
- a. CPM
- b. Floyd ✅
- c. Árbol mínimo
- d. Aceleración

**24. En Floyd se reemplaza una ruta directa si una ruta indirecta resulta más corta.**
- ✅ Verdadero
- Falso

**25. Relacione algoritmo y uso:**
- Floyd → Todos los pares de nodos ✅
- Dijkstra → Fuente a todos los nodos ✅
- Etiqueta temporal → Puede mejorar ✅
- Etiqueta permanente → Queda fijada ✅

**26. El problema de ruta más corta determina:**
- a. El flujo máximo admisible
- b. El árbol de expansión con todos los nodos
- c. La varianza del proyecto
- d. La trayectoria de costo mínimo entre nodos ✅

*(La marca original "b" era incorrecta: la ruta más corta determina la trayectoria de menor costo/longitud entre nodos.)*

## Flujo máximo y cortes

**27. Un corte en una red es:**
- a. Un ciclo dirigido
- b. Un conjunto de arcos cuya eliminación interrumpe el flujo fuente-sumidero ✅
- c. Una etiqueta temporal
- d. Una actividad ficticia

**28. La capacidad de un corte es:**
- a. La suma de las capacidades de sus arcos ✅
- b. El costo unitario menor
- c. El número de nodos
- d. La duración crítica

*(La marca original "El costo unitario menor" era incorrecta: la capacidad de un corte es la suma de las capacidades de sus arcos.)*

**29. En flujo máximo, la función objetivo maximiza:**
- a. La duración del proyecto
- b. El flujo total de fuente a sumidero ✅
- c. El número de actividades ficticias
- d. La suma de costos unitarios

**30. Las restricciones de capacidad en redes imponen:**
- a. Límites inferior y/o superior al flujo de un arco ✅
- b. Que los tiempos sean probabilísticos
- c. Que no exista fuente
- d. Que todos los nodos sean críticos

## Flujo con costo mínimo

**31. En el problema de costo mínimo se consideran costos unitarios por arco.**
- ✅ Verdadero
- Falso

**32. El flujo con costo mínimo busca:**
- a. Calcular tiempos esperados
- b. Maximizar la ruta más larga
- c. Eliminar todos los ciclos
- d. Minimizar costo total cumpliendo oferta, demanda y capacidades ✅

**33. El simplex de red aprovecha:**
- a. La estructura especial de conservación de flujo ✅
- b. La aceleración CPM
- c. La distribución beta de PERT
- d. La holgura independiente

**34. La formulación PL de redes usa restricciones de:**
- a. Varianza normal
- b. Conservación de flujo ✅
- c. Derivadas parciales
- d. Holgura independiente únicamente

## CPM (Critical Path Method)

**35. Una actividad crítica puede retrasarse libremente sin afectar la fecha final.**
- Verdadero
- ✅ Falso

**36. Una actividad crítica tiene:**
- a. Capacidad infinita
- b. Holgura cero ✅
- c. Costo cero
- d. Tiempo pesimista cero

*(La marca original "Costo cero" era incorrecta: una actividad crítica tiene holgura cero.)*

**37. La ruta crítica es:**
- a. El árbol con menor cantidad de arcos
- b. Una ruta residual
- c. La secuencia que determina la duración total del proyecto ✅
- d. La ruta de menor costo en una red vial

**38. CPM trabaja usualmente con tiempos:**
- a. Sin precedencias
- b. Determinísticos ✅
- c. Aleatorios normales
- d. Probabilísticos obligatorios

**39. El margen libre de una tarea:**
- a. Representa cuánto puede retrasarse la iniciación de una tarea, sin que su inicio perturbe el comienzo de las tareas que le anteceden
- b. Representa cuánto puede retrasarse la iniciación de una tarea, sin que su finalización perturbe el comienzo de las tareas que le anteceden
- c. Representa cuánto puede retrasarse la iniciación de una tarea, sin que su finalización perturbe el comienzo de las tareas que le siguen ✅
- d. Representa cuánto puede adelantarse la iniciación de una tarea, sin que su finalización perturbe el comienzo de las tareas que le siguen

**40. Dado que los nodos p, q, …, y v están enlazados directamente con el nodo j por las actividades de entrada (p, j), (q, j), …, y (v, j) y que los tiempos más tempranos de ocurrencia de los eventos (nodos) p, q, …, y v ya se han calculado, entonces se calcula el tiempo más temprano de ocurrencia del evento j como sigue: Ftj = máx {Ftp − Dpj, Ftq + Dqj, …, Ftv − Dvj}**
- Verdadero
- ✅ Falso

*(Es falsa: el paso hacia adelante suma duraciones, Ftj = máx {Ftp + Dpj, Ftq + Dqj, …, Ftv + Dvj}; la expresión mezcla restas.)*

**41. Dado que los nodos p, q, …, y v están enlazados indirectamente con el nodo j … entonces se calcula el tiempo más temprano de ocurrencia del evento j como sigue: Ftj = máx {Ftp + Dpj, Ftq + Dqj, …, Ftv + Dvj}**
- Verdadero
- ✅ Falso

*(Es falsa por la palabra "indirectamente": el cálculo del paso hacia adelante aplica a nodos enlazados directamente con j.)*

## PERT

**42. El algoritmo PERT se desarrolla mediante intervalos probabilísticos, considerando tiempos optimistas, medios y probables.**
- Verdadero
- ✅ Falso

*(Es falsa: las tres estimaciones de PERT son optimista, más probable y pesimista; "medios y probables" no es la terna correcta.)*

**43. El algoritmo PERT se desarrolla mediante intervalos probabilísticos, considerando tiempos optimistas, pesimistas y medios.**
- ✅ Verdadero
- Falso

**44. En PERT las tareas tienen tiempos:**
- a. Determinísticos
- b. Esperados ✅
- c. Naturales
- d. No Probables

**45. PERT y CPM son idénticos en la forma de estimar los tiempos.**
- Verdadero
- ✅ Falso

*(La marca original "Verdadero" era incorrecta: CPM usa tiempos determinísticos y PERT, probabilísticos.)*

**46. PERT: calcule el tiempo esperado Te para a=2, m=5, b=8. Use Te=(a+4m+b)/6.**
- **Respuesta: 5** ✅ — (2 + 4·5 + 8) / 6 = 30 / 6 = 5

**47. PERT: calcule la varianza de una actividad con a=5 y b=17. Use ((b−a)/6)².**
- **Respuesta: 4** ✅ — ((17 − 5)/6)² = (12/6)² = 2² = 4

*(La respuesta original "3452" era incorrecta.)*

## Diagramas de Gantt y programación temporal

**48. El diagrama de Gantt muestra actividades en barras sobre un eje temporal.**
- ✅ Verdadero
- Falso

**49. El Gantt sirve principalmente para:**
- a. Programar y controlar ejecución temporal ✅
- b. Resolver todos los pares de ruta corta
- c. Determinar capacidad máxima
- d. Obtener costos reducidos

*(La marca original "Determinar capacidad máxima" era incorrecta: el Gantt sirve para programar y controlar la ejecución temporal.)*

**50. El Diagrama Calendario permite la visualización de un programa mediante un gráfico ejecutado en escala de tiempo, puede realizarse únicamente en CPM.**
- Verdadero
- ✅ Falso

*(Es falsa por "únicamente en CPM": el diagrama calendario no es exclusivo de CPM.)*

**51. El Diagrama Calendario permite la visualización de un programa mediante un gráfico ejecutado en escala de tiempo, a fechas tempranas solamente.**
- Verdadero
- ✅ Falso

*(La marca original "Verdadero" era incorrecta: el diagrama calendario puede hacerse a fechas tempranas y tardías, no solamente a tempranas.)*

**52. El diagrama de calendario a fechas tempranas:**
- a. Los nodos no críticos se dibujan en su Fti ✅
- b. Los nodos críticos se dibujan en su Fti
- c. Los nodos no críticos se dibujan en su FTi
- d. Los nodos críticos se dibujan en su FTi

**53. El diagrama de calendario a fechas temprana sirve de base para (marque la incorrecta):**
- a. La tabla de recursos
- b. El diagrama financiero ✅ *(opción incorrecta = respuesta buscada)*
- c. El diagrama de recursos
- d. La tabla acumulada de recursos

*(La consigna pide la opción que NO corresponde. El diagrama financiero se construye sobre el acumulado de recursos, no directamente sobre el calendario a fechas tempranas, por lo que es la opción incorrecta que la pregunta solicita marcar.)*

**54. Relacione herramienta con función:**
- Fechas tardías → Inicio lo más tarde permitido ✅
- Fechas tempranas → Inicio lo antes posible ✅
- Diagrama financiero → Calendario de actividades / acumulado de recursos ✅
- Gantt → Calendario de actividades (programación y control) ✅

*(En la captura original varias asociaciones estaban mal emparejadas; aquí se corrigen.)*

## Formulación matemática y diagramas de proyecto

**55. El diagrama de potenciales evidencia la precedencia de las tareas, colocando las mismas en arcos dirigidos.**
- Verdadero
- ✅ Falso

*(Es falsa: en el diagrama de potenciales las tareas se colocan en los nodos, no en los arcos.)*

**56. En el diagrama de potenciales las tareas se colocan en los arcos.**
- Verdadero
- ✅ Falso

*(Es falsa: en el diagrama de potenciales las tareas van en los nodos.)*

**57. El diagrama de potenciales evidencia los tiempos de las tareas.**
- Verdadero
- ✅ Falso

**58. La matriz de precedencias sirve como base para construir el:**
- a. Diagrama de potenciales ✅
- b. Diagrama de Flechas
- c. Diagrama financiero
- d. Diagrama de red

*(La marca original "Diagrama de Flechas" era incorrecta: la matriz de precedencias es la base del diagrama de potenciales.)*

**59. La matriz de precedencias permite visualizar las tareas iniciales y finales examinando en el primer caso las columnas sin marcas, y en el segundo caso las filas sin marcas.**
- ✅ Verdadero
- Falso

**60. La matriz de precedencias permite visualizar las tareas iniciales y finales examinando en el primer caso las filas sin marcas, y en el segundo caso las columnas sin marcas.**
- Verdadero
- ✅ Falso

*(La marca original "Verdadero" era incorrecta: las tareas iniciales se ven en las columnas sin marcas y las finales en las filas sin marcas, no al revés.)*

**61. El diagrama de Flechas sirve para:**
- a. Determinar la ruta crítica, la duración del proyecto, y los márgenes de las tareas ✅
- b. Determinar la ruta crítica, la duración del proyecto, los márgenes de las tareas y los costos
- c. Determinar la ruta crítica
- d. Determinar la ruta crítica y la duración del proyecto

*(La marca original "Determinar la ruta crítica" era incompleta: el diagrama de flechas determina ruta crítica, duración y márgenes, pero no los costos.)*

## PERT/CPM — generalidades y planificación de proyectos

**62. Los métodos CPM y PERT tienen por objeto la planeación, programación y control de proyectos, solo como elemento de diseño.**
- Verdadero
- ✅ Falso

*(Es falsa por "solo como elemento de diseño": CPM/PERT sirven para planear, programar y controlar proyectos, no únicamente para diseño.)*

**63. Los métodos CPM y PERT tienen por objeto la planeación, programación y control de proyectos, sirve como elemento de auxiliar.**
- ✅ Verdadero
- Falso

**64. El PERT/CPM fue diseñado para proporcionar diversos elementos útiles de información para los administradores del proyecto (marque la incorrecta):**
- a. permite que el gerente manipule ciertas actividades para aliviar estos problemas.
- b. No identifica los instantes del proyecto en que estas restricciones causarán problemas; considera los recursos necesarios para completar las actividades. ✅ *(opción incorrecta = respuesta buscada)*
- c. Identifica actividades críticas y la cantidad de tiempo disponible para retardos.
- d. Expone la "ruta crítica" de un proyecto.

**65. El enunciado de una actividad debe especificar lo qué debe hacerse (naturaleza del trabajo, cantidad, calidad), quién debe hacerlo, cuándo debe hacerse (cronología, intervalos y plazos), dónde debe hacerse, cómo debe efectuarse (normas de rendimiento cualitativa y cuantitativamente: documentos técnicos, protocolos).**
- ✅ Verdadero
- Falso

**66. El enunciado de una actividad debe especificar lo qué debe hacerse … quién NO debe hacerlo … normas de rendimiento solo cualitativamente …**
- Verdadero
- ✅ Falso

*(Es falsa: dice "quién NO debe hacerlo" y "solo cualitativamente", cuando debe especificar quién debe hacerlo y normas cuali y cuantitativas.)*

## Relación problema–técnica (integración)

**67. Relacione problema con técnica:**
- Determinar camino de menor longitud → Ruta más corta ✅
- Programar proyecto → CPM/PERT ✅
- Conectar nodos al menor costo → Árbol de expansión mínima ✅
- Enviar mayor caudal posible → Flujo máximo ✅

**68. Relacione modelo con objetivo:**
- Flujo máximo → Maximizar caudal ✅
- CPM → Determinar duración del proyecto ✅
- Ruta más corta → Minimizar distancia ✅
- Costo mínimo → Minimizar costo total ✅

**69. Si se desea programar actividades con precedencias y duración total se usa:**
- a. Flujo mínimo
- b. Dijkstra exclusivamente
- c. Corte mínimo
- d. CPM/PERT ✅

*(La marca original "Corte mínimo" era incorrecta: para programar actividades con precedencias y duración total se usa CPM/PERT.)*
