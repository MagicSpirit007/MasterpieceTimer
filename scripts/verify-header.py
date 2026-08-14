from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(r"D:\MasterpieceTimer\scripts\verify-shots")
BASE = "http://127.0.0.1:4173/"

JS = """() => {
  const greet = document.querySelector('[class*="greet"]');
  const edit = [...document.querySelectorAll('button')].find((b) => {
    const t = b.textContent.trim();
    return t === '编辑' || t === '完成';
  });
  const neu = [...document.querySelectorAll('button')].find((b) =>
    b.textContent.includes('新建项目') && b.className.includes('smallBtn')
  );
  const lineH = (el) => {
    if (!el) return null;
    const s = getComputedStyle(el);
    const lh = parseFloat(s.lineHeight);
    const h = el.getBoundingClientRect().height;
    return {
      text: el.textContent.trim(),
      w: Math.round(el.getBoundingClientRect().width),
      h: Math.round(h),
      lh,
      lines: lh ? +(h / lh).toFixed(2) : null,
      nowrap: s.whiteSpace,
    };
  };
  return { greet: lineH(greet), edit: lineH(edit), neu: lineH(neu) };
}"""


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel="chrome")
        for scheme, name in (("dark", "home-header-dark.png"), ("light", "home-header-light.png")):
            ctx = browser.new_context(
                viewport={"width": 393, "height": 852},
                device_scale_factor=3,
                locale="zh-CN",
                color_scheme=scheme,
            )
            page = ctx.new_page()
            page.goto(BASE, wait_until="domcontentloaded")
            page.wait_for_timeout(2800)
            m = page.evaluate(JS)
            print(scheme, m)
            for key, row in m.items():
                if not row:
                    print("FAIL missing", key)
                    continue
                if row["lines"] is not None and row["lines"] > 1.35:
                    print("FAIL wrap", key, row)
                else:
                    print("PASS one line", key)
            page.screenshot(path=str(OUT / name), clip={"x": 0, "y": 0, "width": 393, "height": 220})
            ctx.close()
        browser.close()


if __name__ == "__main__":
    main()
