const ko = {
  intro: '귀속연도 소득을 확인하고 세금 준비 항목을 점검합니다.',
  notice:
    '서버에 저장된 공유 데모 사용자 1 기준입니다. 개인정보 보호용 계정이 아닙니다. 가상·비식별 자료로 테스트하세요.',
  manual:
    '이번 단계는 사용자 입력·확인 방식입니다. 파일 업로드·OCR·브라우저 기록 자동 이전은 하지 않습니다.',
  originalText: '분석 설명과 근거는 서버에 저장된 원문으로 표시합니다.',
  incomeStep: '귀속연도·소득 입력',
  housingStep: '주택 관련 자료',
  reviewStep: '확인 후 요청',
  resultStep: '서버 결과',
  year: '귀속연도',
  annual: '총급여 (비과세 제외, 원)',
  nonTaxable: '단일세율 계산에 포함할 비과세 근로소득 (원)',
  incomeHint:
    '해당 연도 문서에서 직접 확인하세요. 모르면 비워두고, 없다고 확인한 금액만 0을 입력하세요. 숫자와 소수점 둘째 자리까지 입력할 수 있습니다.',
  confirm: '입력한 소득 항목을 해당 귀속연도 자료와 대조해 확인했습니다.',
  confirmScenario:
    '변경한 가정값으로 참고 계산을 요청합니다. 실제 소득 확인·저장은 아닙니다.',
  currentYear:
    '현재 연도는 아직 끝나지 않았습니다. 연중 누계나 예상 연봉을 연간 확정 소득으로 확인하지 마세요.',
  incomplete:
    '소득이 비어 있거나 미확인이어도 준비 항목 점검은 가능합니다. 이 경우 세액 참고값은 계산하지 않습니다.',
  limit:
    '19% 적용을 가정한 참고값만 제공합니다. 일반세율·차액·환급액·지방소득세 및 실제 적용 자격은 계산하거나 확정하지 않습니다.',
  housing: '주택마련저축에 가입했나요?',
  homeless: '무주택 여부를 확인했나요?',
  proof: '주택마련저축 납입증명서를 보유했나요?',
  deductions: '다른 소득공제를 이용하나요?',
  unknown: '모름 / 미확인',
  yes: '예',
  no: '아니요',
  review:
    '요청할 내용을 확인하세요. 분석 저장을 누르면 서버에 새 기록 1건을 만듭니다.',
  save: '분석하고 서버에 저장',
  saving: '서버에 분석 요청 중…',
  simulate: '가정 변경하기',
  runSimulation: '시뮬레이션 실행 (저장 안 함)',
  simulating: '시뮬레이션 요청 중…',
  simulationNotice:
    '시뮬레이션입니다. 입력 조건만 바꾸며, 원본 분석·프로필·급여 기록·DB를 수정하거나 저장하지 않습니다.',
  restore: '저장된 원본 보기',
  newAnalysis: '새 분석 시작',
  saved: '서버에 저장된 분석',
  simulation: '저장하지 않은 시뮬레이션',
  savedDate: '분석 저장일',
  sourceDate: '원본 분석일',
  source: '원본 ID',
  savedId: '분석 ID',
  flat: '19% 적용 가정 참고액',
  general: '일반세율 예상액',
  difference: '세액 차이',
  notCalculated: '계산하지 않음',
  base: '사용자 확인 소득 기준액',
  payTotal: '기록된 실입금 합계',
  recorded: '급여 기록 개월',
  known: '금액 확인 개월',
  missingMonths: '입금액 미확인 월',
  noPay: '등록된 급여 기록 없음',
  unknownPay: '등록된 급여의 입금액 미확인',
  payNote:
    '분석 당시 귀속연도 Paycheck 기록의 실입금 합계입니다. 세금 계산용 소득이나 연간 전체 소득이 아닙니다.',
  snapshot: '시뮬레이션의 급여 참고값과 날짜는 원본 분석 당시 값입니다.',
  reviewRequired: '추가 확인 필요',
  undetermined: '판단 불가',
  confirmedInfo: '확인 정보',
  missingInfo: '부족한 정보',
  next: '다음 행동',
  evidence: '근거',
  documents: '준비할 자료',
  warnings: '계산 범위·주의사항',
  missingCalculation: '참고액을 계산하지 않은 이유',
  records: '내 기록',
  dashboard: '대시보드',
  loading: '저장된 분석을 불러오는 중…',
  readError:
    '저장된 분석을 불러오지 못했습니다. 서버 연결과 분석 ID를 확인하세요.',
  writeError: '요청을 처리하지 못했습니다. 입력값과 서버 상태를 확인하세요.',
  saveUncertain:
    '응답을 확인하지 못했습니다. 서버에는 이미 저장됐을 수 있습니다. 내 기록을 확인하기 전에는 같은 분석을 다시 요청하지 마세요.',
  acknowledge:
    '내 기록을 확인했으며 중복 저장 가능성을 확인한 후 다시 요청합니다.',
  badUrl:
    '분석 ID가 올바르지 않습니다. 내 기록에서 확인하거나 새 분석을 시작하세요.',
  retry: '다시 불러오기',
  invalidYear: '귀속연도는 2000년부터 현재 한국 연도까지 입력하세요.',
  invalidAmount:
    '금액은 0 이상, 정수 13자리·소수 2자리 이내로 입력하세요. 쉼표·음수·지수 표기는 사용할 수 없습니다.',
  nonTaxableExceedsAnnual:
    '비과세 근로소득이 총급여(비과세 제외)보다 큽니다. 입력한 소득 항목과 금액을 다시 확인하세요.',
  tooLarge: '참고 계산용 소득 합계가 서버의 허용 범위를 초과합니다.',
} as const;

