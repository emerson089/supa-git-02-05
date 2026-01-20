import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Package } from 'lucide-react';

interface LazyImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  containerClassName?: string;
  placeholderClassName?: string;
  onLoad?: () => void;
  onClick?: () => void;
  showPlaceholderIcon?: boolean;
}

export function LazyImage({
  src,
  alt,
  className,
  containerClassName,
  placeholderClassName,
  onLoad,
  onClick,
  showPlaceholderIcon = true,
}: LazyImageProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px', // Pre-load 100px before visible
        threshold: 0,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Reset states when src changes
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  const showSkeleton = !isLoaded && isVisible && src;
  const showPlaceholder = !src || hasError;

  return (
    <div 
      ref={containerRef} 
      className={cn('relative overflow-hidden bg-muted/30', containerClassName)}
      onClick={onClick}
    >
      {/* Skeleton loading state */}
      {showSkeleton && (
        <div 
          className={cn(
            'absolute inset-0 bg-muted animate-pulse flex items-center justify-center',
            placeholderClassName
          )}
        >
          {showPlaceholderIcon && (
            <Package className="h-6 w-6 text-muted-foreground/30" />
          )}
        </div>
      )}

      {/* Placeholder for no image or error */}
      {showPlaceholder && (
        <div 
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted/40 to-muted/20',
            placeholderClassName
          )}
        >
          {showPlaceholderIcon && (
            <div className="text-muted-foreground/50 text-center">
              <Package className="h-8 w-8 mx-auto opacity-50" />
            </div>
          )}
        </div>
      )}

      {/* Actual image - only render when visible */}
      {isVisible && src && !hasError && (
        <img
          src={src}
          alt={alt}
          className={cn(
            'transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0',
            className
          )}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          decoding="async"
        />
      )}
    </div>
  );
}
