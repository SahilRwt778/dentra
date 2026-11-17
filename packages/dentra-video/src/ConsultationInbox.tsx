import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronRight, MessageCircle } from 'lucide-react-native';
import { consultationDeadline, type ConsultationCase } from '@dentra/call-core';
import { ProfileAvatar } from './ProfileAvatar';

export function ConsultationInbox({
  items,
  role,
  apiBaseUrl,
  loading,
  refreshing,
  error,
  onRefresh,
  onOpen,
  onNext,
  onPrevious,
}: {
  items: ConsultationCase[];
  role: 'patient' | 'dentist';
  apiBaseUrl: string;
  loading: boolean;
  refreshing: boolean;
  error?: string;
  onRefresh(): void;
  onOpen(item: ConsultationCase): void;
  onNext?: () => void;
  onPrevious?: () => void;
}) {
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListHeaderComponent={
        <Text style={styles.intro}>
          Messages, photos and reports for your consultations. Messaging stays
          open for 72 hours after the first paid visit is completed.
        </Text>
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color="#0D7870" />
        ) : (
          <View style={styles.empty}>
            <MessageCircle size={32} color="#617684" />
            <Text style={styles.title}>
              {error ? 'Could not load messages' : 'No conversations yet'}
            </Text>
            <Text style={styles.description}>
              {error || 'Your consultation conversations will appear here.'}
            </Text>
            {error && (
              <Pressable onPress={onRefresh} accessibilityRole="button">
                <Text style={styles.link}>Try again</Text>
              </Pressable>
            )}
          </View>
        )
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Messages with ${
            role === 'patient' ? item.dentistName : item.patientName
          }, ${item.unreadCount} unread`}
          onPress={() => onOpen(item)}
          style={styles.card}
        >
          <ProfileAvatar
            name={role === 'patient' ? item.dentistName : item.patientName}
            photoUrl={
              role === 'patient'
                ? item.dentistProfilePhotoUrl
                : item.patientProfilePhotoUrl
            }
            apiBaseUrl={apiBaseUrl}
          />
          <View style={styles.details}>
            <Text style={styles.title}>
              {role === 'patient' ? item.dentistName : item.patientName}
            </Text>
            <Text style={styles.description} numberOfLines={2}>
              {item.concern}
            </Text>
            <Text
              style={[styles.status, item.status === 'active' && styles.active]}
            >
              {item.status === 'active' && item.expiresAt
                ? `Open until ${consultationDeadline(item.expiresAt)}`
                : item.status === 'pending'
                ? 'Consultation chat'
                : 'Closed · History available'}
            </Text>
          </View>
          {item.unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.count}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          )}
          <ChevronRight size={18} color="#617684" />
        </Pressable>
      )}
      ListFooterComponent={
        <View>
          {onPrevious && (
            <Pressable
              accessibilityRole="button"
              style={styles.more}
              onPress={onPrevious}
            >
              <Text style={styles.link}>Previous page</Text>
            </Pressable>
          )}
          {onNext && (
            <Pressable
              accessibilityRole="button"
              style={styles.more}
              onPress={onNext}
            >
              <Text style={styles.link}>Next page</Text>
            </Pressable>
          )}
        </View>
      }
    />
  );
}
const styles = StyleSheet.create({
  content: { padding: 18, gap: 12, flexGrow: 1 },
  intro: { fontSize: 13, lineHeight: 20, color: '#617684', marginBottom: 4 },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7E4E7',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  details: { flex: 1, gap: 4 },
  title: { color: '#143040', fontSize: 15, fontWeight: '600' },
  description: { color: '#617684', fontSize: 13, lineHeight: 19 },
  status: { color: '#617684', fontSize: 11, lineHeight: 17 },
  active: { color: '#0D7870' },
  badge: {
    backgroundColor: '#0D7870',
    borderRadius: 12,
    minWidth: 22,
    padding: 4,
    alignItems: 'center',
  },
  count: { fontSize: 11, color: '#FFFFFF', fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  link: { color: '#0D7870', fontWeight: '600' },
  more: { alignItems: 'center', padding: 16 },
});
