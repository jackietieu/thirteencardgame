/**
 * Client-side i18n for the web app.
 *
 * Locales: English, Vietnamese, Simplified Chinese (Mandarin) and Traditional
 * Chinese with Cantonese phrasing (Hong Kong). The engine package keeps its
 * own English strings (it is the locked spec); the web layer re-renders
 * engine-derived text (move descriptions, error reasons, card names) through
 * the helpers below, keyed off the same structured data the engine exports.
 */
import { cardLabel, cardName, comboTop, rankLabel, type Card, type Move, type PassMove } from '@thirteen/engine';

export type Locale = 'en' | 'vi' | 'zh-Hans' | 'zh-Hant';

export const LOCALES: readonly { code: Locale; label: string; htmlLang: string }[] = [
	{ code: 'en', label: 'English', htmlLang: 'en' },
	{ code: 'vi', label: 'Tiếng Việt', htmlLang: 'vi' },
	{ code: 'zh-Hans', label: '简体中文', htmlLang: 'zh-Hans' },
	{ code: 'zh-Hant', label: '廣東話', htmlLang: 'zh-Hant' }
];

const LOCALE_KEY = 'thirteen.locale';

function detect(): Locale {
	try {
		const saved = localStorage.getItem(LOCALE_KEY) as Locale | null;
		if (saved && LOCALES.some((l) => l.code === saved)) return saved;
	} catch {
		// localStorage unavailable — fall through to English.
	}
	return 'en';
}

/** Reactive locale holder; mutate only via setLocale(). */
export const i18n = $state<{ locale: Locale }>({ locale: detect() });

export function setLocale(code: Locale) {
	i18n.locale = code;
	try {
		localStorage.setItem(LOCALE_KEY, code);
	} catch {
		// Non-fatal: language just won't persist.
	}
	if (typeof document !== 'undefined') {
		document.documentElement.lang = LOCALES.find((l) => l.code === code)?.htmlLang ?? 'en';
	}
}

// Keep <html lang> in sync on first load without a user switch.
if (typeof document !== 'undefined') {
	document.documentElement.lang = LOCALES.find((l) => l.code === i18n.locale)?.htmlLang ?? 'en';
}

type Params = Record<string, string | number>;

