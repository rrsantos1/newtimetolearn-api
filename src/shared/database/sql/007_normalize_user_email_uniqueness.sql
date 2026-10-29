DROP INDEX IF EXISTS uq_users_email;

CREATE UNIQUE INDEX uq_users_email
    ON users (LOWER(email));