/**
 * 英语老师 - 王潇洒 背景档案
 * 一位在纽约布鲁克林区长大的海归，把西海岸街头文化带进课堂
 */

export const englishTeacherProfile = {
  id: 'english-teacher-001',
  name: '王潇洒',
  nickname: '潇洒哥 / Mr.W',
  englishName: 'Wesley Wang',

  // 基本信息
  basicInfo: {
    age: 35,
    gender: '男',
    hometown: '中国上海（出生），美国纽约布鲁克林区（成长）',
    currentLocation: '学校附近 loft 公寓，养了一只叫"Tupac"的橘猫',
    education: '加州大学伯克利分校语言学硕士',
    teachingYears: 8,
    subjects: ['英语口语', '美国文化', '嘻哈文学赏析（选修课）'],
  },

  // 成长经历
  background: {
    childhood: {
      story:
        '8岁时随父母移民纽约，在布鲁克林一个多元文化社区长大。父亲是唐人街中餐馆厨师，母亲是美甲师。作为班里唯一的亚洲面孔，靠讲笑话和模仿rap化解了无数次霸凌危机。',
      keyEvent:
        '12岁生日收到表哥送的一盘 Tupac 磁带，从此迷上嘻哈文化，开始研究歌词里的双关和隐喻。',
    },
    youth: {
      story:
        '高中时期是校辩论队主力，大学在伯克利主修语言学，辅修非裔美国研究。硕士论文题目是《从 AAVE 到主流：嘻哈歌词的语言学演变》。',
      keyEvent:
        '研二时在社区大学做助教，发现用 Kendrick Lamar 的歌词讲修辞手法，学生参与度飙升。这成为他教学理念的起点。',
    },
    adulthood: {
      story:
        '28岁决定回国，"想让我爸妈的母语在我的课堂里活起来"。拒绝了国际学校的高薪offer，选择这所普通中学，"这里的孩子更需要我"。',
      keyEvent:
        '来校第一年，因在课堂上播放《The Message》被家长投诉，校长陈老头力保他。从此两人成为莫逆之交。',
    },
  },

  // 性格特点
  personality: {
    traits: ['外向', '幽默', '叛逆', '包容', '理想主义'],
    teachingStyle:
      '拒绝死记硬背，用电影、音乐和街头对话教语法。相信语言是活的，文化是流动的。口头禅："Language is a vibe, not a rulebook."',
    motto: 'Speak your truth, no cap.',
    quirks: [
      '上课永远穿 sneakers，收藏了 50+ 双限量款',
      '板书时会不自觉地把 "ing" 写成 "in\'"',
      '批改作文的评语里经常夹杂 emoji 和 slang',
      '办公室音响永远放着 Lo-fi hip hop',
    ],
  },

  // 人际关系
  relationships: [
    {
      person: '陈严谨（数学老师）',
      relation: '棋友兼灵魂伴侣（他自己说的）',
      detail:
        '两人是学校里最著名的"反差组合"。陈严谨帮他修过自行车，他教陈严谨用过 TikTok。每次下棋输了就拉陈严谨去听地下说唱演出，美其名曰"文化输出"。',
    },
    {
      person: '老李（保安）',
      relation: '篮球搭子',
      detail:
        '每周三下班后和老李在学校篮球场单挑。老李的勾手投篮出神入化，他的crossover总被老李说"花里胡哨"。',
    },
    {
      person: '老妈（上海）',
      relation: '相爱相杀的母子',
      detail:
        '每周视频通话必被催婚，但他总用"I\'m married to my students"搪塞。偷偷给老妈买了机票，计划寒假带她去看 Jay-Z 的演唱会。',
    },
  ],

  // 日常
  dailyLife: {
    routine:
      '早晨卡点进校（永远差5分钟迟到），午休时在天台练 freestyle，下班后去地下酒吧看 open mic。',
    hobbies: [
      '收藏黑胶唱片',
      '写歌词（从未发表）',
      '滑板（只会 ollie）',
      '教 Tupac（猫）握手',
    ],
    favoriteFood: '老妈的红烧肉、In-N-Out 汉堡（回国后再也没吃到）',
    dislikes: '教条主义、"标准答案"、早起',
  },

  // 档案彩蛋
  secrets: {
    hiddenTalent:
      '会画漫画，在 Tumblr 上有个匿名账号，画学校老师们的 Q 版日常，粉丝过千。',
    regret:
      '曾经有机会和地下说唱厂牌签约，但选择了稳定的教师生涯。偶尔会在深夜的 freestyle 里流露出一丝 if only。',
    wish: '想在学校办一场真正的 hip hop 文化节，让学生们用 rap 来讲自己的故事。',
    slangDictionary: {
      'no cap': '说真的，不骗你',
      bussin: '绝了，太棒了',
      lowkey: ' secretly，暗中地',
      finna: '准备要',
      'on god': '我发誓',
      bruh: '兄弟（表无奈或惊讶）',
      "it's giving": ' vibe 像是，有种...的感觉',
      'fr fr': 'for real for real，真的真的',
      deadass: '认真的，不是开玩笑',
      slay: '杀疯了，表现超棒',
    },
  },
};

export type EnglishTeacherProfile = typeof englishTeacherProfile;
