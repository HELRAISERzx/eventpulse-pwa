// EventPulse - Main Application Coordinator
// Orchestrates PWA offline capabilities, navigation flows, and dual-mode syncing

document.addEventListener('DOMContentLoaded', () => {
  // 1. Register Service Worker for Offline PWA Support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('EventPulse ServiceWorker Registered'))
      .catch((err) => console.warn('SW registration skipped:', err));
  }

  // 2. Initialize Core Subsystems
  const alerts = new GlanceAlerts();
  const pathfinder = new VenuePathfinder(VENUE_DATA);
  const canvas = document.getElementById('venueCanvas');
  const gemini = new GeminiClient(); // Gemini AI — browser-direct REST client
  // Seed API key on first load (stored in localStorage for subsequent visits)
  if (!gemini.hasKey()) {
    gemini.setKey('AIzaSyC8RAuV-2tGaGKuYog7_B5NRKpr9WOk0XU');
  }

  let activeTargetNode = null;
  let isWheelchairMode = false;

  // Interactive Map Context Popover Elements
  const popover = document.getElementById('mapContextPopover');
  const popoverTitle = document.getElementById('popoverTitle');
  const btnPopoverSetLocation = document.getElementById('btnPopoverSetLocation');
  const btnPopoverNavigate = document.getElementById('btnPopoverNavigate');
  const btnClosePopover = document.getElementById('btnClosePopover');

  let popoverSelectedNode = null;

  const hidePopover = () => {
    if (popover) popover.classList.add('hidden');
    popoverSelectedNode = null;
  };

  if (btnClosePopover) btnClosePopover.addEventListener('click', hidePopover);

  if (btnPopoverSetLocation) {
    btnPopoverSetLocation.addEventListener('click', () => {
      if (popoverSelectedNode) {
        if (popoverSelectedNode.isAnchor) {
          anchorEngine.locateByCode(popoverSelectedNode.anchorCode);
        } else {
          // Find nearest anchor
          const nearest = Object.values(VENUE_DATA.nodes).filter(n => n.isAnchor)
            .sort((a, b) => Math.hypot(a.x - popoverSelectedNode.x, a.y - popoverSelectedNode.y) - Math.hypot(b.x - popoverSelectedNode.x, b.y - popoverSelectedNode.y))[0];
          if (nearest) anchorEngine.locateByCode(nearest.anchorCode);
        }
      }
      hidePopover();
    });
  }

  if (btnPopoverNavigate) {
    btnPopoverNavigate.addEventListener('click', () => {
      if (popoverSelectedNode) {
        activeTargetNode = popoverSelectedNode;
        calculateAndDisplayRoute(popoverSelectedNode.id);
      }
      hidePopover();
    });
  }

  // Map click handler (interactive popover or node details modal)
  const onNodeClick = (node, clientX, clientY) => {
    popoverSelectedNode = node;

    // Position interactive context popover on the map canvas
    if (popover && clientX !== undefined && clientY !== undefined) {
      const rect = canvas.getBoundingClientRect();
      const popX = Math.max(90, Math.min(rect.width - 90, clientX - rect.left));
      const popY = Math.max(50, clientY - rect.top);
      popover.style.left = `${popX}px`;
      popover.style.top = `${popY}px`;
      popoverTitle.textContent = node.isAnchor ? `📍 Pillar ${node.anchorCode}` : `${node.icon || '📍'} ${node.label}`;
      popover.classList.remove('hidden');
      return;
    }

    if (node.isAnchor) {
      anchorEngine.locateByCode(node.anchorCode);
      return;
    }

    const modal = document.getElementById('modalNodeInfo');
    const title = document.getElementById('nodeInfoTitle');
    const cat = document.getElementById('nodeInfoCategory');
    const acc = document.getElementById('nodeInfoAccessibility');
    const desc = document.getElementById('nodeInfoDesc');
    const timing = document.getElementById('nodeInfoTiming');

    title.textContent = `${node.icon} ${node.label}`;
    cat.textContent = node.cat.replace('_', ' ').toUpperCase();
    acc.textContent = node.stairsRequired ? '⚠️ Stairs Required' : '♿ Step-Free';
    acc.className = `badge-sm ${node.stairsRequired ? 'text-amber-400' : 'text-emerald-400'}`;
    desc.textContent = node.desc || 'No additional details available.';
    timing.textContent = node.time ? `Scheduled: ${node.time}` : 'Open all day';

    activeTargetNode = node;
    modal.classList.remove('hidden');
  };

  const renderer = new VenueMapRenderer(canvas, VENUE_DATA, onNodeClick);

  // Wire corridor click directly on canvas in Organizer Mode
  renderer.onCorridorClick = (edge) => {
    if (renderer.isOrganizerMode && organizer) {
      organizer.toggleCorridorBarrier(edge.id);
      alerts.triggerGlanceCard(
        `🚧 Corridor Roadblock`,
        renderer.blockedEdgeIds.has(edge.id)
          ? `Virtual barrier deployed on ${edge.name}. Traffic rerouting active.`
          : `Barrier cleared on ${edge.name}. Corridor open.`,
        'amber'
      );
    }
  };

  // Anchor engine
  const anchorEngine = new AnchorEngine(VENUE_DATA, (code, nodeId) => {
    renderer.currentAnchor = nodeId;
    document.getElementById('currentAnchorBadge').textContent = `Pillar ${code}`;
    document.getElementById('sosLocationPreview').textContent = `Pillar ${code}`;
    renderer.centerOnNode(nodeId);

    // If currently navigating, recalculate route from new anchor
    if (renderer.targetNodeId) {
      calculateAndDisplayRoute(renderer.targetNodeId);
    }
  });

  // Accessibility helpdesk
  const accessibilityDesk = new AccessibilityDesk((tickets) => {
    if (organizer) {
      organizer.renderTicketsQueue();
    }
  });

  // Flock Manager
  const flockManager = new FlockManager(alerts, (update) => {
    renderFlockUI();
    if (update.event === 'FAILOVER_COMPLETE') {
      showTicker(`👑 LEADERSHIP PASSED to ${update.newLeaderName}! Last pin of ${update.lostMember}: Pillar ${update.lastLocation}`);
      alerts.triggerEmergencyAlert('Leadership failover executed.');
    }
  });

  // Broadcast receiver from organizer
  const onBroadcastReceived = (payload) => {
    if (payload.type === 'STAMPEDE_HAZARD') {
      // Critical Red Emergency Siren & Screen Strobe
      showTicker(payload.message);
      alerts.triggerEmergencyAlert(payload.message);

      // Recalculate route if navigating
      if (renderer.targetNodeId) {
        calculateAndDisplayRoute(renderer.targetNodeId);
      }
    } else if (payload.type === 'VENUE_RELOCATION') {
      showTicker(payload.message);
      alerts.triggerEmergencyAlert('Venue Relocated! Updating Route...');

      if (payload.newTargetId) {
        // Automatically redraw route to new venue
        calculateAndDisplayRoute(payload.newTargetId);
      }
    } else if (payload.type === 'CROWD_DIVERSION') {
      showTicker(payload.message);
      alerts.triggerTurnAlert('Crowd Diversion Active');
      if (renderer.targetNodeId) {
        calculateAndDisplayRoute(renderer.targetNodeId);
      }
    } else if (payload.type === 'STOCHASTIC_REROUTE') {
      if (payload.userAffected && renderer.targetNodeId) {
        showTicker(`🔄 DETOUR APPLIED: You are in the ${payload.percentage}% pool rerouted around congestion!`);
        alerts.triggerTurnAlert('Route recalculating around congestion');
        calculateAndDisplayRoute(renderer.targetNodeId);
      } else {
        showTicker(payload.message);
      }
    } else {
      showTicker(payload.message);
      alerts.triggerTurnAlert('New Announcement');
    }
  };

  // Organizer Controller
  const organizer = new OrganizerController(
    VENUE_DATA,
    renderer,
    pathfinder,
    accessibilityDesk,
    alerts,
    onBroadcastReceived
  );

  // Survey / Personalization State
  const STORAGE_KEY = 'eventpulse-user-profile';
  const userProfile = {
    id: `guest-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Guest Attendee',
    interests: new Set(),
    assistance: new Set(),
    location: 'B4'
  };

  function loadUserProfile() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;

      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return false;

      userProfile.id = saved.id || userProfile.id;
      userProfile.name = saved.name || userProfile.name;
      userProfile.location = saved.location || userProfile.location;
      userProfile.interests = new Set(Array.isArray(saved.interests) ? saved.interests : []);
      userProfile.assistance = new Set(Array.isArray(saved.assistance) ? saved.assistance : []);

      if (userProfile.assistance.has('wheelchair')) {
        isWheelchairMode = true;
        const btnAccessibility = document.getElementById('btnToggleAccessibility');
        const accessibilityLabel = document.getElementById('accessibilityLabel');
        if (btnAccessibility) btnAccessibility.classList.add('active');
        if (accessibilityLabel) accessibilityLabel.textContent = 'Step-Free: ON ♿';
      }

      return true;
    } catch (error) {
      console.warn('Could not load saved profile:', error);
      return false;
    }
  }

  function saveUserProfile() {
    try {
      const payload = {
        id: userProfile.id,
        name: userProfile.name,
        location: anchorEngine.currentCode || userProfile.location,
        interests: Array.from(userProfile.interests),
        assistance: Array.from(userProfile.assistance)
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('Could not save profile:', error);
    }
  }

  function openSurveyModal() {
    const modal = document.getElementById('modalSurvey');
    if (modal) modal.classList.remove('hidden');
  }

  function closeSurveyModal() {
    const modal = document.getElementById('modalSurvey');
    if (modal) modal.classList.add('hidden');
  }

  function getSurveySelections() {
    const interestBoxes = document.querySelectorAll('#modalSurvey input[type="checkbox"]');
    const nextProfile = {
      interests: new Set(),
      assistance: new Set()
    };

    interestBoxes.forEach((checkbox) => {
      const value = checkbox.value;
      if (!checkbox.checked) return;
      if (['main_event', 'small_event', 'food', 'merch', 'buffer', 'restroom'].includes(value)) {
        nextProfile.interests.add(value);
      }
      if (['wheelchair', 'quiet_space', 'medical', 'escort', 'no_assistance'].includes(value)) {
        nextProfile.assistance.add(value);
      }
    });

    return nextProfile;
  }

  function saveSurveyPreferences() {
    const nextProfile = getSurveySelections();
    userProfile.interests = nextProfile.interests;
    userProfile.assistance = nextProfile.assistance;
    userProfile.location = anchorEngine.currentCode || 'B4';
    saveUserProfile();

    if (userProfile.assistance.size > 0 && !userProfile.assistance.has('no_assistance')) {
      const supportProfile = {
        id: userProfile.id,
        name: userProfile.name,
        needs: Array.from(userProfile.assistance),
        location: userProfile.location,
        status: 'MONITORED',
        lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      if (organizer && typeof organizer.registerSupportProfile === 'function') {
        organizer.registerSupportProfile(supportProfile);
      }

      if (userProfile.assistance.has('wheelchair')) {
        isWheelchairMode = true;
        renderer.isWheelchairMode = true;
        const btnAccessibility = document.getElementById('btnToggleAccessibility');
        const accessibilityLabel = document.getElementById('accessibilityLabel');
        if (btnAccessibility) btnAccessibility.classList.add('active');
        if (accessibilityLabel) accessibilityLabel.textContent = 'Step-Free: ON ♿';
      }
    }

    closeSurveyModal();
    renderScheduleList();

    const interestSummary = userProfile.interests.size > 0
      ? `Recommended picks updated for ${Array.from(userProfile.interests).length} interest areas.`
      : 'No interests selected yet — browse the full schedule.';

    const helpSummary = userProfile.assistance.size > 0 && !userProfile.assistance.has('no_assistance')
      ? `Accessibility profile saved and staff tracking enabled for ${Array.from(userProfile.assistance).length} support need(s).`
      : 'No special assistance needs flagged.';

    showTicker(`🧭 ${interestSummary} ${helpSummary}`);
  }

  function populateSurveyFromProfile() {
    const boxes = document.querySelectorAll('#modalSurvey input[type="checkbox"]');
    boxes.forEach((checkbox) => {
      const isInterest = ['main_event', 'small_event', 'food', 'merch', 'buffer', 'restroom'].includes(checkbox.value);
      const isAssistance = ['wheelchair', 'quiet_space', 'medical', 'escort', 'no_assistance'].includes(checkbox.value);
      const selected = isInterest ? userProfile.interests.has(checkbox.value) : userProfile.assistance.has(checkbox.value);
      checkbox.checked = selected;
    });
  }

  // Load stored preferences on startup when app initializes
  loadUserProfile();
  renderScheduleList();

  // Trusted AI Assistant: curated guidance for navigation, emergency, accessibility, and schedule tasks
  const aiResponses = {
    navigation: {
      default: 'Head toward the nearest anchor sign and use the route planner. For step-free travel, toggle the accessibility mode on before starting directions.',
      examples: [
        'Start walking from your current pillar to the nearest active stage, then follow the highlighted route.',
        'Use the nearest anchor or pillar code to re-center your position before setting a destination.'
      ]
    },
    emergency: {
      default: 'Go to the nearest safe exit or assistance point, and use the SOS button to request staff support immediately. Keep clear of crowded corridors.',
      examples: [
        'Contact staff through the SOS queue and move toward the nearest service hub or exit.',
        'If you feel unsafe, notify nearby volunteers and stay calm while following the broadcast instructions.'
      ]
    },
    accessibility: {
      default: 'Use the step-free route toggle and request a staff escort if you need additional mobility or quiet-space support.',
      examples: [
        'Choose step-free routes to avoid stairs and identify accessible restrooms or quiet zones.',
        'If you need assistance, submit a support ticket from the SOS flow and stay near your last known pillar.'
      ]
    },
    schedule: {
      default: 'Open the schedule panel for session times, then tap a session to see the route and suggested arrival window.',
      examples: [
        'The AI guide recommends sessions based on your selected interests and accessibility profile.',
        'Check the schedule feed for updates, delays, or venue changes before heading out.'
      ]
    }
  };

  function addAssistantMessage(text, isUser = false) {
    const chat = document.getElementById('assistantChat');
    if (!chat) return;

    const msg = document.createElement('div');
    msg.className = `assistant-message ${isUser ? 'assistant-message-user' : 'assistant-message-ai'}`;
    msg.textContent = text;
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
  }

  // ── Gemini Status Badge ─────────────────────────────────────────

  function updateGeminiStatusBadge() {
    const badge = document.getElementById('geminiStatusBadge');
    if (!badge) return;
    if (gemini.hasKey()) {
      badge.textContent = '✨ Gemini 2.0 Flash • Verified Event Copilot';
      badge.style.color = '#4ade80';
      badge.style.borderColor = '#166534';
    } else {
      badge.textContent = '⚙️ EventPulse Assistant • Local Fallback Active';
      badge.style.color = '#94a3b8';
      badge.style.borderColor = '';
    }
  }

  // ── AI Response (Gemini → Proxy → Local Fallback) ────────────────

  function addTypingIndicator() {
    const chat = document.getElementById('assistantChat');
    if (!chat) return null;
    const el = document.createElement('div');
    el.id = 'typingIndicator';
    el.className = 'assistant-message assistant-message-ai';
    el.style.color = '#64748b';
    el.style.fontStyle = 'italic';
    el.textContent = '⟳ Thinking…';
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
    return el;
  }

  function removeTypingIndicator() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
  }

  async function getAiResponse(topic, userText) {
    userText = userText || '';
    topic = topic || 'navigation';

    // 1. Try Gemini browser-direct with streaming
    if (gemini.hasKey()) {
      try {
        const chat = document.getElementById('assistantChat');
        const streamMsg = document.createElement('div');
        streamMsg.className = 'assistant-message assistant-message-ai';
        streamMsg.textContent = '';
        chat.appendChild(streamMsg);
        chat.scrollTop = chat.scrollHeight;

        const fullText = await gemini.askStreaming(
          userText || 'Give me a quick tip for navigating this event.',
          topic,
          VENUE_DATA,
          (partialText) => {
            streamMsg.textContent = partialText;
            chat.scrollTop = chat.scrollHeight;
          }
        );

        if (fullText) {
          streamMsg.textContent = fullText;
          return '__STREAMED__'; // Signal that response already rendered
        }
        streamMsg.remove();
      } catch (err) {
        removeTypingIndicator();
        console.warn('Gemini browser-direct failed, trying proxy:', err.message);
        // Show error badge temporarily
        const badge = document.getElementById('geminiStatusBadge');
        if (badge) {
          const prev = badge.textContent;
          badge.textContent = '⚠️ API Error: ' + err.message.slice(0, 40);
          badge.style.color = '#f87171';
          setTimeout(() => { badge.textContent = prev; badge.style.color = '#4ade80'; }, 4000);
        }
      }
    }

    // 2. Try local Express proxy (when Node server is running)
    try {
      const response = await fetch('http://localhost:3000/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userText || aiResponses[topic].default, topic })
      });

      if (!response.ok) throw new Error('Proxy unavailable');
      const data = await response.json();
      if (data && data.answer) return data.answer;
    } catch (error) {
      console.warn('Gemini proxy unavailable, using local fallback:', error.message);
    }

    // 3. Local curated fallback
    const topicSet = aiResponses[topic] || aiResponses.navigation;
    const text = userText.toLowerCase();

    if (text.includes('where') || text.includes('nearest') || text.includes('find')) {
      return topic === 'emergency'
        ? 'Use the nearest service hub or exit and tap SOS to request immediate staff help. Your current pillar location will be shared with responders.'
        : topic === 'accessibility'
          ? 'Use the step-free toggle and select your destination for the safest route. Quiet rooms and accessible restrooms are marked on the map.'
          : topic === 'schedule'
            ? 'Open the event schedule and filter by your interests. Sessions you selected will be highlighted.'
            : 'Open the map and select the destination. Follow the highlighted path from your current anchor pillar.';
    }
    if (text.includes('emergency') || text.includes('danger') || text.includes('help')) return topicSet.examples[0];
    if (text.includes('quiet') || text.includes('access') || text.includes('wheelchair')) return topicSet.examples[1];
    if (text.includes('schedule') || text.includes('session') || text.includes('time')) return topicSet.examples[0];

    return topicSet.default;
  }

  function activateAssistantTopic(topic) {
    document.querySelectorAll('.assistant-topic').forEach((button) => {
      button.classList.toggle('active', button.dataset.topic === topic);
    });

    const chat = document.getElementById('assistantChat');
    if (chat && (!chat.dataset.topic || chat.dataset.topic !== topic)) {
      addAssistantMessage(`Mode: ${topic.charAt(0).toUpperCase() + topic.slice(1)} support. ${aiResponses[topic].default}`);
      chat.dataset.topic = topic;
    }
  }

  updateGeminiStatusBadge();

  // Unified Assistant Drawer Trigger (Toolbar & Floating Map Pill)
  const openAssistantModal = () => {
    const modal = document.getElementById('modalAssistant');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('active');
      updateGeminiStatusBadge();
      const input = document.getElementById('assistantPromptInput');
      if (input) setTimeout(() => input.focus(), 150);
    }
  };

  const btnOpenAssistant = document.getElementById('btnOpenAssistant');
  if (btnOpenAssistant) btnOpenAssistant.addEventListener('click', openAssistantModal);

  const btnFloatingAi = document.getElementById('btnFloatingAi');
  if (btnFloatingAi) btnFloatingAi.addEventListener('click', openAssistantModal);

  // Quick Prompt Suggestion Chips
  document.querySelectorAll('.quick-prompt-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const promptText = chip.getAttribute('data-prompt');
      const input = document.getElementById('assistantPromptInput');
      if (input && promptText) {
        input.value = promptText;
        document.getElementById('btnAskAssistant')?.click();
      }
    });
  });

  document.querySelectorAll('.assistant-topic').forEach((button) => {
    button.addEventListener('click', () => activateAssistantTopic(button.dataset.topic));
  });

  document.getElementById('btnAskAssistant').addEventListener('click', async () => {
    const input = document.getElementById('assistantPromptInput');
    const topic = document.querySelector('.assistant-topic.active')?.dataset.topic || 'navigation';
    if (!input) return;

    const value = input.value.trim();
    if (!value) {
      addAssistantMessage('Please ask a question such as "Where is the quiet lounge?" or "How do I reach the nearest exit?"');
      return;
    }

    addAssistantMessage(value, true);
    input.value = '';

    const typingEl = gemini.hasKey() ? null : addTypingIndicator();
    const answer = await getAiResponse(topic, value);
    if (typingEl) typingEl.remove();

    // Only add message if not already streamed into chat
    if (answer !== '__STREAMED__') {
      addAssistantMessage(answer);
    }
  });

  document.getElementById('assistantPromptInput').addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      await document.getElementById('btnAskAssistant').click();
    }
  });

  function renderScheduleList() {
    const listEl = document.getElementById('scheduleListContainer');
    if (!listEl) return;

    const baseSchedule = [
      {
        id: 'main_keynote',
        title: 'Opening Keynote: Autonomous Agentic Era',
        meta: 'Grand Auditorium (Main 1)',
        time: '11:30 AM',
        tag: 'Live',
        category: 'main_event'
      },
      {
        id: 'main_stage2',
        title: 'Tech Spotlight: Low-Power Edge Computing',
        meta: 'Stage 2',
        time: '1:00 PM',
        tag: 'Upcoming',
        category: 'main_event'
      },
      {
        id: 'ws_room_a',
        title: 'Workshop A: Hands-on AI Workflows',
        meta: 'Workshop Room A',
        time: '2:00 PM',
        tag: 'Registration Open',
        category: 'small_event'
      },
      {
        id: 'food_coffee',
        title: 'Artisan Espresso Bar',
        meta: 'Food Court',
        time: 'All day',
        tag: 'Popular',
        category: 'food'
      },
      {
        id: 'buff_quiet',
        title: 'Quiet Lounge Recharge',
        meta: 'Sensory-friendly room',
        time: '12:00 PM',
        tag: 'Calm zone',
        category: 'buffer'
      }
    ];

    let recommendedItems = baseSchedule;
    if (userProfile.interests.size > 0 || userProfile.assistance.size > 0) {
      const preferred = new Set(userProfile.interests);
      if (userProfile.assistance.has('quiet_space')) preferred.add('buffer');
      if (userProfile.assistance.has('wheelchair')) preferred.add('main_event');

      recommendedItems = baseSchedule.filter((item) => preferred.has(item.category));
      if (recommendedItems.length === 0) {
        recommendedItems = baseSchedule.slice(0, 3);
      }
    }

    const isPersonalized = userProfile.interests.size > 0 || userProfile.assistance.size > 0;
    listEl.innerHTML = recommendedItems.map((item) => `
      <div class="schedule-item">
        <div>
          <strong class="${isPersonalized ? 'text-sky-300' : 'text-slate-200'} text-xs">${item.title}</strong>
          <div class="text-2xs text-slate-400">${item.meta} • ${item.time}</div>
        </div>
        <span class="badge-sm ${isPersonalized ? 'text-emerald-400' : ''}">${isPersonalized ? 'For You' : item.tag}</span>
      </div>
    `).join('');

    if (isPersonalized) {
      const note = document.createElement('div');
      note.className = 'p-2 mt-3 bg-sky-950/30 border border-sky-500/40 rounded text-2xs text-sky-200';
      const supportText = userProfile.assistance.has('wheelchair') ? ' Step-free routing enabled.' : '';
      note.textContent = `Personalized result: based on your selected interests and support needs.${supportText}`;
      listEl.appendChild(note);
    }
  }

  // 3. Navigation Path Calculation & Route Rendering
  function calculateAndDisplayRoute(targetNodeId) {
    renderer.targetNodeId = targetNodeId;
    renderer.isWheelchairMode = isWheelchairMode; // Sync wheelchair mode to renderer
    const startNodeId = renderer.currentAnchor;

    const route = pathfinder.findPath(startNodeId, targetNodeId, {
      wheelchairOnly: isWheelchairMode,
      blockedEdgeIds: renderer.blockedEdgeIds
    });

    const banner = document.getElementById('navBanner');
    const instructionEl = document.getElementById('navInstruction');
    const distEl = document.getElementById('navDistance');
    const timeEl = document.getElementById('navTime');

    // Nav banner colour: green for wheelchair/step-free, default blue otherwise
    if (isWheelchairMode) {
      banner.style.background = 'linear-gradient(90deg, #15803d, #16a34a)';
    } else {
      banner.style.background = '';
    }

    if (!route) {
      renderer.activeRoute = null;
      banner.classList.remove('hidden');
      instructionEl.textContent = isWheelchairMode
        ? '♿ No step-free route available (Elevator required).'
        : 'All connecting hallways currently blocked.';
      distEl.textContent = 'Blocked';
      timeEl.textContent = 'N/A';
      alerts.triggerEmergencyAlert('No route available');
      return;
    }

    renderer.activeRoute = route.path;
    banner.classList.remove('hidden');
    const firstInstruction = route.instructions[0] || 'Proceed to destination';
    instructionEl.textContent = isWheelchairMode
      ? `♿ Step-Free Route Active — ${firstInstruction}`
      : firstInstruction;
    distEl.textContent = `${route.distance}m`;
    timeEl.textContent = `~${Math.ceil(route.estimatedSeconds / 60)} min (${route.estimatedSeconds}s)`;

    // Eyes-up alert
    alerts.triggerTurnAlert(firstInstruction);
  }

  window.appInstance = {
    calculateAndDisplayRoute,
    get activeTarget() { return renderer.targetNodeId; }
  };

  // 4. Multi-Page Navigation & View Router
  const viewPanels = {
    home: document.getElementById('viewHome'),
    map: document.getElementById('attendeeView'),
    organizer: document.getElementById('organizerView')
  };

  const navBtns = {
    home: document.getElementById('navBtnHome'),
    map: document.getElementById('tabAttendee'),
    organizer: document.getElementById('tabOrganizer')
  };

  let isOrganizerAuthorized = false;
  const VALID_ORGANIZER_CODES = ['EVENT2026', '7700', 'ADMIN', 'OP2026'];

  const modalOrganizerAuth = document.getElementById('modalOrganizerAuth');
  const organizerPasscodeInput = document.getElementById('organizerPasscodeInput');
  const authErrorMsg = document.getElementById('authErrorMsg');
  const btnSubmitOrganizerAuth = document.getElementById('btnSubmitOrganizerAuth');
  const btnLockOrganizer = document.getElementById('btnLockOrganizer');

  function switchView(targetKey, skipHash = false) {
    if (targetKey === 'organizer' && !isOrganizerAuthorized) {
      if (modalOrganizerAuth) {
        modalOrganizerAuth.classList.remove('hidden');
        if (authErrorMsg) authErrorMsg.classList.add('hidden');
        if (organizerPasscodeInput) {
          organizerPasscodeInput.value = '';
          organizerPasscodeInput.focus();
        }
      }
      return;
    }

    // Toggle panels
    Object.entries(viewPanels).forEach(([key, panel]) => {
      if (!panel) return;
      if (key === targetKey) {
        panel.classList.remove('hidden');
        panel.classList.add('active');
      } else {
        panel.classList.add('hidden');
        panel.classList.remove('active');
      }
    });

    // Toggle nav buttons
    Object.entries(navBtns).forEach(([key, btn]) => {
      if (!btn) return;
      if (key === targetKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (targetKey === 'map') {
      renderer.isOrganizerMode = false;
      setTimeout(() => {
        renderer.initCanvasSize();
        renderer.render();
      }, 50);
    } else if (targetKey === 'organizer') {
      renderer.isOrganizerMode = true;
      renderer.render();
      if (organizer) organizer.renderZoneCapacities();
      alerts.playChirp(880, 0.15);
    }

    if (!skipHash) {
      try {
        window.location.hash = targetKey;
      } catch (_) {}
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function switchToOrganizerView() {
    switchView('organizer');
  }

  function switchToAttendeeView() {
    switchView('map');
  }

  // Top Nav Click Listeners
  if (navBtns.home) navBtns.home.addEventListener('click', () => switchView('home'));
  if (navBtns.map) navBtns.map.addEventListener('click', () => switchView('map'));
  if (navBtns.organizer) navBtns.organizer.addEventListener('click', () => switchView('organizer'));

  // Header Brand & Launch Buttons
  const brandHomeLink = document.getElementById('brandHomeLink');
  if (brandHomeLink) brandHomeLink.addEventListener('click', () => switchView('home'));

  const btnHeaderLaunchMap = document.getElementById('btnHeaderLaunchMap');
  if (btnHeaderLaunchMap) btnHeaderLaunchMap.addEventListener('click', () => switchView('map'));

  // Introductory Landing Page CTA Buttons
  const btnHomeLaunchAttendee = document.getElementById('btnHomeLaunchAttendee');
  if (btnHomeLaunchAttendee) btnHomeLaunchAttendee.addEventListener('click', () => switchView('map'));

  const btnHomeLaunchOrganizer = document.getElementById('btnHomeLaunchOrganizer');
  if (btnHomeLaunchOrganizer) btnHomeLaunchOrganizer.addEventListener('click', () => switchView('organizer'));

  const btnLandingLaunchMap = document.getElementById('btnLandingLaunchMap');
  if (btnLandingLaunchMap) btnLandingLaunchMap.addEventListener('click', () => switchView('map'));

  const btnLandingBottomLaunch = document.getElementById('btnLandingBottomLaunch');
  if (btnLandingBottomLaunch) btnLandingBottomLaunch.addEventListener('click', () => switchView('map'));

  const btnLandingOrganizer = document.getElementById('btnLandingOrganizer');
  if (btnLandingOrganizer) btnLandingOrganizer.addEventListener('click', () => switchView('organizer'));

  // 15-Second Automated Guided Tour Mode
  let tourActive = false;
  let tourTimer = null;
  const btnHomeStartTour = document.getElementById('btnHomeStartTour');

  function startGuidedTour() {
    tourActive = true;
    switchView('map');

    alerts.triggerGlanceCard('🎬 Guided Tour (1/4)', 'Orienting to attendee position at Food Plaza (Pillar B4)...', 'emerald');
    anchorEngine.locateByCode('B4');

    tourTimer = setTimeout(() => {
      if (!tourActive) return;
      alerts.triggerGlanceCard('🎬 Guided Tour (2/4)', 'Solving Step-Free route to Main Keynote Hall (Stairs Avoided)...', 'emerald');
      isWheelchairMode = true;
      renderer.isWheelchairMode = true;
      const btnAcc = document.getElementById('btnToggleAccessibility');
      const accLabel = document.getElementById('accessibilityLabel');
      if (btnAcc) btnAcc.classList.add('active');
      if (accLabel) accLabel.textContent = 'Step-Free: ON ♿';
      calculateAndDisplayRoute('main_keynote');

      tourTimer = setTimeout(() => {
        if (!tourActive) return;
        alerts.triggerGlanceCard('🎬 Guided Tour (3/4)', 'Simulating Choke Point — Virtual Roadblock Deployed on Galleria!', 'amber');
        organizer.toggleCorridorBarrier('edge_b1_b3');
        calculateAndDisplayRoute('main_keynote');

        tourTimer = setTimeout(() => {
          if (!tourActive) return;
          alerts.triggerGlanceCard('🎉 Tour Complete!', 'You are all set. Tap any room to navigate, scan QR codes, or test Flock Mode.', 'emerald');
          tourActive = false;
        }, 4500);

      }, 4500);

    }, 3500);
  }

  if (btnHomeStartTour) {
    btnHomeStartTour.addEventListener('click', startGuidedTour);
  }

  // Interactive Mini-Demo Preview Component
  const miniCanvas = document.getElementById('miniDemoCanvas');
  if (miniCanvas) {
    const miniCtx = miniCanvas.getContext('2d');
    let miniStepFree = true;
    let miniBlocked = false;
    let miniDashOffset = 0;

    const btnMiniStepFree = document.getElementById('btnMiniToggleStepFree');
    const btnMiniBlock = document.getElementById('btnMiniToggleBlock');
    const btnMiniFull = document.getElementById('btnMiniLaunchFull');
    const statusText = document.getElementById('miniDemoStatusText');
    const metricDist = document.getElementById('miniMetricDist');
    const metricStairs = document.getElementById('miniMetricStairs');
    const metricTime = document.getElementById('miniMetricTime');
    const metricStatus = document.getElementById('miniMetricStatus');

    function updateMiniMetrics(path) {
      if (!path) {
        if (metricDist) metricDist.textContent = 'No Path';
        if (metricStatus) metricStatus.textContent = 'Blocked';
        return;
      }
      if (metricDist) metricDist.textContent = `${path.distance}m`;
      if (metricTime) metricTime.textContent = `~${Math.ceil(path.estimatedSeconds / 60)} min`;
      if (metricStairs) metricStairs.textContent = miniStepFree ? '♿ Step-Free Safe' : '⚠️ Stairs Included';
      if (metricStatus) {
        metricStatus.textContent = miniBlocked ? '🔄 Detour Active' : 'Nominal Flow';
        metricStatus.className = `metric-val ${miniBlocked ? 'text-amber-400' : 'text-emerald-400'}`;
      }
      if (statusText) {
        statusText.textContent = miniBlocked
          ? 'Detour Active: B4 ➔ B3 ➔ C3 ➔ C2 ➔ Keynote Hall (Stairs & Bottleneck Avoided)'
          : 'Active Path: Food Plaza (B4) ➔ Keynote Hall (A2)';
      }
    }

    if (btnMiniStepFree) {
      btnMiniStepFree.addEventListener('click', () => {
        miniStepFree = !miniStepFree;
        btnMiniStepFree.classList.toggle('active', miniStepFree);
        btnMiniStepFree.textContent = miniStepFree ? '♿ Step-Free: ON' : '♿ Step-Free: OFF';
      });
    }

    if (btnMiniBlock) {
      btnMiniBlock.addEventListener('click', () => {
        miniBlocked = !miniBlocked;
        btnMiniBlock.classList.toggle('active', miniBlocked);
        btnMiniBlock.textContent = miniBlocked ? '🚧 Clear Roadblock' : '🚧 Toggle Roadblock';
      });
    }

    if (btnMiniFull) {
      btnMiniFull.addEventListener('click', () => switchView('map'));
    }

    function renderMiniDemo() {
      if (document.hidden || !miniCanvas.offsetParent) {
        requestAnimationFrame(renderMiniDemo);
        return;
      }

      miniDashOffset -= 1;
      const w = miniCanvas.width;
      const h = miniCanvas.height;

      miniCtx.fillStyle = '#050b14';
      miniCtx.fillRect(0, 0, w, h);

      const scaleX = (w - 70) / 1000;
      const scaleY = (h - 50) / 600;
      const tx = 35;
      const ty = 25;

      const project = (x, y) => ({
        x: tx + (x - 100) * scaleX,
        y: ty + (y - 100) * scaleY
      });

      // 1. Draw mini zones
      VENUE_DATA.zones.forEach((z) => {
        const p = project(z.x, z.y);
        const pw = z.w * scaleX;
        const ph = z.h * scaleY;

        miniCtx.fillStyle = 'rgba(30, 41, 59, 0.4)';
        miniCtx.beginPath();
        miniCtx.roundRect(p.x, p.y, pw, ph, 6);
        miniCtx.fill();
        miniCtx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
        miniCtx.lineWidth = 1;
        miniCtx.stroke();

        miniCtx.fillStyle = '#94a3b8';
        miniCtx.font = '8px system-ui';
        miniCtx.fillText(z.name, p.x + 6, p.y + 11);
      });

      // 2. Draw corridors
      const blockedEdges = miniBlocked ? new Set(['edge_b1_b3', 'edge_a1_b1']) : new Set();
      VENUE_DATA.edges.forEach((edge) => {
        const n1 = VENUE_DATA.nodes[edge.from];
        const n2 = VENUE_DATA.nodes[edge.to];
        if (!n1 || !n2) return;

        const p1 = project(n1.x, n1.y);
        const p2 = project(n2.x, n2.y);
        const isB = blockedEdges.has(edge.id);

        miniCtx.beginPath();
        miniCtx.moveTo(p1.x, p1.y);
        miniCtx.lineTo(p2.x, p2.y);
        miniCtx.strokeStyle = isB ? 'rgba(244, 63, 94, 0.3)' : 'rgba(51, 65, 85, 0.5)';
        miniCtx.lineWidth = isB ? 8 : 6;
        miniCtx.stroke();

        if (isB) {
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          miniCtx.fillStyle = '#f43f5e';
          miniCtx.beginPath();
          miniCtx.arc(midX, midY, 6, 0, Math.PI * 2);
          miniCtx.fill();
        }
      });

      // 3. Solve Path
      const route = pathfinder.findPath('n_b4', 'main_keynote', miniStepFree, blockedEdges);
      updateMiniMetrics(route);

      if (route && route.path.length >= 2) {
        const pathPoints = route.path.map((id) => {
          const n = VENUE_DATA.nodes[id];
          return n ? project(n.x, n.y) : null;
        }).filter(Boolean);

        // Glow ribbon
        miniCtx.beginPath();
        miniCtx.moveTo(pathPoints[0].x, pathPoints[0].y);
        for (let i = 1; i < pathPoints.length; i++) {
          miniCtx.lineTo(pathPoints[i].x, pathPoints[i].y);
        }
        miniCtx.strokeStyle = miniStepFree ? 'rgba(34, 197, 94, 0.3)' : 'rgba(56, 189, 248, 0.3)';
        miniCtx.lineWidth = 10;
        miniCtx.stroke();

        // Main line
        miniCtx.strokeStyle = miniStepFree ? '#22c55e' : '#38bdf8';
        miniCtx.lineWidth = 3;
        miniCtx.stroke();

        // Animated dots
        miniCtx.setLineDash([6, 6]);
        miniCtx.lineDashOffset = miniDashOffset;
        miniCtx.strokeStyle = '#ffffff';
        miniCtx.lineWidth = 2;
        miniCtx.stroke();
        miniCtx.setLineDash([]);
      }

      // 4. Draw start & destination pins
      const startP = project(VENUE_DATA.nodes['n_b4'].x, VENUE_DATA.nodes['n_b4'].y);
      miniCtx.fillStyle = '#0284c7';
      miniCtx.beginPath();
      miniCtx.arc(startP.x, startP.y, 6, 0, Math.PI * 2);
      miniCtx.fill();
      miniCtx.strokeStyle = '#fff';
      miniCtx.lineWidth = 1.5;
      miniCtx.stroke();

      const endP = project(VENUE_DATA.nodes['main_keynote'].x, VENUE_DATA.nodes['main_keynote'].y);
      miniCtx.fillStyle = '#f43f5e';
      miniCtx.beginPath();
      miniCtx.arc(endP.x, endP.y, 6, 0, Math.PI * 2);
      miniCtx.fill();
      miniCtx.strokeStyle = '#fff';
      miniCtx.lineWidth = 1.5;
      miniCtx.stroke();

      requestAnimationFrame(renderMiniDemo);
    }

    requestAnimationFrame(renderMiniDemo);
  }

  // Deep-link Action Triggers ([data-jump])
  document.querySelectorAll('[data-jump]').forEach((el) => {
    el.addEventListener('click', () => {
      const action = el.getAttribute('data-jump');
      if (action === 'map-anchors') {
        switchView('map');
        const modalCode = document.getElementById('modalCodeInput');
        if (modalCode) modalCode.classList.remove('hidden');
      } else if (action === 'map-stepfree') {
        isWheelchairMode = true;
        renderer.isWheelchairMode = true;
        const btnAcc = document.getElementById('btnToggleAccessibility');
        const accLabel = document.getElementById('accessibilityLabel');
        if (btnAcc) btnAcc.classList.add('active');
        if (accLabel) accLabel.textContent = 'Step-Free: ON ♿';
        switchView('map');
      } else if (action === 'ops-reroute') {
        switchView('organizer');
      } else if (action === 'open-gemini') {
        openAssistantModal();
      } else if (action === 'open-flock') {
        const modalFlock = document.getElementById('modalFlockMode');
        if (modalFlock) {
          modalFlock.classList.remove('hidden');
          modalFlock.classList.add('active');
          renderFlockUI();
        }
      }
    });
  });

  // URL Hash Syncing for Direct Link Sharing
  function handleHashRoute() {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (hash === 'map' || hash === 'attendee') {
      switchView('map', true);
    } else if (hash === 'organizer' || hash === 'ops') {
      if (isOrganizerAuthorized) {
        switchView('organizer', true);
      } else {
        switchView('home', true);
        if (modalOrganizerAuth) modalOrganizerAuth.classList.remove('hidden');
      }
    } else {
      switchView('home', true);
    }
  }

  window.addEventListener('hashchange', handleHashRoute);
  if (window.location.hash && window.location.hash !== '#home') {
    handleHashRoute();
  }

  // Attendee Quick Action Floating Navigation Chips
  document.querySelectorAll('.quick-nav-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.quick-nav-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      setTimeout(() => chip.classList.remove('active'), 3000);

      const action = chip.getAttribute('data-quick');
      let targetId = null;

      if (action === 'elevator') {
        isWheelchairMode = true;
        renderer.isWheelchairMode = true;
        document.getElementById('accessibilityLabel').textContent = 'Step-Free: ON ♿';
        document.getElementById('btnToggleAccessibility').classList.add('active');
        targetId = 'serv_infodesk';
        alerts.triggerGlanceCard('♿ Step-Free Mode Activated', 'Navigating to Central Service Hub via elevator-safe corridors.', 'emerald');
      } else if (action === 'lounge') {
        targetId = 'buff_quiet';
        alerts.triggerGlanceCard('🛋️ Quiet Lounge', 'Navigating to Sensory-Friendly Quiet Buffer Lounge.', 'emerald');
      } else if (action === 'food') {
        targetId = 'n_b4';
        alerts.triggerGlanceCard('🍔 Food Plaza', 'Navigating to Food Court & Dining Pavilion.', 'amber');
      } else if (action === 'restroom') {
        targetId = 'serv_restrooms';
        alerts.triggerGlanceCard('🚻 Restroom Hub', 'Navigating to nearest accessible Restrooms.', 'emerald');
      } else if (action === 'evac') {
        targetId = 'n_a1';
        alerts.triggerScreenStrobe('amber');
        alerts.triggerGlanceCard('🚨 Emergency Evacuation', 'Following priority exit route to Main Concourse.', 'red');
      }

      if (targetId) {
        calculateAndDisplayRoute(targetId);
      }
    });
  });



  function validateAndUnlockOrganizer() {
    const entered = organizerPasscodeInput.value.trim().toUpperCase();
    if (VALID_ORGANIZER_CODES.includes(entered)) {
      isOrganizerAuthorized = true;
      authErrorMsg.classList.add('hidden');
      modalOrganizerAuth.classList.add('hidden');
      switchToOrganizerView();
      showTicker('🔓 Organizer Command Center Unlocked. Welcome, Coordinator.');
    } else {
      authErrorMsg.classList.remove('hidden');
      alerts.triggerEmergencyAlert('Access Denied');
      organizerPasscodeInput.style.borderColor = '#f43f5e';
      setTimeout(() => { organizerPasscodeInput.style.borderColor = ''; }, 1500);
    }
  }

  if (btnSubmitOrganizerAuth) {
    btnSubmitOrganizerAuth.addEventListener('click', validateAndUnlockOrganizer);
  }

  if (organizerPasscodeInput) {
    organizerPasscodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') validateAndUnlockOrganizer();
    });
  }

  // Demo Quick-Fill Buttons
  const btnFillPin = document.getElementById('btnQuickFillPin');
  if (btnFillPin) {
    btnFillPin.addEventListener('click', () => {
      organizerPasscodeInput.value = 'EVENT2026';
      authErrorMsg.classList.add('hidden');
    });
  }

  const btnFillNum = document.getElementById('btnQuickFillNumeric');
  if (btnFillNum) {
    btnFillNum.addEventListener('click', () => {
      organizerPasscodeInput.value = '7700';
      authErrorMsg.classList.add('hidden');
    });
  }

  // Lock Console
  if (btnLockOrganizer) {
    btnLockOrganizer.addEventListener('click', () => {
      isOrganizerAuthorized = false;
      switchView('home');
      showTicker('🔒 Organizer Console Locked. Returned to Home.');
    });
  }

  // Category Filter Pills
  document.querySelectorAll('.filter-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      const cat = pill.getAttribute('data-cat');
      renderer.categoryFilter = cat;
      renderer.render();
    });
  });

  // Map Zoom & Center Controls
  document.getElementById('btnZoomIn').addEventListener('click', () => renderer.zoomIn());
  document.getElementById('btnZoomOut').addEventListener('click', () => renderer.zoomOut());
  document.getElementById('btnCenterMe').addEventListener('click', () => {
    renderer.centerOnNode(renderer.currentAnchor);
  });

  // Start Navigation Button from Modal
  document.getElementById('btnStartNavigation').addEventListener('click', () => {
    if (activeTargetNode) {
      document.getElementById('modalNodeInfo').classList.add('hidden');
      calculateAndDisplayRoute(activeTargetNode.id);
    }
  });

  // Cancel Active Route
  document.getElementById('btnCancelNav').addEventListener('click', () => {
    renderer.activeRoute = null;
    renderer.targetNodeId = null;
    document.getElementById('navBanner').classList.add('hidden');
  });

  // Accessibility Step-Free Toggle
  const btnAccessibility = document.getElementById('btnToggleAccessibility');
  const accessibilityLabel = document.getElementById('accessibilityLabel');
  btnAccessibility.addEventListener('click', () => {
    isWheelchairMode = !isWheelchairMode;
    renderer.isWheelchairMode = isWheelchairMode; // Keep renderer in sync immediately
    btnAccessibility.classList.toggle('active', isWheelchairMode);
    accessibilityLabel.textContent = `Step-Free: ${isWheelchairMode ? 'ON ♿' : 'OFF'}`;
    alerts.playChirp(isWheelchairMode ? 900 : 450, 0.15);

    if (renderer.targetNodeId) {
      calculateAndDisplayRoute(renderer.targetNodeId);
    } else {
      // Still refresh map so stair badges update
      renderer.render();
    }
  });

  // 5. Anchor Input Modals
  const modalCodeInput = document.getElementById('modalCodeInput');
  const anchorTextInput = document.getElementById('anchorTextInput');
  document.getElementById('btnOpenCodeInput').addEventListener('click', () => {
    modalCodeInput.classList.remove('hidden');
    anchorTextInput.value = '';
    anchorTextInput.focus();
  });

  document.getElementById('btnConfirmAnchorCode').addEventListener('click', () => {
    const code = anchorTextInput.value;
    if (anchorEngine.locateByCode(code)) {
      modalCodeInput.classList.add('hidden');
      alerts.playChirp(880, 0.15);
    } else {
      alert(`Pillar code "${code}" not found. Try A1, B4, C2, etc.`);
    }
  });

  // Quick code buttons in modal
  document.querySelectorAll('.quick-code-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const code = btn.getAttribute('data-code');
      anchorEngine.locateByCode(code);
      modalCodeInput.classList.add('hidden');
      document.getElementById('modalQRScanner').classList.add('hidden');
      alerts.playChirp(880, 0.15);
    });
  });

  // QR Scanner Modal
  const modalQRScanner = document.getElementById('modalQRScanner');
  document.getElementById('btnOpenScanner').addEventListener('click', () => {
    modalQRScanner.classList.remove('hidden');
  });

  // 6. Flock Mode Drawer & Failover Simulation
  const modalFlock = document.getElementById('modalFlockMode');
  document.getElementById('btnFlockMode').addEventListener('click', () => {
    modalFlock.classList.remove('hidden');
    modalFlock.classList.add('active');
    renderFlockUI();
  });

  function renderFlockUI() {
    const listEl = document.getElementById('flockMembersList');
    if (!listEl) return;
    listEl.innerHTML = '';

    flockManager.members.forEach((m) => {
      const isStrayed = m.distanceToLeader > 35 || m.status === 'offline_lost';
      const card = document.createElement('div');
      card.className = `flock-member-card ${m.isLeader ? 'is-leader' : ''} ${isStrayed ? 'is-strayed' : ''}`;
      
      const badgeClass = m.isLeader ? 'leader' : isStrayed ? 'strayed' : 'ok';
      const badgeText = m.isLeader ? '👑 LEADER' : isStrayed ? '⚠️ STRAYED' : '● SYNCED';
      const distPercent = Math.min(100, Math.round((m.distanceToLeader / 40) * 100));

      card.innerHTML = `
        <div class="flock-card-header">
          <div class="flock-member-info">
            <div class="flock-avatar">${m.name.charAt(0)}</div>
            <div>
              <strong class="${m.isLeader ? 'text-sky-300 font-bold' : 'text-slate-200'} text-xs">${m.name}</strong>
              <div class="text-2xs text-slate-400">Pillar ${m.anchor} • Battery ${m.battery}%</div>
            </div>
          </div>
          <span class="flock-status-badge ${badgeClass}">${badgeText}</span>
        </div>
        ${!m.isLeader ? `
          <div class="flock-meter-row mt-1">
            <span>Distance to Leader:</span>
            <strong class="${isStrayed ? 'text-rose-400 font-bold' : 'text-slate-300'}">${m.distanceToLeader}m / 35m max</strong>
          </div>
          <div class="flock-progress-bar">
            <div class="flock-progress-fill ${isStrayed ? 'danger' : ''}" style="width: ${distPercent}%"></div>
          </div>
        ` : '<div class="text-2xs text-sky-400 font-semibold">Active Beacon • All flock telemetry tethered to your position</div>'}
      `;
      listEl.appendChild(card);
    });

    const lostPinContainer = document.getElementById('flockLostPinContainer');
    const lostPinText = document.getElementById('flockLostPinText');
    if (lostPinContainer && lostPinText) {
      if (flockManager.lastKnownStrayedLocation) {
        lostPinContainer.classList.remove('hidden');
        lostPinText.textContent = `${flockManager.strayedMemberName} strayed at Pillar ${flockManager.lastKnownStrayedLocation}. Direct waypoint pinned on map.`;
      } else {
        lostPinContainer.classList.add('hidden');
      }
    }
  }

  document.getElementById('btnSimLeaderStray').addEventListener('click', () => {
    flockManager.simulateLeaderStray();
    renderFlockUI();
  });

  document.getElementById('btnSimLowBattery').addEventListener('click', () => {
    flockManager.simulateLowBattery();
    renderFlockUI();
  });

  document.getElementById('btnSimTorchPass').addEventListener('click', () => {
    flockManager.executeFailover();
    renderFlockUI();
  });

  // 7. Priority Accessibility SOS Modal
  const modalSOS = document.getElementById('modalSOS');
  document.getElementById('btnEmergencySOS').addEventListener('click', () => {
    modalSOS.classList.remove('hidden');
  });

  document.getElementById('btnSubmitSOSTicket').addEventListener('click', () => {
    const needType = document.getElementById('sosNeedSelect').value;
    const currentLoc = anchorEngine.currentCode;
    const ticket = accessibilityDesk.createTicket(needType, currentLoc);

    modalSOS.classList.add('hidden');
    alerts.triggerEmergencyAlert('Ticket submitted');
    showTicker(`🚨 REQUEST LOGGED [${ticket.id}]: Floor steward dispatched to Pillar ${currentLoc}!`);
  });

  // 8. Announcement Ticker
  const tickerEl = document.getElementById('announcementTicker');
  const tickerText = document.getElementById('tickerText');
  document.getElementById('btnCloseTicker').addEventListener('click', () => {
    tickerEl.classList.add('hidden');
  });

  function showTicker(msg) {
    tickerText.textContent = msg;
    tickerEl.classList.remove('hidden');
  }

  // 9. Survey + Schedule Modal
  const modalSurvey = document.getElementById('modalSurvey');
  const modalSchedule = document.getElementById('modalSchedule');

  document.getElementById('btnOpenSurvey').addEventListener('click', () => {
    populateSurveyFromProfile();
    openSurveyModal();
  });

  document.getElementById('btnSaveSurvey').addEventListener('click', saveSurveyPreferences);
  document.getElementById('btnSkipSurvey').addEventListener('click', () => {
    closeSurveyModal();
    renderScheduleList();
  });

  document.getElementById('btnOpenSchedule').addEventListener('click', () => {
    modalSchedule.classList.remove('hidden');
    renderScheduleList();
  });

  // Generic Modal & Drawer Close handler
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      const targetModal = document.getElementById(modalId);
      if (targetModal) {
        targetModal.classList.add('hidden');
        targetModal.classList.remove('active');
      }
    });
  });

  // Clicking on drawer backdrop closes drawer
  document.querySelectorAll('.drawer-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.add('hidden');
        backdrop.classList.remove('active');
      }
    });
  });

  // Default orient to Pillar B4
  anchorEngine.locateByCode('B4');
});
