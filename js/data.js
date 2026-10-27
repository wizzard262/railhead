// Railhead: the map and the world numbers for Summer 1941

const START_DATE = new Date(1941, 5, 22);   // day 1 = Sunday 22 June 1941
const LAST_DAY = 44;                         // 4 August 1941

// What you have each day
const TRAINS_PER_DAY = 14;      // trains leaving Warsaw
const TRUCK_COLUMNS = 14;
const ENGINEERS = 18;           // railway engineer battalions
const BOMBER_GROUPS = 6;

const TRAIN_TONS = 450;         // one supply train
const TRUCK_TONS = 300;         // one truck column, one trip
const TRUCK_KM_PER_DAY = 250;   // there and back counts double
const TRUCK_FUEL = 0.0005;      // tons of fuel burnt per ton carried per km
const CONVERT_KM = 2.5;           // track converted per engineer battalion per day
const REPAIR = 6;               // station condition repaired per battalion per day
const BOMBER_FUEL = 25;         // tons per bomber group per day, from the sector's depot
const BOMBER_LOSS = 0.04;       // chance a group is lost on each day's sorties

// What engineers do first: repair stations up to repairFirst %, then convert track, then repair the rest
const ENGINEER_FOCUS = {
  track:    { name: 'Track',    repairFirst: 25,  hint: 'Push the railhead forward; only fix stations that barely work' },
  balanced: { name: 'Balanced', repairFirst: 70,  hint: 'Fix badly damaged stations, then lay track' },
  repair:   { name: 'Repair',   repairFirst: 100, hint: 'Get every station back to full before laying track' },
};

// Stations. cap = trains a day it can pass or unload when undamaged
const NODES = {
  warsaw:      { name: 'Warsaw',      lon: 21.00, lat: 52.23, cap: 99 },
  bialystok:   { name: 'Białystok',   lon: 23.16, lat: 53.13, cap: 8 },
  lida:        { name: 'Lida',        lon: 25.30, lat: 53.89, cap: 6 },
  molodechno:  { name: 'Molodechno',  lon: 26.85, lat: 54.31, cap: 6 },
  polotsk:     { name: 'Polotsk',     lon: 28.80, lat: 55.49, cap: 6 },
  vitebsk:     { name: 'Vitebsk',     lon: 30.20, lat: 55.19, cap: 8 },
  brest:       { name: 'Brest',       lon: 23.69, lat: 52.10, cap: 10 },
  baranovichi: { name: 'Baranovichi', lon: 26.01, lat: 53.13, cap: 10 },
  minsk:       { name: 'Minsk',       lon: 27.56, lat: 53.90, cap: 10 },
  borisov:     { name: 'Borisov',     lon: 28.50, lat: 54.23, cap: 7 },
  orsha:       { name: 'Orsha',       lon: 30.41, lat: 54.51, cap: 9 },
  smolensk:    { name: 'Smolensk',    lon: 32.05, lat: 54.78, cap: 10 },
  slutsk:      { name: 'Slutsk',      lon: 27.56, lat: 53.02, cap: 5 },
  bobruisk:    { name: 'Bobruisk',    lon: 29.22, lat: 53.14, cap: 6 },
  mogilev:     { name: 'Mogilev',     lon: 30.33, lat: 53.90, cap: 7 },
  roslavl:     { name: 'Roslavl',     lon: 32.86, lat: 53.95, cap: 6 },
};

// Converted track: trains a day. Anything not listed carries 5
const LINK_CAP = {
  'warsaw|bialystok': 6, 'warsaw|brest': 11,
  'brest|baranovichi': 10, 'baranovichi|minsk': 7, 'minsk|borisov': 7,
  'borisov|orsha': 7, 'orsha|smolensk': 7,
};
const LINK_CAP_DEFAULT = 5;

// Already standard gauge on day 1, and the stations already taken
const START_CONVERTED = ['warsaw|bialystok', 'warsaw|brest'];
const START_CAPTURED = { bialystok: 60, brest: 55 };

const SECTORS = [
  { id: 'north',  name: 'North',  colour: '#2f5d8a',
    line: ['warsaw', 'bialystok', 'lida', 'molodechno', 'polotsk', 'vitebsk'],
    forces: { inf: 3, pz: 2, art: 1 }, resistance: 28 },
  { id: 'centre', name: 'Centre', colour: '#3f7a3a',
    line: ['warsaw', 'brest', 'baranovichi', 'minsk', 'borisov', 'orsha', 'smolensk'],
    forces: { inf: 4, pz: 1, art: 2 }, resistance: 34 },
  { id: 'south',  name: 'South',  colour: '#9a6a1c',
    line: ['warsaw', 'brest', 'baranovichi', 'slutsk', 'bobruisk', 'mogilev', 'roslavl'],
    forces: { inf: 3, pz: 2, art: 1 }, resistance: 28 },
];

// need = tons a day by posture; attack/defend = combat power; speed = km a day added
const UNIT_TYPES = {
  inf: { name: 'Infantry division', short: 'Inf', icon: '✕', trains: 2, march: 30,
         need: { advance: { fuel: 30, ammo: 70 }, hold: { fuel: 8, ammo: 30 } },
         attack: 1, defend: 1.5, speed: 0.5 },
  pz:  { name: 'Panzer division', short: 'Pz', icon: '⬭', trains: 3, march: 90,
         need: { advance: { fuel: 260, ammo: 80 }, hold: { fuel: 30, ammo: 25 } },
         attack: 2.5, defend: 1, speed: 3 },
  art: { name: 'Artillery regiment', short: 'Art', icon: '●', trains: 2, march: 30,
         need: { advance: { fuel: 20, ammo: 140 }, hold: { fuel: 5, ammo: 60 } },
         attack: 1.5, defend: 2.5, speed: 0 },
};
const UNIT_ORDER = ['inf', 'pz', 'art'];

const BASE_SPEED = 16;      // km a day the slowest force can march; units add their speed
const MAX_SPEED = 32;
const COMBAT_SPEED = 70;    // km a day = COMBAT_SPEED x attack power / Soviet resistance

// Units arriving at Warsaw for you to send east
const REINFORCEMENTS = [
  { day: 1, type: 'inf' }, { day: 1, type: 'art' },
  { day: 4, type: 'pz' },
  { day: 8, type: 'inf' }, { day: 8, type: 'inf' },
  { day: 12, type: 'art' }, { day: 15, type: 'pz' },
  { day: 19, type: 'inf' }, { day: 23, type: 'art' },
  { day: 27, type: 'inf' }, { day: 31, type: 'pz' },
];

const OBJECTIVES = ['vitebsk', 'smolensk', 'roslavl'];
// The Soviet side
const SOVIET_GROWTH = 12;        // reserves a day, plus SOVIET_GROWTH_PER_DAY x the day
const SOVIET_GROWTH_PER_DAY = 0.35;
const BUILDUP_CHANCE = 0.7;      // chance each quiet day that a build-up starts once reserves are ready

const HISTORICAL_DAY = 25;   // Smolensk fell on 16 July 1941
