import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { GLOBAL_AREA_CODE, RESPONDENT_ROLE_LABELS } from '../common/constants';
import { AnswersRepository } from './repositories/answers.repository';
import { ResponsesRepository } from './repositories/responses.repository';
import { WeightsService } from './weights.service';
import { ThresholdsService } from './thresholds.service';
import { applyCohort, filterCohortRows } from './cohort.util';
import {
  INDICATOR_LABELS,
  QUESTION_CODES_BY_INDICATOR,
  RADAR_INDICES,
  computeAllIndicators,
  computeImc,
  computeNps,
  computeNpsMotives,
  median,
} from './indicators';
import {
  RELATIONSHIP_QUESTION_CODES,
  buildAreaRanking,
  buildAspectMatrix,
  buildPerceptionGap,
  buildRelationshipMap,
} from './kpis/relationship.kpi';
import {
  buildInnovationNetwork,
  countMultiOptions,
  countSingleOptions,
} from './kpis/distribution.kpi';
import { buildMonitoring } from './kpis/monitoring.kpi';
import { buildItemStats } from './kpis/items.kpi';
import { buildRoleIndices } from './kpis/roles.kpi';
import { buildInfluence, type RawInfluenceLevel } from './kpis/influence.kpi';
import {
  NETWORK_OPTION_CODES,
  NETWORK_QUESTION_CODES,
  buildNetwork,
} from './kpis/network.kpi';
import {
  OPEN_ANSWER_CODE,
  QUALITY_COMPONENT_IDS,
  buildQuality,
} from './kpis/quality.kpi';
import type {
  AnalyticsEnvelope,
  RawAnswerRow,
} from './indicators/indicator.types';
import type {
  AnalyticsFilters,
  IndicatorsPayload,
  IndicesByRolePayload,
  InfluenceLevel,
  InfluencePayload,
  ItemsPayload,
  MonitoringPayload,
  NetworkPayload,
  OverviewCards,
  QualitativePayload,
  QualityPayload,
  RadarPoint,
} from './dto/analytics.dto';

const ALL_INDICATOR_CODES = [
  ...new Set(Object.values(QUESTION_CODES_BY_INDICATOR).flat()),
];

const NPS_CODES = ['c9_nps', 'c9_motivos'];

