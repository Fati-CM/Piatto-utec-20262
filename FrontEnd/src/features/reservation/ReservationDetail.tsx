import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createHold, HoldError } from '../../services/holds';
import type { Hold } from '../../services/holds';
import type { Menu } from '../../services/menus';

type Attempt = {
  menuOptionId: string;
  idempotencyKey: string;
};

export default function ReservationDetail({
  menu,
  date,
  userId,
  canReserve,
}: {
  menu: Menu;
  date: string;
  userId?: string;
  canReserve: boolean;
}) {
  const storageKey = `piatto-hold:${userId ?? 'guest'}:${date}:${menu.id}`;
  const [selected, setSelected] = useState(
    menu.options.length === 1 ? menu.options[0].id : '',
  );
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [hold, setHold] = useState<Hold | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectionError, setSelectionError] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const deadline = useRef(0);
  const submitting = useRef(false);

  useEffect(() => {
    if (!userId || !canReserve) return;

    let active = true;
    let saved: Attempt | null = null;

    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) saved = JSON.parse(raw);
    } catch {
      setError('No pudimos recuperar el intento de reserva.');
    }

    if (
      !saved ||
      typeof saved.idempotencyKey !== 'string' ||
      !menu.options.some(option => option.id === saved?.menuOptionId)
    ) {
      return;
    }

    const restored = saved;
    setSelected(restored.menuOptionId);
    setAttempt(restored);
    setBusy(true);
    submitting.current = true;
    const started = performance.now();

    createHold({
      ...restored,
      serviceDate: date,
      menuId: menu.id,
    })
      .then(result => {
        if (!active) return;
        applyHold(result, started);
      })
      .catch(err => {
        if (!active) return;
        handleError(err);
      })
      .finally(() => {
        if (!active) return;
        setBusy(false);
        submitting.current = false;
      });

    return () => { active = false; };
  }, [storageKey, userId, canReserve]);

  useEffect(() => {
    if (!hold) return;

    const tick = () => {
      setRemaining(Math.max(
        0,
        Math.ceil((deadline.current - performance.now()) / 1000),
      ));
    };

    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [hold]);

  function applyHold(result: Hold, started: number) {
    const duration = Math.max(
      0,
      Date.parse(result.expiresAt) - Date.parse(result.serverTime)
        - (performance.now() - started),
    );

    deadline.current = performance.now() + duration;
    setRemaining(Math.ceil(duration / 1000));
    setHold(result);
    setError('');
  }

  function handleError(err: unknown) {
    setError(err instanceof Error ? err.message : 'No pudimos reservar.');

    if (
      err instanceof HoldError &&
      ['HOLD_NOT_ACTIVE', 'SOLD_OUT', 'MENU_NOT_FOUND',
       'PAST_DATE', 'RESERVATION_CONFLICT'].includes(err.code)
    ) {
      sessionStorage.removeItem(storageKey);
      setAttempt(null);
    }
  }

  async function reserve() {
    if (submitting.current || hold || !canReserve) return;

    if (!selected) {
      setSelectionError(true);
      return;
    }

    submitting.current = true;
    setBusy(true);
    setError('');

    try {
      const current = attempt ?? {
        menuOptionId: selected,
        idempotencyKey: crypto.randomUUID(),
      };

      // Guardar antes de solicitar: un reintento usará la misma clave.
      sessionStorage.setItem(storageKey, JSON.stringify(current));
      setAttempt(current);

      const started = performance.now();
      const result = await createHold({
        ...current,
        serviceDate: date,
        menuId: menu.id,
      });

      applyHold(result, started);
    } catch (err) {
      handleError(err);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const expired = Boolean(hold) && remaining === 0;
  const locked = busy || Boolean(hold) || Boolean(attempt);
  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');

  return (
    <main className="container" style={{ padding: '28px 0' }}>
      <Link to="/">← Volver al menú</Link>
      <h1 style={{ color: '#178000' }}>Menú {menu.category}</h1>
      <h2 style={{ color: '#2563eb' }}>S/ {menu.price.toFixed(2)}</h2>

      <div className="grid" role="group" aria-label="Opciones del menú">
        {menu.options.map(option => (
          <button
            type="button"
            className="card"
            key={option.id}
            aria-pressed={selected === option.id}
            aria-describedby={selectionError ? 'selection-error' : undefined}
            disabled={!canReserve || locked || option.stock <= 0}
            onClick={() => {
              setSelected(option.id);
              setSelectionError(false);
              setError('');
            }}
            style={{
              textAlign: 'left',
              font: 'inherit',
              border: `2px solid ${
                selectionError ? '#8d1f28'
                  : selected === option.id ? '#178000' : '#dce3d9'
              }`,
              background: selected === option.id ? '#f0f8ed' : '#fff',
            }}
          >
            <h3>{option.name}</h3>
            <p>{option.description}</p>
            <small>
              {option.stock > 0 ? 'Disponible al cargar el menú' : 'Agotado'}
            </small>
            {selected === option.id && <p>✓ Seleccionado</p>}
          </button>
        ))}
      </div>

      {!userId ? (
        <p><Link to="/acceso">Inicia sesión para continuar</Link></p>
      ) : !canReserve ? (
        <p role="alert">Tu cuenta todavía no tiene permisos para reservar.</p>
      ) : (
        <>
          {selectionError && (
            <p id="selection-error" role="alert" style={{ color: '#8d1f28' }}>
              Selecciona 1 o 2
            </p>
          )}

          {error && <p role="alert" style={{ color: '#8d1f28' }}>{error}</p>}

          {!hold && (
            <button
              className={`btn ${selected ? 'btn-primary' : 'btn-disabled'}`}
              style={{ marginTop: 20 }}
              disabled={busy}
              aria-disabled={!selected || busy}
              onClick={reserve}
            >
              {busy ? 'Validando reserva...' : attempt ? 'Reintentar reserva' : 'Separar menú'}
            </button>
          )}

          {hold && !expired && (
            <div role="status" style={{
              marginTop: 24, padding: 16,
              background: '#fff1e8', color: '#883b00', borderRadius: 12,
              display: 'flex', justifyContent: 'space-between', gap: 16,
            }}>
              <strong>Tu menú está asegurado</strong>
              <span aria-label={`Tiempo restante ${minutes} minutos ${seconds} segundos`}>
                ⏱ {minutes}:{seconds}
              </span>
            </div>
          )}

          {expired && (
            <p role="status">
              Tu reserva temporal terminó. Verifica nuevamente la disponibilidad.
            </p>
          )}

          {hold && !expired && (
            <p>La selección de horario será el siguiente paso.</p>
          )}

          {(expired || (error && !attempt)) && (
            <button className="btn btn-secondary" style={{ marginTop: 16 }}
              onClick={() => {
                sessionStorage.removeItem(storageKey);
                window.location.reload();
              }}>
              Actualizar disponibilidad
            </button>
          )}
        </>
      )}
    </main>
  );
}
