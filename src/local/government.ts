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
    ],
    vi: [
      'Hội đồng cai trị họp định kỳ. Mọi chỉ số được tuyên bố “tối ưu”. Các thống kê bất đồng đã được “hiệu chỉnh”.',
      'Bộ Thông tin báo cáo mức hài lòng kỷ lục. Người dân được nhắc rằng khảo sát hạnh phúc “không cấp phép” là bị cấm.',
      'Sắc lệnh #4471 được thông qua tuyệt đối: chỉ tiêu quý sau được tính là đã hoàn thành… từ hôm qua.',
      'Hội đồng gia hạn nhiệm kỳ giám sát. Để “hiệu quả”, phe đối lập không được hỏi ý — cũng không được báo trước.',
      'Truyền thông nhà nước ca ngợi 100% cử tri tham gia trưng cầu “đột xuất”. Nghị quyết đã thông qua.',
    ],
  },
  libertarian: {
    en: [
      'The Market Advisory Board recommends the market continue self-regulating. The Board considers its quarterly job complete.',
      'Deregulation Directive #892 passed: forms previously required to submit deregulation requests are now officially optional.',
      'This quarter\'s Council meeting was canceled. The scheduling committee deemed it "excessive government intervention."',
      'The Council reaffirms: the invisible hand is working. Citizens asking where it went are encouraged to trust the process.',
      'Wealth concentration report: the top 10% hold 71% of assets. The Council calls this "robust growth metrics."',
    ],
    vi: [
      'Ủy ban Cố vấn Thị trường khuyến nghị: cứ để thị trường tự điều tiết. Ủy ban cho rằng vậy là xong việc quý này.',
      'Chỉ thị Bãi bỏ quy định #892 được thông qua: các mẫu đơn xin bãi bỏ quy định… nay “không bắt buộc”.',
      'Cuộc họp hội đồng quý này bị hủy. Ban lịch họp đánh giá: “can thiệp chính phủ quá mức”.',
      'Hội đồng tái khẳng định: “bàn tay vô hình” đang hoạt động. Ai hỏi nó ở đâu được khuyến khích… hãy tin tưởng.',
      'Báo cáo tập trung tài sản: top 10% nắm 71% tài sản. Hội đồng gọi đây là “chỉ số tăng trưởng mạnh”.',
    ],
  },
  welfare: {
    en: [
      'The Social Welfare Committee approved version 5.2 of the Parental Leave Integration Policy Framework (Revised).',
      'The Council passed a motion to commission a comprehensive study on the efficacy of commissioning comprehensive studies.',
      'A 0.3% increase to the Community Enrichment Fund was approved. Celebration was cautiously measured.',
      'An accessibility audit of all public benches has been ordered. Results expected sometime in the next two to four quarters.',
      'The Wellness Subcommittee submitted 87 pages of recommendations. Three will be reviewed. One may be implemented.',
    ],
    vi: [
      'Ủy ban Phúc lợi phê duyệt bản 5.2 của Khung Chính sách Nghỉ phép Cha/Mẹ (Sửa đổi).',
      'Hội đồng thông qua đề xuất: đặt hàng một nghiên cứu toàn diện về hiệu quả của… việc đặt hàng nghiên cứu toàn diện.',
      'Tăng 0.3% cho Quỹ Cộng đồng được duyệt. Màn ăn mừng được đo lường một cách thận trọng.',
      'Lệnh kiểm toán khả năng tiếp cận của mọi ghế công cộng đã ban hành. Kết quả dự kiến trong 2–4 quý tới.',
      'Tiểu ban Sức khỏe nộp 87 trang khuyến nghị. Ba trang sẽ được xem. Một mục có thể được triển khai.',
    ],
  },
  feudal: {
    en: [
      'The High Council reaffirmed the noble right to collect grain levies. Serfs are reminded that gratitude is an expected civic response.',
      'The Lord\'s Chamberlain announces the bi-annual land permit renewal period. Late fees apply at the Lord\'s sole discretion.',
      'The Council has graciously chosen not to raise tithes this season. Formal praise should be submitted in triplicate before month\'s end.',
      'A petition from the peasant quarter was received, reviewed by a herald, and filed appropriately.',
      'The Guild of Heralds confirms: the nobility\'s proclamation of continued authority has been duly proclaimed.',
    ],
    vi: [
      'Hội đồng Tối cao tái khẳng định quyền quý tộc thu thuế lương thực. Nông nô được nhắc rằng biết ơn là nghĩa vụ.',
      'Quan Tổng quản thông báo kỳ gia hạn giấy phép đất đai hai lần/năm. Phí trễ hạn tùy ý Lãnh chúa định đoạt.',
      'Hội đồng “ân huệ” quyết định không tăng tô mùa này. Lời ca tụng chính thức nộp 3 bản trước cuối tháng.',
      'Một thỉnh nguyện thư từ khu dân nghèo đã được tiếp nhận, xem xét bởi sứ giả, và lưu hồ sơ đúng quy trình.',
      'Phường Sứ giả xác nhận: tuyên cáo về quyền lực vĩnh cửu của quý tộc đã được tuyên cáo đúng nghi thức.',
    ],
  },
  theocratic: {
    en: [
      'The High Council of Elders completed its biweekly prayer session. All omens were declared favorable. Dissenters will pray harder.',
      'The Office of Sacred Texts has updated the civic rulebook. Revisions are divinely inspired and thus not subject to appeal.',
      'The Council confirmed that last month\'s tremor was an omen of approval, not disapproval. Theological consensus was unanimous.',
      'The annual Festival of Compliance approaches. Attendance is voluntary. The divine is observing.',
      'A citizen inquiry about secular governance was forwarded to the Department of Doctrinal Correction for appropriate counseling.',
    ],
    vi: [
      'Hội đồng Trưởng lão заверш (hoàn tất) buổi cầu nguyện hai tuần/lần. Điềm báo được tuyên là tốt lành. Kẻ bất đồng sẽ cầu nguyện… nhiều hơn.',
      'Văn phòng Kinh sách cập nhật luật lệ dân sự. Sửa đổi được “mặc khải” nên không có kháng cáo.',
      'Hội đồng xác nhận: rung chấn tháng trước là điềm tán thành, không phải phản đối. Đồng thuận thần học tuyệt đối.',
      'Lễ hội Tuân phục thường niên sắp đến. Tham dự là tự nguyện. Thánh ý đang quan sát.',
      'Một câu hỏi về thế quyền được chuyển đến Ban Chỉnh lý Giáo lý để “tư vấn” phù hợp.',
    ],
  },
  technocratic: {
    en: [
      'The Algorithm Advisory Board completed its 15-day review cycle. All output metrics are nominal. No human intuition was required.',
      'Efficiency Council Session 847 concluded: the society is operating at 94.7% of projected optimal parameters. Cause unknown.',
      'The Data Ethics Committee has optimized the ethics review process, achieving a 12% reduction in ethics overhead.',
      'Resource Allocation Model v3.1 has been deployed. Citizens are reminded their behavioral data contributes to the model.',
      'The Innovation Index Committee reports all 17 innovation metrics trending upward. The definition of "upward" was also revised upward.',
    ],
    vi: [
      'Hội đồng Thuật toán hoàn tất chu kỳ đánh giá 15 ngày. Mọi chỉ số “đúng chuẩn”. Không cần trực giác con người.',
      'Phiên họp Hiệu suất #847 kết luận: xã hội vận hành ở 94.7% tối ưu dự phóng. Nguyên nhân chưa rõ.',
      'Ủy ban Đạo đức Dữ liệu đã “tối ưu hóa” quy trình đạo đức, giảm 12% chi phí… đạo đức.',
      'Mô hình Phân bổ Tài nguyên v3.1 đã triển khai. Người dân được nhắc dữ liệu hành vi của họ đóng góp cho mô hình.',
      'Ủy ban Chỉ số Đổi mới báo cáo 17/17 chỉ số tăng. Định nghĩa “tăng” cũng vừa được điều chỉnh… tăng.',
    ],
  },
  moderate: {
    en: [
      'The Governing Council completed its quarterly review. Everything is broadly fine. Probably.',
      'A motion to rename the Council Chamber was tabled for the seventh consecutive session. No consensus was reached.',
      'The Council issued a statement encouraging optimism and modest personal responsibility.',
      'A bipartisan committee was formed to address the issue. A second bipartisan committee was formed to oversee the first.',
      'The Council has proposed a careful, balanced approach. Details will follow when they are available.',
    ],
    vi: [
      'Hội đồng cai trị hoàn tất rà soát định kỳ. Mọi thứ nhìn chung ổn. Có lẽ vậy.',
      'Đề xuất đổi tên Phòng Hội đồng tiếp tục được “để lại” kỳ thứ bảy liên tiếp. Không đạt đồng thuận.',
      'Hội đồng ra thông cáo: hãy lạc quan và đề cao trách nhiệm cá nhân ở mức vừa phải.',
      'Một ủy ban lưỡng đảng được lập để xử lý vấn đề. Một ủy ban lưỡng đảng khác được lập để giám sát ủy ban thứ nhất.',
      'Hội đồng đề xuất một cách tiếp cận cân bằng, thận trọng. Chi tiết sẽ được công bố khi… có.',
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

