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
    fecha_registro TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 3. Indice para busquedas rapidas por fecha
CREATE INDEX IF NOT EXISTS idx_leads_fecha ON leads (fecha_registro DESC);

-- ============================================================
-- Migraciones (solo si creaste la tabla con una version anterior)
-- ============================================================

-- 2026-10: Mejoravit es un solo producto, se quita el tipo de credito
ALTER TABLE leads DROP COLUMN IF EXISTS tipo_credito;
