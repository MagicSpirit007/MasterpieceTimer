from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(r"D:\MasterpieceTimer\scripts\verify-shots")
OUT.mkdir(parents=True, exist_ok=True)
notes: list[str] = []


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel="chrome")
        page = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            locale="zh-CN",
        ).new_page()
        page.goto("http://localhost:5173/", wait_until="domcontentloaded")
        page.wait_for_timeout(2500)

        # project 补记
        page.locator("[class*='projRow']").first.click()
        page.wait_for_timeout(500)
        page.get_by_text("补记时长").first.click()
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / "20-buji.png"))
        if page.get_by_text("补记").count() or page.get_by_role("dialog").count():
            notes.append("PASS 补记 sheet opens")
        else:
            notes.append("FAIL 补记 sheet")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)

        # archive empty
        page.goto("http://localhost:5173/#/me/archive")
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / "21-archive.png"))
        notes.append("archive: " + ("empty ok" if page.get_by_text("暂无归档项目").count() else "has items"))

        # dark appearance
        page.goto("http://localhost:5173/#/me/appearance")
        page.wait_for_timeout(400)
        page.get_by_role("tab", name="深色").click()
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / "22-appearance-dark.png"), full_page=True)
        theme = page.evaluate("() => document.documentElement.dataset.theme")
        notes.append(f"theme after 深色: {theme}")
        if theme == "dark":
            notes.append("PASS dark mode")
        else:
            notes.append("FAIL dark mode")
        page.get_by_text("油画亚麻布").click()
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / "23-dark-linen.png"))
        page.get_by_role("tab", name="浅色").click()
        page.wait_for_timeout(200)
        page.get_by_text("泛黄宣纸").click()

        # setup + handscroll
        page.goto("http://localhost:5173/#/setup")
        page.wait_for_timeout(800)
        page.screenshot(path=str(OUT / "24-setup-cd.png"), full_page=True)
        notes.append(f"countdown chips {page.locator('[aria-label=计划时长]').count()}")
        page.get_by_role("tab", name="正计时").click()
        page.wait_for_timeout(350)
        notes.append(f"countup chips {page.locator('[aria-label=计划时长]').count()}")
        page.get_by_text("千里江山图").first.click()
        page.get_by_role("button", name="开始专注").click()
        page.wait_for_timeout(500)
        if page.get_by_text("放弃并开始新专注").count():
            page.get_by_text("放弃并开始新专注").click()
            page.wait_for_timeout(1200)
        page.wait_for_timeout(1500)
        page.screenshot(path=str(OUT / "25-focus-longscroll.png"))
        notes.append("focus caption: " + page.locator("[class*='artCaption']").inner_text())
        notes.append("clock: " + page.locator("[class*='clock']").first.inner_text())

        # home after
        page.goto("http://localhost:5173/#/")
        page.wait_for_timeout(600)
        page.screenshot(path=str(OUT / "26-home-nowbar.png"))
        if page.get_by_label("继续当前专注").count():
            notes.append("PASS now bar")
        else:
            notes.append("WARN no now bar")

        browser.close()
    print("\n".join(notes))


if __name__ == "__main__":
    main()
