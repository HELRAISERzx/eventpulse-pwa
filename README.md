# ⚡ EventPulse — Smart Indoor Event Navigation & Crowd Safety PWA

> **An ultra-lightweight, offline-first Progressive Web App (PWA) delivering real-time indoor navigation, stochastic crowd rerouting, accessibility-first routing, group flock tracking, and an intelligent event copilot powered by Google Gemini 2.0 Flash.**

---

## 🎯 Problem Statement & Solution Mapping

Large-scale indoor conferences, expos, and festivals present critical spatial navigation and crowd safety bottlenecks that legacy GPS-based mapping apps cannot solve. Below is how EventPulse maps directly to these operational challenges:

| # | Specific Challenge | EventPulse Solution |
|---|---|---|
| **1** | **GPS Failure Indoors:** Satellite GPS signal degrades inside convention centers, producing erratic inaccurate positioning. | **Anchor-Based Spatial Graph:** Lightweight 2-character pillar codes (A1–D2) and high-visibility QR anchors allow instant zero-friction location recalibration without Bluetooth beacons or Wi-Fi triangulation. |
| **2** | **Overcrowding & Stampede Surges:** Sudden exodus from keynote halls creates high-density bottleneck corridors and stampede risks. | **Organizer Surge Broadcaster & Dynamic Roadblocks:** Organizers monitor real-time zone capacities (with 85% Warning & 95% Critical alerts). When a hazard occurs, coordinators trigger stampede alerts, block critical corridors, and deploy **stochastic crowd rerouting** (rerouting an adjustable percentage of attendees around congestion to prevent secondary stampedes). |
| **3** | **Specially-Abled Accessibility Barriers:** Attendees using wheelchairs or mobility aids face unexpected stairs, escalators, and steep obstacles. | **A* Step-Free Routing Engine:** Built-in Wheelchair Mode filters out physical stairways (`e_a2_b2`, `e_c1_wsb`), rerouting attendees via ramps and elevators. Displays an animated emerald green accessibility ribbon (`♿`) and dynamic `🚫 STAIRS AVOIDED` corridor warnings. |
| **4** | **Group Separation ("Flock Loss"):** Families and conference teams moving together frequently get separated in dense crowds. | **Flock Mode & Automated Leadership Failover:** Group tethering tracks inter-member distances. If a leader strays >35m or battery drops below 15%, the system triggers an emergency alert, auto-passes leadership to the closest peer, and pins the strayed member’s last known pillar. |
| **5** | **Sensory Overload & Missed Critical Turns:** Attendees looking down at phones bump into people; noisy exhibition halls drown out audio. | **Eyes-Up Multi-Modal Alerts:** Turn-by-turn guidance combines Web Audio spatial chirps, Vibration API haptic pulses, and a high-contrast screen strobe fallback for ambient awareness. |
| **6** | **Information Chaos & Event Disruption:** Last-minute schedule changes or room relocations cause massive attendee confusion. | **Real-Time Synchronized Broadcasts:** Organizers push instant schedule delays and venue relocations that automatically re-path all active navigation routes directly to the new hall. |
| **7** | **Instant Context-Aware Assistance:** Attendees need quick, trustworthy answers about sessions, quiet zones, and emergency exits. | **Gemini 2.0 Flash Copilot:** Browser-direct Gemini AI integration with full architectural graph context. Delivers real-time, event-grounded advice with one-tap prompt chips. |

---

## 🚀 Live Demo & Deployment

### 🌐 Instant Access (No Login Required)
EventPulse is engineered as a **100% static Progressive Web App (HTML5/Canvas2D/ES6)**. It has **zero build step** and runs natively on any static host or web browser.

#### Deploying to GitHub Pages in 30 Seconds:
1. Push this repository to GitHub.
2. Go to **Settings** → **Pages**.
3. Under **Build and deployment**, set Source to **Deploy from a branch** (`main` / root `/`).
4. Click **Save**. Your app will be live at:
   ```
   https://<your-username>.github.io/<repo-name>/
   ```

