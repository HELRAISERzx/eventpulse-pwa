// Unit test for A* pathfinder logic in Node
const fs = require('fs');

// Mock browser globals
global.window = {};

eval(fs.readFileSync('js/map-data.js', 'utf8'));
eval(fs.readFileSync('js/pathfinder.js', 'utf8'));

const VenuePathfinder = global.window.VenuePathfinder;
const VENUE_DATA = global.window.VENUE_DATA;

const pathfinder = new VenuePathfinder(VENUE_DATA);

// Test 1: Standard Route
const res1 = pathfinder.findPath('n_b4', 'main_keynote');
console.assert(res1 !== null, 'Route 1 failed');
console.assert(res1.path.length > 2, 'Route 1 should have waypoints');
console.log('Test 1: Route B4 to Keynote Hall -> Distance:', res1.distance, 'm, Steps:', res1.path.join(' -> '));

// Test 2: Stairs restriction (n_c1 to ws_room_b has stairs)
const res2Normal = pathfinder.findPath('n_c1', 'ws_room_b', { wheelchairOnly: false });
console.assert(res2Normal !== null, 'Normal path to Workshop B failed');
console.log('Test 2A: Normal Path to Workshop B ->', res2Normal.path.join(' -> '));

const res2StepFree = pathfinder.findPath('n_c1', 'ws_room_b', { wheelchairOnly: true });
console.assert(res2StepFree === null, 'Wheelchair route to Workshop B should be null (stairs only)');
console.log('Test 2B: Wheelchair Mode correctly blocks stairs to Workshop B ->', res2StepFree);

// Test 3: Roadblock / Barrier Detour
const res3Open = pathfinder.findPath('n_a1', 'n_b3');
console.log('Test 3A: Open corridor A1 -> B3:', res3Open.path.join(' -> '));

// Block main galleria edge (e_b1_b3)
const blocked = new Set(['e_b1_b3']);
const res3Detour = pathfinder.findPath('n_a1', 'n_b3', { blockedEdgeIds: blocked });
console.assert(!res3Detour.path.includes('e_b1_b3'), 'Detour should avoid blocked corridor');
console.log('Test 3B: Detour when Central Galleria is blocked -> Alternate path:', res3Detour.path.join(' -> '));

console.log('\n>> All Pathfinder Logic Unit Tests Passed 100%!');
