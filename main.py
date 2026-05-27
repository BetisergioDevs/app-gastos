from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import sqlite3
import os

app = FastAPI()

# ── Base de datos ──────────────────────────────────────
DB_PATH = "gastos.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS transacciones (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo      TEXT    NOT NULL,  -- 'ingreso' o 'gasto'
            categoria TEXT    NOT NULL,
            descripcion TEXT,
            cantidad  REAL    NOT NULL,
            fecha     TEXT    NOT NULL DEFAULT (DATE('now'))
        )
    """)
    conn.commit()
    conn.close()

init_db()

# ── Modelos ────────────────────────────────────────────
class Transaccion(BaseModel):
    tipo: str          # 'ingreso' o 'gasto'
    categoria: str
    descripcion: Optional[str] = ""
    cantidad: float
    fecha: Optional[str] = None

# ── Rutas API ──────────────────────────────────────────

@app.get("/api/transacciones")
def get_transacciones():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM transacciones ORDER BY fecha DESC, id DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/transacciones")
def crear_transaccion(t: Transaccion):
    if t.tipo not in ("ingreso", "gasto"):
        raise HTTPException(400, "tipo debe ser 'ingreso' o 'gasto'")
    if t.cantidad <= 0:
        raise HTTPException(400, "la cantidad debe ser mayor que 0")

    conn = get_db()
    fecha = t.fecha or "date('now')"
    cur = conn.execute(
        """INSERT INTO transacciones (tipo, categoria, descripcion, cantidad, fecha)
           VALUES (?, ?, ?, ?, DATE('now'))""",
        (t.tipo, t.categoria, t.descripcion, t.cantidad)
    )
    conn.commit()
    nuevo_id = cur.lastrowid
    row = conn.execute("SELECT * FROM transacciones WHERE id=?", (nuevo_id,)).fetchone()
    conn.close()
    return dict(row)


@app.delete("/api/transacciones/{id}")
def eliminar_transaccion(id: int):
    conn = get_db()
    exists = conn.execute("SELECT id FROM transacciones WHERE id=?", (id,)).fetchone()
    if not exists:
        raise HTTPException(404, "Transacción no encontrada")
    conn.execute("DELETE FROM transacciones WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/resumen")
def get_resumen():
    conn = get_db()
    rows = conn.execute("SELECT tipo, categoria, SUM(cantidad) as total FROM transacciones GROUP BY tipo, categoria").fetchall()
    total_ingresos = conn.execute("SELECT COALESCE(SUM(cantidad),0) FROM transacciones WHERE tipo='ingreso'").fetchone()[0]
    total_gastos   = conn.execute("SELECT COALESCE(SUM(cantidad),0) FROM transacciones WHERE tipo='gasto'").fetchone()[0]
    conn.close()
    return {
        "total_ingresos": total_ingresos,
        "total_gastos": total_gastos,
        "balance": total_ingresos - total_gastos,
        "por_categoria": [dict(r) for r in rows]
    }


# ── Servir frontend ────────────────────────────────────
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def index():
    return FileResponse("static/index.html")