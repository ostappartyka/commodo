import getName from "@commodo/name/getName";
import isId from "./isId";

const { config, DynamoDB } = require("aws-sdk");
const mdbid = require("mdbid");

config.update({
  region: "eu-central-1",
});

const db = new DynamoDB.DocumentClient();

const operators = [
  "$in",
  "$nin",
  "contains",
  "$not",
  "$lt",
  "$ne",
  "$lte",
  "$gte",
  "$gt",
  "$eq",
];

const emptyExpression = {
  filterExpressionArray: [],
  attributeNames: {},
  attributeValues: {},
};

class DynamoDbDriver {
  collections: Object;
  database: Object;
  aggregateTotalCount: ?boolean;

  // database: any;
  tableName: any;

  constructor({ database, collections, aggregateTotalCount } = {}) {
    // TODO: remove tableName
    this.aggregateTotalCount = aggregateTotalCount;
    this.database = database;
    this.collections = {
      prefix: "",
      naming: null,
      ...collections,
    };

    // this.tableName = tableName; // TODO: remove
  }

  async save({ model, isCreate }) {
    return isCreate ? this.create({ model }) : this.update({ model });
  }

  async create({ model }) {
    if (!model.id) {
      model.id = mdbid();
    }

    const data = await model.toStorage();

    const params = {
      TableName: this.getCollectionName(model),
      Item: data,
    };

    try {
      await this.getDatabase().put(params).promise();
      return true;
    } catch (e) {
      throw e;
    }
  }

  async update({ model }) {
    const { id, ...item } = model;

    const keys = Object.keys(item);

    const expressionAttributeNames = keys.reduce((acc, key) => {
      acc[`#${key}`] = key;
      return acc;
    }, {});
    const expressionAttributeValues = keys.reduce((acc, key) => {
      acc[`:${key}`] = item[key];
      return acc;
    }, {});
    const expression = keys.map((key) => `#${key} = :${key}`).join(", ");
    const updateExpression = `SET ${expression}`;

    const params = {
      TableName: this.getCollectionName(model),
      Key: { id },
      ReturnValues: "ALL_NEW",
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      UpdateExpression: updateExpression,
    };

    console.log("params", params);

    try {
      await this.getDatabase().update(params).promise();
      return true;
    } catch (e) {
      throw e;
    }
  }

  async delete({ model }) {
    const params = {
      TableName: this.getCollectionName(model),
      Key: {
        id: model.id,
      },
    };

    try {
      await this.getDatabase().delete(params).promise();
      return true;
    } catch (e) {
      throw e;
    }
  }

  // TODO pagination and stuff
  // async find({ model, options }) {
  //     const clonedOptions = { limit: 10, offset: 0, ...options };

  //     MongoDbDriver.__preparePerPageOption(clonedOptions);
  //     MongoDbDriver.__preparePageOption(clonedOptions);
  //     MongoDbDriver.__prepareSearchOption(clonedOptions);

  //     if (this.aggregateTotalCount !== false) {
  //         const $facet = {
  //             results: [{ $skip: clonedOptions.offset }, { $limit: clonedOptions.limit }]
  //         };

  //         if (clonedOptions.sort && Object.keys(clonedOptions.sort).length > 0) {
  //             $facet.results.unshift({ $sort: clonedOptions.sort });
  //         }

  //         if (options.meta !== false) {
  //             $facet.totalCount = [{ $count: "value" }];
  //         }

  //         const pipeline = [
  //             {
  //                 $facet
  //             }
  //         ];

  //         if (clonedOptions.query && Object.keys(clonedOptions.query).length > 0) {
  //             pipeline.unshift({ $match: clonedOptions.query });
  //         }

  //         const [results = {}] = await this.getDatabase()
  //             .collection(this.getCollectionName(model))
  //             .aggregate(pipeline)
  //             .toArray();

  //         if (!Array.isArray(results.results)) {
  //             results.results = [];
  //         }

  //         if (!Array.isArray(results.totalCount)) {
  //             results.totalCount = [];
  //         }

  //         if (options.meta === false) {
  //             return [results.results, {}];
  //         }

  //         return [
  //             results.results,
  //             createPaginationMeta({
  //                 totalCount: results.totalCount[0] ? results.totalCount[0].value : 0,
  //                 page: options.page,
  //                 perPage: options.perPage
  //             })
  //         ];
  //     }

  //     const database = await this.getDatabase()
  //         .collection(this.getCollectionName(model))
  //         .find(clonedOptions.query)
  //         .limit(clonedOptions.limit)
  //         .skip(clonedOptions.offset);

  //     if (clonedOptions.sort && Object.keys(clonedOptions.sort).length > 0) {
  //         database.sort(clonedOptions.sort);
  //     }

  //     const results = await database.toArray();

