// ========================================================
// 靜態資料庫：常數、存檔、Web Audio、選手庫、技能與關卡時裝
// ========================================================
const WORLD = {
  WIDTH: 3000, HEIGHT: 850, FLOOR_Y: 620,
  NET_X: 1500, NET_H: 125, NET_W: 12, NET_TOP_Y: 495,
  LEFT: 940, RIGHT: 2060, ATTACK_LINE_DIST: 186, GRAVITY: 0.38
};
const VIEW_W = 1600, VIEW_H = 500;

const SKILL_POOL = [
  { id: 'sk_breaker', name: '破城重槌', cost: 100, type: 'SPIKE', desc: '【扣殺技】滿能量空中按J：破甲+9.0，大幅削弱敵方剛性，90%擊碎金盾！', armorPiercing: 9.0, speedMult: 1.08, extraDown: 0, glowColor: '#ef4444' },
  { id: 'sk_deep_impact', name: '深海重砲', cost: 140, type: 'SPIKE', desc: '【扣殺技】滿能量空中按J：長線平抽速度+18%，超強下旋咬入底線！', armorPiercing: 4.5, speedMult: 1.18, extraDown: 0.0002, glowColor: '#38bdf8' },
  { id: 'sk_steepexec', name: '斷頭台下釘', cost: 120, type: 'SPIKE', desc: '【扣殺技】滿能量空中按J：直插三米線大角度下釘，速度快且角度刁鑽！', armorPiercing: 6.0, speedMult: 0.95, extraDown: 0.00035, glowColor: '#facc15' },
  { id: 'sk_phantom', name: '幻影抹手', cost: 100, type: 'THRUST', desc: '【進攻技】滿能量空中按L：觸碰攔網50%高速打手出界！若未成功返還50%能量！', armorPiercing: 0, speedMult: 1.25, extraDown: 0, glowColor: '#10b981' },
  { id: 'sk_solar_sine', name: '落日正弦', cost: 120, type: 'SERVE_FLOAT', desc: '【發球技】滿能量K高拋後空中按L：高拋跳飄，空中正弦波劇烈晃動，收斂落入界內！', armorPiercing: 0, speedMult: 1.0, extraDown: 0, glowColor: '#f59e0b' },
  { id: 'sk_sky_comet', name: '天際墜石', cost: 120, type: 'SERVE_SPIKE', desc: '【發球技】滿能量K高拋後空中按J：高拋衝向天花板頂部，精確下釘敵方深場(Vy>36)！', armorPiercing: 7.5, speedMult: 1.0, extraDown: 0.0004, glowColor: '#facc15' },
  { id: 'sk_phantom_drop', name: '幽靈吊球', cost: 80, type: 'SET_ATTACK', desc: '【二傳/進攻技】滿能量第2觸空中按L：過網隱形，敵方反應延遲！碰球或被擋回立刻現形！', armorPiercing: 0, speedMult: 0.85, extraDown: 0, glowColor: null },
  { id: 'sk_chrono_spike', name: '閃電速攻', cost: 120, type: 'SET_TACTIC', desc: '【戰術技】滿能量處理球時按O：觸發時流差與時鐘逆轉，敵方全員減速50%，畫面蒙上灰版！', armorPiercing: 3.0, speedMult: 1.2, extraDown: 0, glowColor: '#ec4899' },
  { id: 'sk_rolling_thunder', name: '雷霆瞬步', cost: 75, type: 'DEF_SAVE', desc: '【防守技】滿能量按K(限定己方半場)：化為殘影瞬移至球落點，免連按100%觸發完美吸震！', armorPiercing: 0, speedMult: 1.0, extraDown: 0, glowColor: '#38bdf8' },
  { id: 'sk_mud_spike', name: '泥沼重扣', cost: 110, type: 'SPIKE', desc: '【扣殺技】滿能量空中按J：包裹厚重泥濘暴扣！敵方若接起將陷入泥濘Debuff，移動與起跳大幅減速！', armorPiercing: 5.0, speedMult: 1.12, extraDown: 0.0001, glowColor: '#78350f' },
  { id: 'sk_bungee_gum', name: '伸縮自在的愛', cost: 110, type: 'SPIKE', desc: '【扣殺/抹手】空中按J/L：低手接起時反彈高度驟降70%，向前微弱滾動軟墜極難起球！', armorPiercing: 3.0, speedMult: 1.05, extraDown: 0, glowColor: '#f472b6' },
  { id: 'sk_iron_wall', name: '銅牆鐵壁', cost: 130, type: 'BLOCK', desc: '【攔網技】網前按Space：碰到球100%觸發定格特寫，3.5倍速垂直下釘直接死蓋得分！', armorPiercing: 0, speedMult: 1.0, extraDown: 0, glowColor: '#fbbf24' },
  { id: 'sk_soft_wall', name: '引力柔網', cost: 100, type: 'BLOCK_STANCE', desc: '【攔網持續態】網前按Space：持續3回合！攔網碰球100%化為慢速One Touch緩送後排，絕不被打穿！', armorPiercing: 0, speedMult: 1.0, extraDown: 0, glowColor: '#2dd4bf' },
  { id: 'sk_shock_return', name: '暴風反彈', cost: 95, type: 'DEF_SAVE', desc: '【防守技】接球時消耗：即使接噴必定過網，球化為超音速暴風(速度34)直貫敵場！', armorPiercing: 8.0, speedMult: 1.3, extraDown: 0, glowColor: '#0ea5e9' },
  { id: 'sk_godspeed_toss', name: '神速二傳', cost: 105, type: 'SET_TACTIC', desc: '【二傳持續態】按O托球觸發：持續3次二傳！隊友進攻初速無條件獲得+4.0絕對加成！', armorPiercing: 4.0, speedMult: 1.2, extraDown: 0, glowColor: '#eab308' },
  { id: 'sk_greased_ball', name: '油滑脫手', cost: 115, type: 'SPIKE', desc: '【進攻技】滿能量空中按J：附帶滑油傳染2次觸碰！防守方耐受值(Defense)下降8點持續3回合！', armorPiercing: 6.0, speedMult: 1.1, extraDown: 0, glowColor: '#1e293b' },
  { id: 'sk_gravity_drop', name: '重力斷崖', cost: 125, type: 'SPIKE', desc: '【扣殺技】空中按J：過網前高速平直，越過白帶瞬間引力暴增12倍垂直砸地！', armorPiercing: 5.5, speedMult: 1.25, extraDown: 0.0005, glowColor: '#7e22ce' },
  { id: 'sk_savage_roar', name: '野蠻怒吼', cost: 90, type: 'DEF_SAVE', desc: '【戰吼技】按K立即釋放：我軍全員獲得3回合不可消除亢奮，敵軍全員覆蓋3回合沮喪！', armorPiercing: 0, speedMult: 1.0, extraDown: 0, glowColor: '#dc2626' }
];

