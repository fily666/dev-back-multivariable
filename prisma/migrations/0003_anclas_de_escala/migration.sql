-- Cada escala 0-10 trae sus propias anclas. Antes todas decían "muy deficiente" /
-- "excelente", que no se lee bien en preguntas de frecuencia ("Cumplen los compromisos")
-- ni en el NPS, cuyo 0 es "nada probable". Las columnas son opcionales: el front cae en
-- las anclas genéricas si una pregunta no las trae, y el seed las llena.

-- AlterTable
ALTER TABLE "questions" ADD COLUMN "scale_min_label" TEXT,
ADD COLUMN "scale_max_label" TEXT;
