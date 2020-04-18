class FindCursorMock {
    constructor() {
        this.data = [];
    }

    limit() {
        return this;
    }
    skip() {
        return this;
    }
    sort() {
        return this;
    }
    each(callback) {
        const err = null;
        this.data.forEach(item => {
            callback(err, item);
        });
    }
    toArray() {
        return this.data;
    }
}

export default new FindCursorMock();
