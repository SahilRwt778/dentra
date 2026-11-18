import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { BookOpen, ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import {
  FEATURED_ARTICLE_IDS,
  findEducationArticle,
} from '@/content/dental-education';
import { Card, Section, TextLink } from '@/components/ui';
import type { PatientNavigation } from '@/navigation/types';
import { colors, ui } from '@/theme';

export function FeaturedEducation() {
  const navigation = useNavigation<PatientNavigation>();
  const { width } = useWindowDimensions();
  return (
    <Section
      title="Dental education"
      action={
        <TextLink
          title="View all"
          onPress={() => navigation.navigate('DentalEducation')}
        />
      }
    >
      <Text style={ui.muted}>
        Learn about everyday care and common dental concerns.
      </Text>
      <ScrollView
        horizontal
        style={styles.scroller}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cards}
      >
        {FEATURED_ARTICLE_IDS.map(id => {
          const found = findEducationArticle(id);
          if (!found) return null;
          const { article, category } = found;
          return (
            <Card
              key={id}
              label={`Read ${article.title}`}
              onPress={() =>
                navigation.navigate('EducationArticle', { articleId: id })
              }
              style={[styles.card, { width: Math.min(250, width * 0.72) }]}
            >
              <View style={styles.icon}>
                <BookOpen size={24} color={colors.accent} />
              </View>
              <Text style={styles.category}>{category.title}</Text>
              <Text style={ui.heading}>{article.title}</Text>
              <Text style={[ui.muted, ui.grow]} numberOfLines={3}>
                {article.summary}
              </Text>
              <View style={ui.row}>
                <Text style={styles.read}>Read article</Text>
                <ChevronRight size={16} color={colors.accent} />
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </Section>
  );
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0, flexShrink: 0 },
  cards: { gap: 12, paddingVertical: 2 },
  card: { minHeight: 240, gap: 10 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  category: { ...ui.small, color: colors.accentDeep },
  read: { ...ui.small, color: colors.accent, fontWeight: '600' },
});
