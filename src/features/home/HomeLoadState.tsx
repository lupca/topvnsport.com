// STOR-053: lỗi tải sản phẩm và shop chưa có sản phẩm là hai câu khác nhau.
export default function HomeLoadState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <section className="max-w-xl mx-auto px-4 py-16 text-center">
      {error ? (
        <div role="alert" className="space-y-4">
          <p className="text-base font-medium text-ink-primary">Cửa hàng chưa tải được sản phẩm lúc này. Vui lòng thử lại sau.</p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-ink-primary text-white px-5 py-2 text-sm font-bold hover:opacity-90 transition"
          >
            Thử lại
          </button>
        </div>
      ) : (
        <p role="status" className="text-base font-medium text-ink-primary">Cửa hàng chưa có sản phẩm nào đang bán.</p>
      )}
    </section>
  );
}
