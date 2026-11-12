import React from 'react';
import { MatrixStatementData } from '../../types';
import { Badge } from '../../components/common/Badge';

export const AreaMatrixView: React.FC<{ data: MatrixStatementData }> = ({ data }) => {
  const { areas, rows } = data;

  if (rows.length === 0) {
    return (
      <div className="p-12 text-center text-xs text-slate-400">
        No product stock records match your query.
      </div>
    );
  }

  // Calculate area totals across all products
  const areaTotals: Record<string, { available: number; damaged: number }> = {};
  let grandTotalAvailable = 0;
  let grandTotalDamaged = 0;

  for (const area of areas) {
    const aIdStr = area._id.toString();
    areaTotals[aIdStr] = { available: 0, damaged: 0 };
  }

  for (const row of rows) {
    grandTotalAvailable += row.totalAvailable;
    grandTotalDamaged += row.totalDamaged;

    for (const area of areas) {
      const aIdStr = area._id.toString();
      const bal = row.areaQuantities[aIdStr] || { available: 0, damaged: 0 };
      areaTotals[aIdStr].available += bal.available;
      areaTotals[aIdStr].damaged += bal.damaged;
    }
  }

  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full text-left border-collapse text-xs border border-slate-200">
        <thead>
          <tr className="bg-navy-950 text-white uppercase text-[11px] font-bold">
            <th className="py-3 px-4 sticky left-0 bg-navy-950 z-20 border-r border-navy-800">
              Product Name
            </th>
            <th className="py-3 px-3 text-center border-r border-navy-800">Unit</th>
            <th className="py-3 px-3 text-center border-r border-navy-800">Status</th>
            {areas.map(area => (
              <th
                key={area._id}
                className="py-3 px-4 text-center border-r border-navy-800 min-w-[110px]"
              >
                <span>{area.displayName}</span>
                <span className="block text-[10px] text-teal-300 font-normal">
                  {area.description ? `(${area.description})` : ''}
                </span>
              </th>
            ))}
            <th className="py-3 px-4 text-right bg-emerald-950/80 border-r border-emerald-900 text-emerald-300 min-w-[120px]">
              Total Available
            </th>
            <th className="py-3 px-4 text-right bg-rose-950/80 text-rose-300 min-w-[110px]">
              Total Damaged
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map(row => (
            <tr key={row.product._id} className="hover:bg-slate-50 transition-colors">
              <td className="py-3 px-4 sticky left-0 bg-white font-medium text-slate-900 border-r border-slate-200 shadow-xs">
                <span className="font-semibold text-navy-950 block">{row.product.name}</span>
                {(row.product.brand?.name || row.product.category?.name) && (
                  <span className="text-slate-500 block text-[10px] truncate max-w-xs">
                    {[row.product.brand?.name, row.product.category?.name].filter(Boolean).join(' • ')}
                  </span>
                )}
              </td>
              <td className="py-3 px-3 text-center font-mono text-slate-500 border-r border-slate-200">
                {row.product.unit}
              </td>
              <td className="py-3 px-3 text-center border-r border-slate-200">
                <Badge
                  variant={row.product.isActive ? 'active' : 'archived'}
                  className="text-[10px] py-0 px-1.5"
                >
                  {row.product.isActive ? 'Active' : 'Archived'}
                </Badge>
              </td>

              {/* Area available cells */}
              {areas.map(area => {
                const bal = row.areaQuantities[area._id.toString()] || { available: 0, damaged: 0 };
                const hasAvail = bal.available > 0;
                const hasDmg = bal.damaged > 0;

                return (
                  <td
                    key={area._id}
                    className="py-3 px-4 text-center border-r border-slate-200 font-mono"
                  >
                    <div className="flex flex-col items-center">
                      <span
                        className={`font-bold ${hasAvail ? 'text-emerald-700' : 'text-slate-300'}`}
                      >
                        {bal.available.toLocaleString()}
                      </span>
                      {hasDmg && (
                        <span className="text-[10px] text-rose-600 font-medium">
                          ({bal.damaged} dmg)
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}

              {/* Total Available Column */}
              <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-700 bg-emerald-50/50 border-r border-slate-200 text-sm">
                {row.totalAvailable.toLocaleString()}
              </td>

              {/* Total Damaged Column */}
              <td className="py-3 px-4 text-right font-mono font-extrabold text-rose-600 bg-rose-50/40 text-sm">
                {row.totalDamaged > 0 ? row.totalDamaged.toLocaleString() : '-'}
              </td>
            </tr>
          ))}
        </tbody>

        {/* Matrix Footer Totals */}
        <tfoot>
          <tr className="bg-slate-100 font-bold text-navy-950 uppercase border-t-2 border-slate-300 text-xs">
            <td className="py-3 px-4 sticky left-0 bg-slate-100 border-r border-slate-300">
              Area Column Totals
            </td>
            <td className="py-3 px-3 text-center border-r border-slate-300">-</td>
            <td className="py-3 px-3 text-center border-r border-slate-300">-</td>
            {areas.map(area => (
              <td key={area._id} className="py-3 px-4 text-center font-mono border-r border-slate-300">
                <span className="block text-emerald-800">
                  {areaTotals[area._id.toString()]?.available.toLocaleString() || 0}
                </span>
                <span className="block text-[10px] text-rose-600">
                  ({areaTotals[area._id.toString()]?.damaged.toLocaleString() || 0} dmg)
                </span>
              </td>
            ))}
            <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-800 bg-emerald-100/60 border-r border-slate-300 text-sm">
              {grandTotalAvailable.toLocaleString()}
            </td>
            <td className="py-3 px-4 text-right font-mono font-extrabold text-rose-700 bg-rose-100/60 text-sm">
              {grandTotalDamaged.toLocaleString()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

