// In-memory Users and UserEmails tables with the DynamoDB wrapper's interface.
// Scans return one row per page, so a caller that ignores LastEvaluatedKey
// only ever sees the first row. Every ConditionExpression used against these
// tables is attribute_not_exists on the key, which is all this models.
function memoryUserTables() {
  const tables = { Users: new Map(), UserEmails: new Map() };
  const keyOf = (TableName, item) => (TableName === 'UserEmails' ? item.email : item.id);
  const conditionFails = ({ TableName, Item, ConditionExpression }) =>
    Boolean(ConditionExpression) && tables[TableName].has(keyOf(TableName, Item));
  return {
    tables,
    get: ({ TableName, Key }) => ({ promise: async () => ({ Item: tables[TableName].get(keyOf(TableName, Key)) }) }),
    put: (params) => ({ promise: async () => {
      if (conditionFails(params)) {
        throw Object.assign(new Error('condition failed'), { code: 'ConditionalCheckFailedException' });
      }
      tables[params.TableName].set(keyOf(params.TableName, params.Item), params.Item);
      return {};
    } }),
    transactWrite: ({ TransactItems }) => ({ promise: async () => {
      const puts = TransactItems.map(({ Put }) => Put);
      const reasons = puts.map((put) => ({ Code: conditionFails(put) ? 'ConditionalCheckFailed' : 'None' }));
      if (reasons.some(({ Code }) => Code !== 'None')) {
        throw Object.assign(new Error('transaction cancelled'), {
          code: 'TransactionCanceledException', CancellationReasons: reasons,
        });
      }
      for (const { TableName, Item } of puts) tables[TableName].set(keyOf(TableName, Item), Item);
      return {};
    } }),
    scan: ({ TableName, ExpressionAttributeValues, ExclusiveStartKey }) => ({ promise: async () => {
      const rows = [...tables[TableName].values()];
      const start = ExclusiveStartKey ? rows.findIndex((row) => row.id === ExclusiveStartKey.id) + 1 : 0;
      const Items = rows.slice(start, start + 1)
        .filter((row) => !ExpressionAttributeValues || row.email === ExpressionAttributeValues[':email']);
      return start + 1 < rows.length ? { Items, LastEvaluatedKey: { id: rows[start].id } } : { Items };
    } }),
  };
}

module.exports = { memoryUserTables };
