import type { UiLocale } from '@/i18n';

const ko = {
  notice:
    '급여 합계와 확인 기록은 서버에 저장된 공유 데모 사용자 1 기준입니다. 브라우저 전용 분석 결과는 포함하지 않습니다.',
  serverText:
    '분석 문구는 서버에 저장된 원문입니다. 프로필·캘린더는 기존 연동을 사용합니다.',
  refresh: '새로고침',
  retry: '다시 시도',
  loadError:
    '대시보드 기록을 불러오지 못했습니다. 백엔드 실행 상태와 연결 주소를 확인한 뒤 다시 시도해 주세요.',
  payTitle: '기록된 실입금 합계',
  payHint:
    '해당 급여 연도에 등록된 실제 입금액만 합산합니다. 세전 연간 소득이나 세액이 아닙니다.',
  recordedMonths: '등록된 급여월',
  knownMonths: '금액 확인된 급여월',
  missingMonths: '금액 미확인 급여월',
  unknownAmount: '등록된 급여의 입금액이 아직 확인되지 않았습니다.',
  recent: '최근 서버 기록',
  allYears:
    '최신 결과와 최근 기록은 전체 연도 기준입니다. 각 기록의 기간을 확인하세요.',
  emptyRecent: '서버에 저장된 확인 기록이 없습니다.',
  noPay: '서버에 저장된 급여 확인 결과가 없습니다.',
  noTax: '서버에 저장된 세금 확인 결과가 없습니다.',
  noExit: '서버에 저장된 출국 확인 결과가 없습니다.',
  taxYear: '귀속연도',
  recordedOn: '기록일',
  nextAction: '다음 행동',
  status: '저장된 상태',
  normal: '일치 확인',
  review: '추가 확인 필요',
  insufficient: '자료 부족',
  notReceived: '입금 미확인',
  unknown: '판단 보류',
  summaryUnavailable: '저장된 분석 요약이 없습니다.',
};

export type DashboardCopy = typeof ko;

