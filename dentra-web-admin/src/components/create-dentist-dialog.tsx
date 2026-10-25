import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { usePostAdminDentistsMutation } from '@/api/generated-api';
import { Modal } from '@/components/modal';

const EMPTY_FORM = {
  fullName: '',
  mobile: '',
  email: '',
  primaryClinicName: '',
  overrideVerify: false,
  overrideReason: '',
};

export function CreateDentistDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [createDentist, { isLoading }] = usePostAdminDentistsMutation();

  function close() {
    setOpen(false);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const result = await createDentist({
        adminCreateDentist: {
          fullName: form.fullName,
          mobile: form.mobile,
          email: form.email || undefined,
          primaryClinicName: form.primaryClinicName,
          offersVideo: false,
          overrideVerify: form.overrideVerify,
          overrideReason: form.overrideReason || undefined,
        },
      }).unwrap();
      toast.success(`${result.fullName} created — ${result.status === 'verified' ? 'verified immediately.' : 'pending review.'}`);
      close();
    } catch (err) {
      const message = (err as { data?: { message?: string } } | undefined)?.data?.message ?? 'Failed to create dentist.';
      toast.error(message);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <Plus size={16} />
        Add dentist
      </button>
      <Modal open={open} onClose={close}>
        <h2 style={{ marginBottom: 4 }}>Admin-created dentist</h2>
        <p className="small muted" style={{ marginBottom: 16 }}>
          Creates the record and an invite. The dentist fills in credentials, documents and bank details
          themselves before review, unless you mark them verified now.
        </p>
        <form onSubmit={handleSubmit} className="stack">
          <label className="field">
            <span>Full name</span>
            <input
              className="input"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>Mobile number (E.164, e.g. +919820010482)</span>
            <input
              className="input"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              pattern="^\+[1-9][0-9]{7,14}$"
              required
            />
          </label>
          <label className="field">
            <span>Email (optional)</span>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Primary clinic name and address</span>
            <input
              className="input"
              value={form.primaryClinicName}
              onChange={(e) => setForm({ ...form, primaryClinicName: e.target.value })}
              required
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={form.overrideVerify}
              onChange={(e) => setForm({ ...form, overrideVerify: e.target.checked })}
            />
            <span>
              I have verified this dentist's degree, council registration and ID outside the app (e.g. during a
              sales visit) and want to mark them verified immediately.
            </span>
          </label>
          {form.overrideVerify && (
            <label className="field">
              <span>Reason / evidence on file (required, logged to the audit trail)</span>
              <textarea
                className="input"
                placeholder="e.g. Physical documents checked at clinic visit on ..."
                value={form.overrideReason}
                onChange={(e) => setForm({ ...form, overrideReason: e.target.value })}
                required
              />
            </label>
          )}
          <div className="row">
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? 'Creating…' : form.overrideVerify ? 'Create as verified' : 'Create & send invite'}
            </button>
            <button type="button" className="btn" onClick={close}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