export type TaxCopy = { [K in keyof typeof ko]: string };

const en: TaxCopy = {
  intro: 'Confirm income for a tax year and check preparation items.',
  notice:
    'Shared demo user 1 on the server. This is not a private account. Test with synthetic or de-identified data.',
  manual:
    'Manual, user-confirmed input only. No file upload, OCR or automatic import of browser records.',
  originalText:
    'Analysis and sources are shown in their original server language.',
  incomeStep: 'Year and income',
  housingStep: 'Housing documents',
  reviewStep: 'Review and request',
  resultStep: 'Server result',
  year: 'Tax year',
  annual: 'Annual employment income, excluding non-taxable income (KRW)',
  nonTaxable:
    'Non-taxable employment income included in the flat-rate calculation (KRW)',
  incomeHint:
    'Check the documents for that year. Leave unknown amounts blank; enter 0 only when confirmed absent. Up to two decimal places; no commas.',
  confirm: 'I checked these income items against documents for this tax year.',
  confirmScenario:
    'Use these hypothetical values for a reference calculation. This does not confirm or save actual income.',
  currentYear:
    'This year has not ended. Do not confirm year-to-date amounts or projected salary as final annual income.',
  incomplete:
    'You may check preparation items with incomplete or unconfirmed income. No reference tax amount will be calculated.',
  limit:
    'Reference amount assuming 19% only. No general-rate comparison, difference, refund, local income tax or eligibility determination.',
  housing: 'Do you have housing savings?',
  homeless: 'Have you confirmed that you do not own a home?',
  proof: 'Do you have proof of housing savings payments?',
  deductions: 'Do you use other income deductions?',
  unknown: 'Unknown / unconfirmed',
  yes: 'Yes',
  no: 'No',
  review: 'Check the request. Saving creates one new server record.',
  save: 'Analyze and save to server',
  saving: 'Requesting analysis…',
  simulate: 'Change assumptions',
  runSimulation: 'Simulate (do not save)',
  simulating: 'Requesting simulation…',
  simulationNotice:
    'Simulation only. Changes assumptions without saving or modifying the original analysis, profile, pay records or database.',
  restore: 'View saved original',
  newAnalysis: 'Start new analysis',
  saved: 'Saved server analysis',
  simulation: 'Unsaved simulation',
  savedDate: 'Saved analysis date',
  sourceDate: 'Original analysis date',
  source: 'Source ID',
  savedId: 'Analysis ID',
  flat: 'Reference amount assuming 19%',
  general: 'General-rate estimate',
  difference: 'Tax difference',
  notCalculated: 'Not calculated',
  base: 'User-confirmed income base',
  payTotal: 'Recorded received pay',
  recorded: 'Recorded pay months',
  known: 'Months with known amounts',
  missingMonths: 'Months with unknown amounts',
  noPay: 'No pay records',
  unknownPay: 'Recorded pay amounts unknown',
  payNote:
    'Received pay from Paycheck records for the tax year at analysis time. Not taxable income or complete annual income.',
  snapshot:
    'Simulation uses pay reference data and the date from the original analysis.',
  reviewRequired: 'Review required',
  undetermined: 'Undetermined',
  confirmedInfo: 'Confirmed information',
  missingInfo: 'Missing information',
  next: 'Next action',
  evidence: 'Sources',
  documents: 'Documents to prepare',
  warnings: 'Scope and cautions',
  missingCalculation: 'Why the reference amount was not calculated',
  records: 'My records',
  dashboard: 'Dashboard',
  loading: 'Loading saved analysis…',
  readError:
    'Could not load the saved analysis. Check the server connection and analysis ID.',
  writeError: 'Could not process the request. Check the inputs and server.',
  saveUncertain:
    'The response could not be verified. The server may have saved the analysis. Check My records before submitting it again.',
  acknowledge:
    'I checked My records and the risk of duplicate saving before retrying.',
  badUrl: 'Invalid analysis ID. Check My records or start a new analysis.',
  retry: 'Reload',
  invalidYear: 'Enter a tax year from 2000 through the current year in Korea.',
  invalidAmount:
    'Enter nonnegative amounts with up to 13 integer digits and 2 decimal places; no commas or exponent notation.',
  nonTaxableExceedsAnnual:
    'Non-taxable employment income is greater than annual employment income excluding non-taxable income. Check the income items and amounts.',
  tooLarge: 'The combined income exceeds the server limit.',
};

