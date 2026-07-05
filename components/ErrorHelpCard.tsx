'use client';

// ErrorHelpCard (TRD 7.5) — 실패 원인별 쉬운 해결 가이드 + [다시 해보기]
import { COPY } from '@/lib/copy.ko';
import type { FailReason } from '@/lib/copy.ko';
import BigButton from './BigButton';

interface ErrorHelpCardProps {
  reason: FailReason;
  onRetry: () => void;
  onReportShown?: (reason: FailReason) => void;
}

interface ErrorContent {
  icon: string;
  title: string;
  help: string;
  steps: string[];
}

const ERROR_MAP: Record<FailReason, ErrorContent> = {
  'ice-failed': {
    icon: '📶',
    title: COPY.err_ice_failed,
    help: COPY.err_ice_failed_help,
    steps: [
      '두 기기를 같은 Wi-Fi에 연결해 보세요',
      '그래도 안 되면 아래 버튼을 눌러주세요',
      '자동으로 다른 방법을 시도해 볼게요',
    ],
  },
  'permission-denied': {
    icon: '🚫',
    title: COPY.err_permission_denied,
    help: COPY.err_permission_denied_help,
    steps: [
      '아래 버튼을 누르면 다시 물어볼게요',
      '"시작" 또는 "허용"을 눌러주세요',
    ],
  },
  'room-expired': {
    icon: '⏰',
    title: COPY.err_room_expired,
    help: COPY.err_room_expired_help,
    steps: ['컴퓨터(PC)에서 새 번호를 만들어 주세요', '새 번호로 다시 입력해 주세요'],
  },
  'wrong-code': {
    icon: '🔢',
    title: COPY.err_wrong_code,
    help: COPY.err_wrong_code_help,
    steps: [
      'PC 화면의 큰 숫자 6개를 다시 봐주세요',
      '아래 버튼을 누르고 다시 입력해 주세요',
    ],
  },
  timeout: {
    icon: '⏳',
    title: COPY.err_timeout,
    help: COPY.err_timeout_help,
    steps: [
      '두 기기 모두 인터넷에 연결되어 있는지 확인해 주세요',
      '아래 버튼을 눌러 다시 시도해 보세요',
    ],
  },
};

export default function ErrorHelpCard({ reason, onRetry, onReportShown }: ErrorHelpCardProps) {
  const content = ERROR_MAP[reason];

  // 표시 시 측정 보고
  if (onReportShown) {
    onReportShown(reason);
  }

  return (
    <div className="w-full max-w-md mx-auto bg-surface rounded-big p-6 flex flex-col gap-5 border border-line">
      {/* 아이콘 + 제목 */}
      <div className="flex items-center gap-3">
        <span className="text-5xl" aria-hidden="true">{content.icon}</span>
        <div>
          <h2 className="text-title text-error flex items-center gap-2">
            <span aria-hidden="true">⚠</span> {content.title}
          </h2>
          <p className="text-body text-muted mt-1">{content.help}</p>
        </div>
      </div>

      {/* 해결 단계 */}
      <ol className="flex flex-col gap-3">
        {content.steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-body">
            <span className="w-8 h-8 rounded-full bg-accent text-accent-ink flex items-center justify-center text-button shrink-0">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <BigButton icon="🔄" label={COPY.retry} onClick={onRetry} />
    </div>
  );
}
