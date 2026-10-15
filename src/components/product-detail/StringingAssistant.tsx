import React from 'react';
import { Sparkles } from 'lucide-react';
import { Product, StringOption, TierVariation } from '../../types';
import { variantUnitPrice } from '../../features/cart/cartSlice';
import { aggregateStock, formatStringMeta, getTensionTooltip, inferStringMeta, isNoStringOption } from './helpers';

interface StringingAssistantProps {
  product: Product;
  hasStringingVariation: boolean;
  stringingVariation?: TierVariation;
  stringingTierIndex?: number;
  isDynamicStringingActive: boolean;
  activeStringValue: string;
  selectedTier1: string;
  selectedTier2: string;
  stringOptions: StringOption[];
  tension: number;
  onSetSelectedTier1: (value: string) => void;
  onSetSelectedTier2: (value: string) => void;
  onSetTension: (value: number) => void;
}

export default function StringingAssistant({
  product,
  hasStringingVariation,
  stringingVariation,
  stringingTierIndex,
  isDynamicStringingActive,
  activeStringValue,
  selectedTier1,
  selectedTier2,
  stringOptions,
  tension,
  onSetSelectedTier1,
  onSetSelectedTier2,
  onSetTension
}: StringingAssistantProps) {
  // Đan cước chỉ bán qua phân loại 'Loại Cước' (giá nằm trong giá biến thể).
  // Không có phân loại này thì không có dịch vụ đan cước rời (STOR-016).
  if (!hasStringingVariation) {
    return null;
  }

  const isEnabled = isDynamicStringingActive;

  const otherTierIndex = stringingTierIndex === 1 ? 2 : 1;
  const otherSelectedValue = otherTierIndex === 1 ? selectedTier1 : selectedTier2;
  const otherTier = product.tier_variations?.find((tier) => tier.tier_index === otherTierIndex);

  const resolveVariantPrice = (targetOption: string, otherSelected: string = otherSelectedValue): number | undefined => {
    if (!stringingVariation || !stringingTierIndex) {
      return undefined;
    }

    const matched = product.variants?.find((variant) => {
      const tier1Match = stringingTierIndex !== 1 || variant.tier_1_option === targetOption;
      const tier2Match = stringingTierIndex !== 2 || variant.tier_2_option === targetOption;

      const hasOtherTier = !!otherTier;
      const otherMatch =
        !hasOtherTier ||
        (otherTierIndex === 1
          ? variant.tier_1_option === otherSelected
          : variant.tier_2_option === otherSelected);

      return tier1Match && tier2Match && otherMatch;
    });

    // Cùng luật giá với giỏ/trang chi tiết: computedPrice ?? price, chỉ khi price > 0.
    return matched ? variantUnitPrice(matched) ?? undefined : undefined;
  };

  // Chênh giá của một mã cước so với giá trị không-đan, theo từng màu. Chưa
  // chọn màu: chỉ trả số khi MỌI màu đều có chênh xác định và bằng nhau.
  const diffFor = (optionName: string, noStringOption: string | undefined): number | undefined => {
    if (!noStringOption) return undefined;
    const colors = otherTier && !otherSelectedValue ? otherTier.options : [otherSelectedValue];
    const diffs = colors.map((color) => {
      const withString = resolveVariantPrice(optionName, color);
      const without = resolveVariantPrice(noStringOption, color);
      return withString !== undefined && without !== undefined ? withString - without : undefined;
    });
    return diffs.length > 0 && diffs[0] !== undefined && diffs.every((d) => d === diffs[0]) ? diffs[0] : undefined;
  };

  const selectString = (value: string) =>
    stringingTierIndex === 1 ? onSetSelectedTier1(value) : onSetSelectedTier2(value);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-brand-primary" />
          <div>
            <h3 className="font-bold text-sm text-gray-900 uppercase">Dịch vụ đan cước chuyên nghiệp</h3>
            <p className="text-[11px] text-gray-400">Chọn cước và lực căng tùy biến theo trình độ</p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(event) => {
              const checked = event.target.checked;

              if (!stringingVariation || !stringingTierIndex) {
                return;
              }

              // Bật -> tầng cước về rỗng, khách tự chọn mã cước. Tắt -> giá trị
              // không-đan (tầng không có giá trị này thì lấy lựa chọn đầu).
              const noStringOption =
                stringingVariation.options.find((option) => isNoStringOption(option)) ||
                stringingVariation.options[0];
              const targetOption = checked ? '' : noStringOption;

              if (targetOption === undefined) {
                return;
              }

              selectString(targetOption);
            }}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary" />
        </label>
      </div>

      {isEnabled && (
        <div className="space-y-4 animate-in slide-in-from-top-3 duration-200">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase text-gray-500">Bước 1: Chọn mẫu dây cước</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
              {stringingVariation && (
                stringingVariation.options
                  .filter((option) => !isNoStringOption(option))
                  .map((optionName) => {
                    const noStringOption = stringingVariation.options.find((option) => isNoStringOption(option));
                    const diffPrice = diffFor(optionName, noStringOption);
                    const stock = stringingTierIndex === 1
                      ? aggregateStock(product, optionName, selectedTier2)
                      : aggregateStock(product, selectedTier1, optionName);
                    const isHet = stock.kind === 'known' && stock.stock <= 0;
                    const isBlocked = isHet || stock.kind === 'none';
                    const metadata = formatStringMeta(inferStringMeta(optionName, stringOptions));
                    const isSelected = activeStringValue === optionName;

                    return (
                      <div
                        key={optionName}
                        aria-disabled={isBlocked ? 'true' : undefined}
                        onClick={() => {
                          if (isBlocked) return;
                          selectString(optionName);
                        }}
                        className={`p-2.5 rounded-lg border transition flex justify-between items-center ${
                          isBlocked
                            ? 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'bg-brand-light/50 border-brand-primary cursor-pointer'
                            : 'bg-white border-gray-100 hover:border-gray-200 cursor-pointer'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-xs text-gray-900">{optionName}</p>
                          {/* Không khớp được sản phẩm cước thật -> không bịa loại/độ dày, chỉ hiện tên lựa chọn */}
                          {metadata && (
                            <p className="text-[10px] text-gray-400 font-mono">{metadata}</p>
                          )}
                        </div>
                        <span className="text-xs font-extrabold text-brand-primary">
                          {isHet ? 'Hết' : diffPrice === undefined ? '' : diffPrice > 0 ? `+${diffPrice.toLocaleString('vi-VN')}đ` : 'Miễn phí'}
                        </span>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase text-gray-500">Bước 2: Chọn lực căng (Số Kg/Lbs)</label>
              <span className="text-base font-extrabold text-brand-primary font-mono">{tension.toFixed(1)} kg</span>
            </div>

            <input
              type="range"
              min="9"
              max="13"
              step="0.5"
              value={tension}
              onChange={(event) => onSetTension(parseFloat(event.target.value))}
              className="w-full accent-brand-primary cursor-pointer h-1.5 bg-gray-100 rounded-lg appearance-none"
            />

            <div className="flex justify-between text-[10px] text-gray-400 font-mono px-1">
              <span>9 kg (Học sinh)</span>
              <span>10.5 kg (Mức căng phổ thông)</span>
              <span>13 kg (VĐV Chuyên nghiệp)</span>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-[11px] text-gray-600 leading-relaxed flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
              <span>{getTensionTooltip(tension)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
