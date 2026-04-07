import type { Lang } from '../i18n'
import { pick, type Localized } from './common'

export type RegimeType =
  | 'authoritarian'
  | 'libertarian'
  | 'welfare'
  | 'feudal'
  | 'theocratic'
  | 'technocratic'
  | 'moderate'

const ROUTINE_MESSAGES: Record<RegimeType, Localized<string[]>> = {
  authoritarian: {
    en: [
      'The Governing Council convened its quarterly session. All indicators were declared optimal. Dissenting statistics have been corrected.',
      'The Ministry of Information reports record public satisfaction. Citizens are reminded that unauthorized happiness surveys remain prohibited.',
      'Council Decree #4471 passed unanimously: next quarter\'s production quotas are hereby retroactively fulfilled ahead of schedule.',
      'The Council has renewed its oversight mandate. For efficiency, the opposition was not consulted — or notified.',
      'State media celebrates 100% voter participation in last night\'s unscheduled policy referendum. The motion passed.',
      'The Ministry of Truth has reviewed last year\'s records. Several events have been rescheduled to have occurred more favorably.',
      'Seven officials were promoted for exemplary loyalty. Their administrative records were not consulted.',
      'A citizen submitted a complaint. The complaint was investigated. The citizen has been re-educated.',
      'Public speeches without prior approval are now classified as “spontaneous unrest.” Permit forms are available at the Ministry of Order.',
      'The opposition party has dissolved itself — voluntarily. The Council commends their civic spirit.',
    ],
    vi: [
      'Hội đồng cai trị họp định kỳ. Mọi chỉ số được tuyên bố “tối ưu”. Các thống kê bất đồng đã được “hiệu chỉnh”.',
      'Bộ Thông tin báo cáo mức hài lòng kỷ lục. Người dân được nhắc rằng khảo sát hạnh phúc “không cấp phép” là bị cấm.',
      'Sắc lệnh #4471 được thông qua tuyệt đối: chỉ tiêu quý sau được tính là đã hoàn thành… từ hôm qua.',
      'Hội đồng gia hạn nhiệm kỳ giám sát. Để “hiệu quả”, phe đối lập không được hỏi ý — cũng không được báo trước.',
      'Truyền thông nhà nước ca ngợi 100% cử tri tham gia trưng cầu “đột xuất”. Nghị quyết đã thông qua.',
      'Bộ Sự Thật đã rà soát hồ sơ năm ngoái. Một số sự kiện đã được “lên lịch lại” để diễn ra thuận lợi hơn.',
      'Bảy quan chức được thăng chức vì lòng trung thành gương mẫu. Thành tích hành chính không được xem xét.',
      'Một công dân nộp đơn khiếu nại. Đơn đã được điều tra. Công dân đã được “giáo dục lại”.',
      'Phát biểu công khai không có phép nay xếp vào loại “bất ổn tự phát”. Mẫu đơn xin phép có tại Bộ Trật Tự.',
      'Đảng đối lập đã tự nguyện giải tán. Hội đồng khen ngợi tinh thần công dân của họ.',
    ],
  },
  libertarian: {
    en: [
      'The Market Advisory Board recommends the market continue self-regulating. The Board considers its quarterly job complete.',
      'Deregulation Directive #892 passed: forms previously required to submit deregulation requests are now officially optional.',
      'This quarter\'s Council meeting was canceled. The scheduling committee deemed it “excessive government intervention.”',
      'The Council reaffirms: the invisible hand is working. Citizens asking where it went are encouraged to trust the process.',
      'Wealth concentration report: the top 10% hold 71% of assets. The Council calls this “robust growth metrics.”',
      'The public water supply has been acquired by Aqua Holdings Ltd. Pricing will be market-determined. Thirst remains the consumer\'s problem.',
      'Worker safety regulations were found to be largely unnecessary. They have been removed to boost productivity.',
      'A monopoly has formed in the grain market. The Council notes this is simply the market rewarding excellence.',
      'The last public park has been converted to a private resort. A guest pass costs 40 coins. Poverty is not a valid objection.',
      'Three citizens filed for bankruptcy this week. The Council calls this “creative economic reallocation.”',
    ],
    vi: [
      'Ủy ban Cố vấn Thị trường khuyến nghị: cứ để thị trường tự điều tiết. Ủy ban cho rằng vậy là xong việc quý này.',
      'Chỉ thị Bãi bỏ quy định #892 được thông qua: các mẫu đơn xin bãi bỏ quy định… nay “không bắt buộc”.',
      'Cuộc họp hội đồng quý này bị hủy. Ban lịch họp đánh giá: “can thiệp chính phủ quá mức”.',
      'Hội đồng tái khẳng định: “bàn tay vô hình” đang hoạt động. Ai hỏi nó ở đâu được khuyến khích… hãy tin tưởng.',
      'Báo cáo tập trung tài sản: top 10% nắm 71% tài sản. Hội đồng gọi đây là “chỉ số tăng trưởng mạnh”.',
      'Nguồn cấp nước công cộng đã được Aqua Holdings mua lại. Giá do thị trường quyết định. Cơn khát là vấn đề của người tiêu dùng.',
      'Quy định an toàn lao động xem xét xong: hầu hết không cần thiết. Đã bãi bỏ để tăng năng suất.',
      'Độc quyền vừa hình thành trên thị trường lúa gạo. Hội đồng ghi nhận: thị trường đang thưởng công sự xuất sắc.',
      'Công viên công cộng cuối cùng chuyển thành khu nghỉ dưỡng tư nhân. Vé: 40 đồng. Nghèo không phải lý do hợp lệ.',
      'Ba công dân khai phá sản tuần này. Hội đồng gọi đây là “tái phân bổ kinh tế sáng tạo”.',
    ],
  },
  welfare: {
    en: [
      'The Social Welfare Committee approved version 5.2 of the Parental Leave Integration Policy Framework (Revised).',
      'The Council passed a motion to commission a comprehensive study on the efficacy of commissioning comprehensive studies.',
      'A 0.3% increase to the Community Enrichment Fund was approved. Celebration was cautiously measured.',
      'An accessibility audit of all public benches has been ordered. Results expected sometime in the next two to four quarters.',
      'The Wellness Subcommittee submitted 87 pages of recommendations. Three will be reviewed. One may be implemented.',
      'The Committee on Committee Oversight has submitted its preliminary report on the oversight of previous committees.',
      'A citizen survey found 72% of respondents wanted faster policy implementation. A task force will study the findings over two quarters.',
      'The Council approved a resolution affirming the dignity of all citizens. No resources were attached to the resolution.',
      'Universal basic housing has been proposed. A feasibility study is expected within eighteen months, pending a review of the study\'s scope.',
      'The Department of Equitable Outcomes will be merged with the Department of Inclusive Progress. A new department will oversee the merger.',
    ],
    vi: [
      'Ủy ban Phúc lợi phê duyệt bản 5.2 của Khung Chính sách Nghỉ phép Cha/Mẹ (Sửa đổi).',
      'Hội đồng thông qua đề xuất: đặt hàng một nghiên cứu toàn diện về hiệu quả của… việc đặt hàng nghiên cứu toàn diện.',
      'Tăng 0.3% cho Quỹ Cộng đồng được phê duyệt. Lễ ăn mừng được tổ chức hết sức dè dặt.',
      'Lệnh kiểm toán khả năng tiếp cận của mọi ghế công cộng đã ban hành. Kết quả dự kiến trong 2–4 quý tới.',
      'Tiểu ban Sức khỏe nộp 87 trang khuyến nghị. Ba trang sẽ được xem. Một mục có thể được triển khai.',
      'Ủy ban Giám sát Ủy ban đã nộp báo cáo sơ bộ về việc giám sát các ủy ban trước đó.',
      'Khảo sát cho thấy 72% người dân muốn chính sách nhanh hơn. Một nhóm công tác sẽ nghiên cứu kết quả trong 2 quý tới.',
      'Hội đồng thông qua nghị quyết khẳng định nhân phẩm mọi công dân. Không có nguồn lực đi kèm với nghị quyết.',
      'Nhà ở cơ bản toàn dân được đề xuất. Nghiên cứu khả thi dự kiến trong 18 tháng, chờ xem xét phạm vi nghiên cứu.',
      'Bộ Kết quả Bình đẳng hợp nhất với Bộ Tiến bộ Toàn diện. Một bộ mới sẽ giám sát quá trình hợp nhất.',
    ],
  },
  feudal: {
    en: [
      'The High Council reaffirmed the noble right to collect grain levies. Serfs are reminded that gratitude is an expected civic response.',
      'The Lord\'s Chamberlain announces the bi-annual land permit renewal period. Late fees apply at the Lord\'s sole discretion.',
      'The Council has graciously chosen not to raise tithes this season. Formal praise should be submitted in triplicate before month\'s end.',
      'A petition from the peasant quarter was received, reviewed by a herald, and filed appropriately.',
      'The Guild of Heralds confirms: the nobility\'s proclamation of continued authority has been duly proclaimed.',
      'The Lord\'s hunting party passed through three villages yesterday. Any damage incurred is considered a privilege to witness.',
      'The grain levy has been raised by 12%. Serfs unable to pay may offer labor in lieu. Or their children.',
      'A serf who met the Lord\'s gaze without permission has been fined. His family was also fined for the embarrassment caused.',
      'The Lord\'s court has ruled the river belongs to the nobility. Fish caught without a permit constitute theft. Punishment: confiscation of the offending hands.',
      'The census is complete. The Lord now has an accurate count of all serfs, livestock, and grain — in that order of importance.',
    ],
    vi: [
      'Hội đồng Tối cao tái khẳng định quyền quý tộc thu thuế lương thực. Nông nô được nhắc rằng biết ơn là nghĩa vụ.',
      'Quan Tổng quản thông báo kỳ gia hạn giấy phép đất đai hai lần/năm. Phí trễ hạn tùy ý Lãnh chúa định đoạt.',
      'Hội đồng “ân huệ” quyết định không tăng tô mùa này. Lời ca tụng chính thức nộp 3 bản trước cuối tháng.',
      'Một thỉnh nguyện thư từ khu dân nghèo đã được tiếp nhận, xem xét bởi sứ giả, và lưu hồ sơ đúng quy trình.',
      'Phường Sứ giả xác nhận: tuyên cáo về quyền lực vĩnh cửu của quý tộc đã được tuyên cáo đúng nghi thức.',
      'Đoàn đi săn của Lãnh chúa qua ba ngôi làng hôm qua. Thiệt hại nếu có được xem là đặc ân được chứng kiến.',
      'Thuế lúa tăng 12%. Nông nô không đủ khả năng có thể nộp bằng sức lao động. Hoặc bằng con cái.',
      'Một nông nô nhìn vào mắt Lãnh chúa mà chưa được phép đã bị phạt. Gia đình anh ta cũng bị phạt vì tội gây xấu hổ.',
      'Tòa án của Lãnh chúa phán quyết: con sông thuộc về quý tộc. Cá bắt không phép là trộm cắp. Hình phạt: tịch thu đôi bàn tay vi phạm.',
      'Điều tra dân số hoàn tất. Lãnh chúa nay biết chính xác số nông nô, gia súc và lúa gạo — theo thứ tự quan trọng đó.',
    ],
  },
  theocratic: {
    en: [
      'The High Council of Elders completed its biweekly prayer session. All omens were declared favorable. Dissenters will pray harder.',
      'The Office of Sacred Texts has updated the civic rulebook. Revisions are divinely inspired and thus not subject to appeal.',
      'The Council confirmed that last month\'s tremor was an omen of approval, not disapproval. Theological consensus was unanimous.',
      'The annual Festival of Compliance approaches. Attendance is voluntary. The divine is observing.',
      'A citizen inquiry about secular governance was forwarded to the Department of Doctrinal Correction for appropriate counseling.',
      'A new sin has been identified. Citizens are reminded that ignorance of new sins is no defense against divine judgment.',
      'The Celestial Calendar has been revised. Three days are now mandatory fast days. The announcement was made after breakfast.',
      'The High Priest\'s recovery from illness has been declared a miracle. The physician who treated him has been asked not to speak of the methods used.',
      'A book containing unauthorized ideas was found and burned. The reader is undergoing theological counseling.',
      'The annual Inquisition Lottery will be held next week. Participation is considered an honor. Non-participants will be noted.',
    ],
    vi: [
      'Hội đồng Trưởng lão hoàn tất buổi cầu nguyện định kỳ hai tuần một lần. Điềm báo được tuyên là tốt lành. Kẻ bất đồng sẽ cầu nguyện… chăm chỉ hơn.',
      'Văn phòng Kinh sách cập nhật luật lệ dân sự. Sửa đổi được “mặc khải” nên không có kháng cáo.',
      'Hội đồng xác nhận: rung chấn tháng trước là điềm tán thành, không phải phản đối. Đồng thuận thần học tuyệt đối.',
      'Lễ hội Tuân phục thường niên sắp đến. Tham dự là tự nguyện. Thánh ý đang quan sát.',
      'Một câu hỏi về thế quyền được chuyển đến Ban Chỉnh lý Giáo lý để “tư vấn” phù hợp.',
      'Một tội lỗi mới đã được nhận diện. Người dân được nhắc: không biết đến tội lỗi mới không phải lý do miễn phán xét thiêng liêng.',
      'Lịch Thiên Quốc đã được sửa đổi. Ba ngày nay là ngày ăn chay bắt buộc. Thông báo được đưa ra sau bữa sáng.',
      'Bệnh tình của Thánh Trưởng được tuyên là thử thách tâm linh. Thầy thuốc chữa khỏi được yêu cầu không tiết lộ phương pháp.',
      'Một cuốn sách chứa tư tưởng bị cấm đã bị tìm thấy và thiêu hủy. Người đọc đang trải qua “tư vấn thần học”.',
      'Xổ số Thẩm Vấn thường niên diễn ra tuần tới. Tham gia là vinh dự. Những ai vắng mặt sẽ bị ghi nhận.',
    ],
  },
  technocratic: {
    en: [
      'The Algorithm Advisory Board completed its 15-day review cycle. All output metrics are nominal. No human intuition was required.',
      'Efficiency Council Session 847 concluded: the society is operating at 94.7% of projected optimal parameters. Cause unknown.',
      'The Data Ethics Committee has optimized the ethics review process, achieving a 12% reduction in ethics overhead.',
      'Resource Allocation Model v3.1 has been deployed. Citizens are reminded their behavioral data contributes to the model.',
      'The Innovation Index Committee reports all 17 innovation metrics trending upward. The definition of “upward” was also revised upward.',
      'Predictive compliance modeling has flagged 7 citizens for pre-emptive intervention. Model confidence: 73%. Intervention proceeds regardless.',
      'Citizen satisfaction surveys have been discontinued. The model already knows how citizens feel. Confidence: 91%.',
      'The behavioral nudge system has been upgraded to version 6.2. Compliance rates improved by 2.1%. Citizens were not informed.',
      'A citizen questioned the algorithm\'s recommendation. The citizen\'s social score was adjusted. The recommendation was implemented unchanged.',
      'Citizens below the productivity index threshold have been flagged for efficiency retraining. Participation is required. Duration is model-determined.',
    ],
    vi: [
      'Hội đồng Thuật toán hoàn tất chu kỳ đánh giá 15 ngày. Mọi chỉ số “đúng chuẩn”. Không cần trực giác con người.',
      'Phiên họp Hiệu suất #847 kết luận: xã hội vận hành ở 94.7% tối ưu dự phóng. Nguyên nhân chưa rõ.',
      'Ủy ban Đạo đức Dữ liệu đã “tối ưu hóa” quy trình đạo đức, giảm 12% chi phí… đạo đức.',
      'Mô hình Phân bổ Tài nguyên v3.1 đã triển khai. Người dân được nhắc dữ liệu hành vi của họ đóng góp cho mô hình.',
      'Ủy ban Chỉ số Đổi mới báo cáo 17/17 chỉ số tăng. Định nghĩa “tăng” cũng vừa được điều chỉnh… tăng.',
      'Mô hình dự báo tuân thủ gắn cờ 7 công dân để can thiệp phòng ngừa. Độ tin cậy: 73%. Can thiệp vẫn tiến hành.',
      'Khảo sát mức độ hài lòng dân chúng đã bãi bỏ. Mô hình đã biết người dân cảm thấy thế nào. Độ tin cậy: 91%.',
      'Hệ thống “điều chỉnh hành vi” nâng cấp lên phiên bản 6.2. Tỉ lệ tuân thủ tăng 2.1%. Người dân không được thông báo.',
      'Một công dân đặt câu hỏi về khuyến nghị của thuật toán. Điểm xã hội của họ bị điều chỉnh. Khuyến nghị vẫn giữ nguyên.',
      'Công dân dưới ngưỡng chỉ số năng suất bị đánh dấu tham gia “đào tạo lại hiệu quả”. Bắt buộc. Thời gian do mô hình quyết định.',
    ],
  },
  moderate: {
    en: [
      'The Governing Council completed its quarterly review. Everything is broadly fine. Probably.',
      'A motion to rename the Council Chamber was tabled for the seventh consecutive session. No consensus was reached.',
      'The Council issued a statement encouraging optimism and modest personal responsibility.',
      'A bipartisan committee was formed to address the issue. A second bipartisan committee was formed to oversee the first.',
      'The Council has proposed a careful, balanced approach. Details will follow when they are available.',
      'A constructive dialogue was convened. Both sides made valid points. The dialogue will continue next quarter.',
      'The Council released a position statement acknowledging the complexity of the issue. No position was taken.',
      'Reform proposals are under evaluation. The evaluation process itself is also under evaluation. A timeline is forthcoming.',
      'A new working group has been formed to synthesize findings from all previous working groups dating back five years.',
      'Public trust in the Council is described as “stable.” The stability of that stability is currently being assessed.',
    ],
    vi: [
      'Hội đồng cai trị hoàn tất rà soát định kỳ. Mọi thứ nhìn chung ổn. Có lẽ vậy.',
      'Đề xuất đổi tên Phòng Hội đồng tiếp tục được “để lại” kỳ thứ bảy liên tiếp. Không đạt đồng thuận.',
      'Hội đồng ra thông cáo: hãy lạc quan và đề cao trách nhiệm cá nhân ở mức vừa phải.',
      'Một ủy ban lưỡng đảng được lập để xử lý vấn đề. Một ủy ban lưỡng đảng khác được lập để giám sát ủy ban thứ nhất.',
      'Hội đồng đề xuất một cách tiếp cận cân bằng, thận trọng. Chi tiết sẽ được công bố khi… có.',
      'Một cuộc đối thoại xây dựng đã được tổ chức. Cả hai phía đều có điểm hợp lý. Đối thoại sẽ tiếp tục vào quý sau.',
      'Hội đồng ra tuyên bố thừa nhận tính phức tạp của vấn đề. Không đưa ra lập trường cụ thể.',
      'Các đề xuất cải cách đang được đánh giá. Bản thân quy trình đánh giá cũng đang được đánh giá. Lịch trình sẽ được công bố.',
      'Một nhóm công tác mới được lập để tổng hợp kết quả từ mọi nhóm công tác trước đó trong năm năm qua.',
      'Niềm tin của dân chúng vào Hội đồng được mô tả là “ổn định”. Tính ổn định của sự ổn định đó hiện đang được đánh giá.',
    ],
  },
}

