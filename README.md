# Patrick Training 🐺🇩🇪

PWA móvil, local-first, para entrenar a Patrick con comandos en alemán, sesiones guiadas y progresión adaptativa.

## Estado
- Release estable publicada: v6.2.1.
- Línea actual: entrenador adaptativo con progresión contextual, evolución y plan diario.
- Sin backend ni cuentas: los datos permanecen en el dispositivo salvo exportación manual.

## Funciones
- 41 comandos organizados en niveles 0 → 10.
- Sesiones guiadas de cinco ejecuciones por comando.
- Motor adaptativo v2 por nivel, rendimiento, antigüedad, contexto y etapa/edad del perro.
- Plan diario inteligente con objetivo, contexto recomendado y acceso directo a práctica.
- Dashboard de evolución de 7/30 días con tendencias y señales de mejora/atención.
- Ficha inteligente por comando con evidencia, tendencia, motivos y siguiente paso.
- Progresión automática: consistencia → generalización → dominio basada en evidencia.
- Contexto de sesión por entorno y nivel de distracción.
- Ruta de niveles bloqueada: no se puede activar un nivel futuro sin completar los anteriores.
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
