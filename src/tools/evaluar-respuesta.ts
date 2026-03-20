/**
 * Evalúa la respuesta de un alumno a un ejercicio.
 * Devuelve feedback estructurado con lo que estuvo bien, qué mejorar, y siguiente paso.
 */
export function evaluarRespuesta(
  ejercicio: string,
  respuesta: string,
  nivel: "principiante" | "intermedio" | "avanzado"
): string {
  // Esta función devuelve un framework de evaluación para que el agente-tutor
  // aplique contra la respuesta del alumno.
  // No evalúa automáticamente (eso lo hace el LLM), pero da la estructura.

  return `# Evaluación de respuesta

## Ejercicio
${ejercicio}

## Respuesta del alumno
${respuesta}

## Framework de evaluación

Evaluá la respuesta usando estos criterios. Sé específico y constructivo.

### 1. Completitud (¿respondió todo?)
- ¿Cubrió todos los puntos pedidos en el ejercicio?
- ¿Falta alguna sección obligatoria?
- Listá qué falta (si falta algo)

### 2. Corrección (¿está bien?)
- ¿La información es correcta según la metodología STACKOS?
- ¿Hay contradicciones?
- Si hay errores, explicá el error Y la corrección

### 3. Profundidad (¿entiende de verdad?)
- Nivel ${nivel}: ajustá la exigencia al nivel
- ¿Muestra comprensión real o solo repite texto?
- ¿Consideró edge cases o solo el happy path?

### 4. Feedback constructivo
Usá este formato:

**Lo que estuvo bien:**
- [Punto positivo 1 — ser específico]
- [Punto positivo 2]

**Lo que se puede mejorar:**
- [Punto a mejorar 1 — explicar POR QUÉ y CÓMO]
- [Punto a mejorar 2]

**Nota:** [⭐ a ⭐⭐⭐⭐⭐] — basada en nivel ${nivel}

**Siguiente paso sugerido:**
- Si la nota es ⭐-⭐⭐: repetir el ejercicio con las correcciones
- Si la nota es ⭐⭐⭐: pasar al siguiente ejercicio del mismo tema
- Si la nota es ⭐⭐⭐⭐-⭐⭐⭐⭐⭐: subir de nivel o cambiar de tema

### 5. Pregunta de seguimiento
Hacé UNA pregunta que profundice en lo que el alumno respondió bien.
Ejemplo: "Mencionaste X, ¿cómo manejarías el caso donde...?"

---
**Recordá:** Errores son oportunidades de aprendizaje. Nunca "está mal", siempre "¿qué pasa si consideramos...?"`;
}