const COSMETICS_DB = {
  hats: [
    { id: 'hat_none', name: '無頭飾', desc: '卸下頭飾' },
    { id: 'hat_santa', name: '聖誕帽', desc: '節慶紅白毛球帽' },
    { id: 'hat_tophat', name: '高禮帽', desc: '優雅紳士高筒黑帽' },
    { id: 'hat_pompadour', name: '飛機頭', desc: '霸氣復古機車搖滾頭' },
    { id: 'hat_afro', name: '爆炸頭', desc: '經典蓬鬆復古爆炸頭' },
    { id: 'hat_party', name: '派對尖帽', desc: '歡樂彩色條紋派對帽' },
    { id: 'hat_rabbit', name: '兔耳朵', desc: '俏皮晃動兔耳頭箍' },
    { id: 'hat_sprout', name: '頭上長草', desc: '萌萌小樹苗嫩芽' },
    { id: 'hat_head_shades', name: '頭頂墨鏡', desc: '隨興推在額頭的酷墨鏡' },
    { id: 'hat_cap_red', name: '紅鴨舌帽', desc: '運動街頭棒球帽（紅）' },
    { id: 'hat_cap_blue', name: '藍鴨舌帽', desc: '運動街頭棒球帽（藍）' },
    { id: 'hat_cap_black', name: '黑鴨舌帽', desc: '百搭街頭棒球帽（黑）' },
    { id: 'hat_helmet', name: '鋼鐵頭盔', desc: '前排重裝防護全罩頭盔' },
    { id: 'hat_cat', name: '黑貓耳', desc: '敏捷靈動貓耳頭飾' },
    { id: 'hat_dog', name: '柴犬耳', desc: '垂耳元氣犬耳' },
    { id: 'hat_crown', name: '黃金小王冠', desc: '榮耀王者迷你皇冠' },
    { id: 'hat_halo', name: '天使光環', desc: '懸浮頭頂的純潔光環' },
    { id: 'hat_devil', name: '惡魔尖角', desc: '深紅危險小惡魔角' },
    { id: 'hat_viking', name: '維京角盔', desc: '狂野雙牛角戰士盔' },
    { id: 'hat_chef', name: '主廚高帽', desc: '專業白色高筒廚師帽' },
    { id: 'hat_bandana', name: '熱血頭帶', desc: '必勝紅白文字頭帶' },
    { id: 'hat_straw', name: '冒險草帽', desc: '經典紅色緞帶草帽' }
  ],
  faces: [
    { id: 'face_none', name: '無臉飾', desc: '卸下臉飾' },
    { id: 'face_shades', name: '帥氣墨鏡', desc: '巨星防眩深黑墨鏡' },
    { id: 'face_mustache', name: '八字鬍', desc: '紳士翹角小八字鬍' },
    { id: 'face_goatee', name: '山羊鬍', desc: '個性十足的山羊長鬍鬚' },
    { id: 'face_mask', name: '防疫口罩', desc: '立體防塵純白口罩' },
    { id: 'face_spiral_glasses', name: '螺旋眼鏡', desc: '圈圈眼搞笑深度近視鏡' },
    { id: 'face_ruby_earring', name: '紅寶石耳環', desc: '左耳微閃璀璨紅寶石' },
    { id: 'face_blush', name: '紅暈腮紅', desc: '害羞粉嫩大紅臉蛋' },
    { id: 'face_monocle', name: '單片眼鏡', desc: '英倫老派金色鏈條單鏡' },
    { id: 'face_bandage', name: '鼻樑創可貼', desc: '熱血運動受傷交叉貼' },
    { id: 'face_cigar', name: '硬漢雪茄', desc: '吞雲吐霧的硬派雪茄' },
    { id: 'face_eye_patch', name: '海盜眼罩', desc: '漆黑皮革單眼眼罩' },
    { id: 'face_fox_mask', name: '半面狐面', desc: '和風紅白花紋狐狸面具' },
    { id: 'face_bubble_gum', name: '吹泡泡糖', desc: '嘴邊粉紅大泡泡' },
    { id: 'face_scuba', name: '浮潛呼吸管', desc: '水下專業咬嘴呼吸管' },
    { id: 'face_vr', name: '未來VR鏡', desc: '發光矩陣賽博護目鏡' },
    { id: 'face_clown_nose', name: '小丑紅鼻', desc: '圓滾滾紅色海綿鼻' },
    { id: 'face_rose', name: '口銜玫瑰', desc: '優雅深紅帶刺玫瑰花' },
    { id: 'face_scar', name: '戰士刀疤', desc: '左眼深邃男子漢傷痕' },
    { id: 'face_toast', name: '遲到咬吐司', desc: '嘴裡叼著快遲到的土司片' },
    { id: 'face_gas_mask', name: '防毒濾嘴', desc: '工業風重裝呼吸面罩' }
  ],
  effects: [
    { id: 'fx_none', name: '無特效', glow: null, desc: '無額外光暈' },
    { id: 'fx_swamp', name: '沼澤劇毒', glow: '#22c55e', desc: '第二關獎勵：深綠劇毒氣場' },
    { id: 'fx_steel', name: '鋼鐵巨神', glow: '#94a3b8', desc: '第三關獎勵：鈦灰剛性光暈' },
    { id: 'fx_storm', name: '暴風雷鳴', glow: '#38bdf8', desc: '第四關獎勵：天藍疾風電光' },
    { id: 'fx_god', name: '神域金耀', glow: '#facc15', desc: '冠軍獎勵：耀眼尊爵金光' }
  ]
};

