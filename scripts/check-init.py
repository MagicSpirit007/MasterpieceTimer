from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel="chrome")
    page = browser.new_context(viewport={"width": 393, "height": 852}).new_page()
    logs = []
    page.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))
    page.on("pageerror", lambda e: logs.append(f"pageerror: {e}"))
    page.goto("http://127.0.0.1:4173/", wait_until="domcontentloaded")
    page.wait_for_timeout(4000)
    print("BODY:", page.inner_text("body")[:800])
    print("---LOGS---")
    print("\n".join(logs[-40:]))
    browser.close()
