// EventPulse - Organizer Command Center & Anti-Oscillation Detour Controller
// Handles hallway roadblocks, stochastic rerouting percentages, and live ticket dispatch

class OrganizerController {
  constructor(venueData, renderer, pathfinder, accessibilityDesk, alertsEngine, onBroadcast) {
    this.data = venueData;
    this.renderer = renderer;
    this.pathfinder = pathfinder;
    this.accessibilityDesk = accessibilityDesk;
    this.alerts = alertsEngine;
    this.onBroadcast = onBroadcast;

    this.reroutePercentage = 40;
    this.supportWatchList = [];

    // Real-time Zone Capacity Model
    this.zoneCapacities = [
      { id: 'zone_keynote', name: 'Grand Auditorium (Main 1)', pct: 92, maxCap: 1500, current: 1380, corridorToBlock: 'e_a2_main' },
      { id: 'zone_food', name: 'Food Court & Dining Plaza', pct: 78, maxCap: 600, current: 468, corridorToBlock: 'e_b3_b4' },
      { id: 'zone_expo', name: 'Innovation & Merch Expo', pct: 54, maxCap: 1200, current: 648, corridorToBlock: 'e_b2_b1' },
      { id: 'zone_workshops', name: 'Workshop Suites A & B', pct: 42, maxCap: 300, current: 126, corridorToBlock: 'e_a1_c1' },
      { id: 'zone_lounge', name: 'Quiet Buffer Lounge', pct: 30, maxCap: 200, current: 60, corridorToBlock: 'e_b1_c2' },
      { id: 'zone_services', name: 'Services & Restrooms', pct: 18, maxCap: 250, current: 45, corridorToBlock: 'e_b3_c3' }
    ];

    this.initUI();
  }

  initUI() {
    this.renderCorridorList();
    this.renderTicketsQueue();
    this.renderSupportWatchList();
    this.renderZoneCapacities();
    this.bindOrganizerEvents();
  }

  registerSupportProfile(profile) {
    const existingIndex = this.supportWatchList.findIndex((entry) => entry.id === profile.id);
    if (existingIndex >= 0) {
      this.supportWatchList[existingIndex] = profile;
    } else {
      this.supportWatchList.unshift(profile);
    }
    this.renderSupportWatchList();
  }

  renderSupportWatchList() {
    const listEl = document.getElementById('supportWatchList');
    if (!listEl) return;

    listEl.innerHTML = '';
    if (this.supportWatchList.length === 0) {
      listEl.innerHTML = '<div class="text-xs text-slate-500 py-2">No flagged attendees requiring safety tracking yet.</div>';
      return;
    }

    this.supportWatchList.forEach((profile) => {
      const item = document.createElement('div');
      item.className = 'support-watch-item';
      item.innerHTML = `
        <div class="support-watch-header">
          <strong class="text-slate-200 text-xs">${profile.name || 'Guest Attendee'}</strong>
          <span class="badge-sm text-amber-300">${profile.status || 'MONITORED'}</span>
        </div>
        <div class="text-2xs text-slate-400">📍 Pillar ${profile.location || 'B4'} • Updated ${profile.lastUpdated || 'now'}</div>
        <div class="text-2xs text-sky-300 mt-1">Needs: ${profile.needs ? profile.needs.join(', ') : 'Unspecified'}</div>
      `;
      listEl.appendChild(item);
    });
  }

  // Populate list of major corridors to place barriers
  renderCorridorList() {
    const listEl = document.getElementById('corridorList');
    if (!listEl) return;

    listEl.innerHTML = '';
    this.data.edges.slice(0, 8).forEach((edge) => {
      const isBlocked = this.renderer.blockedEdgeIds.has(edge.id);

      const div = document.createElement('div');
      div.className = `corridor-item ${isBlocked ? 'blocked' : ''}`;
      div.innerHTML = `
        <div>
          <strong class="block text-slate-200 text-xs">${edge.name}</strong>
          <span class="text-2xs text-slate-400">${edge.dist}m • ${edge.hasStairs ? '⚠️ Stairs' : 'Level'}</span>
        </div>
        <button class="btn-barrier-toggle ${isBlocked ? 'blocked' : 'open'}" data-edge="${edge.id}">
          ${isBlocked ? '⛔ CLOSED' : '✓ OPEN'}
        </button>
      `;

      div.querySelector('button').addEventListener('click', (e) => {
        this.toggleCorridorBarrier(edge.id);
      });

      listEl.appendChild(div);
    });

    // Update count badge
    const countEl = document.getElementById('orgOpenBarriers');
    if (countEl) {
      countEl.textContent = this.renderer.blockedEdgeIds.size;
    }
  }