let UNLOCKED_COSMETICS = {
  hats: ['hat_none'],
  faces: ['face_none'],
  effects: ['fx_none']
};
let UNLOCKED_SKILLS = ['sk_breaker'];

const GACHA_POOL = [
  { name: '黑岩霸生', tier: 'SSR', color: '#0f172a', desc: '極限物理輸出·直線下釘重砲手！', base: { str: 38, agi: 18, jump: 32, dex: 15, int: 14 }, bonusPts: 10 },
  { name: '白鳥神威', tier: 'SSR', color: '#e0e7ff', desc: '全能二傳指揮塔·時流掌控！', base: { str: 22, agi: 26, jump: 24, dex: 36, int: 38 }, bonusPts: 10 },
  { name: '鋼鐵鐵柱', tier: 'SSR', color: '#475569', desc: '網前巨人之牆·封網天花板！', base: { str: 32, agi: 16, jump: 38, dex: 22, int: 25 }, bonusPts: 10 },
  { name: '風魔迅平', tier: 'SSR', color: '#14b8a6', desc: '全場極速守備·雷霆瞬步！', base: { str: 14, agi: 42, jump: 20, dex: 34, int: 30 }, bonusPts: 10 },
  { name: '桐生剎那', tier: 'SSR', color: '#b91c1c', desc: '技術流主攻·極致包球上旋！', base: { str: 28, agi: 24, jump: 30, dex: 38, int: 24 }, bonusPts: 10 },
  { name: '赤城蓮', tier: 'SSR', color: '#dc2626', desc: '重裝攻城槌·極致破甲暴扣！', base: { str: 40, agi: 20, jump: 34, dex: 18, int: 15 }, bonusPts: 10 },
  { name: '神威光流', tier: 'SSR', color: '#0284c7', desc: '神域之盾·不倒的極限接球！', base: { str: 16, agi: 44, jump: 24, dex: 36, int: 32 }, bonusPts: 10 },
  { name: '鬼塚豪', tier: 'SSR', color: '#334155', desc: '攔網絕壁·網前遮蔽天日！', base: { str: 34, agi: 18, jump: 40, dex: 24, int: 26 }, bonusPts: 10 },
  { name: '月詠夜空', tier: 'SSR', color: '#8b5cf6', desc: '幻象司令塔·支配時間軌跡！', base: { str: 20, agi: 28, jump: 26, dex: 38, int: 40 }, bonusPts: 10 },
  { name: '犬飼雷藏', tier: 'SR', color: '#eab308', desc: '天際雷鳴轟炸！', base: { str: 32, agi: 26, jump: 30, dex: 22, int: 20 }, bonusPts: 6 },
  { name: '水無月涼', tier: 'SR', color: '#38bdf8', desc: '卸力防守專家·幽靈偷渡！', base: { str: 16, agi: 30, jump: 18, dex: 32, int: 30 }, bonusPts: 6 },
  { name: '夜叉丸', tier: 'SR', color: '#6b21a8', desc: '落日正弦·氣流掌控者！', base: { str: 22, agi: 28, jump: 26, dex: 36, int: 32 }, bonusPts: 6 },
  { name: '轟原剛', tier: 'SR', color: '#c2410c', desc: '高打點強攻手·斷頭重扣！', base: { str: 34, agi: 20, jump: 30, dex: 22, int: 16 }, bonusPts: 6 },
  { name: '神代千尋', tier: 'SR', color: '#4338ca', desc: '大局觀控場·落點狙擊！', base: { str: 18, agi: 26, jump: 20, dex: 30, int: 34 }, bonusPts: 6 },
  { name: '火神大輝', tier: 'SR', color: '#ea580c', desc: '滯空重扣飛人！', base: { str: 30, agi: 26, jump: 36, dex: 24, int: 18 }, bonusPts: 6 },
  { name: '鳴神悠', tier: 'SR', color: '#06b6d4', desc: '雷霆折射飄球！', base: { str: 24, agi: 30, jump: 24, dex: 34, int: 28 }, bonusPts: 6 },
  { name: '橘真琴', tier: 'SR', color: '#10b981', desc: '穩定後排核心！', base: { str: 22, agi: 32, jump: 22, dex: 30, int: 30 }, bonusPts: 6 },
  { name: '冰室辰也', tier: 'SR', color: '#6366f1', desc: '優雅假托真扣！', base: { str: 26, agi: 24, jump: 28, dex: 34, int: 32 }, bonusPts: 6 },
  { name: '影山飛雄型', tier: 'SR', color: '#1e3a8a', desc: '精準秒速傳球！', base: { str: 22, agi: 28, jump: 28, dex: 36, int: 34 }, bonusPts: 6 },
  { name: '西谷夕型', tier: 'SR', color: '#d97706', desc: '翻滾吧雷霆守護神！', base: { str: 18, agi: 38, jump: 22, dex: 34, int: 28 }, bonusPts: 6 },
  { name: '柴田健吾', tier: 'R', color: '#d97706', desc: '熱血撲救型接球手！', base: { str: 18, agi: 30, jump: 20, dex: 24, int: 20 }, bonusPts: 3 },
  { name: '荒垣左之助', tier: 'R', color: '#be123c', desc: '左手重槌·折射刁鑽！', base: { str: 28, agi: 22, jump: 24, dex: 22, int: 16 }, bonusPts: 3 },
  { name: '真鍋算', tier: 'R', color: '#0284c7', desc: '精準量角器·機械式二傳！', base: { str: 16, agi: 24, jump: 20, dex: 28, int: 26 }, bonusPts: 3 },
  { name: '木村隼人', tier: 'R', color: '#7c3aed', desc: '側翼滑步扣手！', base: { str: 24, agi: 26, jump: 24, dex: 24, int: 20 }, bonusPts: 3 },
  { name: '高橋大地', tier: 'R', color: '#047857', desc: '深蹲穩實一傳！', base: { str: 20, agi: 24, jump: 22, dex: 26, int: 24 }, bonusPts: 3 },
  { name: '松本潤平', tier: 'R', color: '#b45309', desc: '輕巧擦手抹球！', base: { str: 18, agi: 28, jump: 20, dex: 28, int: 22 }, bonusPts: 3 },
  { name: '野村哲也', tier: 'R', color: '#475569', desc: '前排堅實封堵！', base: { str: 26, agi: 18, jump: 28, dex: 20, int: 22 }, bonusPts: 3 },
  { name: '長谷川健', tier: 'R', color: '#0891b2', desc: '超手長弧線跳發！', base: { str: 24, agi: 22, jump: 26, dex: 26, int: 20 }, bonusPts: 3 },
  { name: '宮崎駿介', tier: 'R', color: '#9f1239', desc: '暴力壓下手腕！', base: { str: 28, agi: 20, jump: 24, dex: 22, int: 18 }, bonusPts: 3 },
  { name: '佐藤悠真', tier: 'N', color: '#64748b', desc: '標準初學者·平衡攻手！', base: { str: 20, agi: 22, jump: 20, dex: 20, int: 20 }, bonusPts: 0 },
  { name: '鈴木拓海', tier: 'N', color: '#94a3b8', desc: '認真基本功二傳！', base: { str: 18, agi: 22, jump: 18, dex: 24, int: 20 }, bonusPts: 0 },
  { name: '渡邊和樹', tier: 'N', color: '#71717a', desc: '剛入社熱血新秀！', base: { str: 22, agi: 20, jump: 20, dex: 18, int: 18 }, bonusPts: 0 },
  { name: '伊藤健太', tier: 'N', color: '#78716c', desc: '基本功接球手！', base: { str: 18, agi: 22, jump: 18, dex: 22, int: 20 }, bonusPts: 0 },
  { name: '小林拓也', tier: 'N', color: '#a1a1aa', desc: '努力型網前防守！', base: { str: 20, agi: 18, jump: 22, dex: 18, int: 20 }, bonusPts: 0 }
];