  //     if (options.meta === false) {
  //         return [results, {}];
  //     }

  //     const totalCount = await this.getDatabase()
  //         .collection(this.getCollectionName(model))
  //         .countDocuments(clonedOptions.query);

  //     const meta = createPaginationMeta({
  //         totalCount,
  //         page: options.page,
  //         perPage: options.perPage
  //     });

  //     return [results, meta];
  // }

  async findOne({ model }) {
    // TODO should work not only by id
    const params = {
      TableName: this.getCollectionName(model),
      Key: {
        id: model.id,
      },
      Limit: 1,
    };

    return this.getDatabase().get(params).promise();
  }

  // list of indexes

  //  User.find({
  //      indexes: ['nameIndex', '']
  //  })

  async find({ model, options: { query, search, perPage, index }, ...rest }) {
    // async find({ query, indexes, ...rest }) {
    // If index exists use query if not scan
    // TODO flag on scan or query
    // page: 3,
    //     perPage: 7,
    //     totalCount: 20,
    //     totalPages: 3,
    //     from: 15,
    //     to: 20,
    //     nextPage: null,
    //     previousPage: 2

    // const paginationResult = db.query({
    //     // TableName: this.tableName,
    //     TableName: 'test_db',
    //     IndexName: 'id-timestamp-index',
    //     // AttributesToGet: ['id','timestamp'],
    //     KeyConditionExpression: '#id >= :id AND #timestamp >= :timestamp',
    //     // ScanIndexForward: true,
    //     ProjectionExpression: '#id, #timestamp',
    //     // ProjectionExpression: '',
    //     ExpressionAttributeNames: {
    //         '#id': 'id',
    //         '#timestamp': 'timestamp',
    //     },
    //     ExpressionAttributeValues: {
    //         ':id': '0',
    //         ':timestamp': 0,
    //     },
    // }).promise();
    //
    // console.log('paginationResult', paginationResult);
    // return paginationResult;
    // console.log('query', query)
    // console.log('search', search)
    const queryResult = query
      ? this._convertQueryToParams(query)
      : emptyExpression;
    const searchResult = search
      ? this._convertSearchToParams(search)
      : emptyExpression;
    // console.log('queryResult', queryResult);
    // console.log('searchResult', searchResult);

    const result = this._mergeExpressions([queryResult, searchResult]);

    const filterExpression = this._$and(
      result.filterExpressionArray.filter((item) => !!item)
    );
    // console.log('result', result);
    const params = {
      TableName: this.getCollectionName(model),
      FilterExpression: filterExpression,
      // RangeKeyCondition
      ExpressionAttributeNames: result.attributeNames,
      ExpressionAttributeValues: result.attributeValues,
      Limit: perPage || 20,
    };
    // console.log('params', params);

    if (!index) {
      return this.getDatabase().scan(params).promise();
    }

    // // data -> LastEvaluatedKey: { id: '2' }

    const indexQueryResult = this._convertQueryToParams(index.query);
    console.log("indexQueryResult", indexQueryResult);
    const scanParams = {
      TableName: this.getCollectionName(model),
      IndexName: index.indexName,
      // ScanIndexForward

      KeyConditionExpression: indexQueryResult.filterExpression,
      FilterExpression: filterExpression,
      ExpressionAttributeNames: {
        ...indexQueryResult.attributeNames,
        ...result.attributeNames,
      },
      ExpressionAttributeValues: {
        ...indexQueryResult.attributeValues,
        ...result.attributeValues,
      },
    };

    console.log("scanParams", scanParams);

    return this.getDatabase().query(scanParams).promise();

    // const scanParams = {
    //     // ...params,
    //     TableName: this.tableName,
    //     IndexName: 'name-index',
    //     KeyConditionExpression: "#name = :name",
    //     ExpressionAttributeNames: {
    //         // ...result.attributeNames,
    //         '#name': 'name'
    //     },
    //     ExpressionAttributeValues: {
    //         // ...result.attributeValues,
    //         ':name': 'Test 3'
    //     },
    // };
    //
    // console.log('scanParams', scanParams);
    //
    //     return db.query(scanParams).promise();
  }
  async count() {
    try {
      const result = await Promise.resolve(1);
      console.log("result", result);
      return result;
    } catch (e) {
      throw e;
    }
  }

  isId(value: any) {
    return isId(value);
  }

  getDatabase() {
    return this.database;
  }

  setCollectionPrefix(collectionPrefix) {
    this.collections.prefix = collectionPrefix;
    return this;
  }

  getCollectionPrefix() {
    return this.collections.prefix;
  }

  setCollectionNaming(collectionNameValue) {
    this.collections.naming = collectionNameValue;
    return this;
  }

  getCollectionNaming() {
    return this.collections.naming;
  }

