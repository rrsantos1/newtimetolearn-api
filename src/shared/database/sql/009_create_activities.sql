BEGIN;

-- =========================================================
-- ACTIVITIES
-- =========================================================

CREATE TABLE public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    teacher_id UUID NOT NULL,

    type VARCHAR(50) NOT NULL,

    slug VARCHAR(150) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',

    visibility VARCHAR(20) NOT NULL DEFAULT 'AUTHENTICATED',

    execution_count INTEGER NOT NULL DEFAULT 0,

    current_published_version_id UUID NULL,

    deleted_at TIMESTAMPTZ NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_activities_teacher
        FOREIGN KEY (teacher_id)
        REFERENCES public.users (id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_activities_type
        CHECK (
            type IN (
                'quiz',
                'word_search',
                'crossword',
                'cloze',
                'multiple_choice',
                'fill_in_the_blank',
                'drag_drop',
                'sentence_order',
                'board_game',
                'roulette',
                'hangman',
                'memory',
                'fill_in_blanks',
                'mole_hit'
            )
        ),

    CONSTRAINT chk_activities_status
        CHECK (
            status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')
        ),

    CONSTRAINT chk_activities_visibility
        CHECK (
            visibility IN ('AUTHENTICATED', 'PUBLIC')
        ),

    CONSTRAINT chk_activities_execution_count
        CHECK (execution_count >= 0)
);


-- =========================================================
-- ACTIVITY VERSIONS
-- =========================================================

CREATE TABLE public.activity_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    activity_id UUID NOT NULL,

    version_number INTEGER NOT NULL,

    name VARCHAR(120) NOT NULL,

    description VARCHAR(2000) NULL,

    difficulty VARCHAR(20) NOT NULL,

    time_limit_seconds INTEGER NULL,

    content JSONB NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',

    revision INTEGER NOT NULL DEFAULT 1,

    submitted_at TIMESTAMPTZ NULL,

    published_at TIMESTAMPTZ NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_activity_versions_activity
        FOREIGN KEY (activity_id)
        REFERENCES public.activities (id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_activity_versions_number
        UNIQUE (activity_id, version_number),

    CONSTRAINT uq_activity_versions_activity_id
        UNIQUE (activity_id, id),

    CONSTRAINT chk_activity_versions_number
        CHECK (version_number > 0),

    CONSTRAINT chk_activity_versions_name
        CHECK (length(trim(name)) > 0),

    CONSTRAINT chk_activity_versions_difficulty
        CHECK (
            difficulty IN ('EASY', 'MEDIUM', 'HARD')
        ),

    CONSTRAINT chk_activity_versions_time_limit
        CHECK (
            time_limit_seconds IS NULL
            OR time_limit_seconds > 0
        ),

    CONSTRAINT chk_activity_versions_status
        CHECK (
            status IN (
                'DRAFT',
                'PENDING_REVIEW',
                'PUBLISHED',
                'REJECTED',
                'CHANGES_REQUESTED'
            )
        ),

    CONSTRAINT chk_activity_versions_revision
        CHECK (revision >= 1),

    CONSTRAINT chk_activity_versions_content
        CHECK (jsonb_typeof(content) = 'object')
);


-- =========================================================
-- CURRENT PUBLISHED VERSION
-- =========================================================

-- Garante que a versão selecionada pertence à própria atividade.

ALTER TABLE public.activities
    ADD CONSTRAINT fk_activities_current_published_version
    FOREIGN KEY (id, current_published_version_id)
    REFERENCES public.activity_versions (activity_id, id)
    ON DELETE RESTRICT;


-- =========================================================
-- INDEXES
-- =========================================================

CREATE UNIQUE INDEX uq_activities_slug
    ON public.activities (slug);

CREATE INDEX idx_activities_teacher_status
    ON public.activities (teacher_id, status);

CREATE INDEX idx_activities_type_status
    ON public.activities (type, status);

CREATE INDEX idx_activities_status_visibility
    ON public.activities (status, visibility);

CREATE INDEX idx_activity_versions_activity_status
    ON public.activity_versions (activity_id, status);


-- =========================================================
-- ONLY ONE ACTIVE EDIT/REVIEW VERSION PER ACTIVITY
-- =========================================================

CREATE UNIQUE INDEX uq_activity_versions_active_flow
    ON public.activity_versions (activity_id)
    WHERE status IN (
        'DRAFT',
        'PENDING_REVIEW',
        'CHANGES_REQUESTED'
    );

COMMIT;