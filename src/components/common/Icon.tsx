import {
  Swords,
  Users,
  IdCard,
  Store,
  Repeat,
  Hammer,
  Sparkles,
  Shield,
  Crosshair,
  MessageCircle,
  Orbit,
  Crown,
  Zap,
  Coins,
  Gem,
  User,
  Bell,
  Settings,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Play,
  RotateCcw,
  FlagOff,
  Globe,
  Megaphone,
  Terminal,
  Send,
  X,
  Lock,
  Map,
  Heart,
  type LucideProps,
} from 'lucide-react';
import type { FC } from 'react';

const REGISTRY: Record<string, FC<LucideProps>> = {
  swords: Swords,
  users: Users,
  'id-card': IdCard,
  store: Store,
  repeat: Repeat,
  hammer: Hammer,
  sparkles: Sparkles,
  shield: Shield,
  crosshair: Crosshair,
  'message-circle': MessageCircle,
  orbit: Orbit,
  crown: Crown,
  zap: Zap,
  coins: Coins,
  gem: Gem,
  user: User,
  bell: Bell,
  settings: Settings,
  'book-open': BookOpen,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  play: Play,
  'rotate-ccw': RotateCcw,
  'flag-off': FlagOff,
  globe: Globe,
  megaphone: Megaphone,
  terminal: Terminal,
  send: Send,
  x: X,
  lock: Lock,
  map: Map,
  heart: Heart,
};

interface IconProps extends LucideProps {
  name: string;
}

export function Icon({ name, ...props }: IconProps) {
  const Cmp = REGISTRY[name];
  if (!Cmp) return null;
  return <Cmp {...props} />;
}
