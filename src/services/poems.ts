/**
 * 首页问候诗句：全部为已过版权保护期的古典句。
 * 按本地日期哈希，当天稳定，避免切页乱跳。
 */

export interface Poem {
  text: string
  from: string
}

export const POEMS: Poem[] = [
  { text: '行到水穷处，坐看云起时', from: '王维《终南别业》' },
  { text: '空山新雨后，天气晚来秋', from: '王维《山居秋暝》' },
  { text: '明月松间照，清泉石上流', from: '王维《山居秋暝》' },
  { text: '江流天地外，山色有无中', from: '王维《汉江临眺》' },
  { text: '大漠孤烟直，长河落日圆', from: '王维《使至塞上》' },
  { text: '采菊东篱下，悠然见南山', from: '陶渊明《饮酒》' },
  { text: '此中有真意，欲辨已忘言', from: '陶渊明《饮酒》' },
  { text: '众鸟高飞尽，孤云独去闲', from: '李白《独坐敬亭山》' },
  { text: '相看两不厌，只有敬亭山', from: '李白《独坐敬亭山》' },
  { text: '海上生明月，天涯共此时', from: '张九龄《望月怀远》' },
  { text: '春眠不觉晓，处处闻啼鸟', from: '孟浩然《春晓》' },
  { text: '野旷天低树，江清月近人', from: '孟浩然《宿建德江》' },
  { text: '会当凌绝顶，一览众山小', from: '杜甫《望岳》' },
  { text: '星垂平野阔，月涌大江流', from: '杜甫《旅夜书怀》' },
  { text: '随风潜入夜，润物细无声', from: '杜甫《春夜喜雨》' },
  { text: '湖光秋月两相和，潭面无风镜未磨', from: '刘禹锡《望洞庭》' },
  { text: '沉舟侧畔千帆过，病树前头万木春', from: '刘禹锡《酬乐天扬州初逢席上见赠》' },
  { text: '春风又绿江南岸，明月何时照我还', from: '王安石《泊船瓜洲》' },
  { text: '不畏浮云遮望眼，自缘身在最高层', from: '王安石《登飞来峰》' },
  { text: '竹外桃花三两枝，春江水暖鸭先知', from: '苏轼《惠崇春江晚景》' },
  { text: '欲把西湖比西子，淡妆浓抹总相宜', from: '苏轼《饮湖上初晴后雨》' },
  { text: '谁道人生无再少，门前流水尚能西', from: '苏轼《浣溪沙》' },
  { text: '我见青山多妩媚，料青山见我应如是', from: '辛弃疾《贺新郎》' },
  { text: '众里寻他千百度，蓦然回首，那人却在，灯火阑珊处', from: '辛弃疾《青玉案》' },
  { text: '山重水复疑无路，柳暗花明又一村', from: '陆游《游山西村》' },
  { text: '小楼一夜听春雨，深巷明朝卖杏花', from: '陆游《临安春雨初霁》' },
  { text: '落红不是无情物，化作春泥更护花', from: '龚自珍《己亥杂诗》' },
  { text: '昨夜闲潭梦落花，可怜春半不还家', from: '张若虚《春江花月夜》' },
  { text: '江畔何人初见月，江月何年初照人', from: '张若虚《春江花月夜》' },
  { text: '画栋朝飞南浦云，珠帘暮卷西山雨', from: '王勃《滕王阁诗》' },
  { text: '晴空一鹤排云上，便引诗情到碧霄', from: '刘禹锡《秋词》' },
  { text: '千山鸟飞绝，万径人踪灭', from: '柳宗元《江雪》' },
]

function dayKey(ts: number): number {
  const d = new Date(ts)
  return d.getFullYear() * 10_000 + (d.getMonth() + 1) * 100 + d.getDate()
}

export function poemForDay(ts = Date.now()): Poem {
  const key = dayKey(ts)
  const idx = ((key % POEMS.length) + POEMS.length) % POEMS.length
  return POEMS[idx] ?? POEMS[0]!
}
