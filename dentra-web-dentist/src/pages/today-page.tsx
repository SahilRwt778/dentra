import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarX } from 'lucide-react';
import { useGetAppointmentsQuery, useGetDentistsMeQuery } from '@/api/generated-api';
import { PageHead } from '@/components/page-head';
import { todayIso, formatTime, dayLabel, formatDate } from '@/lib/date';
import { statusBadge, isFlagged } from '@/lib/status';

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

export function TodayPage() {
  const { data: me } = useGetDentistsMeQuery();
  const { data, isLoading } = useGetAppointmentsQuery({ date: todayIso() });
  const navigate = useNavigate();

  const items = (data?.items ?? []).filter((a) => a.status !== 'cancelled');
  const waiting = items.filter((a) => a.status === 'waiting').length;
  const completed = items.filter((a) => a.status === 'completed').length;

  return (
    <>
      <PageHead
        title={`Good ${greeting()}, ${me?.fullName ?? ''}`}
        subtitle={`${dayLabel(todayIso())}, ${formatDate(todayIso())}`}
      />

      {isLoading ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <div className="queue-meta">
            <span>
              <b>{items.length}</b> appointments
            </span>
            <span>
              <b>{waiting}</b> waiting
            </span>
            <span>
              <b>{completed}</b> completed
            </span>
          </div>

          {items.length === 0 ? (
            <div className="card empty">
              <CalendarX style={{ margin: '0 auto 6px' }} />
              <p>No appointments today.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Patient</th>
                    <th>Visit</th>
                    <th>Reason</th>
                    <th>Pain</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => {
                    const flagged = isFlagged(a) && a.status !== 'completed';
                    const badge = statusBadge(a.status);
                    return (
                      <tr
                        key={a.id}
                        className={`clickable${flagged ? ' flag' : ''}`}
                        onClick={() => navigate(`/consult/${a.id}`)}
                      >
                        <td>
                          <b>{formatTime(a.time)}</b>
                        </td>
                        <td>
                          {a.patientName}
                          <div className="tiny muted">
                            {a.patientAge != null ? `${a.patientAge} y, ` : ''}
                            {a.patientGender}
                          </div>
                        </td>
                        <td>{a.type === 'video' ? 'Video' : 'In-clinic'}</td>
                        <td>
                          {a.concern}
                          {a.symptomArea && <div className="tiny muted">{a.symptomArea}</div>}
                        </td>
                        <td>
                          {a.painScore != null ? `${a.painScore}/10` : '—'}
                          {flagged && (
                            <div className="flag-note">
                              <AlertTriangle size={14} />
                              {a.swelling ? 'Swelling' : 'Severe pain'}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={badge.className}>{badge.label}</span>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className={`btn${a.status === 'completed' ? '' : ' btn-primary'}`}
                            onClick={() => navigate(`/consult/${a.id}`)}
                          >
                            {a.status === 'completed' ? 'View' : a.status === 'in_consult' ? 'Continue' : 'Start consultation'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="small muted" style={{ marginTop: 12 }}>
            Rows marked red: patient reported swelling or pain of 8/10 or more.
          </p>
        </>
      )}
    </>
  );
}
