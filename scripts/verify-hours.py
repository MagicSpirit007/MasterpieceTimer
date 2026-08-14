from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(r"D:\MasterpieceTimer\scripts\verify-shots")
BASE = "http://127.0.0.1:4173/"


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel="chrome")
        page = browser.new_context(
            viewport={"width": 393, "height": 852},
            device_scale_factor=3,
            locale="zh-CN",
        ).new_page()

        page.goto(BASE + "#/me", wait_until="domcontentloaded")
        page.wait_for_timeout(800)
        me = page.inner_text("body")
        print(("PASS" if "小时 ›" in me else "FAIL") + " me chevron hours")
        print(("PASS" if "分钟 ›" not in me or "45 分钟" not in me else "WARN") + " me no minute chip")
        page.screenshot(path=str(OUT / "hours-me.png"))

        page.goto(BASE + "#/me/coloring", wait_until="domcontentloaded")
        page.wait_for_timeout(600)
        body = page.inner_text("body")
        chips = page.locator("[class*='chip']").count()
        print("chips", chips)
        print(("PASS" if chips == 0 else "FAIL") + " no presets")
        print(("PASS" if "小时" in body else "FAIL") + " has 小时")
        print(("PASS" if "15 分钟" not in body else "FAIL") + " no 15 分钟")
        inp = page.locator("input[aria-label='上色所需小时数']")
        print("input count", inp.count(), "value", inp.input_value() if inp.count() else None)
        page.screenshot(path=str(OUT / "hours-coloring.png"))

        inp.fill("1.5")
        inp.blur()
        page.wait_for_timeout(600)
        print("after fill", inp.input_value())
        page.screenshot(path=str(OUT / "hours-coloring-15.png"))

        page.goto(BASE + "#/me", wait_until="domcontentloaded")
        page.wait_for_timeout(500)
        print("me after", page.inner_text("body").split("上色时长")[-1][:20])
        page.screenshot(path=str(OUT / "hours-me-after.png"))

        browser.close()


if __name__ == "__main__":
    main()
