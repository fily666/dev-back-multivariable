import { RESPONDENT_ROLES, ROLE_GROUPS } from '../../common/constants';
import { computeAllIndicators, computeImc, computeNps } from '../indicators';
import type { RawAnswerRow } from '../indicators/indicator.types';
import type { RoleGroupIndicesRow, RoleIndicesRow } from '../dto/analytics.dto';

/** Los 10 indicadores, el IMC y el NPS de un conjunto de respuestas. */
function buildRow(
  key: string,
  label: string,
  rows: RawAnswerRow[],
  weights: Map<string, number>,
): RoleIndicesRow {
  const indicators = computeAllIndicators(rows);

  return {
    key,
    label,
    respondents: new Set(rows.map((row) => row.responseId)).size,
    indicators: Object.fromEntries(
      indicators.map((indicator) => [indicator.code, indicator.value]),
    ),
    imc: computeImc(indicators, weights).value,
    nps: computeNps(rows).value,
  };
}

/**
 * La organización vista desde cada nivel de cargo y desde cada grupo de niveles.
 *
 * Devuelve solo los cargos y grupos con al menos una respuesta, en su orden declarado, y
 * SIN aplicar la cohorte: eso lo hace el servicio, así que lo que retire cuenta como
 * suprimido y un cargo que nadie declaró no infla esa cifra.
 *
 * Las respuestas sin cargo quedan fuera: no hay fila a la que atribuirlas, y sumarlas a un
 * grupo cualquiera inventaría una jerarquía que el encuestado no declaró.
 */
export function buildRoleIndices(
  rows: RawAnswerRow[],
  weights: Map<string, number>,
): { roles: RoleIndicesRow[]; groups: RoleGroupIndicesRow[] } {
  const byRole = new Map<string, RawAnswerRow[]>();

  for (const row of rows) {
    if (!row.respondentRole) continue;
    const group = byRole.get(row.respondentRole);
    if (group) group.push(row);
    else byRole.set(row.respondentRole, [row]);
  }

  const roles = RESPONDENT_ROLES.filter((role) => byRole.has(role.value)).map(
    (role) =>
      buildRow(role.value, role.label, byRole.get(role.value)!, weights),
  );

  const groups = ROLE_GROUPS.map((group) => {
    const members: readonly string[] = group.roles;
    return {
      group,
      members,
      rows: members.flatMap((role) => byRole.get(role) ?? []),
    };
  })
    .filter((entry) => entry.rows.length > 0)
    .map(({ group, members, rows: groupRows }) => ({
      ...buildRow(group.value, group.label, groupRows, weights),
      roles: [...members],
    }));

  return { roles, groups };
}