  // Toggle a barrier on a hallway
  toggleCorridorBarrier(edgeId) {
    if (this.renderer.blockedEdgeIds.has(edgeId)) {
      this.renderer.blockedEdgeIds.delete(edgeId);
    } else {
      this.renderer.blockedEdgeIds.add(edgeId);
      this.alerts.playChirp(600, 0.2);
    }

    this.renderCorridorList();
    this.renderer.render();

    // Trigger path recalculation if currently navigating
    if (window.appInstance && window.appInstance.activeTarget) {
      window.appInstance.calculateAndDisplayRoute(window.appInstance.activeTarget);
    }
  }

  // Render open accessibility tickets
  renderTicketsQueue() {
    const queueEl = document.getElementById('ticketQueue');
    const badgeEl = document.getElementById('ticketCountBadge');
    const pendingEl = document.getElementById('orgPendingTickets');

    if (!queueEl) return;
    queueEl.innerHTML = '';

    const openTickets = this.accessibilityDesk.tickets;
    if (badgeEl) badgeEl.textContent = `${this.accessibilityDesk.getOpenTicketsCount()} ACTIVE`;
    if (pendingEl) pendingEl.textContent = this.accessibilityDesk.getOpenTicketsCount();

    if (openTickets.length === 0) {
      queueEl.innerHTML = `<div class="text-xs text-slate-500 py-2">No pending assistance requests.</div>`;
      return;
    }

    openTickets.forEach((t) => {
      const item = document.createElement('div');
      item.className = 'ticket-item';
      item.innerHTML = `
        <div class="ticket-header">
          <strong class="text-rose-400 font-bold">${t.id} • ${t.needTitle}</strong>
          <span class="badge-sm">${t.status}</span>
        </div>
        <div class="text-xs text-slate-300">
          📍 Location: <strong class="text-sky-400">${t.location}</strong> (${t.timestamp})
        </div>
        <div class="text-2xs text-slate-400">Requester: ${t.requester}</div>
        <div class="ticket-actions">
          ${t.status === 'OPEN' ? `
            <button class="btn-xs btn-primary btn-dispatch" data-id="${t.id}">Dispatch Steward</button>
          ` : `
            <span class="text-2xs text-emerald-400">Assigned: ${t.assignedStaff}</span>
          `}
          ${t.status !== 'RESOLVED' ? `
            <button class="btn-xs btn-subtle btn-resolve" data-id="${t.id}">Resolve</button>
          ` : ''}
        </div>
      `;

      const dispatchBtn = item.querySelector('.btn-dispatch');
      if (dispatchBtn) {
        dispatchBtn.addEventListener('click', () => {
          this.accessibilityDesk.dispatchStaff(t.id, 'Steward Elena');
          this.renderTicketsQueue();
        });
      }

      const resolveBtn = item.querySelector('.btn-resolve');
      if (resolveBtn) {
        resolveBtn.addEventListener('click', () => {
          this.accessibilityDesk.resolveTicket(t.id);
          this.renderTicketsQueue();
        });
      }

      queueEl.appendChild(item);
    });
  }

  // Render real-time zone capacities and crowd meters
  renderZoneCapacities() {
    const listEl = document.getElementById('zoneCapacityList');
    if (!listEl) return;

    listEl.innerHTML = '';
    this.zoneCapacities.forEach((zone) => {
      const isCritical = zone.pct >= 85;
      const isWarning = zone.pct >= 65 && zone.pct < 85;
      const statusClass = isCritical ? 'critical' : isWarning ? 'warning' : 'normal';
      const badgeText = isCritical ? '🚨 CRITICAL (OVERFLOW)' : isWarning ? '⚠️ HIGH' : 'NORMAL';

      const div = document.createElement('div');
      div.className = 'capacity-item';
      div.innerHTML = `
        <div class="capacity-header">
          <strong class="text-xs text-slate-200">${zone.name}</strong>
          <span class="text-2xs font-bold ${isCritical ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'}">${zone.pct}% • ${badgeText}</span>
        </div>
        <div class="capacity-bar-bg">
          <div class="capacity-bar-fill ${statusClass}" style="width: ${zone.pct}%;"></div>
        </div>
        <div class="capacity-footer">
          <span class="text-2xs text-slate-400">${zone.current} / ${zone.maxCap} heads</span>
          ${isCritical || isWarning ? `
            <button class="btn-divert" data-zone="${zone.id}">Divert Crowd</button>
          ` : ''}
        </div>
      `;

      const divertBtn = div.querySelector('.btn-divert');
      if (divertBtn) {
        divertBtn.addEventListener('click', () => {
          // Block entry corridor to protect zone
          if (zone.corridorToBlock) {
            this.renderer.blockedEdgeIds.add(zone.corridorToBlock);
            this.renderCorridorList();
            this.renderer.render();
          }
          if (this.onBroadcast) {
            this.onBroadcast({
              type: 'CROWD_DIVERSION',
              message: `⚠️ CROWD DIVERSION: ${zone.name} at ${zone.pct}% capacity! Rerouting incoming foot traffic to alternate wings.`
            });
          }
        });
      }

      listEl.appendChild(div);
    });
  }

