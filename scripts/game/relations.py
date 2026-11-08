"""為每位人物建立「有關聯的人」:(1)條目文字裡直接提到彼此;(2)同屬一個事件或團體(groups)。結果寫回 data/game.json。"""
import json, collections
GJ = '/Users/c_a_t/claude_projects/taiwan-chronicle/data/game.json'
D = json.load(open(GJ, encoding='utf-8')); P = D['people']
byname = {p['name']: p for p in P}
G = [
 ('台灣文化協會與議會設置請願運動', '蔣渭水 林獻堂 蔡培火 賴和 蔡惠如 連溫卿 王敏川 楊肇嘉 韓石泉 李應章 楊逵 葉陶'),
 ('農民運動(二林事件、台灣農民組合)', '李應章 簡吉 楊逵 葉陶 謝雪紅'),
 ('嘉義的政治與二二八', '陳澄波 許世賢 湯守仁 高一生'),
 ('台灣新文學與作家', '賴和 楊逵 呂赫若 王白淵 葉石濤 柏楊 陳映真 張深切'),
 ('台灣共產黨與左翼運動', '謝雪紅 蘇新 蔡孝乾 連溫卿 王敏川 簡吉'),
 ('日治時期的武裝抗日', '羅福星 余清芳 莫那·魯道 吳湯興'),
 ('1895 年的台灣民主國與乙未戰爭', '唐景崧 丘逢甲 劉永福 吳湯興 劉銘傳 伊藤博文 李鴻章'),
 ('日本統治台灣初期', '後藤新平 伊藤博文 辜顯榮 李鴻章'),
 ('二二八事件', '王添燈 湯德章 王育霖 林連宗 林茂生 陳澄波 蔣渭川 李萬居 韓石泉 謝雪紅 陳儀 吳新榮 張深切 葉陶 湯守仁 王白淵 辜振甫 蘇新'),
 ('1950 年代的白色恐怖', '鍾浩東 蔣碧玉 吳石 蔡孝乾 李友邦 郭琇琮 計梅真 錢靜芝 高一生 湯守仁 傅如芝 陳勤 賴瓊煙 高草 黃粧 許金玉 丁窈窕 施水環 沈嫄璋 崔小萍 梁令惠 蘇新 林書揚 陳明忠 柯旗化 葉石濤 楊逵 蔡瑞月 孫立人 高菊花 呂赫若'),
 ('郵電支部案', '計梅真 錢靜芝 許金玉 丁窈窕 施水環'),
 ('綠島的女性政治犯', '傅如芝 陳勤 蔡瑞月 賴瓊煙'),
 ('高一生與鄒族的政治案', '高一生 湯守仁 高菊花'),
 ('軍中與情治案件', '孫立人 吳石 李友邦 蔡孝乾 蔣經國'),
 ('《自由中國》與組織反對黨', '雷震 殷海光 傅正 李萬居 郭雨新 胡適'),
 ('1960 至 70 年代的異議者與政治犯', '彭明敏 柏楊 李敖 陳映真 陳明忠 林書揚 柯旗化 殷海光'),
 ('美麗島事件與黨外運動', '黃信介 施明德 高俊明 江鵬堅 陳文成 盧修一 傅正 郭雨新 李鎮源'),
 ('解嚴與民主化', '蔣經國 李登輝 鄭南榕 詹益樺 彭婉如 蔡同榮 江鵬堅 施明德 李鎮源'),
 ('國民黨在台灣的領導', '蔣介石 宋美齡 蔣經國 李登輝 陳儀 張學良 孫立人'),
 ('國共與民國政治', '蔣介石 宋美齡 孫中山 張學良 毛澤東 胡適 李鴻章'),
 ('中國的異議者', '林昭 劉曉波 毛澤東'),
 ('日本的社會主義者與政治案件', '幸德秋水 大杉榮 小林多喜二 石橋湛山 東條英機'),
]
groups = []
for label, names in G:
    ids = []
    for n in names.split():
        assert n in byname, n
        ids.append(byname[n]['id'])
    groups.append({'label': label, 'members': ids})
D['groups'] = groups

ALIAS = {'蔣介石': ['蔣介石', '蔣中正'], '莫那·魯道': ['莫那·魯道', '莫那魯道'], '孫中山': ['孫中山', '孫文']}
def texts(p):
    t = [p['story'], p['fate'], p.get('note', '')]
    for v in p['acts'].values(): t += [a['ev'] for a in v]
    return [x for x in t if x]
rel = collections.defaultdict(dict)
for a in P:
    for b in P:
        if a is b: continue
        for nm in ALIAS.get(b['name'], [b['name']]):
            hit = next(((t, t.find(nm)) for t in texts(a) if nm in t), None)
            if hit:
                t, i = hit; s = max(0, i - 14); e = min(len(t), i + len(nm) + 16)
                why = f'{a["name"]}的紀錄提到:…{t[s:e]}…'
                rel[a['id']].setdefault(b['id'], why); rel[b['id']].setdefault(a['id'], why); break
for p in P:
    p['rel'] = [{'id': k, 'why': v} for k, v in rel[p['id']].items()]
json.dump(D, open(GJ, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
iso = [p['name'] for p in P if not p['rel'] and not any(p['id'] in g['members'] for g in groups)]
print('群組', len(groups), '有文字提及關聯的人', sum(1 for p in P if p['rel']), '完全沒有關聯的人', iso)
