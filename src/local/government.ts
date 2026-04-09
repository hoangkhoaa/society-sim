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

// ── Fallback policy text (localized) ─────────────────────────────────────────

export interface PolicyTemplate {
  policy_name: string
  description: string
  public_statement: string
}

const FALLBACK_POLICIES: Record<string, Localized<PolicyTemplate>> = {
  food_authoritarian: {
    en: {
      policy_name: 'Emergency Food Requisition Order',
      description: 'The Council ordered mandatory food requisitioning from all surplus households to replenish state reserves.',
      public_statement: 'By decree of the High Council: all surplus grain is hereby state property until reserves stabilize.',
    },
    vi: {
      policy_name: 'Lệnh Trưng Thu Lương Thực Khẩn Cấp',
      description: 'Hội đồng ban lệnh trưng thu lương thực bắt buộc từ tất cả hộ dân có dư thừa để bổ sung kho dự trữ nhà nước.',
      public_statement: 'Theo sắc lệnh của Thượng Hội đồng: toàn bộ lương thực dư thừa nay là tài sản nhà nước cho đến khi kho dự trữ ổn định.',
    },
  },
  food_libertarian: {
    en: {
      policy_name: 'Emergency Trade Route Stimulus',
      description: 'The Market Board announced zero-tariff zones and expedited trade licenses to attract external food suppliers.',
      public_statement: 'The Market is the solution. All barriers to food trade are hereby suspended.',
    },
    vi: {
      policy_name: 'Kích Thích Tuyến Thương Mại Khẩn Cấp',
      description: 'Hội đồng Thị trường công bố vùng miễn thuế và cấp phép thương mại nhanh để thu hút nhà cung cấp lương thực bên ngoài.',
      public_statement: 'Thị trường là giải pháp. Mọi rào cản thương mại lương thực nay đã được bãi bỏ.',
    },
  },
  food_theocratic: {
    en: {
      policy_name: 'Sacred Fast and Community Sharing Decree',
      description: 'The High Council proclaimed a period of sacred communal sharing; temple storehouses opened to the people.',
      public_statement: 'The divine calls us to share. Temple granaries are open. Those who hoard shall answer to higher authority.',
    },
    vi: {
      policy_name: 'Sắc Lệnh Nhịn Ăn Thiêng Liêng và Chia Sẻ Cộng Đồng',
      description: 'Thượng Hội đồng tuyên bố thời kỳ chia sẻ cộng đồng thiêng liêng; kho lương thực của đền thờ được mở cho dân chúng.',
      public_statement: 'Thần thánh kêu gọi chúng ta chia sẻ. Kho thóc đền thờ đã mở cửa. Kẻ tích trữ sẽ phải trả lời trước quyền năng tối cao.',
    },
  },
  food_default: {
    en: {
      policy_name: 'Emergency Food Distribution Program',
      description: 'The Council activated emergency reserves and organized distribution centers across all districts.',
      public_statement: 'The Governing Council assures all citizens: no one will go hungry. Emergency rations are now available at distribution centers.',
    },
    vi: {
      policy_name: 'Chương Trình Phân Phối Lương Thực Khẩn Cấp',
      description: 'Hội đồng kích hoạt kho dự trữ khẩn cấp và tổ chức các trung tâm phân phối trên toàn các quận.',
      public_statement: 'Hội đồng Cai trị đảm bảo với toàn thể nhân dân: không ai bị đói. Khẩu phần khẩn cấp hiện có tại các trung tâm phân phối.',
    },
  },
  stability_authoritarian: {
    en: {
      policy_name: 'Order Restoration Decree',
      description: 'The Council deployed guard forces and imposed curfews to suppress civil disturbances and restore order.',
      public_statement: 'Order will be maintained. Elements of disorder will be removed. Citizens are advised to return to their duties immediately.',
    },
    vi: {
      policy_name: 'Sắc Lệnh Khôi Phục Trật Tự',
      description: 'Hội đồng triển khai lực lượng canh giữ và ban bố lệnh giới nghiêm để trấn áp bạo loạn dân sự và khôi phục trật tự.',
      public_statement: 'Trật tự sẽ được duy trì. Những phần tử gây rối sẽ bị loại bỏ. Người dân được khuyến cáo quay lại nhiệm vụ ngay lập tức.',
    },
  },
  stability_theocratic: {
    en: {
      policy_name: 'Spiritual Renewal and Reconciliation Edict',
      description: 'The High Council declared a period of communal prayer and moral renewal to heal social rifts.',
      public_statement: 'We are one people under divine guidance. Let us lay down discord and renew our sacred covenant.',
    },
    vi: {
      policy_name: 'Chiếu Chỉ Tái Sinh Tâm Linh và Hòa Giải',
      description: 'Thượng Hội đồng tuyên bố thời kỳ cầu nguyện cộng đồng và tái sinh đạo đức để hàn gắn rạn nứt xã hội.',
      public_statement: 'Chúng ta là một dân tộc dưới sự dẫn dắt của thần thánh. Hãy gác bỏ bất hòa và gia hạn giao ước thiêng liêng của chúng ta.',
    },
  },
  stability_welfare: {
    en: {
      policy_name: 'Social Stability and Dialogue Initiative',
      description: 'The Council launched community dialogue programs and increased social support services to address underlying grievances.',
      public_statement: 'The Council listens. Community centers and conflict-resolution services are now open across all districts.',
    },
    vi: {
      policy_name: 'Sáng Kiến Ổn Định Xã Hội và Đối Thoại',
      description: 'Hội đồng triển khai chương trình đối thoại cộng đồng và tăng cường dịch vụ hỗ trợ xã hội để giải quyết các bất bình cơ bản.',
      public_statement: 'Hội đồng lắng nghe. Các trung tâm cộng đồng và dịch vụ giải quyết xung đột nay đã mở cửa trên toàn quận.',
    },
  },
  stability_technocratic: {
    en: {
      policy_name: 'Algorithmic Grievance Optimization Protocol',
      description: 'The Algorithm Advisory Board deployed predictive social management tools to preemptively resolve instability vectors.',
      public_statement: 'Analysis complete. Social instability corrected to within acceptable parameters. Comply with recommended behavioral adjustments.',
    },
    vi: {
      policy_name: 'Giao Thức Tối Ưu Hóa Bất Bình bằng Thuật Toán',
      description: 'Ban Cố vấn Thuật toán triển khai công cụ quản lý xã hội dự đoán để chủ động giải quyết các vectơ bất ổn.',
      public_statement: 'Phân tích hoàn tất. Bất ổn xã hội đã được hiệu chỉnh trong phạm vi chấp nhận. Vui lòng tuân thủ các điều chỉnh hành vi được khuyến nghị.',
    },
  },
  stability_default: {
    en: {
      policy_name: 'Civil Reconciliation Measures',
      description: 'The Council held emergency sessions to address grievances and announced a package of reform pledges.',
      public_statement: "The Council hears the people's concerns and pledges meaningful reforms. Dialogue is open.",
    },
    vi: {
      policy_name: 'Biện Pháp Hòa Giải Dân Sự',
      description: 'Hội đồng tổ chức phiên họp khẩn cấp để giải quyết bất bình và công bố gói cam kết cải cách.',
      public_statement: 'Hội đồng lắng nghe mối quan tâm của nhân dân và cam kết cải cách thực chất. Đối thoại đang mở.',
    },
  },
  trust_high_state: {
    en: {
      policy_name: 'Public Unity and Trust Decree',
      description: 'The Council launched a mandatory civic unity campaign alongside increased public services to rebuild trust.',
      public_statement: "The Council reaffirms its commitment to the people. Unity is not optional — it is the foundation of our society.",
    },
    vi: {
      policy_name: 'Sắc Lệnh Đoàn Kết Công Cộng và Niềm Tin',
      description: 'Hội đồng triển khai chiến dịch đoàn kết dân sự bắt buộc cùng tăng cường dịch vụ công để khôi phục niềm tin.',
      public_statement: 'Hội đồng khẳng định lại cam kết với nhân dân. Đoàn kết không phải là tùy chọn — đó là nền tảng của xã hội chúng ta.',
    },
  },
  trust_low_state: {
    en: {
      policy_name: 'Transparency and Accountability Initiative',
      description: 'The Council announced transparency measures and public consultation forums to restore citizen confidence.',
      public_statement: 'The Governing Council opens its books and its doors. Citizens deserve honesty, and we deliver it.',
    },
    vi: {
      policy_name: 'Sáng Kiến Minh Bạch và Trách Nhiệm Giải Trình',
      description: 'Hội đồng công bố các biện pháp minh bạch và diễn đàn tham vấn công cộng để khôi phục niềm tin của người dân.',
      public_statement: 'Hội đồng Cai trị mở sổ sách và mở cửa. Người dân xứng đáng được biết sự thật, và chúng tôi thực hiện điều đó.',
    },
  },
  resources_libertarian: {
    en: {
      policy_name: 'Resource Market Efficiency Act',
      description: 'The Council introduced tradeable extraction quotas and market incentives for resource conservation.',
      public_statement: 'Market-based conservation is the answer. Extraction quotas are now tradeable assets.',
    },
    vi: {
      policy_name: 'Đạo Luật Hiệu Quả Thị Trường Tài Nguyên',
      description: 'Hội đồng giới thiệu hạn ngạch khai thác có thể giao dịch và các khuyến khích thị trường cho bảo tồn tài nguyên.',
      public_statement: 'Bảo tồn dựa trên thị trường là câu trả lời. Hạn ngạch khai thác nay là tài sản có thể giao dịch.',
    },
  },
  resources_default: {
    en: {
      policy_name: 'Resource Conservation Mandate',
      description: 'The Council mandated reduced extraction rates, banned non-essential resource use, and invested in regeneration programs.',
      public_statement: 'Sustainable use of natural resources is now mandatory. Extraction quotas have been set. The land must recover.',
    },
    vi: {
      policy_name: 'Lệnh Bảo Tồn Tài Nguyên',
      description: 'Hội đồng bắt buộc giảm tốc độ khai thác, cấm sử dụng tài nguyên không thiết yếu, và đầu tư vào chương trình tái tạo.',
      public_statement: 'Sử dụng tài nguyên thiên nhiên bền vững nay là bắt buộc. Hạn ngạch khai thác đã được thiết lập. Đất đai phải được phục hồi.',
    },
  },
  labor_authoritarian: {
    en: {
      policy_name: 'Labor Discipline Decree',
      description: 'The Council declared labor unrest a threat to public order and authorized enforcement action against strike organizers.',
      public_statement: 'The Council will not tolerate economic sabotage. Workers who abandon their posts undermine society itself.',
    },
    vi: {
      policy_name: 'Sắc Lệnh Kỷ Luật Lao Động',
      description: 'Hội đồng tuyên bố bất ổn lao động là mối đe dọa trật tự công cộng và ủy quyền thực thi hành động đối với các thủ lĩnh đình công.',
      public_statement: 'Hội đồng sẽ không dung thứ hành động phá hoại kinh tế. Công nhân bỏ vị trí làm suy yếu chính xã hội.',
    },
  },
  labor_welfare: {
    en: {
      policy_name: 'Collective Bargaining Framework',
      description: 'The Council opened negotiations with worker representatives, offering wage adjustments and improved working conditions.',
      public_statement: "Workers' concerns are legitimate. The Council commits to fair negotiations and a better social compact.",
    },
    vi: {
      policy_name: 'Khung Thương Lượng Tập Thể',
      description: 'Hội đồng mở đàm phán với đại diện công nhân, đề nghị điều chỉnh lương và cải thiện điều kiện làm việc.',
      public_statement: 'Mối quan tâm của công nhân là chính đáng. Hội đồng cam kết đàm phán công bằng và một khế ước xã hội tốt hơn.',
    },
  },
  labor_default: {
    en: {
      policy_name: 'Labor Market Flexibility Initiative',
      description: 'The Council introduced market-based incentives to resolve labor disputes, including productivity bonuses and deregulation of hiring.',
      public_statement: 'Free markets resolve labor disputes better than mandates. We trust citizens to find their own equilibrium.',
    },
    vi: {
      policy_name: 'Sáng Kiến Linh Hoạt Thị Trường Lao Động',
      description: 'Hội đồng đưa ra các khuyến khích dựa trên thị trường để giải quyết tranh chấp lao động, bao gồm thưởng năng suất và bãi bỏ quy định tuyển dụng.',
      public_statement: 'Thị trường tự do giải quyết tranh chấp lao động tốt hơn các mệnh lệnh. Chúng tôi tin tưởng người dân tìm ra cân bằng của riêng họ.',
    },
  },
  generic: {
    en: {
      policy_name: 'Emergency Stabilization Measures',
      description: 'The Council convened an emergency session and implemented a package of stabilization measures to address the current crisis.',
      public_statement: 'The Council is taking decisive action. Citizens should remain calm and trust that the situation is being managed.',
    },
    vi: {
      policy_name: 'Biện Pháp Ổn Định Khẩn Cấp',
      description: 'Hội đồng triệu tập phiên họp khẩn cấp và thực hiện gói biện pháp ổn định để giải quyết cuộc khủng hoảng hiện tại.',
      public_statement: 'Hội đồng đang hành động quyết đoán. Người dân hãy bình tĩnh và tin tưởng rằng tình hình đang được xử lý.',
    },
  },
}

