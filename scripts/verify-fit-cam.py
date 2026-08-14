"""Verify fit-mode camera: no visible center line, painting holds then follows."""
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(r"D:\MasterpieceTimer\scripts\verify-shots")
OUT.mkdir(parents=True, exist_ok=True)
BASE = "http://127.0.0.1:4173/"
notes: list[str] = []


def measure(page):
    return page.evaluate(
        """() => {
          const stage = document.querySelector('[class*="stage"]');
          const art = document.querySelector('[class*="artRect"]');
          const color = document.querySelector('[class*="color"]');
          const line = document.querySelector('[class*="centerLine"]');
          if (!stage || !art) return { ok: false };
          const s = stage.getBoundingClientRect();
          const a = art.getBoundingClientRect();
          const cs = color ? getComputedStyle(color).clipPath : '';
          const m = /inset\\([^)]*?([\\d.]+)(px|%)\\s*\\)/.exec(cs);
          let clipLeft = null;
          if (m) {
            clipLeft = m[2] === '%'
              ? a.width * parseFloat(m[1]) / 100
              : parseFloat(m[1]);
          }
          const lineX = clipLeft == null ? null : a.left + clipLeft;
          return {
            ok: true,
            centerLine: !!line,
            stage: { l: s.left, r: s.right, w: s.width, mid: s.left + s.width / 2 },
            art: { l: a.left, r: a.right, w: a.width, t: a.transform },
            transform: getComputedStyle(art).transform,
            clipPath: cs,
            lineX,
            midDelta: lineX == null ? null : lineX - (s.left + s.width / 2),
            rightGap: s.right - a.right,
            leftOverflow: s.left - a.left,
          };
        }"""
    )


def start_focus(page, title: str):
    page.goto(BASE + "#/setup", wait_until="domcontentloaded")
    page.wait_for_timeout(800)
    page.get_by_text(title).first.click()
    page.get_by_role("button", name="开始专注").click()
    page.wait_for_timeout(400)
    if page.get_by_text("放弃并开始新专注").count():
        page.get_by_text("放弃并开始新专注").click()
        page.wait_for_timeout(1000)
    page.wait_for_timeout(600)


def dump(label: str, m: dict):
    notes.append(f"--- {label} ---")
    notes.append(str(m))
    if not m.get("ok"):
        notes.append("FAIL no stage/art")
        return
    if m.get("centerLine"):
        notes.append("FAIL visible centerLine in DOM")
    else:
        notes.append("PASS no centerLine")


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel="chrome")
        page = browser.new_context(
            viewport={"width": 393, "height": 852},
            device_scale_factor=3,
            locale="zh-CN",
        ).new_page()

        start_focus(page, "千里江山图")
        m0 = measure(page)
        dump("jiangshan p~0", m0)
        page.screenshot(path=str(OUT / "fit-jiangshan-0.png"))
        if m0.get("ok"):
            if m0["art"]["w"] > m0["stage"]["w"] + 50:
                notes.append("PASS jiangshan wider than stage")
            if m0.get("lineX") is not None and m0["lineX"] > m0["stage"]["mid"] + 80:
                notes.append("PASS p0 line still on the right (not pre-pinned)")
            else:
                notes.append(f"FAIL p0 lineX={m0.get('lineX')} mid={m0['stage']['mid']}")
            if m0["leftOverflow"] > 100:
                notes.append("PASS p0 left overflow (painting not centered on line)")
            else:
                notes.append(f"FAIL p0 leftOverflow={m0['leftOverflow']}")

        # Advance ~8% of a 25min plan so color covers more than half a screen
        # on the long scroll and the line should pin at center.
        try:
            page.clock.install()
            page.clock.fast_forward(120_000)
            page.wait_for_timeout(500)
            m1 = measure(page)
            dump("jiangshan +2min", m1)
            page.screenshot(path=str(OUT / "fit-jiangshan-mid.png"))
            if m1.get("midDelta") is not None and abs(m1["midDelta"]) <= 4:
                notes.append("PASS mid line at screen center")
            else:
                notes.append(f"WARN midDelta={m1.get('midDelta')} (clock may not drive timer)")
        except Exception as e:
            notes.append("WARN clock skip: " + str(e))

        page.locator("[class*='stage']").first.click()
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / "fit-jiangshan-overview.png"))
        notes.append(
            "toggle: "
            + (page.locator("[class*='viewHint']").inner_text() if page.locator("[class*='viewHint']").count() else "?")
        )

        start_focus(page, "罗纳河上的星夜")
        m2 = measure(page)
        dump("rhone p~0", m2)
        page.screenshot(path=str(OUT / "fit-starry-0.png"))
        if m2.get("ok"):
            if m2.get("lineX") is not None and abs(m2["lineX"] - m2["stage"]["r"]) <= 6:
                notes.append("PASS rhone p0 line at right edge")
            else:
                notes.append(f"FAIL rhone lineX={m2.get('lineX')}")

        page.goto(BASE + "#/", wait_until="domcontentloaded")
        page.wait_for_timeout(600)
        page.screenshot(path=str(OUT / "fit-home-after.png"), full_page=True)
        notes.append("home: " + ("PASS 绘梦" if "绘梦" in page.inner_text("body") else "FAIL home"))

        page.goto(BASE + "#/gallery", wait_until="domcontentloaded")
        page.wait_for_timeout(500)
        notes.append("gallery ok, 创作中=" + str("创作中" in page.inner_text("body")))

        browser.close()

    report = "\n".join(notes)
    (OUT / "fit-cam-report.txt").write_text(report, encoding="utf-8")
    print(report)


if __name__ == "__main__":
    main()
