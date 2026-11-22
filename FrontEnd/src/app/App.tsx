import ReservationDetail from '../features/reservation/ReservationDetail';
import { BrowserRouter, Routes, Route, Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getMenus } from '../services/menus';
import type { Menu } from '../services/menus';
import AuthPage from '../features/auth/AuthPage';
import { readCurrentAccount, logoutUser } from '../services/auth';

type Account = Awaited<ReturnType<typeof readCurrentAccount>>;

function Header({
  account,
  checking,
  onLogout,
}: {
  account: Account | null;
  checking: boolean;
  onLogout: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function leave() {
    setBusy(true);
    setError('');

    try {
      await onLogout();
    } catch {
      setError('No pudimos cerrar la sesión. Intenta nuevamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <header style={{ background: '#178000', color: '#fff', padding: '16px 0' }}>
      <div className="container" style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: 12,
      }}>
        <Link to="/" style={{ fontWeight: 900, fontSize: 30 }}>Piatto</Link>

        <nav aria-label="Cuenta" style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12,
        }}>
          {checking ? (
            <span role="status">Revisando sesión...</span>
          ) : account ? (
            <>
              <span>
                Hola, {account.firstName || 'Usuario'}
                {account.role === 'staff' && ' · Staff'}
              </span>
              {account.role === 'pending' && (
                <span>Permisos pendientes de asignación</span>
              )}
              <button className="btn btn-secondary" disabled={busy}
                onClick={leave}>
                {busy ? 'Cerrando...' : 'Cerrar sesión'}
              </button>
            </>
          ) : (
            <Link className="btn btn-secondary" to="/acceso">
              Iniciar sesión / Registrarse
            </Link>
          )}
          {error && <span role="alert">{error}</span>}
        </nav>
      </div>
    </header>
  );
}

function MenuPage({ menus, date }: { menus: Menu[]; date: string }) {
  const formattedDate = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'full',
    timeZone: 'America/Lima',
  }).format(new Date(`${date}T12:00:00-05:00`));

  return (
    <main className="container" style={{ padding: '28px 0' }}>
      <h1 style={{ color: '#178000' }}>Menú del día</h1>
      <p>{formattedDate}</p>
      <p>Menús de demostración consultados desde AWS.</p>

      {menus.length === 0 ? (
        <p>No hay menús publicados para esta fecha.</p>
      ) : (
        <div className="grid">
          {menus.map(menu => (
            <article className="card" key={menu.id}>
              <div style={{
                height: 110,
                background: '#eef1ed',
                borderRadius: 12,
                display: 'grid',
                placeItems: 'center',
              }}>
                Foto del plato
              </div>
              <p style={{ color: '#178000' }}>{menu.category}</p>
              <h2 style={{ color: '#2563eb' }}>
                S/ {menu.price.toFixed(2)}
              </h2>
              <p>{menu.description}</p>
              <small>{menu.availability}</small>
              <div style={{ marginTop: 12 }}>
                <Link className="btn btn-secondary" to={`/menu/${menu.id}`}>
                  Ver detalle
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

function MenuDetail({
  menus, date, account,
}: {
  menus: Menu[];
  date: string;
  account: Account | null;
}) {
  const { id } = useParams();
  const menu = menus.find(item => item.id === id);

  if (!menu) {
    return (
      <main className="container" style={{ padding: '28px 0' }}>
        <h1>Menú no encontrado</h1>
        <Link to="/">Volver al menú</Link>
      </main>
    );
  }

  return (
    <ReservationDetail
      key={`${account?.userId ?? 'guest'}:${date}:${menu.id}`}
      menu={menu}
      date={date}
      userId={account?.userId}
      canReserve={account?.role === 'customer' || account?.role === 'staff'}
    />
  );
}

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState('');

  async function refreshAccount() {
    const current = await readCurrentAccount();
    setAccount(current);
    setSessionError('');
  }

  async function closeSession() {
    await logoutUser();
    setAccount(null);
    setSessionError('');
  }

  useEffect(() => {
    let active = true;

    readCurrentAccount()
      .then(current => {
        if (active) setAccount(current);
      })
      .catch(error => {
        if (!active) return;

        if (error?.name !== 'UserUnAuthenticatedException') {
          setSessionError('No pudimos recuperar la sesión. Intenta iniciar sesión.');
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => { active = false; };
  }, []);

  const [menus, setMenus] = useState<Menu[]>([]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError('');

    getMenus(controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setMenus(result.menus);
        setDate(result.date);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setError('No pudimos cargar el menú. Intenta nuevamente.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [attempt]);

  const menuContent = loading ? (
    <main className="container" style={{ padding: '28px 0' }}>
      <p role="status">Cargando menú...</p>
    </main>
  ) : error ? (
    <main className="container" style={{ padding: '28px 0' }}>
      <p role="alert">{error}</p>
      <button className="btn btn-primary"
        onClick={() => setAttempt(value => value + 1)}>
        Reintentar
      </button>
    </main>
  ) : (
    <MenuPage menus={menus} date={date} />
  );

  const detailContent = loading || error
    ? menuContent
    : <MenuDetail menus={menus} date={date} account={account} />;

  return (
    <BrowserRouter>
      <Header account={account} checking={checking} onLogout={closeSession} />

      {sessionError && (
        <p className="container" role="alert">{sessionError}</p>
      )}

      <Routes>
        <Route path="/" element={menuContent} />
        <Route path="/menu/:id" element={detailContent} />
        <Route path="/acceso" element={
          <AuthPage onAuthenticated={refreshAccount} />
        } />
        <Route path="*" element={
          <main className="container" style={{ padding: '28px 0' }}>
            <h1>Página no encontrada</h1>
            <Link to="/">Volver al menú</Link>
          </main>
        } />
      </Routes>
    </BrowserRouter>
  );
}
