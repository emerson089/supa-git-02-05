import { useSignedUrl } from '@/hooks/useSignedUrl';

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&q=80&w=200';

interface LotImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
}

export function LotImage({ src, alt, className = '' }: LotImageProps) {
  const { signedUrl } = useSignedUrl(src);

  return (
    <img 
      src={signedUrl || DEFAULT_IMAGE} 
      alt={alt} 
      className={className}
    />
  );
}
