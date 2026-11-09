"""替每位人物標上鑰匙類別 k(y 黃=日治時期台灣人、b 淺藍=戰後政治受難者、p 粉紅=女性),寫回 data/game.json。
認定規則見 GLOSSARY.md「鑰匙碎片」與討論紀錄:
- y:在台灣出生,且 1945 年時已滿 18 歲;排除外省籍來台者,以及 1895 年陣亡的義軍。
- b:1945 年後被國民政府逮捕、關押、處決、失蹤、軟禁、監控或剝奪事業者(不含官員、蔣渭川、張學良、中國人物、變節的蔡孝乾)。
- p:女性。
性別與出生地資料原檔沒有,是依各人條目逐一人工判定,下面是人工名單。"""
import json, pathlib
F = pathlib.Path(__file__).resolve().parents[2] / 'data' / 'game.json'
d = json.load(open(F, encoding='utf-8'))
ids = {p['id'] for p in d['people']}

FEMALE = 'ding-yaotiao shi-shuihuan ye-tao cai-ruiyue ji-meizhen qian-jingzhi xu-jinyu cui-xiaoping jiang-biyu shen-yuanzhang gao-juhua fu-ruzhi lai-qiongyan gao-cao chen-qin huang-zhuang liang-linghui xu-shixian peng-wanru soong-mei-ling lin-zhao'.split()

# 在台灣出生、1945 年已滿 18 歲(已排除外省籍者與出生地不確定者:計梅真、錢靜芝、崔小萍、沈嫄璋、梁令惠)
YELLOW = '''jiang-weishui lai-he li-yingzhang wu-xinrong chen-chengbo lyu-heruo yang-kui lin-xiantang cai-peihuo gu-xianrong lin-maosheng
jian-ji luo-fuxing yu-qingfang mona-rudao xie-xuehong wang-tiandeng tang-dezhang wang-yulin lin-lianzong jiang-weichuan li-wanju guo-yuxin
xu-shixian han-shiquan li-zhenyuan ye-shitao peng-mingmin zhong-haodong li-youbang gao-yisheng li-denghui ding-yaotiao shi-shuihuan ye-tao
cai-ruiyue xu-jinyu jiang-biyu lai-qiongyan gao-cao chen-qin huang-zhuang lian-wenqing wang-minchuan yang-zhaojia wang-baiyuan cai-huiru
guo-xiucong su-xin lin-shuyang tang-shouren zhang-shenqie gu-zhenfu cai-xiaoqian'''.split()

BLUE = '''wu-xinrong chen-chengbo lyu-heruo yang-kui lin-maosheng jian-ji wang-tiandeng tang-dezhang wang-yulin lin-lianzong lei-zhen li-wanju guo-yuxin
ye-shitao bo-yang chen-yingzhen li-ao yin-haiguang peng-mingmin zhong-haodong ke-qihua chen-wencheng sun-liren wu-shi li-youbang gao-yisheng
huang-xinjie shi-mingde zheng-nanrong zhan-yihua gao-junming ding-yaotiao shi-shuihuan ye-tao cai-ruiyue ji-meizhen qian-jingzhi xu-jinyu
cui-xiaoping jiang-biyu shen-yuanzhang gao-juhua fu-ruzhi lai-qiongyan gao-cao chen-qin huang-zhuang liang-linghui wang-baiyuan guo-xiucong
chen-mingzhong lin-shuyang tang-shouren zhang-shenqie fu-zheng lu-xiuyi gu-zhenfu cai-tongrong'''.split()

for name, lst in (('FEMALE', FEMALE), ('YELLOW', YELLOW), ('BLUE', BLUE)):
    bad = [i for i in lst if i not in ids]
    assert not bad, (name, bad)
for p in d['people']:
    k = ''.join(c for c, lst in (('y', YELLOW), ('b', BLUE), ('p', FEMALE)) if p['id'] in lst)
    p['k'] = k
json.dump(d, open(F, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('黃', sum('y' in p['k'] for p in d['people']), '淺藍', sum('b' in p['k'] for p in d['people']), '粉紅', sum('p' in p['k'] for p in d['people']))
