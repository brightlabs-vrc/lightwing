import json
import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Go to safe place first
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
    page.evaluate(f"localStorage.setItem('lightwing:mock:session', '{json.dumps(session_data)}');")
    page.wait_for_timeout(500)

    os.makedirs("verification/screenshots", exist_ok=True)

    # 1. Visit Profile Page
    print("Navigating to Profile Page...")
    page.goto("http://localhost:5173/profile")
    page.wait_for_timeout(2000)
    page.screenshot(path="verification/screenshots/profile_slug_edit.png")
    print("Saved profile page screenshot.")

    # 2. Visit Admin User Detail Page
    print("Navigating to Admin User Detail Page...")
    page.goto("http://localhost:5173/admin/users/mock-admin-1")
    page.wait_for_timeout(2000)
    page.screenshot(path="verification/screenshots/admin_user_slug_edit.png")
    print("Saved admin user detail page screenshot.")

    # 3. Visit Admin Team Detail Page
    print("Navigating to Admin Team Detail Page...")
    page.goto("http://localhost:5173/admin/teams/org_mock_urs")
    page.wait_for_timeout(2000)

    # Click on the "Edit Team Parameters" button
    print("Clicking Edit Team Parameters button...")
    page.click("button:has-text('Edit Team Parameters')")
    page.wait_for_timeout(1500)
    page.screenshot(path="verification/screenshots/admin_team_parameters_modal.png")
    print("Saved admin team parameters modal screenshot.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        os.makedirs("verification/videos", exist_ok=True)
        context = browser.new_context(
            record_video_dir="verification/videos",
            viewport={"width": 1280, "height": 1000}
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