const vi: TaxCopy = {
  intro: 'Xác nhận thu nhập theo năm tính thuế và kiểm tra hồ sơ cần chuẩn bị.',
  notice:
    'Dùng chung người dùng thử 1 trên máy chủ, không phải tài khoản riêng tư. Chỉ thử với dữ liệu giả lập hoặc đã ẩn danh.',
  manual:
    'Nhập và xác nhận thủ công. Không tải tệp, OCR hay tự chuyển dữ liệu trình duyệt.',
  originalText:
    'Phân tích và nguồn được hiển thị bằng ngôn ngữ gốc của máy chủ.',
  incomeStep: 'Năm và thu nhập',
  housingStep: 'Hồ sơ nhà ở',
  reviewStep: 'Kiểm tra và gửi',
  resultStep: 'Kết quả máy chủ',
  year: 'Năm tính thuế',
  annual: 'Tổng thu nhập tiền lương không gồm khoản miễn thuế (KRW)',
  nonTaxable:
    'Thu nhập tiền lương miễn thuế tính vào cơ sở thuế suất cố định (KRW)',
  incomeHint:
    'Đối chiếu chứng từ của năm đó. Không biết thì để trống; chỉ nhập 0 khi đã xác nhận không có. Tối đa 2 chữ số thập phân, không dùng dấu phân cách hàng nghìn.',
  confirm:
    'Tôi đã đối chiếu các khoản thu nhập với chứng từ của năm tính thuế.',
  confirmScenario:
    'Dùng các giá trị giả định này để tính tham khảo, không xác nhận hay lưu thu nhập thực tế.',
  currentYear:
    'Năm hiện tại chưa kết thúc. Không xác nhận số lũy kế hoặc lương dự kiến là thu nhập cuối cùng của cả năm.',
  incomplete:
    'Vẫn có thể kiểm tra hồ sơ khi thu nhập chưa đầy đủ hoặc chưa xác nhận. Khi đó không tính số thuế tham khảo.',
  limit:
    'Chỉ tính tham khảo với giả định 19%. Không tính thuế suất thường, chênh lệch, hoàn thuế, thuế địa phương hay xác định điều kiện áp dụng.',
  housing: 'Bạn có khoản tiết kiệm nhà ở không?',
  homeless: 'Bạn đã xác nhận không sở hữu nhà chưa?',
  proof: 'Bạn có chứng nhận đóng tiết kiệm nhà ở không?',
  deductions: 'Bạn có dùng khoản khấu trừ thu nhập khác không?',
  unknown: 'Không biết / chưa xác nhận',
  yes: 'Có',
  no: 'Không',
  review:
    'Kiểm tra yêu cầu. Lưu phân tích sẽ tạo một bản ghi mới trên máy chủ.',
  save: 'Phân tích và lưu trên máy chủ',
  saving: 'Đang yêu cầu phân tích…',
  simulate: 'Thay đổi giả định',
  runSimulation: 'Mô phỏng (không lưu)',
  simulating: 'Đang yêu cầu mô phỏng…',
  simulationNotice:
    'Chỉ mô phỏng. Không lưu hay sửa phân tích gốc, hồ sơ, bản ghi lương hoặc cơ sở dữ liệu.',
  restore: 'Xem bản gốc đã lưu',
  newAnalysis: 'Phân tích mới',
  saved: 'Phân tích đã lưu',
  simulation: 'Mô phỏng chưa lưu',
  savedDate: 'Ngày lưu phân tích',
  sourceDate: 'Ngày phân tích gốc',
  source: 'ID gốc',
  savedId: 'ID phân tích',
  flat: 'Số tham khảo giả định 19%',
  general: 'Ước tính thuế suất thường',
  difference: 'Chênh lệch thuế',
  notCalculated: 'Chưa tính',
  base: 'Cơ sở thu nhập đã xác nhận',
  payTotal: 'Tổng lương thực nhận đã ghi',
  recorded: 'Số tháng có bản ghi',
  known: 'Số tháng biết số tiền',
  missingMonths: 'Tháng chưa biết số tiền',
  noPay: 'Chưa có bản ghi lương',
  unknownPay: 'Chưa biết số tiền của bản ghi lương',
  payNote:
    'Tổng thực nhận theo bản ghi Paycheck của năm tại thời điểm phân tích, không phải thu nhập tính thuế hay thu nhập đầy đủ cả năm.',
  snapshot: 'Mô phỏng dùng dữ liệu lương và ngày của phân tích gốc.',
  reviewRequired: 'Cần kiểm tra thêm',
  undetermined: 'Chưa xác định',
  confirmedInfo: 'Thông tin đã xác nhận',
  missingInfo: 'Thông tin còn thiếu',
  next: 'Bước tiếp theo',
  evidence: 'Nguồn',
  documents: 'Hồ sơ cần chuẩn bị',
  warnings: 'Phạm vi và lưu ý',
  missingCalculation: 'Lý do chưa tính số tham khảo',
  records: 'Bản ghi của tôi',
  dashboard: 'Tổng quan',
  loading: 'Đang tải phân tích đã lưu…',
  readError: 'Không tải được phân tích. Kiểm tra kết nối và ID.',
  writeError: 'Không xử lý được yêu cầu. Kiểm tra dữ liệu và máy chủ.',
  saveUncertain:
    'Không xác nhận được phản hồi. Máy chủ có thể đã lưu. Hãy kiểm tra bản ghi trước khi gửi lại.',
  acknowledge:
    'Tôi đã kiểm tra bản ghi và nguy cơ lưu trùng trước khi gửi lại.',
  badUrl: 'ID phân tích không hợp lệ. Kiểm tra bản ghi hoặc tạo phân tích mới.',
  retry: 'Tải lại',
  invalidYear: 'Nhập năm từ 2000 đến năm hiện tại tại Hàn Quốc.',
  invalidAmount:
    'Nhập số không âm, tối đa 13 chữ số nguyên và 2 chữ số thập phân; không dùng dấu phân cách hay số mũ.',
  nonTaxableExceedsAnnual:
    'Thu nhập tiền lương miễn thuế lớn hơn tổng thu nhập tiền lương không gồm khoản miễn thuế. Hãy kiểm tra lại các khoản và số tiền đã nhập.',
  tooLarge: 'Tổng thu nhập vượt giới hạn máy chủ.',
};

