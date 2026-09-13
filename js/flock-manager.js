// EventPulse - Flock Mode & Group Leader Failover Manager
// Coordinates group movement, detects separation, monitors leader battery, and executes auto-failover

class FlockManager {
  constructor(alertsEngine, onGroupUpdated) {
    this.alerts = alertsEngine;
    this.onGroupUpdated = onGroupUpdated;

    this.roomCode = 'FLOCK7';
    this.maxGroupSize = 8; // Venue constraint for standard hall corridors

    // Group state
    this.members = [
      { id: 'm1', name: 'Alex (You)', isLeader: true, anchor: 'B4', battery: 88, distanceToLeader: 0, status: 'nearby' },
      { id: 'm2', name: 'Sam R.', isLeader: false, anchor: 'B4', battery: 64, distanceToLeader: 4, status: 'nearby' },
      { id: 'm3', name: 'Priya K.', isLeader: false, anchor: 'B3', battery: 42, distanceToLeader: 18, status: 'nearby' },
      { id: 'm4', name: 'David L.', isLeader: false, anchor: 'B3', battery: 71, distanceToLeader: 22, status: 'nearby' }
    ];

    this.lastKnownStrayedLocation = null;
    this.strayedMemberName = null;
  }

  // Get current leader
  getLeader() {
    return this.members.find((m) => m.isLeader) || this.members[0];
  }

  // Simulate leader straying away (> 35m)
  simulateLeaderStray() {
    const leader = this.getLeader();
    leader.distanceToLeader = 48; // Over 35m threshold!
    leader.status = 'strayed';

    // Strobe alert on device
    this.alerts.triggerEmergencyAlert('Separation Alert: You have strayed 48m from your group!');

    if (this.onGroupUpdated) {
      this.onGroupUpdated({
        event: 'LEADER_STRAYED',
        message: '⚠️ Leader is >35m away from the group! Flashing alert sent.'
      });
    }
  }

  // Simulate leader low battery (< 10%)
  simulateLowBattery() {
    const leader = this.getLeader();
    leader.battery = 8;

    this.alerts.triggerEmergencyAlert('Low Battery Alert: Leader battery is 8%!');

    if (this.onGroupUpdated) {
      this.onGroupUpdated({
        event: 'LOW_BATTERY',
        message: '🔋 Leader device is at 8% battery. Prepare for leadership handover.'
      });
    }
  }

  // Automatic Failover: Pass torch to Member 2 and record strayed member's last pin
  executeFailover() {
    const oldLeader = this.getLeader();
    
    // Save last known location before handover
    this.lastKnownStrayedLocation = oldLeader.anchor;
    this.strayedMemberName = oldLeader.name;

    // Remove old leader or mark as disconnected
    oldLeader.isLeader = false;
    oldLeader.status = 'offline_lost';

    // Find next eligible member
    const newLeader = this.members.find((m) => m.id !== oldLeader.id && m.status !== 'offline_lost');
    if (newLeader) {
      newLeader.isLeader = true;
    }

    this.alerts.triggerArrivalAlert();

    if (this.onGroupUpdated) {
      this.onGroupUpdated({
        event: 'FAILOVER_COMPLETE',
        newLeaderName: newLeader ? newLeader.name : 'Unknown',
        lastLocation: this.lastKnownStrayedLocation,
        lostMember: this.strayedMemberName
      });
    }
  }
}

window.FlockManager = FlockManager;
