import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  registerUser,
  verifyEmail,
  resendVerificationCode,
  loginUser,
  requestPasswordReset,
  finishPasswordReset,
} from '../../services/auth';

type Mode = 'login' | 'register' | 'verify' | 'recover' | 'reset';

function errorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : '';

  switch (name) {
    case 'NotAuthorizedException':
    case 'UserNotFoundException':
      return 'Revisa tu correo y contraseña.';
    case 'UsernameExistsException':
      return 'Esta cuenta ya existe. Inicia sesión o recupera tu contraseña.';
    case 'CodeMismatchException':
      return 'El código no es correcto.';
    case 'ExpiredCodeException':
      return 'El código venció. Solicita uno nuevo.';
    case 'InvalidPasswordException':
      return 'Usa al menos 12 caracteres, mayúsculas, minúsculas y números.';
    case 'LimitExceededException':
    case 'TooManyRequestsException':
      return 'Hubo demasiados intentos. Espera un momento.';
    default:
      return 'No pudimos completar la operación. Intenta nuevamente.';
  }
}

export default function AuthPage({
  onAuthenticated,
}: {
  onAuthenticated: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function changeMode(next: Mode) {
    setMode(next);
    setError('');
    setMessage('');
    setPassword('');
    setConfirmation('');
    setCode('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setError('');
    setMessage('');

    if (
      mode === 'register' &&
      !/^[^@\s]+@utec\.edu\.pe$/i.test(email.trim())
    ) {
      setError('Usa tu correo institucional @utec.edu.pe.');
      return;
    }

    if (
      (mode === 'register' || mode === 'reset') &&
      password !== confirmation
    ) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setBusy(true);

    try {
      if (mode === 'register') {
        const result = await registerUser({
          email,
          password,
          firstName,
          lastName,
        });

        changeMode(result.isSignUpComplete ? 'login' : 'verify');
        setMessage(
          result.isSignUpComplete
            ? 'Tu cuenta está lista. Inicia sesión.'
            : 'Revisa tu correo e ingresa el código de verificación.',
        );
      } else if (mode === 'verify') {
        await verifyEmail(email, code);
        changeMode('login');
        setMessage('Correo confirmado. Ya puedes iniciar sesión.');
      } else if (mode === 'login') {
        const result = await loginUser(email, password);

        if (result.isSignedIn) {
          setPassword('');
          await onAuthenticated();
          navigate('/');
        } else if (result.nextStep.signInStep === 'CONFIRM_SIGN_UP') {
          changeMode('verify');
          setMessage('Confirma tu correo. Puedes solicitar otro código.');
        } else if (result.nextStep.signInStep === 'RESET_PASSWORD') {
          changeMode('recover');
          setMessage('Debes restablecer tu contraseña.');
        } else {
          setError('Tu cuenta requiere un paso adicional de acceso.');
        }
      } else if (mode === 'recover') {
        await requestPasswordReset(email);
        changeMode('reset');
        setMessage(
          'Si la cuenta puede recuperarse, recibirás un código por correo.',
        );
      } else {
        await finishPasswordReset(email, code, password);
        changeMode('login');
        setMessage('Contraseña actualizada. Inicia sesión.');
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');

    try {
      await resendVerificationCode(email);
      setMessage('Solicitamos un nuevo código. Revisa tu correo.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Mode, string> = {
    login: 'Iniciar sesión',
    register: 'Crear cuenta',
    verify: 'Verificar correo',
    recover: 'Recuperar contraseña',
    reset: 'Crear nueva contraseña',
  };

  const newPassword = mode === 'register' || mode === 'reset';
  const needsPassword = mode === 'login' || newPassword;
  const needsCode = mode === 'verify' || mode === 'reset';
  const inputStyle = {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: 12,
    marginTop: 6,
    border: '1px solid #6b7280',
    borderRadius: 8,
    font: 'inherit',
  };

  return (
    <main className="container" style={{ padding: '28px 0' }}>
      <Link to="/">← Volver al menú</Link>

      <section className="card" style={{
        maxWidth: 460,
        margin: '24px auto',
      }}>
        <h1>{titles[mode]}</h1>

        <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
          {mode === 'register' && <>
            <label htmlFor="firstName">
              Nombre
              <input id="firstName" autoComplete="given-name"
                value={firstName} required maxLength={100}
                onChange={e => setFirstName(e.target.value)}
                style={inputStyle} />
            </label>

            <label htmlFor="lastName">
              Apellido
              <input id="lastName" autoComplete="family-name"
                value={lastName} required maxLength={100}
                onChange={e => setLastName(e.target.value)}
                style={inputStyle} />
            </label>
          </>}

          <label htmlFor="email">
            Correo institucional
            <input id="email" type="email" autoComplete="username"
              value={email} required
              onChange={e => setEmail(e.target.value)}
              style={inputStyle} />
          </label>

          {needsCode && (
            <label htmlFor="code">
              Código recibido por correo
              <input id="code" autoComplete="one-time-code"
                inputMode="numeric" value={code} required
                onChange={e => setCode(e.target.value)}
                style={inputStyle} />
            </label>
          )}

          {needsPassword && (
            <label htmlFor="password">
              {newPassword ? 'Nueva contraseña' : 'Contraseña'}
              <input id="password" type="password"
                autoComplete={newPassword ? 'new-password' : 'current-password'}
                value={password} required
                minLength={newPassword ? 12 : undefined}
                aria-describedby={newPassword ? 'password-help' : undefined}
                onChange={e => setPassword(e.target.value)}
                style={inputStyle} />
            </label>
          )}

          {newPassword && <>
            <small id="password-help">
              Al menos 12 caracteres, mayúsculas, minúsculas y números.
            </small>
            <label htmlFor="confirmation">
              Confirmar contraseña
              <input id="confirmation" type="password"
                autoComplete="new-password" value={confirmation} required
                onChange={e => setConfirmation(e.target.value)}
                style={inputStyle} />
            </label>
          </>}

          {error && <p role="alert" style={{ color: '#8d1f28' }}>{error}</p>}
          {message && <p role="status">{message}</p>}

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Procesando...' : titles[mode]}
          </button>
        </form>

        <nav aria-label="Opciones de acceso" style={{
          display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 20,
        }}>
          {mode !== 'login' && (
            <button type="button" className="btn btn-secondary"
              disabled={busy} onClick={() => changeMode('login')}>
              Iniciar sesión
            </button>
          )}

          {mode === 'login' && <>
            <button type="button" className="btn btn-secondary"
              disabled={busy} onClick={() => changeMode('register')}>
              Registrarse
            </button>
            <button type="button" className="btn btn-secondary"
              disabled={busy} onClick={() => changeMode('recover')}>
              Olvidé mi contraseña
            </button>
            <button type="button" className="btn btn-secondary"
              disabled={busy} onClick={() => changeMode('verify')}>
              Confirmar mi correo
            </button>
          </>}

          {mode === 'verify' && (
            <button type="button" className="btn btn-secondary"
              disabled={busy || !email.trim()} onClick={resendCode}>
              Reenviar código
            </button>
          )}

          {mode === 'reset' && (
            <button type="button" className="btn btn-secondary"
              disabled={busy} onClick={() => changeMode('recover')}>
              Solicitar otro código
            </button>
          )}
        </nav>
      </section>
    </main>
  );
}
