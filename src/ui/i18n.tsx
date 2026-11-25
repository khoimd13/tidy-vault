/**
 * English / Vietnamese interface. Everything the person reads goes through `t()`; category names
 * and the classifier's (English) reasons are translated here for display.
 */
import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useState } from 'preact/hooks';

export type Lang = 'en' | 'vi';

const en = {
  back: '← Back',
  unknownDate: 'Unknown date',
  undo: 'Undo',
  // Welcome
  welcomeTitle: 'Tidy your Google Photos, safely',
  welcomeBody:
    'Vault Tidy looks through your Google Photos on this computer and suggests photos you might not need. It never deletes anything.',
  promiseLocal: 'Runs on this computer',
  promiseSuggest: 'Only suggests',
  promiseDecide: 'You decide',
  getStarted: 'Get started',
  // Home
  suggestions: 'Suggestions',
  toReview: '{n} to review',
  listAndKept: '{c} on your cleanup list · {k} kept',
  couldFree: 'You could free {size}',
  estimateNote: 'Estimated from typical photo sizes',
  sizesExact: 'Exact sizes from Google Photos',
  sizesUnavailable: "Couldn't get exact sizes ({reason}), so these are estimates.",
  sizesPartial: 'Real sizes for {known} of {total} photos, the rest estimated',
  cleanupList: 'Cleanup list',
  openPhotosPrompt: 'Open Google Photos in this window to find suggestions.',
  openPhotos: 'Open Google Photos',
  lookedAt: 'Looked at {n} photos',
  paused: 'Paused',
  finding: 'Finding suggestions…',
  pause: 'Pause',
  resume: 'Resume',
  stop: 'Stop',
  reviewWhileRuns: 'You can start reviewing while this runs.',
  stopped: ' (stopped)',
  scanAgain: 'Scan again',
  continueScan: 'Continue scan',
  checkNew: 'Check for new photos',
  startOver: 'Start over',
  scanPartial: 'Last scan stopped part-way · {n} photos so far',
  scanComplete: 'Whole view scanned · {n} photos',
  upToDate: "You're up to date: no new photos since your last scan.",
  scanIntro:
    'Vault Tidy scrolls through what Google Photos is showing (your library, a search, or an album) and suggests photos you might not need.',
  findSuggestions: 'Find suggestions',
  mostly: 'Mostly {from} – {to}',
  mostlyOne: 'Mostly {m}',
  why: 'Why: {r}',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  review: 'Review',
  allCaught: 'All caught up. New suggestions show up after your next scan.',
  footer: 'Analysed on this computer. Nothing is deleted.',
  clearData: 'Clear local data',
  clearConfirm: 'Clear all Vault Tidy data on this computer? Your photos are not affected.',
  notConnected: 'Reload the Google Photos tab so Vault Tidy can connect to it.',
  noThumbs:
    "Vault Tidy found {n} photos but couldn't read their thumbnails, so the AI can't look at them. Reload the Google Photos tab and scan again. If this keeps happening, Google Photos has changed its page and Vault Tidy needs an update.",
  noneLoaded:
    "Couldn't load any of the {n} thumbnails, so the AI can't look at them. Check that you're signed in to Google Photos in this browser, then scan again.",
  aiUnavailable:
    "The AI model isn't available, so only screenshot shapes are used. Other categories need it.",
  aiWaking: 'Waking up the AI…',
  aiAnalysing: 'AI is looking at your photos…',
  ofN: '{a} of {b}',
  aiDone: 'AI analysed {n} photos and {v} videos on this computer',
  aiFailed: " ({n} couldn't be loaded)",
  tuned: ' Suggestions are tuned by your {n} choices.',
  reminder: 'Monthly reminder',
  reminderHint: 'A small badge on the icon once a month when there are photos to review',
  // Review
  selected: '{n} selected',
  nothingLeft: 'Nothing left to review here.',
  addN: 'Add {n} to cleanup list',
  add: 'Add to cleanup list',
  keep: 'Keep',
  clearSelection: 'Clear selection',
  selectAll: 'Select all',
  shortcuts: 'Y add · K keep · A all · Esc back',
  likely: 'Likely clutter ({n})',
  likelyHintAll: 'Already selected. Tap any photo you want to keep to untick it.',
  likelyHintSome: 'Tap photos to select them, then add them to your cleanup list or keep them.',
  notSure: 'Not sure ({n})',
  notSureHint: 'Tap the ones that are clutter, or go through them one by one.',
  oneByOne: 'Review one by one',
  toastAdded: '{n} added to your cleanup list',
  toastKept: "{n} kept — won't be suggested again",
  alsoIn: 'Also in: {list}',
  burstHint:
    'Each row is one burst. The sharpest photo stays; the others are selected to go. Tap any you want to keep.',
  kept: 'Kept',
  keptTitle: 'This one stays',
  keptAlt: 'Kept photo, {date}',
  openInPhotos: 'Open in Google Photos',
  viewLarger: 'View larger',
  playVideo: 'Play video',
  videoLoading: 'Loading video…',
  videoFailed: "Couldn't play this video here. Open it in Google Photos instead.",
  videoTooBig: 'This video is too long to play here. Open it in Google Photos instead.',
  select: 'Select',
  isSelected: 'Selected',
  close: 'Close',
  previous: 'Previous',
  next: 'Next',
  // Swipe
  swipeTitle: 'One by one',
  swipeKeep: 'Keep',
  swipeClutter: 'Clutter',
  swipeSkip: 'Skip',
  swipeHelp: '← keep · → clutter · ↓ skip · Z undo · Esc grid',
  swipeDone: 'All done here. Nice work.',
  backToGrid: 'Back to the grid',
  // Cleanup
  cleanupEmpty: 'Nothing here yet. Photos you confirm as clutter are listed here.',
  cleanupIntro:
    "Nothing has been changed in Google Photos. These are the photos you said you don't need.",
  copied: 'Copied',
  copyLinks: 'Copy links',
  exportCsv: 'Export CSV',
  fastest: 'Fastest way to remove them',
  fastestBody:
    'Put them all in one new private album, then delete them from that album in Google Photos with select all. Vault Tidy itself never deletes anything.',
  albumButton: 'Put {n} in a new album (beta)',
  albumName: 'Vault Tidy – to remove {date}',
  albumConfirm:
    'Add {n} photos to a new private album called "{name}" in Google Photos?\n\nNothing is deleted or changed. Removing the album later keeps all its photos.',
  albumWorking: 'Adding photos to the album… keep the Google Photos tab open.',
  albumDone: 'Added {n} photos to “{name}”.',
  albumGoogleCount: ' (Google reports {n})',
  albumStep1: 'Open the album in Google Photos.',
  albumStep2: 'Select all (tick one photo, then Shift+click the last).',
  albumStep3: 'Choose “Move to trash”. Trashed items stay recoverable for 60 days.',
  openAlbums: 'Open your albums in Google Photos ↗',
  albumFailed:
    "Couldn't create the album ({error}). Nothing was deleted. You can still use the links or the CSV.",
  tryAgain: 'Try again',
  openPhotosToUse: 'Open Google Photos in this window to use this.',
  oneByOneRemove: 'Or remove them one by one',
  manualStep1: 'Open a photo with its ↗ link, or find it by date in Google Photos.',
  manualStep2: 'Tick it, then Shift+click another to select everything in between.',
  manualStep3: 'Click the trash icon. Google Photos keeps trashed items for 60 days.',
  remove: 'Remove',
  removedFromList: 'Removed from the list',
};

