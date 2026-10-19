# Landing Page — Asesor de Creditos Mejoravit

Landing page para captura de leads (clientes potenciales) de un asesor de creditos Mejoravit.
Stack: Node.js + Express, PostgreSQL, HTML5 + Bootstrap 5 + Vanilla JS.

---

## Estructura del proyecto

```
mejoravit/
├── database/
│   └── schema.sql          Script SQL para crear la BD y la tabla leads
├── public/
│   ├── css/
│   │   └── style.css       Estilos personalizados (rojo, blanco, gris)
│   ├── js/
│   │   ├── admin.js        Logica del panel de administracion
│   │   └── script.js       Logica del formulario (Fetch API)
│   ├── admin.html          Panel de administracion de leads
│   ├── aviso-privacidad.html  Aviso de privacidad
│   └── index.html          Landing page completa
├── .env.example            Plantilla de variables de entorno
├── .gitignore              Archivos ignorados por Git
├── package.json            Dependencias y scripts npm
├── README.md               Este archivo
└── server.js               Servidor Express + endpoints API
```

---

## Requisitos previos

Asegurate de tener instalado lo siguiente antes de comenzar:

- Node.js v18 o superior — https://nodejs.org
- npm (viene incluido con Node.js)
- PostgreSQL v14 o superior — https://www.postgresql.org/download/

Verifica las versiones instaladas con:

```powershell
node --version
npm --version
psql --version
```

---

## Paso 1 — Configurar PostgreSQL

### 1.1 Abrir la consola de PostgreSQL

En Windows, abre el programa **SQL Shell (psql)** que se instala con PostgreSQL,
o desde PowerShell:

```powershell
psql -U postgres
```

### 1.2 Crear la base de datos

Dentro de psql ejecuta:

```sql
CREATE DATABASE mejoravit_db;
```

### 1.3 Conectarte a la base de datos

```sql
\c mejoravit_db
```

### 1.4 Crear la tabla leads

Copia y pega el contenido del archivo `database/schema.sql` en psql,
o ejecutalo directamente desde PowerShell:

```powershell
psql -U postgres -d mejoravit_db -f database/schema.sql
```

Deberas ver el mensaje `CREATE TABLE` si todo salio bien.

### 1.5 Verificar la tabla (opcional)

```sql
\d leads
```

---

## Paso 2 — Configurar las variables de entorno

### 2.1 Crear el archivo .env

En PowerShell, desde la raiz del proyecto:

```powershell
Copy-Item .env.example .env
```

### 2.2 Editar el archivo .env

Abre `.env` con cualquier editor de texto y rellena tus datos reales:

```
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=mejoravit_db
DB_USER=postgres
DB_PASSWORD=tu_password_de_postgres
```

Reemplaza `tu_password_de_postgres` con la contrasena que usas para conectarte a PostgreSQL.

Variables adicionales (ver `.env.example` para el detalle):

- `ADMIN_TOKEN`: clave para consultar la lista de leads. Sin ella, `GET /api/leads` queda desactivada.
- `SMTP_*` y `NOTIFY_EMAIL`: si las configuras, recibes un correo con cada lead nuevo.
- `TRUST_PROXY`: ponla en `1` si publicas el sitio detras de un proxy (Render, Railway, nginx).

---

## Paso 3 — Instalar dependencias de Node.js

Desde la raiz del proyecto en PowerShell:

```powershell
npm install
```

Esto descargara los paquetes: `express`, `pg`, `dotenv`, `express-rate-limit`, `nodemailer` y `nodemon`.

---

## Paso 4 — Iniciar el servidor

```powershell
node server.js
```

Si todo esta correcto veras en la consola:

```
Conexion a PostgreSQL establecida correctamente.
Servidor corriendo en http://localhost:3000
```

Abre tu navegador en **http://localhost:3000** para ver la landing page.

---

## Modo desarrollo (recarga automatica)

Si instalaste las dependencias de desarrollo, puedes usar nodemon para que el servidor
se reinicie automaticamente al guardar cambios:

```powershell
npm run dev
```

---

## Endpoints de la API

### POST /api/leads
Registra un nuevo lead en la base de datos.

**Body (JSON):**
```json
{
  "nombre":       "Maria Lopez",
  "telefono":     "5512345678",
  "acepta_privacidad": true
}
```

Limite: 5 envios por IP cada 15 minutos (despues responde 429).

**Respuesta exitosa (201):**
```json
{
  "ok": true,
  "mensaje": "Tu solicitud fue registrada. Te contactaremos pronto."
}
```

**Respuesta con error de validacion (400):**
```json
{
  "ok": false,
  "errores": ["El nombre debe tener al menos 2 caracteres."]
}
```

---

### GET /api/leads
Lista todos los leads registrados. Requiere el `ADMIN_TOKEN` de tu `.env`.

```powershell
# Desde PowerShell
Invoke-RestMethod -Uri http://localhost:3000/api/leads -Headers @{ Authorization = "Bearer TU_ADMIN_TOKEN" }
```

---

### DELETE /api/leads/:id
Borra un lead. Requiere el `ADMIN_TOKEN`.

---

## Panel de administracion

Abre **http://localhost:3000/admin** y escribe el `ADMIN_TOKEN` de tu `.env`.
Desde ahi puedes ver los leads, buscarlos, escribirles por WhatsApp y borrarlos.
Los registros con mas de 6 meses aparecen resaltados.

---

## Consultar leads directamente en PostgreSQL

```sql
-- Conectarte a la base de datos
\c mejoravit_db

-- Ver todos los leads
SELECT * FROM leads ORDER BY fecha_registro DESC;

-- Ver los leads de los ultimos 7 dias
SELECT * FROM leads WHERE fecha_registro > NOW() - INTERVAL '7 days';

-- Contar leads por dia
SELECT fecha_registro::date AS dia, COUNT(*) AS total
FROM leads
GROUP BY dia
ORDER BY dia DESC;
```

---

## Solucion de problemas frecuentes

**Error: connect ECONNREFUSED 127.0.0.1:5432**
PostgreSQL no esta corriendo. Abre el panel de servicios de Windows (services.msc)
y verifica que el servicio `postgresql-x64-XX` este iniciado, o ejecuta:
```powershell
Start-Service -Name "postgresql*"
```

**Error: password authentication failed for user "postgres"**
La contrasena en tu archivo `.env` no coincide. Verificala con:
```powershell
psql -U postgres -h localhost
```

**Error: database "mejoravit_db" does not exist**
No se creo la base de datos. Repite el Paso 1.2.

**El puerto 3000 esta en uso**
Cambia el valor de `PORT` en tu archivo `.env` (por ejemplo a `3001`)
y recarga el servidor.

---

## Notas de seguridad

- El archivo `.env` contiene contrasenas. Nunca lo subas a Git.
- El archivo `.gitignore` ya excluye `.env` y `node_modules/`.
- El formulario ya tiene limite de envios por IP y un campo trampa contra bots.
- `GET /api/leads` solo responde con el `ADMIN_TOKEN` correcto.
- Para produccion usa HTTPS (la mayoria de los hostings lo incluyen).
