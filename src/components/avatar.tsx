'use client';
import Image from 'next/image';
import { useState } from 'react';
export function Avatar({
  name,
  image,
  large = false,
}: {
  name: string;
  image?: string | null;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={large ? 'profile-avatar' : 'avatar'}>
      {image && /^https?:\/\//.test(image) && !failed ? (
        <Image
          src={image}
          width={large ? 88 : 34}
          height={large ? 88 : 34}
          alt={name}
          unoptimized
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
        />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </div>
  );
}
