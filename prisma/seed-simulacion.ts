/**
 * Siembra las respuestas SIMULADAS de `simulacion.ts` en la campaña abierta.
 *
 *   npm run prisma:simulacion              # solo si la base no tiene respuestas
 *   npm run prisma:simulacion -- --reset   # borra TODAS las respuestas y siembra
 *
 * Con `--reset`, antes de borrar deja un respaldo JSON de lo que había en la carpeta que
 * contiene a dev-back (fuera del repositorio: son respuestas de la encuesta). Borrado y
 * siembra van en una sola transacción: o queda el corte simulado completo, o no cambia nada.
 *
 * Corre después de `npm run prisma:seed`: las respuestas apuntan por FK a las áreas del
 * catálogo vigente.
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { GLOBAL_AREA_CODE } from '../src/common/constants.ts';
import { generateDraftToken } from '../src/common/utils/hash.util.ts';
import { AREAS } from './catalog.ts';
import {
  generarRespuestasSimuladas,
  indiceDelCatalogo,
  validarRespuesta,
} from './simulacion.ts';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const reset = process.argv.includes('--reset');

async function main() {
  const respuestas = generarRespuestasSimuladas();

  // Primero se valida todo, antes de tocar la base: una sola respuesta que la API habría
  // rechazado aborta la siembra entera.
  const indice = indiceDelCatalogo();
  const invalidas = respuestas
    .map((respuesta, i) => ({
      i,
      infracciones: validarRespuesta(respuesta, indice),
    }))
    .filter(({ infracciones }) => infracciones.length > 0);
  if (invalidas.length > 0) {
    console.error(JSON.stringify(invalidas, null, 2));
    throw new Error(
      `${invalidas.length} respuestas simuladas no cumplen las reglas del instrumento.`,
    );
  }

  // El catálogo de la base tiene que ser el de catalog.ts: si no se corrió el seed, las
  // áreas nuevas no existen y las respuestas fallarían por FK a mitad de camino.
  const vigentes = await prisma.area.count({
    where: {
      code: { in: AREAS.map((area) => area.code) },
      active: true,
      isEvaluable: true,
    },
  });
  if (vigentes !== AREAS.length) {
    throw new Error(
      `La base tiene ${vigentes} de las ${AREAS.length} áreas del catálogo. Corra antes npm run prisma:seed.`,
    );
  }

  const campaign = await prisma.campaign.findFirst({
    where: { isOpen: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!campaign) {
    throw new Error(
      'No hay una campaña abierta. Corra antes npm run prisma:seed.',
    );
  }

  const existentes = await prisma.surveyResponse.count();
  if (existentes > 0 && !reset) {
    throw new Error(
      `La base ya tiene ${existentes} respuestas. Para reemplazarlas por las simuladas, ` +
        'corra con --reset (borra TODAS las respuestas, también las reales).',
    );
  }

  if (existentes > 0) {
    const respaldo = await prisma.surveyResponse.findMany({
      include: { answers: true },
      orderBy: { createdAt: 'asc' },
    });
    const ruta = resolve(
      __dirname,
      '../..',
      `respaldo-respuestas-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    );
    writeFileSync(
      ruta,
      JSON.stringify(
        respaldo,
        (_, value: unknown) =>
          typeof value === 'bigint' ? value.toString() : value,
        2,
      ),
    );
    console.log(`  ✔ respaldo de ${existentes} respuestas en ${ruta}`);
  }

  const resultado = await prisma.$transaction(
    async (tx) => {
      const borradas = await tx.answer.deleteMany({});
      const encuestas = await tx.surveyResponse.deleteMany({});

      for (const respuesta of respuestas) {
        await tx.surveyResponse.create({
          data: {
            campaignId: campaign.id,
            status: respuesta.status,
            draftToken: generateDraftToken(),
            ownArea: respuesta.ownArea,
            respondentRole: respuesta.respondentRole,
            startedAt: respuesta.startedAt,
            submittedAt: respuesta.submittedAt,
            durationSeconds: respuesta.durationSeconds,
            lastStep: respuesta.lastStep,
            createdAt: respuesta.startedAt,
            updatedAt: respuesta.updatedAt,
            answers: {
              createMany: {
                data: respuesta.answers.map((answer) => ({
                  questionCode: answer.questionCode,
                  targetArea: answer.targetArea ?? GLOBAL_AREA_CODE,
                  valueNumber: answer.valueNumber ?? null,
                  valueOption: answer.valueOption ?? null,
                  valueOptions: answer.valueOptions ?? [],
                  valueText: answer.valueText ?? null,
                  createdAt: respuesta.updatedAt,
                })),
              },
            },
          },
        });
      }

      return { borradas: borradas.count, encuestas: encuestas.count };
    },
    { timeout: 120_000, maxWait: 20_000 },
  );

  if (resultado.encuestas > 0) {
    console.log(
      `  ✔ ${resultado.encuestas} respuestas borradas (${resultado.borradas} respuestas a preguntas)`,
    );
  }
  const totalAnswers = respuestas.reduce((n, r) => n + r.answers.length, 0);
  const borradores = respuestas.filter((r) => r.status === 'DRAFT').length;
  console.log(
    `  ✔ ${respuestas.length} respuestas simuladas en «${campaign.name}»: ` +
      `${respuestas.length - borradores} completas y ${borradores} incompletas ` +
      `(${totalAnswers} respuestas a preguntas)`,
  );
}

main()
  .catch((error) => {
    console.error('La siembra simulada falló:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