const zh: TaxCopy = {
  intro: '确认所属年度收入，检查税务资料准备情况。',
  notice:
    '使用服务器上的共享演示用户1，并非私人账户。请使用虚构或去标识化资料测试。',
  manual:
    '本阶段由用户手动输入并确认，不上传文件、不运行OCR，也不自动迁移浏览器记录。',
  originalText: '分析说明和依据显示服务器保存的原文。',
  incomeStep: '年度与收入',
  housingStep: '住房资料',
  reviewStep: '确认并请求',
  resultStep: '服务器结果',
  year: '所属年度',
  annual: '工资总额（不含免税收入，韩元）',
  nonTaxable: '计入单一税率计算基数的免税工资收入（韩元）',
  incomeHint:
    '请对照该年度资料。未知金额请留空，确认没有该项收入才填0。最多两位小数，不使用千位分隔符。',
  confirm: '已对照该所属年度资料确认输入的收入项目。',
  confirmScenario: '按修改后的假设值进行参考计算，不代表确认或保存实际收入。',
  currentYear:
    '当前年度尚未结束。请勿将年内累计金额或预计年薪确认为全年最终收入。',
  incomplete: '收入不完整或未确认时仍可检查准备项目，但不计算参考税额。',
  limit:
    '仅提供假定适用19%的参考金额，不计算一般税率、差额、退税、地方所得税，也不确定实际适用资格。',
  housing: '是否参加住房储蓄？',
  homeless: '是否已确认无住房？',
  proof: '是否持有住房储蓄缴纳证明？',
  deductions: '是否使用其他所得扣除？',
  unknown: '未知 / 未确认',
  yes: '是',
  no: '否',
  review: '请检查请求内容。保存分析将在服务器创建一条新记录。',
  save: '分析并保存到服务器',
  saving: '正在请求分析…',
  simulate: '修改假设条件',
  runSimulation: '运行模拟（不保存）',
  simulating: '正在请求模拟…',
  simulationNotice:
    '仅为模拟。修改假设条件，不保存或更改原分析、个人资料、工资记录及数据库。',
  restore: '查看已保存原记录',
  newAnalysis: '开始新分析',
  saved: '服务器已保存分析',
  simulation: '未保存的模拟',
  savedDate: '分析保存日期',
  sourceDate: '原分析日期',
  source: '原记录ID',
  savedId: '分析ID',
  flat: '假定适用19%的参考金额',
  general: '一般税率估算',
  difference: '税额差额',
  notCalculated: '未计算',
  base: '用户确认的收入基数',
  payTotal: '已记录的实际到账总额',
  recorded: '已记录工资月数',
  known: '已确认金额月数',
  missingMonths: '金额未确认月份',
  noPay: '没有工资记录',
  unknownPay: '工资记录金额未确认',
  payNote:
    '分析时该所属年度Paycheck记录的实际到账总额，不是计税收入或完整全年收入。',
  snapshot: '模拟使用原分析时的工资参考数据和日期。',
  reviewRequired: '需要进一步确认',
  undetermined: '无法判断',
  confirmedInfo: '已确认信息',
  missingInfo: '缺少的信息',
  next: '下一步',
  evidence: '依据',
  documents: '需准备资料',
  warnings: '计算范围与注意事项',
  missingCalculation: '未计算参考金额的原因',
  records: '我的记录',
  dashboard: '总览',
  loading: '正在读取已保存分析…',
  readError: '无法读取已保存分析，请检查服务器连接和分析ID。',
  writeError: '无法处理请求，请检查输入和服务器状态。',
  saveUncertain:
    '无法确认响应，服务器可能已保存。请先检查我的记录，再决定是否重新提交。',
  acknowledge: '已检查我的记录及重复保存风险，确认重新提交。',
  badUrl: '分析ID无效，请检查我的记录或开始新分析。',
  retry: '重新读取',
  invalidYear: '请输入2000年至韩国当前年度之间的年份。',
  invalidAmount:
    '请输入非负金额，最多13位整数、2位小数，不使用千位分隔符或科学计数法。',
  nonTaxableExceedsAnnual:
    '免税工资收入高于不含免税收入的工资总额。请重新核对收入项目和金额。',
  tooLarge: '收入合计超过服务器允许范围。',
};

export const TAX_COPY: Record<'ko' | 'en' | 'vi' | 'zh', TaxCopy> = {
  ko,
  en,
  vi,
  zh,
};
