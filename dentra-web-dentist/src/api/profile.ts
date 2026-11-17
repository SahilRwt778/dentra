import { useCallback } from 'react';
import {
  usePatchDentistsMeMutation,
  type DentistSelfUpdate,
} from './generated-api';

/** Keep multipart details out of the profile form. JSON saves stay compatible. */
export function useUpdateDentistProfileMutation() {
  const [send, state] = usePatchDentistsMeMutation();
  const update = useCallback(
    (details: DentistSelfUpdate, photo?: File | null) => {
      if (!photo) return send({ dentistSelfUpdate: details }).unwrap();
      const body = new FormData();
      body.append('details', JSON.stringify(details));
      body.append('profilePhoto', photo);
      // The endpoint also accepts a multipart body alongside its JSON contract.
      return send({
        dentistSelfUpdate: body as unknown as DentistSelfUpdate,
      }).unwrap();
    },
    [send],
  );
  return [update, state] as const;
}
