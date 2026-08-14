from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(r"D:\MasterpieceTimer\scripts\verify-shots")
BASE = "http://127.0.0.1:4173/"


def check(page, label: str, want: list[str], ban: list[str]) -> None:
    body = page.inner_text("body")
    for t in want:
        print(("PASS" if t in body else "FAIL") + f" {label} has {t!r}")
    for t in ban:
        print(("FAIL" if t in body else "PASS") + f" {label} lacks {t!r}")


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel="chrome")
        page = browser.new_context(
            viewport={"width": 393, "height": 852},
            device_scale_factor=3,
            locale="zh-CN",
        ).new_page()

        page.goto(BASE + "#/stats", wait_until="domcontentloaded")
        page.wait_for_timeout(1500)
        page.screenshot(path=str(OUT / "copy-stats.png"))
        check(
            page,
            "stats",
            ["该时段暂无记录"],
            ["单位：小时", "跨日记录按重叠比例分摊", "还没有"],
        )

        page.goto(BASE + "#/gallery", wait_until="domcontentloaded")
        page.wait_for_timeout(800)
        page.screenshot(path=str(OUT / "copy-gallery.png"))
        check(
            page,
            "gallery",
            ["暂无完全上色的画作。"],
            ["还没有完全上色", "成为藏品"],
        )

        page.goto(BASE + "#/me/coloring", wait_until="domcontentloaded")
        page.wait_for_timeout(600)
        page.screenshot(path=str(OUT / "copy-coloring.png"))
        check(
            page,
            "coloring",
            ["一幅画完成上色需要的有效专注时长。"],
            ["从全灰到上满色", "共用这个分母"],
        )

        page.goto(BASE + "#/me", wait_until="domcontentloaded")
        page.wait_for_timeout(600)
        page.screenshot(path=str(OUT / "copy-me.png"))
        check(page, "me", ["明暗与画布 ›"], ["浅深色与画布"])

        page.goto(BASE + "#/me/archive", wait_until="domcontentloaded")
        page.wait_for_timeout(500)
        check(page, "archive", ["暂无归档项目"], ["还没有归档"])

        page.goto(BASE + "#/artworks", wait_until="domcontentloaded")
        page.wait_for_timeout(800)
        check(page, "artworks", ["暂无画作。"] if "暂无画作" in page.inner_text("body") else [], ["还没有画作", "喜欢的作品"])

        browser.close()


if __name__ == "__main__":
    main()