  bindOrganizerEvents() {
    // Stochastic reroute slider
    const slider = document.getElementById('rerouteSlider');
    const valText = document.getElementById('rerouteValue');
    const descText = document.getElementById('rerouteValText');

    if (slider) {
      slider.addEventListener('input', (e) => {
        this.reroutePercentage = parseInt(e.target.value, 10);
        if (valText) valText.textContent = `${this.reroutePercentage}%`;
        if (descText) descText.textContent = `${this.reroutePercentage}%`;
      });
    }

    // Apply & Broadcast Detour
    const btnApply = document.getElementById('btnApplyReroute');
    if (btnApply) {
      btnApply.addEventListener('click', () => {
        const isSelected = Math.random() * 100 < this.reroutePercentage;
        if (this.onBroadcast) {
          this.onBroadcast({
            type: 'STOCHASTIC_REROUTE',
            percentage: this.reroutePercentage,
            userAffected: isSelected,
            message: `⚠️ Organizer approved detour: ${this.reroutePercentage}% of traffic rerouted around congested corridors.`
          });
        }
      });
    }

    // Stampede / Crowd Surge Hazard Alert Broadcast
    const btnStampede = document.getElementById('btnTriggerStampedeAlert');
    const stampedeSelect = document.getElementById('stampedeZoneSelect');
    if (btnStampede && stampedeSelect) {
      btnStampede.addEventListener('click', () => {
        const zoneName = stampedeSelect.value;
        // Automatically close main concourse corridors
        this.renderer.blockedEdgeIds.add('e_a2_main');
        this.renderer.blockedEdgeIds.add('e_b1_b3');
        this.renderCorridorList();
        this.renderer.render();

        if (this.onBroadcast) {
          this.onBroadcast({
            type: 'STAMPEDE_HAZARD',
            zone: zoneName,
            message: `🚨 EMERGENCY SURGE ALERT: High-density stampede hazard at ${zoneName}! Stop moving forward. Evacuate via South Garden Promenade. Alternate routes active.`
          });
        }
      });
    }

    // Schedule Delay & Venue Relocation Manager
    const btnPublishSchedule = document.getElementById('btnPublishScheduleChange');
    const sessionSelect = document.getElementById('relocateSessionSelect');
    const actionSelect = document.getElementById('relocateActionSelect');

    if (btnPublishSchedule && sessionSelect && actionSelect) {
      btnPublishSchedule.addEventListener('click', () => {
        const sessionKey = sessionSelect.value;
        const action = actionSelect.value;
        const sessionNode = this.data.nodes[sessionKey];

        let msg = '';
        let newTargetId = null;

        if (action === 'delay_15') {
          msg = `⏱️ SCHEDULE UPDATE: ${sessionNode ? sessionNode.label : 'Session'} delayed by +15 mins (New Time: 11:45 AM).`;
        } else if (action === 'delay_30') {
          msg = `⏱️ SCHEDULE UPDATE: ${sessionNode ? sessionNode.label : 'Session'} delayed by +30 mins (New Time: 12:00 PM).`;
        } else if (action === 'move_stage2') {
          msg = `🏛️ VENUE RELOCATION: ${sessionNode ? sessionNode.label : 'Session'} moved to Stage 2: Tech Spotlight! Tap to reroute.`;
          newTargetId = 'main_stage2';
        } else if (action === 'move_keynote') {
          msg = `🏛️ VENUE RELOCATION: ${sessionNode ? sessionNode.label : 'Session'} moved to Grand Auditorium (Main 1)! Tap to reroute.`;
          newTargetId = 'main_keynote';
        } else if (action === 'move_lounge') {
          msg = `🛋️ VENUE RELOCATION: ${sessionNode ? sessionNode.label : 'Session'} moved to Quiet Buffer Lounge! Tap to reroute.`;
          newTargetId = 'buff_quiet';
        }

        if (this.onBroadcast) {
          this.onBroadcast({
            type: action.startsWith('move_') ? 'VENUE_RELOCATION' : 'SCHEDULE_DELAY',
            sessionKey,
            newTargetId,
            message: msg
          });
        }
      });
    }

    // Quick Broadcast Buttons
    const btnRestroom = document.getElementById('btnSendRestroomAlert');
    if (btnRestroom) {
      btnRestroom.addEventListener('click', () => {
        if (this.onBroadcast) {
          this.onBroadcast({
            type: 'GENERAL',
            message: 'ℹ️ Restroom Hub A experiencing 15m queue. Please use Accessible Restroom B.'
          });
        }
      });
    }

    const btnCustom = document.getElementById('btnSubmitBroadcast');
    const inputCustom = document.getElementById('broadcastInput');
    if (btnCustom && inputCustom) {
      btnCustom.addEventListener('click', () => {
        const text = inputCustom.value.trim();
        if (text && this.onBroadcast) {
          this.onBroadcast({ type: 'GENERAL', message: text });
          inputCustom.value = '';
        }
      });
    }
  }
}

window.OrganizerController = OrganizerController;
