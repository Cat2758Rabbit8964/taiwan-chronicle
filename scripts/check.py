#!/usr/bin/env python3
"""台灣事件簿 資料健檢。

用法:
  python3 scripts/check.py            # 離線檢查:格式、欄位、規則、完整度報表
  python3 scripts/check.py --online   # 另外檢查維基連結與 Commons 相片是否存在(會慢,有間隔)
  python3 scripts/check.py --todo     # 另外列出「簡述」與「含待補」事件清單
結束碼:有錯誤(ERROR)為 1,只有警告(WARN)為 0。
完整度規則需與 app.js 的 quality() 相同。
"""
import glob, json, os, re, sys, time, urllib.parse, urllib.request
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TYPES = {"war", "suppression", "politics", "society", "construction", "diplomacy", "disaster"}
REGIONS = {"taiwan", "china", "japan", "world"}
SECTIONS = ("background", "process", "figures", "impact")
GAP_RE = re.compile(r"待補|待核對|待查證|待查")
LABEL = {"full": "完整", "detail": "詳細", "brief": "簡述"}

errors, warns = [], []
def err(m): errors.append(m)
def warn(m): warns.append(m)

def refs_of(e):
    return e.get("references") or e.get("sources") or []

def quality(e):
    secs = sum(1 for k in SECTIONS if e.get(k))
    level = "full" if secs >= 3 and len(refs_of(e)) >= 2 else ("detail" if secs >= 1 else "brief")
    blob = json.dumps([e.get(k) for k in SECTIONS] + [e.get("people")], ensure_ascii=False)
    return level, bool(GAP_RE.search(blob))

def load():
    eras = json.load(open(os.path.join(ROOT, "data/eras.json"), encoding="utf-8"))
    events = []
    for f in sorted(glob.glob(os.path.join(ROOT, "data/events/*.json"))):
        try:
            for e in json.load(open(f, encoding="utf-8")):
                e["_file"] = os.path.basename(f)
                events.append(e)
        except json.JSONDecodeError as ex:
            err(f"{os.path.basename(f)}: JSON 格式錯誤 {ex}")
    return eras, events

def era_of(eras, y):
    for e in eras["taiwan"]:
        lo = e["from"] if e["from"] is not None else -10**9
        if lo <= y < e["to"]:
            return e
    return None

def check_events(eras, events):
    ids = Counter(e.get("id") for e in events)
    reveal = eras["regionRevealYear"]
    for e in events:
        i = e.get("id", "(無 id)")
        for k in ("id", "year", "region", "type", "title", "summary", "place"):
            if k not in e or e[k] in (None, ""):
                err(f"{i}: 缺少欄位 {k}")
        if ids[e.get("id")] > 1:
            err(f"{i}: id 重複")
        if e.get("region") not in REGIONS:
            err(f"{i}: region 不合法 {e.get('region')}")
        if e.get("type") not in TYPES:
            err(f"{i}: type 不合法 {e.get('type')}")
        y = e.get("year")
        if not isinstance(y, int):
            err(f"{i}: year 不是整數"); continue
        if e.get("endYear") is not None and e["endYear"] < y:
            err(f"{i}: endYear 小於 year")
        rv = reveal.get(e.get("region"))
        if rv is not None and y < rv:
            warn(f"{i}: {e['region']} 區域在 {rv} 年前不顯示事件,此事件({y})不會出現在地圖")
        pl = e.get("place") or {}
        if not (-90 <= pl.get("lat", 999) <= 90 and -180 <= pl.get("lng", 999) <= 180):
            err(f"{i}: place 座標缺漏或超出範圍")
        s = e.get("summary", "")
        if len(s) < 20: warn(f"{i}: summary 太短({len(s)} 字)")
        if len(s) > 220: warn(f"{i}: summary 偏長({len(s)} 字),地圖方框會太擠")
        era = era_of(eras, y)
        if era is None:
            err(f"{i}: year {y} 不屬於任何台灣時代")
        elif era["id"] + ".json" != e["_file"]:
            warn(f"{i}: 年份屬於「{era['name']}」,但存放在 {e['_file']}")
        refs = refs_of(e)
        if not refs:
            err(f"{i}: 沒有任何參考資料")
        for r in refs:
            if isinstance(r, str):
                if not r.startswith("http"): err(f"{i}: sources 項目不是網址 {r[:30]}")
            else:
                if not r.get("title"): err(f"{i}: 參考資料缺 title")
                u = r.get("url")
                if u and not u.startswith("http"): err(f"{i}: 參考資料 url 格式錯誤 {u[:40]}")
        titles = [r["title"] for r in refs if isinstance(r, dict) and r.get("title")]
        if len(titles) != len(set(titles)): warn(f"{i}: 參考資料有重複項目")
        for k in SECTIONS:
            if k in e and not (isinstance(e[k], list) and all(isinstance(x, str) and x for x in e[k])):
                err(f"{i}: {k} 必須是非空字串的陣列")
        if e.get("people"):
            for p in e["people"]:
                if not (p.get("name") and p.get("desc")): err(f"{i}: people 項目缺 name 或 desc")
        w = e.get("why")
        if w:
            if not (w.get("sections") or w.get("intro")): err(f"{i}: why 沒有內容")
            if not w.get("references"): warn(f"{i}: why 沒有 references,會沿用事件的參考資料")

