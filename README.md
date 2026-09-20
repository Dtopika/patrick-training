# Patrick Training 🐺🇩🇪

PWA móvil, local-first, para entrenar a Patrick con comandos en alemán, sesiones guiadas y progresión adaptativa.

## Estado
- Release estable publicada: v7.3.2.
- Línea actual: First-run Experience con wizard de tema, perfil, tutorial y arranque guiado de Nivel 0.
- Sin backend ni cuentas: los datos permanecen en el dispositivo salvo exportación manual.

## Funciones
- 41 comandos organizados en niveles 0 → 10.
- Sesiones guiadas de cinco ejecuciones por comando.
- Motor adaptativo v2 por nivel, rendimiento, antigüedad, contexto y etapa/edad del perro.
- Plan diario inteligente con objetivo, contexto recomendado y acceso directo a práctica.
- Dashboard de evolución de 7/30 días con tendencias y señales de mejora/atención.
- Ficha inteligente por comando con evidencia, tendencia, motivos y siguiente paso.
- Progreso centrado en evolución, prioridades e historial, sin duplicar el catálogo de comandos.
- Configuración unificada con tema, almacenamiento y respaldos, más sección Acerca de.
- Progresión automática: consistencia → generalización → dominio basada en evidencia.
- Contexto de sesión por entorno y nivel de distracción.
- Ruta de niveles bloqueada: no se puede activar un nivel futuro sin completar los anteriores.
- Niveles compactos y flujo guiado para iniciar sesiones desde Niveles o Comandos.
- Navegación principal con estados activos más claros.
- Nivel de sesión separado del nivel activo: repasar no altera la ruta ni el autoavance.
- Deshacer inmediato del último resultado antes del autoavance.
- Corrección o eliminación segura de sesiones con recálculo de evidencia.
- Backups schema 8 con outcomes individuales y tema.
- Exportación de diagnóstico técnico sin historial detallado.
- Quality Gate con Playwright móvil además de tests unitarios.
- Script único de preparación de releases para versión, cache y asset tags.
- Adaptive Engine v3: combina precisión, ayuda, contexto, antigüedad, confianza y tiempo preciso.
- Perfiles de habilidad: posición, duración, llamada, paseo, búsqueda, objetos, control, movimiento y hogar.
- Dificultad objetivo distinta por familia de comando.
- Repeticiones adaptativas de 3 a 5 según rendimiento, estado y etapa del perro.
- Cronometraje cue-to-rating: el tiempo empieza cuando el guía inicia realmente la ejecución; tiempos antiguos no se usan como latencia.
- Ficha inteligente y plan diario muestran confianza, objetivo específico y timing cuando ya hay evidencia v7.
- Misión de hoy como único CTA principal; el detalle adaptativo y micro-sesiones quedan plegables.
- Guía “Cómo funciona” con estados, confianza, repeticiones adaptativas y medición precisa.
- Archivo histórico mensual: las sesiones antiguas dejan de descartarse al superar 200.
- Backups schema 10 incluyen archivo histórico y estado del onboarding.
- Tutorial visual 1→2→3→4: señal, respuesta, Ja! y premio.
- Voz alemana seleccionable entre las voces instaladas en el dispositivo, con fallback automático.
- Evolución mensual combina sesiones recientes y archivo sin duplicar datos.
- Cobertura multimedia contractual: 41 comandos y 41 videos curados.
- Backups schema 11 preservan la preferencia de voz alemana.
- Primer arranque unificado en un wizard de 4 pasos.
- Tema se elige antes de entrar a la app y se previsualiza al instante.
- Nombre y edad se configuran antes del Nivel 0; el nombre personaliza el comando de atención y su audio.
- El wizard explica misión, medición y progreso antes de comenzar.
- Usuarios existentes con perfil completo migran silenciosamente y no reciben el wizard retroactivamente.
- Backups schema 12 preservan el estado de configuración inicial.
- Reinicio completo desde Configuración con doble confirmación obligatoria y regreso inmediato al wizard.
- Footer del wizard corregido: CTA compacto, Atrás secundario, validación en línea y layout estable con teclado.
- Historial, racha y evidencia reciente por comando.
- Perfil del perro con edad y recomendaciones de seguridad.
- Videos curados y pronunciación mediante la voz alemana del dispositivo.
- IndexedDB con espejo local reconciliado por timestamp.
- Exportación/restauración de backup validado.
- Recordatorios cuando el navegador/sistema lo permite.
- PWA offline con cache versionado.

## Seguridad
La app no enseña mordida ni ataque a personas. Los comandos defensivos se limitan a observación, reorientación y posiciones seguras. El trabajo de protección deportiva/IGP requiere club, entrenador y figurante cualificados.

## Desarrollo

```bash
npm test
```

El Quality Gate valida persistencia, backups, sesiones, motor adaptativo, PWA y regresiones de seguridad antes de promover cambios a `master`.

## GitHub Pages
Producción: https://dtopika.github.io/patrick-training/
