import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function readHold(holdId) {
  const result = await db.send(new GetCommand({
    TableName: process.env.HOLDS_TABLE,
    Key: { holdId },
    ConsistentRead: true,
  }));
  return result.Item;
}

async function releaseHold(holdId, now) {
  const hold = await readHold(holdId);

  if (
    !hold ||
    hold.status !== 'ACTIVE' ||
    hold.expiresAtEpoch > now
  ) {
    return false;
  }

  const result = await db.send(new GetCommand({
    TableName: process.env.MENUS_TABLE,
    Key: {
      serviceDate: hold.serviceDate,
      menuId: hold.menuId,
    },
    ConsistentRead: true,
  }));

  const index = result.Item?.options?.findIndex(
    option => option.id === hold.menuOptionId,
  ) ?? -1;

  if (index < 0) {
    throw new Error('RESERVED_MENU_OPTION_MISSING');
  }

  try {
    await db.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: process.env.HOLDS_TABLE,
            Key: { holdId },
            UpdateExpression:
              'SET #status = :expired, releasedAt = :releasedAt, #ttl = :ttl',
            ConditionExpression:
              '#status = :active AND expiresAtEpoch <= :now',
            ExpressionAttributeNames: {
              '#status': 'status',
              '#ttl': 'ttl',
            },
            ExpressionAttributeValues: {
              ':active': 'ACTIVE',
              ':expired': 'EXPIRED',
              ':now': now,
              ':releasedAt': new Date().toISOString(),
              ':ttl': now + 7 * 24 * 60 * 60,
            },
          },
        },
        {
          Update: {
            TableName: process.env.MENUS_TABLE,
            Key: {
              serviceDate: hold.serviceDate,
              menuId: hold.menuId,
            },
            UpdateExpression:
              `SET #options[${index}].#stock = #options[${index}].#stock + :one`,
            ConditionExpression:
              `#options[${index}].#id = :optionId AND ` +
              `attribute_exists(#options[${index}].#stock)`,
            ExpressionAttributeNames: {
              '#options': 'options',
              '#stock': 'stock',
              '#id': 'id',
            },
            ExpressionAttributeValues: {
              ':one': 1,
              ':optionId': hold.menuOptionId,
            },
          },
        },
      ],
    }));

    return true;
  } catch (error) {
    if (error.name === 'TransactionCanceledException') {
      const current = await readHold(holdId);

      if (!current || current.status !== 'ACTIVE') {
        return false;
      }
    }

    throw error;
  }
}

export const handler = async (_event, context) => {
  const now = Math.floor(Date.now() / 1000);
  let lastKey;
  let released = 0;
  let failed = 0;
  let deferred = false;

  do {
    const result = await db.send(new QueryCommand({
      TableName: process.env.HOLDS_TABLE,
      IndexName: 'StatusExpiryIndex',
      KeyConditionExpression:
        '#status = :active AND expiresAtEpoch <= :now',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':active': 'ACTIVE',
        ':now': now,
      },
      ExclusiveStartKey: lastKey,
      Limit: 25,
    }));

    for (const hold of result.Items ?? []) {
      if (context && context.getRemainingTimeInMillis() < 10000) {
        deferred = true;
        break;
      }

      try {
        if (await releaseHold(hold.holdId, now)) {
          released += 1;
        }
      } catch (error) {
        failed += 1;

        console.error(JSON.stringify({
          message: 'No se pudo liberar una reserva',
          holdId: hold.holdId,
          errorName: error.name,
          validationMessage: error.name === 'ValidationException'
            ? error.message
            : undefined,
          errorCode: error.message === 'RESERVED_MENU_OPTION_MISSING'
            ? error.message
            : undefined,
        }));
      }
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey && !deferred);

  console.log(JSON.stringify({ released, failed, deferred }));

  if (failed > 0) {
    throw new Error('HOLD_RELEASE_FAILED');
  }

  return { released, failed, deferred };
};
