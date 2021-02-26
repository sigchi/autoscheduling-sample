const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const createSchedule = require('./src/schedule').createSchedule;
const fillSchedule = require('./src/schedule').fillSchedule;
const getTimeSlotsDuration = require('./src/schedule.utils').getTimeSlotsDuration;
const getTimestamp = require('./src/schedule.utils').getTimestamp;
const getItemDuration = require('./src/schedule.utils').getItemDuration;
const Logger = require('./src/logger');
const ITEM_TYPE = require('./variables').ITEM_TYPE;

console.time("Autoscheduling time");
const args = process.argv.slice(2).filter(arg => !arg.includes('--'));
const flags = process.argv.slice(2).filter(arg => arg.includes('--'));
const isNeedUnscheduleAll = flags.includes('--unschedule-all');
const isIgnoreConditionsForNotScheduled = flags.includes('--manage-left-sessions');

const relativePathToFile = args[0];
const absolutePathToFile = path.resolve(relativePathToFile);
const scheduleContext = JSON.parse(fs.readFileSync(absolutePathToFile));

const fileName = path.basename(absolutePathToFile, path.extname(absolutePathToFile));

const autoschedulingConfigsFilePath = path.resolve(args[1] || 'configs/default');
const CONDITIONS = require(autoschedulingConfigsFilePath).CONDITIONS;
const sortItems = require(autoschedulingConfigsFilePath).sortItems;

/** Input data structure: ScheduleContext {
 * rooms: {[id]: {id, typeId, setup, capacity}}
 * timeSlots: {[id]: {id, startDate, endDate, type}}
 * types: {[id]: {id, name, duration}}
 * sessions: {[id]: {id, typeId, roomId, timeSlotId, contentIds, chairIds, isScheduled}}
 * events: {[id]: {id, typeId, roomId, startDate, endDate, contentIds, chairIds, isScheduled, location, coordinates, presenterIds, isPrivate}}
 * contents: {[id]: {id, typeId, award, keywords, tags, authors:[{institutions, personId}]}}
 * }
 **/

function calculateTimeSlotOverlaps({timeSlots}) { // Analyze time slots, find overlapping by time and mark them as 'isOverlapped'
    Object.values(timeSlots).forEach(timeSlot => {
        if (timeSlot.hasOwnProperty('isOverlapped')) {
            return;
        }
        timeSlot.isOverlapped = Object.values(timeSlots).some(secondTimeSlot => {
            if (timeSlot !== secondTimeSlot) {
                const firstTimeSlotStart = getTimestamp(timeSlot.startDate);
                const firstTimeSlotEnd = getTimestamp(timeSlot.endDate);
                const secondTimeSlotStart = getTimestamp(secondTimeSlot.startDate);
                const secondTimeSlotEnd = getTimestamp(secondTimeSlot.endDate);

                if ((secondTimeSlotStart >= firstTimeSlotStart && secondTimeSlotStart < firstTimeSlotEnd)
                    || (secondTimeSlotEnd > firstTimeSlotStart && secondTimeSlotEnd <= firstTimeSlotEnd)
                    || (secondTimeSlotStart <= firstTimeSlotStart && secondTimeSlotEnd >= firstTimeSlotEnd)) {
                    secondTimeSlot.isOverlapped = true;
                    return true;
                }
            }
            return false;
        })
    });
}

calculateTimeSlotOverlaps(scheduleContext);
const schedule = createSchedule(scheduleContext); // Create empty scheduling grid structure

if (isNeedUnscheduleAll) { // Unscheduling already scheduled items when flag '--unschedule-all' is present
    function unschedule(item) {
        item.roomId = null;
        item.timeSlotId = null;
        item.isScheduled = false;
        item.startDate = null;
        item.endDate = null;
        if (item.location) {
            item.location = null;
            item.coordinates = null;
        }
    }

    function unscheduleAll(items) {
        Object.values(items).forEach(unschedule);
    }

    unscheduleAll(scheduleContext.sessions);
    unscheduleAll(scheduleContext.events);
} else {
    fillSchedule(schedule, scheduleContext);
}

