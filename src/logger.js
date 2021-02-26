const logs = [];

module.exports.saveLog = function (log) {
    logs.push(log);
};
module.exports.getLogs = function () {
    return logs.join("\n");
};
