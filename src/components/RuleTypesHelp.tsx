"use client"

export default function RuleTypesHelp() {
  return (
    <div
      className="hidden md:block fixed top-1/2 left-1/2 -translate-y-1/2 translate-x-[calc(24rem+1rem)] z-[12020]"
      aria-live="polite"
    >
      <div className="w-80 rounded-xl border border-glass-200 bg-white p-4 shadow-xl">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Rule types</h4>
        <ul className="space-y-2 text-sm text-gray-700">
          <li>
            <div className="font-medium text-gray-900">competition</div>
            <div>Applies a flat adjustment regardless of date; useful for matching market moves.</div>
          </li>
          <li>
            <div className="font-medium text-gray-900">weekend</div>
            <div>Automatically applies on Fridays and Saturdays.</div>
          </li>
          <li>
            <div className="font-medium text-gray-900">high_season</div>
            <div>Applies between start and end dates for peak demand periods.</div>
          </li>
          <li>
            <div className="font-medium text-gray-900">low_season</div>
            <div>Applies between start and end dates for off-peak periods.</div>
          </li>
          <li>
            <div className="font-medium text-gray-900">holiday</div>
            <div>Applies only on a specific holiday date.</div>
          </li>
        </ul>
      </div>
    </div>
  )
}


