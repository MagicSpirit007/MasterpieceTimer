from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(r"D:\MasterpieceTimer\scripts\verify-shots")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel="chrome")
    page = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
        locale="zh-CN",
    ).new_page()
    page.goto("http://localhost:5173/#/setup", wait_until="domcontentloaded")
    page.wait_for_timeout(2000)
    page.screenshot(path=str(OUT / "13-setup-final.png"), full_page=True)
    print("countdown chips", page.locator("[aria-label='计划时长']").count())
    page.get_by_role("tab", name="正计时").click()
    page.wait_for_timeout(400)
    print("countup chips", page.locator("[aria-label='计划时长']").count())
    page.get_by_text("千里江山图").first.click()
    page.get_by_role("button", name="开始专注").click()
    page.wait_for_timeout(600)
    discard = page.get_by_role("button", name="放弃并开始新专注")
    if discard.count():
        discard.first.click()
        page.wait_for_timeout(1200)
    page.wait_for_timeout(800)
    page.screenshot(path=str(OUT / "14-focus-scroll.png"))
    print("clock", page.locator("[class*=clock]").first.inner_text())
    page.goto("http://localhost:5173/#/me/appearance")
    page.wait_for_timeout(600)
    page.screenshot(path=str(OUT / "15-appearance-final.png"), full_page=True)
    browser.close()