let INVENTORY = [
  { id: 'c1', name: '青空主攻手', tier: 'N', color: '#38bdf8', level: 1, exp: 0, freePts: 5, baseStats: { str: 20, agi: 22, jump: 20, dex: 20, int: 20 }, stats: { str: 20, agi: 22, jump: 20, dex: 20, int: 20 }, equippedSkill: 'sk_breaker', cosmetics: { hat: 'hat_none', face: 'face_none', effect: 'fx_none' } },
  { id: 'c2', name: '森綠自由人', tier: 'N', color: '#34d399', level: 1, exp: 0, freePts: 5, baseStats: { str: 20, agi: 24, jump: 20, dex: 20, int: 20 }, stats: { str: 20, agi: 24, jump: 20, dex: 20, int: 20 }, equippedSkill: 'sk_breaker', cosmetics: { hat: 'hat_none', face: 'face_none', effect: 'fx_none' } },
  { id: 'c3', name: '緋紅副攻手', tier: 'N', color: '#f472b6', level: 1, exp: 0, freePts: 5, baseStats: { str: 20, agi: 22, jump: 20, dex: 20, int: 20 }, stats: { str: 20, agi: 22, jump: 20, dex: 20, int: 20 }, equippedSkill: 'sk_breaker', cosmetics: { hat: 'hat_none', face: 'face_none', effect: 'fx_none' } },
  { id: 'c4', name: '紫電二傳手', tier: 'N', color: '#c084fc', level: 1, exp: 0, freePts: 5, baseStats: { str: 20, agi: 22, jump: 20, dex: 20, int: 20 }, stats: { str: 20, agi: 22, jump: 20, dex: 20, int: 20 }, equippedSkill: 'sk_breaker', cosmetics: { hat: 'hat_none', face: 'face_none', effect: 'fx_none' } }
];

