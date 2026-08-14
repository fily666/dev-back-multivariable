# API — Diagnóstico Organizacional LinkTIC

API de NestJS que sirve el instrumento de diagnóstico, valida y guarda las respuestas, y
calcula los indicadores del panel de administración.

- **Prefijo global:** `/api/v1` (`setGlobalPrefix` en [main.ts:16](src/main.ts#L16))
- **Local:** `http://localhost:3001/api/v1`
- **Base de datos:** PostgreSQL en Supabase, vía Prisma 7 con driver adapter
- **Especificación funcional:** [`../Contexto.md`](../Contexto.md) — si el código no cuadra
  con ese documento, el documento manda
- **Variables de entorno:** [`../docs/VARIABLES-DE-ENTORNO.md`](../docs/VARIABLES-DE-ENTORNO.md)

---

## Arranque

Requiere Node 20.19+ (probado en 26.3.1) y un proyecto de Supabase.

```bash
npm install
cp .env.example .env
# Complete DATABASE_URL, DIRECT_URL, JWT_SECRET y HASH_SALT
#   JWT_SECRET y HASH_SALT: openssl rand -base64 48   (distintos entre sí)

npx prisma generate          # cliente tipado en src/generated/prisma
npx prisma migrate deploy    # crea las 11 tablas
npx prisma db seed           # siembra el catálogo del instrumento

npm run start:dev            # http://localhost:3001/api/v1
```

`DATABASE_URL` va al pooler **6543** y `DIRECT_URL` al **5432**. Con `DIRECT_URL` apuntada al
6543, `prisma migrate deploy` se queda colgada sin mensaje de error — el detalle completo
está en [la referencia de variables](../docs/VARIABLES-DE-ENTORNO.md#2-base-de-datos-supabase).

El seed carga las 7 áreas evaluables más `OTRA` (no evaluable), los 9 procesos, los 10
componentes con su texto introductorio literal del PDF, las 46 preguntas con sus opciones, los
7 pesos del IMC y las 4 bandas de semaforización. **Es idempotente:** se puede volver a correr
sin duplicar nada.

---

## Scripts

| Script | Qué hace |
|---|---|
| `npm run start:dev` | Servidor con recarga en caliente |
| `npm run start` | Servidor sin watch |
| `npm run start:prod` | `node dist/main` — requiere `build` previo |
| `npm run build` | `nest build` → `dist/` |
| `npm run typecheck` | `tsc --noEmit` en **los tres** ámbitos: app, seed y `api/` |
| `npm run lint` | ESLint con `--fix` sobre `src/` y `prisma/` |
| `npm test` | Jest — 145 tests, sin base de datos |
| `npm run test:cov` | Cobertura en `coverage/` |
| `npm run prisma:generate` | Regenera el cliente |
| `npm run prisma:deploy` | `prisma migrate deploy` |
| `npm run prisma:seed` | `prisma db seed` |

`typecheck` cubre tres `tsconfig` porque el seed (`tsx`) y el handler de Vercel (`api/`)
compilan con ajustes distintos a los de la app. Un solo `tsc --noEmit` dejaría fuera los dos.

---

## Arquitectura

```
src/
├── main.ts              configureApp(): helmet, CORS, cookies, ValidationPipe, filtro
├── app.module.ts        ConfigModule global + ThrottlerModule (120 req/min) + módulos
├── database/            PrismaService — driver adapter pg, lee DATABASE_URL
├── auth/                login por token → JWT en cookie httpOnly; AdminGuard; auditoría
├── survey/              GET /survey/schema — el catálogo que dirige el wizard
├── responses/           borradores, guardado por paso, envío
│   └── rules/           8 reglas de validación del instrumento
├── analytics/           el panel
│   ├── indicators/      10 índices + IMC compuesto + NPS (funciones puras)
│   ├── kpis/            distribuciones y mapa de relacionamiento
│   ├── repositories/    acceso a datos, separado del cálculo
│   ├── cohort.util.ts   regla de anonimato
│   ├── thresholds.service.ts / weights.service.ts
├── campaigns/           alta y cierre de campañas
├── export/              CSV y XLSX
└── common/              constantes del instrumento, hash, sanitize, filtro de errores
```

### Tres decisiones que explican la forma del código

**Los indicadores son funciones puras.** Reciben filas crudas (`RawAnswerRow[]`) y devuelven
un número. No conocen Prisma, ni la regla de cohorte, ni los umbrales
([indicator.types.ts](src/analytics/indicators/indicator.types.ts)). Por eso se pueden
validar las fórmulas del instrumento sin levantar una base de datos, que es lo que hacen los
43 tests de `indicators.spec.ts`.

**La regla de cohorte mínima vive en el orquestador, no en los indicadores.**
[`applyCohort`](src/analytics/cohort.util.ts) envuelve toda respuesta analítica y vacía
`data` cuando el corte no llega a `MIN_COHORT_SIZE`. Centralizarla ahí garantiza que ningún
endpoint pueda olvidarse de aplicarla — si estuviera repartida por los servicios, bastaría un
endpoint nuevo mal escrito para filtrar un promedio de tres personas.

**La validación lee del catálogo, no de constantes.** Las 8 reglas de
[`rules/`](src/responses/rules/) resuelven tipo, límites y opciones desde la base de datos,
así que **añadir una pregunta al instrumento no obliga a tocar código de validación**.

---

## Endpoints

### Públicos — la encuesta

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/survey/schema` | Catálogo completo: campaña, áreas, 10 componentes con sus preguntas y opciones ya resueltas, y `settings` (`maxAreasInteraccion`, `requireIdentity`). Es lo que dirige el wizard. |
| `POST` | `/responses` | Abre un borrador y devuelve su `draftToken`. Limitado a 10/min por IP. |
| `GET` | `/responses/:draftToken` | Recupera un borrador para retomarlo. |
| `PATCH` | `/responses/:draftToken/step/:componentId` | Guarda un paso. Cuerpo: `{ answers: AnswerInputDto[], respondentName?, respondentRole? }`. Aplica las 8 reglas; devuelve **422** con detalle por pregunta si alguna falla. |
| `POST` | `/responses/:draftToken/submit` | Cierra la respuesta. Valida completitud antes de marcar `COMPLETED`. |

`AnswerInputDto`: `questionCode` (obligatorio) y, según el tipo de pregunta, `targetArea`,
`valueNumber` (entero 0–10), `valueOption`, `valueOptions` (≤32) o `valueText` (≤2000).

### Autenticación

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/auth/login` | Canjea `{ token }` por la cookie de sesión. **10/min** además del rate limit por IP respaldado en auditoría. `401` si el token no coincide, `429` al pasarse. |
| `POST` | `/auth/logout` | Limpia la cookie y audita la salida. |
| `GET` | `/auth/me` | Con sesión: `{ authenticated: true, role: 'admin' }`. El front lo usa antes de pintar el panel. |

Doble límite a propósito: el `Throttle` corta ráfagas rápidas, y el contador respaldado en
`admin_audit_log` corta intentos sostenidos de fuerza bruta — sobrevive a los arranques en
frío de serverless, que un contador en memoria no.

La comparación del token es de **tiempo constante** (`secretsMatch` en
[hash.util.ts](src/common/utils/hash.util.ts)), para no filtrar el prefijo correcto por
diferencia de latencia.

### Panel — todos exigen sesión de admin (`AdminGuard`)

| Método | Ruta | Qué devuelve |
|---|---|---|
| `GET` | `/admin/overview` | Titulares: IMC, participación, totales |
| `GET` | `/admin/indicators` | Los 10 índices + IMC, con su banda de semaforización |
| `GET` | `/admin/components` | Promedios por componente |
| `GET` | `/admin/relationship-map` | Matriz área-evaluadora × área-evaluada |
| `GET` | `/admin/nps` | NPS interno con promotores / pasivos / detractores |
| `GET` | `/admin/indices-by-area` | Índices desglosados por área |
| `GET` | `/admin/qualitative` | Respuestas abiertas, agrupables por tema |
| `GET` | `/admin/areas/:code` | Detalle de un área |
| `GET` | `/admin/responses` | Listado paginado (`page`, `pageSize` ≤ 200) |
| `GET` | `/admin/weights` | Pesos del IMC |
| `PUT` | `/admin/weights` | Actualiza los pesos — **auditado** |
| `PATCH` | `/admin/qualitative/answers/:id/theme` | Asigna tema a una respuesta abierta — **auditado** |
| `GET` | `/admin/export?format=csv\|xlsx` | Exportación completa — **auditada** |
| `GET` | `/admin/campaigns` | Lista de campañas |
| `POST` | `/admin/campaigns` | Crea una campaña — **auditado** |
| `PATCH` | `/admin/campaigns/:id/close` | Cierra la campaña y congela su corte — **auditado** |

**Filtros comunes** (`AnalyticsFiltersDto`), todos opcionales: `campaignId` (UUID),
`ownArea`, `frecuencia` (`DIARIA` … `ESPORADICA`), `tipoInteraccion` (`OPERATIVA`,
`TACTICA`, `ESTRATEGICA`, `COMERCIAL`, `SOPORTE`), `from` y `to` (ISO 8601).

**Toda respuesta analítica viene envuelta** en `AnalyticsEnvelope`:

```jsonc
{
  "data": null,          // null cuando el corte es insuficiente
  "meta": {
    "n": 3,
    "insufficient": true,
    "minCohortSize": 4,
    "generatedAt": "2026-08-14T12:00:00.000Z"
  }
}
```

Se audita lo que cambia datos o los saca del sistema: los pesos del IMC porque alteran el KPI
titular de la organización, y las exportaciones porque son datos de percepción de personas
identificables por área.

---

## Modelo de datos

11 tablas ([`prisma/schema.prisma`](prisma/schema.prisma)):

**Catálogo** — `areas`, `procesos`, `components`, `questions`, `question_options`
**Campañas** — `campaigns`
**Respuestas** — `survey_responses`, `answers`
**Configuración** — `indicator_weights`, `indicator_thresholds`
**Auditoría** — `admin_audit_log`

Tres detalles que no son obvios:

**`answers.target_area` usa el centinela `'__GLOBAL__'` en vez de `NULL`.** En PostgreSQL los
`NULL` no colisionan en índices únicos, así que una columna nullable dejaría pasar respuestas
duplicadas para la misma pregunta global. Con el centinela, el `@@unique([responseId,
questionCode, targetArea])` sí las bloquea.

**`option_source` (`STATIC` | `AREAS` | `PROCESOS`)** permite que las preguntas que el PDF
marca como "(Lista)" lean del catálogo vivo en vez de duplicarlo en `question_options`: dar
de alta un área no obliga a editar cinco preguntas.

**Las IPs y los user agents se guardan hasheados** (`ip_hash`, `user_agent_hash`), nunca en
claro. La sal es `HASH_SALT`.

### Prisma 7 — tres cambios que afectan a este proyecto

1. **La URL sale del schema.** El bloque `datasource` solo lleva `provider`; la URL vive en
   [`prisma.config.ts`](prisma.config.ts), y las variables de entorno ya no se cargan solas
   (requiere `import 'dotenv/config'`).
2. **El cliente se genera como archivos `.ts` con imports con extensión.** Compilarlo con
   `module: commonjs` exige `allowImportingTsExtensions` y `rewriteRelativeImportExtensions`.
3. **`moduleFormat = "cjs"` en el generator es obligatorio aquí.** Sin él el cliente emite
   `import.meta` y Jest no puede parsearlo corriendo en CommonJS.

### TypeScript 6, no 7

`typescript@7.0.2` **no expone el compilador**:

```js
require('typescript')  // → { version: '7.0.2', versionMajorMinor: '7.0' }
                       // sin createProgram, sin transpileModule
```

TS 7 es el compilador nativo en Go y su 7.0 se publicó sin API programática. Sin
`createProgram` no funcionan `nest build`, `ts-jest`, `ts-node` ni las reglas type-aware de
ESLint. `typescript@6.0.3` sí la expone y emite la metadata `design:paramtypes` que necesita
la inyección de dependencias de NestJS. Revisar cuando salga TS 7.1 con su nueva API.

TS 6 obliga dos ajustes que el scaffold de NestJS no traía: `rootDir` explícito (error
`TS5011`) y `baseUrl` fuera (deprecado, error `TS5101`).

---

## Tests

145 tests en 8 suites, **sin base de datos** — corren en ~2 s:

| Suite | Tests | Qué cubre |
|---|---|---|
| `analytics/indicators/indicators.spec.ts` | 43 | Las fórmulas de los indicadores, **con cada valor esperado calculado a mano** en un comentario junto al test |
| `responses/rules/rules.spec.ts` | 36 | Las 8 reglas de validación del instrumento |
| `analytics/kpis/kpis.spec.ts` | 20 | Distribuciones y mapa de relacionamiento |
| `export/csv-cell.util.spec.ts` | 12 | Neutralización de fórmulas en las exportaciones |
| `prisma/catalog.spec.ts` | 12 | La transcripción del PDF: los conteos por componente salen del documento, no del código |
| `auth/auth.service.spec.ts` | 10 | Login por token, incluida la comparación de tiempo constante |
| `analytics/cohort.util.spec.ts` | 7 | La regla de cohorte mínima |
| `survey/survey.service.spec.ts` | 5 | Resolución del catálogo |

El cálculo a mano en los tests de indicadores es lo que sustituye a la validación contra
datos reales: si una fórmula se rompe, el test dice cuál era el número correcto y de dónde
salía.

`csv-cell.util.spec.ts` cubre un riesgo real: una respuesta abierta que empiece por `=`, `+`,
`-` o `@` se ejecuta como fórmula al abrir el CSV en Excel. El util la neutraliza.

---

## Despliegue en Vercel

NestJS **no corre como servidor persistente** en Vercel. [`api/index.ts`](api/index.ts) lo
expone como función serverless: construye la app una sola vez por instancia y la guarda en
`ready`, porque bootstrapear Nest en cada invocación sumaría el arranque completo (módulos +
pool de Prisma) a la latencia de cada llamada. Usa `app.init()` y no `listen()` — el servidor
HTTP lo provee Vercel.

Reutiliza el `configureApp` de [`src/main.ts`](src/main.ts) a propósito: mantener dos
configuraciones de helmet, CORS, cookies y validación es garantizar que divergan.

Configuración del proyecto en Vercel:

| Ajuste | Valor |
|---|---|
| Root Directory | `dev-back` |
| Framework Preset | Other |
| Build | `@vercel/node` sobre `api/index.ts` ([vercel.json](vercel.json)) |

`dist/` no se versiona: Vercel compila `api/index.ts` en el despliegue.

Las variables de producción y el asunto de las cookies entre dominios están en
[`../docs/VARIABLES-DE-ENTORNO.md`](../docs/VARIABLES-DE-ENTORNO.md#producción-vercel).

---

## Verificación

```bash
npm run typecheck && npm run lint && npm test && npm run build
npx prisma validate
```

Estado al 14-ago-2026: los cinco pasan — 145/145 tests, schema válido.
