import json
import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Go to a safe place first
    page.goto("http://localhost:5173")
    page.wait_for_timeout(500)

    # Seed localStorage mock session
    session_data = {
        "user": {
            "id": "mock-admin-1",
            "name": "Mock Admin",
            "siteRole": "SITE_ADMIN",
            "vrchatUsername": "mock_vrchat"
        },
        "session": {
            "token": "mock-token-xyz"
        }
    }
    # Set item in localStorage
    page.evaluate(f"localStorage.setItem('lightwing:mock:session', '{json.dumps(session_data)}');")
    page.wait_for_timeout(500)

    # Now navigate to the Admin Event details page
    page.goto("http://localhost:5173/admin/events/evt_mock_001")
    page.wait_for_timeout(2000)

    # Click on the 'Races & Tracks (2)' tab button
    page.click("button:has-text('Races & Tracks')")
    page.wait_for_timeout(2000)

    # Click on the race sequence 2 button
    page.click("button:has-text('#2. Derby Classic')")
    page.wait_for_timeout(2000)

    # Take screenshot of the selected race standings grid
    os.makedirs("verification/screenshots", exist_ok=True)
    page.screenshot(path="verification/screenshots/verification_selected_race.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        os.makedirs("verification/videos", exist_ok=True)
        context = browser.new_context(
            record_video_dir="verification/videos",
            viewport={"width": 1280, "height": 1200}
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
