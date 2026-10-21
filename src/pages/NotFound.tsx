import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <div className="page">
      <EmptyState icon={<Compass size={26} />} title="Seite nicht gefunden" text="Diese Adresse existiert in GymBase nicht." action={{ label: 'Zum Dashboard', to: '/' }} />
    </div>
  );
}