type Key = keyof typeof en;

const vi: Record<Key, string> = {
  back: '← Quay lại',
  unknownDate: 'Không rõ ngày',
  undo: 'Hoàn tác',
  welcomeTitle: 'Dọn Google Photos an toàn',
  welcomeBody:
    'Vault Tidy xem qua Google Photos ngay trên máy tính này và gợi ý những ảnh bạn có thể không cần. Vault Tidy không bao giờ tự xoá ảnh.',
  promiseLocal: 'Chạy ngay trên máy tính này',
  promiseSuggest: 'Chỉ gợi ý',
  promiseDecide: 'Bạn là người quyết định',
  getStarted: 'Bắt đầu',
  suggestions: 'Gợi ý',
  toReview: '{n} ảnh cần xem',
  listAndKept: '{c} ảnh trong danh sách dọn · {k} ảnh giữ lại',
  couldFree: 'Có thể giải phóng {size}',
  estimateNote: 'Ước tính theo dung lượng ảnh thông thường',
  sizesExact: 'Dung lượng chính xác từ Google Photos',
  sizesUnavailable: 'Không lấy được dung lượng chính xác ({reason}), nên đây là ước tính.',
  sizesPartial: 'Dung lượng thật của {known}/{total} ảnh, phần còn lại là ước tính',
  cleanupList: 'Danh sách dọn',
  openPhotosPrompt: 'Mở Google Photos trong cửa sổ này để tìm gợi ý.',
  openPhotos: 'Mở Google Photos',
  lookedAt: 'Đã xem {n} ảnh',
  paused: 'Đã tạm dừng',
  finding: 'Đang tìm gợi ý…',
  pause: 'Tạm dừng',
  resume: 'Tiếp tục',
  stop: 'Dừng',
  reviewWhileRuns: 'Bạn có thể xem gợi ý ngay trong lúc quét.',
  stopped: ' (đã dừng)',
  scanAgain: 'Quét lại',
  continueScan: 'Quét tiếp',
  checkNew: 'Kiểm tra ảnh mới',
  startOver: 'Quét lại từ đầu',
  scanPartial: 'Lần quét trước dừng giữa chừng · đã có {n} ảnh',
  scanComplete: 'Đã quét hết · {n} ảnh',
  upToDate: 'Không có ảnh mới kể từ lần quét trước.',
  scanIntro:
    'Vault Tidy cuộn qua những gì Google Photos đang hiển thị (thư viện, kết quả tìm kiếm hoặc một album) và gợi ý những ảnh bạn có thể không cần.',
  findSuggestions: 'Tìm gợi ý',
  mostly: 'Chủ yếu {from} – {to}',
  mostlyOne: 'Chủ yếu {m}',
  why: 'Lý do: {r}',
  high: 'Cao',
  medium: 'Vừa',
  low: 'Thấp',
  review: 'Xem lại',
  allCaught: 'Đã xem hết. Gợi ý mới sẽ xuất hiện sau lần quét tới.',
  footer: 'Phân tích ngay trên máy. Không ảnh nào bị xoá.',
  clearData: 'Xoá dữ liệu cục bộ',
  clearConfirm: 'Xoá toàn bộ dữ liệu Vault Tidy trên máy này? Ảnh của bạn không bị ảnh hưởng.',
  notConnected: 'Hãy tải lại thẻ Google Photos để Vault Tidy kết nối được.',
  noThumbs:
    'Vault Tidy tìm thấy {n} ảnh nhưng không đọc được ảnh thu nhỏ, nên AI không xem được. Hãy tải lại thẻ Google Photos rồi quét lại. Nếu vẫn bị, có thể Google Photos đã đổi giao diện và Vault Tidy cần được cập nhật.',
  noneLoaded:
    'Không tải được ảnh thu nhỏ nào trong {n} ảnh, nên AI không xem được. Hãy kiểm tra bạn đã đăng nhập Google Photos trên trình duyệt này rồi quét lại.',
  aiUnavailable:
    'Không dùng được mô hình AI, nên hiện chỉ nhận ảnh chụp màn hình theo khung hình. Các nhóm khác cần AI.',
  aiWaking: 'Đang khởi động AI…',
  aiAnalysing: 'AI đang xem ảnh của bạn…',
  ofN: '{a} / {b}',
  aiDone: 'AI đã phân tích {n} ảnh và {v} video ngay trên máy',
  aiFailed: ' ({n} ảnh không tải được)',
  tuned: ' Gợi ý đã được điều chỉnh theo {n} lựa chọn của bạn.',
  reminder: 'Nhắc hằng tháng',
  reminderHint: 'Hiện một huy hiệu nhỏ trên biểu tượng mỗi tháng khi có ảnh cần xem',
  selected: 'Đã chọn {n}',
  nothingLeft: 'Không còn gì để xem ở đây.',
  addN: 'Thêm {n} ảnh vào danh sách dọn',
  add: 'Thêm vào danh sách dọn',
  keep: 'Giữ lại',
  clearSelection: 'Bỏ chọn',
  selectAll: 'Chọn tất cả',
  shortcuts: 'Y thêm · K giữ · A tất cả · Esc quay lại',
  likely: 'Có thể không cần ({n})',
  likelyHintAll: 'Đã được chọn sẵn. Chạm vào ảnh bạn muốn giữ để bỏ chọn.',
  likelyHintSome: 'Chạm để chọn ảnh, rồi thêm vào danh sách dọn hoặc giữ lại.',
  notSure: 'Chưa chắc ({n})',
  notSureHint: 'Chạm vào những ảnh không cần, hoặc xem lần lượt từng ảnh.',
  oneByOne: 'Xem từng ảnh',
  toastAdded: 'Đã thêm {n} ảnh vào danh sách dọn',
  toastKept: 'Đã giữ {n} ảnh — sẽ không gợi ý lại',
  alsoIn: 'Cũng có trong: {list}',
  burstHint:
    'Mỗi hàng là một loạt ảnh chụp liên tiếp. Ảnh nét nhất được giữ; các ảnh còn lại đã được chọn để bỏ. Chạm vào ảnh bạn muốn giữ.',
  kept: 'Giữ',
  keptTitle: 'Ảnh này được giữ lại',
  keptAlt: 'Ảnh được giữ, {date}',
  openInPhotos: 'Mở trong Google Photos',
  viewLarger: 'Xem ảnh lớn',
  playVideo: 'Phát video',
  videoLoading: 'Đang tải video…',
  videoFailed: 'Không phát được video ở đây. Hãy mở trong Google Photos.',
  videoTooBig: 'Video này quá dài để phát ở đây. Hãy mở trong Google Photos.',
  select: 'Chọn',
  isSelected: 'Đã chọn',
  close: 'Đóng',
  previous: 'Ảnh trước',
  next: 'Ảnh sau',
  swipeTitle: 'Từng ảnh một',
  swipeKeep: 'Giữ',
  swipeClutter: 'Không cần',
  swipeSkip: 'Bỏ qua',
  swipeHelp: '← giữ · → không cần · ↓ bỏ qua · Z hoàn tác · Esc dạng lưới',
  swipeDone: 'Xong rồi. Làm tốt lắm!',
  backToGrid: 'Về dạng lưới',
  cleanupEmpty: 'Chưa có gì. Ảnh bạn xác nhận là không cần sẽ nằm ở đây.',
  cleanupIntro: 'Chưa có gì thay đổi trong Google Photos. Đây là những ảnh bạn nói là không cần.',
  copied: 'Đã sao chép',
  copyLinks: 'Sao chép liên kết',
  exportCsv: 'Xuất CSV',
  fastest: 'Cách xoá nhanh nhất',
  fastestBody:
    'Gom tất cả vào một album riêng tư mới, rồi xoá chúng khỏi album đó trong Google Photos bằng “chọn tất cả”. Bản thân Vault Tidy không bao giờ xoá ảnh.',
  albumButton: 'Đưa {n} ảnh vào album mới (thử nghiệm)',
  albumName: 'Vault Tidy – cần xoá {date}',
  albumConfirm:
    'Thêm {n} ảnh vào album riêng tư mới tên "{name}" trong Google Photos?\n\nKhông ảnh nào bị xoá hay thay đổi. Xoá album sau này vẫn giữ nguyên ảnh.',
  albumWorking: 'Đang thêm ảnh vào album… hãy để thẻ Google Photos mở.',
  albumDone: 'Đã thêm {n} ảnh vào “{name}”.',
  albumGoogleCount: ' (Google báo {n})',
  albumStep1: 'Mở album trong Google Photos.',
  albumStep2: 'Chọn tất cả (chọn một ảnh, rồi Shift+click ảnh cuối).',
  albumStep3: 'Chọn “Chuyển vào thùng rác”. Ảnh trong thùng rác khôi phục được trong 60 ngày.',
  openAlbums: 'Mở album của bạn trong Google Photos ↗',
  albumFailed:
    'Không tạo được album ({error}). Không ảnh nào bị xoá. Bạn vẫn có thể dùng liên kết hoặc tệp CSV.',
  tryAgain: 'Thử lại',
  openPhotosToUse: 'Mở Google Photos trong cửa sổ này để dùng tính năng này.',
  oneByOneRemove: 'Hoặc xoá từng ảnh',
  manualStep1: 'Mở ảnh bằng liên kết ↗, hoặc tìm theo ngày trong Google Photos.',
  manualStep2: 'Chọn ảnh, rồi Shift+click ảnh khác để chọn mọi ảnh ở giữa.',
  manualStep3: 'Bấm biểu tượng thùng rác. Google Photos giữ ảnh đã xoá trong 60 ngày.',
  remove: 'Bỏ khỏi danh sách',
  removedFromList: 'Đã bỏ khỏi danh sách',
};

