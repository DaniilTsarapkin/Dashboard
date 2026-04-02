
interface Props {
  min: number
  max: number
  from: number
  to: number
  onChange: (from: number, to: number) => void
}

export default function RangeSlider({ min, max, from, to, onChange }: Props) {
  const pctLeft = ((from - min) / (max - min)) * 100
  const pctRight = ((to - min) / (max - min)) * 100

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{from} дн. назад</span>
        <span>{to === 0 ? 'сегодня' : `${to} дн. назад`}</span>
      </div>

      <div className="relative h-5">
        <div className="absolute top-2 left-0 right-0 h-1 bg-gray-700 rounded" />

        <div
          className="absolute top-2 h-1 bg-yellow-500 rounded"
          style={{ left: `${100 - pctLeft}%`, right: `${pctRight}%` }}
        />

        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={max - from + min}
          onChange={e => {
            const v = max - Number(e.target.value) + min
            onChange(Math.max(v, to + 1), to)
          }}
          className="absolute top-0 left-0 w-full h-5 appearance-none bg-transparent pointer-events-none
            [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-yellow-400 [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-900
            [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none
            [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-yellow-400 [&::-moz-range-thumb]:cursor-pointer
            [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-gray-900"
        />

        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={max - to + min}
          onChange={e => {
            const v = max - Number(e.target.value) + min
            onChange(from, Math.min(v, from - 1))
          }}
          className="absolute top-0 left-0 w-full h-5 appearance-none bg-transparent pointer-events-none
            [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-yellow-400 [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-900
            [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none
            [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-yellow-400 [&::-moz-range-thumb]:cursor-pointer
            [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-gray-900"
        />
      </div>
    </div>
  )
}