def check_eras(eras):
    ids = {e["id"] for e in eras["taiwan"]}
    for k, c in eras["content"].items():
        if k not in ids: err(f"content.{k}: 不是已定義的時代")
        files = []
        for p in c.get("photos", []):
            files.append(p["file"])
            for f in ("file", "caption", "license"):
                if not p.get(f): err(f"content.{k}: 相片缺 {f}")
        w = c.get("whatif") or {}
        for f in ("question", "speculation", "basis", "contrastPhoto"):
            if not w.get(f): err(f"content.{k}.whatif: 缺 {f}")
        if w.get("contrastPhoto"): files.append(w["contrastPhoto"]["file"])
        for rg, lst in (c.get("regional") or {}).items():
            for p in lst:
                files.append(p["file"])
                for f in ("file", "caption", "license"):
                    if not p.get(f): err(f"content.{k}.regional.{rg}: 相片缺 {f}")
        dup = [f for f, n in Counter(files).items() if n > 1]
        if dup: warn(f"content.{k}: 相片檔案重複 {dup}")
        if not c.get("photos"): warn(f"content.{k}: 沒有台灣生活相片")
        if not c.get("regional"): warn(f"content.{k}: 沒有中國/日本同期相片")
    for e in eras["taiwan"]:
        if e["id"] not in eras["content"]: warn(f"時代 {e['id']} 沒有 content(相片與假設問題)")

def head(url, tries=2):
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "taiwan-chronicle-check/0.1"})
    for _ in range(tries):
        try:
            return urllib.request.urlopen(req, timeout=20).status
        except Exception as ex:
            code = getattr(ex, "code", None)
            if code in (403, 405, 429) or code is None:
                last = code or "timeout"
            else:
                return code
            time.sleep(2)
    return last

def check_online(eras, events):
    seen = set()
    for e in events:
        for r in refs_of(e):
            u = r if isinstance(r, str) else r.get("url")
            if not u or u in seen: continue
            seen.add(u)
            host = urllib.parse.urlparse(u).netloc
            if "wikipedia.org" not in host: continue
            q = urllib.parse.quote(u, safe=":/()")
            c = head(q)
            if c != 200: (err if c == 404 else warn)(f"{e['id']}: 維基連結 {c} {u}")
            time.sleep(0.25)
    files = set()
    for c in eras["content"].values():
        for p in c.get("photos", []): files.add(p["file"])
        for lst in (c.get("regional") or {}).values():
            for p in lst: files.add(p["file"])
        if c.get("whatif", {}).get("contrastPhoto"): files.add(c["whatif"]["contrastPhoto"]["file"])
    for f in sorted(files):
        u = "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(f, safe="") + "?width=200"
        c = head(u)
        if c != 200: (err if c == 404 else warn)(f"Commons 相片 {c} {f}")
        time.sleep(1.2)

def report(eras, events, todo):
    by = defaultdict(lambda: Counter())
    gaps = defaultdict(int)
    briefs, gapl = [], []
    for e in events:
        era = era_of(eras, e["year"]) or {"name": "?", "id": "?"}
        lv, g = quality(e)
        by[era["id"]][lv] += 1
        if g: gaps[era["id"]] += 1; gapl.append(e)
        if lv == "brief": briefs.append(e)
    print(f"\n{'時代':<10}{'事件':>5}{'完整':>6}{'詳細':>6}{'簡述':>6}{'含待補':>7}")
    tot = Counter()
    for era in eras["taiwan"]:
        c = by[era["id"]]; n = sum(c.values())
        print(f"{era['name']:<8}{n:>7}{c['full']:>6}{c['detail']:>6}{c['brief']:>6}{gaps[era['id']]:>7}")
        tot.update(c)
    n = sum(tot.values())
    print(f"{'合計':<8}{n:>7}{tot['full']:>6}{tot['detail']:>6}{tot['brief']:>6}{sum(gaps.values()):>7}")
    if todo:
        print(f"\n== 簡述事件({len(briefs)}) ==")
        for e in sorted(briefs, key=lambda x: x["year"]): print(f"  {e['year']:>6}  {e['id']}  {e['title']}")
        print(f"\n== 含待補事件({len(gapl)}) ==")
        for e in sorted(gapl, key=lambda x: x["year"]):
            blob = json.dumps([e.get(k) for k in SECTIONS], ensure_ascii=False)
            print(f"  {e['year']:>6}  {e['id']}  {e['title']}  ({len(GAP_RE.findall(blob))} 處)")

def main():
    args = set(sys.argv[1:])
    eras, events = load()
    check_events(eras, events)
    check_eras(eras)
    if "--online" in args: check_online(eras, events)
    report(eras, events, "--todo" in args)
    for w in warns: print("WARN ", w)
    for x in errors: print("ERROR", x)
    print(f"\n{len(events)} 個事件;{len(errors)} 個錯誤、{len(warns)} 個警告")
    sys.exit(1 if errors else 0)

if __name__ == "__main__":
    main()
