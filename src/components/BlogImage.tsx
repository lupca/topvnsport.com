import React, { useState } from 'react';

// Ảnh bài viết: tải lỗi thì hiện khung trung tính không chữ, không thay bằng ảnh khác.
export default function BlogImage({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div aria-hidden="true" className={`${className} bg-gray-100`} />;
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}
