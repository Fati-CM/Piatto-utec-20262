export const handler = async (event) => {
  return { statusCode: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, function: 'menus', method: event?.requestContext?.http?.method ?? null }) };
};
