# Portadas de categoría

Una imagen por categoría del portafolio. Se usan en dos sitios:

1. **Fondo de las fichas** que no tienen imagen propia.
2. **Banner** encima de la cuadrícula al filtrar por esa categoría.

## Nombres de archivo

El nombre debe ser exactamente el de la categoría en `data/projects.json`:

| Archivo            | Categoría                |
| ------------------ | ------------------------ |
| `engineering.jpg`  | Ingeniería               |
| `experience.jpg`   | Experience Design        |
| `graphic.jpg`      | Diseño Gráfico           |
| `design.jpg`       | Product Design           |
| `research.jpg`     | Investigación            |
| `software.jpg`     | Software                 |

Formato `.jpg`, horizontal (las originales son 1920×1080). El banner recorta
a 16:5 y las fichas a un rectángulo bajo, así que **lo importante debe ir
centrado**: los bordes superior e inferior se pierden en el recorte.

## Si falta alguna

No pasa nada. `js/projects.js` comprueba que la imagen cargue antes de
usarla; si no está, la ficha mantiene su degradado de color y el banner
simplemente no aparece. Se pueden ir subiendo de una en una.
