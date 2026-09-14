-- Invierte la jerarquía del catálogo: antes un `proceso` colgaba de un `area`; ahora un
-- `area` (subproceso) cuelga de un `proceso` (gestión). Es el árbol que LinkTIC confirmó
-- el 14-sep-2026, y el que la encuesta usa para agrupar la selección de áreas.
--
-- Las respuestas recolectadas hasta ahora se borran deliberadamente: sus `target_area`
-- apuntan a los siete códigos del catálogo viejo, que el árbol nuevo no conserva, y
-- mezclar los dos catálogos falsearía todos los indicadores. Hay respaldo en
-- `respaldo-pre-recoleccion-2026-08-14.json`.

-- DeleteData: respuestas del catálogo anterior
DELETE FROM "answers";
DELETE FROM "survey_responses";

-- AlterTable: el subproceso apunta a su gestión
ALTER TABLE "areas" ADD COLUMN "proceso_code" TEXT;

-- DropForeignKey + DropColumn: la gestión ya no pertenece a un área
ALTER TABLE "procesos" DROP CONSTRAINT "procesos_owner_area_fkey";
ALTER TABLE "procesos" DROP COLUMN "owner_area";

-- DeleteData: el catálogo viejo de áreas y procesos lo repone el seed
DELETE FROM "procesos";
DELETE FROM "areas" WHERE "code" NOT IN ('__GLOBAL__', 'OTRA');

-- AlterTable: el nombre del encuestado ya no se pide; la identificación es área + cargo
ALTER TABLE "survey_responses" DROP COLUMN "respondent_name";

-- CreateIndex
CREATE INDEX "areas_proceso_code_idx" ON "areas"("proceso_code");

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_proceso_code_fkey" FOREIGN KEY ("proceso_code") REFERENCES "procesos"("code") ON DELETE SET NULL ON UPDATE CASCADE;
