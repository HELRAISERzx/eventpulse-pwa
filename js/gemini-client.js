// EventPulse — Gemini AI Client (Browser-Direct)
// Calls the Gemini REST API directly from the browser when an API key is provided.
// Falls back to the local proxy (/api/assistant) or curated local responses if unavailable.

class GeminiClient {
  constructor() {
    this.STORAGE_KEY = 'eventpulse-gemini-key';
    this.MODEL = 'gemini-2.0-flash';
    this.BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.apiKey = this._loadKey();
  }

  // ── Key Management ──────────────────────────────────────────────

  _loadKey() {
    try { return localStorage.getItem(this.STORAGE_KEY) || ''; } catch { return ''; }
  }

  setKey(key) {
    this.apiKey = (key || '').trim();
    try { localStorage.setItem(this.STORAGE_KEY, this.apiKey); } catch { }
  }

  clearKey() {
    this.apiKey = '';
    try { localStorage.removeItem(this.STORAGE_KEY); } catch { }
  }

  hasKey() {
    return this.apiKey.length > 10;
  }

  // ── Venue Context ────────────────────────────────────────────────

  _buildSystemPrompt(venueData) {
    const zoneNames = venueData && venueData.zones
      ? venueData.zones.map(function(z) { return z.name; }).join(', ')
      : 'Grand Auditorium, Innovation Expo, Food Court, Workshops, Quiet Lounge, Service Hub';
    const anchorList = venueData && venueData.nodes
      ? Object.values(venueData.nodes).filter(function(n) { return n.isAnchor; }).map(function(n) { return n.anchorCode; }).join(', ')
      : 'A1, A2, B1, B3, B4, C1, C2, D1';

    return 'You are EventPulse, a trusted real-time navigation and safety assistant embedded in a smart event app.\n\nVENUE AREAS: ' + zoneNames + '\nANCHOR PILLARS (scan points): ' + anchorList + '\nACCESSIBILITY: Step-free wheelchair routes available. Toggle the heart button for stair-free routing.\nEMERGENCY: Attendees can tap SOS to request staff dispatch.\n\nRULES:\n- Be concise (max 3 sentences or 3 steps).\n- Reference real venue areas and pillar codes when relevant.\n- For emergency topics, always tell the user to tap SOS and find the nearest exit or staff.\n- For accessibility, recommend the step-free toggle and quiet zones.\n- For navigation, give actionable step directions from current pillar.\n- For schedule, refer to the in-app schedule panel.\n- Never invent locations or make up safety instructions.\n- Respond in plain text only. No markdown.';
  }

  // ── Core API Call ────────────────────────────────────────────────

  async ask(userText, topic, venueData) {
    topic = topic || 'navigation';
    if (!this.hasKey()) return null;

    var systemPrompt = this._buildSystemPrompt(venueData);
    var url = this.BASE_URL + '/' + this.MODEL + ':generateContent?key=' + this.apiKey;

    var body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: '[Topic: ' + topic + '] ' + userText }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 256, topP: 0.9 },
      safetySettings: [
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
      ]
    };

    var response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    var data = await response.json();

    if (!response.ok) {
      var errMsg = (data && data.error && data.error.message) ? data.error.message : 'Gemini API error ' + response.status;
      throw new Error(errMsg);
    }

    var text = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
    if (!text) throw new Error('Empty response from Gemini');
    return text.trim();
  }

  // ── Streaming API Call ───────────────────────────────────────────

  async askStreaming(userText, topic, venueData, onChunk) {
    topic = topic || 'navigation';
    if (!this.hasKey()) return null;

    var systemPrompt = this._buildSystemPrompt(venueData);
    var url = this.BASE_URL + '/' + this.MODEL + ':streamGenerateContent?key=' + this.apiKey + '&alt=sse';

    var body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: '[Topic: ' + topic + '] ' + userText }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 256, topP: 0.9 }
    };

    var response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok || !response.body) {
      throw new Error('Streaming failed: ' + response.status);
    }

    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var fullText = '';
    var buffer = '';

    while (true) {
      var result = await reader.read();
      if (result.done) break;

      buffer += decoder.decode(result.value, { stream: true });
      var lines = buffer.split('\n');
      buffer = lines.pop();

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line.startsWith('data: ')) continue;
        var jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;
        try {
          var chunk = JSON.parse(jsonStr);
          var part = chunk && chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content && chunk.candidates[0].content.parts && chunk.candidates[0].content.parts[0] && chunk.candidates[0].content.parts[0].text;
          if (part) {
            fullText += part;
            if (onChunk) onChunk(fullText);
          }
        } catch (e) { /* skip malformed chunk */ }
      }
    }

    return fullText.trim() || null;
  }

  // ── Connection Test ──────────────────────────────────────────────

  async testConnection() {
    try {
      var result = await this.ask('Say "EventPulse ready" in exactly those words.', 'navigation', null);
      return { ok: true, message: result || 'Connected to Gemini' };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }
}

window.GeminiClient = GeminiClient;
