import { toast } from 'sonner';
import {
  useGetAdminAuditLogQuery,
  useGetPrivacyRequestsQuery,
  usePostPrivacyRequestsByRequestIdResolveMutation,
} from '@/api/generated-api';
import { PageHead } from '@/components/page-head';
import { AdminProfileCard } from '@/components/admin-profile-card';
import { PlatformSettingsCard } from '@/components/platform-settings-card';
import { WalletSettingsCard } from '@/components/wallet-settings-card';

function PrivacyRequestsCard() {
  const { data, isLoading } = useGetPrivacyRequestsQuery({});
  const [resolve, { isLoading: isResolving }] = usePostPrivacyRequestsByRequestIdResolveMutation();

  async function handleResolve(requestId: string) {
    try {
      await resolve({ requestId }).unwrap();
      toast.success('Request resolved.');
    } catch (err) {
      const message = (err as { data?: { message?: string } } | undefined)?.data?.message ?? 'Failed to resolve.';
      toast.error(message);
    }
  }

  const items = data ?? [];

  return (
    <div className="card">
      <h3 style={{ marginBottom: 6 }}>Privacy and data requests</h3>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Requests from patients under the Digital Personal Data Protection Act, 2023.
      </p>
      {isLoading ? (
        <p className="muted small">Loading…</p>
      ) : items.length === 0 ? (
        <p className="small muted">No requests.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Request</th>
                <th>Date</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td>{r.patientName}</td>
                  <td className="small" style={{ textTransform: 'capitalize' }}>
                    {r.type}
                  </td>
                  <td>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</td>
                  <td>
                    {r.status === 'open' ? (
                      <span className="badge amber">Open</span>
                    ) : (
                      <span className="badge green">Resolved</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {r.status === 'open' && (
                      <button type="button" className="btn small" disabled={isResolving} onClick={() => handleResolve(r.id!)}>
                        Mark resolved
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AuditLogCard() {
  const { data, isLoading } = useGetAdminAuditLogQuery({});
  const items = data?.items ?? [];

  return (
    <div className="card">
      <h3 style={{ marginBottom: 6 }}>Audit log</h3>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Approvals, account changes, platform settings and refund rechecks.
      </p>
      {isLoading ? (
        <p className="muted small">Loading…</p>
      ) : items.length === 0 ? (
        <p className="small muted">No audit entries yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 30).map((l) => (
                <tr key={l.id}>
                  <td className="tiny">{l.createdAt ? new Date(l.createdAt).toLocaleString() : '—'}</td>
                  <td className="small">{l.actorLabel}</td>
                  <td className="small">{l.action}</td>
                  <td className="small">
                    {l.entityType}/{l.entityId}
                  </td>
                  <td className="small muted">{l.detail ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function SettingsPage() {
  return (
    <>
      <PageHead title="Settings" subtitle="Manage your admin account, privacy requests, and activity." />
      <div className="stack" style={{ maxWidth: 760 }}>
        <AdminProfileCard />
        <PlatformSettingsCard />
        <WalletSettingsCard />
        <PrivacyRequestsCard />
        <AuditLogCard />
      </div>
    </>
  );
}