export function getFallbackPolicy(lang: Lang, key: string): PolicyTemplate {
  const entry = FALLBACK_POLICIES[key] ?? FALLBACK_POLICIES.generic
  return pick(lang, entry)
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

// ── NPC Policy Reaction Templates ─────────────────────────────────────────────
// Stance: how an NPC feels about government authority & this policy
// PolicyType: what kind of policy it is (classified from its numeric deltas)

export type PolicyStance = 'loyalist' | 'pragmatist' | 'skeptic' | 'dissident'
export type PolicyType   = 'benefit' | 'hardship' | 'security' | 'economic' | 'generic'

// Probability that a role-specific prefix line is prepended to a reaction thought.
// At ~35% it adds occupational colour without feeling repetitive.
const ROLE_PREFIX_PROBABILITY = 0.35

const POLICY_REACTIONS: Record<PolicyStance, Record<PolicyType, Localized<string[]>>> = {
  loyalist: {
    benefit: {
      en: [
        "Finally some good news! The government is actually looking out for us.",
        "This is exactly what we needed. I knew they'd come through.",
        "See? The Council cares about ordinary people. This is real help.",
        "About time! I'm glad the government is taking action to support citizens.",
      ],
      vi: [
        "Cuối cùng cũng có tin tốt! Nhà nước thực sự lo cho người dân.",
        "Đúng cái mình cần rồi. Mình biết họ sẽ làm được.",
        "Thấy không? Hội đồng quan tâm đến người dân. Đây là sự giúp đỡ thực sự.",
        "Muộn còn hơn không! Mừng vì nhà nước đang hành động để hỗ trợ người dân.",
      ],
    },
    hardship: {
      en: [
        "These measures are necessary. We need order and discipline to get through this.",
        "Hard choices for hard times. I trust the Council knows what it's doing.",
        "Not easy, but the government is right to take a firm hand when needed.",
        "Stability requires sacrifice sometimes. I'll do my part.",
      ],
      vi: [
        "Các biện pháp này là cần thiết. Chúng ta cần trật tự và kỷ luật để vượt qua.",
        "Quyết định khó cho thời điểm khó. Tôi tin Hội đồng biết họ đang làm gì.",
        "Không dễ, nhưng nhà nước có lý khi cần tay cứng rắn.",
        "Ổn định đôi khi đòi hỏi hy sinh. Tôi sẽ làm phần của mình.",
      ],
    },
    security: {
      en: [
        "Order must be maintained. Those stirring up trouble only hurt everyone.",
        "Strong measures are what keeps society from falling apart.",
        "The troublemakers brought this on themselves. The Council is right.",
        "I stand with the government on this. Unity is what we need.",
      ],
      vi: [
        "Trật tự phải được duy trì. Những kẻ kích động chỉ gây hại cho mọi người.",
        "Các biện pháp mạnh là thứ giữ cho xã hội không tan rã.",
        "Những kẻ gây rối tự chuốc lấy hậu quả này. Hội đồng đúng.",
        "Tôi đứng về phía nhà nước trong chuyện này. Đoàn kết là thứ chúng ta cần.",
      ],
    },
    economic: {
      en: [
        "Good policy for the economy. The government knows how to keep things running.",
        "Economic stability benefits everyone. I'm glad they're managing this well.",
        "A clear plan for growth. I trust the Council's economic judgment.",
        "The government is investing in our future. That's the right move.",
      ],
      vi: [
        "Chính sách kinh tế tốt. Nhà nước biết cách giữ cho mọi thứ vận hành.",
        "Ổn định kinh tế có lợi cho tất cả. Mừng vì họ đang xử lý tốt.",
        "Kế hoạch rõ ràng cho tăng trưởng. Tôi tin vào phán đoán kinh tế của Hội đồng.",
        "Nhà nước đang đầu tư vào tương lai chúng ta. Đó là bước đi đúng.",
      ],
    },
    generic: {
      en: [
        "The government is acting decisively. I trust they know what they're doing.",
        "Another policy from the Council. Whatever it takes to keep things stable.",
        "I follow what the government decides. They see the bigger picture.",
        "The Council is managing things — that's their job and I trust them to do it.",
      ],
      vi: [
        "Nhà nước đang hành động quyết đoán. Tôi tin họ biết họ đang làm gì.",
        "Một chính sách khác từ Hội đồng. Dù sao cũng cần giữ cho mọi thứ ổn định.",
        "Tôi làm theo quyết định của nhà nước. Họ thấy bức tranh toàn cảnh hơn.",
        "Hội đồng đang quản lý mọi thứ — đó là việc của họ và tôi tin họ làm được.",
      ],
    },
  },

  pragmatist: {
    benefit: {
      en: [
        "Sounds reasonable. Let's see if they actually deliver on this one.",
        "A welcome change. I'm cautiously optimistic it'll make a difference.",
        "Not bad. The government did something useful for once — I'll take it.",
        "This could help. I hope it's not just words; time will tell.",
      ],
      vi: [
        "Có vẻ hợp lý. Xem họ có thực sự thực hiện lần này không.",
        "Một thay đổi đáng mừng. Tôi thận trọng lạc quan rằng nó sẽ tạo ra sự khác biệt.",
        "Không tệ. Nhà nước đã làm được gì đó hữu ích một lần — tôi chấp nhận.",
        "Cái này có thể giúp ích. Hy vọng không chỉ là lời nói — thời gian sẽ trả lời.",
      ],
    },
    hardship: {
      en: [
        "Hard measures, but maybe necessary. I'll adapt and get through it.",
        "Not ideal, but I understand why. I'll manage as best I can.",
        "Tough times ahead. I'll cut back where I can and keep going.",
        "I don't love this policy, but I'm not going to fight it either.",
      ],
      vi: [
        "Biện pháp cứng rắn, nhưng có thể cần thiết. Tôi sẽ thích nghi và vượt qua.",
        "Không lý tưởng, nhưng tôi hiểu tại sao. Tôi sẽ xoay sở tốt nhất có thể.",
        "Thời gian khó phía trước. Tôi sẽ cắt giảm chỗ nào có thể và tiếp tục.",
        "Tôi không thích chính sách này, nhưng tôi cũng sẽ không chống lại.",
      ],
    },
    security: {
      en: [
        "Stability has to come first I suppose. Hopefully this settles things down.",
        "A firm hand might be needed. I'll keep my head down and keep working.",
        "Not sure this fixes the root problem, but maybe it buys some time.",
        "I can see both sides of this. For now I'll just stay out of it.",
      ],
      vi: [
        "Ổn định phải được đặt lên hàng đầu tôi đoán vậy. Hy vọng điều này giải quyết mọi thứ.",
        "Tay cứng rắn có thể cần thiết. Tôi sẽ cúi đầu và tiếp tục làm việc.",
        "Không chắc cái này giải quyết vấn đề gốc rễ, nhưng có thể mua thêm thời gian.",
        "Tôi thấy cả hai phía của điều này. Bây giờ tôi chỉ đứng ngoài.",
      ],
    },
    economic: {
      en: [
        "Could be worse. I'll adjust my plans and see what opportunities arise.",
        "Economic policy is always complicated. I'll wait and see how this plays out.",
        "I can work with this. Every policy has winners and losers; I'll try to be a winner.",
        "Reasonable enough. As long as it doesn't hit my income too hard.",
      ],
      vi: [
        "Có thể tệ hơn. Tôi sẽ điều chỉnh kế hoạch và xem cơ hội nào xuất hiện.",
        "Chính sách kinh tế luôn phức tạp. Tôi sẽ chờ xem điều này diễn ra thế nào.",
        "Tôi có thể làm việc với điều này. Mọi chính sách đều có kẻ thắng người thua — tôi sẽ cố làm kẻ thắng.",
        "Hợp lý đủ. Miễn là không ảnh hưởng quá nhiều đến thu nhập của tôi.",
      ],
    },
    generic: {
      en: [
        "Another announcement. I'll wait and see what actually changes in practice.",
        "Government policy. I neither cheer nor protest — I just keep going.",
        "Could help, could hurt, hard to say. I'll adapt either way.",
        "I don't pay too much attention to politics. I just focus on my own life.",
      ],
      vi: [
        "Một thông báo khác. Tôi sẽ chờ xem thực tế có gì thay đổi.",
        "Chính sách nhà nước. Tôi không hò reo cũng không phản đối — tôi chỉ tiếp tục.",
        "Có thể giúp, có thể hại, khó nói. Tôi sẽ thích nghi dù sao.",
        "Tôi không chú ý quá nhiều đến chính trị. Tôi chỉ tập trung vào cuộc sống của mình.",
      ],
    },
  },

  skeptic: {
    benefit: {
      en: [
        "Sounds nice, but I'll believe it when I actually see the benefits.",
        "They say it'll help, but government promises rarely match reality.",
        "Nice words. Whether it actually reaches ordinary people is another question.",
        "I want to believe it, but this government has let us down before.",
      ],
      vi: [
        "Nghe hay, nhưng tôi sẽ tin khi thực sự thấy lợi ích.",
        "Họ nói nó sẽ giúp ích, nhưng lời hứa của nhà nước hiếm khi khớp thực tế.",
        "Lời hay. Liệu nó có thực sự đến được người dân bình thường hay không lại là chuyện khác.",
        "Tôi muốn tin, nhưng nhà nước này đã làm chúng tôi thất vọng trước đây.",
      ],
    },
    hardship: {
      en: [
        "More restrictions and burdens. I doubt this will actually fix anything.",
        "They always find ways to make life harder instead of solving the real problem.",
        "The government is squeezing people rather than addressing the actual issue.",
        "I'm not convinced this is the right answer — but what choice do I have?",
      ],
      vi: [
        "Thêm hạn chế và gánh nặng. Tôi nghi ngờ điều này sẽ giải quyết được gì.",
        "Họ luôn tìm cách làm cuộc sống khó hơn thay vì giải quyết vấn đề thực sự.",
        "Nhà nước đang bóp nghẹt người dân thay vì giải quyết vấn đề thực tế.",
        "Tôi không bị thuyết phục đây là câu trả lời đúng — nhưng tôi có lựa chọn nào không?",
      ],
    },
    security: {
      en: [
        "Cracking down on people doesn't fix the underlying issues that caused the unrest.",
        "They're treating symptoms, not causes. This buys time but solves nothing.",
        "Control and fear — that's always their answer. Until it isn't enough.",
        "I keep quiet and stay out of trouble. But I notice what's happening.",
      ],
      vi: [
        "Đàn áp người dân không giải quyết các vấn đề cơ bản dẫn đến bất ổn.",
        "Họ đang trị triệu chứng, không phải nguyên nhân. Mua thêm thời gian nhưng không giải quyết gì.",
        "Kiểm soát và sợ hãi — đó luôn là câu trả lời của họ. Cho đến khi không còn đủ.",
        "Tôi giữ im lặng và tránh rắc rối. Nhưng tôi nhận thấy điều đang xảy ra.",
      ],
    },
    economic: {
      en: [
        "Economic policies always seem to benefit the powerful more than ordinary folk.",
        "Let's see who actually profits from this. Usually not people like me.",
        "The numbers sound good on paper. The reality is usually more complicated.",
        "I'll adjust what I can. It's not like I have much say in what policies they choose.",
      ],
      vi: [
        "Chính sách kinh tế luôn có vẻ mang lại lợi ích cho người có quyền lực hơn là người bình thường.",
        "Hãy xem ai thực sự được lợi từ điều này. Thường không phải người như tôi.",
        "Các con số nghe hay trên giấy. Thực tế thường phức tạp hơn.",
        "Tôi sẽ điều chỉnh những gì có thể. Không như tôi có nhiều tiếng nói trong chính sách họ chọn.",
      ],
    },
    generic: {
      en: [
        "Yet another policy. I'll wait and see if this one actually changes anything.",
        "Words are cheap. Show me results and then I'll form an opinion.",
        "I've heard enough government announcements — it's always more complicated than it sounds.",
        "I pay attention, but I'm not hopeful. They rarely deliver what they promise.",
      ],
      vi: [
        "Lại thêm một chính sách nữa. Tôi sẽ chờ xem cái này có thực sự thay đổi gì không.",
        "Lời nói rẻ. Cho tôi xem kết quả rồi tôi mới có ý kiến.",
        "Tôi đã nghe đủ thông báo từ nhà nước rồi — luôn phức tạp hơn so với nghe.",
        "Tôi chú ý, nhưng không kỳ vọng. Họ hiếm khi thực hiện điều họ hứa.",
      ],
    },
  },

  dissident: {
    benefit: {
      en: [
        "All talk, no action. I've heard this kind of announcement before — nothing ever changes.",
        "Probably just a political stunt to calm people down before the next crackdown.",
        "This government has never truly cared about people like me. I won't hold my breath.",
        "If it sounds too good to be true, it usually is. What's the catch?",
      ],
      vi: [
        "Nói nhiều, làm ít. Tôi đã nghe loại thông báo này trước — không có gì thay đổi.",
        "Có lẽ chỉ là trò chính trị để xoa dịu người dân trước đợt đàn áp tiếp theo.",
        "Nhà nước này chưa bao giờ thực sự quan tâm đến người như tôi. Tôi sẽ không hi vọng.",
        "Nếu nghe có vẻ quá tốt để là sự thật, thường là như vậy. Điều kiện gì đây?",
      ],
    },
    hardship: {
      en: [
        "This is just another way to control and squeeze ordinary people. Enough is enough.",
        "They keep adding burdens while the privileged suffer nothing. This system is broken.",
        "I'm done pretending this is acceptable. Something has to change.",
        "More suffering for us, more power for them. Same old story.",
      ],
      vi: [
        "Đây chỉ là một cách khác để kiểm soát và bóp nghẹt người dân bình thường. Đủ rồi.",
        "Họ tiếp tục thêm gánh nặng trong khi người có đặc quyền không chịu thiệt. Hệ thống này đã hỏng.",
        "Tôi mệt với việc giả vờ điều này có thể chấp nhận được. Phải có điều gì đó thay đổi.",
        "Thêm đau khổ cho chúng ta, thêm quyền lực cho họ. Câu chuyện cũ.",
      ],
    },
    security: {
      en: [
        "They silence voices they don't like and call it 'order'. This is oppression.",
        "The powerful protecting themselves from accountability. Nothing new.",
        "Crushing dissent isn't governance — it's fear. And they know it.",
        "Every crackdown only proves their weakness. A truly strong government wouldn't need this.",
      ],
      vi: [
        "Họ bịt miệng những tiếng nói họ không thích và gọi đó là 'trật tự'. Đây là đàn áp.",
        "Kẻ mạnh tự bảo vệ mình khỏi trách nhiệm. Không có gì mới.",
        "Dẹp bỏ bất đồng không phải quản trị — đó là sợ hãi. Và họ biết điều đó.",
        "Mỗi đợt đàn áp chỉ chứng minh sự yếu đuối của họ. Chính phủ thực sự mạnh không cần điều này.",
      ],
    },
    economic: {
      en: [
        "Another policy that benefits the wealthy and leaves ordinary workers worse off.",
        "I can read between the lines. This is designed to serve the powerful, not us.",
        "The economy works great — for them. For people like me, it's a very different story.",
        "They dress up exploitation as opportunity. I'm not fooled.",
      ],
      vi: [
        "Một chính sách khác mang lại lợi ích cho người giàu và để người lao động tệ hơn.",
        "Tôi có thể đọc giữa các dòng chữ. Đây được thiết kế để phục vụ người có quyền lực, không phải chúng ta.",
        "Kinh tế hoạt động tốt — cho họ. Đối với người như tôi, đó là một câu chuyện rất khác.",
        "Họ ngụy trang bóc lột thành cơ hội. Tôi không bị lừa.",
      ],
    },
    generic: {
      en: [
        "Same propaganda, different day. I've stopped believing any of it.",
        "Nothing this government says or does will improve things for ordinary people.",
        "I refuse to pretend this policy means anything. We need real change.",
        "They announce. We suffer. That's how it always works.",
      ],
      vi: [
        "Cùng một tuyên truyền, ngày khác nhau. Tôi đã ngừng tin bất kỳ điều gì.",
        "Không có gì nhà nước này nói hoặc làm sẽ cải thiện tình hình cho người dân bình thường.",
        "Tôi từ chối giả vờ chính sách này có ý nghĩa gì. Chúng ta cần sự thay đổi thực sự.",
        "Họ công bố. Chúng ta chịu đựng. Đó là cách nó luôn hoạt động.",
      ],
    },
  },
}

// Role-specific reaction prefixes that prepend context to the thought (applied ~35% of the time)
const ROLE_REACTION_PREFIX: Partial<Record<string, Localized<Record<PolicyStance, string>>>> = {
  farmer: {
    en: {
      loyalist:   'As a farmer, I\'m glad the government is looking after us.',
      pragmatist: 'As a farmer, this policy will affect my harvest.',
      skeptic:    'As a farmer, I\'ve heard promises like this before.',
      dissident:  'As a farmer — we do all the work and get the least.',
    },
    vi: {
      loyalist:   'Là nông dân, tôi mừng vì nhà nước đang chăm lo cho chúng tôi.',
      pragmatist: 'Là nông dân, chính sách này sẽ ảnh hưởng đến vụ mùa của tôi.',
      skeptic:    'Là nông dân, tôi đã thấy những lời hứa như thế này trước đây.',
      dissident:  'Là nông dân — chúng tôi làm tất cả công việc và nhận được ít nhất.',
    },
  },
  merchant: {
    en: {
      loyalist:   'Good for business stability.',
      pragmatist: 'I\'ll have to adjust my trade routes accordingly.',
      skeptic:    'Trade policy is always risky — I\'ll hedge my bets.',
      dissident:  'They regulate what\'s profitable and tax what remains.',
    },
    vi: {
      loyalist:   'Tốt cho sự ổn định kinh doanh.',
      pragmatist: 'Tôi sẽ phải điều chỉnh tuyến thương mại của mình cho phù hợp.',
      skeptic:    'Chính sách thương mại luôn có rủi ro — tôi sẽ phòng ngừa.',
      dissident:  'Họ điều tiết những gì có lợi và đánh thuế những gì còn lại.',
    },
  },
  guard: {
    en: {
      loyalist:   'My duty is clear — I\'ll enforce this policy as ordered.',
      pragmatist: 'Orders are orders. I\'ll do my job and let the politicians worry about the rest.',
      skeptic:    'They give the orders; we do the work. I just hope it\'s worth it.',
      dissident:  'Even guards can see when policies are wrong. But I follow orders.',
    },
    vi: {
      loyalist:   'Nhiệm vụ của tôi rõ ràng — tôi sẽ thực thi chính sách này theo lệnh.',
      pragmatist: 'Lệnh là lệnh. Tôi sẽ làm công việc của mình và để các chính khách lo phần còn lại.',
      skeptic:    'Họ ra lệnh; chúng tôi làm việc. Tôi chỉ hy vọng điều đó đáng công.',
      dissident:  'Ngay cả lính canh cũng có thể thấy khi chính sách sai. Nhưng tôi tuân lệnh.',
    },
  },
  scholar: {
    en: {
      loyalist:   'The policy framework is analytically sound.',
      pragmatist: 'The data suggests this could work with some adjustments.',
      skeptic:    'The evidence supporting this policy is, at best, inconclusive.',
      dissident:  'This is ideological governance, not evidence-based policy.',
    },
    vi: {
      loyalist:   'Khung chính sách này hợp lý từ góc độ phân tích.',
      pragmatist: 'Dữ liệu cho thấy điều này có thể hiệu quả với một số điều chỉnh.',
      skeptic:    'Bằng chứng hỗ trợ chính sách này, tốt nhất là, không thuyết phục.',
      dissident:  'Đây là quản trị ý thức hệ, không phải chính sách dựa trên bằng chứng.',
    },
  },
}

export function getNPCPolicyReactionThought(
  lang: Lang,
  stance: PolicyStance,
  policyType: PolicyType,
  role: string,
): string {
  const pool = pick(lang, POLICY_REACTIONS[stance][policyType])
  let thought = pool[Math.floor(Math.random() * pool.length)]

  // Optionally prepend a role-specific context line
  const rolePrefix = ROLE_REACTION_PREFIX[role]
  if (rolePrefix && Math.random() < ROLE_PREFIX_PROBABILITY) {
    const prefixMap = pick(lang, rolePrefix)
    thought = prefixMap[stance] + ' ' + thought
  }

  return thought
}

// ── Softer fallback policy text ───────────────────────────────────────────────

export function softerFallbackPolicyText(lang: Lang) {
  return {
    option_label:     pick(lang, { en: 'Gradual Reform',    vi: 'Cải cách Dần dần' }),
    policy_name:      pick(lang, { en: 'Dialogue & Reform', vi: 'Cải cách & Đối thoại' }),
    description:      pick(lang, {
      en: 'The government listens to citizen concerns, makes modest concessions, and rebuilds social trust.',
      vi: 'Chính phủ lắng nghe nguyện vọng dân chúng, nhượng bộ dần và tái xây dựng niềm tin xã hội.',
    }),
    public_statement: pick(lang, {
      en: 'We commit to step-by-step improvement — because trust cannot be mandated by decree.',
      vi: 'Chúng tôi cam kết cải thiện từng bước — bởi lòng tin không thể áp đặt bằng sắc lệnh.',
    }),
  }
}

// ── Option labels ─────────────────────────────────────────────────────────────

export const OPTION_LABELS = {
  directIntervention: (lang: Lang) => pick(lang, { en: 'Direct Intervention', vi: 'Can thiệp Trực tiếp' }),
  stabilizeNow:       (lang: Lang) => pick(lang, { en: 'Stabilize Now',        vi: 'Ổn định Ngay' }),
  gradualReform:      (lang: Lang) => pick(lang, { en: 'Gradual Reform',       vi: 'Cải cách Dần dần' }),
}

// ── Faction reaction message ──────────────────────────────────────────────────

export function factionReactionMessage(lang: Lang, icon: string, name: string, dv: string, stance: 'supports' | 'opposes'): string {
  return pick(lang, {
    en: `${icon} ${name} (${dv}): ${stance}s this policy`,
    vi: `${icon} Phe ${name} (${dv}): ${stance === 'supports' ? 'ủng hộ' : 'phản đối'} chính sách này`,
  })
}

// ── Alert descriptions ────────────────────────────────────────────────────────

export function describeAlert(lang: Lang, kind: 'food' | 'stability' | 'trust' | 'pressure' | 'resources' | 'labor_unrest', level: 'critical' | 'warning', pct: number): string {
  const p = Math.round(pct)
  if (lang === 'vi') {
    if (kind === 'food') return level === 'critical' ? `lương thực cực kỳ thiếu (${p}%)` : `lương thực thấp (${p}%)`
    if (kind === 'stability') return level === 'critical' ? `ổn định xã hội ở mức nguy hiểm (${p}%)` : `ổn định đang suy giảm (${p}%)`
    if (kind === 'trust') return level === 'critical' ? `niềm tin vào chính quyền ở mức khủng hoảng (${p}%)` : `niềm tin vào chính quyền suy giảm (${p}%)`
    if (kind === 'pressure') return level === 'critical' ? `bất ổn dân sự ở mức báo động (${p}%)` : `áp lực chính trị gia tăng (${p}%)`
    if (kind === 'labor_unrest') return level === 'critical' ? `bất ổn lao động ở mức nguy hiểm — nguy cơ đình công (${p}%)` : `ý thức giai cấp công nhân đang tăng (${p}%)`
    return level === 'critical' ? `tài nguyên thiên nhiên cạn kiệt nghiêm trọng (${p}%)` : `tài nguyên thiên nhiên suy giảm (${p}%)`
  }
  if (kind === 'food') return level === 'critical' ? `food supply critically low (${p}%)` : `food supply low (${p}%)`
  if (kind === 'stability') return level === 'critical' ? `societal stability dangerously low (${p}%)` : `stability declining (${p}%)`
  if (kind === 'trust') return level === 'critical' ? `trust in government at crisis level (${p}%)` : `government trust declining (${p}%)`
  if (kind === 'pressure') return level === 'critical' ? `civil unrest at critical level (${p}%)` : `political pressure rising (${p}%)`
  if (kind === 'labor_unrest') return level === 'critical' ? `labor unrest at dangerous levels — strikes imminent (${p}%)` : `worker class consciousness rising (${p}%)`
  return level === 'critical' ? `natural resources critically depleted (${p}%)` : `natural resources depleting (${p}%)`
}

