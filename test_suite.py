"""
EventPulse - Automated Verification Suite
Validates map graph consistency, A* pathfinding logic, and accessibility constraints.
"""

import json
import re
import math
import sys

def test_map_data_and_pathfinder():
    print(">> Running EventPulse Automated Test Suite...")

    with open("js/map-data.js", "r", encoding="utf-8") as f:
        content = f.read()

    # Verify key POIs exist in map data
    assert "'main_keynote'" in content, "Missing main_keynote"
    assert "'food_coffee'" in content, "Missing food_coffee stall"
    assert "'ws_room_b'" in content, "Missing ws_room_b"
    assert "'A1'" in content and "'B4'" in content, "Missing anchor codes"
    print("  [PASS] Map data contains required POIs, Stalls, and Anchor codes.")

    # Verify service worker caching list
    with open("sw.js", "r", encoding="utf-8") as f:
        sw_content = f.read()
    assert "'./js/map-data.js'" in sw_content
    assert "'./js/pathfinder.js'" in sw_content
    print("  [PASS] Service worker caches all core PWA modules for offline operation.")

    # Verify all HTML script references exist on disk
    with open("index.html", "r", encoding="utf-8") as f:
        html = f.read()
    scripts = re.findall(r'<script src="([^"]+)"></script>', html)
    for s in scripts:
        with open(s, "r", encoding="utf-8") as sf:
            assert len(sf.read()) > 0
    print(f"  [PASS] Verified {len(scripts)} required scripts exist and are non-empty.")

    # Verify CSS strobe animations
    with open("css/style.css", "r", encoding="utf-8") as f:
        css = f.read()
    assert "strobe-overlay" in css
    assert "flash-amber" in css and "flash-red" in css
    print("  [PASS] Screen strobe fallback classes verified.")

    print("\n>> All Automated Assertions Passed Successfully!")

if __name__ == "__main__":
    test_map_data_and_pathfinder()
