"""遊戲模擬:隨機玩家在各種生日上玩很多局,檢查每位人物的出場機會。與 game.js 的流程一一對應。
用法:python3 scripts/game/sim.py [局數] [--balance]   (--balance 會把平衡用權重 wt 寫回 data/game.json)"""
import json, random, collections, sys, math
from multiprocessing import Pool
GJ = '/Users/c_a_t/claude_projects/taiwan-chronicle/data/game.json'
D = json.load(open(GJ)); P = D['people']; BANDS = D['bands']
CO = ['law','pol','med','art','edu','act','biz']; PRE = ['A','B','C','D']; CATS = 'RESXA'
KEEP, MAXPRE, MINPRE = 2, 3, 2
WT = {p['id']: p.get('wt', 1.0) for p in P}

def catcount(pool, s):
    n = collections.Counter()
    for p in pool:
        if s in p['acts']:
            for c in {a['c'] for a in p['acts'][s]}: n[c] += 1
    return n
def feasible(pool, s, k=KEEP): return any(v >= k for v in catcount(pool, s).values())
def bycat(pool, s, c): return [p for p in pool if s in p['acts'] and any(a['c'] == c for a in p['acts'][s])]
def keep_for(n_pre): return KEEP if n_pre == 0 else 1
def viable(pool, used, need):
    if len(pool) < 1: return False
    if need == 0: return feasible(pool, 'L', 1)
    return any(s not in used and any(len(bycat(pool, s, c)) >= keep_for(len(used)) and viable(bycat(pool, s, c), used + [s], need - 1) for c in CATS) for s in PRE)
def careers_in(pool):
    n = collections.Counter(c for p in pool for c in p['c']); return [c for c in CO if n[c] >= 2]

def play(birth, rng, wt):
    elig = [p for p in P if p['died'] <= birth and 'L' in p['acts']]
    ok = []
    for b in BANDS:
        inb = [p for p in elig if p['band'] == b['id']]
        if len(inb) >= 6 and len(careers_in(inb)) >= 3: ok.append((b['id'], len(inb)))
    if not ok: return None
    r = rng.random() * sum(n for _, n in ok); band = ok[-1][0]
    for bid, n in ok:
        if r < n: band = bid; break
        r -= n
    pool = [p for p in elig if p['band'] == band]; pool0 = list(pool)
    cn = collections.Counter(x for p in pool for x in p['c'])
    # 志向由考試成績決定:四科各 0–100(約一成機率跳過=0),取最高與第二高的科目查表
    order = ['lang', 'math', 'sci', 'soc']
    sc = {k: (0 if rng.random() < 0.1 else rng.randint(0, 100)) for k in order}
    rank = sorted(order, key=lambda k: (-sc[k], order.index(k)))
    PAIR = {'lang': {'math': 'art', 'sci': 'art', 'soc': 'edu'}, 'math': {'lang': 'biz', 'sci': 'med', 'soc': 'biz'},
            'sci': {'lang': 'med', 'math': 'med', 'soc': 'act'}, 'soc': {'lang': 'law', 'math': 'pol', 'sci': 'act'}}
    c = PAIR[rank[0]][rank[1]]
    if cn[c] < KEEP:
        alts = [x for x in CO if x != c and cn[x] >= KEEP]
        if alts: c = rng.choice(alts)
    used = []; hasL = False; npre = 0; asked_place = False
    while True:
        sit = None
        if not hasL and npre < MAXPRE and len(pool) > KEEP:
            need = max(0, max(0, MINPRE - npre) - 1)
            free = [s for s in PRE if s not in used and any(len(bycat(pool, s, x)) >= keep_for(len(used)) and viable(bycat(pool, s, x), used + [s], need) for x in CATS)]
            if free:
                anchor = rng.choices(pool, weights=[wt.get(p['id'], 1.0) for p in pool])[0]; mine = [s for s in free if s in anchor['acts']]
                pick = mine if mine else (free if npre < MINPRE else [])
                if pick: sit = rng.choice(pick)
        if sit is None and not hasL and feasible(pool, 'L', 1): sit = 'L'
        if sit is None: break
        isL = sit == 'L'; need = 0 if isL else max(0, max(0, MINPRE - npre) - 1)
        okc = lambda x: len(bycat(pool, sit, x)) >= (1 if isL else keep_for(len(used))) and (isL or viable(bycat(pool, sit, x), used + [sit], need))
        ch = rng.choice(CATS)
        if not okc(ch):
            alts = [x for x in CATS if x != ch and okc(x)]
            if alts: ch = rng.choices(alts, weights=[sum(wt.get(p['id'], 1.0) for p in bycat(pool, sit, x)) for x in alts])[0]
            else:
                cc = catcount(pool, sit); best = [x for x in CATS if cc[x] > 0]
                if not best: used.append(sit); continue
                ch = max(best, key=lambda x: cc[x])
        pool = bycat(pool, sit, ch); used.append(sit)
        if isL: hasL = True
        else: npre += 1
        if isL: break
    if hasL:
        n = collections.Counter(p['bp'] for p in pool if p['bp'])
        types = [t for t, k in n.items() if k >= KEEP]
        if len(types) >= 2 and all(p['bp'] for p in pool):
            t = rng.choice(types); pool = [p for p in pool if p['bp'] == t]
    best = max(1 if c in p['c'] else 0 for p in pool)
    cand = [p for p in pool if (1 if c in p['c'] else 0) == best]
    w = [wt.get(p['id'], 1.0) for p in cand]
    fin = rng.choices(cand, weights=w)[0]
    return fin['id'], [p['id'] for p in pool0], len(used), [p['id'] for p in pool]

