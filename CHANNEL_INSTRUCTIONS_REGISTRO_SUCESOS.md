# 📜 REGISTRO DE ACTIVIDADES

Bienvenido al foro de registro de actividades. Este es el espacio oficial donde registras todas tus acciones on-rol para que sean procesadas por el sistema.

---

## ✅ ¿Qué Debes Hacer? (3 Pasos)

### 1. Crea tu Post Personal
- **1 post por usuario** en este foro
- El título del post debe ser tu **Keko de Hobba** (nombre de tu personaje)
- Usa tu mismo post para todas tus actividades futuras

### 2. Reúne Evidencia Válida
Antes de enviar un comando, asegúrate de tener:
- Link de un post del foro
- Mensaje de Discord
- Prueba verificable que demuestre tu actividad
- **Evita evidencias incompletas o sin contexto**

### 3. Registra la Actividad
Usa el comando `/registrar_actividad` con los detalles correspondientes. El sistema procesará tu solicitud de inmediato.

---

## 🎯 Campos del Comando `/registrar_actividad`

| Campo | Descripción | Requerido | Notas |
|-------|-------------|-----------|-------|
| `tipo` | Tipo de actividad realizada | Sí | Misión, Combate, Crónica, Evento, Escena, Curación, Logros, etc. |
| `evidencia` | Link o prueba de la actividad | Sí | URL a foro, mensaje, o prueba verificable |
| `rango` | Rango de la actividad | Depende del tipo | D, C, B, A, S (para Misión/Combate/Experimento) |
| `severidad` | Severidad de herida | Depende del tipo | Herido Leve, Grave, Crítico, Coma, Letal (solo para Curación) |
| `resultado` | Resultado de la actividad | Depende del tipo | Exitosa, Fallida, Destacado, Participación, Victoria, Derrota, etc. |
| `nombre_actividad` | Nombre de la Crónica/Evento | Opcional | Para Crónicas/Eventos históricos, permite aplicar recompensas precisas |

---

## ⚡ Actividades que se Aprueban al Instante

Las siguientes actividades reciben recompensas **automáticamente** y son aprobadas de inmediato:

### Misión
- **Rango D/C**: 7 EXP, 20 PR, 700 Ryou (si exitosa; solo EXP si fallida)
- **Rango B**: 15 EXP, 45 PR, 1,500 Ryou (si exitosa; solo EXP si fallida)
- **Rango A**: 30 EXP, 100 PR, 7,000 Ryou (si exitosa; solo EXP si fallida)
- **Rango S**: 60 EXP, 200 PR, 0 Ryou (staff distribuye 100k Ryou por separado)

### Combate
- **EXP**: 3 (mismo rango) | 1 (rango inferior) | 3 + 2×(diferencia) (rango superior) | 1 (derrota)
- **PR**: 5 (C) | 10 (B) | 20 (A) | 30 (S)
- **Cap semanal**: Máximo 5 combates por semana
- **Nota**: No puedes hacer combates en una semana si ya hiciste curaciones

### Curación
- **EXP**: Siempre 2
- **PR por severidad**:
  - Herido Leve: 5 PR
  - Herido Grave: 10 PR
  - Herido Crítico: 15 PR
  - Coma: 25 PR
  - Herida Letal: 40 PR
- **Cap semanal**: Máximo 10 curaciones por semana
- **Nota**: No puedes hacer curaciones en una semana si ya hiciste combates

### Desarrollo Personal
- **EXP por nivel**: D=4 | C=6 | B=8 | A=10 | S=12
- **PR**: 0
- **Ryou**: 0

### Crónica y Evento (Recompensas Históricas/Estándar)
- Crónicas y Eventos conocidos usan recompensas históricas exactas (catálogo actual: 11 actividades)
- Si es una Crónica/Evento histórica, proporciona el `nombre_actividad` para aplicar recompensas precisas
- Si es una Crónica/Evento nueva (no en el sistema):
  - **Crónica normal**: 15 EXP, 20 PR | **Destacado**: +5 EXP, +5 PR
  - **Evento normal**: 15 EXP, 15 PR | **Destacado**: +5 EXP, +5 PR
- **Nota**: Los registros con resultado "Destacado" en Crónicas/Eventos quedan en revisión manual por staff/narrador

---

## 🔍 Actividades que Requieren Revisión de Staff

Las siguientes actividades proyectan recompensas pero requieren aprobación manual de Staff:

- **Escena**: Narrador decide recompensas
- **Logro General**: Staff verifica que cumpliste la condición
- **Logro de Saga**: Staff verifica y asigna recompensas
- **Logro de Reputación**: Staff valida el hito y asigna PR
- **Experimento**: Staff valida el contexto
- **Timeskip**: Staff define recompensas per-caso
- **Crónicas/Eventos Destacado**: Staff confirma quién merece Destacado