  getCollectionName(model) {
    const getCollectionName = this.getCollectionNaming();
    if (typeof getCollectionName === "function") {
      return getCollectionName({ model, driver: this });
    }

    return this.collections.prefix + getName(model);
  }

  _$and(expressions) {
    return expressions.length > 1
      ? `( ${expressions.join(" AND ")} )`
      : expressions.toString();
  }

  _$or(expressions) {
    return expressions.length > 1
      ? `( ${expressions.join(" OR ")} )`
      : expressions.toString();
  }

  _isObject(obj) {
    return Object.prototype.toString.call(obj) === "[object Object]";
  }

  _convertQueryToParams(query) {
    const parseQuery = (obj, prevKeys) => {
      // @ts-ignore
      const expressions = Object.keys(obj).reduce((acc, key) => {
        const value = obj[key];
        if (operators.includes(key)) {
          acc.push(
            this._buildQuery({
              operator: key,
              fieldName: prevKeys.pop(),
              value,
            })
          );
        } else if ("$and" === key) {
          console.log("$and:", value);
          const expressions = value.map((query) => parseQuery(query, prevKeys));
          const expression = this._mergeExpressions(expressions);
          console.log("$and (expression):", expression);
          acc.push({
            ...expression,
            filterExpressionArray: [
              this._$and(expression.filterExpressionArray),
            ],
          });
        } else if ("$or" === key) {
          console.log("$or:", value);
          const expressions = value.map((query) => parseQuery(query, prevKeys));
          const expression = this._mergeExpressions(expressions);

          acc.push({
            ...expression,
            filterExpressionArray: [
              this._$or(expression.filterExpressionArray),
            ],
          });
        } else if (this._isObject(value)) {
          console.log("obj:", key);
          acc.push(parseQuery(value, [...prevKeys, key]));
        } else {
          console.log("else ", key, value);
          console.log("else (prevKeys)", prevKeys);

          let fieldName;

          if (prevKeys.length > 0) {
            fieldName = [...prevKeys, key].join(".");
          } else {
            fieldName = key;
          }

          const result = this._buildQuery({
            operator: null,
            fieldName,
            value: obj[key],
          });

          acc.push(result);
          prevKeys.pop();
          console.log("else (prevKeys)", prevKeys);
        }

        return acc;
      }, []);

      return this._mergeExpressions(expressions);
    };

    const result = parseQuery(query, []);

    return {
      ...result,
      filterExpressionArray: [this._$and(result.filterExpressionArray)],
      filterExpression: this._$and(result.filterExpressionArray),
    };
  }

  _convertSearchToParams(search) {
    const { query, fields, operator = "$or" } = search;

    const expressions = fields.map((key) =>
      this._buildQuery({
        operator: "contains",
        fieldName: key,
        value: query,
      })
    );

    const expression = this._mergeExpressions(expressions);

    let filterExpressionArray;

    if (operator === "or") {
      filterExpressionArray = [this._$or(expression.filterExpressionArray)];
    } else {
      filterExpressionArray = [this._$and(expression.filterExpressionArray)];
    }

    return {
      ...expression,
      filterExpressionArray,
    };
  }

  _mergeExpressions(expressions) {
    return expressions.reduce(
      (obj, expr) => ({
        filterExpressionArray: [
          ...obj.filterExpressionArray,
          ...expr.filterExpressionArray,
        ],
        attributeNames: { ...obj.attributeNames, ...expr.attributeNames },
        attributeValues: { ...obj.attributeValues, ...expr.attributeValues },
      }),
      {
        filterExpressionArray: [],
        attributeNames: {},
        attributeValues: {},
      }
    );
  }

