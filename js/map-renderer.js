// EventPulse - Architectural 2D Canvas Map Engine
// Renders physical corridors, explicit doors, directional navigation chevrons, and user compass pointers

class VenueMapRenderer {
  constructor(canvas, venueData, onNodeClick) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.data = venueData;
    this.onNodeClick = onNodeClick;

    // Viewport transform state
    this.scale = 0.95;
    this.panX = 20;
    this.panY = 20;

    // Active path & position state
    this.currentAnchor = 'n_b4'; // Default to Food Court B4
    this.targetNodeId = null;
    this.activeRoute = null; // Array of node IDs
    this.routeDashOffset = 0;
    this.blockedEdgeIds = new Set();
    this.categoryFilter = 'all';
    this.isWheelchairMode = false;
    this.isOrganizerMode = false;
    this.zoneCapacities = {};
    this.onCorridorClick = null;

    // Compass heading & facing direction tracking
    this.userHeadingAngle = 0;
    this.cursorWorldX = null;
    this.cursorWorldY = null;
    this.isCursorOnCanvas = false;
    this.cursorFacingAngle = 0;
    this.lastRawMouseX = null;
    this.lastRawMouseY = null;
    this.deviceCompassAngle = null;

    // Listen to mobile gyro compass if available
    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => {
        if (e.alpha !== null && e.alpha !== undefined) {
          this.deviceCompassAngle = (e.alpha * Math.PI) / 180;
        }
      }, { passive: true });
    }

    this.needsRedraw = true;
    this.initCanvasSize();
    this.bindEvents();
    this.startRenderLoop();
  }

  requestRender() {
    this.needsRedraw = true;
  }

  initCanvasSize() {
    if (!this.canvas.parentElement) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cssWidth = rect.width;
    this.cssHeight = rect.height;
    this.requestRender();
  }

  bindEvents() {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let touchStartDist = 0;

    let resizeRaf = null;
    window.addEventListener('resize', () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        this.initCanvasSize();
      });
    }, { passive: true });

    let downX = 0;
    let downY = 0;

    // Mouse drag
    this.canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      downX = e.clientX;
      downY = e.clientY;
      startX = e.clientX - this.panX;
      startY = e.clientY - this.panY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      this.panX = e.clientX - startX;
      this.panY = e.clientY - startY;
      this.requestRender();
    }, { passive: true });

    this.canvas.addEventListener('mousemove', (e) => {
      if (isDragging) {
        this.canvas.style.cursor = 'grabbing';
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - this.panX) / this.scale;
      const mouseY = (e.clientY - rect.top - this.panY) / this.scale;

      let isOverClickable = false;
      for (const [id, node] of Object.entries(this.data.nodes)) {
        const hitRadius = node.isAnchor ? 28 : 34;
        if (Math.hypot(mouseX - node.x, mouseY - node.y) <= hitRadius) {
          isOverClickable = true;
          break;
        }
      }
      if (!isOverClickable && this.data.zones) {
        for (const z of this.data.zones) {
          if (mouseX >= z.x && mouseX <= z.x + z.w && mouseY >= z.y && mouseY <= z.y + z.h) {
            isOverClickable = true;
            break;
          }
        }
      }
      this.canvas.style.cursor = isOverClickable ? 'pointer' : 'grab';
    }, { passive: true });

    window.addEventListener('mouseup', (e) => {
      if (isDragging) {
        const moveDist = Math.hypot(e.clientX - downX, e.clientY - downY);
        if (moveDist < 10) {
          this.handlePointerClick(e.clientX, e.clientY);
        }
      }
      isDragging = false;
    });

    // Mouse wheel zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      this.zoomAt(zoomFactor, e.clientX, e.clientY);
    }, { passive: false });

    // Touch events
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        downX = e.touches[0].clientX;
        downY = e.touches[0].clientY;
        startX = e.touches[0].clientX - this.panX;
        startY = e.touches[0].clientY - this.panY;
      } else if (e.touches.length === 2) {
        isDragging = false;
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches.length === 1) {
        this.panX = e.touches[0].clientX - startX;
        this.panY = e.touches[0].clientY - startY;
        this.requestRender();
      } else if (e.touches.length === 2) {
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (touchStartDist > 0) {
          const factor = currentDist / touchStartDist;
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          this.zoomAt(factor, midX, midY);
          touchStartDist = currentDist;
        }
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', (e) => {
      if (isDragging && e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const moveDist = Math.hypot(touch.clientX - downX, touch.clientY - downY);
        if (moveDist < 12) {
          this.handlePointerClick(touch.clientX, touch.clientY);
        }
      }
      isDragging = false;
      touchStartDist = 0;
    });
  }

  zoomAt(factor, clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    const newScale = Math.min(Math.max(this.scale * factor, 0.6), 2.8);
    this.panX = mouseX - (mouseX - this.panX) * (newScale / this.scale);
    this.panY = mouseY - (mouseY - this.panY) * (newScale / this.scale);
    this.scale = newScale;

    this.updateZoomBadge();
    this.requestRender();
  }

  zoomIn() {
    this.zoomAt(1.25, this.cssWidth / 2, this.cssHeight / 2);
  }

  zoomOut() {
    this.zoomAt(0.8, this.cssWidth / 2, this.cssHeight / 2);
  }

  centerOnNode(nodeId) {
    const node = this.data.nodes[nodeId];
    if (!node) return;
    this.panX = this.cssWidth / 2 - node.x * this.scale;
    this.panY = this.cssHeight / 2 - node.y * this.scale;
    this.requestRender();
  }

  updateZoomBadge() {
    const badge = document.getElementById('zoomLevelBadge');
    if (badge) {
      const modeText = this.scale >= 1.25 ? 'High Detail' : 'Overview';
      badge.textContent = `Zoom: ${this.scale.toFixed(1)}x (${modeText})`;
    }
  }

  distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  handlePointerClick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const clickX = (clientX - rect.left - this.panX) / this.scale;
    const clickY = (clientY - rect.top - this.panY) / this.scale;

    // 1. Check nodes first (POI or Anchor) with generous hit radius
    let closestNode = null;
    let closestDist = Infinity;

    for (const [id, node] of Object.entries(this.data.nodes)) {
      const dist = Math.hypot(clickX - node.x, clickY - node.y);
      const hitRadius = node.isAnchor ? 28 : 34; // Generous hit radius for both touch and desktop clicks
      if (dist <= hitRadius && dist < closestDist) {
        closestDist = dist;
        closestNode = node;
      }
    }

    if (closestNode) {
      if (this.onNodeClick) {
        this.onNodeClick(closestNode, clientX, clientY);
      }
      return;
    }

    // 2. Fallback: Check if clicked inside an architectural Room / Zone
    if (this.data.zones) {
      const zoneNodeMap = {
        'zone_keynote': 'main_keynote',
        'zone_expo': 'main_stage2',
        'zone_food': 'food_coffee',
        'zone_workshops': 'ws_room_a',
        'zone_lounge': 'buff_quiet',
        'zone_services': 'restroom_main'
      };

      for (const z of this.data.zones) {
        if (clickX >= z.x && clickX <= z.x + z.w && clickY >= z.y && clickY <= z.y + z.h) {
          let bestNode = null;
          let bestDist = Infinity;
          for (const [id, node] of Object.entries(this.data.nodes)) {
            if (node.isAnchor) continue;
            if (node.x >= z.x - 20 && node.x <= z.x + z.w + 20 && node.y >= z.y - 20 && node.y <= z.y + z.h + 20) {
              const d = Math.hypot(clickX - node.x, clickY - node.y);
              if (d < bestDist) {
                bestDist = d;
                bestNode = node;
              }
            }
          }
          if (!bestNode && zoneNodeMap[z.id]) {
            bestNode = this.data.nodes[zoneNodeMap[z.id]];
          }
          if (bestNode && this.onNodeClick) {
            this.onNodeClick(bestNode, clientX, clientY);
            return;
          }
        }
      }
    }

    // 3. Check Corridors / Edges (Organizers can click directly to toggle roadblocks)
    if (this.onCorridorClick || this.isOrganizerMode) {
      for (const edge of this.data.edges) {
        const n1 = this.data.nodes[edge.from];
        const n2 = this.data.nodes[edge.to];
        if (!n1 || !n2) continue;
        const dist = this.distToSegment(clickX, clickY, n1.x, n1.y, n2.x, n2.y);
        const hitWidth = Math.max((edge.width || 24) / 2 + 8, 18);
        if (dist <= hitWidth) {
          if (this.onCorridorClick) {
            this.onCorridorClick(edge, clientX, clientY);
            return;
          }
        }
      }
    }
  }

  startRenderLoop() {
    const loop = () => {
      this.animationFrameId = requestAnimationFrame(loop);

      // Skip render if page is backgrounded or canvas is hidden
      if (document.hidden || !this.canvas.offsetParent || this.cssWidth <= 0) {
        return;
      }

      const hasActiveRoute = !!(this.activeRoute && this.activeRoute.length >= 2);
      const hasSurge = Object.values(this.zoneCapacities).some((c) => c >= 95);

      if (hasActiveRoute || hasSurge || this.needsRedraw) {
        if (hasActiveRoute) {
          this.routeDashOffset -= 1.2;
        }
        this.needsRedraw = false;
        this.render();
      }
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  render() {
    if (!this.canvas.offsetParent || this.cssWidth <= 0) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.scale, this.scale);

    // 1. Draw Architectural Rooms & Walls
    this.drawRoomsAndWalls(ctx);

    // 2. Draw Wide Physical Walkway Corridors
    this.drawPhysicalCorridors(ctx);

    // 3. Draw Explicit Doors & Entrance Thresholds
    this.drawDoors(ctx);

    // 4. Draw Well-Defined Navigation Path Ribbon with Directional Chevrons
    this.drawActivePathWithChevrons(ctx);

    // 5. Draw POI Nodes (with Semantic Zoom)
    this.drawNodes(ctx);

    // 6. Draw User Marker with Directional Compass Pointer & Destination
    this.drawUserAndDestination(ctx);

    ctx.restore();
  }

  // Draw defined physical rooms and exterior architectural walls
  drawRoomsAndWalls(ctx) {
    this.data.zones.forEach((z) => {
      const cap = this.zoneCapacities[z.id] !== undefined ? this.zoneCapacities[z.id] : (z.capacity || 40);

      // Room floor fill with dynamic capacity alert states
      if (cap >= 95) {
        // Critical danger state: pulsing red hazard
        const pulse = (Math.sin(Date.now() / 180) + 1) / 2;
        ctx.fillStyle = `rgba(244, 63, 94, ${0.16 + pulse * 0.16})`;
        ctx.beginPath();
        ctx.roundRect(z.x, z.y, z.w, z.h, 10);
        ctx.fill();

        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 4;
        ctx.stroke();
      } else if (cap >= 85) {
        // Warning surge state: amber glow
        ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
        ctx.beginPath();
        ctx.roundRect(z.x, z.y, z.w, z.h, 10);
        ctx.fill();

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3.5;
        ctx.stroke();
      } else {
        // Nominal room floor fill
        ctx.fillStyle = z.color;
        ctx.beginPath();
        ctx.roundRect(z.x, z.y, z.w, z.h, 10);
        ctx.fill();

        // Solid architectural wall perimeter
        ctx.strokeStyle = z.wallColor;
        ctx.lineWidth = z.wallWidth || 3;
        ctx.stroke();
      }

      // Inner wall accent line (gives architectural depth)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(z.x + 4, z.y + 4, z.w - 8, z.h - 8, 8);
      ctx.stroke();

      // Room Header Banner
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(z.x + 8, z.y + 8, z.w - 16, 26);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`${z.icon}  ${z.name.toUpperCase()}`, z.x + 14, z.y + 25);

      // Dynamic Capacity Badge on Zone Header
      if (cap >= 95) {
        ctx.fillStyle = '#f43f5e';
        ctx.font = 'bold 9px system-ui';
        ctx.textAlign = 'right';
        ctx.fillText(`🚨 CRITICAL ${cap}%`, z.x + z.w - 14, z.y + 25);
      } else if (cap >= 85) {
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 9px system-ui';
        ctx.textAlign = 'right';
        ctx.fillText(`⚠️ SURGE ${cap}%`, z.x + z.w - 14, z.y + 25);
      } else {
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 9px system-ui';
        ctx.textAlign = 'right';
        ctx.fillText(`${cap}% CAP`, z.x + z.w - 14, z.y + 25);
      }

      // Subtext
      if (z.subtext && this.scale >= 0.85) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px system-ui';
        ctx.fillText(z.subtext, z.x + 14, z.y + 44);
      }
    });
  }

  // Draw wide physical hallway corridors (not abstract thin lines)
  drawPhysicalCorridors(ctx) {
    this.data.edges.forEach((edge) => {
      const n1 = this.data.nodes[edge.from];
      const n2 = this.data.nodes[edge.to];
      if (!n1 || !n2) return;

      const isBlocked = edge.isBlocked || this.blockedEdgeIds.has(edge.id);
      const corridorWidth = edge.width || 24;

      // 1. Walkable Corridor Surface Floor
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(n1.x, n1.y);
      ctx.lineTo(n2.x, n2.y);
      ctx.strokeStyle = isBlocked ? 'rgba(244, 63, 94, 0.12)' : 'rgba(30, 41, 59, 0.7)';
      ctx.lineWidth = corridorWidth;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 2. Corridor Border Curbs
      ctx.strokeStyle = isBlocked ? 'rgba(244, 63, 94, 0.4)' : 'rgba(71, 85, 105, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 3. Special Floor Textures (Stairs vs Open Hallway vs Blocked)
      if (isBlocked) {
        // Roadblock barrier stripes
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 5;
        ctx.setLineDash([8, 8]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Roadblock barrier sign in center of corridor
        const midX = (n1.x + n2.x) / 2;
        const midY = (n1.y + n2.y) / 2;

        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        const badgeWidth = this.isOrganizerMode ? 90 : 72;
        ctx.roundRect(midX - badgeWidth / 2, midY - 10, badgeWidth, 20, 5);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.isOrganizerMode ? '🚧 ROADBLOCK ✕' : '⛔ BLOCKED', midX, midY);
      } else if (edge.hasStairs) {
        // Physical stair treads across corridor
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = corridorWidth - 6;
        ctx.setLineDash([3, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Stair badge
        const midX = (n1.x + n2.x) / 2;
        const midY = (n1.y + n2.y) / 2;
        if (this.isWheelchairMode) {
          ctx.fillStyle = '#7f1d1d';
          ctx.fillRect(midX - 44, midY - 10, 88, 20);
          ctx.strokeStyle = '#f87171';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(midX - 44, midY - 10, 88, 20);
          ctx.fillStyle = '#fecaca';
          ctx.font = 'bold 9px system-ui';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🚫 STAIRS AVOIDED', midX, midY);
        } else {
          ctx.fillStyle = '#78350f';
          ctx.fillRect(midX - 24, midY - 8, 48, 16);
          ctx.fillStyle = '#fde68a';
          ctx.font = 'bold 8px system-ui';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('STAIRS ≡', midX, midY);
        }
      } else {
        // Subtle walking centerline or organizer clickable highlight
        if (this.isOrganizerMode) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 6]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      ctx.restore();
    });
  }

  // Draw explicit physical doors and room entryways
  drawDoors(ctx) {
    if (!this.data.doors) return;

    this.data.doors.forEach((door) => {
      ctx.save();
      const { x, y, w, h, label, orientation } = door;

      // Door threshold frame
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);

      // Glowing threshold line
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (orientation === 'horizontal') {
        ctx.moveTo(x - w / 2 + 2, y);
        ctx.lineTo(x + w / 2 - 2, y);
      } else {
        ctx.moveTo(x, y - h / 2 + 2);
        ctx.lineTo(x, y + h / 2 - 2);
      }
      ctx.stroke();

      // Door icon & label
      if (this.scale >= 0.8) {
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(x - 22, y - 16, 44, 13);
        ctx.fillStyle = '#e0f2fe';
        ctx.font = 'bold 8px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('DOOR 🚪', x, y - 9);
      }

      ctx.restore();
    });
  }

  // Draw active path ribbon with animated forward-pointing directional chevrons
  drawActivePathWithChevrons(ctx) {
    if (!this.activeRoute || this.activeRoute.length < 2) return;

    const points = this.activeRoute.map((id) => this.data.nodes[id]).filter(Boolean);
    if (points.length < 2) return;

    ctx.save();

    if (this.isWheelchairMode) {
      // ── Wheelchair / Step-Free Mode ─────────────────────────────────────
      // 1. Broad outer glow (green)
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.30)';
      ctx.lineWidth = 22;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // 2. High-visibility green ribbon (slightly thicker)
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 8;
      ctx.stroke();

      // 3. Dashed white centre-line to reinforce path
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);

      // 4. ♿ Wheelchair symbols along each segment
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const iconSpacing = 42;

      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const segDx = p2.x - p1.x;
        const segDy = p2.y - p1.y;
        const segLen = Math.hypot(segDx, segDy);
        const offset = (this.routeDashOffset % iconSpacing + iconSpacing) % iconSpacing;

        for (let dist = offset; dist < segLen; dist += iconSpacing) {
          const ax = p1.x + (segDx / segLen) * dist;
          const ay = p1.y + (segDy / segLen) * dist;
          ctx.fillText('♿', ax, ay);
        }
      }
    } else {
      // ── Normal Mode ────────────────────────────────────────────────────
      // 1. Broad Outer Glow Ribbon
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.25)';
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // 2. High-Visibility Cyan Path Ribbon
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 6;
      ctx.stroke();

      // 3. Animated Forward-Pointing Directional Chevrons (▶ ▶ ▶)
      ctx.beginPath();
      const arrowSpacing = 32;
      const offset = ((this.routeDashOffset % arrowSpacing) + arrowSpacing) % arrowSpacing;

      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const segDx = p2.x - p1.x;
        const segDy = p2.y - p1.y;
        const segLen = Math.hypot(segDx, segDy);
        if (segLen < 1) continue;

        const cosA = segDx / segLen;
        const sinA = segDy / segLen;

        for (let dist = offset; dist < segLen; dist += arrowSpacing) {
          const ax = p1.x + cosA * dist;
          const ay = p1.y + sinA * dist;

          ctx.moveTo(ax - 6 * cosA + 5 * sinA, ay - 6 * sinA - 5 * cosA);
          ctx.lineTo(ax + 4 * cosA, ay + 4 * sinA);
          ctx.lineTo(ax - 6 * cosA - 5 * sinA, ay - 6 * sinA + 5 * cosA);
        }
      }
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    ctx.restore();
  }

  // Draw POIs with semantic zoom LOD
  drawNodes(ctx) {
    const isDetailedZoom = this.scale >= 1.25;

    for (const [id, node] of Object.entries(this.data.nodes)) {
      const isMatchCategory =
        this.categoryFilter === 'all' ||
        node.cat === this.categoryFilter ||
        node.isAnchor;

      const alpha = isMatchCategory ? 1 : 0.2;
      ctx.globalAlpha = alpha;

      // Anchor Pillars
      if (node.isAnchor) {
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 9px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.anchorCode, node.x, node.y);
        continue;
      }

      // Major Landmarks (Grand Keynote Hall & Stage 2)
      if (node.cat === 'main_event') {
        ctx.fillStyle = '#0369a1';
        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = '14px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.icon, node.x, node.y);

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 12px system-ui';
        ctx.fillText(node.label, node.x, node.y + 26);
        continue;
      }

      // Small Workshops
      if (node.cat === 'small_event') {
        ctx.fillStyle = '#065f46';
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = '12px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.icon, node.x, node.y);

        if (isDetailedZoom) {
          ctx.fillStyle = '#a7f3d0';
          ctx.font = 'bold 10px system-ui';
          ctx.fillText(node.label, node.x, node.y + 22);
        }
        continue;
      }

      // All Stalls & POIs (Food, Merch, Services, Lounges)
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = node.cat === 'food' ? '#f59e0b' : node.cat === 'merch' ? '#a855f7' : '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = '12px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.icon || '📍', node.x, node.y);

      // Label always shown with clean readability
      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 9.5px system-ui';
      ctx.fillText(node.label, node.x, node.y + 19);
    }

    ctx.globalAlpha = 1.0;
  }

  // Draw user location with Directional Heading Cone & Pointer Arrow
  drawUserAndDestination(ctx) {
    const userNode = this.data.nodes[this.currentAnchor];
    if (userNode) {
      ctx.save();
      const now = Date.now() / 1000;

      // 1. Calculate heading direction (route next-node or device compass)
      let targetHeading = this.userHeadingAngle;
      if (this.activeRoute && this.activeRoute.length >= 2) {
        const nextNode = this.data.nodes[this.activeRoute[1]];
        if (nextNode) {
          targetHeading = Math.atan2(nextNode.y - userNode.y, nextNode.x - userNode.x);
        }
      } else if (this.deviceCompassAngle !== null) {
        targetHeading = this.deviceCompassAngle;
      }

      // Smooth interpolation (lerp)
      this.userHeadingAngle += (targetHeading - this.userHeadingAngle) * 0.18;
      const heading = this.userHeadingAngle;



      // 3. Pulsing Radar Wave
      const pulseR = 15 + Math.sin(now * 3) * 4;
      ctx.beginPath();
      ctx.arc(userNode.x, userNode.y, pulseR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.fill();

      // 4. Solid Blue Location Disc (Clean circular beacon, no attached arrow pointer)
      ctx.beginPath();
      ctx.arc(userNode.x, userNode.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#0284c7';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 5. Clean Center Pin Dot
      ctx.beginPath();
      ctx.arc(userNode.x, userNode.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // 6. User Location Tag
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'center';
      const userLabel = userNode.anchorCode ? `YOU (Pillar ${userNode.anchorCode})` : 'YOU';
      ctx.fillText(userLabel, userNode.x, userNode.y - 18);

      // 7. Accessibility Route Badge (visible only in wheelchair mode)
      if (this.isWheelchairMode) {
        const badgeX = userNode.x;
        const badgeY = userNode.y + 28;
        const badgeW = 126;
        const badgeH = 16;

        // Green pill background
        ctx.beginPath();
        ctx.roundRect(badgeX - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 8);
        ctx.fillStyle = '#15803d';
        ctx.fill();
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#bbf7d0';
        ctx.font = 'bold 9px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♿ STEP-FREE ROUTE ACTIVE', badgeX, badgeY);
      }

      ctx.restore();
    }

    // Destination Pin with Glowing Target Halo
    if (this.targetNodeId) {
      const target = this.data.nodes[this.targetNodeId];
      if (target) {
        ctx.save();
        const now = Date.now() / 1000;
        const glowPulse = 14 + Math.sin(now * 4) * 3;

        // Target Ripple Halo
        ctx.beginPath();
        ctx.arc(target.x, target.y - 12, glowPulse, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Destination Badge
        ctx.fillStyle = '#e11d48';
        ctx.beginPath();
        ctx.arc(target.x, target.y - 12, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', target.x, target.y - 12);

        // Destination Label Tag
        ctx.fillStyle = '#f43f5e';
        ctx.font = 'bold 10px system-ui';
        ctx.fillText('DESTINATION', target.x, target.y - 28);

        ctx.restore();
      }
    }
  }

}

window.VenueMapRenderer = VenueMapRenderer;
