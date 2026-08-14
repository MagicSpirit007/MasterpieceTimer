"""Headless walk of Masterpiece Timer against the 11-point brief."""
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(r"D:\MasterpieceTimer\scripts\verify-shots")
OUT.mkdir(parents=True, exist_ok=True)
BASE = "http://localhost:5173/"
notes: list[str] = []


def shot(page, name: str) -> None:
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=True)


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel="chrome")
        context = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            locale="zh-CN",
        )
        page = context.new_page()
        page.goto(BASE, wait_until="domcontentloaded")
        page.wait_for_timeout(2500)
        if page.get_by_text("正在准备画布").count():
            page.wait_for_timeout(3000)

        # 1 home
        shot(page, "01-home")
        greet = page.locator("p._greet_8fgqx_11, [class*='greet']").first
        greet_text = greet.inner_text() if greet.count() else ""
        notes.append(f"home greet: {greet_text!r}")
        if "空白画布" in greet_text:
            notes.append("FAIL greet still 空白画布")
        else:
            notes.append("PASS greet is not 空白画布")

        # 2 stats: 日 not 今日/指定日
        page.goto(BASE + "#/stats")
        page.wait_for_timeout(800)
        shot(page, "02-stats")
        chips = page.locator("[class*='periodChip']").all_inner_texts()
        notes.append(f"stats chips: {chips}")
        if "指定日" in chips or "今日" in chips:
            notes.append("FAIL stats still has 今日/指定日")
        elif "日" in chips:
            notes.append("PASS stats has 日")
        if page.get_by_text("年").count() and page.locator("[class*='pager']").count():
            notes.append("PASS 日 shows date pager")

        # 3 gallery
        page.goto(BASE + "#/gallery")
        page.wait_for_timeout(800)
        shot(page, "03-gallery")

        # 4 me
        page.goto(BASE + "#/me")
        page.wait_for_timeout(600)
        shot(page, "04-me")
        body = page.inner_text("body")
        if "专注默认" in body or "默认时长" in body:
            notes.append("FAIL me still has 专注默认")
        else:
            notes.append("PASS me has no 专注默认")
        for label in ("归档", "外观", "反馈"):
            if label in body:
                notes.append(f"PASS me has {label}")
            else:
                notes.append(f"FAIL me missing {label}")

        # 5 appearance canvases
        page.goto(BASE + "#/me/appearance")
        page.wait_for_timeout(600)
        shot(page, "05-appearance")
        for name in ("泛黄宣纸", "熟宣纸", "油画亚麻布", "绢本"):
            if page.get_by_text(name).count():
                notes.append(f"PASS canvas {name}")
            else:
                notes.append(f"FAIL canvas {name}")
        page.get_by_text("绢本").first.click()
        page.wait_for_timeout(400)
        shot(page, "05b-canvas-silk")

        # 6 archive
        page.goto(BASE + "#/me/archive")
        page.wait_for_timeout(500)
        shot(page, "06-archive")
        if page.get_by_text("还没有归档的项目").count() or page.get_by_text("取消归档").count():
            notes.append("PASS archive page opens")

        # 7 feedback
        page.goto(BASE + "#/me/feedback")
        page.wait_for_timeout(400)
        shot(page, "07-feedback")

        # 8 artworks / masterpieces
        page.goto(BASE + "#/artworks")
        page.wait_for_timeout(800)
        shot(page, "08-artworks")
        texts = page.inner_text("body")
        if "星夜" in texts:
            notes.append("PASS 星夜 present")
        else:
            notes.append("FAIL 星夜 missing")
        if "千里江山" in texts:
            notes.append("PASS 千里江山 present")
        else:
            notes.append("FAIL 千里江山 missing")

        # 9 project detail 补记
        page.goto(BASE + "#/")
        page.wait_for_timeout(600)
        # click first project row if present
        rows = page.locator("[class*='projRow']")
        if rows.count():
            rows.first.click()
            page.wait_for_timeout(600)
            shot(page, "09-project")
            if page.get_by_text("补记时长").count():
                notes.append("PASS project has 补记时长")
            else:
                notes.append("FAIL project missing 补记时长")
        else:
            notes.append("WARN no project row")

        # 10 setup countdown vs countup
        page.goto(BASE + "#/setup")
        page.wait_for_timeout(800)
        shot(page, "10-setup-countdown")
        chips = page.locator("[aria-label='计划时长']")
        notes.append(f"countdown duration count: {chips.count()}")
        page.get_by_role("tab", name="正计时").click()
        page.wait_for_timeout(500)
        shot(page, "10-setup-countup")
        chips_after = page.locator("[aria-label='计划时长']")
        notes.append(f"countup duration count: {chips_after.count()}")
        if chips_after.count() > 0:
            notes.append("FAIL duration chips still in DOM in countup")
        else:
            notes.append("PASS duration chips removed in countup")
        # pick 千里江山图 then start
        qianli = page.get_by_text("千里江山图").first
        if qianli.count():
            qianli.click()
            page.wait_for_timeout(300)

        # 11 start focus if possible
        start = page.get_by_role("button", name="开始专注")
        if start.count() and start.first.is_enabled():
            start.first.click()
            page.wait_for_timeout(1500)
            shot(page, "11-focus")
            clock = page.locator("[class*='clock']").first
            notes.append(f"focus clock: {clock.inner_text() if clock.count() else 'missing'}")
            if page.get_by_label("暂停").count() and page.get_by_label("提前结束").count():
                notes.append("PASS clock-side controls present")
            else:
                notes.append("FAIL clock-side controls missing")
            # overlay big buttons should be gone
            if page.locator("[class*='controlBtn']").count():
                notes.append("FAIL overlay controlBtn still present")
            else:
                notes.append("PASS no overlay controlBtn")
        else:
            notes.append("WARN cannot start focus")

        # desktop width
        page.set_viewport_size({"width": 1024, "height": 800})
        page.goto(BASE + "#/")
        page.wait_for_timeout(600)
        shot(page, "12-home-desktop")

        browser.close()

    report = OUT / "report.txt"
    report.write_text("\n".join(notes), encoding="utf-8")
    print("\n".join(notes))


if __name__ == "__main__":
    main()