const QUALITATIVE_CODES = [
  'c10_obstaculo',
  'c10_proceso_reprocesos',
  'c10_area_fortalecer',
  'c10_area_mayor_valor',
  ...NPS_CODES,
];

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly answers: AnswersRepository,
    private readonly responses: ResponsesRepository,
    private readonly weights: WeightsService,
    private readonly thresholds: ThresholdsService,
    private readonly config: ConfigService,
  ) {}

  private get minCohortSize(): number {
    return Number(this.config.get<string>('MIN_COHORT_SIZE', '4'));
  }

  /** Cuenta encuestados distintos: es el `n` que decide si un corte se puede mostrar. */
  private countRespondents(rows: RawAnswerRow[]): number {
    return new Set(rows.map((row) => row.responseId)).size;
  }

  /** KPIs 1-6 más el radar del KPI 7. */
  async getOverview(
    filters: AnalyticsFilters,
  ): Promise<AnalyticsEnvelope<OverviewCards & { radar: RadarPoint[] }>> {
    const [rows, stats, population, areas, bands, weights] = await Promise.all([
      this.answers.fetchAnswers(
        [...ALL_INDICATOR_CODES, ...NPS_CODES, 'c10_area_mayor_valor'],
        filters,
      ),
      this.responses.fetchCompletionStats(filters),
      // Con el corte por cargo no hay denominador: el headcount está por área, no por cargo,
      // y dividir los directores que respondieron entre toda la plantilla daría una tasa
      // falsa. Sin población, la tasa sale en null y el panel muestra "sin definir".
      filters.respondentRole
        ? Promise.resolve(null)
        : this.responses.fetchPopulation(filters.ownArea),
      this.responses.fetchAreas(),
      this.thresholds.getBands(),
      this.weights.getWeights(),
    ]);

    const indicators = computeAllIndicators(rows);
    const imc = computeImc(indicators, weights);
    const nps = computeNps(rows);

    const areaNames = new Map(areas.map((area) => [area.code, area.name]));
    const topValue =
      countSingleOptions(rows, 'c10_area_mayor_valor', areaNames)[0] ?? null;

    const radar: RadarPoint[] = RADAR_INDICES.map((entry) => {
      const indicator = indicators.find((item) => item.code === entry.code);
      return {
        code: entry.code,
        label: entry.label,
        value: indicator?.value ?? null,
        band: this.thresholds.classifyWith(bands, indicator?.value ?? null),
      };
    });

    const data: OverviewCards & { radar: RadarPoint[] } = {
      imc: {
        value: imc.value,
        band: this.thresholds.classifyWith(bands, imc.value),
        respondents: imc.respondents,
      },
      nps,
      participation: {
        completed: stats.completed,
        population,
        rate:
          population === null || population === 0
            ? null
            : Math.round((stats.completed / population) * 1000) / 10,
      },
      completion: {
        completed: stats.completed,
        started: stats.started,
        rate:
          stats.started === 0
            ? null
            : Math.round((stats.completed / stats.started) * 1000) / 10,
      },
      medianDurationSeconds: median(stats.durations),
      topValueArea: topValue
        ? {
            code: topValue.value,
            name: topValue.label,
            mentions: topValue.count,
          }
        : null,
      radar,
    };

    return applyCohort(stats.completed, this.minCohortSize, data);
  }

  /** Los 10 indicadores más el IMC, el NPS, el radar, los umbrales y los pesos vigentes. */
  async getIndicators(
    filters: AnalyticsFilters,
  ): Promise<AnalyticsEnvelope<IndicatorsPayload>> {
    const [rows, bands, weights, weightList] = await Promise.all([
      this.answers.fetchAnswers(
        [...ALL_INDICATOR_CODES, ...NPS_CODES],
        filters,
      ),
      this.thresholds.getBands(),
      this.weights.getWeights(),
      this.weights.listWeights(),
    ]);

    const indicators = computeAllIndicators(rows);
    const composite = computeImc(indicators, weights);

    const radar: RadarPoint[] = RADAR_INDICES.map((entry) => {
      const indicator = indicators.find((item) => item.code === entry.code);
      return {
        code: entry.code,
        label: entry.label,
        value: indicator?.value ?? null,
        band: this.thresholds.classifyWith(bands, indicator?.value ?? null),
      };
    });

    return applyCohort(this.countRespondents(rows), this.minCohortSize, {
      indicators,
      composite,
      nps: computeNps(rows),
      radar,
      thresholds: bands,
      weights: weightList,
    });
  }

  /** KPIs 8, 9, 10, 11: el mapa de relacionamiento y sus lecturas derivadas. */
  async getRelationshipMap(filters: AnalyticsFilters) {
    const [rows, areas] = await Promise.all([
      this.answers.fetchAnswers(RELATIONSHIP_QUESTION_CODES, filters),
      this.responses.fetchAreas(),
    ]);

    const areaNames = new Map(
      areas
        .filter((area) => area.isEvaluable)
        .map((area) => [area.code, area.name]),
    );

    const map = buildRelationshipMap(rows, areaNames);
    const min = this.minCohortSize;

    // Cada celda se suprime por separado: el riesgo de reidentificación está en el par
    // evaluador-evaluada, no en el total del corte.
    const cells = filterCohortRows(map.cells, min, (cell) => cell.respondents);
    const ranking = filterCohortRows(
      buildAreaRanking(rows, areaNames),
      min,
      (row) => row.respondents,
    );

    return applyCohort(this.countRespondents(rows), min, {
      map: { ...map, cells: cells.rows },
      suppressedCells: cells.suppressed,
      ranking: ranking.rows,
      suppressedRanking: ranking.suppressed,
      gap: buildPerceptionGap(rows, areaNames),
      aspects: filterCohortRows(
        buildAspectMatrix(rows, areaNames),
        min,
        (row) => row.respondents,
      ).rows,
    });
  }

  /** KPIs 2 y 18: NPS global, por área y motivos por segmento. */
  async getNps(filters: AnalyticsFilters) {
    const [rows, areas] = await Promise.all([
      this.answers.fetchAnswers(NPS_CODES, filters),
      this.responses.fetchAreas(),
    ]);

    const areaNames = new Map(areas.map((area) => [area.code, area.name]));
    const byArea = new Map<string, RawAnswerRow[]>();

    for (const row of rows) {
      if (row.questionCode !== 'c9_nps' || row.targetArea === GLOBAL_AREA_CODE)
        continue;
      const group = byArea.get(row.targetArea);
      if (group) group.push(row);
      else byArea.set(row.targetArea, [row]);
    }

    const perArea = [...byArea.entries()]
      .map(([areaCode, areaRows]) => ({
        areaCode,
        areaName: areaNames.get(areaCode) ?? areaCode,
        ...computeNps(areaRows),
        respondents: this.countRespondents(areaRows),
      }))
      .sort((a, b) => (b.value ?? -101) - (a.value ?? -101));

    const motives = computeNpsMotives(rows);

    return applyCohort(this.countRespondents(rows), this.minCohortSize, {
      global: computeNps(rows),
      byArea: filterCohortRows(
        perArea,
        this.minCohortSize,
        (row) => row.respondents,
      ).rows,
      motives: {
        promoters: toCountedOptions(motives.promoters),
        detractors: toCountedOptions(motives.detractors),
      },
    });
  }

  /** Ficha de un área: lo que recibe, lo que otorga y su desglose por aspecto. */
  async getAreaDetail(areaCode: string, filters: AnalyticsFilters) {
    const area = await this.prisma.area.findUnique({
      where: { code: areaCode },
    });
    if (!area) throw new NotFoundException(`El área ${areaCode} no existe.`);

    const [rows, areas, bands] = await Promise.all([
      this.answers.fetchAnswers(
        [...RELATIONSHIP_QUESTION_CODES, ...NPS_CODES],
        filters,
      ),
      this.responses.fetchAreas(),
      this.thresholds.getBands(),
    ]);

    const areaNames = new Map(areas.map((entry) => [entry.code, entry.name]));
    const inbound = rows.filter((row) => row.targetArea === areaCode);

    const gap = buildPerceptionGap(rows, areaNames).find(
      (row) => row.areaCode === areaCode,
    );
    const aspects = buildAspectMatrix(rows, areaNames).find(
      (row) => row.areaCode === areaCode,
    );
    const nps = computeNps(inbound);

    return applyCohort(this.countRespondents(inbound), this.minCohortSize, {
      area: { code: area.code, name: area.name, headcount: area.headcount },
      gap: gap ?? null,
      gapBand: this.thresholds.classifyWith(bands, gap?.received ?? null),
      aspects: aspects ?? null,
      nps,
    });
  }

  /** KPIs 14, 15, 16, 18, 19: todo lo cualitativo. */
  async getQualitative(
    filters: AnalyticsFilters,
  ): Promise<AnalyticsEnvelope<QualitativePayload>> {
    const [rows, openRows, areas, procesos, options] = await Promise.all([
      this.answers.fetchAnswers(QUALITATIVE_CODES, filters),
      this.answers.fetchOpenAnswers('c10_cambio_unico', filters),
      this.responses.fetchAreas(),
      this.prisma.proceso.findMany({ select: { code: true, name: true } }),
      this.prisma.questionOption.findMany({
        select: { value: true, label: true },
      }),
    ]);

    const areaNames = new Map(areas.map((area) => [area.code, area.name]));
    const procesoNames = new Map(
      procesos.map((proceso) => [proceso.code, proceso.name]),
    );
    const optionLabels = new Map(
      options.map((option) => [option.value, option.label]),
    );
    const motives = computeNpsMotives(rows);

    const data: QualitativePayload = {
      barriers: countMultiOptions(rows, 'c10_obstaculo', optionLabels),
      reworkProcesses: countSingleOptions(
        rows,
        'c10_proceso_reprocesos',
        procesoNames,
      ),
      areasToStrengthen: countSingleOptions(
        rows,
        'c10_area_fortalecer',
        areaNames,
      ),
      npsMotives: {
        promoters: toCountedOptions(motives.promoters, optionLabels),
        detractors: toCountedOptions(motives.detractors, optionLabels),
      },
      openAnswers: openRows.map((row) => ({
        id: String(row.id),
        text: row.valueText ?? '',
        theme: row.theme,
        ownArea: row.response.ownArea,
        submittedAt: row.response.submittedAt?.toISOString() ?? null,
      })),
    };

    return applyCohort(this.countRespondents(rows), this.minCohortSize, data);
  }

  /** KPI 17, más los índices por componente para la vista de detalle. */
  async getComponents(filters: AnalyticsFilters) {
    const [rows, bands, weights] = await Promise.all([
      this.answers.fetchAnswers(
        [...ALL_INDICATOR_CODES, ...NPS_CODES],
        filters,
      ),
      this.thresholds.getBands(),
      this.weights.getWeights(),
    ]);

    const indicators = computeAllIndicators(rows);

    return applyCohort(this.countRespondents(rows), this.minCohortSize, {
      indicators: indicators.map((indicator) => ({
        ...indicator,
        label: INDICATOR_LABELS[indicator.code],
        band: this.thresholds.classifyWith(bands, indicator.value),
      })),
      composite: computeImc(indicators, weights),
      innovationNetwork: buildInnovationNetwork(rows),
      thresholds: bands,
    });
  }

  /** KPI 20: los indicadores cruzados por área de origen. */
  async getIndicesByArea(filters: AnalyticsFilters) {
    const [rows, areas, counts] = await Promise.all([
      this.answers.fetchAnswers(
        [...ALL_INDICATOR_CODES, ...NPS_CODES],
        filters,
      ),
      this.responses.fetchAreas(),
      this.responses.fetchRespondentsByOwnArea(filters),
    ]);

    const respondentsByArea = new Map(
      counts.map((row) => [row.areaCode, row.respondents]),
    );
    const byOwnArea = new Map<string, RawAnswerRow[]>();

    for (const row of rows) {
      if (!row.ownArea) continue;
      const group = byOwnArea.get(row.ownArea);
      if (group) group.push(row);
      else byOwnArea.set(row.ownArea, [row]);
    }

    const table = [...byOwnArea.entries()].map(([areaCode, areaRows]) => {
      const indicators = computeAllIndicators(areaRows);
      return {
        areaCode,
        areaName:
          areas.find((area) => area.code === areaCode)?.name ?? areaCode,
        respondents:
          respondentsByArea.get(areaCode) ?? this.countRespondents(areaRows),
        indicators: Object.fromEntries(
          indicators.map((indicator) => [indicator.code, indicator.value]),
        ),
      };
    });

    const filtered = filterCohortRows(
      table,
      this.minCohortSize,
      (row) => row.respondents,
    );

    return applyCohort(this.countRespondents(rows), this.minCohortSize, {
      rows: filtered.rows,
      suppressed: filtered.suppressed,
    });
  }

  /** KPI 32: quién mueve a quién, por área y por gestión, con su plano de motricidad. */
  async getInfluence(
    filters: AnalyticsFilters,
  ): Promise<AnalyticsEnvelope<InfluencePayload>> {
    const [rows, areas] = await Promise.all([
      this.answers.fetchAnswers(RELATIONSHIP_QUESTION_CODES, filters),
      this.responses.fetchAreas(),
    ]);

    const levels = buildInfluence(
      rows,
      areas.map((area) => ({
        code: area.code,
        name: area.name,
        groupCode: area.procesoCode,
        groupName: area.proceso?.name ?? null,
      })),
    );
    const min = this.minCohortSize;

    // La cohorte va por par, como en la matriz del mapa: una relación que sostienen menos
    // personas que el umbral no se dibuja, ni su fuerza ni su IREL. Cada IREL de nodo se
    // suprime por su lado: el recibido por quienes evalúan, el otorgado por quienes evaluaron.
    //
    // La motricidad y la dependencia sí suman todas las relaciones, también las ocultas, como
    // ya lo hace el grado ponderado del KPI 10: sin ellas, un área pequeña parecería autónoma
    // solo porque sus pares no alcanzan la cohorte. Dicen con cuántas áreas trabaja y con qué
    // intensidad, nunca qué nota les dio. Si la organización decide que eso también debe
    // esperar a la cohorte, el corte va en `sumOf` de `buildInfluenceLevel`.
    const publish = (level: RawInfluenceLevel): InfluenceLevel => {
      const edges = filterCohortRows(
        level.edges,
        min,
        (edge) => edge.respondents,
      );
      return {
        ...level,
        edges: edges.rows,
        suppressedEdges: edges.suppressed,
        nodes: level.nodes.map((node) => ({
          ...node,
          irelReceived: node.receivedFrom >= min ? node.irelReceived : null,
          irelGranted: node.grantedBy >= min ? node.irelGranted : null,
        })),
      };
    };

    return applyCohort(this.countRespondents(rows), min, {
      areas: publish(levels.areas),
      gestiones: publish(levels.gestiones),
    });
  }

  /** Cada afirmación 0-10 por separado: promedio, dispersión, consenso y reparto de notas. */
  async getItems(
    filters: AnalyticsFilters,
  ): Promise<AnalyticsEnvelope<ItemsPayload>> {
    const questions = await this.responses.fetchScaleQuestions();
    const rows = await this.answers.fetchAnswers(
      questions.map((question) => question.code),
      filters,
    );

    return applyCohort(this.countRespondents(rows), this.minCohortSize, {
      items: buildItemStats(rows, questions),
    });
  }

  /** Los indicadores vistos desde cada nivel de cargo y desde cada grupo de niveles. */
  async getIndicesByRole(
    filters: AnalyticsFilters,
  ): Promise<AnalyticsEnvelope<IndicesByRolePayload>> {
    const [rows, weights] = await Promise.all([
      this.answers.fetchAnswers(
        [...ALL_INDICATOR_CODES, ...NPS_CODES],
        filters,
      ),
      this.weights.getWeights(),
    ]);

    const { roles, groups } = buildRoleIndices(rows, weights);
    const min = this.minCohortSize;

    // Cada fila se suprime por separado, como las de área: en una organización de este
    // tamaño un cargo puede tener una sola persona, y su fila sería su respuesta.
    const keptRoles = filterCohortRows(roles, min, (row) => row.respondents);
    const keptGroups = filterCohortRows(groups, min, (row) => row.respondents);

    return applyCohort(this.countRespondents(rows), min, {
      roles: keptRoles.rows,
      suppressedRoles: keptRoles.suppressed,
      groups: keptGroups.rows,
      suppressedGroups: keptGroups.suppressed,
    });
  }

  /** Quién trabaja con quién, con qué frecuencia, para qué, y quién quedó fuera. */
  async getNetwork(
    filters: AnalyticsFilters,
  ): Promise<AnalyticsEnvelope<NetworkPayload>> {
    const [rows, areas, options] = await Promise.all([
      this.answers.fetchAnswers(NETWORK_QUESTION_CODES, filters),
      this.responses.fetchAreas(),
      this.responses.fetchQuestionOptions(NETWORK_OPTION_CODES),
    ]);

    const network = buildNetwork({ rows, areas, options });
    const min = this.minCohortSize;

    // El IREL de cada área lo sostienen quienes la evalúan, así que se suprime por área,
    // como el ranking del mapa: el total del corte puede ser grande y el área tener tres.
    const importance = filterCohortRows(
      network.importance,
      min,
      (row) => row.respondents,
    );

    return applyCohort(this.countRespondents(rows), min, {
      ...network,
      importance: importance.rows,
    });
  }

  /** Qué tanto se puede confiar en el corte: velocidad, notas repetidas y texto escrito. */
  async getQuality(
    filters: AnalyticsFilters,
  ): Promise<AnalyticsEnvelope<QualityPayload>> {
    const [responses, questions, components, textOptions] = await Promise.all([
      this.answers.fetchCompletedResponses(filters),
      this.responses.fetchScaleQuestions(),
      this.responses.fetchComponents(),
      this.responses.fetchTextOptions(),
    ]);

    const scaleItems = questions.filter((question) =>
      QUALITY_COMPONENT_IDS.includes(question.componentId),
    );
    const [scaleRows, textAnswers] = await Promise.all([
      this.answers.fetchAnswers(
        scaleItems.map((question) => question.code),
        filters,
      ),
      this.answers.fetchTextAnswers(
        [
          OPEN_ANSWER_CODE,
          ...new Set(textOptions.map((option) => option.questionCode)),
        ],
        filters,
      ),
    ]);

    const data = buildQuality({
      responses,
      scaleRows,
      scaleItems,
      components,
      textAnswers,
      textOptions,
    });

    // Sin applyCohort, como el monitoreo. Esto describe CÓMO se respondió —en cuánto
    // tiempo, con cuántas notas repetidas, si se escribió algo—, nunca QUÉ se respondió.
    // Suprimirlo escondería justo la advertencia que más importa en un corte chico: que la
    // mitad de sus respuestas se dieron sin leer.
    //
    // Ojo con lo que sí cambia: en un corte de una o dos personas, «1 en línea recta» dice
    // algo de alguien concreto (que contestó sin leer), aunque no qué nota puso. Si la
    // organización decide que eso también debe esperar a la cohorte, el corte va aquí.
    return {
      data,
      meta: {
        n: data.completed,
        insufficient: false,
        minCohortSize: this.minCohortSize,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  async getResponsesPage(filters: AnalyticsFilters, page = 1, pageSize = 50) {
    const { total, rows } = await this.responses.fetchPage(
      filters,
      page,
      pageSize,
    );

    // El listado no expone respuestas individuales bajo el umbral de cohorte.
    return applyCohort(total, this.minCohortSize, {
      total,
      page,
      pageSize,
      rows: rows.map((row) => ({
        id: row.id,
        ownArea: row.ownArea,
        ownAreaName: row.area?.name ?? null,
        ownAreaOther: row.ownAreaOther,
        respondentRole: row.respondentRole,
        respondentRoleLabel: row.respondentRole
          ? (RESPONDENT_ROLE_LABELS[row.respondentRole] ?? row.respondentRole)
          : null,
        submittedAt: row.submittedAt?.toISOString() ?? null,
        durationSeconds: row.durationSeconds,
        answerCount: row._count.answers,
      })),
    });
  }

  /** Monitoreo de participación en vivo: conteos y tiempos, refrescado cada 15 s por el panel. */
  async getMonitoring(
    filters: AnalyticsFilters,
  ): Promise<AnalyticsEnvelope<MonitoringPayload>> {
    const [rows, components, areas, population] = await Promise.all([
      this.responses.fetchMonitoringRows(filters),
      this.responses.fetchComponents(),
      this.responses.fetchAreas(),
      this.responses.fetchPopulation(),
    ]);

    // Un solo `now` para el cálculo y para `generatedAt`: "hoy" y "activos ahora" deben
    // referirse al mismo instante que el panel muestra como hora de corte.
    const now = new Date();
    const data = buildMonitoring({ rows, components, areas, population, now });

    // Sin applyCohort, a propósito. La regla de cohorte protege QUÉ respondió alguien, no
    // QUE respondió: aquí solo hay conteos y tiempos, nunca opiniones. Suprimirlo dejaría el
    // monitoreo en blanco justo cuando más se necesita: con las primeras respuestas.
    //
    // Ojo con lo que sí cambia: el listado de /admin/responses pasa por la cohorte, así que
    // con menos de MIN_COHORT_SIZE completas oculta área y cargo, y este endpoint los cuenta
    // igual (p. ej. «1 completa de Legal»). Es participación, no contenido, pero si la
    // organización decide que también eso debe esperar a la cohorte, el corte va aquí.
    return {
      data,
      meta: {
        n: data.totals.completed,
        insufficient: false,
        minCohortSize: this.minCohortSize,
        generatedAt: now.toISOString(),
      },
    };
  }

  async updateTheme(answerId: string, theme: string | null) {
    return this.answers.updateTheme(BigInt(answerId), theme?.trim() || null);
  }
}

function toCountedOptions(
  counts: Map<string, number>,
  labels?: Map<string, string>,
) {
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: labels?.get(value) ?? value,
      count,
      share: total === 0 ? 0 : Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}