export const DASHBOARD_COPY: Record<UiLocale, DashboardCopy> = {
  ko,
  en: {
    notice:
      'Pay totals and check records come from the server for shared demo user 1. Browser-only analysis is not included.',
    serverText:
      'Analysis text is shown in its saved language. Profile and calendar use their existing integrations.',
    refresh: 'Refresh',
    retry: 'Retry',
    loadError:
      'Could not load dashboard records. Check the backend and API address, then retry.',
    payTitle: 'Recorded actual deposits',
    payHint:
      'Only actual deposits recorded for this pay-period year are included. This is not gross annual income or tax.',
    recordedMonths: 'Recorded pay months',
    knownMonths: 'Months with known amounts',
    missingMonths: 'Months with unknown amounts',
    unknownAmount:
      'Deposit amounts for the recorded pay months are not yet known.',
    recent: 'Recent server records',
    allYears:
      'Latest results and recent records cover all years. Check each record’s period.',
    emptyRecent: 'No check records saved on the server.',
    noPay: 'No saved paycheck result.',
    noTax: 'No saved tax result.',
    noExit: 'No saved exit result.',
    taxYear: 'Tax year',
    recordedOn: 'Recorded on',
    nextAction: 'Next action',
    status: 'Saved status',
    normal: 'Amounts match',
    review: 'Review required',
    insufficient: 'More information needed',
    notReceived: 'Deposit not confirmed',
    unknown: 'Undetermined',
    summaryUnavailable: 'No saved analysis summary.',
  },
  vi: {
    notice:
      'Tổng tiền và bản ghi kiểm tra được lấy từ máy chủ cho người dùng demo chung 1. Không bao gồm phân tích chỉ lưu trên trình duyệt.',
    serverText:
      'Nội dung phân tích giữ nguyên ngôn ngữ đã lưu. Hồ sơ và lịch dùng kết nối hiện có.',
    refresh: 'Làm mới',
    retry: 'Thử lại',
    loadError:
      'Không tải được bản ghi tổng quan. Kiểm tra backend và địa chỉ API, rồi thử lại.',
    payTitle: 'Tổng tiền thực nhận đã ghi nhận',
    payHint:
      'Chỉ cộng tiền thực nhận của kỳ lương thuộc năm này. Đây không phải thu nhập gộp năm hay tiền thuế.',
    recordedMonths: 'Tháng lương đã ghi nhận',
    knownMonths: 'Tháng đã biết số tiền',
    missingMonths: 'Tháng chưa biết số tiền',
    unknownAmount:
      'Chưa xác định được tiền thực nhận của các tháng lương đã ghi nhận.',
    recent: 'Bản ghi máy chủ gần đây',
    allYears:
      'Kết quả mới nhất và bản ghi gần đây gồm tất cả các năm. Hãy kiểm tra kỳ của từng bản ghi.',
    emptyRecent: 'Chưa có bản ghi kiểm tra trên máy chủ.',
    noPay: 'Chưa có kết quả kiểm tra lương đã lưu.',
    noTax: 'Chưa có kết quả thuế đã lưu.',
    noExit: 'Chưa có kết quả xuất cảnh đã lưu.',
    taxYear: 'Năm tính thuế',
    recordedOn: 'Ngày ghi nhận',
    nextAction: 'Bước tiếp theo',
    status: 'Trạng thái đã lưu',
    normal: 'Số tiền khớp',
    review: 'Cần kiểm tra thêm',
    insufficient: 'Thiếu thông tin',
    notReceived: 'Chưa xác nhận tiền vào',
    unknown: 'Chưa xác định',
    summaryUnavailable: 'Không có tóm tắt phân tích đã lưu.',
  },
  zh: {
    notice:
      '工资合计和检查记录来自共享演示用户1的服务器数据。不包含仅保存在浏览器中的分析结果。',
    serverText: '分析内容按保存的原文显示。个人资料和日历继续使用现有接口。',
    refresh: '刷新',
    retry: '重试',
    loadError: '无法加载仪表盘记录。请检查后端运行状态和API地址后重试。',
    payTitle: '已记录的实际到账合计',
    payHint: '仅合计本工资年度已记录的实际到账金额，并非税前年收入或税额。',
    recordedMonths: '已记录工资月份',
    knownMonths: '金额已确认月份',
    missingMonths: '金额未确认月份',
    unknownAmount: '已记录工资月份的到账金额尚未确认。',
    recent: '最近的服务器记录',
    allYears: '最新结果和最近记录涵盖所有年份，请查看各记录的期间。',
    emptyRecent: '服务器暂无已保存的检查记录。',
    noPay: '暂无已保存的工资检查结果。',
    noTax: '暂无已保存的税务结果。',
    noExit: '暂无已保存的离境结果。',
    taxYear: '税务年度',
    recordedOn: '记录日期',
    nextAction: '下一步',
    status: '已保存的状态',
    normal: '金额一致',
    review: '需要进一步确认',
    insufficient: '资料不足',
    notReceived: '到账未确认',
    unknown: '暂无法判断',
    summaryUnavailable: '暂无已保存的分析摘要。',
  },
};

export function dashboardStatusLabel(
  status: string | null,
  copy: DashboardCopy,
): string {
  switch (status) {
    case 'NORMAL':
      return copy.normal;
    case 'REVIEW_REQUIRED':
    case 'EXPLANATION_REQUIRED':
    case 'CONFIRMATION_REQUIRED':
      return copy.review;
    case 'INSUFFICIENT_DATA':
      return copy.insufficient;
    case 'NOT_RECEIVED':
      return copy.notReceived;
    case 'UNKNOWN':
    case null:
      return copy.unknown;
    default:
      return status;
  }
}

/** Preserve cents and a confirmed zero; never treat unknown as zero. */
export function dashboardMoney(value: number | null, locale: UiLocale): string {
  return value === null
    ? '—'
    : new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'KRW',
        maximumFractionDigits: 2,
      }).format(value);
}