const CATEGORY_VI: Record<string, string> = {
  screenshots: 'Ảnh chụp màn hình',
  shopping: 'Mua sắm và quảng cáo',
  memes: 'Ảnh chế và ảnh chuyển tiếp',
  documents: 'Hoá đơn và giấy tờ',
  notes: 'Bảng trắng và ghi chú',
  blurry: 'Ảnh mờ, tối hoặc trống',
  accidental: 'Ảnh chụp nhầm',
  duplicates: 'Ảnh gần giống nhau',
  shortVideos: 'Video ngắn hoặc quay nhầm',
  screenRecordings: 'Video quay màn hình',
  longVideos: 'Video dài',
};

/** Vietnamese for the AI's descriptions (see shared/categories.ts). */
const PROMPT_VI: Record<string, string> = {
  'a screenshot of a phone screen': 'ảnh chụp màn hình điện thoại',
  'a screenshot of a mobile app': 'ảnh chụp màn hình ứng dụng',
  'a screenshot of a chat conversation': 'ảnh chụp đoạn chat',
  'a screenshot of a social media post': 'ảnh chụp bài đăng mạng xã hội',
  'a screenshot of a computer screen': 'ảnh chụp màn hình máy tính',
  'a screenshot of a website': 'ảnh chụp trang web',
  'a screenshot of an online shopping website': 'ảnh chụp trang mua sắm trực tuyến',
  'a product listing with a price': 'tin rao sản phẩm có giá',
  'an advertisement for a product': 'quảng cáo sản phẩm',
  'a product photo on a plain white background': 'ảnh sản phẩm trên nền trắng',
  'a sale banner with discount prices': 'banner khuyến mãi giảm giá',
  'a meme': 'ảnh chế',
  'a funny meme with caption text': 'ảnh chế có chữ',
  'a cartoon or comic': 'tranh hoạt hình hoặc truyện tranh',
  'an image with big text on top of a picture': 'ảnh có chữ lớn đè lên',
  'a motivational quote image': 'ảnh trích dẫn truyền cảm hứng',
  'a photo of a receipt': 'ảnh chụp hoá đơn',
  'a photo of a paper document': 'ảnh chụp giấy tờ',
  'a scanned document': 'tài liệu scan',
  'a photo of an invoice or bill': 'ảnh chụp hoá đơn thanh toán',
  'a photo of a printed form': 'ảnh chụp biểu mẫu in',
  'a photo of a whiteboard': 'ảnh chụp bảng trắng',
  'a photo of handwritten notes': 'ảnh chụp ghi chú viết tay',
  'a photo of a presentation slide on a screen': 'ảnh chụp slide trình chiếu',
  'a photo of a notebook page': 'ảnh chụp trang vở',
  'a blurry photo': 'ảnh bị mờ',
  'an out of focus photo': 'ảnh bị lệch nét',
  'a photo with heavy motion blur': 'ảnh bị nhoè do rung tay',
  'a very dark underexposed photo': 'ảnh rất tối, thiếu sáng',
  'a grainy low quality photo': 'ảnh nhiễu, chất lượng thấp',
  'an accidental photo of the floor': 'ảnh chụp nhầm sàn nhà',
  'an accidental photo of the ceiling': 'ảnh chụp nhầm trần nhà',
  'a photo taken by accident inside a pocket': 'ảnh chụp nhầm trong túi',
  'a finger covering the camera lens': 'ngón tay che ống kính',
  'a random photo of a plain wall': 'ảnh chụp bức tường trống',
  'a photo of nothing in particular': 'ảnh không có gì cụ thể',
};

