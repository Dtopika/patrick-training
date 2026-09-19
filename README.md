# Patrick Training 🐺🇩🇪

PWA móvil, local-first, para entrenar a Patrick con comandos en alemán, sesiones guiadas y progresión adaptativa.

## Estado
- Release estable publicada: v5.6.2.
- Rama de desarrollo actual: Patrick v6.0.
- Sin backend ni cuentas: los datos permanecen en el dispositivo salvo exportación manual.

## Funciones
- 41 comandos organizados en niveles 0 → 10.
- Sesiones guiadas de cinco ejecuciones por comando.
- Motor adaptativo v2 por nivel, rendimiento, antigüedad, contexto y etapa/edad del perro.\n- Progresión automática: consistencia → generalización → dominio basada en evidencia.\n- Contexto de sesión por entorno y nivel de distracción.
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
