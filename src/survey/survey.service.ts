import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { GLOBAL_AREA_CODE, RESPONDENT_ROLES } from '../common/constants';
import type { OptionSource } from '../generated/prisma/enums.ts';
import type {
  AreaDto,
  ComponentDto,
  ProcesoDto,
  QuestionDto,
  QuestionOptionDto,
  SurveySchemaDto,
} from './dto/survey-schema.dto';

@Injectable()
export class SurveyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Devuelve el instrumento completo: campaña activa, catálogo de áreas y los 10
   * componentes con sus preguntas y opciones ya resueltas.
   *
   * Las opciones de las preguntas marcadas como "(Lista)" en el PDF se resuelven aquí
   * desde el catálogo vivo (áreas/procesos), así que dar de alta un área no obliga a
   * editar preguntas.
   */
  async getSchema(): Promise<SurveySchemaDto> {
    const [campaign, areas, procesos, components] = await Promise.all([
      this.prisma.campaign.findFirst({
        where: { isOpen: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.area.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.proceso.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.component.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          questions: {
            where: { active: true },
            orderBy: { sortOrder: 'asc' },
            include: { options: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      }),
    ]);

    if (!campaign) {
      throw new NotFoundException(
        'No hay una campaña de diagnóstico abierta en este momento.',
      );
    }

    // El nombre de la gestión viaja pegado a cada subproceso: así el front agrupa la
    // lista sin tener que cruzarla contra el catálogo de procesos por su cuenta.
    const procesoNames = new Map(
      procesos.map((proceso) => [proceso.code, proceso.name]),
    );

    const areaOptions: QuestionOptionDto[] = areas
      .filter((area) => area.code !== GLOBAL_AREA_CODE && area.isEvaluable)
      .map((area) => ({
        value: area.code,
        label: area.name,
        allowsText: false,
        exclusive: false,
        group:
          area.procesoCode && procesoNames.has(area.procesoCode)
            ? {
                code: area.procesoCode,
                label: procesoNames.get(area.procesoCode)!,
              }
            : null,
      }));

    const procesoOptions: QuestionOptionDto[] = procesos.map((proceso) => ({
      value: proceso.code,
      label: proceso.name,
      allowsText: false,
      exclusive: false,
      group: null,
    }));

    const mapped: ComponentDto[] = components.map((component) => ({
      id: component.id,
      code: component.code,
      title: component.title,
      intro: component.intro,
      questions: component.questions.map((question): QuestionDto => {
        const staticOptions: QuestionOptionDto[] = question.options.map(
          (option) => ({
            value: option.value,
            label: option.label,
            allowsText: option.allowsText,
            exclusive: option.exclusive,
            group: null,
          }),
        );

        const catalogOptions =
          question.optionSource === 'AREAS'
            ? areaOptions
            : question.optionSource === 'PROCESOS'
              ? procesoOptions
              : [];

        return {
          code: question.code,
          componentId: question.componentId,
          label: question.label,
          helpText: question.helpText,
          type: question.type,
          required: question.required,
          minSelect: question.minSelect,
          maxSelect: question.maxSelect,
          perArea: question.perArea,
          maxLength: question.maxLength,
          options: [...catalogOptions, ...staticOptions],
        };
      }),
    }));

    const publicAreas: AreaDto[] = areas
      .filter((area) => area.code !== GLOBAL_AREA_CODE)
      .map((area) => ({
        code: area.code,
        name: area.name,
        isEvaluable: area.isEvaluable,
        procesoCode: area.procesoCode,
      }));

    const publicProcesos: ProcesoDto[] = procesos.map((proceso) => ({
      code: proceso.code,
      name: proceso.name,
    }));

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        isOpen: campaign.isOpen,
      },
      areas: publicAreas,
      procesos: publicProcesos,
      roles: RESPONDENT_ROLES.map((role) => ({
        value: role.value,
        label: role.label,
      })),
      components: mapped,
      settings: {
        maxAreasInteraccion: this.config.get<number>(
          'MAX_AREAS_INTERACCION',
          5,
        ),
      },
    };
  }

  /**
   * Catálogo indexado por código, para que el motor de reglas valide sin re-consultar.
   *
   * Las opciones llegan RESUELTAS, igual que en `getSchema`: una pregunta con
   * `optionSource = AREAS` saca sus opciones de la tabla `areas`, no de `question_options`.
   * Si aquí se devolvieran solo las estáticas, el motor rechazaría todo valor legítimo del
   * catálogo — el encuestado vería opciones que el servidor no acepta.
   */
  async getQuestionIndex() {
    const [questions, catalog] = await Promise.all([
      this.prisma.question.findMany({
        where: { active: true },
        include: { options: true },
      }),
      this.loadCatalogOptions(),
    ]);

    return new Map(
      questions.map((question) => [
        question.code,
        {
          ...question,
          options: [
            ...this.catalogOptionsFor(question.optionSource, catalog).map(
              (option, index) => ({
                id: BigInt(-(index + 1)),
                questionCode: question.code,
                value: option.value,
                label: option.label,
                allowsText: false,
                exclusive: false,
                sortOrder: index + 1,
              }),
            ),
            ...question.options,
          ],
        },
      ]),
    );
  }

  /** Opciones que provienen de un catálogo vivo (áreas, procesos). */
  private async loadCatalogOptions() {
    const [areas, procesos] = await Promise.all([
      this.prisma.area.findMany({
        where: {
          active: true,
          isEvaluable: true,
          code: { not: GLOBAL_AREA_CODE },
        },
        orderBy: { sortOrder: 'asc' },
        select: { code: true, name: true },
      }),
      this.prisma.proceso.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        select: { code: true, name: true },
      }),
    ]);

    return {
      AREAS: areas.map((area) => ({ value: area.code, label: area.name })),
      PROCESOS: procesos.map((proceso) => ({
        value: proceso.code,
        label: proceso.name,
      })),
    };
  }

  private catalogOptionsFor(
    source: OptionSource,
    catalog: {
      AREAS: { value: string; label: string }[];
      PROCESOS: { value: string; label: string }[];
    },
  ) {
    if (source === 'AREAS') return catalog.AREAS;
    if (source === 'PROCESOS') return catalog.PROCESOS;
    return [];
  }
}
