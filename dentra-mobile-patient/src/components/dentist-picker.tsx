import { useEffect, useState } from 'react';
import { Text, View, ScrollView } from 'react-native';
import { Search } from 'lucide-react-native';
import { useDentistsQuery } from '@/api/dentists';
import type { DentistPublic } from '@/api/types';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Choice,
  Empty,
  ErrorState,
  Field,
  Loading,
} from '@/components/ui';
import { rupees, SPECIALTIES } from '@/lib/patient';
import { ui } from '@/theme';

export function DentistPicker({
  type,
  selectedId,
  onSelect,
}: {
  type?: 'video' | 'clinic';
  selectedId?: string;
  onSelect: (dentist: DentistPublic) => void;
}) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState('All dentists');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const {
    currentData: data,
    isFetching,
    error,
    refetch,
  } = useDentistsQuery({
    q: query || undefined,
    specialization: specialty === 'All dentists' ? undefined : specialty,
    type,
    page,
  });
  const dentists = (data?.items ?? []).filter(
    d => d.id && (type !== 'clinic' || !!d.clinics?.length),
  );
  return (
    <View style={ui.stack}>
      <Field
        label="Search dentists"
        placeholder="Name, specialty, area or language"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={ui.row}
      >
        {SPECIALTIES.map(value => (
          <Choice
            compact
            key={value}
            title={value}
            selected={value === specialty}
            onPress={() => {
              setSpecialty(value);
              setPage(1);
            }}
          />
        ))}
      </ScrollView>
      {error ? (
        <ErrorState retry={refetch} />
      ) : isFetching ? (
        <Loading />
      ) : dentists.length ? (
        dentists.map(d => (
          <Card
            key={d.id}
            onPress={() => onSelect(d)}
            style={
              selectedId === d.id
                ? { borderColor: '#0D7870', borderWidth: 2 }
                : undefined
            }
          >
            <View style={[ui.row, { alignItems: 'flex-start' }]}>
              <Avatar name={d.fullName} />
              <View style={[ui.grow, { gap: 4 }]}>
                <Text style={[ui.body, { fontWeight: '600' }]}>
                  {d.fullName}
                </Text>
                <Text style={ui.muted}>
                  {d.specialization} · {d.yearsExperience ?? 0} years
                </Text>
                <Text style={ui.small}>
                  {d.clinics?.[0]?.name ?? 'Video consultations'}
                  {(d.clinics?.length ?? 0) > 1
                    ? ` +${d.clinics!.length - 1} more`
                    : ''}
                </Text>
                <Text style={ui.small}>
                  Speaks {d.languages?.join(', ') || 'English'}
                </Text>
              </View>
            </View>
            <View style={ui.between}>
              <View style={ui.wrap}>
                <Badge title="Verified" tone="green" />
                {d.offersVideo ? <Badge title="Video" /> : null}
              </View>
              <Text style={[ui.body, { fontWeight: '600' }]}>
                {rupees(type === 'video' ? d.feeVideoPaise : d.feeClinicPaise)}
              </Text>
            </View>
            {selectedId === d.id ? (
              <Text style={{ color: '#0D7870', fontWeight: '600' }}>
                Selected
              </Text>
            ) : null}
          </Card>
        ))
      ) : (
        <Empty
          icon={Search}
          title="No dentists found"
          message="Try another specialty or search term."
        />
      )}
      {page > 1 || data?.nextPage ? (
        <View style={ui.between}>
          <Button
            title="Previous"
            variant="secondary"
            small
            disabled={page === 1 || isFetching}
            onPress={() => setPage(p => p - 1)}
          />
          <Text style={ui.small}>Page {page}</Text>
          <Button
            title="Next"
            variant="secondary"
            small
            disabled={!data?.nextPage || isFetching}
            onPress={() => setPage(data?.nextPage ?? page)}
          />
        </View>
      ) : null}
    </View>
  );
}
