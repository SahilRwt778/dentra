import { StyleSheet, Text, View } from 'react-native';
import { BookOpen, ChevronRight, CircleAlert } from 'lucide-react-native';
import type { EducationArticle } from '@/content/dental-education';
import { Card } from '@/components/ui';
import { colors, ui } from '@/theme';

export function EducationArticleCard({
  article,
  onPress,
}: {
  article: EducationArticle;
  onPress(): void;
}) {
  const Icon = article.urgent ? CircleAlert : BookOpen;
  return (
    <Card
      label={`Read ${article.title}`}
      onPress={onPress}
      style={article.urgent && styles.urgent}
    >
      <View style={ui.row}>
        <View style={[styles.icon, article.urgent && styles.urgentIcon]}>
          <Icon size={22} color={article.urgent ? colors.red : colors.accent} />
        </View>
        <View style={[ui.grow, styles.copy]}>
          <Text style={styles.title}>{article.title}</Text>
          <Text style={ui.muted} numberOfLines={2}>
            {article.summary}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.muted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  copy: { gap: 5 },
  title: { ...ui.body, fontWeight: '600' },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgent: { borderColor: colors.red },
  urgentIcon: { backgroundColor: colors.redSoft },
});