const REASON_VI: Record<string, string> = {
  'Phone-screen shape': 'Khung hình màn hình điện thoại',
  'Screen shape (could be a photo)': 'Khung hình màn hình (có thể là ảnh)',
  'Very blurry': 'Rất mờ',
  'Looks blurry': 'Hơi mờ',
  'Very dark': 'Rất tối',
  'Almost nothing visible': 'Gần như không thấy gì',
  'Washed out': 'Cháy sáng',
  'Keeping the sharpest': 'Giữ ảnh nét nhất',
  'Similar to photos you kept': 'Giống những ảnh bạn đã giữ',
  'Similar to photos you added before': 'Giống những ảnh bạn đã thêm trước đó',
  'Looks recorded by accident': 'Có vẻ quay nhầm',
  'Looks like a screen recording': 'Trông giống video quay màn hình',
};

/** Translates one classifier reason (they are produced in English). */
export function translateReason(reason: string, lang: Lang): string {
  if (lang === 'en') return reason;
  const fixed = REASON_VI[reason];
  if (fixed) return fixed;
  const looks = /^Looks like (.+)$/.exec(reason);
  if (looks?.[1]) {
    const prompt = looks[1].charAt(0).toLowerCase() + looks[1].slice(1);
    return `Trông giống ${PROMPT_VI[prompt] ?? prompt}`;
  }
  const short = /^Only (\d+) seconds long$/.exec(reason);
  if (short) return `Chỉ dài ${short[1]} giây`;
  const long = /^Long video \((\d+) min\)$/.exec(reason);
  if (long) return `Video dài (${long[1]} phút)`;
  const from = /^From (\d{4})$/.exec(reason);
  if (from) return `Từ năm ${from[1]}`;
  const similar = /^Very similar to a photo taken (.+)$/.exec(reason);
  if (similar?.[1]) {
    const min = /^(\d+) min apart$/.exec(similar[1]);
    const when = min
      ? `cách ${min[1]} phút`
      : similar[1] === 'the same day'
        ? 'cùng ngày'
        : similar[1];
    return `Rất giống một ảnh chụp ${when}`;
  }
  return reason;
}

