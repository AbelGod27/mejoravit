'use strict';

// ----------------------------------------------------------------
// script.js — Lógica del formulario de captura de leads
// ----------------------------------------------------------------

document.addEventListener('DOMContentLoaded', function () {

  const form       = document.getElementById('form-lead');
  const btnSubmit  = document.getElementById('btn-submit');
  const mensaje    = document.getElementById('form-mensaje');

  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    // Limpiar estado previo
    ocultarMensaje();
    form.classList.remove('was-validated');

    // Validación nativa de Bootstrap
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    // Validación extra: teléfono solo dígitos, espacios y guiones
    const telefonoInput = document.getElementById('telefono');
    const telefonoLimpio = telefonoInput.value.replace(/\D/g, '');
    if (telefonoLimpio.length < 10) {
      mostrarMensaje('error', 'Ingresa un número de teléfono válido (mínimo 10 dígitos).');
      telefonoInput.focus();
      return;
    }

    // Deshabilitar botón y mostrar carga
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Enviando...';

    const payload = {
      nombre:       document.getElementById('nombre').value.trim(),
      telefono:     telefonoInput.value.trim(),
      tipo_credito: document.getElementById('tipo_credito').value,
    };

    try {
      const respuesta = await fetch('/api/leads', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      const datos = await respuesta.json();

      if (respuesta.ok && datos.ok) {
        // Éxito
        mostrarMensaje('exito', datos.mensaje || 'Tu solicitud fue registrada. Te contactaremos pronto.');
        form.reset();
        form.classList.remove('was-validated');

        // Desplazar suavemente al mensaje
        mensaje.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        // Error del servidor con mensaje específico
        const textoError = datos.errores
          ? datos.errores.join(' ')
          : 'No se pudo registrar tu solicitud. Inténtalo de nuevo.';
        mostrarMensaje('error', textoError);
      }
    } catch (err) {
      // Error de red o servidor no disponible
      console.error('Error de red:', err);
      mostrarMensaje('error', 'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.');
    } finally {
      // Restaurar botón siempre
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Precalifícate gratis';
    }
  });

  // ---- Funciones auxiliares ----

  function mostrarMensaje(tipo, texto) {
    mensaje.textContent = texto;
    mensaje.className   = '';           // limpiar clases anteriores
    mensaje.classList.add(tipo);        // 'exito' o 'error'
    mensaje.setAttribute('role', 'alert');
  }

  function ocultarMensaje() {
    mensaje.textContent = '';
    mensaje.className   = '';
    mensaje.removeAttribute('role');
  }

});
