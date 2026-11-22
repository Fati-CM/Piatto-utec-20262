import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function respond(statusCode, data) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(data),
  };
}

function todayInLima() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export const handler = async (event) => {
  const date = event.queryStringParameters?.date ?? todayInLima();

  if (!isValidDate(date)) {
    return respond(400, {
      error: {
        code: 'INVALID_DATE',
        message: 'Usa una fecha válida con formato YYYY-MM-DD',
      },
    });
  }

  try {
    const menus = [];
    let lastKey;

    do {
      const result = await db.send(new QueryCommand({
        TableName: process.env.MENUS_TABLE,
        KeyConditionExpression: '#date = :date',
        ExpressionAttributeNames: {
          '#date': 'serviceDate',
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':date': date,
          ':published': 'PUBLISHED',
        },
        FilterExpression: '#status = :published',
        ExclusiveStartKey: lastKey,
      }));

      menus.push(...(result.Items ?? []));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return respond(200, {
      date,
      timezone: 'America/Lima',
      menus,
    });
  } catch (error) {
    console.error(JSON.stringify({
      message: 'Error al consultar menús',
      requestId: event.requestContext?.requestId,
      errorName: error.name,
    }));

    return respond(500, {
      error: {
        code: 'MENUS_READ_FAILED',
        message: 'No pudimos consultar el menú',
      },
    });
  }
};
