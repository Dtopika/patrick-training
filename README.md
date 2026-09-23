# Patrick Training 🐺🇩🇪

PWA móvil, local-first, para acompañar el entrenamiento diario de Patrick con sesiones guiadas, comandos multilingües y progresión adaptativa.

## Estado

- Release estable publicada: v7.10.1.
- Arquitectura local-first: sin backend ni cuentas.
- Los datos permanecen en el dispositivo salvo exportación manual de respaldo o diagnóstico.
- 56 comandos distribuidos en niveles 0 → 11.
- Nivel 11 orientado a control y protección segura; no enseña mordida ni ataque operativo.

## Experiencia de entrenamiento

- Misión de hoy y plan semanal adaptativo.
- Sesiones guiadas con 3–5 ejecuciones por comando.
- Cronómetro de sesión y medición cue-to-rating por ejecución.
- Coach práctico en vivo: objetivo, error frecuente, cómo bajar dificultad, premio y criterio para avanzar.
- Contexto de entrenamiento por entorno y nivel de distracción.
- Progresión automática: En práctica → Consistente → Generalizando → Dominado.
- Ruta de niveles bloqueada hasta completar los requisitos previos.
- Planes y dificultad ajustados por edad/etapa de desarrollo cuando aplica.

## Inteligencia y progreso

- Adaptive Engine v3 basado en rendimiento, ayuda, contexto, antigüedad, confianza y timing.
- Ficha inteligente por comando con evidencia, tendencia, confianza y siguiente paso.
- Dashboard de 7/30 días con días entrenados, sesiones, minutos medidos, ejecuciones, precisión y contextos.
- Historial editable con recálculo seguro de evidencia.
- Archivo histórico mensual para conservar evolución sin cargar indefinidamente el historial reciente.
- Recordatorios inteligentes cuando el navegador/sistema lo permite.

## Idiomas y contenido

- Interfaz independiente en Español / English / Deutsch.
- Idioma de comandos independiente en Español / English / Deutsch.
- Pronunciación mediante voces instaladas en el dispositivo.
- 56 videos curados con revisión automática semanal de disponibilidad.
- Cambio de nombre del perro integrado en la experiencia y los comandos correspondientes.

## PWA, datos y recuperación

- PWA instalable y funcional offline con cache versionado.
- Comprobación de versión publicada desde Configuración.
- IndexedDB como almacenamiento principal con espejo local de recuperación.
- Backup schema 13 con perfil, progreso, sesiones, historial, preferencias, idiomas y onboarding.
- Exportación/restauración validada.
- Exportación de diagnóstico técnico sin historial detallado.
- Reinicio completo con doble confirmación propia de la app.
- Recuperación de arranque si falla una dependencia crítica.

## Seguridad

Patrick Training no enseña mordida ni ataque a personas. Los ejercicios defensivos se limitan a observación, retorno al guía, desenganche, silencio, salida y creación de distancia. El trabajo de protección deportiva/IGP debe hacerse con club, entrenador y figurante cualificados.

## Desarrollo

    npm ci
    npm test
    npm run test:e2e
    node scripts/check-video-links.mjs

El **Patrick Quality Gate** ejecuta tests unitarios y Playwright en viewports Android antes de promover cambios a `master`.

La salud de los 56 videos se revisa en un workflow semanal separado para que fallos temporales de proveedores externos no vuelvan inestable el Quality Gate principal.

## Release

    npm run release:prepare -- <semver> <asset-tag>

Ejemplo de formato de asset tag: `v790-r1`.

## Producción

https://dtopika.github.io/patrick-training/
