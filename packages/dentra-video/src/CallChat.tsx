import { useAppActive } from './useAppActive';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  useCallChat,
  type ChatAttachment,
  type ChatClient,
  type ChatFile,
} from '@dentra/call-core';
import { Paperclip } from 'lucide-react-native';
import { ChatAttachmentMenu } from './ChatAttachmentMenu';
import type { ChatAttachmentSource } from './pickChatFile';

export type NativeChatClient = ChatClient & {
  requestId(): string;
  pick(source: ChatAttachmentSource): Promise<ChatFile | undefined>;
  download(
    id: string,
    file: ChatAttachment,
    signal: AbortSignal,
  ): Promise<string>;
  openFile(path: string, mime: string): Promise<void>;
};
type Photo = { path: string; name: string };
const fileUri = (path: string) =>
  path.startsWith('/') ? `file://${path}` : path;

/** Showing or closing chat never replaces its parent video room. */
export function CallChat({
  appointmentId,
  client,
  visible,
  onClose,
  onUnread,
  callCamera,
  title = 'Consultation chat',
  subtitle,
}: {
  appointmentId: string;
  client: NativeChatClient;
  visible: boolean;
  onClose(): void;
  onUnread(count: number): void;
  title?: string;
  subtitle?: string;
  callCamera?: {
    enabled: boolean;
    setEnabled(enabled: boolean): Promise<void>;
  };
}) {
  const active = useAppActive();
  const chat = useCallChat(appointmentId, client, visible && active);
  const [text, setText] = useState('');
  const [file, setFile] = useState<ChatFile>();
  const [requestId, setRequestId] = useState(() => client.requestId());
  const [notice, setNotice] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [opening, setOpening] = useState<string>();
  const [photo, setPhoto] = useState<Photo>();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const operation = useRef<AbortController | null>(null);
  const live = useRef(true);
  const tail = chat.items.at(-1)?.sequence;

  useEffect(() => {
    onUnread(chat.unread);
  }, [chat.unread, onUnread]);
  useEffect(() => {
    if (visible) scroll.current?.scrollToEnd({ animated: false });
  }, [tail, visible]);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      operation.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!visible) {
      operation.current?.abort();
      setPhoto(undefined);
      setAttachmentsOpen(false);
    }
  }, [visible]);

  function edit(value: string) {
    setText(value);
    setRequestId(client.requestId());
  }
  async function pick(source: ChatAttachmentSource) {
    if (picking || chat.sending) return;
    setAttachmentsOpen(false);
    setPicking(true);
    setNotice(undefined);
    const restoreCamera = source === 'camera' && callCamera?.enabled;
    try {
      if (restoreCamera) await callCamera.setEnabled(false);
      const selected = await client.pick(source);
      if (selected && live.current) {
        setFile(selected);
        setRequestId(client.requestId());
      }
    } catch (error) {
      if (live.current)
        setNotice(
          error instanceof Error
            ? error.message
            : 'Could not choose the attachment.',
        );
    } finally {
      if (restoreCamera && live.current) {
        try {
          await callCamera.setEnabled(true);
        } catch {
          setNotice('Turn your call camera back on using the call controls.');
        }
      }
      if (live.current) setPicking(false);
    }
  }
  async function send() {
    if (await chat.send({ requestId, text, file })) {
      setText('');
      setFile(undefined);
      setRequestId(client.requestId());
    }
  }
  async function open(attachment: ChatAttachment) {
    setAttachmentsOpen(false);
    operation.current?.abort();
    const abort = new AbortController();
    operation.current = abort;
    setOpening(attachment.id);
    setNotice(undefined);
    try {
      const path = await client.download(
        appointmentId,
        attachment,
        abort.signal,
      );
      if (abort.signal.aborted) return;
      if (attachment.mimeType.startsWith('image/'))
        setPhoto({ path, name: attachment.name });
      else await client.openFile(path, attachment.mimeType);
    } catch (error) {
      if (!abort.signal.aborted)
        setNotice(
          error instanceof Error
            ? error.message
            : 'Could not open the attachment.',
        );
    } finally {
      if (live.current) setOpening(undefined);
    }
  }
  function close() {
    if (photo) setPhoto(undefined);
    else if (attachmentsOpen) setAttachmentsOpen(false);
    else onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={close}
      presentationStyle="fullScreen"
    >
      <SafeAreaProvider>
        <SafeAreaView style={[styles.screen, photo && styles.photoScreen]}>
          <View style={styles.header}>
            <View style={styles.grow}>
              <Text
                numberOfLines={1}
                style={[styles.title, photo && styles.white]}
              >
                {photo?.name ?? title}
              </Text>
              {!photo && (
                <Text style={styles.muted}>
                  {!chat.canSend
                    ? 'Messaging closed · History available'
                    : subtitle ?? 'Private consultation messages'}
                </Text>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={photo ? 'Close photo' : 'Close chat'}
              onPress={close}
              style={styles.close}
            >
              <Text style={styles.white}>×</Text>
            </Pressable>
          </View>
          {photo ? (
            <Image
              source={{ uri: fileUri(photo.path) }}
              resizeMode="contain"
              style={styles.photo}
            />
          ) : (
            <KeyboardAvoidingView
              style={styles.grow}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              <ScrollView
                ref={scroll}
                contentContainerStyle={styles.messages}
                keyboardShouldPersistTaps="handled"
              >
                {chat.hasOlder && (
                  <Pressable onPress={chat.older} accessibilityRole="button">
                    <Text style={styles.link}>Earlier messages</Text>
                  </Pressable>
                )}
                {chat.loading && <ActivityIndicator color="#0D7870" />}
                {!chat.loading && !chat.items.length && (
                  <Text style={styles.muted}>
                    Messages, photos and PDF reports shared for this
                    consultation appear here.
                  </Text>
                )}
                {chat.items.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.bubble,
                      item.own ? styles.own : styles.other,
                    ]}
                  >
                    <Text style={styles.sender}>
                      {item.own
                        ? 'You'
                        : item.senderRole === 'dentist'
                        ? 'Dentist'
                        : 'Patient'}
                    </Text>
                    {!!item.text && (
                      <Text selectable style={styles.body}>
                        {item.text}
                      </Text>
                    )}
                    {item.attachment && (
                      <Pressable
                        onPress={() => open(item.attachment!)}
                        disabled={!!opening}
                        accessibilityRole="button"
                        style={styles.file}
                      >
                        <Text style={styles.link}>
                          {opening === item.id
                            ? 'Opening…'
                            : item.attachment.mimeType.startsWith('image/')
                            ? 'View photo'
                            : 'Open PDF'}
                        </Text>
                        <Text numberOfLines={2} style={styles.muted}>
                          {item.attachment.name} ·{' '}
                          {Math.ceil(item.attachment.sizeBytes / 1024)} KB
                        </Text>
                      </Pressable>
                    )}
                    <Text style={styles.time}>
                      {new Date(item.createdAt).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                ))}
              </ScrollView>
              {!!(notice || chat.error) && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {notice || chat.error}
                </Text>
              )}
              <View style={styles.composer}>
                {attachmentsOpen && (
                  <ChatAttachmentMenu
                    onSelect={pick}
                    onClose={() => setAttachmentsOpen(false)}
                  />
                )}
                {file && (
                  <View style={styles.preview}>
                    {file.type.startsWith('image/') ? (
                      <Image
                        source={{ uri: file.uri }}
                        resizeMode="cover"
                        style={styles.thumbnail}
                      />
                    ) : (
                      <Text style={styles.link}>PDF</Text>
                    )}
                    <Text numberOfLines={2} style={styles.grow}>
                      {file.name}
                    </Text>
                    <Pressable
                      accessibilityLabel="Remove attachment"
                      accessibilityRole="button"
                      disabled={chat.sending}
                      onPress={() => {
                        setFile(undefined);
                        setRequestId(client.requestId());
                      }}
                      style={styles.close}
                    >
                      <Text style={styles.white}>×</Text>
                    </Pressable>
                  </View>
                )}
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add attachment"
                    accessibilityState={{ expanded: attachmentsOpen }}
                    disabled={!chat.canSend || chat.sending || picking}
                    onPress={() => {
                      Keyboard.dismiss();
                      setAttachmentsOpen((value) => !value);
                    }}
                    style={styles.attach}
                  >
                    {picking ? (
                      <ActivityIndicator color="#0D7870" />
                    ) : (
                      <Paperclip size={23} color="#0D7870" />
                    )}
                  </Pressable>
                  <TextInput
                    accessibilityLabel="Chat message"
                    placeholder="Write a message…"
                    value={text}
                    onChangeText={edit}
                    onFocus={() => setAttachmentsOpen(false)}
                    editable={chat.canSend && !chat.sending}
                    multiline
                    maxLength={4000}
                    style={styles.input}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Send chat message"
                    disabled={
                      !chat.canSend ||
                      chat.sending ||
                      picking ||
                      (!text.trim() && !file)
                    }
                    onPress={send}
                    style={styles.send}
                  >
                    <Text style={styles.white}>
                      {chat.sending ? 'Sending…' : 'Send'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </KeyboardAvoidingView>
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F7F7' },
  grow: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  title: { fontSize: 21, fontWeight: '700', color: '#122B39' },
  muted: { color: '#5D707A', fontSize: 12 },
  close: {
    backgroundColor: '#C53232',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  white: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  messages: { padding: 16, gap: 12 },
  bubble: { padding: 12, borderRadius: 14, maxWidth: '90%', gap: 6 },
  own: { backgroundColor: '#DDF1ED', alignSelf: 'flex-end' },
  other: { backgroundColor: '#FFFFFF', alignSelf: 'flex-start' },
  sender: { fontSize: 12, fontWeight: '700', color: '#12665F' },
  body: { fontSize: 16, color: '#122B39', lineHeight: 23 },
  time: { fontSize: 10, color: '#5D707A', alignSelf: 'flex-end' },
  file: { padding: 10, borderRadius: 8, backgroundColor: '#EDF5F5', gap: 5 },
  link: { color: '#0D7870', fontWeight: '700', fontSize: 15 },
  composer: { backgroundColor: '#FFFFFF', padding: 14, gap: 12 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CADADC',
    borderRadius: 12,
    padding: 12,
    color: '#122B39',
    minHeight: 48,
    maxHeight: 120,
  },
  actions: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  attach: {
    width: 42,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: {
    backgroundColor: '#0D7870',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  error: { padding: 12, color: '#B52C2C', backgroundColor: '#FDECEC' },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumbnail: { width: 64, height: 64, borderRadius: 8 },
  photoScreen: { backgroundColor: '#102B39' },
  photo: { flex: 1, width: '100%' },
});