let ACTIVE_ROSTER = { user: INVENTORY[0], mate: INVENTORY[1], enemyFront: INVENTORY[2], enemyBack: INVENTORY[3] };
// ========================================================
// ☁️ Firebase 雲端資料庫初始化 (專案: nsfwvolley-b5ee1)
// ========================================================
const firebaseConfig = {
  apiKey: "AIzaSyCsPtYyZbhFpWjI1SYcfrJVxkc1U8T8HkQ",
  authDomain: "nsfwvolley-b5ee1.firebaseapp.com",
  projectId: "nsfwvolley-b5ee1",
  storageBucket: "nsfwvolley-b5ee1.firebasestorage.app",
  messagingSenderId: "486325994967",
  appId: "1:486325994967:web:3c385f9b3db94a1bbe7792",
  measurementId: "G-K6XRBRG29K"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentCloudUser = localStorage.getItem('VOLLEY_CLOUD_USER') || null;
let userCoins = 99999; // 封測期間維持 99999，正式公測由你後台一鍵重置
const STORAGE_KEY = 'VOLLEY_ARENA_LOCAL_CACHE';
const CAREER_STAGES = [
  {
    id: 1, name: '青葉新秀高校', subtitle: '初階考核·基礎攻防', color: '#34d399', rewardCoins: 200, rewardSkin: null,
    front: { name: '佐藤悠真', tier: 'N', color: '#64748b', stats: { str: 20, agi: 20, jump: 20, dex: 20, int: 20 }, equippedSkill: 'sk_breaker' },
    back:  { name: '伊藤健太', tier: 'N', color: '#78716c', stats: { str: 20, agi: 22, jump: 20, dex: 20, int: 20 }, equippedSkill: 'sk_phantom' },
    desc: '標準基本功球隊，無特殊大招，適合熟悉手感與進攻節奏。'
  },
  {
    id: 2, name: '泥濘沼澤工科', subtitle: '黏性控場·泥沼狂潮', color: '#78350f', rewardCoins: 350, rewardSkin: 'fx_swamp',
    front: { name: '轟原剛', tier: 'SR', color: '#c2410c', stats: { str: 32, agi: 22, jump: 28, dex: 24, int: 22 }, equippedSkill: 'sk_mud_spike' },
    back:  { name: '水無月涼', tier: 'SR', color: '#38bdf8', stats: { str: 18, agi: 32, jump: 20, dex: 34, int: 32 }, equippedSkill: 'sk_bungee_gum' },
    desc: '擅長【泥沼重扣】與【伸縮自在的愛】，接球者極易陷入泥濘減速與軟墜！'
  },
  {
    id: 3, name: '常盤鋼鐵壁壘', subtitle: '絕對封殺·網前巨人', color: '#64748b', rewardCoins: 500, rewardSkin: 'fx_steel',
    front: { name: '鋼鐵鐵柱', tier: 'SSR', color: '#475569', stats: { str: 38, agi: 18, jump: 42, dex: 24, int: 26 }, equippedSkill: 'sk_iron_wall' },
    back:  { name: '柴田健吾', tier: 'R', color: '#d97706', stats: { str: 22, agi: 34, jump: 22, dex: 26, int: 24 }, equippedSkill: 'sk_soft_wall' },
    desc: '前排裝備【銅牆鐵壁】與【引力柔網】，剛性極強，正面強攻極易被攔死！'
  },
  {
    id: 4, name: '疾風怒濤聯隊', subtitle: '極限反撲·音速暴風', color: '#0284c7', rewardCoins: 700, rewardSkin: 'fx_storm',
    front: { name: '桐生剎那', tier: 'SSR', color: '#b91c1c', stats: { str: 32, agi: 28, jump: 32, dex: 38, int: 26 }, equippedSkill: 'sk_greased_ball' },
    back:  { name: '神威光流', tier: 'SSR', color: '#0284c7', stats: { str: 20, agi: 46, jump: 26, dex: 38, int: 34 }, equippedSkill: 'sk_shock_return' },
    desc: '後排神域撲救自帶【暴風反彈】，進攻帶有【油滑脫手】削弱我方防守！'
  },
  {
    id: 5, name: '神域全明星隊', subtitle: '全國冠軍·終極巔峰', color: '#facc15', rewardCoins: 1200, rewardSkin: 'fx_god',
    front: { name: '黑岩霸生', tier: 'SSR', color: '#0f172a', stats: { str: 44, agi: 24, jump: 38, dex: 22, int: 20 }, equippedSkill: 'sk_gravity_drop' },
    back:  { name: '白鳥神威', tier: 'SSR', color: '#e0e7ff', stats: { str: 24, agi: 32, jump: 28, dex: 42, int: 42 }, equippedSkill: 'sk_godspeed_toss' },
    desc: '終極 BOSS！具備【神速二傳】初速貫通加成，以及越過白帶垂直暴墜的【重力斷崖】！'
  }
];

let careerProgress = 1;
let currentCareerStage = 1;
let isCareerMode = false;

let audioCtx = null, customAudio = new Audio();
customAudio.loop = true;
let isAudioLoaded = false;

function playSound(type) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const now = audioCtx.currentTime;
  try {
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    if (type === 'pia') { 
      osc.type = 'triangle'; osc.frequency.setValueAtTime(680, now); osc.frequency.exponentialRampToValueAtTime(130, now + 0.08);
      gain.gain.setValueAtTime(0.75, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now); osc.stop(now + 0.08);
    } else if (type === 'bump') { 
      osc.type = 'sine'; osc.frequency.setValueAtTime(160, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.12);
      gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now); osc.stop(now + 0.12);
    } else if (type === 'dong') { 
      osc.type = 'sine'; osc.frequency.setValueAtTime(95, now); osc.frequency.exponentialRampToValueAtTime(32, now + 0.22);
      gain.gain.setValueAtTime(0.85, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now); osc.stop(now + 0.22);
    } else if (type === 'set') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(320, now); osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);
      gain.gain.setValueAtTime(0.25, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now); osc.stop(now + 0.08);
    } else if (type === 'spike') {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(280, now); osc.frequency.exponentialRampToValueAtTime(30, now + 0.18);
      gain.gain.setValueAtTime(0.65, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now); osc.stop(now + 0.18);
    } else if (type === 'perfect_spike') {
      osc.type = 'square'; osc.frequency.setValueAtTime(420, now); osc.frequency.exponentialRampToValueAtTime(20, now + 0.3);
      gain.gain.setValueAtTime(0.85, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'block_break') {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(440, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.28);
      gain.gain.setValueAtTime(0.8, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now); osc.stop(now + 0.28);
    } else if (type === 'block_roof') {
      osc.type = 'square'; osc.frequency.setValueAtTime(110, now); osc.frequency.exponentialRampToValueAtTime(40, now + 0.22);
      gain.gain.setValueAtTime(0.65, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now); osc.stop(now + 0.22);
    } else if (type === 'dive') {
      osc.type = 'triangle'; osc.frequency.setValueAtTime(210, now); osc.frequency.exponentialRampToValueAtTime(70, now + 0.16);
      gain.gain.setValueAtTime(0.4, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now); osc.stop(now + 0.16);
    } else if (type === 'coin') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(987.77, now); osc.frequency.setValueAtTime(1318.51, now + 0.08);
      gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now); osc.stop(now + 0.35);
    } else if (type === 'teleport') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(200, now); osc.frequency.exponentialRampToValueAtTime(900, now + 0.14);
      gain.gain.setValueAtTime(0.6, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now); osc.stop(now + 0.14);
    } else if (type === 'clock_tick') {
      osc.type = 'triangle'; osc.frequency.setValueAtTime(1200, now); osc.frequency.exponentialRampToValueAtTime(220, now + 0.04);
      gain.gain.setValueAtTime(0.4, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now); osc.stop(now + 0.04);
    } else if (type === 'time_freeze') {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(440, now); osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
      gain.gain.setValueAtTime(0.8, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);
    } else if (type === 'p1_full') {
      osc.type = 'triangle'; osc.frequency.setValueAtTime(1200, now); osc.frequency.exponentialRampToValueAtTime(3200, now + 0.12);
      gain.gain.setValueAtTime(0.75, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now); osc.stop(now + 0.45);
    } else if (type === 'p2_full') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(950, now); osc.frequency.exponentialRampToValueAtTime(1750, now + 0.15);
      gain.gain.setValueAtTime(0.55, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);
    }
  } catch(e) {}
}

