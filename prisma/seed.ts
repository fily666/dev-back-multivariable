import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import {
  AREAS,
  COMPONENTS,
  INDICATOR_THRESHOLDS,
  INDICATOR_WEIGHTS,
  PROCESOS,
  QUESTIONS,
  SENTINEL_AREA,
} from './catalog.ts';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(
    'Sembrando catálogo del Instrumento de Diagnóstico Organizacional LinkTIC…',
  );

  // El centinela debe existir antes que cualquier answer, que lo referencia por FK.
  await prisma.area.upsert({
    where: { code: SENTINEL_AREA.code },
    update: SENTINEL_AREA,
    create: SENTINEL_AREA,
  });

  // Las gestiones van antes que las áreas: cada subproceso las referencia por FK.
  for (const proceso of PROCESOS) {
    await prisma.proceso.upsert({
      where: { code: proceso.code },
      update: {
        name: proceso.name,
        sortOrder: proceso.sortOrder,
        active: true,
      },
      create: proceso,
    });
  }
  console.log(`  ✔ ${PROCESOS.length} gestiones (procesos principales)`);

  for (const area of AREAS) {
    await prisma.area.upsert({
      where: { code: area.code },
      update: {
        name: area.name,
        procesoCode: area.procesoCode,
        sortOrder: area.sortOrder,
        isEvaluable: true,
        active: true,
      },
      create: area,
    });
  }

  // 'OTRA' se conserva para las respuestas históricas que la usaron; ya no es
  // seleccionable en ninguna pregunta del instrumento.
  await prisma.area.upsert({
    where: { code: 'OTRA' },
    update: { name: 'Otra', isEvaluable: false, sortOrder: 900 },
    create: { code: 'OTRA', name: 'Otra', isEvaluable: false, sortOrder: 900 },
  });

  // Un área que salió del organigrama deja de ofrecerse, pero no se borra: las
  // respuestas ya recolectadas la referencian por FK.
  const vigentes = [
    ...AREAS.map((area) => area.code),
    'OTRA',
    SENTINEL_AREA.code,
  ];
  const retiradas = await prisma.area.updateMany({
    where: { code: { notIn: vigentes } },
    data: { active: false, isEvaluable: false },
  });
  console.log(
    `  ✔ ${AREAS.length + 2} áreas (incluye OTRA y el centinela global)` +
      (retiradas.count > 0 ? `, ${retiradas.count} retiradas` : ''),
  );

  const gestionesRetiradas = await prisma.proceso.updateMany({
    where: { code: { notIn: PROCESOS.map((proceso) => proceso.code) } },
    data: { active: false },
  });
  if (gestionesRetiradas.count > 0) {
    console.log(`  · ${gestionesRetiradas.count} gestiones retiradas`);
  }

  for (const [index, component] of COMPONENTS.entries()) {
    await prisma.component.upsert({
      where: { id: component.id },
      update: {
        code: component.code,
        title: component.title,
        intro: component.intro,
        sortOrder: index + 1,
      },
      create: { ...component, sortOrder: index + 1 },
    });
  }
  console.log(`  ✔ ${COMPONENTS.length} componentes`);

  let optionCount = 0;
  for (const [index, question] of QUESTIONS.entries()) {
    const { options, ...fields } = question;
    const data = {
      ...fields,
      required: fields.required ?? true,
      perArea: fields.perArea ?? false,
      optionSource: fields.optionSource ?? 'STATIC',
      sortOrder: index + 1,
    };

    await prisma.question.upsert({
      where: { code: question.code },
      update: data,
      create: data,
    });

    // Reemplaza las opciones estáticas en bloque: el catálogo del PDF es la fuente de
    // verdad, así que un cambio ahí debe borrar lo que ya no existe.
    await prisma.questionOption.deleteMany({
      where: { questionCode: question.code },
    });
    if (options?.length) {
      await prisma.questionOption.createMany({
        data: options.map((option, optionIndex) => ({
          questionCode: question.code,
          value: option.value,
          label: option.label,
          allowsText: option.allowsText ?? false,
          exclusive: option.exclusive ?? false,
          sortOrder: optionIndex + 1,
        })),
      });
      optionCount += options.length;
    }
  }
  // Una pregunta que sale del instrumento se desactiva, no se borra: las respuestas ya
  // recolectadas la referencian por FK, y el panel las sigue mostrando.
  const preguntasRetiradas = await prisma.question.updateMany({
    where: { code: { notIn: QUESTIONS.map((question) => question.code) } },
    data: { active: false },
  });
  console.log(
    `  ✔ ${QUESTIONS.length} preguntas, ${optionCount} opciones estáticas` +
      (preguntasRetiradas.count > 0
        ? `, ${preguntasRetiradas.count} retiradas`
        : ''),
  );

  for (const weight of INDICATOR_WEIGHTS) {
    await prisma.indicatorWeight.upsert({
      where: { indicatorCode: weight.indicatorCode },
      update: { weight: weight.weight },
      create: weight,
    });
  }
  const weightSum = INDICATOR_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);
  if (Math.abs(weightSum - 1) > 0.0005) {
    throw new Error(`Los pesos del IMC deben sumar 1.000, suman ${weightSum}`);
  }
  console.log(
    `  ✔ ${INDICATOR_WEIGHTS.length} pesos del IMC (suman ${weightSum.toFixed(3)})`,
  );

  await prisma.indicatorThreshold.deleteMany({});
  await prisma.indicatorThreshold.createMany({ data: INDICATOR_THRESHOLDS });
  console.log(`  ✔ ${INDICATOR_THRESHOLDS.length} umbrales de semaforización`);

  const openCampaign = await prisma.campaign.findFirst({
    where: { isOpen: true },
  });
  if (!openCampaign) {
    const campaign = await prisma.campaign.create({
      data: { name: 'Diagnóstico Organizacional — Corte inicial' },
    });
    console.log(`  ✔ campaña abierta creada: ${campaign.name}`);
  } else {
    console.log(`  · campaña abierta ya existente: ${openCampaign.name}`);
  }

  console.log('Catálogo sembrado.');
}

main()
  .catch((error) => {
    console.error('El seed falló:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
