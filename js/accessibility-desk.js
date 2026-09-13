// EventPulse - Priority Accessibility & Emergency Helpdesk
// Dispatches immediate floor stewards to specially-abled attendees and tracks ticket lifecycle

class AccessibilityDesk {
  constructor(onTicketsChanged) {
    this.onTicketsChanged = onTicketsChanged;

    // Seeded active tickets
    this.tickets = [
      {
        id: 'T-108',
        needType: 'broken_elevator',
        needTitle: '♿ Broken Elevator (Ramp Blocked)',
        location: 'Pillar C1 (Workshop Wing)',
        requester: 'Marcus T. (Wheelchair User)',
        timestamp: '11:04 AM',
        status: 'OPEN', // OPEN, DISPATCHED, RESOLVED
        assignedStaff: null
      }
    ];
  }

  createTicket(needType, locationCode) {
    const needTitles = {
      'broken_elevator': '♿ Elevator / Ramp Broken (Physical Escort Needed)',
      'wheelchair_assistance': '🦯 Specially-Abled Mobility Assistance',
      'sensory_overload': '🎧 Sensory Overload (Quiet Room Escort)',
      'medical_first_aid': '🩹 Medical / First Aid Emergency'
    };

    const newTicket = {
      id: `T-${Math.floor(100 + Math.random() * 900)}`,
      needType: needType,
      needTitle: needTitles[needType] || 'General Emergency Assistance',
      location: `Pillar ${locationCode}`,
      requester: 'Attendee (Self-Reported)',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'OPEN',
      assignedStaff: null
    };

    this.tickets.unshift(newTicket);
    if (this.onTicketsChanged) {
      this.onTicketsChanged(this.tickets);
    }
    return newTicket;
  }

  dispatchStaff(ticketId, staffName = 'Steward Elena') {
    const ticket = this.tickets.find((t) => t.id === ticketId);
    if (ticket) {
      ticket.status = 'DISPATCHED';
      ticket.assignedStaff = staffName;
      if (this.onTicketsChanged) {
        this.onTicketsChanged(this.tickets);
      }
    }
  }

  resolveTicket(ticketId) {
    const ticket = this.tickets.find((t) => t.id === ticketId);
    if (ticket) {
      ticket.status = 'RESOLVED';
      if (this.onTicketsChanged) {
        this.onTicketsChanged(this.tickets);
      }
    }
  }

  getOpenTicketsCount() {
    return this.tickets.filter((t) => t.status !== 'RESOLVED').length;
  }
}

window.AccessibilityDesk = AccessibilityDesk;
