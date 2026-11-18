import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BookOpen,
  CalendarDays,
  CircleAlert,
  ExternalLink,
  Info,
} from 'lucide-react-native';
import {
  EDUCATION_DISCLAIMER,
  findEducationArticle,
} from '@/content/dental-education';
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorState,
  Screen,
} from '@/components/ui';
import type { PatientScreenProps } from '@/navigation/types';
import { colors, ui } from '@/theme';

export function EducationArticleScreen({
  route,
  navigation,
}: PatientScreenProps<'EducationArticle'>) {
  const found = findEducationArticle(route.params.articleId);
  const [sourceError, setSourceError] = useState(false);
  async function openSource(url: string) {
    setSourceError(false);
    try {
      await Linking.openURL(url);
    } catch {
      setSourceError(true);
    }
  }
  if (!found)
    return (
      <Screen title="Dental education" onBack={navigation.goBack}>
        <Empty
          icon={BookOpen}
          title="Article unavailable"
          message="Go back and choose another topic."
        />
      </Screen>
    );
  const { article, category } = found;
  return (
    <Screen
      title="Dental education"
      onBack={navigation.goBack}
      footer={
        article.concern && !article.urgent ? (
          <Button
            title="Book a consultation"
            icon={CalendarDays}
            onPress={() =>
              navigation.navigate('Booking', { concern: article.concern })
            }
          />
        ) : undefined
      }
    >
      <Badge title={category.title} tone={article.urgent ? 'red' : 'accent'} />
      <Text accessibilityRole="header" style={ui.title}>
        {article.title}
      </Text>
      <Text style={ui.muted}>{article.summary}</Text>
      {article.urgent && (
        <Card style={styles.urgent}>
          <View style={ui.row}>
            <CircleAlert size={22} color={colors.red} />
            <Text style={[ui.heading, styles.urgentText]}>
              Seek urgent care
            </Text>
          </View>
          <Text style={[ui.body, styles.urgentText]}>
            Use local emergency or urgent dental services as described below. Do
            not wait for a routine app appointment.
          </Text>
        </Card>
      )}
      <Card>
        {article.body.filter(Boolean).map((paragraph, index) => (
          <Text key={`paragraph-${index}`} selectable style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}
        {article.points?.map((point, index) => (
          <View key={`point-${index}`} style={styles.point}>
            <Text style={styles.bullet}>•</Text>
            <Text selectable style={[styles.paragraph, ui.grow]}>
              {point}
            </Text>
          </View>
        ))}
      </Card>
      {!!article.sources?.length && (
        <Card>
          <Text style={ui.heading}>Sources and further reading</Text>
          {article.sources.map(source => (
            <Pressable
              key={source.url}
              accessibilityRole="link"
              accessibilityLabel={source.title}
              accessibilityHint="Opens in your browser"
              onPress={() => openSource(source.url)}
              style={styles.source}
            >
              <Text style={[ui.body, ui.grow, styles.sourceText]}>
                {source.title}
              </Text>
              <ExternalLink size={17} color={colors.accent} />
            </Pressable>
          ))}
        </Card>
      )}
      {sourceError && (
        <ErrorState message="Couldn’t open this source. Please try again." />
      )}
      <View style={styles.disclaimer}>
        <Info size={18} color={colors.muted} />
        <Text style={[ui.small, ui.grow]}>{EDUCATION_DISCLAIMER}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  paragraph: { ...ui.body, lineHeight: 25 },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { color: colors.accent, fontSize: 20, lineHeight: 25 },
  urgent: { borderColor: colors.red, backgroundColor: colors.redSoft },
  urgentText: { color: colors.red },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingVertical: 8,
  },
  sourceText: { color: colors.accent, fontWeight: '600' },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    backgroundColor: colors.soft,
    borderRadius: 12,
  },
});
