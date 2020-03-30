import {config, DynamoDB} from 'aws-sdk';
import mdbid from 'mdbid';

config.update({region: 'eu-central-1'});

const db = new DynamoDB.DocumentClient();

class DynamoDbDriver {
    database: any;
    tableName: any;

    constructor(database, tableName) {
        this.database = database;
        this.tableName = tableName;
    }

    async save({ model, isCreate }) {
        return isCreate ? this.create({ model }) : this.update({ model });
    }

    async create({ model }) {
        const id = model.id || mdbid();
        const newItem = { ...model, id };
        // const data = await model.toStorage();

        const params = {
            TableName: this.tableName,
            Item: newItem
        };

        try {
            await db.put(params).promise();
            return true;
        } catch (e) {
            throw e;
        }
    }

    async update({ model }) {
        const { id, ...item } = model;

        const keys = Object.keys(item);

        const ExpressionAttributeNames = keys.reduce((acc, key) => {
            acc[`#${key}`] = key;
            return acc;
        }, {});
        const ExpressionAttributeValues = keys.reduce((acc, key) => {
            acc[`:${key}`] = item[key];
            return acc;
        }, {});
        const expression = keys.map(key => `#${key} = :${key}`).join(', ');
        const UpdateExpression = `SET ${expression}`;

        const params = {
            TableName: this.tableName,
            Key: { id },
            ReturnValues: 'ALL_NEW',
            ExpressionAttributeNames,
            ExpressionAttributeValues,
            UpdateExpression,
        };

        console.log('params', params);

        try {
            await db.update(params).promise();
            return true;
        } catch (e) {
            throw e;
        }
    }

    async delete({ model }) {
        const params = {
            TableName: this.tableName,
            Key: {
                id: model.id,
            }
        };

        try {
            await db.delete(params).promise();
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
            TableName: this.tableName,
            Key: {
                id: model.id
            }
        };

        try {
            return await db.get(params).promise();
        } catch (e) {
            throw e;
        }
    }


    // list of indexes
     
    //  User.find({
    //      indexes: ['nameIndex', '']
    //  })

    async find({ query, ...rest }) {
    // async find({ query, indexes, ...rest }) {
        // If index exists use query if not scan 
        // TODO flag on scan or query
        const FilterExpressionArray = [];

        const ExpressionAttributeNames = {};
        const ExpressionAttributeValues = {};

        Object.keys(query).forEach(fieldKey => {
            console.log(fieldKey);
            ExpressionAttributeNames[`#${fieldKey}`] = fieldKey;

            if(query[fieldKey].$lte) {
                ExpressionAttributeValues[`:${fieldKey}`] = query[fieldKey].$lte;
                FilterExpressionArray.push(`#${fieldKey} <= :${fieldKey}`);
                return;
            }

            if(query[fieldKey].$gte) {
                ExpressionAttributeValues[`:${fieldKey}`] = query[fieldKey].$gte;
                FilterExpressionArray.push(`#${fieldKey} >= :${fieldKey}`);
                return;
            }

            if(query[fieldKey].$gt) {
                ExpressionAttributeValues[`:${fieldKey}`] = query[fieldKey].$gt;
                FilterExpressionArray.push(`#${fieldKey} > :${fieldKey}`);
                return;
            }

            ExpressionAttributeValues[`:${fieldKey}`] = query[fieldKey];

            FilterExpressionArray.push(`#${fieldKey} = :${fieldKey}`);

        });

        const FilterExpression = FilterExpressionArray.join(' AND ');
        const params = {
            TableName: this.tableName,
            FilterExpression,
            ExpressionAttributeNames,
            ExpressionAttributeValues,
        };

        console.log('params', params);
        try {
            return db.scan(params).promise();
        } catch (e) {
            console.log(e);
            // throw e;
        }
    }

    getDatabase() {
        return this.database;
    }
}

const testDB = new DynamoDbDriver(db, 'Test2');

async function runTest() {

    console.log('*** runTest ****');

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



    // $lte  <=

    const found = await testDB.find({
        page: 3,
        perPage: 7,
        query: {
            // age: { $lte: "30" },
            age: { $gt: 22 },
            name: 'Test 4',
        },
        // TODO look at it
        // useIndex: true,
        // indexName: 'nn'
        sort: { createdOn: -1, id: 1 },
        search: {
            query: "this is",
            fields: ["name", "slug"],
            operator: "or"
        }
    });
    console.log('found', found);

};

runTest();

export default DynamoDbDriver;

