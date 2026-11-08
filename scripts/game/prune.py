"""第四輪人物精簡:聚焦台灣近代政治環境與政治迫害。只執行一次(結果寫回 data/game.json)。"""
import json, collections
GJ = '/Users/c_a_t/claude_projects/taiwan-chronicle/data/game.json'
D = json.load(open(GJ, encoding='utf-8')); P = D['people']
TW = '''蔣渭水 賴和 李應章 林獻堂 蔡培火 林茂生 簡吉 羅福星 余清芳 莫那·魯道 謝雪紅 楊逵 連溫卿 王敏川 楊肇嘉 蔡惠如 張深切 王白淵 呂赫若 陳澄波 吳新榮 葉陶 辜顯榮
王添燈 湯德章 王育霖 林連宗 雷震 蔣渭川 李萬居 郭雨新 許世賢 韓石泉 李鎮源 殷海光 彭明敏 鍾浩東 柯旗化 陳文成 吳石 李友邦 高一生 陳儀 黃信介 施明德 蔣經國 高俊明 江鵬堅 李登輝 鄭南榕 詹益樺 彭婉如 柏楊 李敖 陳映真 葉石濤 孫立人 郭琇琮 蘇新 陳明忠 林書揚 湯守仁 傅正 盧修一 蔡孝乾 蔡同榮 辜振甫
丁窈窕 施水環 傅如芝 高草 賴瓊煙 陳勤 黃粧 梁令惠 計梅真 錢靜芝 許金玉 崔小萍 蔣碧玉 沈嫄璋 高菊花 蔡瑞月
劉銘傳 唐景崧 丘逢甲 劉永福 吳湯興'''.split()
JP = '後藤新平 伊藤博文 東條英機 幸德秋水 大杉榮 小林多喜二 石橋湛山'.split()
CN = '蔣介石 宋美齡 孫中山 胡適 張學良 毛澤東 林昭 劉曉波 李鴻章'.split()
keep = set(TW + JP + CN)
names = {p['name'] for p in P}
print('名單裡找不到:', sorted(keep - names))
removed = [p for p in P if p['name'] not in keep]
P[:] = [p for p in P if p['name'] in keep and 'L' in p['acts']]
json.dump(D, open(GJ, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('保留', len(P), dict(collections.Counter(p['country'] for p in P)), '時間帶', sorted(collections.Counter(p['band'] for p in P).items()))
print('移除', len(removed), ':', '、'.join(p['name'] for p in removed))
