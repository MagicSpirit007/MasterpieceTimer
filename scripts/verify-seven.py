from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(r"D:\MasterpieceTimer\scripts\verify-shots")
OUT.mkdir(parents=True, exist_ok=True)
BASE = "http://127.0.0.1:4173/"
notes: list[str] = []


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel="chrome")
        page = browser.new_context(
            viewport={"width": 393, "height": 852},
            device_scale_factor=3,
            locale="zh-CN",
        ).new_page()
        page.goto(BASE, wait_until="domcontentloaded")
        page.wait_for_timeout(2800)
        page.screenshot(path=str(OUT / "s01-home.png"), full_page=True)
        font = page.evaluate(
            "() => getComputedStyle(document.body).fontFamily"
        )
        notes.append(f"font: {font}")
        if "Kai" in font or "楷" in font or "Songti" in font:
            notes.append("PASS 楷体栈")
        else:
            notes.append("WARN 楷体栈可能未命中: " + font)

        notes.append(
            "swipe DOM: "
            + str(page.locator("[class*='swipeAction']").count())
        )

        # me
        page.goto(BASE + "#/me")
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / "s02-me.png"), full_page=True)
        body = page.inner_text("body")
        for label in ("上色时长", "归档", "外观", "画作管理"):
            notes.append(("PASS" if label in body else "FAIL") + " me " + label)

        # coloring
        page.goto(BASE + "#/me/coloring")
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / "s03-coloring.png"), full_page=True)
        if page.get_by_text("上色时长").count():
            notes.append("PASS coloring page")

        # artworks
        page.goto(BASE + "#/artworks")
        page.wait_for_timeout(800)
        page.screenshot(path=str(OUT / "s04-artworks.png"), full_page=True)
        texts = page.inner_text("body")
        for title in (
            "星夜",
            "吻",
            "戴珍珠耳环的少女",
            "阿黛尔",
            "救世主",
            "夏洛特夫人",
            "游船上的午餐",
            "日出",
            "罗纳河",
            "鸢尾花",
            "千里江山图",
        ):
            notes.append(("PASS" if title in texts else "FAIL") + " art " + title)
        if "已上色" in texts:
            notes.append("PASS progress label")

        # gallery no 创作中
        page.goto(BASE + "#/gallery")
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / "s05-gallery.png"), full_page=True)
        if "创作中" in page.inner_text("body"):
            notes.append("FAIL gallery still 创作中")
        else:
            notes.append("PASS gallery no 创作中")

        # project 补记, no swipe
        page.goto(BASE + "#/")
        page.wait_for_timeout(400)
        rows = page.locator("[class*='projRow']")
        if rows.count():
            rows.first.click()
            page.wait_for_timeout(400)
            page.screenshot(path=str(OUT / "s06-project.png"), full_page=True)
            notes.append(
                ("PASS" if page.get_by_text("补记时长").count() else "FAIL")
                + " 补记时长"
            )
            notes.append(
                "project swipe "
                + str(page.locator("[class*='swipeAction']").count())
            )

        # focus view toggle + sheet opaque
        page.goto(BASE + "#/setup")
        page.wait_for_timeout(800)
        page.get_by_text("千里江山图").first.click()
        page.get_by_role("button", name="开始专注").click()
        page.wait_for_timeout(400)
        if page.get_by_text("放弃并开始新专注").count():
            page.get_by_text("放弃并开始新专注").click()
            page.wait_for_timeout(1200)
        page.wait_for_timeout(1000)
        page.screenshot(path=str(OUT / "s07-focus-fit.png"))
        hint = page.locator("[class*='viewHint']")
        notes.append("view hint: " + (hint.inner_text() if hint.count() else "missing"))
        page.locator("[class*='stage']").first.click()
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / "s08-focus-overview.png"))
        notes.append("after toggle: " + (hint.inner_text() if hint.count() else "missing"))

        page.get_by_label("提前结束").click()
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / "s09-sheet.png"))
        bg = page.evaluate(
            """() => {
              const el = document.querySelector('[class*="sheet"]');
              if (!el) return 'no-sheet';
              const s = getComputedStyle(el);
              return s.backgroundColor + ' | blur=' + s.backdropFilter;
            }"""
        )
        notes.append("sheet: " + bg)
        if "blur" in str(bg) and "none" not in str(bg).split("blur=")[-1]:
            notes.append("FAIL sheet still blurred")
        else:
            notes.append("PASS sheet opaque")

        browser.close()
    print("\n".join(notes))


if __name__ == "__main__":
    main()
