# Patrick Training 🐺🇩🇪

Mini app estática para entrenar a Patrick con comandos en alemán, progresión por niveles y seguimiento local.

## Funciones
- Plan del día según `Todo el día` o `Solo noche`.
- Niveles 0 → 10.
- Diccionario de comandos en alemán.
- Síntesis de voz alemana con Web Speech API.
- Progreso local-first en IndexedDB con respaldo local reconciliado.
- Sección de control defensivo seguro.
- Responsive y sin backend.

## GitHub Pages
Publica desde:
`Settings → Pages → Deploy from a branch → master / (root)`

URL esperada:
`https://dtopika.github.io/patrick-training/`

## Seguridad
La app no incluye instrucciones de mordida o ataque a personas. El trabajo de protección deportiva/IGP debe hacerse con un club, entrenador y figurante cualificados.

## Desarrollo

Quality Gate local:

```bash
npm test
```

La persistencia principal usa IndexedDB con espejo local reconciliado por timestamp. Los cambios de progreso de una sesión se confirman al finalizarla.