Para estas actividades, el comando `/registrar_actividad` las guarda como **PENDIENTE** y staff las aprueba con `/aprobar_registro` asignando recompensas manuales.

---

## ⚠️ Reglas Importantes

1. **El bot guarda tu registro en estado automático o pendiente**, según el tipo de actividad.
   - Si es auto-aprobada: se acredita de inmediato
   - Si es pendiente: no ves recompensas hasta que Staff apruebe

2. **La respuesta del comando muestra**:
   - Para actividades auto-aprobadas: recompensas FINALES acreditadas
   - Para actividades pendientes: recompensas PROYECTADAS (pueden cambiar tras revisión de Staff)

3. **Guarda el ID de Registro** que aparece en la respuesta por si Staff lo solicita

4. **Capitulos Mensuales**: Los "Mesiversario" (recompensas mensuales del 10) son otorgadas por la Administración, no se registran aquí

5. **Bono Semanal**: Cada lunes ganas **+2 EXP** al cobrar tu sueldo (comando `/cobrar_sueldo`)

6. **Exclusividad Semanal**: 
   - En una misma semana, puedes hacer COMBATES O CURACIONES, pero no ambas (máx 5 combates, máx 10 curaciones)
   - El cambio se resetea cada lunes

---

## 📊 Tabla de Resumen

| Tipo de Actividad | Auto-Aprobado | Recompensas | Condiciones |
|---|---|---|---|
| Misión | ✅ | Por rango | Rango + Resultado obligatorios |
| Combate | ✅ | Por rango enemigo | Rango + Resultado obligatorios; Cap 5/semana |
| Curación | ✅ | Por severidad | Rango (severidad) obligatorio; Cap 10/semana |
| Desarrollo Personal | ✅ | Por nivel | Automático según tu nivel |
| Crónica (normal) | ✅ | Histórico o estándar | Opcionalmente `nombre_actividad` |
| Evento (normal) | ✅ | Histórico o estándar | Opcionalmente `nombre_actividad` |
| Escena | ❌ | Staff decide | Staff aprueba y asigna recompensas |
| Logro General | ❌ | Staff decide | Staff verifica condición y asigna |
| Logro de Saga | ❌ | Staff decide | Staff verifica y asigna |
| Logro de Reputación | ❌ | Staff decide | Staff valida hito y asigna PR |
| Experimento | ❌ | Staff decide | Staff valida y asigna |
| Timeskip | ❌ | Staff decide | Staff define per-caso |
| Crónica/Evento Destacado | ❌ | Staff decide | Staff revisa y confirma Destacado |

---

## 💡 Ejemplo de Uso

### Escenario 1: Misión Auto-Aprobada
```
/registrar_actividad
  tipo: Misión
  evidencia: https://discord.com/...
  rango: B
  resultado: Exitosa
```
**Resultado**: ✅ Auto-aprobada. Recibes +15 EXP, +45 PR, +1500 Ryou **de inmediato**.

### Escenario 2: Crónica Histórica
```
/registrar_actividad
  tipo: Crónica
  evidencia: https://forum-link
  resultado: Participacion
  nombre_actividad: El sueño del sabio - capitulo I. Clase de Indra
```
**Resultado**: ✅ Auto-aprobada. Recibes +10 EXP, +20 PR **de inmediato** (recompensa histórica exacta).

### Escenario 3: Logro Manual
```
/registrar_actividad
  tipo: Logro General
  evidencia: https://evidence
  resultado: Participacion
```
**Resultado**: ⏳ **PENDIENTE**. Staff revisa que cumpliste el logro y aprueba con `/aprobar_registro exp:X pr:Y ryou:Z`.

---

## 🔒 Política de Evidencia

- Todos los links deben ser públicos o accesibles para Staff
- Si proporcionas un link a un mensaje privado, Staff puede solicitarte una captura de pantalla
- Evidencia incompleta o sospechosa puede resultar en rechazo de la actividad

---

## ❓ Preguntas Frecuentes

**P: ¿Puedo registrar una actividad antigua?**  
R: Sí, pero debes proporcionar evidencia verificable (link al foro, screenshot, etc.).

**P: ¿Qué pasa si no tengo "Destacado"?**  
R: Registra la actividad con `resultado: Participacion` (o deja en blanco). El bot automáticamente aplica la recompensa estándar.

**P: ¿Puedo cambiar mi registro después de enviarlo?**  
R: No, el registro es inmutable. Si necesitas corrección, contacta a Staff.

**P: ¿Hay límite de actividades por día?**  
R: Sí para Combates (5/semana) y Curaciones (10/semana). Otras actividades no tienen límite diario.

**P: ¿Qué es el "Ryou de S-rank"?**  
R: Las misiones S-rank otorgan 100,000 Ryou que se distribuyen manualmente entre participantes. El bot no lo acredita automáticamente.

---

**¡Gracias por contribuir al rol de Naruto Ninja Chronicles! Mantén la diversión y el orden. :)**
