import { useAppActive } from './useAppActive';
import { AppImage } from './AppImage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
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
  createChatMediaLoader,
  type ChatAttachment,
  type ChatClient,
  type ChatFile,
} from '@dentra/call-core';
import { ArrowLeft, ExternalLink, Paperclip } from 'lucide-react-native';
import { ChatAttachmentMenu } from './ChatAttachmentMenu';
import { ChatAttachment as AttachmentCard } from './ChatAttachment';
import { ChatPhotoViewer } from './ChatPhotoViewer';
import { useChatScroll } from './useChatScroll';
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
type Photo = { path: string; name: string; mime: string };
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
  presentation = 'modal',
}: {
  appointmentId: string;
  client: NativeChatClient;
  visible: boolean;
  onClose(): void;
  onUnread(count: number): void;
  title?: string;
  subtitle?: string;
  presentation?: 'modal' | 'screen';
  callCamera?: {
    enabled: boolean;
    setEnabled(enabled: boolean): Promise<void>;
  };
}) {
  const active = useAppActive();
  const chat = useCallChat(appointmentId, client, visible && active);
  const media = useMemo(
    () =>
      createChatMediaLoader(async (attachment, signal) => {
        if (!visible)
          throw new Error('Open the conversation to view attachments.');
        return {
          uri: fileUri(
            await client.download(appointmentId, attachment, signal),
          ),
        };
      }),
    [appointmentId, client, visible],
  );
  useEffect(() => () => media.clear(), [media]);
  const [text, setText] = useState('');
  const [file, setFile] = useState<ChatFile>();
  const [requestId, setRequestId] = useState(() => client.requestId());
  const [notice, setNotice] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [opening, setOpening] = useState<string>();
  const [photo, setPhoto] = useState<Photo>();
  const operation = useRef<AbortController | null>(null);
  const live = useRef(true);
  const tail = chat.items.at(-1)?.sequence;
  const timeline = useChatScroll(tail, visible && active, appointmentId);

  useEffect(() => {
    onUnread(chat.unread);
  }, [chat.unread, onUnread]);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      operation.current?.abort();
    };
  }, []);
  useEffect(() => {
    operation.current?.abort();
    setOpening(undefined);
    setPhoto(undefined);
    setAttachmentsOpen(false);
  }, [visible, appointmentId, client]);
  useEffect(() => {
    if (presentation !== 'screen' || !visible || (!photo && !attachmentsOpen))
      return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setPhoto(undefined);
        setAttachmentsOpen(false);
        return true;
      },
    );
    return () => subscription.remove();
  }, [presentation, visible, photo, attachmentsOpen]);

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
      const { uri } = await media.load(attachment);
      const path = uri.startsWith('file://') ? uri.slice(7) : uri;
      if (abort.signal.aborted) return;
      if (attachment.mimeType.startsWith('image/'))
        setPhoto({ path, name: attachment.name, mime: attachment.mimeType });
      else await client.openFile(path, attachment.mimeType);
    } catch (error) {
      if (!abort.signal.aborted)
        setNotice(
          error instanceof Error
            ? error.message
            : 'Could not open the attachment.',
        );
    } finally {
      if (live.current && !abort.signal.aborted) setOpening(undefined);
    }
  }
  function close() {
    operation.current?.abort();
    setOpening(undefined);
    if (photo) setPhoto(undefined);
    else if (attachmentsOpen) setAttachmentsOpen(false);
    else onClose();
  }

  const content = (
    <SafeAreaView style={[styles.screen, photo && styles.photoScreen]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photo ? 'Close photo' : 'Back'}
          onPress={close}
          style={styles.back}
        >
          <ArrowLeft size={24} color={photo ? '#FFFFFF' : '#122B39'} />
        </Pressable>
        <View style={styles.grow}>
          <Text numberOfLines={1} style={[styles.title, photo && styles.white]}>
            {photo?.name ?? title}
          </Text>
          {!photo && (
            <Text style={styles.muted}>
              {chat.loading
                ? 'Loading messages…'
                : !chat.canSend
                ? 'Messaging closed · History available'
                : subtitle ?? 'Private consultation messages'}
            </Text>
          )}
        </View>
        {photo && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open photo in another app"
            onPress={async () => {
              try {
                await client.openFile(photo.path, photo.mime);
              } catch {
                setNotice('Could not open the photo in another app.');
              }
            }}
            style={styles.back}
          >
            <ExternalLink size={23} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
      {photo && notice && (
        <Text accessibilityRole="alert" style={styles.error}>
          {notice}
        </Text>
      )}
      <View style={styles.grow}>
        <KeyboardAvoidingView
          style={styles.grow}
          pointerEvents={photo ? 'none' : 'auto'}
          accessibilityElementsHidden={!!photo}
          importantForAccessibility={photo ? 'no-hide-descendants' : 'auto'}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            ref={timeline.scroll}
            onLayout={timeline.onLayout}
            onContentSizeChange={timeline.onContentSizeChange}
            onScroll={timeline.onScroll}
            onScrollBeginDrag={timeline.onScrollBeginDrag}
            scrollEventThrottle={32}
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
          >
            {chat.hasOlder && (
              <Pressable
                onPress={() => {
                  timeline.preserveHistory();
                  void chat.older();
                }}
                accessibilityRole="button"
              >
                <Text style={styles.link}>Earlier messages</Text>
              </Pressable>
            )}
            {chat.loading && <ActivityIndicator color="#0D7870" />}
            {!chat.loading && !chat.items.length && (
              <Text style={styles.muted}>
                Messages, photos and PDF reports shared for this consultation
                appear here.
              </Text>
            )}
            {chat.items.map(item => (
              <View
                key={item.id}
                style={[styles.bubble, item.own ? styles.own : styles.other]}
              >
                <Text style={styles.sender}>
                  {item.own
                    ? 'You'
                    : item.senderRole === 'dentist'
                    ? 'Dentist'
                    : 'Patient'}
                </Text>
                {item.attachment && (
                  <AttachmentCard
                    file={item.attachment}
                    loader={media}
                    visible={visible && active}
                    opening={opening === item.attachment.id}
                    onOpen={() => void open(item.attachment!)}
                  />
                )}
                {!!item.text && (
                  <Text selectable style={styles.body}>
                    {item.text}
                  </Text>
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
                  <AppImage
                    source={{ uri: file.uri }}
                    objectFit="cover"
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
                  setAttachmentsOpen(value => !value);
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
        {photo && (
          <View style={styles.photoOverlay}>
            <ChatPhotoViewer
              key={photo.path}
              uri={fileUri(photo.path)}
              name={photo.name}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
  if (presentation === 'screen') return content;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={close}
      presentationStyle="fullScreen"
    >
      <SafeAreaProvider>{content}</SafeAreaProvider>
    </Modal>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F7F7' },
  grow: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  title: { fontSize: 21, fontWeight: '700', color: '#122B39' },
  muted: { color: '#5D707A', fontSize: 12 },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  photoOverlay: { ...StyleSheet.absoluteFill, backgroundColor: '#102B39' },
});