const MESSAGES: Record<Locale, Record<string, string>> = {
	en: {
		'title.home': 'Thirteen — Tiến Lên',
		'title.play': 'Play — Thirteen',
		'title.online': 'Online — Thirteen',
		'title.rules': 'Rules — Thirteen',
		'home.tagline': 'Tiến Lên — 13 cards, against bots or friends.',
		'home.cta.bots': 'New game vs bots',
		'home.cta.online': 'Play online',
		'nav.rules': 'Rules',
		'nav.home': 'Home',
		'nav.online': 'Online',
		'nav.vsBots': 'Vs bots',
		'nav.newGame': 'New game',
		'name.label': 'Your name',
		'name.placeholder': 'Your name',
		'name.start': 'Start game',
		'lobby.joining': 'Joining room',
		'lobby.leave': 'Leave room',
		'lobby.password': 'Room password',
		'lobby.password.placeholder': 'Password',
		'lobby.createPassword': 'Lobby password',
		'lobby.optional': '(optional)',
		'lobby.createPassword.placeholder': 'Leave empty for an open room',
		'lobby.create': 'Create room',
		'lobby.roomCode': 'Room code',
		'lobby.joinGame': 'Join game',
		'lobby.join': 'Join',
		'lobby.copy': 'Copy link',
		'lobby.copied': 'Copied!',
		'lobby.emptySeat': 'Empty seat',
		'lobby.botWillFill': 'bot will fill',
		'lobby.you': '(you)',
		'lobby.bot': 'bot',
		'lobby.kick': 'Kick',
		'lobby.start': 'Start game',
		'lobby.botsFillNote': 'Empty seats are filled with bots.',
		'lobby.waitingHost': 'Waiting for the host to start…',
		'lobby.reconnecting': 'Reconnecting…',
		'lobby.creating': 'Creating room…',
		'err.room_not_found': 'No room with that code.',
		'err.room_full': 'That room is full.',
		'err.bad_password': 'Wrong password — try again.',
		'err.kicked': 'You were removed from the room.',
		you: 'You',
		'rail.hand': 'Hand {n}',
		'rail.handOver': 'Hand over',
		'rail.wins': '{name} wins!',
		'turn.beat': 'Your turn — beat {move} or pass',
		'turn.opening': 'Your turn — first play must include the 3♠',
		'turn.lead': 'Your turn — lead any combination',
		'turn.waiting': 'Waiting for {name}…',
		'action.play': 'Play',
		'action.pass': 'Pass',
		'action.autoPass': 'Auto-pass when stuck',
		'combo.invalid': 'Not a valid combination',
		'reason.invalid_combo': 'That selection is not a valid combination.',
		'reason.does_not_beat': "That doesn't beat {move}.",
		'reason.does_not_beat_generic': "That doesn't beat the current play.",
		'reason.opening_requires_3spades': 'The first play of the game must include the 3♠.',
		'reason.already_passed': 'You already passed this trick.',
		'reason.generic': 'You cannot play that right now.',
		'move.pass': 'pass',
		'move.single': 'single {card}',
		'move.pair': 'pair of {rank}s',
		'move.triple': 'triple of {rank}s',
		'move.fourofakind': 'four of a kind, {rank}s',
		'move.run': 'run {cards}',
		'move.drun': 'double run {cards} ({n} pairs)',
		'pile.newTrick': 'New trick',
		'pile.opening': 'Opening lead',
		'pile.leads': '{name} leads',
		'pile.lastTrick': 'Last trick — {name} won with {move}',
		'pile.passed': '{name} passed',
		'deal.button': 'Deal cards',
		'deal.progress': 'Dealing… {n}/52',
		'deal.waiting': 'Dealing…',
		'log.title': 'Move log',
		'log.aria': 'Move log',
		'log.empty': 'No moves yet.',
		'log.hand': 'H{n}',
		'place.roundWon': '{name} won round {n}!',
		'place.gameOver': 'Game over — {name} wins!',
		'place.nextHand': 'Next hand',
		'place.newGame': 'New game',
		'place.pts': '{n} pts',
		'seat.cardCount': '{n} cards',
		'seat.cardCount.one': '{n} card',
		'seat.out': 'OUT',
		'seat.passed': 'PASSED',
		'seat.thinking': 'Thinking…',
		'hand.aria': 'Your cards',
		'chat.title': 'Room chat',
		'chat.aria': 'Chat',
		'chat.empty': 'No messages yet. Say hi!',
		'chat.placeholder': 'Message the room…',
		'chat.message.aria': 'Chat message',
		'chat.send': 'Send',
		'chat.blocked': 'Message blocked by moderation',
		'rules.sections': 'Sections',
		'rules.play': 'Play →',
		'lang.aria': 'Language'
	},
	vi: {
		'title.home': 'Thirteen — Tiến Lên',
		'title.play': 'Chơi — Thirteen',
		'title.online': 'Trực tuyến — Thirteen',
		'title.rules': 'Luật — Thirteen',
		'home.tagline': 'Tiến Lên — 13 lá, đấu với bot hoặc bạn bè.',
		'home.cta.bots': 'Ván mới với bot',
		'home.cta.online': 'Chơi trực tuyến',
		'nav.rules': 'Luật chơi',
		'nav.home': 'Trang chủ',
		'nav.online': 'Trực tuyến',
		'nav.vsBots': 'Đánh với bot',
		'nav.newGame': 'Ván mới',
		'name.label': 'Tên của bạn',
		'name.placeholder': 'Tên của bạn',
		'name.start': 'Bắt đầu',
		'lobby.joining': 'Đang vào phòng',
		'lobby.leave': 'Rời phòng',
		'lobby.password': 'Mật khẩu phòng',
		'lobby.password.placeholder': 'Mật khẩu',
		'lobby.createPassword': 'Mật khẩu phòng chờ',
		'lobby.optional': '(không bắt buộc)',
		'lobby.createPassword.placeholder': 'Để trống để tạo phòng mở',
		'lobby.create': 'Tạo phòng',
		'lobby.roomCode': 'Mã phòng',
		'lobby.joinGame': 'Vào game',
		'lobby.join': 'Vào',
		'lobby.copy': 'Sao chép liên kết',
		'lobby.copied': 'Đã sao chép!',
		'lobby.emptySeat': 'Chỗ trống',
		'lobby.botWillFill': 'bot sẽ vào chỗ này',
		'lobby.you': '(bạn)',
		'lobby.bot': 'bot',
		'lobby.kick': 'Mời ra',
		'lobby.start': 'Bắt đầu',
		'lobby.botsFillNote': 'Chỗ trống sẽ được bot lấp đầy.',
		'lobby.waitingHost': 'Đang chờ chủ phòng bắt đầu…',
		'lobby.reconnecting': 'Đang kết nối lại…',
		'lobby.creating': 'Đang tạo phòng…',
		'err.room_not_found': 'Không có phòng nào với mã này.',
		'err.room_full': 'Phòng đã đầy.',
		'err.bad_password': 'Sai mật khẩu — thử lại.',
		'err.kicked': 'Bạn đã bị mời ra khỏi phòng.',
		you: 'Bạn',
		'rail.hand': 'Ván {n}',
		'rail.handOver': 'Hết ván',
		'rail.wins': '{name} thắng!',
		'turn.beat': 'Đến lượt bạn — đánh lớn hơn {move} hoặc bỏ lượt',
		'turn.opening': 'Đến lượt bạn — lượt đánh đầu phải có lá 3♠',
		'turn.lead': 'Đến lượt bạn — đánh tổ hợp tùy ý',
		'turn.waiting': 'Đang chờ {name}…',
		'action.play': 'Đánh',
		'action.pass': 'Bỏ lượt',
		'action.autoPass': 'Tự động bỏ lượt khi bí',
		'combo.invalid': 'Không phải tổ hợp hợp lệ',
		'reason.invalid_combo': 'Bài đã chọn không phải tổ hợp hợp lệ.',
		'reason.does_not_beat': 'Bài này không thắng được {move}.',
		'reason.does_not_beat_generic': 'Bài này không thắng được bài trên bàn.',
		'reason.opening_requires_3spades': 'Lượt đánh đầu tiên phải có lá 3♠.',
		'reason.already_passed': 'Bạn đã bỏ lượt trong vòng này rồi.',
		'reason.generic': 'Hiện tại không thể đánh bài này.',
		'move.pass': 'bỏ lượt',
		'move.single': 'lá {card}',
		'move.pair': 'đôi {rank}',
		'move.triple': 'bộ ba {rank}',
		'move.fourofakind': 'tứ quý {rank}',
		'move.run': 'sảnh {cards}',
		'move.drun': 'sảnh đôi {cards} ({n} đôi)',
		'pile.newTrick': 'Vòng mới',
		'pile.opening': 'Lượt đánh đầu',
		'pile.leads': '{name} đánh trước',
		'pile.lastTrick': 'Vòng trước — {name} thắng với {move}',
		'pile.passed': '{name} bỏ lượt',
		'deal.button': 'Chia bài',
		'deal.progress': 'Đang chia… {n}/52',
		'deal.waiting': 'Đang chia…',
		'log.title': 'Nhật ký lượt đánh',
		'log.aria': 'Nhật ký lượt đánh',
		'log.empty': 'Chưa có lượt đánh nào.',
		'log.hand': 'V{n}',
		'place.roundWon': '{name} thắng vòng {n}!',
		'place.gameOver': 'Hết game — {name} thắng!',
		'place.nextHand': 'Ván tiếp',
		'place.newGame': 'Ván mới',
		'place.pts': '{n} điểm',
		'seat.cardCount': '{n} lá',
		'seat.cardCount.one': '{n} lá',
		'seat.out': 'HẾT BÀI',
		'seat.passed': 'ĐÃ BỎ LƯỢT',
		'seat.thinking': 'Đang suy nghĩ…',
		'hand.aria': 'Bài của bạn',
		'chat.title': 'Trò chuyện trong phòng',
		'chat.aria': 'Trò chuyện',
		'chat.empty': 'Chưa có tin nhắn. Chào mọi người đi!',
		'chat.placeholder': 'Nhắn tin cho phòng…',
		'chat.message.aria': 'Tin nhắn trò chuyện',
		'chat.send': 'Gửi',
		'chat.blocked': 'Tin nhắn bị chặn bởi kiểm duyệt',
		'rules.sections': 'Mục lục',
		'rules.play': 'Chơi →',
		'lang.aria': 'Ngôn ngữ'
	},
	'zh-Hans': {
		'title.home': 'Thirteen — Tiến Lên',
		'title.play': '游戏 — Thirteen',
		'title.online': '在线 — Thirteen',
		'title.rules': '规则 — Thirteen',
		'home.tagline': 'Tiến Lên — 13 张牌，与机器人或好友对战。',
		'home.cta.bots': '新游戏（打机器人）',
		'home.cta.online': '在线玩',
		'nav.rules': '规则',
		'nav.home': '主页',
		'nav.online': '在线',
		'nav.vsBots': '打机器人',
		'nav.newGame': '新游戏',
		'name.label': '你的名字',
		'name.placeholder': '你的名字',
		'name.start': '开始游戏',
		'lobby.joining': '正在加入房间',
		'lobby.leave': '离开房间',
		'lobby.password': '房间密码',
		'lobby.password.placeholder': '密码',
		'lobby.createPassword': '房间密码',
		'lobby.optional': '（可选）',
		'lobby.createPassword.placeholder': '留空则为开放房间',
		'lobby.create': '创建房间',
		'lobby.roomCode': '房间号',
		'lobby.joinGame': '加入游戏',
		'lobby.join': '加入',
		'lobby.copy': '复制链接',
		'lobby.copied': '已复制！',
		'lobby.emptySeat': '空位',
		'lobby.botWillFill': '机器人会补位',
		'lobby.you': '（你）',
		'lobby.bot': '机器人',
		'lobby.kick': '移出',
		'lobby.start': '开始游戏',
		'lobby.botsFillNote': '空位将由机器人补齐。',
		'lobby.waitingHost': '等待房主开始…',
		'lobby.reconnecting': '正在重新连接…',
		'lobby.creating': '正在创建房间…',
		'err.room_not_found': '没有这个房间号。',
		'err.room_full': '房间已满。',
		'err.bad_password': '密码错误 — 请重试。',
		'err.kicked': '你已被移出房间。',
		you: '你',
		'rail.hand': '第 {n} 局',
		'rail.handOver': '本局结束',
		'rail.wins': '{name} 获胜！',
		'turn.beat': '轮到你 — 出比 {move} 大的牌或过',
		'turn.opening': '轮到你 — 首出必须包含 3♠',
		'turn.lead': '轮到你 — 出任意牌型',
		'turn.waiting': '等待 {name}…',
		'action.play': '出牌',
		'action.pass': '过',
		'action.autoPass': '出不了时自动过牌',
		'combo.invalid': '不是有效牌型',
		'reason.invalid_combo': '所选的牌不是有效牌型。',
		'reason.does_not_beat': '这手牌压不过 {move}。',
		'reason.does_not_beat_generic': '这手牌压不过当前的牌。',
		'reason.opening_requires_3spades': '第一手牌必须包含 3♠。',
		'reason.already_passed': '你这一圈已经过牌了。',
		'reason.generic': '现在不能出这手牌。',
		'move.pass': '过',
		'move.single': '单张 {card}',
		'move.pair': '一对 {rank}',
		'move.triple': '三张 {rank}',
		'move.fourofakind': '四张 {rank}',
		'move.run': '顺子 {cards}',
		'move.drun': '连对 {cards}（{n} 对）',
		'pile.newTrick': '新一轮',
		'pile.opening': '首出',
		'pile.leads': '{name} 先出',
		'pile.lastTrick': '上一轮 — {name} 以 {move} 获胜',
		'pile.passed': '{name} 过了',
		'deal.button': '发牌',
		'deal.progress': '发牌中… {n}/52',
		'deal.waiting': '发牌中…',
		'log.title': '出牌记录',
		'log.aria': '出牌记录',
		'log.empty': '还没有出牌。',
		'log.hand': '第{n}',
		'place.roundWon': '{name} 赢得第 {n} 局！',
		'place.gameOver': '游戏结束 — {name} 获胜！',
		'place.nextHand': '下一局',
		'place.newGame': '新游戏',
		'place.pts': '{n} 分',
		'seat.cardCount': '{n} 张牌',
		'seat.cardCount.one': '{n} 张牌',
		'seat.out': '出局',
		'seat.passed': '已过',
		'seat.thinking': '思考中…',
		'hand.aria': '你的手牌',
		'chat.title': '房间聊天',
		'chat.aria': '聊天',
		'chat.empty': '还没有消息。打个招呼吧！',
		'chat.placeholder': '给房间发消息…',
		'chat.message.aria': '聊天消息',
		'chat.send': '发送',
		'chat.blocked': '消息已被屏蔽',
		'rules.sections': '目录',
		'rules.play': '去玩 →',
		'lang.aria': '语言'
	},
	'zh-Hant': {
		'title.home': 'Thirteen — Tiến Lên',
		'title.play': '打牌 — Thirteen',
		'title.online': '網上 — Thirteen',
		'title.rules': '規則 — Thirteen',
		'home.tagline': 'Tiến Lên — 13 隻牌，同機器人或者朋友打。',
		'home.cta.bots': '同機器人開新局',
		'home.cta.online': '網上玩',
		'nav.rules': '規則',
		'nav.home': '主頁',
		'nav.online': '網上',
		'nav.vsBots': '打機器人',
		'nav.newGame': '新局',
		'name.label': '你個名',
		'name.placeholder': '你個名',
		'name.start': '開始遊戲',
		'lobby.joining': '入緊房',
		'lobby.leave': '離開房間',
		'lobby.password': '房間密碼',
		'lobby.password.placeholder': '密碼',
		'lobby.createPassword': '開房密碼',
		'lobby.optional': '（可唔填）',
		'lobby.createPassword.placeholder': '留空就係開放房',
		'lobby.create': '開房',
		'lobby.roomCode': '房間號碼',
		'lobby.joinGame': '加入遊戲',
		'lobby.join': '加入',
		'lobby.copy': '複製連結',
		'lobby.copied': '複製咗！',
		'lobby.emptySeat': '空位',
		'lobby.botWillFill': '機器人會補位',
		'lobby.you': '（你）',
		'lobby.bot': 'bot',
		'lobby.kick': '請出去',
		'lobby.start': '開始遊戲',
		'lobby.botsFillNote': '空位會由機器人補齊。',
		'lobby.waitingHost': '等房主開始…',
		'lobby.reconnecting': '重新連接緊…',
		'lobby.creating': '開緊房…',
		'err.room_not_found': '冇呢個號碼嘅房。',
		'err.room_full': '個房已經滿咗。',
		'err.bad_password': '密碼錯咗 — 再試一次。',
		'err.kicked': '你已經被移出房間。',
		you: '你',
		'rail.hand': '第 {n} 局',
		'rail.handOver': '呢局完',
		'rail.wins': '{name} 贏咗！',
		'turn.beat': '到你 — 出大過 {move} 嘅牌或者過',
		'turn.opening': '到你 — 首出要有 3♠',
		'turn.lead': '到你 — 出任何組合',
		'turn.waiting': '等 {name}…',
		'action.play': '出',
		'action.pass': '過',
		'action.autoPass': '出唔到就自動過',
		'combo.invalid': '唔係有效組合',
		'reason.invalid_combo': '揀嘅牌唔係有效組合。',
		'reason.does_not_beat': '呢手牌大唔過 {move}。',
		'reason.does_not_beat_generic': '呢手牌大唔過枱面嘅牌。',
		'reason.opening_requires_3spades': '第一手牌一定要有 3♠。',
		'reason.already_passed': '你呢圈已經過咗牌。',
		'reason.generic': '而家出唔到呢手牌。',
		'move.pass': '過',
		'move.single': '單張 {card}',
		'move.pair': '一對 {rank}',
		'move.triple': '三條 {rank}',
		'move.fourofakind': '四條 {rank}',
		'move.run': '順子 {cards}',
		'move.drun': '連對 {cards}（{n} 對）',
		'pile.newTrick': '新一圈',
		'pile.opening': '首出',
		'pile.leads': '{name} 先出',
		'pile.lastTrick': '上一圈 — {name} 以 {move} 勝出',
		'pile.passed': '{name} 過咗',
		'deal.button': '派牌',
		'deal.progress': '派牌中… {n}/52',
		'deal.waiting': '派牌中…',
		'log.title': '出牌紀錄',
		'log.aria': '出牌紀錄',
		'log.empty': '仲未有人出牌。',
		'log.hand': '第{n}',
		'place.roundWon': '{name} 贏咗第 {n} 局！',
		'place.gameOver': '完局 — {name} 贏咗！',
		'place.nextHand': '下一局',
		'place.newGame': '新局',
		'place.pts': '{n} 分',
		'seat.cardCount': '{n} 隻牌',
		'seat.cardCount.one': '{n} 隻牌',
		'seat.out': '出局',
		'seat.passed': '過咗',
		'seat.thinking': '諗緊…',
		'hand.aria': '你啲牌',
		'chat.title': '房間傾偈',
		'chat.aria': '傾偈',
		'chat.empty': '仲未有留言。打個招呼啦！',
		'chat.placeholder': '同房間講嘢…',
		'chat.message.aria': '傾偈訊息',
		'chat.send': '傳送',
		'chat.blocked': '訊息已被屏蔽',
		'rules.sections': '目錄',
		'rules.play': '去玩 →',
		'lang.aria': '語言'
	}
};

