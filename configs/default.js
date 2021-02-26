const _ = require('lodash');
const APPLIES_TO = require('../variables').APPLIES_TO;
const ITEM_TYPE = require('../variables').ITEM_TYPE;  // can be session, event
const getItemDuration = require('../src/schedule.utils').getItemDuration; // session and event duration are calculated as total duration of all content items it contains. Duration of a content item is defined by its type.

const SCHEDULING_TYPES_ORDER = ['course', 'panel', 'case study', 'SIG', 'workshop', 'paper', null]; // This order defines sessions of which types will be scheduled first. null means all other session types and events

/** CONDITIONS [ {
 * fn: function(cell, item, contents, types, schedule): boolean - each condition corresponds to a rule of scheduling i.e. if value of condition is 'True' it means that item (session/event) can be scheduled to the current cell.
 *
 * priority: number - > 0, Indicates the priority of the condition (from 0 to x), if the --manage-left-sessions flag is enabled. Priority 0 means condition is always required.
 * Conditions with highest priorities will be ignored first during consecutive rounds of autoscheduling
 *
 * appliesTo: Array<'SESSION' | 'EVENT'> - Indicates for what types of elements the condition applies to.
 * ]
 **/
module.exports.CONDITIONS = [
    {
        fn: function isItemNotScheduled(cell, item) {
            return !item.isScheduled;
        },
        priority: 0,
        appliesTo: APPLIES_TO.ALL
    },
    {
        fn: function isCellEmpty(cell) {
            return cell.sessions.length === 0 && cell.events.length === 0;
        },
        priority: 0,
        appliesTo: APPLIES_TO.ALL
    },
    {
        fn: function isDurationFit(cell, session, contents, types) {
            return cell.duration >= getItemDuration(session, contents, types);
        },
        priority: 0,
        appliesTo: APPLIES_TO.SESSION
    },
    {
        fn: function isContentTypeMatch(cell, session, contents, types) {
            const excludedTypeNames = ['event', 'invited talk', 'operations', 'plenary'];
            return !!session.typeId && !excludedTypeNames.includes(types[session.typeId].name.toLowerCase());
        },
        priority: 0,
        appliesTo: APPLIES_TO.SESSION
    },
    {
        fn: function isTimeSlotNotOverlapped(cell) {
            return !cell.timeSlot.isOverlapped;
        },
        priority: 0,
        appliesTo: APPLIES_TO.ALL
    },
    {
        fn: function isCompatibleByPeople(cell, item, contents, types, schedule) {
            function getAuthorIds(item, contents) {
                return item.contentIds.reduce((authorIds, contentId) => {
                    authorIds.push(...contents[contentId].authors.map(author => author.personId));
                    return authorIds;
                }, []);
            }

            function getPeopleIds(item, contents) {
                const people = [...item.chairIds, ...getAuthorIds(item, contents)];
                if (item.presenterIds) {
                    Array.prototype.push.apply(people, item.presenterIds);
                }
                return people;
            }

            const itemPeopleIds = getPeopleIds(item, contents);
            return !Object.values(schedule.rows[cell.timeSlot.id]).some(
                scheduleCell => [...scheduleCell.sessions, ...scheduleCell.events].some(
                    scheduledItem => getPeopleIds(scheduledItem, contents).some(personId => itemPeopleIds.includes(personId))
                )
            );
        },
        priority: 0,
        appliesTo: APPLIES_TO.ALL
    },
    {
        fn: function isCompatibleByTimeSlot(cell, session, contents, types) {
            return cell.timeSlot.type === 'SESSION'
                || (session.typeId && cell.timeSlot.type.toLowerCase() === types[session.typeId].name.toLowerCase());
        },
        priority: 1,
        appliesTo: APPLIES_TO.SESSION
    },
    {
        fn: function isCompatibleByType(cell, session) {
            return cell.type.id === session.typeId;
        },
        priority: 2,
        appliesTo: APPLIES_TO.ALL
    }
];

// This order defines sessions of which types / events will be scheduled first.
module.exports.sortItems = function (items, contents, types) {
    return _.orderBy(items, [
        item => item.type === ITEM_TYPE.SESSION,
        item => {
            if (item.type === ITEM_TYPE.SESSION) {
                const index = SCHEDULING_TYPES_ORDER.findIndex(type => item.typeId && type === types[item.typeId].name.toLowerCase());
                return index === -1 ? SCHEDULING_TYPES_ORDER.length : index;
            }
            return null;
        },
        item => getItemDuration(item, contents, types)
    ]);
};
