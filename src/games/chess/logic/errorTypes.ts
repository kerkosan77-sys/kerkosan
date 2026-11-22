export type ChessErrorType =
  | 'hung_piece'
  | 'allowed_mate'
  | 'allowed_fork'
  | 'allowed_tactic'
  | 'missed_capture'
  | 'missed_mate'
  | 'missed_tactic'
  | 'other'

/** Most fundamental habit first ("other" last): also used to break ties in the game summary. */
export const CHESS_ERROR_TYPES: { id: ChessErrorType; label: string; tip: string }[] = [
  { id: 'hung_piece', label: 'Taş bırakma', tip: 'Her hamleden önce taşlarının korunup korunmadığına bak.' },
  { id: 'allowed_mate', label: 'Mat tehdidini görmeme', tip: 'Şahının çevresine dikkat et: rakibin mat tehdidi var mı?' },
  { id: 'allowed_fork', label: 'Çatalı görmeme', tip: 'Rakip atının aynı anda iki taşına saldırabileceği karelere dikkat et.' },
  { id: 'allowed_tactic', label: 'Rakibin taktiğini görmeme', tip: 'Rakibin son hamlesi neyi tehdit ediyor? Önce ona cevap ver.' },
  { id: 'missed_capture', label: 'Bedava taşı almama', tip: 'Rakibin korumasız bıraktığı taşları her hamle ara.' },
  { id: 'missed_mate', label: 'Matı kaçırma', tip: 'Şah çeken hamlelere bak: mat olabilir.' },
  { id: 'missed_tactic', label: 'Taktik fırsatı kaçırma', tip: 'Şah çeken, taş alan ve saldıran hamlelere bak: çatal ya da açmaz olabilir.' },
  { id: 'other', label: 'Diğer (konum hatası)', tip: 'Taşlarını iyi karelere getir, plansız hamle yapma.' },
]
