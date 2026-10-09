'use strict';

require('dotenv').config();

const express = require('express');
const { Pool }  = require('pg');
const cors      = require('cors');
const path      = require('path');

// ---------------------------------------------------------------
// Configuracion de la aplicacion
// ---------------------------------------------------------------
const app  = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------
// Conexión a PostgreSQL
// ---------------------------------------------------------------
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME     || 'mejoravit_db',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

// Verificar conexión al arrancar
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error al conectar con PostgreSQL:', err.message);
  } else {
    console.log('Conexión a PostgreSQL establecida correctamente.');
    release();
  }
});

// ---------------------------------------------------------------
// Middlewares
// ---------------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estaticos desde /public
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------
// Validaciones
// ---------------------------------------------------------------
const TIPOS_VALIDOS = ['Repara', 'Renueva'];

function validarLead(body) {
  const errores = [];

  if (!body.nombre || typeof body.nombre !== 'string' || body.nombre.trim().length < 2) {
    errores.push('El nombre debe tener al menos 2 caracteres.');
  }

  const telefonoLimpio = (body.telefono || '').replace(/\D/g, '');
  if (telefonoLimpio.length < 10 || telefonoLimpio.length > 15) {
    errores.push('El teléfono debe tener entre 10 y 15 dígitos.');
  }

  if (!TIPOS_VALIDOS.includes(body.tipo_credito)) {
    errores.push('El tipo de crédito debe ser "Repara" o "Renueva".');
  }

  return errores;
}

// ---------------------------------------------------------------
// Rutas de API
// ---------------------------------------------------------------

// POST /api/leads  — Guardar nuevo lead
app.post('/api/leads', async (req, res) => {
  const errores = validarLead(req.body);

  if (errores.length > 0) {
    return res.status(400).json({ ok: false, errores });
  }

  const nombre       = req.body.nombre.trim();
  const telefono     = req.body.telefono.trim();
  const tipo_credito = req.body.tipo_credito;

  try {
    const resultado = await pool.query(
      `INSERT INTO leads (nombre, telefono, tipo_credito)
       VALUES ($1, $2, $3)
       RETURNING id, nombre, telefono, tipo_credito, fecha_registro`,
      [nombre, telefono, tipo_credito]
    );

    const lead = resultado.rows[0];
    console.log(`Nuevo lead registrado — id: ${lead.id}, nombre: ${lead.nombre}, tipo: ${lead.tipo_credito}`);

    return res.status(201).json({
      ok: true,
      mensaje: 'Tu solicitud fue registrada. Te contactaremos pronto.',
      lead,
    });
  } catch (error) {
    console.error('Error al guardar lead:', error.message);
    return res.status(500).json({
      ok: false,
      errores: ['Ocurrió un error en el servidor. Inténtalo de nuevo más tarde.'],
    });
  }
});

// GET /api/leads  — Listar leads (uso interno / admin)
app.get('/api/leads', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id, nombre, telefono, tipo_credito, fecha_registro FROM leads ORDER BY fecha_registro DESC'
    );
    return res.json({ ok: true, total: resultado.rowCount, leads: resultado.rows });
  } catch (error) {
    console.error('Error al obtener leads:', error.message);
    return res.status(500).json({ ok: false, errores: ['Error interno del servidor.'] });
  }
});

// Cualquier otra ruta sirve el index.html (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------------------------------------------------
// Iniciar servidor
// ---------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
