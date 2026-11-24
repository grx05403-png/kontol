export type ParsedRosterRow = {
  course: string
  lecturer: string
  day: string
  start: string
  end: string
  room: string
  confidence: 'Tinggi' | 'Perlu cek'
  source: string
}

export declare function parseRosterRows(text: string): ParsedRosterRow[]
