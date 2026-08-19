## Purpose

Define el sistema de diseño visual de caleta: tokens de color y tipografía, layout de navegación (desktop/mobile), componentes de tarea, interacciones, estados vacíos e iconografía. Gobierna toda UI del frontend (`apps/web`) y debe producir la misma sensación en cualquier tamaño: "una caleta de cosas por hacer, sin que se sienta como una caleta".

## ADDED Requirements

### Requirement: Color and Typography Tokens

El sistema define una paleta fija y dos familias tipográficas. Todos los componentes derivan de estos tokens; no se usan colores fuera del sistema.

Paleta:
- `--color-ink: #0B0F10` (fondo near-black)
- `--color-surface: #121719`
- `--color-surface-2: #1A2023`
- `--color-moss: #203A2E` (verde-negro apagado)
- `--color-lime: #E7FF44` (acento primario)
- `--color-mist: #A1A1AA` (gris claro)
- `--color-ink-0: #F4F4F5` (blanco suave)

Tipografía:
- Sans geométrica (Space Grotesk) para títulos, nombres de tarea, botones y navegación.
- Mono (IBM Plex Mono) para fechas, horas, conteos, atajos, metadata y textos técnicos.

#### Scenario: Una UI usa solo tokens del sistema
- **WHEN** cualquier componente renderiza colores o fuentes
- **THEN** solo usa valores del token set, sin hex sueltos ni estilos inline ajenos al sistema

#### Scenario: Fechas y conteos en mono
- **WHEN** la UI muestra una fecha, un conteo de tareas o metadata técnica
- **THEN** se renderiza con la familia mono, en tamaño pequeño y color `mist`

### Requirement: Neo-noir Surface Language

Los fondos, bordes y sombras siguen reglas consistentes: superficies oscuras en capas, bordes finos de 1px, esquinas suaves (no excesivamente redondeadas), sombras solo donde aportan profundidad, y una textura de grano sutil opcional.

#### Scenario: Layout de superficies
- **WHEN** la UI estructura sus capas
- **THEN** el fondo global es `ink`, la superficie principal es `surface`, las superficies secundarias (sidebar, inputs, hovers) son `surface-2`, y los bordes usan variantes translúcidas de `surface-2`

#### Scenario: Sin cards grandes ni decoración ruidosa
- **WHEN** se renderiza la lista de tareas
- **THEN** las tareas son filas separadas por `border-b` fina, no cards con sombra; no hay gradientes llamativos, ni glassmorphism, ni bordes muy redondeados

### Requirement: Navigation Layout (Desktop)

Desktop muestra una sidebar izquierda estrecha: wordmark "caleta" arriba; navegación (Hoy / Próximos / Algún día / Hechos); divisor; sección Proyectos (cada uno con indicador circular de color pequeño); y al pie perfil (avatar, nombre, toggle de tema, ajustes). El contenido principal tiene título grande, fecha mono, contador de tareas en mono y botón lima "+ Nueva tarea".

#### Scenario: Sidebar understated
- **WHEN** se renderiza la sidebar en desktop (`lg+`)
- **THEN** es angosta, de fondo `surface`, casi desaparece contra el fondo; la navegación activa se marca con el color lime de forma sobria

#### Scenario: Proyectos con indicadores
- **WHEN** se lista un proyecto en la sidebar
- **THEN** muestra un punto circular pequeño de un color por proyecto, y el nombre en texto discreto

### Requirement: Navigation Layout (Mobile)

Mobile preserva la misma identidad: wordmark arriba, pestañas de navegación (Hoy / Próximos / Algún día / Hechos), lista de tareas debajo, botón flotante lima "+" abajo a la derecha, y bottom-nav con Tareas / Calendario / Actividad / Ajustes.

#### Scenario: Mismo lenguaje visual en mobile
- **WHEN** la app se ve en un viewport mobile
- **THEN** usa los mismos colores, tipografías y filas de tarea que desktop; no se ve como otro producto

#### Scenario: Bottom nav
- **WHEN** se renderiza la bottom-nav mobile
- **THEN** muestra Tareas / Calendario / Actividad / Ajustes, con el item activo en lime

### Requirement: Task Row Component

Cada tarea es una fila con: checkbox pequeño y preciso, nombre de tarea, indicador de proyecto/categoría opcional, hora opcional en mono, y estrella lime de prioridad opcional.

#### Scenario: Filas con líneas finas
- **WHEN** la lista tiene varias tareas
- **THEN** se muestran como filas separadas por `border-b` de 1px sobre el fondo `surface`

#### Scenario: Completada
- **WHEN** una tarea está completada
- **THEN** el checkbox se ve relleno de lime con check oscuro, y el título se vuelve `mist` con `line-through`

#### Scenario: Prioridad con estrella
- **WHEN** una tarea está marcada como importante
- **THEN** muestra una pequeña estrella lime junto al título

#### Scenario: Hover sutil
- **WHEN** el cursor pasa sobre una tarea
- **THEN** el fondo se aclara levemente y aparecen acciones secundarias de forma progresiva; ningún cambio es visualmente estridente

### Requirement: New Task Input

Crear una tarea es casi instantáneo: un input de una línea ("¿Qué tienes que hacer?") que acepta metadata natural (fecha, hora, proyecto, prioridad, recordatorio, notas) sin forms grandes. El botón principal es lima.

#### Scenario: Creación rápida
- **WHEN** el usuario enfoca el input "¿Qué tienes que hacer?"
- **THEN** ve un campo limpio de una línea con un botón de envío lima a la derecha, sin formulario de múltiples pasos

### Requirement: Empty State with Coastal Illustration

El estado vacío usa una ilustración minimalista de faro/caleta costera, monocroma, con pequeños acentos lima, y copy en español.

#### Scenario: Sin tareas
- **WHEN** una vista no tiene tareas
- **THEN** muestra la ilustración sutil, el título "Aún no hay tareas por aquí.", el microcopy "Tómate un respiro o crea tu primera tarea." y el botón lima "+ Crear tarea"

### Requirement: Branding and App Icon

El wordmark es "caleta" en minúsculas, tipografía geométrica, fuerte pero simple. El icono de app es una "C/Ç" estilizada sobre fondo oscuro con símbolo lima, geométrica, reconocible a tamaños chicos; no es un checkmark genérico.

#### Scenario: Wordmark
- **WHEN** se muestra la marca en cualquier superficie
- **THEN** es "caleta" minúscula en la sans geométrica, con la "c" inicial en lime como acento opcional

#### Scenario: Icono
- **WHEN** se genera el icono de app (favicon/manifest)
- **THEN** es una construcción geométrica tipo "C/Ç" en lima sobre fondo `ink`, legible a 16px

### Requirement: Login Consistency

La pantalla de login usa la misma identidad: fondo `ink`, wordmark "caleta", botón de Google sobrio y microcopy.

#### Scenario: Pantalla de login
- **WHEN** un usuario no autenticado entra
- **THEN** ve el wordmark, una breve propuesta de valor y el botón "Entrar con Google" en el estilo del sistema (sin violeta)
