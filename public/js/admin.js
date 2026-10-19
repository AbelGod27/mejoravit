'use strict';

// ----------------------------------------------------------------
// admin.js — Panel para ver y borrar leads
// La clave se guarda solo mientras la pestaña está abierta
// ----------------------------------------------------------------

document.addEventListener('DOMContentLoaded', function () {

  const CLAVE_STORAGE = 'mejoravit_admin_token';
  const SEIS_MESES_MS = 182 * 24 * 60 * 60 * 1000;

  const vistaLogin  = document.getElementById('vista-login');
  const vistaLeads  = document.getElementById('vista-leads');
  const formLogin   = document.getElementById('form-login');
  const inputToken  = document.getElementById('token');
  const loginError  = document.getElementById('login-error');
  const btnSalir    = document.getElementById('btn-salir');
  const btnRefrescar = document.getElementById('btn-actualizar');
  const inputBuscar = document.getElementById('buscar');
  const cuerpo      = document.getElementById('tabla-cuerpo');
  const total       = document.getElementById('total');
  const sinLeads    = document.getElementById('sin-leads');
  const errorLeads  = document.getElementById('error-leads');
  const avisoViejos = document.getElementById('aviso-viejos');
  const ultimaRevision = document.getElementById('ultima-revision');
  const btnAvisos   = document.getElementById('btn-avisos');

  const INTERVALO_MS    = 15 * 1000;
  const RESALTE_MS      = 60 * 1000;
  const TITULO_ORIGINAL = document.title;

  let leads = [];
  let idsConocidos = null;        // ids de la carga anterior; null = primera carga
  const idsResaltados = new Set();
  let pendientes = 0;             // leads nuevos que llegaron con la pestaña en segundo plano
  let temporizador = null;

  // ---- Clave en sessionStorage (puede no estar disponible) ----

  function leerToken() {
    try { return sessionStorage.getItem(CLAVE_STORAGE) || ''; } catch (e) { return ''; }
  }

  function guardarToken(valor) {
    try { sessionStorage.setItem(CLAVE_STORAGE, valor); } catch (e) { /* sin almacenamiento */ }
  }

  function borrarToken() {
    try { sessionStorage.removeItem(CLAVE_STORAGE); } catch (e) { /* sin almacenamiento */ }
  }

  let token = leerToken();

  // ---- Peticiones a la API ----

  async function api(metodo, ruta) {
    const respuesta = await fetch(ruta, {
      method:  metodo,
      headers: { Authorization: 'Bearer ' + token },
    });
    const datos = await respuesta.json().catch(() => ({}));
    return { status: respuesta.status, datos };
  }

  async function cargarLeads() {
    errorLeads.classList.add('d-none');

    try {
      const { status, datos } = await api('GET', '/api/leads');

      if (status === 401 || status === 404) {
        salir(status === 404
          ? 'El panel está desactivado: falta ADMIN_TOKEN en el archivo .env del servidor.'
          : 'Clave incorrecta.');
        return;
      }
      if (!datos.ok) throw new Error((datos.errores || []).join(' ') || 'HTTP ' + status);

      detectarNuevos(datos.leads);
      leads = datos.leads;
      mostrarPanel();
      pintarTabla();
      ultimaRevision.textContent = 'última revisión ' +
        new Date().toLocaleTimeString('es-MX', { timeStyle: 'short' });
    } catch (err) {
      console.error('Error al cargar leads:', err);
      errorLeads.textContent = 'No se pudieron cargar los leads. Revisa que el servidor esté encendido.';
      errorLeads.classList.remove('d-none');
    }
  }

  async function borrarLead(lead) {
    const confirmar = window.confirm(
      '¿Borrar a ' + lead.nombre + ' (' + lead.telefono + ')?\nEsta acción no se puede deshacer.'
    );
    if (!confirmar) return;

    const { status, datos } = await api('DELETE', '/api/leads/' + lead.id);
    if (status === 401) {
      salir('Tu sesión expiró. Vuelve a escribir la clave.');
      return;
    }
    if (!datos.ok && status !== 404) {
      window.alert('No se pudo borrar: ' + (datos.errores || []).join(' '));
      return;
    }

    leads = leads.filter((l) => l.id !== lead.id);
    pintarTabla();
  }

  // ---- Actualización automática ----

  function detectarNuevos(lista) {
    const idsActuales = new Set(lista.map((l) => l.id));

    if (idsConocidos) {
      const nuevos = lista.filter((l) => !idsConocidos.has(l.id));
      if (nuevos.length > 0) avisarNuevos(nuevos);
    }

    idsConocidos = idsActuales;
  }

  function avisarNuevos(nuevos) {
    nuevos.forEach((lead) => {
      idsResaltados.add(lead.id);
      setTimeout(() => {
        idsResaltados.delete(lead.id);
        pintarTabla();
      }, RESALTE_MS);
    });

    if (document.hidden) {
      pendientes += nuevos.length;
      document.title = '(' + pendientes + ') ' +
        (pendientes === 1 ? 'Nuevo lead' : 'Nuevos leads') + ' — ' + TITULO_ORIGINAL;
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      const texto = nuevos.length === 1
        ? nuevos[0].nombre + ' · ' + nuevos[0].telefono
        : nuevos.length + ' personas dejaron sus datos';
      new Notification('Nuevo lead Mejoravit', { body: texto });
    }
  }

  function iniciarRevision() {
    detenerRevision();
    temporizador = setInterval(cargarLeads, INTERVALO_MS);
  }

  function detenerRevision() {
    if (temporizador) clearInterval(temporizador);
    temporizador = null;
  }

  function actualizarBotonAvisos() {
    const disponible = 'Notification' in window && Notification.permission === 'default';
    btnAvisos.classList.toggle('d-none', !disponible);
  }

  // ---- Vista ----

  function mostrarPanel() {
    vistaLogin.classList.add('d-none');
    vistaLeads.classList.remove('d-none');
    btnSalir.classList.remove('d-none');
    actualizarBotonAvisos();
    if (!temporizador) iniciarRevision();
  }

  function salir(mensaje) {
    detenerRevision();
    idsConocidos = null;
    idsResaltados.clear();
    pendientes = 0;
    document.title = TITULO_ORIGINAL;
    token = '';
    borrarToken();
    leads = [];
    cuerpo.replaceChildren();
    vistaLeads.classList.add('d-none');
    btnSalir.classList.add('d-none');
    vistaLogin.classList.remove('d-none');
    loginError.textContent = mensaje || '';
    inputToken.value = '';
    inputToken.focus();
  }

  function enlaceWhatsApp(telefono) {
    let digitos = telefono.replace(/\D/g, '');
    if (digitos.length === 10) digitos = '52' + digitos; // número de México sin lada de país
    return 'https://wa.me/' + digitos;
  }

  function formatearFecha(iso) {
    return new Date(iso).toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  // Se usa textContent en todo lo que viene de los visitantes para evitar inyección de HTML
  function pintarTabla() {
    const filtro = inputBuscar.value.trim().toLowerCase();
    const visibles = leads.filter((l) =>
      !filtro ||
      l.nombre.toLowerCase().includes(filtro) ||
      l.telefono.replace(/\D/g, '').includes(filtro.replace(/\D/g, '') || '\u0000')
    );

    total.textContent = '(' + leads.length + ')';
    sinLeads.classList.toggle('d-none', leads.length > 0);

    let hayViejos = false;
    const filas = visibles.map((lead) => {
      const tr = document.createElement('tr');
      if (idsResaltados.has(lead.id)) {
        tr.classList.add('lead-nuevo');
      } else if (Date.now() - new Date(lead.fecha_registro).getTime() > SEIS_MESES_MS) {
        tr.classList.add('lead-viejo');
        hayViejos = true;
      }

      const tdFecha = document.createElement('td');
      tdFecha.className = 'small text-nowrap';
      tdFecha.textContent = formatearFecha(lead.fecha_registro);

      const tdNombre = document.createElement('td');
      tdNombre.className = 'fw-semibold';
      tdNombre.textContent = lead.nombre;

      const tdTelefono = document.createElement('td');
      tdTelefono.className = 'text-nowrap';
      tdTelefono.textContent = lead.telefono;

      const tdAcciones = document.createElement('td');
      tdAcciones.className = 'text-end text-nowrap';

      const btnWa = document.createElement('a');
      btnWa.className = 'btn btn-sm btn-success me-2';
      btnWa.href = enlaceWhatsApp(lead.telefono);
      btnWa.target = '_blank';
      btnWa.rel = 'noopener';
      btnWa.textContent = 'WhatsApp';

      const btnBorrar = document.createElement('button');
      btnBorrar.type = 'button';
      btnBorrar.className = 'btn btn-sm btn-outline-danger';
      btnBorrar.textContent = 'Borrar';
      btnBorrar.addEventListener('click', () => borrarLead(lead));

      tdAcciones.append(btnWa, btnBorrar);
      tr.append(tdFecha, tdNombre, tdTelefono, tdAcciones);
      return tr;
    });

    cuerpo.replaceChildren(...filas);
    avisoViejos.classList.toggle('d-none', !hayViejos);
  }

  // ---- Eventos ----

  formLogin.addEventListener('submit', function (e) {
    e.preventDefault();
    token = inputToken.value.trim();
    if (!token) return;
    guardarToken(token);
    loginError.textContent = '';
    cargarLeads();
  });

  btnSalir.addEventListener('click', () => salir());
  btnRefrescar.addEventListener('click', cargarLeads);
  inputBuscar.addEventListener('input', pintarTabla);

  btnAvisos.addEventListener('click', async function () {
    await Notification.requestPermission();
    actualizarBotonAvisos();
  });

  // Al volver a la pestaña se limpia el contador del título
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      pendientes = 0;
      document.title = TITULO_ORIGINAL;
    }
  });

  // Si ya había una sesión abierta en esta pestaña, entrar directo
  if (token) cargarLeads();
  else inputToken.focus();

});
