import { useT } from '../../i18n';
import { Skeleton } from '../../ui/Skeleton';

export function HomeSkeleton() {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-6 py-6 sm:py-10" role="status" aria-label={t('loadingData')}>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48 md:col-span-2 xl:col-span-1" />
      </div>
    </div>
  );
}