  _buildQuery({ operator, fieldName, value }) {
    console.log({ operator, fieldName, value });
    const filterExpressionArray = [];
    const attributeNames = {};
    const attributeValues = {};

    let attributeNameKey;
    let attributeValueKey;

    const keys = fieldName.split(".");
    if (keys.length > 0) {
      keys.forEach((key) => {
        attributeNames[`#${key}`] = key;
      });

      attributeNameKey = keys
        .reduce((acc, key) => [...acc, `#${key}`], [])
        .join(".");
    } else {
      attributeNameKey = `#${fieldName}`;
      attributeNames[attributeNameKey] = fieldName;
    }
    const lastKey = keys[keys.length - 1];
    attributeValueKey = `:${lastKey}_${mdbid()}`;

    switch (operator) {
      case "$in": {
        const values = [];
        value.forEach((item, index) => {
          const key = `${attributeValueKey}_${index}`;
          attributeValues[key] = value[index];
          values.push(key);
        });

        const query = `${attributeNameKey} IN ( ${values.join(", ")} )`;
        filterExpressionArray.push(query);
        break;
      }
      case "$nin": {
        const expressions = [];

        value.forEach((item, index) => {
          const key = `${attributeValueKey}_${index}`;
          attributeValues[key] = value[index];
          expressions.push(`${attributeNameKey} <> ${key}`);
        });

        const combinedExpressions = expressions.join(" AND ");

        const query = `( ${combinedExpressions} )`;
        filterExpressionArray.push(query);
        break;
      }

      case "contains": {
        attributeValues[attributeValueKey] = value;

        const query = `contains(${attributeNameKey}, ${attributeValueKey})`;
        filterExpressionArray.push(query);
        break;
      }
      case "$not": {
        attributeValues[attributeValueKey] = value;

        const query = `( NOT (contains(${attributeNameKey}, ${attributeValueKey})) )`;
        filterExpressionArray.push(query);
        break;
      }
      case "$lt": {
        attributeValues[attributeValueKey] = value;

        const query = `${attributeNameKey} < ${attributeValueKey}`;
        filterExpressionArray.push(query);
        break;
      }
      case "$ne": {
        attributeValues[attributeValueKey] = value;

        const query = `${attributeNameKey} <> ${attributeValueKey}`;
        filterExpressionArray.push(query);
        break;
      }
      case "$lte": {
        attributeValues[attributeValueKey] = value;

        const query = `${attributeNameKey} <= ${attributeValueKey}`;
        filterExpressionArray.push(query);
        break;
      }
      case "$gte": {
        attributeValues[attributeValueKey] = value;

        const query = `${attributeNameKey} >= ${attributeValueKey}`;
        filterExpressionArray.push(query);
        break;
      }

      case "$gt": {
        attributeValues[attributeValueKey] = value;

        const query = `${attributeNameKey} > ${attributeValueKey}`;
        filterExpressionArray.push(query);
        break;
      }

      case "$eq":
      default: {
        attributeValues[attributeValueKey] = value;
        const query = `${attributeNameKey} = ${attributeValueKey}`;
        filterExpressionArray.push(query);
      }
    }

    return {
      filterExpressionArray,
      attributeNames,
      attributeValues,
    };
  }
}

const testDB = new DynamoDbDriver({ database: db, tableName: "Test" });

async function runTest() {
  console.log("*** runTest ****");

  // const created1 = await testDB.create({model: {id: '1', hello: 'world', name: 'Test 1'}})
  // console.log('created', created);

  // const updated = await testDB.update({model: {id: '1', hello: 'Hello update 1', name: 'Name update 1'}});
  // console.log('updated', updated);

  // const deleted = await testDB.delete({model: {id: '1'}});
  // console.log('deleted', deleted);

  // const found = await testDB.findOne({model: {id: '1'}});
  // console.log('found', found);

  // const created2 = await testDB.create({model: {id: '2', hello: 'world 2', name: 'Test 2', age: 20}});
  // const created3 = await testDB.create({model: {id: '3', hello: 'world 3', name: 'Test 3', age: 30}});
  // const created4 = await testDB.create({model: {id: '4', hello: 'world 4', name: 'Test 4', age: 40}});
  // // console.log('created', created);
  // console.log('created', created, created2, created3);

  const found = await testDB.find({
    page: 3,
    // perPage: 1,

    // index: {
    //     indexName: 'name-index',
    //     query: {
    //         name: 'Test 3'
    //     },
    // },
    query: {
      // age: { $lte: "30" },
      // age: { $nin: [30] },
      // hello: { contains: 'orld ' },
      // hello: { $not: 'orld 3' },
      // id: { $eq: '2' },
      // id: '2',
      // $and: [{ id: '2'}, {id: '3'}],
      // $or: [{ id: '2'}, {id: '3'}],
      // $and: [
      //     { $or: [ { id: '2'}, {id: '3'} ] },
      //     { $or: [ { age: 20}, { age: 30} ] },
      // ],
      // $and: [
      //     { $or: [ { id: '2'}, {id: '3'} ] },
      //     { $or: [ { age: { $in: [20]}}, { age: 33} ] },
      // ],
      // a1: {
      //     a2: {
      //         a3: {
      //             a4: 10
      //         },
      //     },
      // },
      // 'b1.b2.b3.b4.b5': 10,
      // b2: '10'
      // age: { $ne: 40 },
      // name: 'Test 4',
      // id: '2', // TODO: Search example
    },
    // search: { // TODO: Search example START
    //     query: "est",
    //     fields: ["name", "id"],
    //     operator: "or"
    // }, // TODO: Search example END

    // TODO look at it
    // useIndex: true,
    // indexName: 'nn'
    sort: { createdOn: -1, id: 1 },
    search: {
      query: "est",
      fields: ["name", "id"],
      operator: "or",
    },
  });
  console.log("found", found);
}

// runTest();

export default DynamoDbDriver;
