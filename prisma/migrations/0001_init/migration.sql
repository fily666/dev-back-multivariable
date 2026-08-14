-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE', 'MULTI', 'SCALE_0_10', 'TEXT', 'MATRIX_AREA');

-- CreateEnum
CREATE TYPE "ResponseStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OptionSource" AS ENUM ('STATIC', 'AREAS', 'PROCESOS');

-- CreateTable
CREATE TABLE "areas" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_evaluable" BOOLEAN NOT NULL DEFAULT true,
    "headcount" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "procesos" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner_area" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "procesos_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "components" (
    "id" SMALLINT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "intro" TEXT,
    "sort_order" SMALLINT NOT NULL,

    CONSTRAINT "components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "code" TEXT NOT NULL,
    "component_id" SMALLINT NOT NULL,
    "label" TEXT NOT NULL,
    "help_text" TEXT,
    "type" "QuestionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "min_select" SMALLINT,
    "max_select" SMALLINT,
    "per_area" BOOLEAN NOT NULL DEFAULT false,
    "option_source" "OptionSource" NOT NULL DEFAULT 'STATIC',
    "max_length" INTEGER,
    "sort_order" SMALLINT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" BIGSERIAL NOT NULL,
    "question_code" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "allows_text" BOOLEAN NOT NULL DEFAULT false,
    "exclusive" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" SMALLINT NOT NULL,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMPTZ,
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "status" "ResponseStatus" NOT NULL DEFAULT 'DRAFT',
    "draft_token" TEXT,
    "own_area" TEXT,
    "own_area_other" TEXT,
    "respondent_name" TEXT,
    "respondent_role" TEXT,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMPTZ,
    "duration_seconds" INTEGER,
    "last_step" SMALLINT NOT NULL DEFAULT 0,
    "user_agent_hash" TEXT,
    "ip_hash" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" BIGSERIAL NOT NULL,
    "response_id" UUID NOT NULL,
    "question_code" TEXT NOT NULL,
    "target_area" TEXT NOT NULL DEFAULT '__GLOBAL__',
    "value_number" DECIMAL(4,1),
    "value_option" TEXT,
    "value_options" TEXT[],
    "value_text" TEXT,
    "theme" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicator_weights" (
    "indicator_code" TEXT NOT NULL,
    "weight" DECIMAL(4,3) NOT NULL,

    CONSTRAINT "indicator_weights_pkey" PRIMARY KEY ("indicator_code")
);

-- CreateTable
CREATE TABLE "indicator_thresholds" (
    "id" SMALLSERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "min_value" DECIMAL(5,2) NOT NULL,
    "max_value" DECIMAL(5,2) NOT NULL,
    "color" TEXT NOT NULL,
    "sort_order" SMALLINT NOT NULL,

    CONSTRAINT "indicator_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_log" (
    "id" BIGSERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "detail" JSONB,
    "ip_hash" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "components_code_key" ON "components"("code");

-- CreateIndex
CREATE INDEX "questions_component_id_idx" ON "questions"("component_id");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_question_code_value_key" ON "question_options"("question_code", "value");

-- CreateIndex
CREATE UNIQUE INDEX "survey_responses_draft_token_key" ON "survey_responses"("draft_token");

-- CreateIndex
CREATE INDEX "survey_responses_status_campaign_id_idx" ON "survey_responses"("status", "campaign_id");

-- CreateIndex
CREATE INDEX "survey_responses_own_area_idx" ON "survey_responses"("own_area");

-- CreateIndex
CREATE INDEX "answers_question_code_idx" ON "answers"("question_code");

-- CreateIndex
CREATE INDEX "answers_target_area_idx" ON "answers"("target_area");

-- CreateIndex
CREATE INDEX "answers_response_id_idx" ON "answers"("response_id");

-- CreateIndex
CREATE UNIQUE INDEX "answers_response_id_question_code_target_area_key" ON "answers"("response_id", "question_code", "target_area");

-- CreateIndex
CREATE INDEX "admin_audit_log_action_ip_hash_created_at_idx" ON "admin_audit_log"("action", "ip_hash", "created_at");

-- AddForeignKey
ALTER TABLE "procesos" ADD CONSTRAINT "procesos_owner_area_fkey" FOREIGN KEY ("owner_area") REFERENCES "areas"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_code_fkey" FOREIGN KEY ("question_code") REFERENCES "questions"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_own_area_fkey" FOREIGN KEY ("own_area") REFERENCES "areas"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "survey_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_code_fkey" FOREIGN KEY ("question_code") REFERENCES "questions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_target_area_fkey" FOREIGN KEY ("target_area") REFERENCES "areas"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

