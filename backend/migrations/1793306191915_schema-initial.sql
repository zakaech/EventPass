-- Up Migration

-- Types énumérés : PostgreSQL refuse toute valeur hors de la liste,
-- la règle est garantie par la base, pas seulement par le code.
CREATE TYPE role_utilisateur AS ENUM ('USER', 'ORGANISATEUR', 'ADMIN');
CREATE TYPE statut_validation AS ENUM ('EN_ATTENTE', 'VALIDE', 'REFUSE');
CREATE TYPE statut_event AS ENUM ('PUBLIE', 'ANNULE', 'TERMINE');
CREATE TYPE statut_ticket AS ENUM ('VALIDE', 'UTILISE', 'ANNULE');
CREATE TYPE categorie_event AS ENUM (
  'CONCERT', 'THEATRE', 'SPORT', 'CONFERENCE', 'FESTIVAL', 'EXPOSITION', 'AUTRE'
);

CREATE TABLE users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE, -- normalisé en minuscules par le validateur
  password_hash TEXT NOT NULL,
  nom           TEXT NOT NULL,
  role          role_utilisateur NOT NULL DEFAULT 'USER',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Relation 1–1 avec users : la clé primaire est aussi la clé étrangère.
CREATE TABLE organisateurs (
  user_id           BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  nom_organisation  TEXT NOT NULL,
  ville             TEXT NOT NULL,
  description       TEXT,
  statut_validation statut_validation NOT NULL DEFAULT 'EN_ATTENTE'
);

CREATE TABLE events (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organisateur_id  BIGINT NOT NULL REFERENCES organisateurs (user_id),
  titre            TEXT NOT NULL,
  description      TEXT,
  categorie        categorie_event NOT NULL,
  ville            TEXT NOT NULL,
  lieu             TEXT NOT NULL,
  date_debut       TIMESTAMPTZ NOT NULL,
  capacite         INTEGER NOT NULL CHECK (capacite > 0),
  places_restantes INTEGER NOT NULL,
  prix             NUMERIC(10, 2) NOT NULL CHECK (prix >= 0), -- NUMERIC : exact, pas d'arrondi flottant
  image_url        TEXT,
  statut           statut_event NOT NULL DEFAULT 'PUBLIE',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Dernier rempart contre la survente : même avec un bug dans le code,
  -- la base refusera un nombre de places négatif.
  CONSTRAINT places_restantes_valides CHECK (places_restantes >= 0 AND places_restantes <= capacite)
);

CREATE TABLE tickets (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users (id),
  event_id      BIGINT NOT NULL REFERENCES events (id),
  code          UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  statut        statut_ticket NOT NULL DEFAULT 'VALIDE',
  reserved_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in_at TIMESTAMPTZ
);

-- Index
-- users.email et tickets.code ont déjà un index, créé automatiquement par UNIQUE.
-- PostgreSQL n'indexe PAS automatiquement les clés étrangères : on le fait à la main
-- quand on filtre ou fait des jointures dessus.

-- Liste publique : toujours "statut = 'PUBLIE' AND date_debut > now()", triée par date.
-- La colonne testée par égalité (statut) vient en premier, celle de l'intervalle/tri ensuite.
CREATE INDEX events_statut_date_idx ON events (statut, date_debut);

-- Filtre ville insensible à la casse : la requête utilise lower(ville) = lower($1).
-- Un index sur "ville" ne servirait pas, il faut indexer l'expression lower(ville).
CREATE INDEX events_ville_lower_idx ON events (lower(ville));

CREATE INDEX events_categorie_idx ON events (categorie);

-- Clé étrangère : "les événements de l'organisateur X".
CREATE INDEX events_organisateur_idx ON events (organisateur_id);

-- Clé étrangère : "mes billets".
CREATE INDEX tickets_user_idx ON tickets (user_id);

-- Index composite : sert à la fois
--   - aux recherches sur event_id seul (réservations d'un événement, statistiques),
--     car un index (a, b) est utilisable pour une condition sur a seul ;
--   - au comptage du quota "billets de l'utilisateur U pour l'événement E".
CREATE INDEX tickets_event_user_idx ON tickets (event_id, user_id);

-- Down Migration

DROP TABLE tickets;
DROP TABLE events;
DROP TABLE organisateurs;
DROP TABLE users;
DROP TYPE categorie_event;
DROP TYPE statut_ticket;
DROP TYPE statut_event;
DROP TYPE statut_validation;
DROP TYPE role_utilisateur;
