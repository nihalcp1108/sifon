import React from 'react';
import { PeriodStatementData } from '../../types';

export const PeriodMovementView: React.FC<{ data: PeriodStatementData }> = ({ data }) => {
  const { rows, period } = data;

  if (rows.length === 0) {
    return (
      <div className="p-12 text-center text-xs text-slate-400">
        No stock movement activity found for the period {period.startDate} to {period.endDate}.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full text-left border-collapse text-xs border border-slate-200">
        <thead>
          <tr className="bg-navy-950 text-white uppercase text-[10px] font-bold">
            <th className="py-3 px-3 border-r border-navy-800">Product / Area</th>
            <th className="py-3 px-3 text-right border-r border-navy-800 bg-slate-900">
              Opening Available
            </th>
            <th className="py-3 px-3 text-right border-r border-navy-800 text-teal-300">
              Purchased
            </th>
            <th className="py-3 px-3 text-right border-r border-navy-800 text-indigo-300">
              Sold
            </th>
            <th className="py-3 px-3 text-right border-r border-navy-800 text-emerald-300">
              Non-Dmg Ret
            </th>
            <th className="py-3 px-3 text-right border-r border-navy-800 text-amber-300">
              Reversals
            </th>
            <th className="py-3 px-3 text-right border-r border-navy-800 bg-emerald-950 text-emerald-300 font-extrabold">
              Closing Available
            </th>
            <th className="py-3 px-3 text-right border-r border-navy-800 text-slate-400">
              Opening Dmg
            </th>
            <th className="py-3 px-3 text-right border-r border-navy-800 text-rose-300">
              Dmg Ret
            </th>
            <th className="py-3 px-3 text-right bg-rose-950 text-rose-300 font-extrabold">
              Closing Damaged
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 font-mono">
          {rows.map((row, idx) => {
            const reversals = row.reversals?.netAvailableReversals || 0;

            return (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="py-2.5 px-3 font-sans border-r border-slate-200">
                  <span className="font-bold text-navy-950 block">{row.product.name}</span>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="font-mono text-slate-600">{row.product.code}</span>
                    <span>&bull;</span>
                    <span className="font-semibold text-teal-700">{row.area.displayName}</span>
                  </div>
                </td>

                {/* Opening Available */}
                <td className="py-2.5 px-3 text-right font-semibold text-slate-700 border-r border-slate-200 bg-slate-50/50">
                  {row.openingAvailable.toLocaleString()}
                </td>

                {/* Purchased */}
                <td className="py-2.5 px-3 text-right text-teal-700 font-bold border-r border-slate-200">
                  {row.purchased > 0 ? `+${row.purchased.toLocaleString()}` : '-'}
                </td>

                {/* Sold */}
                <td className="py-2.5 px-3 text-right text-slate-700 border-r border-slate-200">
                  {row.sold > 0 ? `-${row.sold.toLocaleString()}` : '-'}
                </td>

                {/* Returned Non-Damaged */}
                <td className="py-2.5 px-3 text-right text-emerald-700 font-bold border-r border-slate-200">
                  {row.returnedNonDamaged > 0 ? `+${row.returnedNonDamaged.toLocaleString()}` : '-'}
                </td>

                {/* Net Reversals */}
                <td className="py-2.5 px-3 text-right border-r border-slate-200">
                  {reversals !== 0 ? (
                    <span className={reversals > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {reversals > 0 ? `+${reversals}` : reversals}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>

                {/* Closing Available */}
                <td className="py-2.5 px-3 text-right font-extrabold text-emerald-800 bg-emerald-50/60 border-r border-slate-200 text-xs">
                  {row.closingAvailable.toLocaleString()}
                </td>

                {/* Opening Damaged */}
                <td className="py-2.5 px-3 text-right text-slate-500 border-r border-slate-200">
                  {row.openingDamaged > 0 ? row.openingDamaged.toLocaleString() : '-'}
                </td>

                {/* Damaged Returned */}
                <td className="py-2.5 px-3 text-right text-rose-600 border-r border-slate-200">
                  {row.returnedDamaged > 0 ? `+${row.returnedDamaged.toLocaleString()}` : '-'}
                </td>

                {/* Closing Damaged */}
                <td className="py-2.5 px-3 text-right font-extrabold text-rose-700 bg-rose-50/60 text-xs">
                  {row.closingDamaged > 0 ? row.closingDamaged.toLocaleString() : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

