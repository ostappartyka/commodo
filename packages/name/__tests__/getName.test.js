import { withName, getName } from "@commodo/name";
import { compose } from "ramda";

test(`"getName" must return true or false accordingly`, async () => {
    const ModelWithName = compose(withName("TestModel1"))();
    const ModelWithoutName = function() {};
    expect(getName(ModelWithName)).toBe("TestModel1");
    expect(getName(ModelWithoutName)).toBe("");
});

test(`based on given model name, "getName" must return true or false accordingly`, async () => {
    const ModelWithName = compose(withName("TestModel1"))();
    const ModelWithoutName = function() {};

    const modelWithName = new ModelWithName();
    const modelWithoutName = new ModelWithoutName();
    expect(getName(modelWithName)).toBe("TestModel1");
    expect(getName(modelWithoutName)).toBe("");
});
