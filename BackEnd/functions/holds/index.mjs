import { createHash } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function reply(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

function fail(statusCode, code, message) {
  return reply(statusCode, { error: { code, message } });
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

async function readHold(holdId) {
  const result = await db.send(new GetCommand({
    TableName: process.env.HOLDS_TABLE,
    Key: { holdId },
    ConsistentRead: true,
  }));
  return result.Item;
}

function holdResponse(hold, statusCode) {
  return reply(statusCode, {
    holdId: hold.holdId,
    serviceDate: hold.serviceDate,
    menuId: hold.menuId,
    menuOptionId: hold.menuOptionId,
    status: hold.status,
    expiresAt: hold.expiresAt,
    serverTime: new Date().toISOString(),
    amount: { currency: hold.currency, totalMinor: hold.priceMinor },
  });
}

function replay(hold, input) {
  if (
    hold.serviceDate !== input.serviceDate ||
    hold.menuId !== input.menuId ||
    hold.menuOptionId !== input.menuOptionId
  ) {
    return fail(409, 'IDEMPOTENCY_CONFLICT',
      'Este intento ya fue utilizado para otra selección');
  }

  if (
    hold.status !== 'ACTIVE' ||
    hold.expiresAtEpoch <= Math.floor(Date.now() / 1000)
  ) {
    return fail(409, 'HOLD_NOT_ACTIVE',
      'Esta reserva ya no está vigente. Inicia otra reserva');
  }

  return holdResponse(hold, 200);
}

export const handler = async (event) => {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  const userId = claims?.sub;

  if (!userId || claims?.token_use !== 'access') {
    return fail(401, 'UNAUTHORIZED', 'Inicia sesión para continuar');
  }

  const rawGroups = claims['cognito:groups'] ?? '';
  const groups = Array.isArray(rawGroups)
    ? rawGroups
    : String(rawGroups).split(/[\[\],\s"']+/).filter(Boolean);

  if (!groups.includes('customer') && !groups.includes('staff')) {
    return fail(403, 'FORBIDDEN', 'Tu cuenta no tiene permisos para reservar');
  }

  let input;
  try {
    const body = event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
      : event.body;
    input = JSON.parse(body ?? '{}');
  } catch {
    return fail(400, 'INVALID_BODY', 'La solicitud no es válida');
  }

  if (
    !input || typeof input !== 'object' ||
    !validDate(input.serviceDate) ||
    typeof input.menuId !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(input.menuId) ||
    typeof input.menuOptionId !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(input.menuOptionId) ||
    typeof input.idempotencyKey !== 'string' ||
    !/^[a-zA-Z0-9_-]{16,100}$/.test(input.idempotencyKey)
  ) {
    return fail(400, 'INVALID_INPUT', 'Revisa el menú, la opción y la fecha');
  }

  const holdId = 'hld_' + createHash('sha256')
    .update(`${userId}:${input.idempotencyKey}`)
    .digest('hex');

  try {
    const existing = await readHold(holdId);
    if (existing) return replay(existing, input);

    const result = await db.send(new GetCommand({
      TableName: process.env.MENUS_TABLE,
      Key: {
        serviceDate: input.serviceDate,
        menuId: input.menuId,
      },
      ConsistentRead: true,
    }));

    const menu = result.Item;
    const index = menu?.options?.findIndex(
      option => option.id === input.menuOptionId,
    ) ?? -1;

    if (!menu || menu.status !== 'PUBLISHED' || index < 0) {
      return fail(404, 'MENU_NOT_FOUND', 'El menú no está disponible');
    }

    if (menu.options[index].stock < 1) {
      return fail(409, 'SOLD_OUT', 'Esta opción se agotó');
    }

    const now = new Date();
    const limaParts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Lima',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(now).map(part => [part.type, part.value]),
    );
    const today = `${limaParts.year}-${limaParts.month}-${limaParts.day}`;

    if (input.serviceDate < today) {
      return fail(400, 'PAST_DATE', 'No puedes reservar un menú de una fecha pasada');
    }

    const expiresAtEpoch = Math.floor(now.getTime() / 1000) + 300;

    const hold = {
      holdId,
      userId,
      serviceDate: input.serviceDate,
      menuId: input.menuId,
      menuOptionId: input.menuOptionId,
      dishId: menu.options[index].dishId,
      menuName: menu.category,
      optionName: menu.options[index].name,
      priceMinor: menu.priceMinor,
      currency: menu.currency,
      status: 'ACTIVE',
      createdAt: now.toISOString(),
      expiresAtEpoch,
      expiresAt: new Date(expiresAtEpoch * 1000).toISOString(),
    };

    await db.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: process.env.MENUS_TABLE,
            Key: {
              serviceDate: input.serviceDate,
              menuId: input.menuId,
            },
            UpdateExpression:
              `SET #options[${index}].#stock = #options[${index}].#stock - :one`,
            ConditionExpression:
              '#status = :published AND #price = :price AND ' +
              `#options[${index}].#id = :optionId AND ` +
              `#options[${index}].#stock >= :one`,
            ExpressionAttributeNames: {
              '#options': 'options',
              '#stock': 'stock',
              '#id': 'id',
              '#status': 'status',
              '#price': 'priceMinor',
            },
            ExpressionAttributeValues: {
              ':one': 1,
              ':published': 'PUBLISHED',
              ':price': menu.priceMinor,
              ':optionId': input.menuOptionId,
            },
          },
        },
        {
          Put: {
            TableName: process.env.HOLDS_TABLE,
            Item: hold,
            ConditionExpression: 'attribute_not_exists(holdId)',
          },
        },
      ],
    }));

    return holdResponse(hold, 201);
  } catch (error) {
    if (error.name === 'TransactionCanceledException') {
      const existing = await readHold(holdId);
      if (existing) return replay(existing, input);

      return fail(409, 'RESERVATION_CONFLICT',
        'La disponibilidad cambió. Consulta el menú e intenta nuevamente');
    }

    console.error(JSON.stringify({
      message: 'Error al crear reserva',
      requestId: event.requestContext?.requestId,
      errorName: error.name,
    }));

    return fail(500, 'HOLD_CREATE_FAILED', 'No pudimos separar tu menú');
  }
};
