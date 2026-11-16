import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, FileText, Images, X } from 'lucide-react-native';
import type { ChatAttachmentSource } from './pickChatFile';

const options = [
  { source: 'photos', label: 'Gallery', icon: Images, color: '#7954CF' },
  { source: 'camera', label: 'Camera', icon: Camera, color: '#CE4E78' },
  { source: 'file', label: 'File', icon: FileText, color: '#477BC4' },
] as const;

export function ChatAttachmentMenu({
  onSelect,
  onClose,
}: {
  onSelect(source: ChatAttachmentSource): void;
  onClose(): void;
}) {
  return (
    <View style={styles.panel} testID="chat-attachment-options">
      <View style={styles.heading}>
        <Text style={styles.title}>Share an attachment</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close attachment options"
          onPress={onClose}
          hitSlop={10}
        >
          <X size={20} color="#5D707A" />
        </Pressable>
      </View>
      <View style={styles.options}>
        {options.map(({ source, label, icon: Icon, color }) => (
          <Pressable
            key={source}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => onSelect(source)}
            style={styles.option}
          >
            <View style={[styles.icon, { backgroundColor: color }]}>
              <Icon size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.label}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>JPEG, PNG or PDF · Up to 10 MB</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: 16,
    gap: 16,
    borderRadius: 16,
    backgroundColor: '#F3F7F7',
    borderWidth: 1,
    borderColor: '#D8E4E5',
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: '#122B39', fontWeight: '600', fontSize: 14 },
  options: { flexDirection: 'row', gap: 12 },
  option: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 4 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: '#122B39', fontSize: 13, fontWeight: '600' },
  hint: { color: '#5D707A', fontSize: 11, textAlign: 'center' },
});
