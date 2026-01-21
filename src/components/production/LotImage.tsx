import { useSignedUrl } from '@/hooks/useSignedUrl';
import { LazyImage } from '@/components/ui/lazy-image';

interface LotImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  containerClassName?: string;
}

export function LotImage({ src, alt, className = '', containerClassName = '' }: LotImageProps) {
  const { signedUrl, loading } = useSignedUrl(src);

  return (
    <LazyImage
      src={signedUrl}
      alt={alt}
      className={className}
      containerClassName={containerClassName}
      showPlaceholderIcon={true}
    />
  );
}
