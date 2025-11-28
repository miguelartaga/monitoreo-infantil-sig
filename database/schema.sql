-- Database bootstrap
-- CREATE DATABASE sig_monitoreo;
-- \c sig_monitoreo

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users (mother / child)
CREATE TABLE usuario (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(200) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('madre', 'nino')),
    push_subscriptions JSONB DEFAULT '[]'
);


-- Base tables
CREATE TABLE unidad_educativa (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    direccion VARCHAR(200),
    geom geometry(Polygon, 4326) NOT NULL
);

CREATE TABLE nino (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100),
    observaciones TEXT,
    unidad_id INTEGER REFERENCES unidad_educativa(id) ON DELETE SET NULL,
    madre_id INTEGER REFERENCES usuario(id) ON DELETE SET NULL
);

CREATE TABLE area_segura (
    id SERIAL PRIMARY KEY,
    nino_id INTEGER NOT NULL UNIQUE REFERENCES nino(id) ON DELETE CASCADE,
    madre_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    nombre VARCHAR(120),
    geom geometry(Polygon, 4326) NOT NULL,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE posicion_nino (
    id SERIAL PRIMARY KEY,
    nino_id INTEGER NOT NULL REFERENCES nino(id) ON DELETE CASCADE,
    posicion geometry(Point, 4326) NOT NULL,
    estado VARCHAR(20),
    fecha_hora TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Function that classifies each position as inside/outside
CREATE OR REPLACE FUNCTION registrar_posicion(
    _nino_id INTEGER,
    _lon DOUBLE PRECISION,
    _lat DOUBLE PRECISION
)
RETURNS TABLE (
    posicion_id INTEGER,
    estado VARCHAR(20),
    mensaje TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    fecha_hora TIMESTAMP
) AS $$
DECLARE
    punto geometry(Point, 4326);
    area geometry(Polygon, 4326);
    estado_txt VARCHAR(20);
    mensaje_txt TEXT;
BEGIN
    punto := ST_SetSRID(ST_MakePoint(_lon, _lat), 4326);

    -- Priority: mother-defined safe area
    SELECT geom
    INTO area
    FROM area_segura
    WHERE nino_id = _nino_id
    ORDER BY fecha_actualizacion DESC
    LIMIT 1;

    -- Fallback: default school polygon
    IF area IS NULL THEN
        SELECT ue.geom
        INTO area
        FROM nino ni
        JOIN unidad_educativa ue ON ue.id = ni.unidad_id
        WHERE ni.id = _nino_id;
    END IF;

    IF area IS NULL THEN
        RAISE EXCEPTION 'No safe area associated to child %', _nino_id;
    END IF;

    IF ST_Within(punto, area) THEN
        estado_txt := 'dentro';
        mensaje_txt := 'El nino esta dentro del area segura.';
    ELSE
        estado_txt := 'fuera';
        mensaje_txt := 'ALERTA: El nino esta fuera del area segura.';
    END IF;

    RETURN QUERY
    WITH inserted AS (
        INSERT INTO posicion_nino (nino_id, posicion, estado)
        VALUES (_nino_id, punto, estado_txt)
        RETURNING id, posicion, estado, fecha_hora
    )
    SELECT
        inserted.id AS posicion_id,
        inserted.estado,
        mensaje_txt AS mensaje,
        ST_Y(inserted.posicion::geometry) AS lat,
        ST_X(inserted.posicion::geometry) AS lon,
        inserted.fecha_hora
    FROM inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed data
INSERT INTO unidad_educativa (nombre, direccion, geom)
VALUES (
    'Unidad Educativa Central',
    'Av. Ejemplo 123',
    ST_GeomFromText(
        'POLYGON((-63.1829 -17.7834, -63.1822 -17.7834, -63.1822 -17.7827, -63.1829 -17.7827, -63.1829 -17.7834))',
        4326
    )
);

INSERT INTO usuario (nombre, email, password_hash, rol)
VALUES
  ('Madre de Juan', 'madre@gmail.com', '$2b$10$u48DY2un2qUBdgebctc6hOtH3SlLrwTX/A2h7ECumZSjptRfqDKgy', 'madre'),
  --('Madre de Juan', 'madre@gmail.com', '123456', 'madre'),
  --('Juanito', 'nino@gmail.com', '$2b$10$eQJhRko6SL.lrS1u63FQOu3NsjlArRW9wYlvjSz6Y55AkIFJAW0eO', 'nino');
  ('Juanito', 'nino@gmail.com', '$2b$10$eQJhRko6SL.lrS1u63FQOu3NsjlArRW9wYlvjSz6Y55AkIFJAW0eO', 'nino');

INSERT INTO nino (nombre, apellidos, observaciones, unidad_id, madre_id)
VALUES ('Juan', 'Perez', 'Alergias controladas', 1, 1);

INSERT INTO area_segura (nino_id, madre_id, nombre, geom)
VALUES (
    1,
    1,
    'Area inicial madre',
    ST_GeomFromText(
        'POLYGON((-63.1827 -17.7832, -63.1823 -17.7832, -63.1823 -17.7829, -63.1827 -17.7829, -63.1827 -17.7832))',
        4326
    )
);
