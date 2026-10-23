import React, { useRef, useState } from 'react';
import { AdminUnit } from '../services/sport-api/types';
import { normalizeSearchText } from './Header';

interface AdminUnitPickerProps {
  label: string;
  placeholder: string;
  units: AdminUnit[] | null;
  value: AdminUnit | null;
  query: string;
  onQueryChange: (query: string) => void;
  onChange: (unit: AdminUnit | null) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  disabled?: boolean;
}

// Ô chọn có tìm không dấu: gõ -> lọc danh sách (inline, cuộn được), bấm một dòng
// để chọn. Không có danh sách dự phòng: lỗi tải -> lời lỗi + nút "Thử lại".
export default function AdminUnitPicker({
  label, placeholder, units, value, query, onQueryChange, onChange, loading, error, onRetry, disabled,
}: AdminUnitPickerProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Đã chọn (chữ trong ô = tên đã chọn) -> mở lại thấy đủ danh sách để đổi.
  const needle = value && query === value.name ? '' : normalizeSearchText(query);
  const options = (units ?? []).filter(u => normalizeSearchText(u.name).includes(needle));

  const choose = (unit: AdminUnit) => {
    onChange(unit);
    onQueryChange(unit.name);
    setOpen(false);
  };

  return (
    <div
      className="space-y-1"
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}
    >
      <label className="text-[10px] font-bold text-gray-400 uppercase">{label} *</label>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        required
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        onChange={e => {
          onQueryChange(e.target.value);
          if (value && e.target.value !== value.name) onChange(null);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          // Chờ bàn phím ảo hiện rồi đưa ô lên đầu vùng cuộn để danh sách không bị che.
          setTimeout(() => inputRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), 250);
        }}
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-hidden focus:border-brand-primary focus:bg-white transition disabled:opacity-50"
      />
      {loading && <p className="text-[11px] text-gray-500">Đang tải…</p>}
      {error && (
        <div className="flex items-center gap-2 text-[11px] text-red-600 font-semibold" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onRetry} className="underline text-brand-primary">Thử lại</button>
        </div>
      )}
      {open && !error && !loading && units && (
        <ul role="listbox" aria-label={label} className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
          {options.length === 0 && <li className="px-3 py-2 text-[11px] text-gray-400">Không có kết quả</li>}
          {options.map(u => (
            <li
              key={u.code}
              role="option"
              aria-selected={value?.code === u.code}
              onMouseDown={e => e.preventDefault()}
              onClick={() => choose(u)}
              className={`px-3 py-2.5 text-xs cursor-pointer hover:bg-gray-50 ${value?.code === u.code ? 'font-bold text-brand-primary' : 'text-gray-800'}`}
            >
              {u.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