function isCorrespondingCell(maxPriority, cell, item, contents, types, schedule) { // Checking that the cell and scheduling item (session or event) are compatible
    return CONDITIONS
        .filter(condition => condition.appliesTo.includes(item.type) && condition.priority <= maxPriority)
        .every(condition => {
            if (condition.fn(cell, item, contents, types, schedule)) {
                return true;
            } else {
                Logger.saveLog(`Wrong condition for ${item.type}:${item.id} in Cell[roomId:${cell.room.id}][timeSlotId:${cell.timeSlot.id}]:${condition.fn.name}`);
                return false;
            }
        });
}

function isTimeSlotsInTheSameDay(firstTimeSlot, secondTimeSlot) {
    return new Date(firstTimeSlot.startDate).toLocaleDateString() === new Date(secondTimeSlot.endDate).toLocaleDateString();
}

function scheduleSession(session, schedule, priority, contents, types) {
    for (const cell of schedule.orderedCells) {
        if (isCorrespondingCell(priority, cell, session, contents, types, schedule)) {
            schedule.scheduleSession(cell, session);
            break;
        }
    }
}

function scheduleEvent(event, schedule, priority, contents, types, rooms) {
    let eventCells = [];
    for (const room of Object.values(rooms)) {
        if (event.isScheduled) {
            break;
        }
        const orderedCellsInRoom = _.orderBy(schedule.columns[room.id], cell => cell.timeSlot.startDate);

        for (const cell of orderedCellsInRoom) {
            if (isCorrespondingCell(priority, cell, event, contents, types, schedule)) {
                if (eventCells.length > 0 && !isTimeSlotsInTheSameDay(eventCells[0].timeSlot, cell.timeSlot)) {
                    eventCells = [];
                }
                eventCells.push(cell);
                if (getTimeSlotsDuration(eventCells[0].timeSlot, eventCells[eventCells.length - 1].timeSlot) >= getItemDuration(event, contents, types)) {
                    schedule.scheduleEvent(eventCells, event);
                    eventCells = [];
                }
            } else {
                eventCells = [];
            }
        }

        eventCells = [];
    }
}

function autoschedule(schedule, {sessions, events, contents, types, rooms}) {
    Object.values(scheduleContext.sessions).forEach(session => session.type = ITEM_TYPE.SESSION);
    Object.values(scheduleContext.events).forEach(event => event.type = ITEM_TYPE.EVENT);
    const itemsForScheduling = sortItems(
        [...Object.values(sessions), ...Object.values(events)], contents, types
    ).filter(item => !item.isScheduled);

    for (let priority = Math.max(...CONDITIONS.map(condition => condition.priority), 0); priority >= 0; priority--) {
        itemsForScheduling.forEach(item => item.type === ITEM_TYPE.SESSION
            ? scheduleSession(item, schedule, priority, contents, types)
            : scheduleEvent(item, schedule, priority, contents, types, rooms));

        if (!isIgnoreConditionsForNotScheduled) {
            break;
        }
    }
}

autoschedule(schedule, scheduleContext);

/** Output data structure: ScheduleResult {
 * sessions: {[id]: {id, roomId, timeSlotId}}
 * events: {[id]: {id, roomId, startDate, endDate,location, coordinates}}
 * }
 **/
const scheduleResult = {
    sessions: Object.values(scheduleContext.sessions).reduce((sessionsMap, session) => {
        sessionsMap[session.id] = {id: session.id, roomId: session.roomId, timeSlotId: session.timeSlotId};
        return sessionsMap;
    }, {}),
    events: Object.values(scheduleContext.events).reduce((eventsMap, event) => {
        eventsMap[event.id] = {
            id: event.id, roomId: event.roomId, startDate: event.startDate, endDate: event.endDate,
            location: event.location, coordinates: event.coordinates
        };
        return eventsMap;
    }, {})
};

fs.writeFile(`${fileName}-result.json`, JSON.stringify(scheduleResult), () => null);
fs.writeFile(`${fileName}-result-log.txt`, Logger.getLogs(), () => null);
console.timeEnd("Autoscheduling time");