function playWhistle(isScore = false) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  try {
    const now = audioCtx.currentTime, osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(isScore ? 2600 : 2400, now);
    gain.gain.setValueAtTime(0.18, now); gain.gain.exponentialRampToValueAtTime(0.001, now + (isScore ? 0.15 : 0.4));
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(now); osc.stop(now + (isScore ? 0.15 : 0.4));
  } catch(e) {}
}

function saveGameData() {
  const data = {
    coins: userCoins,
    inventory: INVENTORY,
    careerProgress: careerProgress,
    unlockedCosmetics: UNLOCKED_COSMETICS,
    unlockedSkills: UNLOCKED_SKILLS,
    rosterIds: { user: ACTIVE_ROSTER.user.id, mate: ACTIVE_ROSTER.mate.id, enemyFront: ACTIVE_ROSTER.enemyFront.id, enemyBack: ACTIVE_ROSTER.enemyBack.id }
  };
  // 1. 本地快速快取
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}

  // 2. 雲端同步保存
  if (currentCloudUser) {
    db.collection('players').doc(currentCloudUser).set({
      gameData: JSON.stringify(data),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(err => console.error("雲端存檔失敗:", err));
  }
}
function loadGameData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      if (data.coins !== undefined) userCoins = Math.max(99999, data.coins);
      if (data.careerProgress !== undefined) careerProgress = data.careerProgress;
      if (data.unlockedCosmetics) UNLOCKED_COSMETICS = data.unlockedCosmetics;
      if (Array.isArray(data.unlockedSkills)) UNLOCKED_SKILLS = data.unlockedSkills;
      if (Array.isArray(data.inventory) && data.inventory.length >= 4) {
        INVENTORY = data.inventory;
        INVENTORY.forEach(card => {
          if (!card.equippedSkill) card.equippedSkill = 'sk_breaker';
          if (!card.cosmetics) card.cosmetics = { hat: 'hat_none', face: 'face_none', effect: 'fx_none' };
        });
      }
      if (data.rosterIds) {
        ACTIVE_ROSTER.user = INVENTORY.find(c => c.id === data.rosterIds.user) || INVENTORY[0];
        ACTIVE_ROSTER.mate = INVENTORY.find(c => c.id === data.rosterIds.mate) || INVENTORY[1];
        ACTIVE_ROSTER.enemyFront = INVENTORY.find(c => c.id === data.rosterIds.enemyFront) || INVENTORY[2];
        ACTIVE_ROSTER.enemyBack = INVENTORY.find(c => c.id === data.rosterIds.enemyBack) || INVENTORY[3];
      }
    }
  } catch (e) {}

  if (!UNLOCKED_COSMETICS.effects) UNLOCKED_COSMETICS.effects = ['fx_none'];
  CAREER_STAGES.forEach(stage => {
    if (stage.id < careerProgress && stage.rewardSkin) {
      if (!UNLOCKED_COSMETICS.effects.includes(stage.rewardSkin)) {
        UNLOCKED_COSMETICS.effects.push(stage.rewardSkin);
      }
    }
  });

  const cd = document.getElementById('coin-display');
  if (cd) cd.innerText = userCoins;
  const acd = document.getElementById('arcade-coin-display');
  if (acd) acd.innerText = userCoins;
}

