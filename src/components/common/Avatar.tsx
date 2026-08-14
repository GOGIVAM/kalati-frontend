interface AvatarProps {
  /** Photo de l'agent si le référentiel en fournit une. */
  src?: string | null;
  size?: number;
  className?: string;
  alt?: string;
}

/** Avatar par défaut : silhouette neutre, comme les messageries grand public.
    Aucune initiale — le visuel reste identique pour tous les agents sans photo. */
export function Avatar({ src, size = 36, className = '', alt = '' }: AvatarProps) {
  const style = { width: size, height: size } as const;

  if (src) {
    return <img className={`k-avatar ${className}`} style={style} src={src} alt={alt} />;
  }

  return (
    <span className={`k-avatar k-avatar--placeholder ${className}`} style={style} aria-hidden="true">
      <svg viewBox="0 0 40 40" width="100%" height="100%" focusable="false">
        <circle cx="20" cy="15" r="6.6" fill="currentColor" />
        <path
          d="M20 24c-6.1 0-11 3.9-11 8.7V34h22v-1.3C31 27.9 26.1 24 20 24Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
