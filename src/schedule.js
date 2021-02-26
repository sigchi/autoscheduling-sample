const getTimestamp = require('./schedule.utils').getTimestamp;
const getTimeSlotDuration = require('./schedule.utils').getTimeSlotDuration;

function createCell(room, timeSlot, types) {
    return {
        room: room,
        timeSlot: timeSlot,
        duration: getTimeSlotDuration(timeSlot),
        type: types[room.typeId],
        sessions: [],
        events: []
    }
}

function addCell(schedule, cell) {
    schedule.orderedCells.push(cell);

    if (!schedule.columns[cell.room.id]) {
        schedule.columns[cell.room.id] = {};
    }
    schedule.columns[cell.room.id][cell.timeSlot.id] = cell;

    if (!schedule.rows[cell.timeSlot.id]) {
        schedule.rows[cell.timeSlot.id] = {};
    }
    schedule.rows[cell.timeSlot.id][cell.room.id] = cell
}

function orderScheduleCells(schedule) {
    schedule.orderedCells = schedule.orderedCells.sort(
        (firstCell, secondCell) => firstCell.duration - secondCell.duration
    );
}

module.exports.createSchedule = function createSchedule({rooms, timeSlots, types}) {
    const schedule = {
        orderedCells: [],
        columns: {},
        rows: {},
        scheduleSession: function (cell, session) {
            cell.sessions.push(session);
            session.roomId = cell.room.id;
            session.timeSlotId = cell.timeSlot.id;
            session.isScheduled = true;
        },
        scheduleEvent: function (cells, event) {
            cells.forEach(cell => cell.events.push(event));
            event.roomId = cells[0].room.id;
            event.startDate = cells[0].timeSlot.startDate;
            event.endDate = cells[cells.length - 1].timeSlot.endDate;
            event.isScheduled = true;
        }
    };

    Object.values(rooms).forEach(
        room => Object.values(timeSlots).forEach(
            timeSlot => addCell(schedule, createCell(room, timeSlot, types))
        )
    );

    orderScheduleCells(schedule);
    return schedule;
};

function fillInWithSessions(schedule, sessions) {
    Object.values(sessions)
        .filter(session => session.isScheduled && session.roomId)
        .forEach(session => schedule.columns[session.roomId][session.timeSlotId].sessions.push(session));
}

function fillInWithEvents(schedule, events) {
    Object.values(events)
        .filter(event => event.isScheduled && event.roomId)
        .forEach(event => Object.values(schedule.columns[event.roomId])
            .filter(cell => getTimestamp(cell.timeSlot.startDate) >= getTimestamp(event.startDate)
                && getTimestamp(cell.timeSlot.endDate) <= getTimestamp(event.endDate))
            .forEach(cell => cell.events.push(event))
        );
}

module.exports.fillSchedule = function fillSchedule(schedule, {sessions, events}) { // filling schedule object already scheduled sessions and events
    fillInWithSessions(schedule, sessions);
    fillInWithEvents(schedule, events);
    return schedule;
};
