# CLAUDE.md

Guía para Claude Code (y para cualquier persona) que actualice este repositorio. **Cada cambio que se haga en el repositorio debe registrarse al final, en "Registro de cambios".**

## Qué es

Sitio web personal de Edier Aristizábal (Profesor Asociado, Departamento de Geociencias y Medio Ambiente, Facultad de Minas, Universidad Nacional de Colombia, sede Medellín).

- URL publicada: https://edieraristizabal.github.io/
- Remoto: https://github.com/edieraristizabal/edieraristizabal.github.io (rama `master`, GitHub Pages sirve la raíz de la rama).
- Sitio estático en HTML, CSS y JavaScript sin dependencias ni paso de compilación (no usa Jekyll ni Bootstrap). Las únicas cargas externas son las fuentes de Google Fonts (Inter y Source Serif 4).
- Bilingüe: inglés por defecto y español con el botón EN/ES. El idioma se recuerda en `localStorage` y también se puede forzar con `?lang=es`.
- Tema claro y oscuro (sigue al sistema; el botón ◐ lo fija).

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html` | Portada: presentación, métricas (desde `data/publications.json`), perfil, formación, becas, líneas de investigación, artículos recientes, proyectos y cursos |
| `publications.html` | Lista completa de publicaciones con buscador, filtro por tipo, orden por año o por citas y gráfico de artículos por año |
| `projects.html` | Proyectos (desde `data/projects.json`) |
| `courses.html` | Cursos de pregrado y posgrado y otros recursos docentes (desde `data/courses.json`) |
| `aboutme.html` | Redirección a `index.html#about` (se conserva para no romper enlaces antiguos) |
| `assets/css/site.css` | Único CSS del sitio. Colores en variables de `:root` (verde bosque y naranja laterita), con modo oscuro |
| `assets/js/site.js` | Idioma, tema, menú móvil y render de los tres JSON |
| `data/publications.json` | Generado por `scripts/update_publications.py`. **No editar a mano** (se sobrescribe); las correcciones van en `publications_overrides.json` |
| `data/publications_overrides.json` | Correcciones manuales que sobreviven a cada actualización (clave: primeros 60 caracteres del título normalizado) |
| `data/courses.json` | Cursos (nombre, nivel, programa, descripción y enlaces en EN y ES) y recursos docentes |
| `data/projects.json` | Proyectos (acrónimo, estado `ongoing`/`completed`/`proposal`, años, financiador, rol, título, descripción y enlaces en EN y ES) |
| `scripts/update_publications.py` | Descarga Google Scholar y OpenAlex y genera `data/publications.json` |
| `fig/` | Imágenes. `hero_earthflow.jpg` es la foto de portada (versión recortada y comprimida de `Earthflow_Medellin.jpg`); `edier_2026.jpg` es la foto de perfil (recorte cuadrado de 480×480 px de la foto de 2026); `fotoedier3.jpg` es la foto anterior |

Texto bilingüe en HTML: cada fragmento va en un par `<span lang="en">…</span><span lang="es">…</span>` (o en bloques `<div lang="en">` y `<div lang="es">`); el CSS oculta el idioma que no está activo. El encabezado y el pie se repiten en las cuatro páginas: si se cambia el menú, hay que cambiarlo en todas.

## Tareas frecuentes

**Actualizar publicaciones** (desde la raíz del repo):

```
python scripts/update_publications.py
```

El script lee el perfil de Google Scholar `jelk50QAAAAJ` (ordenado por fecha, en páginas de 100), une las versiones en español e inglés del mismo artículo (misma revista, año, volumen y páginas, o títulos casi iguales), descarta entradas sin año o sin revista que no tienen pareja, clasifica en `article`, `conference`, `preprint` y `thesis`, y busca DOI y enlace de acceso abierto en OpenAlex (autores `A5075901372`, `A5063958790`, `A5122525314`, `A5154143647`). Si Scholar bloquea la descarga (página de captcha), esperar y repetir. Revisar el resumen que imprime y los duplicados nuevos antes de publicar; los pares ES/EN que no se unen solos se agregan a `MANUAL_SAME` en el script.

**Agregar un curso o un proyecto:** editar `data/courses.json` o `data/projects.json` (los textos van siempre en `en` y `es`). Solo se publican proyectos que Edier haya aprobado; las propuestas en evaluación llevan `"status": "proposal"`.

**Probar en local:** `python -m http.server 8000` en la raíz y abrir http://localhost:8000 (los JSON no cargan si se abre el HTML directamente como archivo).

**Publicar:** `git add` de los archivos cambiados, `git commit` y `git push origin master`. GitHub Pages se actualiza en uno o dos minutos.

## Datos del perfil (para mantener la coherencia)

- Cargo: Profesor Asociado (Associate Professor).
- Perfiles: Google Scholar `jelk50QAAAAJ`, ORCID 0000-0002-2648-2197, ResearchGate `Edier-Aristizabal`, GitHub `edieraristizabal`.
- Grupo: Geohazards (https://geohazards.com.co/).
- Beca Georg Forster (Fundación Alexander von Humboldt), Universidad de Potsdam, 2023–2025, con Oliver Korup.
- Proyectos publicados: SUNRISE (Horizon Europe 101295874), LAND-CASCADES (red INQUA, colíder con Stella Moreiras), SAT-CASCADE (propuesta SGR Convocatoria 56, 2026), Geohazard (base de datos), beca Humboldt.

## Pendientes y sugerencias

- Confirmar los años de la especialización en Ginebra y del pregrado, que no aparecen en la sección de formación.
- Cuando el curso Avenidas Torrenciales tenga página publicada (https://edieraristizabal.github.io/AvenidasTorrenciales/ hoy da 404), agregar el enlace `site` en `data/courses.json`.
- Actualizar el estado de SAT-CASCADE cuando se conozca el resultado de la convocatoria, y las fechas de SUNRISE cuando se firme el acuerdo de subvención.

## Registro de cambios

- **2026-10-24**: rediseño completo. Se reemplaza el sitio de 2021 (Bootstrap 3, dos páginas) por un sitio estático bilingüe con portada, publicaciones, proyectos y cursos; los datos quedan en `data/*.json` y las publicaciones se generan con `scripts/update_publications.py` (171 entradas de Scholar → 100 únicas: 73 artículos, 23 congresos, 2 preprints, 2 tesis; 2273 citas, h 24, i10 52). Se corrige el enlace a Google Scholar (antes apuntaba al perfil `LbieiBQAAAAJ`) y el cargo (de Assistant a Associate Professor). `aboutme.html` pasa a ser una redirección; se elimina `styles.css`; se agrega `fig/hero_earthflow.jpg`; `.gitignore` ignora `*.log` y `__pycache__/`.
- **2026-10-24**: nueva foto de perfil (`fig/edier_2026.jpg`, recortada a 480×480 px de la foto de 2026 que envió Edier); se quita el filtro gris del retrato en `site.css` y se agrega la foto a los datos estructurados de `index.html`.
