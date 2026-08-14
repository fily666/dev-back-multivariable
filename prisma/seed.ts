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

  for (const area of AREAS) {
    await prisma.area.upsert({
      where: { code: area.code },
      update: { name: area.name, sortOrder: area.sortOrder },
      create: area,
    });
  }

  // 'OTRA' se captura como texto libre y se reporta aparte; no entra en la matriz de
  // relacionamiento salvo que un admin la mapee a un área existente.
  await prisma.area.upsert({
    where: { code: 'OTRA' },
    update: { name: 'Otra', isEvaluable: false, sortOrder: 900 },
    create: { code: 'OTRA', name: 'Otra', isEvaluable: false, sortOrder: 900 },
  });
  console.log(
    `  ✔ ${AREAS.length + 2} áreas (incluye OTRA y el centinela global)`,
  );

  for (const proceso of PROCESOS) {
    await prisma.proceso.upsert({
      where: { code: proceso.code },
      update: {
        name: proceso.name,
        ownerArea: proceso.ownerArea,
        sortOrder: proceso.sortOrder,
      },
      create: proceso,
    });
  }
  console.log(`  ✔ ${PROCESOS.length} procesos`);

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
  console.log(
    `  ✔ ${QUESTIONS.length} preguntas, ${optionCount} opciones estáticas`,
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
