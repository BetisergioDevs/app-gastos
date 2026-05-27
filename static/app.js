// ── Categorías por tipo ────────────────────────────────
const CATEGORIAS = {
  ingreso: ['Salario', 'Freelance', 'Inversiones', 'Regalo', 'Otro'],
  gasto:   ['Comida', 'Transporte', 'Ocio', 'Salud', 'Ropa', 'Hogar', 'Suscripciones', 'Otro']
};

let tipoActual = 'ingreso';
let filtroActual = 'todas';
let transacciones = [];

// ── Inicialización ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Fecha de hoy
  const hoy = new Date().toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  document.getElementById('fechaHoy').textContent = hoy.charAt(0).toUpperCase() + hoy.slice(1);

  setTipo('ingreso');
  cargarDatos();
});

// ── Tipo (ingreso / gasto) ─────────────────────────────
function setTipo(tipo) {
  tipoActual = tipo;
  document.getElementById('btnIngreso').classList.toggle('active', tipo === 'ingreso');
  document.getElementById('btnGasto').classList.toggle('active',   tipo === 'gasto');

  const select = document.getElementById('categoria');
  select.innerHTML = '<option value="">Selecciona...</option>';
  CATEGORIAS[tipo].forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.toLowerCase();
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

// ── Cargar datos desde API ─────────────────────────────
async function cargarDatos() {
  try {
    const [transRes, resumenRes] = await Promise.all([
      fetch('/api/transacciones'),
      fetch('/api/resumen')
    ]);
    transacciones = await transRes.json();
    const resumen = await resumenRes.json();
    actualizarResumen(resumen);
    renderLista();
  } catch (err) {
    console.error('Error cargando datos:', err);
  }
}

// ── Actualizar tarjetas de resumen ─────────────────────
function actualizarResumen(resumen) {
  document.getElementById('totalIngresos').textContent = formatEur(resumen.total_ingresos);
  document.getElementById('totalGastos').textContent   = formatEur(resumen.total_gastos);
  const balanceEl = document.getElementById('balance');
  balanceEl.textContent = formatEur(resumen.balance);
  balanceEl.style.color = resumen.balance >= 0 ? 'var(--green)' : 'var(--red)';
}

// ── Render lista ───────────────────────────────────────
function renderLista() {
  const lista = document.getElementById('lista');
  const empty = document.getElementById('empty');

  const filtradas = filtroActual === 'todas'
    ? transacciones
    : transacciones.filter(t => t.tipo === filtroActual);

  lista.innerHTML = '';

  if (filtradas.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  filtradas.forEach(t => {
    const li = document.createElement('li');
    li.className = 'item';
    li.innerHTML = `
      <div class="item-left">
        <span class="item-cat">${t.tipo} · ${t.categoria}</span>
        <span class="item-desc">${t.descripcion || t.categoria}</span>
        <span class="item-fecha">${t.fecha}</span>
      </div>
      <div class="item-right">
        <span class="item-amount ${t.tipo}">
          ${t.tipo === 'ingreso' ? '+' : '-'}${formatEur(t.cantidad)}
        </span>
        <button class="btn-delete" onclick="eliminar(${t.id})" title="Eliminar">✕</button>
      </div>
    `;
    lista.appendChild(li);
  });
}

// ── Añadir transacción ─────────────────────────────────
async function agregarTransaccion() {
  const categoria   = document.getElementById('categoria').value;
  const cantidad    = parseFloat(document.getElementById('cantidad').value);
  const descripcion = document.getElementById('descripcion').value.trim();

  if (!categoria) return alert('Selecciona una categoría');
  if (!cantidad || cantidad <= 0) return alert('Introduce una cantidad válida');

  try {
    const res = await fetch('/api/transacciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: tipoActual, categoria, descripcion, cantidad })
    });
    if (!res.ok) throw new Error('Error al guardar');

    // Limpiar form
    document.getElementById('categoria').value   = '';
    document.getElementById('cantidad').value    = '';
    document.getElementById('descripcion').value = '';

    cargarDatos();
  } catch (err) {
    alert('Error al guardar la transacción');
  }
}

// ── Eliminar transacción ───────────────────────────────
async function eliminar(id) {
  if (!confirm('¿Eliminar esta transacción?')) return;
  try {
    await fetch(`/api/transacciones/${id}`, { method: 'DELETE' });
    cargarDatos();
  } catch (err) {
    alert('Error al eliminar');
  }
}

// ── Filtrar ────────────────────────────────────────────
function filtrar(tipo, btn) {
  filtroActual = tipo;
  document.querySelectorAll('.filtro').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderLista();
}

// ── Utilidades ─────────────────────────────────────────
function formatEur(n) {
  return Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}