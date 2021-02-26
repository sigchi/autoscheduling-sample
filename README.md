# Autoscheduling sample

Simple example of custom autoscheduling module. Includes scheduling session and events to grid cells (time slots and rooms) according to a set of configurable rules.

## Prerequisites
- [Node.js](http://nodejs.org/) (>= 8.0)
- [NPM](https://www.npmjs.com/) (>= 5.0)

## Installation
```
npm install
```

## Running
```
npm run start -- <path-to-file> <path-to-config-file> [--unschedule-all] [--manage-left-sessions]
```
`path-to-file` - required. Specify path to json file with conference current scheduling data exported from QOALA that you need to work on.

`path-to-config-file` - optional. You can use custom autoscheduling configurations. Specify path to file with configuration parameters (see defaults in `configs/default.js`).

`--unschedule-all` - optional. Specify if currently scheduled sessions and events need to be unscheduled before autoscheduling (i.e. if they are to be rescheduled).

`--manage-left-sessions` - optional. Specify if you want sessions and events that cannot be scheduled according to rules to be scheduled bypassing the rules (after main scheduling process in completed).

