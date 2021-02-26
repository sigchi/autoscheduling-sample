function getTimestamp(date) {
    return Date.parse(date);
}

function getTimeSlotDuration({startDate, endDate}) {
    return getTimestamp(endDate) - getTimestamp(startDate);
}

function getTimeSlotsDuration(firstTimeSlot, lastTimeSlot) {
    return getTimestamp(lastTimeSlot.endDate) - getTimestamp(firstTimeSlot.startDate);
}

function getItemDuration(item, contents, types) {
    return item.contentIds.reduce((sum, contentId) => {
        if (contents[contentId].typeId) {
            sum += types[contents[contentId].typeId].duration * 60 * 1000;
        }
        return sum;
    }, 0);
}

module.exports.getTimestamp = getTimestamp;
module.exports.getTimeSlotDuration = getTimeSlotDuration;
module.exports.getTimeSlotsDuration = getTimeSlotsDuration;
module.exports.getItemDuration = getItemDuration;
