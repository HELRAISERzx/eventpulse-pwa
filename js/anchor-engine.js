// EventPulse - Anchor Positioning Engine
// Supports QR Camera Scanning + 2-Character Manual Code Input ('B4', 'A1', 'C2')

class AnchorEngine {
  constructor(venueData, onAnchorChanged) {
    this.data = venueData;
    this.onAnchorChanged = onAnchorChanged;
    this.currentCode = 'B4';
    this.currentNodeId = 'n_b4';
  }

  // Lookup and set location by short 2-character code
  locateByCode(rawCode) {
    if (!rawCode) return false;
    const cleanCode = rawCode.trim().toUpperCase();

    // Find in anchors
    const match = this.data.anchors.find(
      (a) => a.code === cleanCode || a.code.replace('-', '') === cleanCode
    );

    if (match) {
      this.currentCode = match.code;
      this.currentNodeId = match.nodeRef;
      if (this.onAnchorChanged) {
        this.onAnchorChanged(this.currentCode, this.currentNodeId);
      }
      return true;
    }

    return false;
  }

  getCurrentAnchor() {
    return {
      code: this.currentCode,
      nodeId: this.currentNodeId,
      node: this.data.nodes[this.currentNodeId]
    };
  }
}

window.AnchorEngine = AnchorEngine;
