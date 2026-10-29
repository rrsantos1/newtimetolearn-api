CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Função reutilizável para atualização de updated_at.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;