# Patrick Training 🐺🇩🇪

PWA móvil, local-first, para entrenar a Patrick con comandos en alemán, sesiones guiadas y progresión adaptativa.

## Estado
- Release estable publicada: v7.0.0.
- Línea actual: Adaptive Engine v3 con dificultad por habilidad, tiempo preciso, confianza y repeticiones adaptativas.
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