function resetLocalStorageData() {
  if (confirm('確定要清除所有存檔資料嗎？這將重置金幣、抽卡名冊與角色等級。')) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
}

function deriveStats(card) {
  const s = card.stats;
  const power = 18.5 + (s.str * 0.25);
  const defense = 10.0 + (s.dex * 0.25) + (s.agi * 0.15);
  const blockRigidity = (defense * 1.05) + (s.str * 0.12) + (s.jump * 0.15);
  const oneTouchAbsorb = Math.min(75, Math.floor(35 + (s.dex * 0.8)));
  const sweetWindow = Math.floor(34 + (s.dex * 0.4));
  const reactionDelay = Math.max(3, Math.round(16 - (s.int * 0.25) - (s.agi * 0.15)));
  const baseSpeed = 5.2 + (s.agi * 0.12);
  const skillObj = SKILL_POOL.find(sk => sk.id === card.equippedSkill) || SKILL_POOL[0];

  return {
    speed: baseSpeed, jump: -9.8 - (s.jump * 0.10), diveSpeed: baseSpeed * 1.25,
    power: power, defense: defense, blockRigidity: blockRigidity,
    oneTouchAbsorb: oneTouchAbsorb, sweetWindow: sweetWindow, reactionDelay: reactionDelay,
    technique: 0.45 + (s.dex * 0.02), intellect: s.int,
    outballThreshold: Math.max(8, 60 - s.int * 1.5), skill: skillObj
  };
}