#### Running Locally:
```bash
# Option A: Built-in Node HTTP Server
node -e "const http=require('http'),fs=require('fs'),path=require('path');const MIME={'html':'text/html','css':'text/css','js':'application/javascript','json':'application/json','png':'image/png'};http.createServer((req,res)=>{let f=req.url==='/'?'index.html':req.url.slice(1).split('?')[0];let p=path.join(process.cwd(),f);if(!fs.existsSync(p)){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f).slice(1)]||'text/plain'});fs.createReadStream(p).pipe(res);}).listen(3000,()=>console.log('Running on http://localhost:3000'));"

# Option B: Python Simple Server
python -m http.server 3000
```
Open **`http://localhost:3000`** in your browser.

---

## 📱 Attendee Experience Features

* **Architectural 2D Canvas Engine:** 60fps hardware-accelerated canvas rendering physical walls, wide corridors, and marked doorways.
* **Semantic Zoom LOD:** Macro room footprints zoom into detailed stall pictograms (Food, Merch, Coding Labs, Quiet Lounges).
* **Step-Free Accessibility Mode:** Emerald green route ribbon (`♿`) avoiding all stairs, escalators, and steep bottlenecks.
* **Flock Mode Group Tethering:** Real-time distance tracking to team leader, battery monitoring, and automatic leadership failover.
* **Accessibility SOS Desk:** Priority ticket dispatch directly to organizer operations.
* **Gemini 2.0 Flash AI Copilot:** Floating and toolbar-accessible AI guide with streaming responses and instant topic chips.
* **Offline-First PWA:** Service Worker (`sw.js`) with Network-First caching ensures full map functionality even during network outages.

---

## 🖥️ Organizer Command Center Features

* **Passcode-Gated Security:** Protected by coordinator PINs (`EVENT2026`, `7700`, `ADMIN`, `OP2026`).
* **Live Zone Capacity Radar:** Real-time meters for all 7 macro areas with visual threshold alerts (`⚠️ HIGH` @ 85%, `🚨 CRITICAL` @ 95%).
* **Emergency Stampede Broadcaster:** One-touch critical red siren strobe, automatic corridor barrier deployment, and attendee recalculation.
* **Dynamic Corridor Roadblocks:** Select and lock down congested corridors in real-time.
* **Stochastic Crowd Rerouting:** Reroutes an adjustable percentage (10%–100%) of attendees to avoid thundering herd oscillations.
* **Venue Relocation & Schedule Manager:** Push timetable shifts and auto-redirect all attendees to alternate auditoriums.
* **Accessibility SOS Queue:** Real-time triage and staff dispatch for attendees requesting mobility or sensory support.

---

## 🧪 Automated Test Suite

EventPulse includes unit tests verifying pathfinding, wheelchair stair-exclusion, and dynamic detour calculations:

```bash
# Run unit tests
node test_pathfinder_logic.js
```

**Results (100% Passing):**
* `Test 1`: Route B4 to Keynote Hall (155m, 5 nodes) — **PASS**
* `Test 2A`: Standard Path to Workshop B — **PASS**
* `Test 2B`: Wheelchair Mode blocks stairway to Workshop B — **PASS**
* `Test 3A`: Open Corridor A1 to B3 — **PASS**
* `Test 3B`: Dynamic Roadblock Detour via Galleria — **PASS**

---

## 🛠️ Technology Stack

* **Frontend:** Vanilla HTML5, Modern ES6+, Canvas 2D API, Web Audio API, Vibration API
* **AI Copilot:** Google Gemini 2.0 Flash REST API (`@google/genai` compatible)
* **PWA & Offline:** Service Worker (`sw.js`), Web App Manifest (`manifest.json`)
* **Spatial Algorithms:** Custom A* Pathfinding Graph with edge-weighted cost and conditional barrier filtering
* **Zero Dependencies:** Pure vanilla architecture, zero build lag, instant load time (~130KB total footprint).

---

## 📄 License
MIT License. Built for hackathon presentation and smart city / venue crowd management.
