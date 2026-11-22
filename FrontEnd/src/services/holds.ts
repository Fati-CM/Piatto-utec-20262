import { fetchAuthSession } from 'aws-amplify/auth';
import { api } from './api';

export type Hold = {
  holdId: string;
  serviceDate: string;
  menuId: string;
  menuOptionId: string;
  status: 'ACTIVE' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
  serverTime: string;
  amount: {
    currency: string;
    totalMinor: number;
  };
};

export class HoldError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'HoldError';
    this.code = code;
  }
}

export async function createHold(input: {
  serviceDate: string;
  menuId: string;
  menuOptionId: string;
  idempotencyKey: string;
}): Promise<Hold> {
  const session = await fetchAuthSession();
  const token = session.tokens?.accessToken;

  if (!token) {
    throw new HoldError(
      'UNAUTHORIZED',
      'Inicia sesión para continuar',
    );
  }

  try {
    return await api<Hold>('/holds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.toString()}`,
      },
      body: JSON.stringify(input),
    });
  } catch (error) {
    if (error instanceof Error) {
      let body;

      try {
        body = JSON.parse(error.message);
      } catch {
        // Puede ser un error de red o una respuesta no JSON.
      }

      if (
        typeof body?.error?.code === 'string' &&
        typeof body?.error?.message === 'string'
      ) {
        throw new HoldError(
          body.error.code,
          body.error.message,
        );
      }

      if (body?.message === 'Unauthorized') {
        throw new HoldError(
          'UNAUTHORIZED',
          'Tu sesión no es válida. Inicia sesión nuevamente',
        );
      }
    }

    throw new HoldError(
      'REQUEST_UNCERTAIN',
      'No pudimos confirmar la respuesta. Reintenta sin cambiar tu selección',
    );
  }
}
