import type { UiLocale } from '@/i18n';

// Screen-only additions: use the existing locale without changing shared dictionaries.
const ko = {
  notice:
    '서버에 저장된 데모 사용자 1의 기록입니다. 브라우저 전용 기록은 포함하지 않으며, 서버 기록 삭제는 아직 지원하지 않습니다.',
  refresh: '새로고침',
  retry: '다시 시도',
  loadError:
    '서버 기록을 불러오지 못했습니다. 백엔드 실행 상태와 연결 주소를 확인한 뒤 다시 시도해 주세요.',
  detailsError: '저장된 세금 상세 내용을 불러오지 못했습니다.',
  empty: '이 분류에 해당하는 서버 저장 기록이 없습니다.',
  recordedOn: '기록일',
  receivedPay: '실제 입금액',
  taxYear: '귀속연도',
  exitDate: '예상 출국일',
  readiness: '준비도 점수',
  details: '저장된 세금 상세 카드',
  noCards: '저장된 상세 카드가 없습니다.',
  summaryUnavailable: '저장된 분석 요약이 없습니다.',
  status: '저장된 상태',
  normal: '일치 확인',
  review: '추가 확인 필요',
  insufficient: '자료 부족',
  notReceived: '입금 미확인',
  unknown: '판단 보류',
  serverText: '분석 문구는 서버에 저장된 원문으로 표시됩니다.',
};

export type RecordsCopy = typeof ko;

export const RECORDS_COPY: Record<UiLocale, RecordsCopy> = {
  ko,
  en: {
    notice:
      'Server records for shared demo user 1. Browser-only records are not included. Deleting server records is not supported yet.',
    refresh: 'Refresh',
    retry: 'Retry',
    loadError:
      'Could not load server records. Check the backend and API address, then retry.',
    detailsError: 'Could not load the saved tax details.',
    empty: 'No server records in this category.',
    recordedOn: 'Recorded on',
    receivedPay: 'Actual deposit',
    taxYear: 'Tax year',
    exitDate: 'Expected departure',
    readiness: 'Readiness score',
    details: 'Saved tax detail cards',
    noCards: 'No saved detail cards.',
    summaryUnavailable: 'No saved analysis summary.',
    status: 'Saved status',
    normal: 'Amounts match',
    review: 'Review required',
    insufficient: 'More information needed',
    notReceived: 'Deposit not confirmed',
    unknown: 'Undetermined',
    serverText: 'Analysis text is shown in its original saved language.',
  },
  vi: {
    notice:
      'Bản ghi máy chủ của người dùng demo chung 1. Không bao gồm bản ghi chỉ lưu trong trình duyệt. Chưa hỗ trợ xóa bản ghi máy chủ.',
    refresh: 'Làm mới',
    retry: 'Thử lại',
    loadError:
      'Không tải được bản ghi máy chủ. Kiểm tra backend và địa chỉ API, rồi thử lại.',
    detailsError: 'Không tải được chi tiết thuế đã lưu.',
    empty: 'Không có bản ghi máy chủ trong loại này.',
    recordedOn: 'Ngày ghi nhận',
    receivedPay: 'Tiền thực nhận',
    taxYear: 'Năm tính thuế',
    exitDate: 'Ngày xuất cảnh dự kiến',
    readiness: 'Điểm chuẩn bị',
    details: 'Thẻ chi tiết thuế đã lưu',
    noCards: 'Không có thẻ chi tiết đã lưu.',
    summaryUnavailable: 'Không có tóm tắt phân tích đã lưu.',
    status: 'Trạng thái đã lưu',
    normal: 'Số tiền khớp',
    review: 'Cần kiểm tra thêm',
    insufficient: 'Thiếu thông tin',
    notReceived: 'Chưa xác nhận tiền vào',
    unknown: 'Chưa xác định',
    serverText: 'Nội dung phân tích được hiển thị bằng ngôn ngữ gốc đã lưu.',
  },
  zh: {
    notice:
      '共享演示用户1的服务器记录。不包含仅保存在浏览器中的记录，暂不支持删除服务器记录。',
    refresh: '刷新',
    retry: '重试',
    loadError: '无法加载服务器记录。请检查后端运行状态和API地址后重试。',
    detailsError: '无法加载已保存的税务详情。',
    empty: '此类别暂无服务器记录。',
    recordedOn: '记录日期',
    receivedPay: '实际到账金额',
    taxYear: '税务年度',
    exitDate: '预计离境日期',
    readiness: '准备度评分',
    details: '已保存的税务详情卡片',
    noCards: '暂无已保存的详情卡片。',
    summaryUnavailable: '暂无已保存的分析摘要。',
    status: '已保存的状态',
    normal: '金额一致',
    review: '需要进一步确认',
    insufficient: '资料不足',
    notReceived: '到账未确认',
    unknown: '暂无法判断',
    serverText: '分析内容按服务器保存的原文显示。',
  },
};

export function recordStatusLabel(
  status: string | null,
  copy: RecordsCopy,
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
      // Do not infer meaning for a new status from another domain.
      return status;
  }
}
