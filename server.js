'use strict';

require('dotenv').config();

const express    = require('express');
const { Pool }   = require('pg');
const rateLimit  = require('express-rate-limit');
const nodemailer = require('nodemailer');
const crypto     = require('crypto');
const path       = require('path');

// ---------------------------------------------------------------
// Configuracion de la aplicacion
// ---------------------------------------------------------------
const app  = express();
const PORT = process.env.PORT || 3000;

// Necesario si el sitio corre detras de un proxy (Render, Railway, nginx...)
// para que el limite de envios use la IP real del visitante.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', parseInt(process.env.TRUST_PROXY, 10) || 1);
}

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
// Aviso por correo de nuevos leads (opcional, se activa con SMTP_*)
// ---------------------------------------------------------------
const transporter = process.env.SMTP_HOST && process.env.NOTIFY_EMAIL
  ? nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || '465', 10),
      secure: (process.env.SMTP_PORT || '465') === '465',
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    })
  : null;

if (!transporter) {
  console.warn('Aviso por correo desactivado: configura SMTP_HOST y NOTIFY_EMAIL en .env.');
}

function notificarLead(lead) {
  if (!transporter) return;

  transporter.sendMail({
    from:    process.env.SMTP_FROM || process.env.SMTP_USER,
    to:      process.env.NOTIFY_EMAIL,
    subject: `Nuevo lead Mejoravit: ${lead.nombre}`,
    text:
      `Nombre: ${lead.nombre}\n` +
      `Teléfono: ${lead.telefono}\n` +
      `Fecha: ${new Date(lead.fecha_registro).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`,
  }).catch((error) => {
    console.error('Error al enviar aviso por correo:', error.message);
  });
}

// ---------------------------------------------------------------
// Middlewares
// ---------------------------------------------------------------
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Servir archivos estaticos desde /public
app.use(express.static(path.join(__dirname, 'public')));

// Maximo 5 envios del formulario por IP cada 15 minutos
const limiteLeads = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, errores: ['Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'] },
});

// Protege rutas internas con el token ADMIN_TOKEN (cabecera Authorization: Bearer <token>)
function requiereAdmin(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    return res.status(404).json({ ok: false, errores: ['Ruta no encontrada.'] });
  }

  const recibido = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = crypto.createHash('sha256').update(recibido).digest();
  const b = crypto.createHash('sha256').update(token).digest();
  if (!crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ ok: false, errores: ['No autorizado.'] });
  }

  next();
}

// ---------------------------------------------------------------
// Validaciones
// ---------------------------------------------------------------
function validarLead(body) {
  const errores = [];

  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  if (nombre.length < 2 || nombre.length > 150) {
    errores.push('El nombre debe tener entre 2 y 150 caracteres.');
  }

  const telefono = typeof body.telefono === 'string' ? body.telefono.trim() : '';
  const telefonoLimpio = telefono.replace(/\D/g, '');
  if (telefonoLimpio.length < 10 || telefonoLimpio.length > 15 || telefono.length > 20) {
    errores.push('El teléfono debe tener entre 10 y 15 dígitos.');
  }

  if (body.acepta_privacidad !== true && body.acepta_privacidad !== 'on') {
    errores.push('Debes aceptar el aviso de privacidad.');
  }

  return errores;
}

// ---------------------------------------------------------------
// Rutas de API
// ---------------------------------------------------------------

// POST /api/leads  — Guardar nuevo lead
app.post('/api/leads', limiteLeads, async (req, res) => {
  // Campo trampa: las personas no lo ven, los bots lo llenan.
  // Se responde como si todo fuera bien para no darle pistas al bot.
  if (req.body.sitio_web) {
    return res.status(201).json({ ok: true, mensaje: 'Tu solicitud fue registrada. Te contactaremos pronto.' });
  }

  const errores = validarLead(req.body);

  if (errores.length > 0) {
    return res.status(400).json({ ok: false, errores });
  }

  const nombre       = req.body.nombre.trim();
  const telefono     = req.body.telefono.trim();

  try {
    const resultado = await pool.query(
      `INSERT INTO leads (nombre, telefono)
       VALUES ($1, $2)
       RETURNING id, nombre, telefono, fecha_registro`,
      [nombre, telefono]
    );

    const lead = resultado.rows[0];
    console.log(`Nuevo lead registrado — id: ${lead.id}`);
    notificarLead(lead);

    return res.status(201).json({
      ok: true,
      mensaje: 'Tu solicitud fue registrada. Te contactaremos pronto.',
    });
  } catch (error) {
    console.error('Error al guardar lead:', error.message);
    return res.status(500).json({
      ok: false,
      errores: ['Ocurrió un error en el servidor. Inténtalo de nuevo más tarde.'],
    });
  }
});

// GET /api/leads  — Listar leads (solo administrador, requiere ADMIN_TOKEN)
app.get('/api/leads', requiereAdmin, async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id, nombre, telefono, fecha_registro FROM leads ORDER BY fecha_registro DESC'
    );
    return res.json({ ok: true, total: resultado.rowCount, leads: resultado.rows });
  } catch (error) {
    console.error('Error al obtener leads:', error.message);
    return res.status(500).json({ ok: false, errores: ['Error interno del servidor.'] });
  }
});

// DELETE /api/leads/:id  — Borrar un lead (solo administrador)
app.delete('/api/leads/:id', requiereAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ ok: false, errores: ['Id no válido.'] });
  }

  try {
    const resultado = await pool.query('DELETE FROM leads WHERE id = $1', [id]);
    if (resultado.rowCount === 0) {
      return res.status(404).json({ ok: false, errores: ['El lead no existe.'] });
    }
    console.log(`Lead borrado — id: ${id}`);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Error al borrar lead:', error.message);
    return res.status(500).json({ ok: false, errores: ['Error interno del servidor.'] });
  }
});

// Rutas de API inexistentes devuelven 404 en JSON
app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, errores: ['Ruta no encontrada.'] });
});

// Panel de administración
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Cualquier otra ruta sirve el index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Errores no controlados (por ejemplo, JSON mal formado o demasiado grande)
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('Error no controlado:', err.message);
  res.status(status).json({
    ok: false,
    errores: [status >= 500 ? 'Error interno del servidor.' : 'Solicitud no válida.'],
  });
});

// ---------------------------------------------------------------
// Iniciar servidor
// ---------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
