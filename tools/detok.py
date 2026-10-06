#!/usr/bin/env python3
"""Apply the CJK -> English token dictionary across src (comments + leftover strings)."""
import pathlib

D = {
 '曹操':'Cao Cao','定軍山':'Mount Dingjun','呂布':'Lü Bu','烏林':'Wulin','夏侯淵':'Xiahou Yuan','張飛':'Zhang Fei',
 '赤壁':'Red Cliffs','景山':'Mount Jing','虎牢關':'Hulao Gate','趙雲':'Zhao Yun','劉備':'Liu Bei','華雄':'Hua Xiong',
 '無雙':'Musou','蜀':'Shu','魏':'Wei','曹':'CAO','劉':'LIU','張':'ZHANG','張遼':'Zhang Liao','三英戰呂布':'the three brothers vs Lü Bu',
 '真':'true','肉包':'meat bun','黃蓋':'Huang Gai','江陵':'Jiangling','董卓':'Dong Zhuo','關羽':'Guan Yu','本陣':'HQ',
 '甘夫人':'Lady Gan','張郃':'Zhang He','八卦':'the eight trigrams','仁德':'benevolence','諸葛亮':'Zhuge Liang',
 '七星壇':'the Altar of the Seven Stars','華容道':'Huarong Road','洛陽':'Luoyang','袁紹':'Yuan Shao','當陽':'Dangyang',
 '糜夫人':'Lady Mi','據水斷橋':'holding the bridge','魏軍營寨':'the Wei camp','義':'righteousness','魏軍':'the Wei army',
 '曹軍':'Cao\'s army','董':'DONG','周瑜':'Zhou Yu','南屏山':'Nanping Hill','丁奉':'Ding Feng','徐盛':'Xu Sheng',
 '江岸':'the river bank','溫酒斬華雄':'the wine still warm','峽谷':'the gorge','長坂橋':'Changban Bridge','長坂':'Changban',
 '糜竺':'Mi Zhu','青龍':'Green Dragon','昭烈':'Xuande','美髯':'the magnificent beard','瞄準':'aim','夏侯':'Xiahou',
 '綸巾':'silk cap','乾':'Qian','闕':'twin towers','長坂坡':'Changban','董卓軍':'Dong Zhuo\'s army','吳':'Wu','討取':'slain',
 '曹軍水寨':'Cao\'s water camp','夏口':'Xiakou','連環船':'the chained ships','汜水':'Sishui','盟主':'the coalition leader',
 '汜水關':'Sishui Pass','公孫瓚':'Gongsun Zan','聯軍本陣':'the coalition HQ','伏兵':'ambush','關前':'before the gate',
 '酸棗':'Suanzao','許褚':'Xu Chu','黃忠':'Huang Zhong','青釭劍':'the Qinggang Sword','夏侯恩':'Xiahou En','阿斗':'Adou',
 '單騎救主':'riding alone to the rescue','晏明':'Yan Ming','漢水':'the Han River','漢':'HAN','老當益壯':'older and stronger',
 '蜀軍本陣':'the Shu HQ','漢水渡口':'the Han River ford','山道':'the mountain road','定軍山頂':'the Dingjun summit',
 '當陽一喝':'the roar at Dangyang','護心鏡':'heart-guard mirror','雙股劍':'the twin swords','冠':'crown','雙龍斬':'Twin Dragon Slash',
 '百步穿楊':'a hundred paces, a hundred hits','倚天劍':'the Yitian Sword','夏':'Xia','右衽':'right-lapped lapel',
 '丈八蛇矛':'the eighteen-foot serpent spear','燕人咆哮':'the roar of the man of Yan','雉雞翎':'pheasant-tail plume',
 '華蓋':'canopy','荊州':'Jing Province','火燒連環船':'burning the chained ships','東南風':'the east wind','攻破':'broken',
 '華容':'Huarong','長':'long','常山趙雲':'Zhao Yun of Changshan','虎牢':'Hulao','初平元年':'the first year of Chuping',
 '黃':'HUANG','燕人張飛':'Zhang Fei of Yan','天下無雙':'peerless under heaven','呂布敗走':'Lü Bu retreats','千人斬':'a thousand slain',
 '曹洪':'Cao Hong','守住了':'held','初級':'Easy','繼續':'Continue','再戰':'Retry','當陽長坂':'Dangyang, Changban',
 '淳于導':'Chunyu Dao','鍾':'Zhong','尋得':'found','懷抱阿斗':'carrying Adou','殺出重圍':'cut out of the encirclement',
 '夏侯傑':'Xiahou Jie','樊城':'Fancheng','襄陽':'Xiangyang','漢津':'Hanzin','水':'water','漢中':'Hanzhong','陽平關':'Yangping Pass',
 '敵總大將':'the enemy commander-in-chief','金鼓振天':'drums shaking the sky','人中呂布':'among men, Lü Bu',
 '雙耳垂肩':'earlobes to his shoulders','十字斬':'Cross Slash','丹鳳眼':'phoenix eyes','臥蠶眉':'silkworm brows',
 '綠巾':'green headband','青龍偃月刀':'the Green Dragon Crescent Blade','弓':'bow','鉤鐮刀':'the hook-blade','前立':'crest',
 '大刀':'the great blade','裂地':'earth-splitter','修羅':'Chaos','上級':'Hard','普通':'Normal','米':'rice',
 '長槍':'the spear','連擊':'chain','擊破':'KO','敵將':'enemy officer','出陣':'deploy','撤退':'quit','戰績':'records',
 '操作說明':'controls','劇情模式':'story mode','演武試煉':'trials','自由演武':'free battle','鎖':'locked','開':'open',
 '已解鎖':'unlocked','點將':'summon','佈陣':'deploy','整軍備戰':'prepare','勝利':'victory','敗北':'defeat','評價':'rank',
 '新紀錄':'new record','更新':'improved','決定':'confirm','返回':'back','選擇':'select','心得':'tip','限時':'timer',
 '守':'defend','青缸劍':'the Qinggang Sword','方天畫戟':'the Sky-Piercer Halberd','神鬼亂舞':'dance of gods and demons',
 '神兵':'divine weapon','紅錦':'red brocade','連環':'chained rings','雜':'mixed','鶴氅':'the crane cloak','綸':'silk',
 '赤兔':'Red Hare','青龍牙旗':'the green-dragon banners','樓船':'war junk','細鱗':'fine scales','鐵甲':'iron armour',
 '唳':'cry','堰':'weir','堰口':'the weir mouth','錦':'brocade','貂':'sable','重':'heavy','輕':'light','銅':'bronze',
 '鐵':'iron','金':'gold','銀':'silver','玉':'jade','旗':'flag','幡':'banner','營':'camp','寨':'stockade','城':'city',
 '關':'pass','門':'gate','橋':'bridge','山':'mountain','谷':'valley','川':'river','岸':'bank','灘':'shallows',
 '礁':'reef','洲':'islet','堤':'levee','壇':'altar','廟':'shrine','墓':'tomb','碑':'stele','闕門':'tower gate',
 '闇':'dark','光':'light','影':'shadow','焰':'flame','煙':'smoke','塵':'dust','雪':'snow','雨':'rain','風':'wind',
 '雷':'thunder','電':'lightning','鳴':'ring','吼':'roar','嘯':'howl','吹':'blow','斬':'slash','刺':'thrust',
 '突':'charge','衝':'rush','防':'defence','速':'speed','力':'power','氣':'spirit','勇':'bravery','怒':'rage',
 '戰':'battle','陣':'formation','兵':'soldier','卒':'grunt','將':'officer','帥':'marshal','軍':'army','師':'host',
 '旗本':'standard guard','親衛':'bodyguard','精銳':'elite','伏':'hidden','援':'reinforce','降':'surrender','敗':'rout',
 '走':'flee','退':'withdraw','進':'advance','攻':'attack','守':'hold','圍':'encircle','破':'break','滅':'destroy',
 '火計':'the fire attack','苦肉':'the self-wound ruse','借箭':'borrowing arrows','借風':'borrowing the wind',
 '連環計':'the chain stratagem','空營':'the empty camp','糧':'grain','草':'grass','船':'boat','帆':'sail','纜':'cable',
 '槍':'spear','矛':'spear','戟':'halberd','刀':'blade','劍':'sword','盾':'shield','甲':'armour','盔':'helm',
 '鞍':'saddle','馬':'horse','象':'elephant','虎':'tiger','龍':'dragon','鳳':'phoenix','鶴':'crane','燕':'swallow',
 '狼':'wolf','豹':'leopard','獅':'lion','鷹':'hawk','雁':'goose','烏':'crow','蛇':'serpent','蠍':'scorpion', '張郃':'Zhang He','夏侯恩':'Xiahou En','夏侯傑':'Xiahou Jie','淳于導':'Chunyu Dao','簡雍':'Jian Yong','晏明':'Yan Ming',
 '漢津':'Hanjin','雲夢澤':'the Yunmeng marshes','長江':'the Yangtze','雲夢':'Yunmeng','劉琮':'Liu Cong','沮漳':'the Ju-Zhang rivers',
 '文聘':'Wen Ping','蔡瑁':'Cai Mao','張允':'Zhang Yun','蔡和':'Cai He','蔡中':'Cai Zhong','甘寧':'Gan Ning','程昱':'Cheng Yu',
 '子龍':'Zilong','益德':'Yide','雲長':'Yunchang','孔明':'Kongming','公覆':'Gongfu','子義':'Ziyi','奉先':'Fengxian',
 '建安十三年':'the thirteenth year of Jian-an','建安':'the Jian-an era','秋':'autumn','冬':'winter','春':'spring',
 '天下三分':'the realm split in three','萬事俱備':'all is ready','只欠東風':'all but the east wind','祭風':'the wind rite',
 '借東風':'borrowing the east wind','既得':'holding','順江東下':'sails east down the river','北軍':'the northern host',
 '不習水戰':'no sailors','鐵索連舟':'chains the ships','屯於':'camped at','結盟':'join hands','請以火攻':'offers the fire attack',
 '身是張益德也':'I am Zhang Yide','可來共決死':'come and die with me','皆得免難':'all saved','擲於地':'cast him to the ground',
 '為汝這孺子':'for you, boy','幾損我一員大將':'I nearly lost a great officer','遷牙門將軍':'made General of the Gate',
 '斜趨':'turns aside','得濟沔水':'crosses the Mian','至夏口':'reaches Xiakou','船會':'boats meet','瞋目橫矛':'eyes blazing, spear level',
 '敵皆無敢近者':'none dare come near','僅以身免':'escapes with his life','奔華容道而去':'flees by the Huarong Road',
 '義釋':'frees out of honour','北歸':'returns north','截殺':'cuts down','懷抱':'carrying','平安':'safe','肝膽碎裂':'his courage shatters',
 '一聲斷喝':'a single thunderous challenge','追兵止步':'the pursuit halts','橫矛立斷橋頭':'levels his spear and severs the crossing',
 '膽落':'nerve broken','棄妻子而走':'leaves wife and child','不見主母':'his ladies missing','復入重圍':'rides back into the ring',
 '率虎豹騎':'leads the Tiger and Leopard Riders','一日一夜行三百里':'three hundred li in a day and night','追及':'overtakes',
 '百姓十餘萬相隨':'a hundred thousand common folk follow','日行十餘里':'a dozen li a day','舉州而降':'surrenders the province',
 '大軍南下':'marches south in force','棄樊城南走':'abandons Fancheng','東走漢津':'east toward Hanjin','舟船在江上':'boats wait on the river',
 '在此一舉':'this one battle decides','身抱弱子':'carrying the young lord','保護甘夫人':'shielding Lady Gan',
 '截殺曹軍':'falls on the foe','孫劉':'Sun and Liu','火船':'fire ships','直入':'ram straight into','盡成火海':'all a sea of fire',
 '延及岸上營寨':'spreads to the camps ashore','細作':'spy','slain':'slain','已奪':'taken','withdraw去':'withdraw',
 '起':'rises','拼死':'desperate','來救':'to the rescue','大營攻破':'the grand camp falls','斷後':'covers the retreat',
 'wind助火勢':'the wind feeds the fire','延燒':'spreads','延':'spreads','燒':'burns','助':'feeds',
 '北部':'the north','郃':'He','恩':'En','傑':'Jie','津':'ford','琮':'Cong','瑜':'Yu','蓋':'Gai','肅':'Su','禁':'Jin','盛':'Sheng',
 '玠':'Jie','奉':'Feng','和':'He','南':'Nan','晃':'Huang','仁':'Ren','褚':'Chu','雍':'Yong','芳':'Fang','糜':'Mi','竺':'Zhu',
 '純':'Chun','洪':'Hong','導':'Dao','晏':'Yan','傑':'Jie','襲':'Xi','尚':'Shang','法':'Fa','淵':'Yuan','兵':'soldiers',
 '討董之戰':'the war on Dong Zhuo','當陽之戰':'the battle of Dangyang','火燒連環':'the chained fleet burns','漢中之戰':'the Hanzhong campaign',
 '陣斬':'slays in the field','威震漢中':'shakes all Hanzhong','拋':'casts','抱':'carries','負':'bears','馳':'gallops',

}



for p in pathlib.Path('src').rglob('*.js'):
    if 'vendor' in p.parts: continue
    t = p.read_text(encoding='utf-8')
    t2 = t
    for k, v in sorted(D.items(), key=lambda kv: -len(kv[0])):
        t2 = t2.replace(k, v)
    if t2 != t:
        p.write_text(t2, encoding='utf-8')

# report leftovers
import re
CJK = re.compile(r'[\u4e00-\u9fff]')
left = 0
for p in sorted(pathlib.Path('src').rglob('*.js')):
    if 'vendor' in p.parts: continue
    for i, l in enumerate(p.read_text(encoding='utf-8').splitlines(), 1):
        if CJK.search(l):
            left += 1
            if left <= 120: print(f'{p}:{i}: {l.strip()[:120]}')
print('TOTAL LINES LEFT:', left)
