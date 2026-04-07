import type { Lang } from '../i18n'
import { pick } from './common'

const zoneText = (z: string) => z.replace(/_/g, ' ')

export const NT = {
  ragsToRiches: (lang: Lang, name: string, occupation: string) =>
    pick(lang, {
      en: `${name}, once struggling to survive, has risen to comfort — wealth amassed through relentless ${occupation.toLowerCase()} work.`,
      vi: `${name}, từng chật vật để sống sót, nay đã vươn lên sung túc — của cải tích lũy nhờ lao động bền bỉ trong nghề ${occupation.toLowerCase()}.`,
    }),
  fallFromGrace: (lang: Lang, name: string, occupation: string) =>
    pick(lang, {
      en: `${name} (${occupation}) has fallen from prosperity into poverty — debts, misfortune, or both have claimed their fortune.`,
      vi: `${name} (${occupation}) đã rơi từ sung túc xuống nghèo khó — nợ nần, vận rủi, hoặc cả hai đã cuốn đi gia sản.`,
    }),
  widowTragedy: (lang: Lang, name: string, childCount: number) =>
    pick(lang, {
      en: `${name} has lost their spouse and now raises ${childCount} ${childCount === 1 ? 'child' : 'children'} alone — grief and duty woven together.`,
      vi: `${name} đã mất người bạn đời và giờ một mình nuôi ${childCount} con — nỗi đau và trách nhiệm đan xen.`,
    }),
  scholarDebate: (lang: Lang, a: string, b: string, zone: string, topic: string) =>
    pick(lang, {
      en: `${a} and ${b} engaged in a heated public debate in the ${zoneText(zone)} on ${topic}.`,
      vi: `${a} và ${b} đã có một cuộc tranh luận gay gắt tại ${zoneText(zone)} về ${topic}.`,
    }),
  forbiddenFriendship: (lang: Lang, guard: string, criminal: string, occupation: string) =>
    pick(lang, {
      en: `${guard} (Guard) and ${criminal} (${occupation}) share a rare bond — an unlikely friendship that defies their circumstances.`,
      vi: `${guard} (Vệ binh) và ${criminal} (${occupation}) có một mối gắn kết hiếm có — tình bạn khó tin vượt qua hoàn cảnh đối nghịch.`,
    }),
  loneElder: (lang: Lang, name: string, age: number) =>
    pick(lang, {
      en: `${name}, now ${age} years old, is the last of the elders — a living memory of this society's earliest days.`,
      vi: `${name}, nay đã ${age} tuổi, là bậc cao niên cuối cùng — ký ức sống của những ngày đầu xã hội này.`,
    }),
  crisisHero: (lang: Lang, name: string, occupation: string) =>
    pick(lang, {
      en: `${name} (${occupation}) stood firm while others fled — unafraid in the face of crisis, a rallying presence for those nearby.`,
      vi: `${name} (${occupation}) đứng vững khi người khác bỏ chạy — không nao núng trước khủng hoảng, trở thành điểm tựa cho người xung quanh.`,
    }),
  silentConversion: (lang: Lang, name: string, shift: string) =>
    pick(lang, {
      en: `${name} has been seen questioning long-held beliefs — quietly drifting toward ${shift} in the privacy of their thoughts.`,
      vi: `${name} được thấy đang nghi ngờ những niềm tin cũ — âm thầm dịch chuyển về phía ${shift} trong suy nghĩ riêng.`,
    }),
  midnightLaborer: (lang: Lang, name: string) =>
    pick(lang, {
      en: `${name} has not slept in days — visible exhaustion carved into their face — yet still they work through the dark hours.`,
      vi: `${name} đã nhiều ngày không ngủ — kiệt sức hằn rõ trên gương mặt — vậy mà vẫn tiếp tục làm việc suốt đêm.`,
    }),
  reformedCriminal: (lang: Lang, name: string) =>
    pick(lang, {
      en: `${name}, once a criminal whose name was spoken with fear, now walks a different path — content, grounded, and quietly accepted by the community.`,
      vi: `${name}, từng là tội phạm bị nhắc đến bằng nỗi sợ, nay đã chọn con đường khác — bình ổn, vững vàng và dần được cộng đồng chấp nhận.`,
    }),
  forgotten: (lang: Lang, name: string, occupation: string, age: number, zone: string) =>
    pick(lang, {
      en: `${name} (${occupation}, ${age}) moves through the ${zoneText(zone)} unseen — no friends, no community, a ghost among the living.`,
      vi: `${name} (${occupation}, ${age}) lặng lẽ đi qua ${zoneText(zone)} như vô hình — không bạn bè, không cộng đồng, một cái bóng giữa người sống.`,
    }),
  merchantEmpire: (lang: Lang, name: string, wealth: number, zone: string) =>
    pick(lang, {
      en: `${name} has amassed a fortune of ${Math.round(wealth).toLocaleString()} — the wealthiest merchant in living memory, whose shadow stretches across the ${zoneText(zone)}.`,
      vi: `${name} đã tích lũy khối tài sản ${Math.round(wealth).toLocaleString()} — thương nhân giàu nhất trong ký ức còn sống, cái bóng bao trùm ${zoneText(zone)}.`,
    }),
  massExodus: (lang: Lang, zone: string, count: number) =>
    pick(lang, {
      en: `The ${zoneText(zone)} has emptied — ${count} terrified citizens have abandoned their homes and fled into the streets.`,
      vi: `${zoneText(zone)} đã gần như trống rỗng — ${count} cư dân hoảng loạn bỏ nhà bỏ cửa tháo chạy ra đường.`,
    }),
  goodTimes: (lang: Lang, zone: string) =>
    pick(lang, {
      en: `A rare peace has settled over the ${zoneText(zone)} — food is plentiful, stability holds, and laughter can be heard in the streets.`,
      vi: `Một khoảng bình yên hiếm hoi phủ lên ${zoneText(zone)} — lương thực dồi dào, trật tự vững, tiếng cười lại vang trên phố.`,
    }),
  factionPower: (lang: Lang, name: string, count: number, value: string) =>
    pick(lang, {
      en: `"${name}" now counts ${count} members — the largest political force this society has yet seen, united around ${value} values.`,
      vi: `"${name}" hiện có ${count} thành viên — lực lượng chính trị lớn nhất xã hội từng chứng kiến, gắn kết quanh các giá trị ${value}.`,
    }),
  veteranGuard: (lang: Lang, name: string, age: number, zone: string) =>
    pick(lang, {
      en: `${name}, ${age} years old, still patrols the ${zoneText(zone)} — a fixture of law and order that long predates the current troubles.`,
      vi: `${name}, ${age} tuổi, vẫn tuần tra tại ${zoneText(zone)} — biểu tượng của kỷ cương đã tồn tại từ trước cả những biến động hiện nay.`,
    }),
  techAnticipation: (lang: Lang, name: string) =>
    pick(lang, {
      en: `${name} and colleagues are on the verge of a breakthrough — their research journals increasingly filled with promising findings.`,
      vi: `${name} và đồng sự đang ở rất gần một đột phá — sổ tay nghiên cứu ngày càng dày lên với những phát hiện đầy hứa hẹn.`,
    }),
  legendaryAlive: (lang: Lang, name: string, occupation: string, age: number, reason: string) =>
    pick(lang, {
      en: `⭐ ${name} (${occupation}, ${age}) remains a towering figure — revered for ${reason}.`,
      vi: `⭐ ${name} (${occupation}, ${age}) vẫn là một tượng đài — được kính trọng vì ${reason}.`,
    }),
  rumor: {
    govCorruption: (lang: Lang, zone: string) =>
      pick(lang, {
        en: `Whispers in the ${zoneText(zone)}: officials are pocketing public funds while citizens starve.`,
        vi: `Lời đồn ở ${zoneText(zone)}: quan chức đang biển thủ công quỹ trong khi dân chúng đói khổ.`,
      }),
    legendTale: (lang: Lang, name: string) =>
      pick(lang, {
        en: `Tales of ${name}'s deeds grow grander with each retelling — some say they have never slept, never faltered.`,
        vi: `Những câu chuyện về chiến tích của ${name} ngày càng được thêu dệt — có người nói họ chưa từng ngủ, chưa từng chùn bước.`,
      }),
    hiddenFamine: (lang: Lang) =>
      pick(lang, {
        en: 'Word spreads that the granaries hold far less than the leaders admit — a hidden famine behind closed doors.',
        vi: 'Tin lan ra rằng kho lương thực ít hơn nhiều so với công bố — một nạn đói âm thầm sau những cánh cửa đóng kín.',
      }),
    richHoarding: (lang: Lang) =>
      pick(lang, {
        en: 'They say the wealthy have built hidden cellars full of hoarded gold while the poor go hungry in plain sight.',
        vi: 'Người ta đồn rằng giới giàu có xây hầm bí mật để tích trữ vàng, trong khi người nghèo đói ngay giữa chốn đông người.',
      }),
    epidemicHidden: (lang: Lang) =>
      pick(lang, {
        en: 'Rumor has it the sick are far more numerous than reported — the true count hidden to prevent panic.',
        vi: 'Tin đồn nói số người bệnh nhiều hơn công bố rất nhiều — con số thật bị che giấu để tránh hoảng loạn.',
      }),
    blackMarket: (lang: Lang) =>
      pick(lang, {
        en: 'There is talk of a hidden market where goods change hands without the state\'s knowledge — some call it salvation, others call it treason.',
        vi: 'Có lời đồn về một chợ ngầm nơi hàng hóa trao tay ngoài tầm mắt nhà nước — người gọi đó là cứu tinh, kẻ gọi là phản loạn.',
      }),
    factionPlot: (lang: Lang, name: string) =>
      pick(lang, {
        en: `"${name}" is said to be planning something far more drastic than public organizing — the details remain carefully guarded.`,
        vi: `"${name}" được cho là đang chuẩn bị điều gì đó quyết liệt hơn cả biểu tình công khai — chi tiết vẫn bị giữ kín.`,
      }),
  },
  milestone: {
    pop600: (lang: Lang) => pick(lang, { en: 'Population reached 600 citizens.', vi: 'Dân số đã đạt mốc 600 công dân.' }),
    pop700: (lang: Lang) => pick(lang, { en: 'Population surged past 700 citizens.', vi: 'Dân số đã tăng vọt qua mốc 700 công dân.' }),
    pop800: (lang: Lang) => pick(lang, { en: 'A prosperous society of 800 citizens.', vi: 'Một xã hội thịnh vượng với 800 công dân.' }),
    firstFaction: (lang: Lang, name: string) => pick(lang, { en: `First political faction formed: "${name}".`, vi: `Phe phái chính trị đầu tiên được thành lập: "${name}".` }),
    firstDiscovery: (lang: Lang, name: string, researcher: string) => pick(lang, { en: `First discovery: ${name} — by ${researcher}.`, vi: `Khám phá đầu tiên: ${name} — do ${researcher} thực hiện.` }),
    firstLegend: (lang: Lang, name: string) => pick(lang, { en: `${name} became the first legendary figure.`, vi: `${name} trở thành nhân vật huyền thoại đầu tiên.` }),
    firstReferendum: (lang: Lang) => pick(lang, { en: 'The first constitutional referendum was called.', vi: 'Cuộc trưng cầu dân ý hiến pháp đầu tiên đã được tiến hành.' }),
    famine: (lang: Lang, year: number) => pick(lang, { en: `Year ${year}: The Great Famine — food stores almost completely exhausted.`, vi: `Năm ${year}: Đại nạn đói — kho lương thực gần như cạn kiệt hoàn toàn.` }),
    inequality: (lang: Lang, year: number, gini: number) => pick(lang, { en: `Year ${year}: Inequality peaked at Gini ${gini.toFixed(2)} — the worst divide in this society's history.`, vi: `Năm ${year}: Bất bình đẳng đạt đỉnh Gini ${gini.toFixed(2)} — chia rẽ sâu sắc nhất trong lịch sử xã hội này.` }),
    trustCollapse: (lang: Lang, year: number, trust: number) => pick(lang, { en: `Year ${year}: Trust in government collapsed to ${Math.round(trust)}% — a moment of profound crisis.`, vi: `Năm ${year}: Niềm tin vào chính quyền sụp xuống ${Math.round(trust)}% — một thời khắc khủng hoảng sâu sắc.` }),
    nearCollapse: (lang: Lang, year: number) => pick(lang, { en: `Year ${year}: Society teetered on the edge of complete collapse.`, vi: `Năm ${year}: Xã hội chao đảo bên bờ sụp đổ hoàn toàn.` }),
    researchProgress: (lang: Lang) => pick(lang, { en: 'Scholars have accumulated over 1,200 research points — a breakthrough looms.', vi: 'Các học giả đã tích lũy hơn 1.200 điểm nghiên cứu — một đột phá đang đến gần.' }),
  },
}

