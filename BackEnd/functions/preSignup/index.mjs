export const handler = async (event) => {
  const email = (
    event.request.userAttributes.email ?? ''
  ).trim().toLowerCase();

  const parts = email.split('@');

  if (
    parts.length !== 2 ||
    !parts[0] ||
    parts[1] !== 'utec.edu.pe'
  ) {
    throw new Error('Usa tu correo institucional @utec.edu.pe');
  }

  // Mantener la verificación normal por código de correo.
  return event;
};