def worker(args):
    seed, n, wt = args
    rng = random.Random(seed); F = collections.Counter(); FS = collections.Counter(); A = collections.Counter(); U = collections.Counter(); sits = collections.Counter(); fail = 0
    for _ in range(n):
        y = rng.randint(2000, 2025) if rng.random() < 0.4 else rng.randint(1930, 2025); m = rng.randint(1, 12); d = rng.randint(1, 28)
        birth = f'{y}-{m:02d}-{d:02d}'
        if birth > '2026-11-01': continue
        r = play(birth, rng, wt)
        if r is None: fail += 1; continue
        fin, pool0, k, fpool = r
        for i in fpool: F[i] += 1; FS[len(fpool)] += 1 if i == fin else 0
        A[fin] += 1; sits[k] += 1
        for i in pool0: U[i] += 1 / len(pool0)
    return A, U, sits, fail

def run(total, wt, procs=6):
    chunks = [(1000 + i, total // procs, wt) for i in range(procs)]
    A = collections.Counter(); U = collections.Counter(); sits = collections.Counter(); fail = 0
    with Pool(procs) as pl:
        for a, u, s, f in pl.map(worker, chunks):
            A.update(a); U.update(u); sits.update(s); fail += f
    return A, U, sits, fail

def report(A, U, sits, fail, label=''):
    ids = {p['id']: p for p in P}
    ratio = {i: (A[i] / U[i] if U[i] else None) for i in ids}
    never = [ids[i]['name'] for i in ids if U[i] and A[i] == 0]
    low = sorted((r, ids[i]['name']) for i, r in ratio.items() if r is not None and 0 < r < 0.3)
    high = sorted(((r, ids[i]['name']) for i, r in ratio.items() if r is not None and r > 3), reverse=True)
    tot = sum(sits.values())
    print(f'{label} 局數 {tot}  情境題數 {sorted(sits.items())}  開局失敗 {fail}')
    print(f'  從未出場 {len(never)}: {never}')
    print(f'  <0.3× {len(low)}: {[(round(r,2),n) for r,n in low]}')
    print(f'  >3× {len(high)}: {[(round(r,2),n) for r,n in high]}')
    return ratio, never

if __name__ == '__main__':
    total = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 60000
    wt = dict(WT)
    if '--balance' in sys.argv:
        for it in range(30):
            A, U, sits, fail = run(total, wt)
            for i in wt:
                if U[i] > 5:
                    r = max(A[i], 0.5) / U[i]            # 實際 / 均勻期望
                    wt[i] = min(1000.0, max(0.0005, wt[i] * (1.0 / r) ** 0.7))
            print('iter', it, 'min/max ratio', round(min(A[i]/U[i] for i in wt if U[i] > 5), 2), round(max(A[i]/U[i] for i in wt if U[i] > 5), 2))
        for p in P: p['wt'] = round(wt[p['id']], 3)
        json.dump(D, open(GJ, 'w'), ensure_ascii=False, indent=1)
    A, U, sits, fail = run(total, wt)
    report(A, U, sits, fail, '最終')
