// EventPulse - Venue Map Data Definition & Indoor Spatial Graph
// High-efficiency architectural graph representation with rooms, corridors, doors, and directional vectors

const VENUE_DATA = {
  bounds: { width: 1000, height: 720 },

  // Architectural Macro Rooms & Zones (Defined physical walls)
  zones: [
    {
      id: 'zone_keynote',
      name: 'Grand Auditorium (Main 1)',
      x: 50, y: 50, w: 270, h: 230,
      color: 'rgba(2, 132, 199, 0.08)',
      wallColor: '#0284c7',
      wallWidth: 4,
      icon: '🏛️',
      subtext: 'Main Keynote Stage • Capacity 1,500'
    },
    {
      id: 'zone_expo',
      name: 'Innovation & Merch Expo',
      x: 360, y: 50, w: 320, h: 230,
      color: 'rgba(147, 51, 234, 0.08)',
      wallColor: '#9333ea',
      wallWidth: 4,
      icon: '💡',
      subtext: 'Partner Pavilions & Swag'
    },
    {
      id: 'zone_food',
      name: 'Food Court & Dining Plaza',
      x: 720, y: 50, w: 230, h: 290,
      color: 'rgba(217, 119, 6, 0.08)',
      wallColor: '#d97706',
      wallWidth: 4,
      icon: '🍔',
      subtext: '4 Artisan Stalls & Coffee'
    },
    {
      id: 'zone_workshops',
      name: 'Workshop Suites A & B',
      x: 50, y: 410, w: 270, h: 250,
      color: 'rgba(5, 150, 105, 0.08)',
      wallColor: '#059669',
      wallWidth: 4,
      icon: '💻',
      subtext: 'Hands-on Coding Labs'
    },
    {
      id: 'zone_lounge',
      name: 'Quiet Buffer Lounge & Charging',
      x: 360, y: 410, w: 320, h: 250,
      color: 'rgba(79, 70, 229, 0.08)',
      wallColor: '#4f46e5',
      wallWidth: 4,
      icon: '🛋️',
      subtext: 'Sensory-Friendly Space & Power'
    },
    {
      id: 'zone_services',
      name: 'First Aid & Services Hub',
      x: 720, y: 410, w: 230, h: 250,
      color: 'rgba(225, 29, 72, 0.08)',
      wallColor: '#e11d48',
      wallWidth: 4,
      icon: '🏥',
      subtext: 'Medical Bay & Restrooms'
    }
  ],

  // Architectural Doors & Entrance Thresholds (Concrete entry/exit points)
  doors: [
    { id: 'door_keynote_main', label: 'Main Doors 🚪', x: 190, y: 220, w: 36, h: 12, orientation: 'horizontal', zone: 'zone_keynote' },
    { id: 'door_keynote_vip', label: 'VIP Gate 🚪', x: 100, y: 120, w: 24, h: 12, orientation: 'vertical', zone: 'zone_keynote' },
    { id: 'door_expo_west', label: 'Expo Portal 🚪', x: 360, y: 180, w: 12, h: 36, orientation: 'vertical', zone: 'zone_expo' },
    { id: 'door_expo_south', label: 'Expo South 🚪', x: 520, y: 280, w: 36, h: 12, orientation: 'horizontal', zone: 'zone_expo' },
    { id: 'door_food_gate', label: 'Food Court Entry 🚪', x: 720, y: 280, w: 12, h: 36, orientation: 'vertical', zone: 'zone_food' },
    { id: 'door_wsa', label: 'Workshop A Door 🚪', x: 130, y: 480, w: 28, h: 12, orientation: 'horizontal', zone: 'zone_workshops' },
    { id: 'door_wsb', label: 'Workshop B Door 🚪', x: 230, y: 480, w: 28, h: 12, orientation: 'horizontal', zone: 'zone_workshops' },
    { id: 'door_lounge', label: 'Quiet Air-Lock 🚪', x: 520, y: 410, w: 36, h: 12, orientation: 'horizontal', zone: 'zone_lounge' },
    { id: 'door_services', label: 'Medical Door 🚪', x: 720, y: 460, w: 12, h: 30, orientation: 'vertical', zone: 'zone_services' },
    { id: 'door_wc', label: 'Restroom Entry 🚪', x: 770, y: 520, w: 32, h: 12, orientation: 'horizontal', zone: 'zone_services' }
  ],

  // Physical Pillars / Anchors (Labeled stickers in the venue)
  anchors: [
    { code: 'A1', name: 'Pillar A1 (Grand Entrance Plaza)', x: 190, y: 350, nodeRef: 'n_a1' },
    { code: 'A2', name: 'Pillar A2 (Keynote Lobby Foyer)', x: 190, y: 220, nodeRef: 'n_a2' },
    { code: 'B1', name: 'Pillar B1 (West Galleria Junction)', x: 360, y: 350, nodeRef: 'n_b1' },
    { code: 'B2', name: 'Pillar B2 (Innovation Expo Center)', x: 520, y: 220, nodeRef: 'n_b2' },
    { code: 'B3', name: 'Pillar B3 (East Galleria Junction)', x: 680, y: 350, nodeRef: 'n_b3' },
    { code: 'B4', name: 'Pillar B4 (Food Court Plaza)', x: 830, y: 280, nodeRef: 'n_b4' },
    { code: 'C1', name: 'Pillar C1 (Workshop Corridor)', x: 190, y: 480, nodeRef: 'n_c1' },
    { code: 'C2', name: 'Pillar C2 (Quiet Lounge Core)', x: 520, y: 480, nodeRef: 'n_c2' },
    { code: 'C3', name: 'Pillar C3 (Services Desk / South Gate)', x: 830, y: 480, nodeRef: 'n_c3' },
    { code: 'D1', name: 'Pillar D1 (Auditorium Stage Door)', x: 100, y: 120, nodeRef: 'n_d1' }
  ],

  // Spatial POI Nodes (Points of Interest)
  nodes: {
    // Main Pillars & Hallway Intersections
    'n_a1': { id: 'n_a1', label: 'Entrance Plaza (A1)', x: 190, y: 350, cat: 'anchor', icon: '📍', isAnchor: true, anchorCode: 'A1' },
    'n_a2': { id: 'n_a2', label: 'Keynote Foyer (A2)', x: 190, y: 220, cat: 'anchor', icon: '📍', isAnchor: true, anchorCode: 'A2' },
    'n_b1': { id: 'n_b1', label: 'West Concourse (B1)', x: 360, y: 350, cat: 'anchor', icon: '📍', isAnchor: true, anchorCode: 'B1' },
    'n_b2': { id: 'n_b2', label: 'Expo Central (B2)', x: 520, y: 220, cat: 'anchor', icon: '📍', isAnchor: true, anchorCode: 'B2' },
    'n_b3': { id: 'n_b3', label: 'East Concourse (B3)', x: 680, y: 350, cat: 'anchor', icon: '📍', isAnchor: true, anchorCode: 'B3' },
    'n_b4': { id: 'n_b4', label: 'Food Plaza (B4)', x: 830, y: 280, cat: 'anchor', icon: '📍', isAnchor: true, anchorCode: 'B4' },
    'n_c1': { id: 'n_c1', label: 'Workshop Alley (C1)', x: 190, y: 480, cat: 'anchor', icon: '📍', isAnchor: true, anchorCode: 'C1' },
    'n_c2': { id: 'n_c2', label: 'Lounge Crossing (C2)', x: 520, y: 480, cat: 'anchor', icon: '📍', isAnchor: true, anchorCode: 'C2' },
    'n_c3': { id: 'n_c3', label: 'Services Desk (C3)', x: 830, y: 480, cat: 'anchor', icon: '📍', isAnchor: true, anchorCode: 'C3' },
    'n_d1': { id: 'n_d1', label: 'VIP Stage Door (D1)', x: 100, y: 120, cat: 'anchor', icon: '📍', isAnchor: true, anchorCode: 'D1' },

    // Primary Venues (Always prominent text)
    'main_keynote': {
      id: 'main_keynote',
      label: 'Main Stage: Keynote Hall',
      x: 150, y: 130,
      cat: 'main_event',
      icon: '🏛️',
      desc: '1,500 Seat Auditorium. Keynote speeches and major presentations.',
      stepFree: true,
      time: '11:30 AM • In Progress'
    },
    'main_stage2': {
      id: 'main_stage2',
      label: 'Stage 2: Tech Spotlight',
      x: 440, y: 120,
      cat: 'main_event',
      icon: '⚡',
      desc: 'Tech talks, product demos, developer firesides.',
      stepFree: true,
      time: '1:00 PM • Starts in 45m'
    },

    // Workshops & Small Events
    'ws_room_a': {
      id: 'ws_room_a',
      label: 'Workshop A: AI Agents',
      x: 130, y: 560,
      cat: 'small_event',
      icon: '🤖',
      desc: 'Hands-on lab: Building offline edge AI systems.',
      stepFree: true,
      time: '2:00 PM'
    },
    'ws_room_b': {
      id: 'ws_room_b',
      label: 'Workshop B: Hardware Hacking',
      x: 230, y: 560,
      cat: 'small_event',
      icon: '🔧',
      desc: 'Microcontrollers, IoT and low-power mesh networking.',
      stepFree: false, // Accessible via elevator only
      stairsRequired: true,
      time: '2:30 PM'
    },

    // Detailed Food Stalls (Revealed upon Semantic Zoom)
    'food_coffee': {
      id: 'food_coffee',
      label: 'Artisan Espresso Bar',
      x: 760, y: 120,
      cat: 'food',
      icon: '☕',
      desc: 'Fresh roast pour-overs, iced lattes, organic pastries.',
      stepFree: true
    },
    'food_burger': {
      id: 'food_burger',
      label: 'Smash Burger Co.',
      x: 880, y: 120,
      cat: 'food',
      icon: '🍔',
      desc: 'Grass-fed beef & plant-based smash patties with brioche.',
      stepFree: true
    },
    'food_pizza': {
      id: 'food_pizza',
      label: 'Firestone Artisan Pizza',
      x: 760, y: 220,
      cat: 'food',
      icon: '🍕',
      desc: 'Sourdough wood-fired slices & calzones.',
      stepFree: true
    },
    'food_tacos': {
      id: 'food_tacos',
      label: 'El Fuego Taco Stand',
      x: 880, y: 220,
      cat: 'food',
      icon: '🌮',
      desc: 'Street tacos with homemade salsa bar & churros.',
      stepFree: true
    },

    // Detailed Merch & Partner Stalls (Revealed upon Semantic Zoom)
    'merch_official': {
      id: 'merch_official',
      label: 'Official Event Swag & Hoodies',
      x: 600, y: 120,
      cat: 'merch',
      icon: '👕',
      desc: 'Limited edition jackets, conference tees, sticker packs.',
      stepFree: true
    },
    'merch_vr': {
      id: 'merch_vr',
      label: 'VR / Gaming Playground',
      x: 440, y: 260,
      cat: 'merch',
      icon: '🎮',
      desc: 'Try out new spatial computing headsets and indie games.',
      stepFree: true
    },
    'merch_books': {
      id: 'merch_books',
      label: 'Tech Books & Hardware Lab',
      x: 600, y: 260,
      cat: 'merch',
      icon: '📚',
      desc: 'Coding books, mechanical keyboards, micro-soldering kits.',
      stepFree: true
    },

    // Lounges / Buffer
    'buff_quiet': {
      id: 'buff_quiet',
      label: 'Sensory-Friendly Quiet Room',
      x: 420, y: 550,
      cat: 'buffer',
      icon: '🎧',
      desc: 'Low-lighting, noise-cancelling headphones, zero loud audio.',
      stepFree: true
    },
    'buff_charging': {
      id: 'buff_charging',
      label: 'Power Station & Co-Work',
      x: 580, y: 550,
      cat: 'buffer',
      icon: '⚡',
      desc: 'High-speed fast chargers, standing desks, laptop plugs.',
      stepFree: true
    },

    // Restrooms & Medical Services
    'restroom_main': {
      id: 'restroom_main',
      label: 'Main Restrooms (East Wing)',
      x: 770, y: 560,
      cat: 'restroom',
      icon: '🚻',
      desc: 'Multi-stall restrooms with baby care facilities.',
      stepFree: true
    },
    'restroom_wheelchair': {
      id: 'restroom_wheelchair',
      label: 'Accessible / All-Gender Restroom',
      x: 880, y: 560,
      cat: 'restroom',
      icon: '♿',
      desc: 'Dedicated single-occupancy wheelchair-accessible restroom.',
      stepFree: true
    },
    'first_aid_station': {
      id: 'first_aid_station',
      label: 'Medical & First Aid Center',
      x: 880, y: 460,
      cat: 'first_aid',
      icon: '🩹',
      desc: 'Registered nurses on duty, emergency medical kits & AED.',
      stepFree: true
    }
  },

  // Hallway Corridors (Architectural paths with physical width)
  edges: [
    // Concourse Spine (East-West Highway)
    { id: 'e_a1_b1', from: 'n_a1', to: 'n_b1', dist: 35, width: 26, name: 'Main Concourse West', isBlocked: false, hasStairs: false },
    { id: 'e_b1_b3', from: 'n_b1', to: 'n_b3', dist: 50, width: 30, name: 'Central Galleria Highway', isBlocked: false, hasStairs: false },
    { id: 'e_b3_b4', from: 'n_b3', to: 'n_b4', dist: 30, width: 24, name: 'Food Court Aisle', isBlocked: false, hasStairs: false },

    // North-South Arteries
    { id: 'e_a2_a1', from: 'n_a2', to: 'n_a1', dist: 25, width: 24, name: 'Keynote Grand Foyer Aisle', isBlocked: false, hasStairs: false },
    { id: 'e_a1_c1', from: 'n_a1', to: 'n_c1', dist: 25, width: 22, name: 'Workshop North Passage', isBlocked: false, hasStairs: false },
    { id: 'e_b2_b1', from: 'n_b2', to: 'n_b1', dist: 30, width: 24, name: 'Expo North-South Connector', isBlocked: false, hasStairs: false },
    { id: 'e_b1_c2', from: 'n_b1', to: 'n_c2', dist: 35, width: 24, name: 'Lounge Cross Corridor', isBlocked: false, hasStairs: false },
    { id: 'e_b3_c3', from: 'n_b3', to: 'n_c3', dist: 30, width: 22, name: 'Services South Hallway', isBlocked: false, hasStairs: false },
    { id: 'e_b4_c3', from: 'n_b4', to: 'n_c3', dist: 38, width: 22, name: 'Food-to-Services Corridor', isBlocked: false, hasStairs: false },

    // Cross Links
    { id: 'e_a2_b2', from: 'n_a2', to: 'n_b2', dist: 65, width: 20, name: 'North Balcony Walkway', isBlocked: false, hasStairs: true }, // STAIRWAY!
    { id: 'e_c1_c2', from: 'n_c1', to: 'n_c2', dist: 65, width: 24, name: 'South Garden Promenade', isBlocked: false, hasStairs: false },
    { id: 'e_c2_c3', from: 'n_c2', to: 'n_c3', dist: 60, width: 22, name: 'South Service Walkway', isBlocked: false, hasStairs: false },

    // Main Stage Connections via Doors
    { id: 'e_a2_main', from: 'n_a2', to: 'main_keynote', dist: 15, width: 22, name: 'Auditorium Main Double Doors', isBlocked: false, hasStairs: false, doorId: 'door_keynote_main' },
    { id: 'e_d1_main', from: 'n_d1', to: 'main_keynote', dist: 10, width: 18, name: 'Stage 1 VIP Ramp', isBlocked: false, hasStairs: false, doorId: 'door_keynote_vip' },
    { id: 'e_a2_d1', from: 'n_a2', to: 'n_d1', dist: 22, width: 18, name: 'Backstage Passage', isBlocked: false, hasStairs: false },

    // Expo & Stage 2 Connections
    { id: 'e_b2_stage2', from: 'n_b2', to: 'main_stage2', dist: 18, width: 20, name: 'Stage 2 Entryway', isBlocked: false, hasStairs: false },
    { id: 'e_b2_merch', from: 'n_b2', to: 'merch_official', dist: 20, width: 18, name: 'Official Merch Aisle', isBlocked: false, hasStairs: false },
    { id: 'e_b2_vr', from: 'n_b2', to: 'merch_vr', dist: 16, width: 18, name: 'Gaming Zone Entry', isBlocked: false, hasStairs: false },
    { id: 'e_b2_books', from: 'n_b2', to: 'merch_books', dist: 18, width: 18, name: 'Tech Books Aisle', isBlocked: false, hasStairs: false },

    // Food Court Stall Connections
    { id: 'e_b4_coffee', from: 'n_b4', to: 'food_coffee', dist: 15, width: 18, name: 'Coffee Kiosk Walkway', isBlocked: false, hasStairs: false },
    { id: 'e_b4_burger', from: 'n_b4', to: 'food_burger', dist: 18, width: 18, name: 'Burger Counter Ramp', isBlocked: false, hasStairs: false },
    { id: 'e_b4_pizza', from: 'n_b4', to: 'food_pizza', dist: 14, width: 18, name: 'Pizza Plaza Aisle', isBlocked: false, hasStairs: false },
    { id: 'e_b4_tacos', from: 'n_b4', to: 'food_tacos', dist: 16, width: 18, name: 'Taco Courtyard', isBlocked: false, hasStairs: false },

    // Workshop Connections via Doors
    { id: 'e_c1_wsa', from: 'n_c1', to: 'ws_room_a', dist: 16, width: 20, name: 'Workshop A Entry Door', isBlocked: false, hasStairs: false, doorId: 'door_wsa' },
    { id: 'e_c1_wsb', from: 'n_c1', to: 'ws_room_b', dist: 20, width: 20, name: 'Workshop B Stairway Entrance', isBlocked: false, hasStairs: true, doorId: 'door_wsb' }, // STAIRWAY!

    // Lounge Connections via Door
    { id: 'e_c2_quiet', from: 'n_c2', to: 'buff_quiet', dist: 18, width: 18, name: 'Quiet Room Air-Lock Door', isBlocked: false, hasStairs: false, doorId: 'door_lounge' },
    { id: 'e_c2_charge', from: 'n_c2', to: 'buff_charging', dist: 16, width: 18, name: 'Charging Station Aisle', isBlocked: false, hasStairs: false },

    // Services & Restrooms via Doors
    { id: 'e_c3_wc', from: 'n_c3', to: 'restroom_main', dist: 15, width: 20, name: 'Restroom Entryway Door', isBlocked: false, hasStairs: false, doorId: 'door_wc' },
    { id: 'e_c3_accwc', from: 'n_c3', to: 'restroom_wheelchair', dist: 18, width: 20, name: 'Accessible Restroom Ramp', isBlocked: false, hasStairs: false },
    { id: 'e_c3_firstaid', from: 'n_c3', to: 'first_aid_station', dist: 12, width: 20, name: 'First Aid Emergency Door', isBlocked: false, hasStairs: false, doorId: 'door_services' }
  ]
};

// Ensure global accessibility
window.VENUE_DATA = VENUE_DATA;