export function interpolate(text: string, vars: Record<string, string | number> = {}): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export interface I18n {
  lang: Lang;
  locale: string;
  setLang: (lang: Lang) => void;
  t: (key: Key, vars?: Record<string, string | number>) => string;
  /** Number formatted for the current language. */
  n: (value: number) => string;
  category: (id: string, fallback?: string) => string;
  reason: (reason: string) => string;
}

function make(lang: Lang, setLang: (l: Lang) => void): I18n {
  const dict = lang === 'vi' ? vi : en;
  const locale = lang === 'vi' ? 'vi-VN' : 'en';
  return {
    lang,
    locale,
    setLang,
    t: (key, vars) => interpolate(dict[key], vars),
    n: (value) => value.toLocaleString(locale),
    category: (id, fallback) => (lang === 'vi' ? CATEGORY_VI[id] : undefined) ?? fallback ?? id,
    reason: (r) => translateReason(r, lang),
  };
}

const I18nContext = createContext<I18n>(make('en', () => undefined));

const STORAGE_KEY = 'lang';

function defaultLang(): Lang {
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('vi')
    ? 'vi'
    : 'en';
}

export function I18nProvider({ children }: { children: ComponentChildren }) {
  const [lang, setLangState] = useState<Lang>(defaultLang());

  useEffect(() => {
    void chrome.storage.local.get(STORAGE_KEY).then((stored: Record<string, unknown>) => {
      const v = stored[STORAGE_KEY];
      if (v === 'en' || v === 'vi') setLangState(v);
    });
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    void chrome.storage.local.set({ [STORAGE_KEY]: next });
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => make(lang, setLang), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
