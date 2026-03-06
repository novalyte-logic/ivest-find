interface InvestorAvatarProps {
  imageUrl?: string;
  name: string;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.trim()[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function InvestorAvatar({ imageUrl, name, className = '' }: InvestorAvatarProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={className}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`flex items-center justify-center rounded-full bg-zinc-800 font-semibold text-zinc-300 ${className}`}
    >
      {getInitials(name)}
    </div>
  );
}
