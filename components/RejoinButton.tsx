'use client';

// RejoinButton (TRD 4.5) — ⭐v3 원탭 재연결 버튼
import BigButton from './BigButton';
import { COPY } from '@/lib/copy.ko';

interface RejoinButtonProps {
  nickname: string;
  onRejoin: () => void;
  loading?: boolean;
}

export default function RejoinButton({ nickname, onRejoin, loading }: RejoinButtonProps) {
  return (
    <BigButton
      icon="🔄"
      label={COPY.rejoin(nickname)}
      sub={loading ? COPY.rejoinWaiting : undefined}
      onClick={onRejoin}
      disabled={loading}
      className={loading ? 'animate-breathe' : ''}
    />
  );
}