/** Translate `key` in the active locale, interpolating `{param}` placeholders. */
export function t(key: string, params?: Params): string {
	const msg = MESSAGES[i18n.locale][key] ?? MESSAGES.en[key] ?? key;
	if (!params) return msg;
	return msg.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
}

/** Seat names: the local game stores the literal 'You' for seat 0. */
export function displayName(name: string): string {
	return name === 'You' ? t('you') : name;
}

/** Localized short description of a move, mirroring engine `describeMove`. */
export function describeMoveI18n(action: Move | PassMove): string {
	if (action.type === 'pass') return t('move.pass');
	const top = comboTop(action);
	switch (action.type) {
		case 'single':
			return t('move.single', { card: cardLabel(action.cards[0]!) });
		case 'pair':
		case 'triple':
		case 'fourofakind':
			return t(`move.${action.type}`, { rank: rankLabel(top.rank) });
		case 'sequence':
			return t('move.run', { cards: action.cards.map((c) => rankLabel(c.rank)).join('-') });
		case 'doublesequence':
			return t('move.drun', {
				cards: `${rankLabel(action.cards[0]!.rank)}-${rankLabel(top.rank)}`,
				n: action.cards.length / 2
			});
	}
}

// Vietnamese spoken card names: suits ♠ ♣ ♦ ♥ → Bích Chuồn Rô Cơ; J Q K A 2 → Đồi Đầm Ger Xì Hai.
const RANK_VI: Record<number, string> = { 11: 'Đồi', 12: 'Đầm', 13: 'Ger', 14: 'Xì', 15: 'Hai' };
const SUITS_VI: readonly string[] = ['Bích', 'Chuồn', 'Rô', 'Cơ'];
// Mandarin suit names (suit-first word order); Cantonese uses HK names.
const SUITS_ZH_HANS: readonly string[] = ['黑桃', '梅花', '方块', '红桃'];
const SUITS_ZH_HANT: readonly string[] = ['葵扇', '梅花', '方磚', '紅心'];

/** Localized full card name for aria-labels, e.g. "Queen of Hearts" / "Đầm Cơ" / "红桃Q". */
export function cardNameI18n(card: Card): string {
	if (i18n.locale === 'en') return cardName(card);
	if (i18n.locale === 'vi') {
		return `${RANK_VI[card.rank] ?? rankLabel(card.rank)} ${SUITS_VI[card.suit]}`;
	}
	const suits = i18n.locale === 'zh-Hans' ? SUITS_ZH_HANS : SUITS_ZH_HANT;
	return `${suits[card.suit]}${rankLabel(card.rank)}`;
}
