'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { MONTHS } from '@/lib/rh-constants';
import Icon from '@/components/Icon';

export default function PeriodSelector({ currentMonth, currentYear }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePeriodChange = (month, year) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('mois', String(month));
    params.set('annee', String(year));
    router.push(`/fiches-de-paie?${params.toString()}`);
  };

  const handlePrevYear = () => handlePeriodChange(currentMonth, currentYear - 1);
  const handleNextYear = () => handlePeriodChange(currentMonth, currentYear + 1);

  const realNow = new Date();
  const realMonth = realNow.getUTCMonth() + 1;
  const realYear = realNow.getUTCFullYear();

  return (
    <div className="period-ribbon-card">
      <div className="period-ribbon-top">
        <div className="period-ribbon-current">
          <span className="period-ribbon-icon">
            <Icon name="calendar" size={18} />
          </span>
          <div>
            <span className="period-ribbon-label">Période de paie</span>
            <strong className="period-ribbon-title">
              {MONTHS[currentMonth - 1]} {currentYear}
            </strong>
          </div>
        </div>

        {/* Sélecteur d'année PayFit */}
        <div className="period-year-stepper">
          <button
            type="button"
            className="year-step-btn"
            onClick={handlePrevYear}
            title="Année précédente"
            aria-label="Année précédente"
          >
            ‹
          </button>
          <span className="year-step-val">{currentYear}</span>
          <button
            type="button"
            className="year-step-btn"
            onClick={handleNextYear}
            title="Année suivante"
            aria-label="Année suivante"
          >
            ›
          </button>
        </div>
      </div>

      {/* Frise chronologique des 12 mois façon PayFit */}
      <div className="period-months-scroll" role="tablist" aria-label="Sélectionner le mois">
        {MONTHS.map((m, idx) => {
          const monthNum = idx + 1;
          const isSelected = monthNum === currentMonth;
          const isCurrentRealMonth = monthNum === realMonth && currentYear === realYear;

          return (
            <button
              key={monthNum}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`month-pill${isSelected ? ' is-selected' : ''}${isCurrentRealMonth ? ' is-real-now' : ''}`}
              onClick={() => handlePeriodChange(monthNum, currentYear)}
            >
              <span className="month-pill-name">{m}</span>
              {isCurrentRealMonth && <span className="month-pill-dot" title="Mois en cours" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
