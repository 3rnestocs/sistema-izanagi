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

## 🎯 Estructura del Comando `/registrar_actividad`

El comando usa **grupos** y **subcomandos**. Primero elige el grupo, luego el tipo concreto:

### Grupo **combate** (Misión o Combate)
- `mision` — evidencia, rango (D/C/B/A/S), resultado (Exitosa/Fallida)
- `combate` — evidencia, rango (D/C/B/A/S), resultado (Victoria/Derrota/Empate)

### Grupo **narrativa** (Crónica, Evento o Escena)
- `cronica` — evidencia, nombre_actividad (opcional, autocompletado), resultado (Destacado/Participación)
- `evento` — evidencia, nombre_actividad (opcional, autocompletado), resultado (Destacado/Participación)
- `escena` — evidencia, exp (obligatorio), pr y ryou (opcionales)

### Grupo **logros**
- `logro_general` — evidencia, nombre_logro (autocompletado), exp/pr/ryou (si el logro es manual)
- `logro_saga` — evidencia, exp (obligatorio), pr y ryou (opcionales)
- `logro_reputacion` — evidencia, nombre_logro (autocompletado), exp/pr/ryou (si el logro es manual)

### Grupo **otros**
- `balance_general` — evidencia, nombre_actividad (autocompletado, obligatorio)
- `experimento` — evidencia, rango, resultado (Exitosa/Fallida), exp
- `curacion` — evidencia, severidad (Herido Leve/Grave/Crítico/Coma/Letal)
- `desarrollo_personal` — evidencia
- `timeskip` — evidencia, exp (obligatorio), pr y ryou (opcionales)

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
- **Obligatorio**: Debes seleccionar `resultado` (**Destacado** si fuiste destacado, o **Participación** si no).
- Crónicas y Eventos usan el campo `nombre_actividad` con **autocompletado** filtrado por tipo (solo verás opciones de Cronica vieja o Evento viejo según el tipo seleccionado).
- Si es una Crónica/Evento **histórica** (en el catálogo): requiere revisión de Staff y aprobación por reacción ✅.
- Si es una Crónica/Evento **estándar** (sin nombre o no en catálogo): se auto-aprueban.
  - **Crónica normal**: 15 EXP, 20 PR | **Destacado**: +5 EXP, +5 PR
  - **Evento normal**: 15 EXP, 15 PR | **Destacado**: +5 EXP, +5 PR

### Balance General
- Recompensas especiales por participación en balances (ej. "Todos los personajes con ficha", "Recompensa por 4 participaciones").
- **Obligatorio**: Selecciona una opción en `nombre_actividad` del catálogo (autocompletado filtrado).
- Requiere revisión de Staff y aprobación por reacción ✅.

---

## 🔍 Actividades que Requieren Revisión de Staff

Las siguientes actividades proyectan recompensas pero requieren aprobación manual de Staff:

- **Escena**: Narrador decide recompensas
- **Logro General**: Staff verifica que cumpliste la condición
- **Logro de Saga**: Staff verifica y asigna recompensas
- **Logro de Reputación**: Staff valida el hito y asigna PR
- **Experimento**: Staff valida el contexto
- **Timeskip**: Staff define recompensas per-caso

Para estas actividades, el comando `/registrar_actividad` las guarda como **PENDIENTE**. El usuario indica la EXP (y opcionalmente PR/Ryou) que reclama. Staff aprueba **reaccionando con ✅** en el mensaje del registro. Si el mensaje fue borrado, Staff puede usar `/ajustar_recursos otorgar` para acreditar los recursos manualmente.

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
| Curación | ✅ | Por severidad | `severidad` obligatorio; Cap 10/semana |
| Desarrollo Personal | ✅ | Por nivel | Automático según tu nivel |
| Crónica (estándar) | ✅ | Tabla estándar | Sin `nombre_actividad` |
| Evento (estándar) | ✅ | Tabla estándar | Sin `nombre_actividad` |
| Crónica/Evento histórica | ❌ | Catálogo histórico | Requiere `resultado` (Destacado/Participación) + `nombre_actividad` (autocompletado) + aprobación Staff por reacción ✅ |
| Balance General | ❌ | Catálogo histórico | Requiere `nombre_actividad` (autocompletado) + aprobación Staff por reacción ✅ |
| Escena | ❌ | Staff decide | Staff aprueba y asigna recompensas |
| Logro General | ❌ | Staff decide | Staff verifica condición y asigna |
| Logro de Saga | ❌ | Staff decide | Staff verifica y asigna |
| Logro de Reputación | ❌ | Staff decide | Staff valida hito y asigna PR |
| Experimento | ❌ | Staff decide | Staff valida y asigna |
| Timeskip | ❌ | Staff decide | Staff define per-caso |

---

## 💡 Ejemplo de Uso

### Escenario 1: Misión Auto-Aprobada
```
/registrar_actividad combate mision
  evidencia: https://discord.com/...
  rango: B
  resultado: Exitosa
```
**Resultado**: ✅ Auto-aprobada. Recibes +15 EXP, +45 PR, +1500 Ryou **de inmediato**.

### Escenario 2: Crónica Histórica
```
/registrar_actividad narrativa cronica
  evidencia: https://forum-link
  resultado: Participación
  nombre_actividad: Cronica vieja: El sueño del sabio I - Recuento
```
**Resultado**: ⏳ **PENDIENTE**. Crónicas/Eventos históricas requieren revisión de Staff. Staff reacciona con ✅ para aprobar. (Si fuiste Destacado, selecciona `resultado: Destacado`.)

### Escenario 3: Logro Manual
```
/registrar_actividad logros logro_general
  evidencia: https://evidence
  nombre_logro: [selecciona del autocompletado]
  exp: [si el logro requiere revisión manual]
```
**Resultado**: ⏳ **PENDIENTE**. Indica la EXP que reclamas si aplica; Staff revisa y reacciona con ✅ para aprobar.

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
R: Para Crónicas y Eventos, selecciona `resultado: Participación Normal`. Si fuiste destacado, selecciona `resultado: Destacado` para el bono extra. El campo resultado es obligatorio en Crónicas/Eventos.

**P: ¿Puedo cambiar mi registro después de enviarlo?**  
R: No, el registro es inmutable. Si necesitas corrección, contacta a Staff.

**P: ¿Hay límite de actividades por día?**  
R: Sí para Combates (5/semana) y Curaciones (10/semana). Otras actividades no tienen límite diario.

**P: ¿Qué es el "Ryou de S-rank"?**  
R: Las misiones S-rank otorgan 100,000 Ryou que se distribuyen manualmente entre participantes. El bot no lo acredita automáticamente.

---

**¡Gracias por contribuir al rol de Naruto Ninja Chronicles! Mantén la diversión y el orden. :)**
