// EventPulse - Client-Side A* Pathfinding Engine
// Solves shortest routes with custom accessibility constraints and dynamic edge costs

class VenuePathfinder {
  constructor(venueData) {
    this.data = venueData;
  }

  // Build an adjacency list based on active options
  buildAdjacency(options = {}) {
    const { wheelchairOnly = false, blockedEdgeIds = new Set() } = options;
    const adj = {};

    // Initialize all node entries
    Object.keys(this.data.nodes).forEach((id) => {
      adj[id] = [];
    });

    // Populate bidirectional edges
    this.data.edges.forEach((edge) => {
      // Check if blocked by organizer
      if (edge.isBlocked || blockedEdgeIds.has(edge.id)) {
        return; // Corridor is physically closed
      }

      // Check wheelchair constraint
      if (wheelchairOnly && edge.hasStairs) {
        return; // Avoid stairs
      }

      const nodeA = this.data.nodes[edge.from];
      const nodeB = this.data.nodes[edge.to];
      if (!nodeA || !nodeB) return;

      adj[edge.from].push({
        to: edge.to,
        dist: edge.dist,
        edgeId: edge.id,
        name: edge.name,
        hasStairs: edge.hasStairs
      });

      adj[edge.to].push({
        to: edge.from,
        dist: edge.dist,
        edgeId: edge.id,
        name: edge.name,
        hasStairs: edge.hasStairs
      });
    });

    return adj;
  }

  // Euclidean heuristic distance for A*
  heuristic(nodeAId, nodeBId) {
    const a = this.data.nodes[nodeAId];
    const b = this.data.nodes[nodeBId];
    if (!a || !b) return 0;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy) * 0.2; // Scale factor to approximate meters
  }

  // Find shortest path between startNodeId and targetNodeId
  findPath(startNodeId, targetNodeId, options = {}) {
    if (!this.data.nodes[startNodeId] || !this.data.nodes[targetNodeId]) {
      return null;
    }
    if (startNodeId === targetNodeId) {
      return {
        path: [startNodeId],
        distance: 0,
        estimatedSeconds: 0,
        instructions: ['You are already at your destination.']
      };
    }

    const adj = this.buildAdjacency(options);
    const openSet = new Set([startNodeId]);
    const cameFrom = {};

    const gScore = {};
    const fScore = {};

    Object.keys(this.data.nodes).forEach((id) => {
      gScore[id] = Infinity;
      fScore[id] = Infinity;
    });

    gScore[startNodeId] = 0;
    fScore[startNodeId] = this.heuristic(startNodeId, targetNodeId);

    while (openSet.size > 0) {
      // Find node in openSet with lowest fScore
      let current = null;
      let lowestF = Infinity;
      openSet.forEach((nodeId) => {
        if (fScore[nodeId] < lowestF) {
          lowestF = fScore[nodeId];
          current = nodeId;
        }
      });

      if (current === targetNodeId) {
        // Reconstruct path
        const path = [current];
        while (cameFrom[current]) {
          current = cameFrom[current];
          path.unshift(current);
        }

        const totalDist = gScore[targetNodeId];
        const estimatedSeconds = Math.round(totalDist / 1.1); // 1.1 m/s average indoor walking pace
        const instructions = this.generateInstructions(path, adj);

        return {
          path,
          distance: Math.round(totalDist),
          estimatedSeconds,
          instructions
        };
      }

      openSet.delete(current);

      const neighbors = adj[current] || [];
      for (const edge of neighbors) {
        const tentativeG = gScore[current] + edge.dist;
        if (tentativeG < gScore[edge.to]) {
          cameFrom[edge.to] = current;
          gScore[edge.to] = tentativeG;
          fScore[edge.to] = tentativeG + this.heuristic(edge.to, targetNodeId);
          openSet.add(edge.to);
        }
      }
    }

    // No path found (e.g. all corridors blocked or stairs restricted with no ramp)
    return null;
  }

  // Generate natural step-by-step turn instructions
  generateInstructions(path, adj) {
    if (path.length <= 1) return ['Arrived at destination'];
    const steps = [];

    for (let i = 0; i < path.length - 1; i++) {
      const fromId = path[i];
      const toId = path[i + 1];
      const fromNode = this.data.nodes[fromId];
      const toNode = this.data.nodes[toId];

      const connection = (adj[fromId] || []).find((e) => e.to === toId);
      const hallwayName = connection ? connection.name : 'hallway';
      const dist = connection ? connection.dist : 20;

      if (i === 0) {
        steps.push(`From ${fromNode.label}, walk along ${hallwayName} (${dist}m)`);
      } else if (i === path.length - 2) {
        steps.push(`Follow ${hallwayName} to arrive at ${toNode.label} (${dist}m)`);
      } else {
        steps.push(`Continue past ${fromNode.label} via ${hallwayName} (${dist}m)`);
      }
    }

    return steps;
  }
}

window.VenuePathfinder = VenuePathfinder;
