// EventPulse - Glanceable Alerts & Screen Flash Strobe Engine
// Provides eyes-up haptic cues with visual strobe and audio chime fallbacks

class GlanceAlerts {
  constructor() {
    this.strobeEl = document.getElementById('strobeOverlay');
    this.audioCtx = null;
    this.initAudio();
  }

  initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    } catch (e) {
      console.warn('Web Audio API not supported on this device');
    }
  }

  // Synthesize a brief pleasant chirp without any external audio file
  playChirp(freq = 880, duration = 0.15) {
    if (!this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      // Audio context policy blocked
    }
  }

  // Trigger haptic vibration with screen-strobe and audio chime fallbacks
  triggerTurnAlert(instructionText = 'Upcoming Turn') {
    let vibrated = false;
    if (navigator.vibrate) {
      try {
        vibrated = navigator.vibrate([120, 80, 120]);
      } catch (e) {
        vibrated = false;
      }
    }

    // Always trigger high-contrast visual strobe for glanceable heads-up navigation
    this.flashScreen('amber', 1200);
    this.playChirp(750, 0.15);
  }

  // Arrival alert
  triggerArrivalAlert() {
    if (navigator.vibrate) {
      try {
        navigator.vibrate([200, 100, 200, 100, 300]);
      } catch (e) {}
    }
    this.flashScreen('amber', 1800);
    this.playChirp(1046, 0.3); // High C
  }

  // Emergency or reroute alert
  triggerEmergencyAlert(message) {
    if (navigator.vibrate) {
      try {
        navigator.vibrate([300, 150, 300, 150, 400]);
      } catch (e) {}
    }
    this.flashScreen('red', 2400);
    this.playChirp(440, 0.4);
  }

  // Strobe border animation
  flashScreen(color = 'amber', durationMs = 1500) {
    if (!this.strobeEl) return;
    this.strobeEl.className = `strobe-overlay flash-${color}`;
    this.strobeEl.classList.remove('hidden');

    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => {
      this.strobeEl.className = 'strobe-overlay hidden';
    }, durationMs);
  }
}

window.GlanceAlerts = GlanceAlerts;
