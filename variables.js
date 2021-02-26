const ITEM_TYPE = {SESSION: 'session', EVENT: 'event'};
const APPLIES_TO = {
    SESSION: [ITEM_TYPE.SESSION],
    EVENT: [ITEM_TYPE.EVENT],
    ALL: Object.values(ITEM_TYPE)
};

module.exports.ITEM_TYPE = ITEM_TYPE;
module.exports.APPLIES_TO = APPLIES_TO;
