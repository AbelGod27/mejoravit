-- ============================================================
-- Script de base de datos para Landing Page Mejoravit
-- ============================================================

-- 1. Crear la base de datos (ejecutar como superusuario en psql)
-- CREATE DATABASE mejoravit_db;
-- \c mejoravit_db

-- 2. Crear la tabla de leads
CREATE TABLE IF NOT EXISTS leads (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(150)    NOT NULL,
    telefono    VARCHAR(20)     NOT NULL,
    tipo_credito VARCHAR(50)    NOT NULL CHECK (tipo_credito IN ('Repara', 'Renueva')),
    fecha_registro TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 3. Indice para busquedas rapidas por fecha
CREATE INDEX IF NOT EXISTS idx_leads_fecha ON leads (fecha_registro DESC);
