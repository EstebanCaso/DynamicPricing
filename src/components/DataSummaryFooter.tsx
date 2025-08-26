import type { IntlNumberFormat } from "@/lib/dataUtils";

interface DataSummaryFooterProps {
  filteredData: any[];
  uniqueRoomTypes: string[];
  totalRevenue: number;
  currency: IntlNumberFormat;
}

export default function DataSummaryFooter({
  filteredData,
  uniqueRoomTypes,
  totalRevenue,
  currency
}: DataSummaryFooterProps) {
  const avgPricePerBooking = filteredData.length > 0 
    ? totalRevenue / filteredData.length
    : 0;

  const revenuePerRoom = filteredData.length > 0 
    ? totalRevenue / uniqueRoomTypes.length
    : 0;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
        <div>
          <p className="text-2xl font-bold text-arkus-600">{filteredData.length}</p>
          <p className="text-sm text-gray-600">Total Bookings</p>
          <p className="text-xs text-gray-500">in selected period</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-emerald-600">{uniqueRoomTypes.length}</p>
          <p className="text-sm text-gray-600">Room Types</p>
          <p className="text-xs text-gray-500">available</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-blue-600">
            {currency.format(avgPricePerBooking)}
          </p>
          <p className="text-sm text-gray-600">Average Price</p>
          <p className="text-xs text-gray-500">per booking</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-purple-600">
            {currency.format(revenuePerRoom)}
          </p>
          <p className="text-sm text-gray-600">Revenue per Room</p>
          <p className="text-xs text-gray-500">in {currency.resolvedOptions().currency}</p>
        </div>
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-500">
          Data last updated: {new Date().toLocaleDateString("es-MX", { 
            year: "numeric", 
            month: "long", 
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          })}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          All monetary values displayed in {currency.resolvedOptions().currency}
        </p>
      </div>
    </div>
  );
}