function getRequiredExp(level) { return Math.floor(100 * Math.pow(1.22, level - 1)); }

// ========================================================
// 網路多人通訊狀態 (Slot 映射與陣營定錨)
// ========================================================
const NET = {
  isMultiplayer: false,
  isHost: false,
  peer: null,
  conn: null,
  roomCode: '',
  mode: 'PVP',
  pveDifficulty: 5,
  mySlot: 0,
  mateSlot: 1,
  myTeam: 'LEFT',
  remoteKeys: { a: false, d: false, w: false, j: false, k: false, l: false, o: false, space: false },
  lastPing: 0
};
// ========================================================
// ☁️ Firebase 雲端認證與存檔載入
// ========================================================
function handleFirebaseAuth(username, password) {
  const userRef = db.collection('players').doc(username);
  
  userRef.get().then((doc) => {
    if (doc.exists) {
      const userData = doc.data();
      if (userData.password !== password) {
        alert('❌ 密碼錯誤！請重新輸入。');
        return;
      }
      // 登入成功，讀取雲端進度覆蓋本機
      currentCloudUser = username;
      localStorage.setItem('VOLLEY_CLOUD_USER', username);
      if (userData.gameData) {
        localStorage.setItem(STORAGE_KEY, userData.gameData);
      }
      alert(`✅ 歡迎回來，[${username}]！已載入雲端進度。`);
      location.reload();
    } else {
      // 註冊全新雲端帳號
      userRef.set({
        username: username,
        password: password,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(() => {
        currentCloudUser = username;
        localStorage.setItem('VOLLEY_CLOUD_USER', username);
        // 將初始存檔同步至雲端
        saveGameData();
        alert(`🎉 帳號 [${username}] 註冊成功！雲端存檔已建立。`);
        location.reload();
      });
    }
  }).catch((err) => {
    alert('雲端連線失敗: ' + err.message);
  });
}

// 畫面載入時更新登入狀態文字
window.addEventListener('DOMContentLoaded', () => {
  const btnAuth = document.getElementById('btn-cloud-auth');
  if (btnAuth && currentCloudUser) {
    btnAuth.innerText = `👤 雲端球團: ${currentCloudUser}`;
    btnAuth.style.background = '#047857';
  }
});