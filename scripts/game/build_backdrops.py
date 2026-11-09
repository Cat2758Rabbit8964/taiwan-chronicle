"""從台灣事件簿的時代照片(data/eras.json)挑出遊戲的淡淡底圖,寫成 data/backdrops.json。
只挑當時拍的街景/生活照:不用現代拍攝的、肖像、政治人物、剪報。依遊戲的三個時間帶分組:
1=1850–1911(清末到日治初期)、2=1911–1945(日治)、3=1946 以後(戰後)。"""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
d = json.load(open(ROOT / 'data' / 'eras.json', encoding='utf-8'))['content']
PICK = {
 1: [('qing', [0, 1, 2, 3, 4, 5, 7]), ('japan', [3])],
 2: [('japan', list(range(0, 18)) + [19, 20, 21, 22, 23, 24])],
 3: [('postwar', [0, 1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13])],
}
out = {}
for band, groups in PICK.items():
    out[str(band)] = []
    for era, idxs in groups:
        for i in idxs:
            p = d[era]['photos'][i]
            out[str(band)].append({'f': p['file'], 'c': p['caption'], 'l': p['license']})
json.dump(out, open(ROOT / 'data' / 'backdrops.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print({k: len(v) for k, v in out.items()})
