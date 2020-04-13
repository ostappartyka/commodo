import { withStorage } from "@commodo/fields-storage";
import { withId } from "@commodo/fields-storage-dynamodb";
import { database } from "./../database";
import { compose } from "ramda";
import { DynamoDbDriver } from '../../src';

const createModel = base =>
    compose(
        withId(),
        withStorage({
            driver: new DynamoDbDriver({
                database,
                aggregateTotalCount: false,
                tableName: 'Test',
            })
        })
    )(base);

export default createModel;
