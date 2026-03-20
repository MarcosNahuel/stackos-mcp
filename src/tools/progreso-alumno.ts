import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// --- Tipos ---

interface TopicProgress {
  nivel: "principiante" | "intermedio" | "avanzado";
  conceptos_vistos: string[];
  ejercicios_completados: number;
  ejercicios_aprobados: number;
  notas_tutor: string[];
  ultima_sesion: string;
}

interface StudentProgress {
  alumno: string;
  creado: string;
  sesiones_totales: number;
  nivel_general: "principiante" | "intermedio" | "avanzado";
  temas: Record<string, TopicProgress>;
  historial: Array<{
    fecha: string;
    accion: string;
    detalle: string;
  }>;
}

// --- Paths ---

function getProgressDir(root: string): string {
  const dir = join(root, "learners");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function getProgressPath(root: string, alumno: string): string {
  const safe = alumno.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return join(getProgressDir(root), `${safe}.json`);
}

function loadProgress(root: string, alumno: string): StudentProgress {
  const filePath = getProgressPath(root, alumno);
  if (existsSync(filePath)) {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  }
  // Nuevo alumno
  return {
    alumno,
    creado: new Date().toISOString().slice(0, 10),
    sesiones_totales: 0,
    nivel_general: "principiante",
    temas: {},
    historial: [],
  };
}

function saveProgress(root: string, progress: StudentProgress): void {
  const filePath = getProgressPath(root, progress.alumno);
  writeFileSync(filePath, JSON.stringify(progress, null, 2), "utf-8");
}

// --- Lógica de nivel ---

const TEMAS_ORDEN = ["spec", "skill", "engram", "quality-gate", "lifecycle"];

const CRITERIOS_SUBIR = {
  principiante: { ejercicios_aprobados: 1, conceptos_vistos: 2 },
  intermedio: { ejercicios_aprobados: 2, conceptos_vistos: 3 },
  avanzado: { ejercicios_aprobados: 3, conceptos_vistos: 5 }, // max level
};

function calcularNivelGeneral(temas: Record<string, TopicProgress>): "principiante" | "intermedio" | "avanzado" {
  const niveles = Object.values(temas).map(t => t.nivel);
  if (niveles.length === 0) return "principiante";

  const counts = { principiante: 0, intermedio: 0, avanzado: 0 };
  for (const n of niveles) counts[n]++;

  // Si la mayoría está en avanzado → avanzado
  if (counts.avanzado >= 3) return "avanzado";
  // Si la mayoría pasó de principiante → intermedio
  if (counts.intermedio + counts.avanzado >= 3) return "intermedio";
  return "principiante";
}

function deberiaSubirNivel(topic: TopicProgress): boolean {
  const criterio = CRITERIOS_SUBIR[topic.nivel];
  if (topic.nivel === "avanzado") return false;
  return (
    topic.ejercicios_aprobados >= criterio.ejercicios_aprobados &&
    topic.conceptos_vistos.length >= criterio.conceptos_vistos
  );
}

// --- Tools exportados ---

/**
 * Registra progreso del alumno: concepto visto, ejercicio completado, nota del tutor.
 */
export function registrarProgreso(
  root: string,
  alumno: string,
  tema: string,
  tipo: "concepto_visto" | "ejercicio_aprobado" | "ejercicio_reprobado" | "nota_tutor" | "inicio_sesion",
  detalle: string
): string {
  const progress = loadProgress(root, alumno);
  const hoy = new Date().toISOString().slice(0, 10);

  // Inicializar tema si no existe
  if (!progress.temas[tema]) {
    progress.temas[tema] = {
      nivel: "principiante",
      conceptos_vistos: [],
      ejercicios_completados: 0,
      ejercicios_aprobados: 0,
      notas_tutor: [],
      ultima_sesion: hoy,
    };
  }

  const topicProgress = progress.temas[tema];
  topicProgress.ultima_sesion = hoy;

  switch (tipo) {
    case "inicio_sesion":
      progress.sesiones_totales++;
      break;

    case "concepto_visto":
      if (!topicProgress.conceptos_vistos.includes(detalle)) {
        topicProgress.conceptos_vistos.push(detalle);
      }
      break;

    case "ejercicio_aprobado":
      topicProgress.ejercicios_completados++;
      topicProgress.ejercicios_aprobados++;
      break;

    case "ejercicio_reprobado":
      topicProgress.ejercicios_completados++;
      break;

    case "nota_tutor":
      topicProgress.notas_tutor.push(`[${hoy}] ${detalle}`);
      break;
  }

  // Registrar en historial
  progress.historial.push({ fecha: hoy, accion: `${tema}/${tipo}`, detalle });

  // Verificar si sube de nivel en el tema
  let subioNivel = false;
  if (deberiaSubirNivel(topicProgress)) {
    const nivelAnterior = topicProgress.nivel;
    topicProgress.nivel = topicProgress.nivel === "principiante" ? "intermedio" : "avanzado";
    subioNivel = true;
    progress.historial.push({
      fecha: hoy,
      accion: `${tema}/nivel_up`,
      detalle: `${nivelAnterior} → ${topicProgress.nivel}`,
    });
  }

  // Recalcular nivel general
  progress.nivel_general = calcularNivelGeneral(progress.temas);

  saveProgress(root, progress);

  // Construir respuesta
  let response = `Progreso registrado para ${alumno}:\n`;
  response += `- Tema: ${tema} (nivel: ${topicProgress.nivel})\n`;
  response += `- Acción: ${tipo}\n`;

  if (subioNivel) {
    response += `\n🎉 ¡SUBIÓ DE NIVEL en ${tema}! Ahora está en: ${topicProgress.nivel}\n`;
    response += `El siguiente ejercicio y explicación deben ser de nivel ${topicProgress.nivel}.\n`;
  }

  return response;
}

/**
 * Muestra el progreso actual del alumno y recomienda el siguiente paso.
 */
export function verProgreso(root: string, alumno: string): string {
  const progress = loadProgress(root, alumno);

  if (progress.sesiones_totales === 0) {
    return `# Alumno: ${alumno}

Todavía no hay progreso registrado.

## Para empezar
1. Usá \`modo_tutor\` para activar el modo pedagógico
2. Usá \`registrar_progreso\` con tipo "inicio_sesion" para registrar la primera sesión
3. Empezá con \`explicar_concepto "spec" nivel "principiante"\`

## Orden recomendado de temas
1. **spec** — Qué son las especificaciones (fundamental)
2. **lifecycle** — Cómo funciona un proyecto de punta a punta
3. **skill** — Qué son los skills y cómo funcionan
4. **quality-gate** — Cómo se verifica la calidad
5. **engram** — Cómo funciona la memoria del sistema`;
  }

  let output = `# Progreso de ${alumno}\n\n`;
  output += `📊 **Nivel general:** ${progress.nivel_general}\n`;
  output += `📅 **Sesiones:** ${progress.sesiones_totales}\n`;
  output += `📆 **Registrado desde:** ${progress.creado}\n\n`;

  // Tabla de progreso por tema
  output += `## Progreso por tema\n\n`;
  output += `| Tema | Nivel | Conceptos | Ejercicios | Aprobados | Última sesión |\n`;
  output += `|------|-------|-----------|------------|-----------|---------------|\n`;

  for (const tema of TEMAS_ORDEN) {
    const t = progress.temas[tema];
    if (t) {
      const pct = t.ejercicios_completados > 0
        ? Math.round((t.ejercicios_aprobados / t.ejercicios_completados) * 100)
        : 0;
      output += `| ${tema} | ${t.nivel} | ${t.conceptos_vistos.length} | ${t.ejercicios_completados} | ${t.ejercicios_aprobados} (${pct}%) | ${t.ultima_sesion} |\n`;
    } else {
      output += `| ${tema} | — | 0 | 0 | 0 | — |\n`;
    }
  }

  // Notas del tutor
  const todasLasNotas = Object.entries(progress.temas)
    .flatMap(([tema, t]) => t.notas_tutor.map(n => `- **${tema}:** ${n}`));

  if (todasLasNotas.length > 0) {
    output += `\n## Notas del tutor\n`;
    output += todasLasNotas.slice(-5).join("\n") + "\n";
    if (todasLasNotas.length > 5) {
      output += `\n_(${todasLasNotas.length - 5} notas anteriores omitidas)_\n`;
    }
  }

  // Recomendación de siguiente paso
  output += `\n## Siguiente paso recomendado\n\n`;

  // Encontrar el tema menos avanzado o no empezado
  const temasPendientes = TEMAS_ORDEN.filter(t => !progress.temas[t]);
  const temasEnCurso = TEMAS_ORDEN
    .filter(t => progress.temas[t] && progress.temas[t].nivel !== "avanzado")
    .sort((a, b) => {
      const na = progress.temas[a];
      const nb = progress.temas[b];
      const scoreA = na.conceptos_vistos.length + na.ejercicios_aprobados;
      const scoreB = nb.conceptos_vistos.length + nb.ejercicios_aprobados;
      return scoreA - scoreB; // menor score primero
    });

  if (temasPendientes.length > 0) {
    const sig = temasPendientes[0];
    output += `Todavía no empezaste **${sig}**.\n`;
    output += `→ Usá \`explicar_concepto "${sig}" nivel "principiante"\`\n`;
  } else if (temasEnCurso.length > 0) {
    const sig = temasEnCurso[0];
    const t = progress.temas[sig];
    output += `Seguí con **${sig}** (nivel ${t.nivel}).\n`;
    if (t.ejercicios_aprobados < CRITERIOS_SUBIR[t.nivel].ejercicios_aprobados) {
      output += `→ Te falta aprobar ejercicios. Usá \`ejercicio_practico "${sig}" nivel "${t.nivel}"\`\n`;
    } else {
      output += `→ Usá \`explicar_concepto "${sig}" nivel "${t.nivel}"\` para ver más conceptos\n`;
    }
  } else {
    output += `🏆 **¡Completaste todos los temas en nivel avanzado!**\n`;
    output += `→ Siguiente desafío: diseñá tu propio skill con \`leer_skill "skill-creator"\`\n`;
  }

  // Criterios para subir de nivel
  output += `\n## Cómo se sube de nivel\n`;
  output += `| De → A | Conceptos necesarios | Ejercicios aprobados |\n`;
  output += `|--------|---------------------|---------------------|\n`;
  output += `| Principiante → Intermedio | 2 | 1 |\n`;
  output += `| Intermedio → Avanzado | 3 | 2 |\n`;

  return output;
}
