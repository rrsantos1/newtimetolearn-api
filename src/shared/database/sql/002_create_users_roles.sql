BEGIN;

-- Tipos enumerados utilizados pelo domínio de usuários.
DO $$
BEGIN
  CREATE TYPE user_status AS ENUM (
    'PENDING_VERIFICATION',
    'ACTIVE',
    'BLOCKED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE role_code AS ENUM (
    'ADMIN',
    'TEACHER',
    'STUDENT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Usuários.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status user_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
  email_verified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email
  ON users (email);

-- Papéis disponíveis na plataforma.
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code role_code NOT NULL,
  name VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_code
  ON roles (code);

-- Associação N:N entre usuários e papéis.
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL,
  role_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pk_user_roles
    PRIMARY KEY (user_id, role_id),

  CONSTRAINT fk_user_roles_user
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE,

  CONSTRAINT fk_user_roles_role
    FOREIGN KEY (role_id)
    REFERENCES roles (id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role_id
  ON user_roles (role_id);

-- Atualização automática de updated_at.
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_roles_updated_at ON roles;

CREATE TRIGGER trg_roles_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Papéis de referência.
INSERT INTO roles (code, name)
VALUES
  ('ADMIN', 'Administrador'),
  ('TEACHER', 'Professor'),
  ('STUDENT', 'Aluno')
ON CONFLICT (code) DO NOTHING;

COMMIT;