export function pickRoutineMessage(lang: Lang, regime: RegimeType): string {
  const pool = pick(lang, ROUTINE_MESSAGES[regime])
  return pool[Math.floor(Math.random() * pool.length)]
}

export function noAlertsSummaryLine(lang: Lang): string {
  return lang === 'vi'
    ? '• Không có cảnh báo nghiêm trọng — mọi chỉ số vẫn trong ngưỡng chấp nhận.'
    : '• No critical alerts — all indicators within acceptable range.'
}

export function describeAlert(lang: Lang, kind: 'food' | 'stability' | 'trust' | 'pressure' | 'resources', level: 'critical' | 'warning', pct: number): string {
  const p = Math.round(pct)
  if (lang === 'vi') {
    if (kind === 'food') return level === 'critical' ? `lương thực cực kỳ thiếu (${p}%)` : `lương thực thấp (${p}%)`
    if (kind === 'stability') return level === 'critical' ? `ổn định xã hội ở mức nguy hiểm (${p}%)` : `ổn định đang suy giảm (${p}%)`
    if (kind === 'trust') return level === 'critical' ? `niềm tin vào chính quyền ở mức khủng hoảng (${p}%)` : `niềm tin vào chính quyền suy giảm (${p}%)`
    if (kind === 'pressure') return level === 'critical' ? `bất ổn dân sự ở mức báo động (${p}%)` : `áp lực chính trị gia tăng (${p}%)`
    return level === 'critical' ? `tài nguyên thiên nhiên cạn kiệt nghiêm trọng (${p}%)` : `tài nguyên thiên nhiên suy giảm (${p}%)`
  }
  if (kind === 'food') return level === 'critical' ? `food supply critically low (${p}%)` : `food supply low (${p}%)`
  if (kind === 'stability') return level === 'critical' ? `societal stability dangerously low (${p}%)` : `stability declining (${p}%)`
  if (kind === 'trust') return level === 'critical' ? `trust in government at crisis level (${p}%)` : `government trust declining (${p}%)`
  if (kind === 'pressure') return level === 'critical' ? `civil unrest at critical level (${p}%)` : `political pressure rising (${p}%)`
  return level === 'critical' ? `natural resources critically depleted (${p}%)` : `natural resources depleting (${p}%)`
}

